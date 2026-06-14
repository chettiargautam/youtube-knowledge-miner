import re
from datetime import datetime


def compact_whitespace(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def parse_human_count(value: str | int | float | None) -> int | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return int(value)

    text = (
        value.lower()
        .replace(",", "")
        .replace("\u00a0", " ")
        .replace("subscribers", "")
        .replace("subscriber", "")
        .replace("videos", "")
        .replace("video", "")
        .strip()
    )

    match = re.search(r"(\d+(?:\.\d+)?)\s*([kmb])?", text)

    if not match:
        return None

    number = float(match.group(1))
    suffix = match.group(2)

    multiplier = 1
    if suffix == "k":
        multiplier = 1_000
    elif suffix == "m":
        multiplier = 1_000_000
    elif suffix == "b":
        multiplier = 1_000_000_000

    return int(number * multiplier)

def format_duration(seconds: int | float | str | None) -> str | None:
    if seconds is None:
        return None

    try:
        total_seconds = int(float(seconds))
    except (TypeError, ValueError):
        return None

    if total_seconds < 0:
        return None

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60

    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"

    return f"{minutes}:{secs:02d}"

def format_upload_date(value: str | None) -> str | None:
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y%m%d").date().isoformat()
    except ValueError:
        return value
