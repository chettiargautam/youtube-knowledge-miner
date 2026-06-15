from pydantic import BaseModel, Field


class VideoPageRequest(BaseModel):
    channel_url: str = Field(..., min_length=1)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    enrich: bool = True
    include_total: bool = True


class VideoMetadata(BaseModel):
    video_id: str
    url: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    duration_text: str | None = None
    upload_date: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    comment_count: int | None = None
    channel_id: str | None = None
    channel_name: str | None = None
    channel_url: str | None = None
    tags: list[str] = []
    availability: str | None = None


class VideoPageResponse(BaseModel):
    channel_url: str
    page: int
    page_size: int
    count: int
    total_count: int | None = None
    has_more: bool
    videos: list[VideoMetadata]


class VideoSearchRequest(BaseModel):
    channel_url: str = Field(..., min_length=1)
    query: str = Field(..., min_length=1)
    limit: int | None = Field(default=None, ge=1, le=1000)
    enrich: bool = True
    auto_select_threshold: float = Field(default=55, ge=0, le=100)


class TopicVideoSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=50, ge=1, le=100)
    enrich: bool = False
    auto_select_threshold: float = Field(default=80, ge=0, le=100)


class RankVideosRequest(BaseModel):
    query: str = Field(..., min_length=1)
    videos: list[VideoMetadata]
    auto_select_threshold: float = Field(default=55, ge=0, le=100)


class RankedVideo(VideoMetadata):
    topic_score: float
    selected: bool
    rank_reason: str


class RankVideosResponse(BaseModel):
    query: str
    auto_select_threshold: float
    videos: list[RankedVideo]


class VideoSearchResponse(BaseModel):
    channel_url: str
    query: str
    total_count: int | None = None
    candidate_count: int
    videos: list[RankedVideo]


class TopicVideoSearchResponse(BaseModel):
    query: str
    total_count: int | None = None
    candidate_count: int
    videos: list[RankedVideo]


class KnowledgeBaseVideoInput(BaseModel):
    video_id: str
    url: str
    title: str | None = None


class KnowledgeBaseCreateRequest(BaseModel):
    channel_name: str = Field(..., min_length=1)
    channel_url: str = Field(..., min_length=1)
    output_dir: str = Field(..., min_length=1)
    videos: list[KnowledgeBaseVideoInput] = Field(..., min_length=1)
    include_comments: bool = True
    max_comments: int = Field(default=50, ge=0, le=500)
    download_transcribe_if_missing: bool = False


class KnowledgeBaseFileResult(BaseModel):
    video_id: str
    title: str
    file_path: str
    transcript_status: str
    comments_count: int


class KnowledgeBaseCreateResponse(BaseModel):
    output_path: str
    count: int
    files: list[KnowledgeBaseFileResult]
    warnings: list[str] = []


class FolderPickResponse(BaseModel):
    path: str | None = None
    cancelled: bool = False
