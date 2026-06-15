import json
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app.schemas.video import (
    FolderPickResponse,
    KnowledgeBaseCreateRequest,
    KnowledgeBaseCreateResponse,
    RankVideosRequest,
    RankVideosResponse,
    TopicVideoSearchRequest,
    TopicVideoSearchResponse,
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
from app.services.knowledge_base import create_knowledge_base, create_knowledge_base_events
from app.services.folder_picker import pick_folder
from app.services.youtube_videos import (
    enrich_videos,
    fetch_channel_video_catalog,
    fetch_channel_videos_page,
    search_youtube_videos,
)

router = APIRouter(prefix="/api/videos", tags=["videos"])
DOWNLOAD_PACKAGES: dict[str, Path] = {}


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


@router.post("/topic-search", response_model=TopicVideoSearchResponse)
def search_topic_video_candidates(
    request: TopicVideoSearchRequest,
) -> TopicVideoSearchResponse:
    videos = search_youtube_videos(request.query, limit=request.limit)

    if request.enrich:
        videos = enrich_videos(videos)

    ranked = keyword_rank_videos(
        query=request.query,
        videos=videos,
        limit=request.limit,
        auto_select_threshold=request.auto_select_threshold,
    )

    return TopicVideoSearchResponse(
        query=request.query,
        total_count=len(videos),
        candidate_count=len(videos),
        videos=ranked,
    )


@router.post("/knowledge-base", response_model=KnowledgeBaseCreateResponse)
def create_video_knowledge_base(
    request: KnowledgeBaseCreateRequest,
) -> KnowledgeBaseCreateResponse:
    return create_knowledge_base(request)


@router.post("/knowledge-base/stream")
def stream_video_knowledge_base(
    request: KnowledgeBaseCreateRequest,
    mode: str = "local",
) -> StreamingResponse:
    temp_dir: tempfile.TemporaryDirectory[str] | None = None

    if mode == "download":
        temp_dir = tempfile.TemporaryDirectory(prefix="ytkb-")
        request = request.model_copy(update={"output_dir": temp_dir.name})
    elif mode != "local":
        raise HTTPException(status_code=400, detail="Mode must be local or download.")

    def event_stream():
        for event in create_knowledge_base_events(request):
            if event.get("type") == "done" and mode == "download":
                result = event["result"]
                package_id = uuid.uuid4().hex
                zip_base = Path(tempfile.gettempdir()) / f"ytkb-{package_id}"
                output_path = Path(result.output_path)
                zip_path = Path(
                    shutil.make_archive(
                        str(zip_base),
                        "zip",
                        root_dir=output_path.parent,
                        base_dir=output_path.name,
                    )
                )
                DOWNLOAD_PACKAGES[package_id] = zip_path
                result = result.model_copy(
                    update={
                        "download_url": f"/api/videos/knowledge-base/download/{package_id}",
                        "download_filename": zip_path.name,
                    }
                )
                event = {
                    **event,
                    "result": result,
                }

            yield json.dumps(event, default=lambda value: value.model_dump()) + "\n"

        if temp_dir is not None:
            temp_dir.cleanup()

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.get("/knowledge-base/download/{package_id}")
def download_knowledge_base_package(package_id: str) -> FileResponse:
    zip_path = DOWNLOAD_PACKAGES.get(package_id)

    if not zip_path or not zip_path.exists():
        raise HTTPException(status_code=404, detail="Download package not found.")

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=zip_path.name,
    )


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
