from fastapi import APIRouter

from app.schemas.video import (
    FolderPickResponse,
    KnowledgeBaseCreateRequest,
    KnowledgeBaseCreateResponse,
    RankVideosRequest,
    RankVideosResponse,
    VideoSearchRequest,
    VideoSearchResponse,
    VideoPageRequest,
    VideoPageResponse,
)
from app.core.config import get_settings
from app.services.video_ranker import (
    keyword_rank_videos,
    rank_videos,
)
from app.services.knowledge_base import create_knowledge_base
from app.services.folder_picker import pick_folder
from app.services.youtube_videos import (
    enrich_videos,
    fetch_channel_video_catalog,
    fetch_channel_videos_page,
)

router = APIRouter(prefix="/api/videos", tags=["videos"])


@router.post("/page", response_model=VideoPageResponse)
def get_video_page(request: VideoPageRequest) -> VideoPageResponse:
    videos, has_more, total_count = fetch_channel_videos_page(
        channel_url=request.channel_url,
        page=request.page,
        page_size=request.page_size,
        enrich=request.enrich,
        include_total=request.include_total,
    )

    return VideoPageResponse(
        channel_url=request.channel_url,
        page=request.page,
        page_size=request.page_size,
        count=len(videos),
        total_count=total_count,
        has_more=has_more,
        videos=videos,
    )


@router.post("/search", response_model=VideoSearchResponse)
def search_video_candidates(request: VideoSearchRequest) -> VideoSearchResponse:
    settings = get_settings()
    default_limit = settings.video_search_result_limit
    max_limit = 1000
    limit = min(request.limit or default_limit, max_limit)
    scan_limit = max(limit, settings.video_search_scan_limit)
    catalog, total_count = fetch_channel_video_catalog(
        request.channel_url,
        limit=scan_limit,
    )
    keyword_ranked = keyword_rank_videos(
        query=request.query,
        videos=catalog,
        limit=limit,
        auto_select_threshold=request.auto_select_threshold,
    )

    if request.enrich:
        enriched = enrich_videos(keyword_ranked)
        keyword_ranked = keyword_rank_videos(
            query=request.query,
            videos=enriched,
            limit=limit,
            auto_select_threshold=request.auto_select_threshold,
        )

    videos = keyword_ranked

    return VideoSearchResponse(
        channel_url=request.channel_url,
        query=request.query,
        total_count=total_count,
        candidate_count=len(catalog),
        videos=videos,
    )


@router.post("/knowledge-base", response_model=KnowledgeBaseCreateResponse)
def create_video_knowledge_base(
    request: KnowledgeBaseCreateRequest,
) -> KnowledgeBaseCreateResponse:
    return create_knowledge_base(request)


@router.get("/knowledge-base/folder", response_model=FolderPickResponse)
def pick_knowledge_base_folder() -> FolderPickResponse:
    path = pick_folder("Choose where to create the YouTube knowledge base")
    return FolderPickResponse(path=path or None, cancelled=not bool(path))


@router.post("/rank", response_model=RankVideosResponse)
def rank_video_candidates(request: RankVideosRequest) -> RankVideosResponse:
    ranked = rank_videos(
        query=request.query,
        videos=request.videos,
        auto_select_threshold=request.auto_select_threshold,
    )

    return RankVideosResponse(
        query=request.query,
        auto_select_threshold=request.auto_select_threshold,
        videos=ranked,
    )
