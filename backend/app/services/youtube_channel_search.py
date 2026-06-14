import json
import re
from collections import OrderedDict
from urllib.parse import quote_plus

import httpx
from rapidfuzz import fuzz

from app.core.config import get_settings
from app.schemas.channel import ChannelCandidate
from app.services.input_classifier import normalize_youtube_url
from app.services.youtube_common import best_thumbnail_url, make_ydl
from app.services.youtube_videos import fetch_channel_video_count
from app.utils.text import compact_whitespace, parse_human_count


def _node_text(node: object) -> str:
    if not node:
        return ""

    if isinstance(node, str):
        return node

    if isinstance(node, dict):
        if isinstance(node.get("simpleText"), str):
            return node["simpleText"]

        runs = node.get("runs")
        if isinstance(runs, list):
            return "".join(str(run.get("text", "")) for run in runs if isinstance(run, dict))

        accessibility = node.get("accessibility")
        if isinstance(accessibility, dict):
            accessibility_data = accessibility.get("accessibilityData")
            if isinstance(accessibility_data, dict):
                return str(accessibility_data.get("label", ""))

    if isinstance(node, list):
        return "".join(_node_text(item) for item in node)

    return ""

def _has_verified_badge(node: object) -> bool:
    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(key, str) and "verified" in key.lower():
                return True

            if isinstance(value, str):
                lowered = value.lower()
                if "badge_style_type_verified" in lowered or lowered == "verified" or "verified" in lowered:
                    return True

            if _has_verified_badge(value):
                return True

    elif isinstance(node, list):
        return any(_has_verified_badge(item) for item in node)

    elif isinstance(node, str):
        lowered = node.lower()
        return "badge_style_type_verified" in lowered or lowered == "verified"

    return False


