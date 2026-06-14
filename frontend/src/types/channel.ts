export type ChannelMatchSource = "url" | "name" | "youtube_url" | "channel_name";

export type BackendChannelCandidate = {
  channel_id: string | null;
  name: string;
  handle: string | null;
  url: string;
  description: string | null;
  thumbnail_url: string | null;
  subscriber_count_text: string | null;
  subscriber_count: number | null;
  video_count_text: string | null;
  video_count: number | null;
  verified: boolean;
  match_score: number;
  source: string;
};

export type BackendChannelResolveResponse = {
  query: string;
  input_type: "youtube_url" | "channel_name";
  candidates: BackendChannelCandidate[];
  selected_channel: BackendChannelCandidate | null;
  message: string;
};

export type ChannelCandidate = {
  id: string;
  channelId: string | null;
  name: string;
  handle: string;
  url: string;
  avatarUrl: string;
  thumbnailUrl: string | null;
  description: string;
  subscriberCount: string;
  subscriberCountValue: number | null;
  videoCount: number | null;
  videoCountText: string;
  verified: boolean;
  matchScore: number;
  source: string;
  raw: BackendChannelCandidate;
};
