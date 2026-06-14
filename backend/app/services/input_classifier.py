from urllib.parse import urlparse

YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
}


def _normalize_for_parse(value: str) -> str:
    cleaned = value.strip()
    if "://" not in cleaned and (
        cleaned.startswith("youtube.com")
        or cleaned.startswith("www.youtube.com")
        or cleaned.startswith("m.youtube.com")
        or cleaned.startswith("youtu.be")
    ):
        return f"https://{cleaned}"
    return cleaned


def is_youtube_url(value: str) -> bool:
    cleaned = _normalize_for_parse(value)
    parsed = urlparse(cleaned)
    return parsed.netloc.lower() in YOUTUBE_HOSTS


def normalize_youtube_url(value: str) -> str:
    cleaned = value.strip()
    if cleaned.startswith("youtube.com") or cleaned.startswith("www.youtube.com"):
        return f"https://{cleaned}"
    if cleaned.startswith("m.youtube.com") or cleaned.startswith("youtu.be"):
        return f"https://{cleaned}"
    return cleaned


def classify_channel_input(value: str) -> str:
    cleaned = value.strip()

    if not cleaned:
        return "channel_name"

    if is_youtube_url(cleaned):
        return "youtube_url"

    return "channel_name"
