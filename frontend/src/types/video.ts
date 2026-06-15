export type VideoMetadata = {
  video_id: string;
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  duration_text: string | null;
  upload_date: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  channel_id: string | null;
  channel_name: string | null;
  channel_url: string | null;
  tags: string[];
  availability: string | null;
};

export type VideoPageResponse = {
  channel_url: string;
  page: number;
  page_size: number;
  count: number;
  total_count: number | null;
  has_more: boolean;
  videos: VideoMetadata[];
};

export type RankedVideo = VideoMetadata & {
  topic_score: number;
  selected: boolean;
  rank_reason: string;
};

export type VideoSearchResponse = {
  channel_url: string;
  query: string;
  total_count: number | null;
  candidate_count: number;
  videos: RankedVideo[];
};

export type TopicVideoSearchResponse = {
  query: string;
  total_count: number | null;
  candidate_count: number;
  videos: RankedVideo[];
};

export type KnowledgeBaseFileResult = {
  video_id: string;
  title: string;
  file_path: string;
  transcript_status: string;
  comments_count: number;
};

export type KnowledgeBaseCreateResponse = {
  output_path: string;
  count: number;
  files: KnowledgeBaseFileResult[];
  warnings: string[];
};

export type FolderPickResponse = {
  path: string | null;
  cancelled: boolean;
};
