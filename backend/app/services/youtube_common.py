from yt_dlp import YoutubeDL


class QuietYTDLPLogger:
    def debug(self, msg: str) -> None:
        return None

    def warning(self, msg: str) -> None:
        return None

    def error(self, msg: str) -> None:
        return None


def make_ydl(extra_options: dict | None = None) -> YoutubeDL:
    base_options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "ignoreerrors": True,
        "logger": QuietYTDLPLogger(),
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        },
    }

    if extra_options:
        base_options.update(extra_options)

    return YoutubeDL(base_options)


def best_thumbnail_url(info: dict) -> str | None:
    thumbnails = info.get("thumbnails") or info.get("thumbnail") or []

    if isinstance(thumbnails, str):
        return thumbnails

    if not isinstance(thumbnails, list) or not thumbnails:
        return info.get("thumbnail")

    last = thumbnails[-1]
    if isinstance(last, dict):
        return last.get("url")

    return None
