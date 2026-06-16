from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache

from app.core.config import get_settings
from app.schemas.video import VideoMetadata
from app.services.youtube_common import best_thumbnail_url, make_ydl
from app.utils.text import compact_whitespace, format_duration, format_upload_date


def _normalize_channel_videos_url(channel_url: str) -> str:
    cleaned = channel_url.strip()

    if "youtube.com" not in cleaned:
        return cleaned

    if "/watch?" in cleaned or "/playlist?" in cleaned:
        return cleaned

    if cleaned.endswith("/videos"):
        return cleaned

    if "/videos?" in cleaned:
        return cleaned

    return cleaned.rstrip("/") + "/videos"


def _video_url(video_id_or_url: str) -> str:
    if video_id_or_url.startswith("http"):
        return video_id_or_url

    return f"https://www.youtube.com/watch?v={video_id_or_url}"


def _looks_like_short(info: dict, url: str | None = None) -> bool:
    duration = info.get("duration")

    if isinstance(duration, int) and duration <= 60:
        return True

    text_values = [
        str(url or ""),
        str(info.get("url") or ""),
        str(info.get("webpage_url") or ""),
        str(info.get("original_url") or ""),
    ]

    if any("/shorts/" in value for value in text_values):
        return True

    thumbnails = info.get("thumbnails")
    if isinstance(thumbnails, list):
        return any(
            isinstance(thumbnail, dict)
            and isinstance(thumbnail.get("url"), str)
            and "/oar" in thumbnail["url"]
            for thumbnail in thumbnails
        )

    thumbnail = info.get("thumbnail")
    return isinstance(thumbnail, str) and "/oar" in thumbnail


def _metadata_from_info(info: dict) -> VideoMetadata | None:
    video_id = info.get("id")
    if not video_id:
        return None

    duration = info.get("duration")

    return VideoMetadata(
        video_id=video_id,
        url=info.get("webpage_url") or _video_url(video_id),
        title=info.get("title") or "Untitled video",
        description=compact_whitespace(info.get("description")) or None,
        thumbnail_url=best_thumbnail_url(info),
        duration_seconds=duration,
        duration_text=format_duration(duration),
        upload_date=format_upload_date(info.get("upload_date")),
        view_count=info.get("view_count"),
        like_count=info.get("like_count"),
        comment_count=info.get("comment_count"),
        channel_id=info.get("channel_id") or info.get("uploader_id"),
        channel_name=info.get("channel") or info.get("uploader"),
        channel_url=info.get("channel_url") or info.get("uploader_url"),
        tags=info.get("tags") or [],
        availability=info.get("availability"),
        is_short=_looks_like_short(info, info.get("webpage_url")),
    )


def _flat_video_from_entry(entry: dict) -> VideoMetadata | None:
    video_id = entry.get("id")
    url = entry.get("url") or entry.get("webpage_url")

    if not video_id and isinstance(url, str) and "watch?v=" in url:
        video_id = url.split("watch?v=", 1)[1].split("&", 1)[0]

    if not video_id:
        return None

    duration = entry.get("duration")

    return VideoMetadata(
        video_id=video_id,
        url=_video_url(video_id),
        title=entry.get("title") or "Untitled video",
        description=compact_whitespace(entry.get("description")) or None,
        thumbnail_url=best_thumbnail_url(entry),
        duration_seconds=duration,
        duration_text=format_duration(duration),
        upload_date=format_upload_date(entry.get("upload_date")),
        view_count=entry.get("view_count"),
        like_count=entry.get("like_count"),
        comment_count=entry.get("comment_count"),
        channel_id=entry.get("channel_id") or entry.get("uploader_id"),
        channel_name=entry.get("channel") or entry.get("uploader"),
        channel_url=entry.get("channel_url") or entry.get("uploader_url"),
        tags=entry.get("tags") or [],
        availability=entry.get("availability"),
        is_short=_looks_like_short(entry, url),
    )


def _extract_single_video_metadata(video_id: str) -> VideoMetadata | None:
    with make_ydl({"extract_flat": False}) as ydl:
        info = ydl.extract_info(_video_url(video_id), download=False)

    if not isinstance(info, dict):
        return None

    return _metadata_from_info(info)


