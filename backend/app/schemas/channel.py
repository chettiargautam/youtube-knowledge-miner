from typing import Literal
from pydantic import BaseModel, Field


ChannelInputType = Literal["youtube_url", "channel_name"]


class ChannelResolveRequest(BaseModel):
    query: str = Field(..., min_length=1)
    max_results: int = Field(default=8, ge=1, le=50)


class ChannelCandidate(BaseModel):
    channel_id: str | None = None
    name: str
    handle: str | None = None
    url: str
    description: str | None = None
    thumbnail_url: str | None = None
    subscriber_count_text: str | None = None
    subscriber_count: int | None = None
    video_count_text: str | None = None
    video_count: int | None = None
    verified: bool = False
    match_score: float = 0
    source: str


class ChannelResolveResponse(BaseModel):
    query: str
    input_type: ChannelInputType
    candidates: list[ChannelCandidate]
    selected_channel: ChannelCandidate | None = None
    message: str
