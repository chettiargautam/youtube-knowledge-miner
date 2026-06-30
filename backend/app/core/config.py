from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "youtube-channel-miner"
    app_env: str = "local"

    frontend_origin: str = "http://localhost:3000"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000

    default_channel_search_limit: int = 8
    video_metadata_workers: int = 4
    request_timeout_seconds: int = 20
    video_search_result_limit: int = 500
    video_search_scan_limit: int = 1000
    youtube_transcript_delay_seconds: float = 1.0
    youtube_transcript_proxy_http: str = ""
    youtube_transcript_proxy_https: str = ""
    webshare_proxy_username: str = ""
    webshare_proxy_password: str = ""
    webshare_proxy_locations: str = ""
    webshare_proxy_retries_when_blocked: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            self.frontend_origin,
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
