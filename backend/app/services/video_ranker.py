import re
from app.schemas.video import RankedVideo, VideoMetadata


def _tokens(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-zA-Z0-9]+", value.lower())
        if len(token) >= 3
    ]


def _token_reason(label: str, count: int) -> str | None:
    if count <= 0:
        return None
    return f"{count} keyword{'s' if count != 1 else ''} in {label}"


def _score_text(query: str, title: str, description: str, tags: list[str]) -> tuple[float, str]:
    query_clean = query.lower().strip()
    title_clean = title.lower()
    description_clean = description.lower()
    tags_clean = " ".join(tags).lower()

    query_tokens = _tokens(query)
    title_tokens = _tokens(title)
    description_tokens = _tokens(description)
    tag_tokens = _tokens(tags_clean)

    score = 0.0
    reasons: list[str] = []

    if query_clean and query_clean in title_clean:
        score += 45
        reasons.append("exact phrase in title")

    if query_clean and query_clean in description_clean:
        score += 18
        reasons.append("exact phrase in description")

    query_terms = set(query_tokens)
    if not query_terms:
        return 0, "no searchable keywords"

    title_matches = query_terms.intersection(title_tokens)
    desc_matches = query_terms.intersection(description_tokens)
    tag_matches = query_terms.intersection(tag_tokens)
    total_matches = title_matches | desc_matches | tag_matches
    coverage = len(total_matches) / max(len(query_terms), 1)

    score += min(len(title_matches) * 34, 68)
    score += min(len(desc_matches) * 6, 24)
    score += min(len(tag_matches) * 5, 15)
    score += coverage * 20

    if title_matches and len(title_matches) == 1:
        score += 15

    for reason in (
        _token_reason("title", len(title_matches)),
        _token_reason("description", len(desc_matches)),
        _token_reason("tags", len(tag_matches)),
    ):
        if reason:
            reasons.append(reason)

    return min(round(score, 2), 100), ", ".join(reasons) or "weak textual match"


def rank_videos(
    query: str,
    videos: list[VideoMetadata],
    auto_select_threshold: float,
) -> list[RankedVideo]:
    ranked: list[RankedVideo] = []

    for video in videos:
        score, reason = _score_text(
            query=query,
            title=video.title or "",
            description=video.description or "",
            tags=video.tags or [],
        )

        ranked.append(
            RankedVideo(
                **video.model_dump(),
                topic_score=score,
                selected=score >= auto_select_threshold,
                rank_reason=reason,
            )
        )

    return sorted(ranked, key=lambda item: item.topic_score, reverse=True)


def keyword_rank_videos(
    query: str,
    videos: list[VideoMetadata],
    limit: int,
    auto_select_threshold: float,
) -> list[RankedVideo]:
    ranked = rank_videos(
        query=query,
        videos=videos,
        auto_select_threshold=auto_select_threshold,
    )

    relevant = [video for video in ranked if video.topic_score >= 50]

    return sorted(
        relevant,
        key=lambda item: (
            item.topic_score,
            item.view_count or 0,
            item.like_count or 0,
        ),
        reverse=True,
    )[:limit]