@lru_cache(maxsize=256)
def _fetch_channel_videos_flat_page(
    channel_url: str,
    page: int,
    page_size: int,
) -> tuple[VideoMetadata, ...]:
    normalized_url = _normalize_channel_videos_url(channel_url)
    start = ((page - 1) * page_size) + 1
    end = page * page_size

    with make_ydl(
        {
            "extract_flat": "in_playlist",
            "playliststart": start,
            "playlistend": end,
            "skip_download": True,
        }
    ) as ydl:
        info = ydl.extract_info(normalized_url, download=False)

    if not isinstance(info, dict):
        return ()

    entries = [entry for entry in info.get("entries", []) if isinstance(entry, dict)]
    return tuple(video for video in (_flat_video_from_entry(entry) for entry in entries) if video)


@lru_cache(maxsize=128)
def fetch_channel_video_count(channel_url: str) -> int | None:
    normalized_url = _normalize_channel_videos_url(channel_url)

    with make_ydl(
        {
            "extract_flat": "in_playlist",
            "playlistend": 5000,
            "skip_download": True,
        }
    ) as ydl:
        info = ydl.extract_info(normalized_url, download=False)

    if not isinstance(info, dict):
        return None

    playlist_count = info.get("playlist_count")
    if isinstance(playlist_count, int) and playlist_count > 0:
        return playlist_count

    entries = [entry for entry in info.get("entries", []) if isinstance(entry, dict)]
    return len(entries) or None


def fetch_channel_videos_page(
    channel_url: str,
    page: int = 1,
    page_size: int = 20,
    enrich: bool = True,
    include_total: bool = True,
) -> tuple[list[VideoMetadata], bool, int | None]:
    settings = get_settings()
    normalized_url = _normalize_channel_videos_url(channel_url)
    total_count = fetch_channel_video_count(channel_url) if include_total else None
    flat_videos = list(_fetch_channel_videos_flat_page(normalized_url, page, page_size))
    has_more = ((page * page_size) < total_count) if total_count is not None else len(flat_videos) >= page_size

    if not enrich or not flat_videos:
        return flat_videos, has_more, total_count

    enriched_by_id: dict[str, VideoMetadata] = {}

    max_workers = max(1, min(settings.video_metadata_workers, 8))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_extract_single_video_metadata, video.video_id): video.video_id
            for video in flat_videos
        }

        for future in as_completed(futures):
            video_id = futures[future]
            try:
                metadata = future.result()
                if metadata:
                    enriched_by_id[video_id] = metadata
            except Exception:
                continue

    merged = [enriched_by_id.get(video.video_id, video) for video in flat_videos]
    return merged, has_more, total_count


@lru_cache(maxsize=64)
def fetch_channel_video_catalog(channel_url: str, limit: int = 5000) -> tuple[list[VideoMetadata], int | None]:
    normalized_url = _normalize_channel_videos_url(channel_url)

    with make_ydl(
        {
            "extract_flat": "in_playlist",
            "playlistend": limit,
            "skip_download": True,
        }
    ) as ydl:
        info = ydl.extract_info(normalized_url, download=False)

    if not isinstance(info, dict):
        return [], None

    total_count = info.get("playlist_count")
    entries = [entry for entry in info.get("entries", []) if isinstance(entry, dict)]
    flat_videos = [video for video in (_flat_video_from_entry(entry) for entry in entries) if video]

    if not isinstance(total_count, int):
        total_count = len(flat_videos) or None

    return flat_videos, total_count


def enrich_videos(videos: list[VideoMetadata]) -> list[VideoMetadata]:
    if not videos:
        return []

    settings = get_settings()
    enriched_by_id: dict[str, VideoMetadata] = {}
    max_workers = max(1, min(settings.video_metadata_workers, 8))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_extract_single_video_metadata, video.video_id): video.video_id
            for video in videos
        }

        for future in as_completed(futures):
            video_id = futures[future]
            try:
                metadata = future.result()
                if metadata:
                    enriched_by_id[video_id] = metadata
            except Exception:
                continue

    return [enriched_by_id.get(video.video_id, video) for video in videos]


def search_youtube_videos(query: str, limit: int = 50) -> list[VideoMetadata]:
    search_limit = max(1, min(limit, 100))

    with make_ydl(
        {
            "extract_flat": "in_playlist",
            "skip_download": True,
        }
    ) as ydl:
        info = ydl.extract_info(f"ytsearch{search_limit}:{query}", download=False)

    if not isinstance(info, dict):
        return []

    entries = [entry for entry in info.get("entries", []) if isinstance(entry, dict)]
    return [video for video in (_flat_video_from_entry(entry) for entry in entries) if video]
