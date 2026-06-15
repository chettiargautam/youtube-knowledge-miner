import type {
  BackendChannelCandidate,
  BackendChannelResolveResponse,
  ChannelCandidate,
} from "@/types/channel";
import type {
  FolderPickResponse,
  KnowledgeBaseCreateResponse,
  TopicVideoSearchResponse,
  VideoSearchResponse,
  VideoPageResponse,
  VideoMetadata,
} from "@/types/video";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function parseHumanCount(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) {
    return null;
  }

  const normalized = value
    .toString()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\u00a0/g, " ")
    .trim();

  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([kmb])?/i);

  if (!match) {
    return null;
  }

  const number = Number.parseFloat(match[1]);
  const suffix = match[2]?.toLowerCase();

  if (!Number.isFinite(number)) {
    return null;
  }

  if (suffix === "k") return Math.round(number * 1_000);
  if (suffix === "m") return Math.round(number * 1_000_000);
  if (suffix === "b") return Math.round(number * 1_000_000_000);

  return Math.round(number);
}

function cleanSubscriberText(value: string | null): string {
  if (!value) {
    return "—";
  }

  return (
    value
      .replace(/\bsubscribers?\b/gi, "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "—"
  );
}

function sortChannels(a: ChannelCandidate, b: ChannelCandidate): number {
  const subscriberDelta =
    (b.subscriberCountValue ?? 0) - (a.subscriberCountValue ?? 0);

  if (subscriberDelta !== 0) {
    return subscriberDelta;
  }

  if (a.verified !== b.verified) {
    return a.verified ? -1 : 1;
  }

  return b.matchScore - a.matchScore;
}

function mapBackendChannel(candidate: BackendChannelCandidate): ChannelCandidate {
  const parsedSubscriberCount =
    candidate.subscriber_count ?? parseHumanCount(candidate.subscriber_count_text);

  return {
    id: candidate.channel_id ?? candidate.url,
    channelId: candidate.channel_id,
    name: candidate.name,
    handle: candidate.handle ?? "",
    url: candidate.url,
    avatarUrl: initialsFromName(candidate.name) || "YT",
    thumbnailUrl: candidate.thumbnail_url,
    description:
      candidate.description ??
      "No channel description was returned by YouTube for this result.",
    subscriberCount:
      parsedSubscriberCount === null
        ? cleanSubscriberText(candidate.subscriber_count_text)
        : parsedSubscriberCount.toLocaleString("en-US"),
    subscriberCountValue: parsedSubscriberCount,
    videoCount: candidate.video_count,
    videoCountText:
      candidate.video_count === null
        ? candidate.video_count_text ?? "—"
        : candidate.video_count.toLocaleString("en-US"),
    verified: candidate.verified,
    matchScore: candidate.match_score,
    source: candidate.source,
    raw: candidate,
  };
}

export async function resolveChannelCandidates(
  query: string,
  maxResults = 24
): Promise<{
  candidates: ChannelCandidate[];
  selectedChannel: ChannelCandidate | null;
  message: string;
  inputType: "youtube_url" | "channel_name";
}> {
  const response = await fetch(`${API_BASE_URL}/api/channels/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
    }),
  });

  let data: BackendChannelResolveResponse | { detail?: unknown };

  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned a non-JSON response.");
  }

  if (!response.ok) {
    const detail = "detail" in data ? data.detail : undefined;

    throw new Error(
      typeof detail === "string"
        ? detail
        : "Could not resolve the channel. Check the input and try again."
    );
  }

  const resolved = data as BackendChannelResolveResponse;
  const candidates = resolved.candidates.map(mapBackendChannel).sort(sortChannels);

  const selectedChannel = resolved.selected_channel
    ? mapBackendChannel(resolved.selected_channel)
    : candidates.length === 1
      ? candidates[0]
      : null;

  return {
    candidates,
    selectedChannel,
    message: resolved.message,
    inputType: resolved.input_type,
  };
}

export async function resolveChannelDetails(
  channel: ChannelCandidate
): Promise<ChannelCandidate> {
  const result = await resolveChannelCandidates(channel.url, 1);
  const resolved = result.selectedChannel ?? result.candidates[0];

  if (!resolved) {
    return channel;
  }

  return {
    ...channel,
    ...resolved,
    id: channel.id,
    channelId: resolved.channelId ?? channel.channelId,
    handle: channel.handle || resolved.handle,
    url: channel.url,
    thumbnailUrl: resolved.thumbnailUrl ?? channel.thumbnailUrl,
    verified: channel.verified || resolved.verified,
    subscriberCount:
      resolved.subscriberCount === "—" ? channel.subscriberCount : resolved.subscriberCount,
    subscriberCountValue:
      resolved.subscriberCountValue ?? channel.subscriberCountValue,
    source: `${channel.source}+details`,
  };
}

export async function fetchVideoPage({
  channelUrl,
  page,
  pageSize = 20,
  enrich = true,
  includeTotal = true,
}: {
  channelUrl: string;
  page: number;
  pageSize?: number;
  enrich?: boolean;
  includeTotal?: boolean;
}): Promise<VideoPageResponse> {
  const response = await fetch(`${API_BASE_URL}/api/videos/page`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel_url: channelUrl,
      page,
      page_size: pageSize,
      enrich,
      include_total: includeTotal,
    }),
  });

  let data: VideoPageResponse | { detail?: unknown };

  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned a non-JSON response.");
  }

  if (!response.ok) {
    const detail = "detail" in data ? data.detail : undefined;

    throw new Error(
      typeof detail === "string"
        ? detail
        : "Could not load videos for this channel."
    );
  }

  return data as VideoPageResponse;
}

export async function searchVideos({
  channelUrl,
  query,
  limit,
}: {
  channelUrl: string;
  query: string;
  limit?: number;
}): Promise<VideoSearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/videos/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel_url: channelUrl,
      query,
      ...(limit ? { limit } : {}),
      enrich: false,
      auto_select_threshold: 80,
    }),
  });

  let data: VideoSearchResponse | { detail?: unknown };

  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned a non-JSON response.");
  }

  if (!response.ok) {
    const detail = "detail" in data ? data.detail : undefined;

    throw new Error(
      typeof detail === "string" ? detail : "Could not search videos."
    );
  }

  return data as VideoSearchResponse;
}

export async function searchTopicVideos({
  query,
  limit = 50,
}: {
  query: string;
  limit?: number;
}): Promise<TopicVideoSearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/videos/topic-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
      enrich: false,
      auto_select_threshold: 80,
    }),
  });

  let data: TopicVideoSearchResponse | { detail?: unknown };

  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned a non-JSON response.");
  }

  if (!response.ok) {
    const detail = "detail" in data ? data.detail : undefined;

    throw new Error(
      typeof detail === "string" ? detail : "Could not search videos."
    );
  }

  return data as TopicVideoSearchResponse;
}

export async function createKnowledgeBase({
  channelName,
  channelUrl,
  outputDir,
  videos,
  includeComments = true,
}: {
  channelName: string;
  channelUrl: string;
  outputDir: string;
  videos: VideoMetadata[];
  includeComments?: boolean;
}): Promise<KnowledgeBaseCreateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/videos/knowledge-base`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel_name: channelName,
      channel_url: channelUrl,
      output_dir: outputDir,
      include_comments: includeComments,
      max_comments: 50,
      videos: videos.map((video) => ({
        video_id: video.video_id,
        url: video.url,
        title: video.title,
      })),
    }),
  });

  let data: KnowledgeBaseCreateResponse | { detail?: unknown };

  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned a non-JSON response.");
  }

  if (!response.ok) {
    const detail = "detail" in data ? data.detail : undefined;

    throw new Error(
      typeof detail === "string"
        ? detail
        : "Could not create the knowledge base."
    );
  }

  return data as KnowledgeBaseCreateResponse;
}

export async function pickKnowledgeBaseFolder(): Promise<FolderPickResponse> {
  const response = await fetch(`${API_BASE_URL}/api/videos/knowledge-base/folder`);

  let data: FolderPickResponse | { detail?: unknown };

  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned a non-JSON response.");
  }

  if (!response.ok) {
    const detail = "detail" in data ? data.detail : undefined;

    throw new Error(
      typeof detail === "string" ? detail : "Could not open folder picker."
    );
  }

  return data as FolderPickResponse;
}
