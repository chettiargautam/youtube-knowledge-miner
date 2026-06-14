from fastapi import APIRouter

from app.schemas.channel import ChannelResolveRequest, ChannelResolveResponse
from app.services.input_classifier import classify_channel_input
from app.services.youtube_channel_search import resolve_channel_url, search_channels_by_name

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.post("/resolve", response_model=ChannelResolveResponse)
def resolve_channel(request: ChannelResolveRequest) -> ChannelResolveResponse:
    query = request.query.strip()
    input_type = classify_channel_input(query)

    if input_type == "youtube_url":
        try:
            candidate = resolve_channel_url(query)
        except Exception:
            candidate = None

        if not candidate:
            return ChannelResolveResponse(
                query=query,
                input_type="youtube_url",
                candidates=[],
                selected_channel=None,
                message="Could not find a YouTube channel from that URL. Please check the URL and try again.",
            )

        return ChannelResolveResponse(
            query=query,
            input_type="youtube_url",
            candidates=[candidate],
            selected_channel=candidate,
            message="Channel resolved from URL.",
        )

    candidates = search_channels_by_name(query, max_results=request.max_results)

    selected = candidates[0] if len(candidates) == 1 and candidates[0].match_score >= 92 else None

    if not candidates:
        message = "No matching channels found. Try the exact channel name, handle, or full channel URL."
    elif selected:
        message = "Found one strong channel match."
    else:
        message = "Found multiple possible channel matches. Select the correct channel."

    return ChannelResolveResponse(
        query=query,
        input_type="channel_name",
        candidates=candidates,
        selected_channel=selected,
        message=message,
    )