def _extract_initial_data(html: str) -> dict | None:
    marker = "var ytInitialData = "
    start = html.find(marker)

    if start != -1:
        start += len(marker)
        end = html.find(";</script>", start)
        if end != -1:
            raw = html[start:end]
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass

    match = re.search(r"ytInitialData\s*=\s*({.*?});</script>", html, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return None

    return None


def _walk_for_channel_renderers(node: object) -> list[dict]:
    found: list[dict] = []

    if isinstance(node, dict):
        if isinstance(node.get("channelRenderer"), dict):
            found.append(node["channelRenderer"])

        for value in node.values():
            found.extend(_walk_for_channel_renderers(value))

    elif isinstance(node, list):
        for item in node:
            found.extend(_walk_for_channel_renderers(item))

    return found


def _channel_url_from_renderer(renderer: dict) -> str | None:
    command = (
        renderer.get("navigationEndpoint", {})
        .get("commandMetadata", {})
        .get("webCommandMetadata", {})
    )

    url = command.get("url")

    if isinstance(url, str) and url:
        if url.startswith("http"):
            return url
        return f"https://www.youtube.com{url}"

    browse = renderer.get("navigationEndpoint", {}).get("browseEndpoint", {})
    canonical = browse.get("canonicalBaseUrl")

    if isinstance(canonical, str) and canonical:
        if canonical.startswith("/"):
            return f"https://www.youtube.com{canonical}"
        if canonical.startswith("@"):
            return f"https://www.youtube.com/{canonical}"

    return None


def _candidate_from_channel_renderer(renderer: dict, query: str) -> ChannelCandidate | None:
    name = compact_whitespace(_node_text(renderer.get("title")))
    if not name:
        return None

    url = _channel_url_from_renderer(renderer)
    channel_id = renderer.get("channelId")

    if not url and channel_id:
        url = f"https://www.youtube.com/channel/{channel_id}"

    if not url:
        return None

    handle = None
    browse = renderer.get("navigationEndpoint", {}).get("browseEndpoint", {})
    canonical = browse.get("canonicalBaseUrl")

    if isinstance(canonical, str):
        handle = canonical.replace("/", "")

    description = compact_whitespace(_node_text(renderer.get("descriptionSnippet")))
    subscriber_text = compact_whitespace(_node_text(renderer.get("subscriberCountText")))
    video_count_text = compact_whitespace(_node_text(renderer.get("videoCountText")))

    # YouTube has changed this renderer a few times. In the current shape,
    # subscriberCountText can hold the handle while videoCountText holds the
    # subscriber label, so normalize the fields before parsing/count sorting.
    if subscriber_text.startswith("@") and "subscriber" in video_count_text.lower():
        if not handle:
            handle = subscriber_text
        subscriber_text, video_count_text = video_count_text, ""
    elif "subscriber" not in subscriber_text.lower() and "subscriber" in video_count_text.lower():
        subscriber_text, video_count_text = video_count_text, subscriber_text

    thumbnails = renderer.get("thumbnail", {}).get("thumbnails", [])
    thumbnail_url = None
    if isinstance(thumbnails, list) and thumbnails:
        last_thumb = thumbnails[-1]
        if isinstance(last_thumb, dict):
            thumbnail_url = last_thumb.get("url")

    verified = _has_verified_badge(renderer.get("ownerBadges"))

    score = float(fuzz.WRatio(query.lower(), name.lower()))
    if query.strip().lower() == name.strip().lower():
        score += 15
    if verified:
        score += 5

    subscriber_count = parse_human_count(subscriber_text)

    return ChannelCandidate(
        channel_id=channel_id,
        name=name,
        handle=handle,
        url=url,
        description=description or None,
        thumbnail_url=thumbnail_url,
        subscriber_count_text=subscriber_text or None,
        subscriber_count=subscriber_count,
        video_count_text=video_count_text or None,
        video_count=parse_human_count(video_count_text)
        if "video" in video_count_text.lower()
        else None,
        verified=verified,
        match_score=min(round(score, 2), 100),
        source="youtube_search_html",
    )


def _search_channels_from_youtube_html(query: str, max_results: int) -> list[ChannelCandidate]:
    settings = get_settings()

    # YouTube search filtered to channels. This is best-effort and can break if YouTube changes markup.
    url = (
        "https://www.youtube.com/results"
        f"?search_query={quote_plus(query)}"
        "&sp=EgIQAg%253D%253D"
    )

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    with httpx.Client(timeout=settings.request_timeout_seconds, follow_redirects=True) as client:
        response = client.get(url, headers=headers)
        response.raise_for_status()

    data = _extract_initial_data(response.text)
    if not data:
        return []

    renderers = _walk_for_channel_renderers(data)
    candidates = []

    for renderer in renderers:
        candidate = _candidate_from_channel_renderer(renderer, query)
        if candidate:
            candidates.append(candidate)

    return _dedupe_and_sort_candidates(candidates, max_results)


def _search_channels_from_ytdlp_video_results(query: str, max_results: int) -> list[ChannelCandidate]:
    grouped: OrderedDict[str, dict] = OrderedDict()

    with make_ydl({"extract_flat": True, "default_search": "ytsearch"}) as ydl:
        info = ydl.extract_info(f"ytsearch{max_results * 4}:{query}", download=False)

    entries = []
    if isinstance(info, dict):
        entries = [entry for entry in info.get("entries", []) if isinstance(entry, dict)]

    for entry in entries:
        name = entry.get("uploader") or entry.get("channel")
        channel_id = entry.get("channel_id") or entry.get("uploader_id")
        url = entry.get("channel_url") or entry.get("uploader_url")

        if not name or not url:
            continue

        key = channel_id or url or name

        if key not in grouped:
            grouped[key] = {
                "name": name,
                "channel_id": channel_id,
                "url": url,
                "count": 0,
                "sample_titles": [],
                "thumbnail_url": best_thumbnail_url(entry),
            }

        grouped[key]["count"] += 1
        if entry.get("title"):
            grouped[key]["sample_titles"].append(entry["title"])

    candidates = []

    for item in grouped.values():
        score = float(fuzz.WRatio(query.lower(), item["name"].lower()))
        score += min(item["count"] * 3, 12)

        candidates.append(
            ChannelCandidate(
                channel_id=item["channel_id"],
                name=item["name"],
                handle=None,
                url=item["url"],
                description=(
                    "Inferred from YouTube video search results. "
                    "Use this when direct channel search is unavailable."
                ),
                thumbnail_url=item["thumbnail_url"],
                subscriber_count_text=None,
                subscriber_count=None,
                video_count_text=None,
                video_count=None,
                verified=False,
                match_score=min(round(score, 2), 100),
                source="yt_dlp_video_search_fallback",
            )
        )

    return _dedupe_and_sort_candidates(candidates, max_results)


def _dedupe_and_sort_candidates(
    candidates: list[ChannelCandidate],
    max_results: int,
) -> list[ChannelCandidate]:
    deduped: OrderedDict[str, ChannelCandidate] = OrderedDict()

    for candidate in candidates:
        key = candidate.channel_id or candidate.url.lower()

        existing = deduped.get(key)
        if not existing:
            deduped[key] = candidate
            continue

        existing_richness = (
            1 if existing.subscriber_count is not None else 0,
            1 if existing.description else 0,
            1 if existing.thumbnail_url else 0,
            1 if existing.verified else 0,
        )
        candidate_richness = (
            1 if candidate.subscriber_count is not None else 0,
            1 if candidate.description else 0,
            1 if candidate.thumbnail_url else 0,
            1 if candidate.verified else 0,
        )

        if candidate_richness > existing_richness:
            candidate.match_score = max(candidate.match_score, existing.match_score)
            deduped[key] = candidate
        else:
            existing.match_score = max(existing.match_score, candidate.match_score)

    return sorted(
        deduped.values(),
        key=lambda item: (
            item.subscriber_count or 0,
            1 if item.verified else 0,
            item.match_score,
        ),
        reverse=True,
    )[:max_results]


def resolve_channel_url(value: str) -> ChannelCandidate | None:
    url = normalize_youtube_url(value)

    with make_ydl(
        {
            "extract_flat": "in_playlist",
            "playlistend": 1,
            "skip_download": True,
        }
    ) as ydl:
        info = ydl.extract_info(url, download=False)

    if not isinstance(info, dict):
        return None

    name = (
        info.get("channel")
        or info.get("uploader")
        or info.get("playlist_uploader")
        or info.get("title")
    )

    if not name:
        return None

    for suffix in [" - Videos", " - YouTube", " videos", " Videos"]:
        if isinstance(name, str) and name.endswith(suffix):
            name = name[: -len(suffix)]

    channel_url = (
        info.get("channel_url")
        or info.get("uploader_url")
        or info.get("webpage_url")
        or url
    )

    channel_id = info.get("channel_id") or info.get("uploader_id") or info.get("id")
    video_count = None
    try:
        video_count = fetch_channel_video_count(channel_url)
    except Exception:
        video_count = None

    return ChannelCandidate(
        channel_id=channel_id,
        name=compact_whitespace(name),
        handle=None,
        url=channel_url,
        description=compact_whitespace(info.get("description")) or None,
        thumbnail_url=best_thumbnail_url(info),
        subscriber_count_text=None,
        subscriber_count=None,
        video_count_text=f"{video_count:,} videos" if video_count is not None else None,
        video_count=video_count,
        verified=False,
        match_score=100,
        source="yt_dlp_url_resolve",
    )


def search_channels_by_name(query: str, max_results: int) -> list[ChannelCandidate]:
    candidates: list[ChannelCandidate] = []

    try:
        candidates.extend(_search_channels_from_youtube_html(query, max_results=max_results))
    except Exception:
        pass

    if len(candidates) < max_results:
        try:
            fallback = _search_channels_from_ytdlp_video_results(query, max_results=max_results)
            candidates.extend(fallback)
        except Exception:
            pass

    return _dedupe_and_sort_candidates(candidates, max_results=max_results)
