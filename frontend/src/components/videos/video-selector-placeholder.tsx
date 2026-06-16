"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  Search,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  downloadKnowledgeBasePackage,
  fetchVideoPage,
  pickKnowledgeBaseFolder,
  resolveChannelCandidates,
  searchVideos,
  searchTopicVideos,
  streamKnowledgeBaseCreation,
} from "@/lib/api";
import { readSelectedChannel, saveSelectedChannel } from "@/lib/selection-store";
import type { ChannelCandidate } from "@/types/channel";
import type {
  KnowledgeBaseProgressEvent,
  RankedVideo,
  VideoMetadata,
} from "@/types/video";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 100;
const TOPIC_PAGE_SIZE = 50;
const DEFAULT_TOPIC_LIMIT = 50;
const MAX_TOPIC_LIMIT = 100;
const KNOWLEDGE_BASE_STAGES = [
  "Fetching video title and metadata",
  "Reading description and channel context",
  "Extracting transcript content",
  "Picking top comments",
  "Creating context files",
];

type KnowledgeBaseMode = "local" | "download";

function formatNumber(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("en-US");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isRankedVideo(video: VideoMetadata | RankedVideo): video is RankedVideo {
  return "topic_score" in video;
}

function scoreTone(score: number): string {
  if (score >= 80) {
    return "bg-emerald-500/15 text-emerald-600";
  }

  return "bg-amber-500/15 text-amber-600";
}

function titleFromTopic(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function ProgressRail({
  label,
  detail,
  active,
}: {
  label: string;
  detail: string;
  active: boolean;
}) {
  if (!active) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-full border border-[var(--yt-border)] bg-[var(--yt-card)] shadow-xl shadow-black/10">
      <div className="flex items-center justify-between gap-4 px-4 py-2 text-xs text-[var(--yt-muted)]">
        <span className="font-semibold text-[var(--yt-foreground)]">{label}</span>
        <span className="truncate">{detail}</span>
      </div>
      <div className="h-1.5 bg-[var(--yt-card-strong)]">
        <div className="h-full w-2/5 animate-[progress-slide_1.25s_ease-in-out_infinite] rounded-full bg-red-600 shadow-[0_0_24px_rgba(220,38,38,0.55)]" />
      </div>
    </div>
  );
}

export function VideoSelectorPlaceholder() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const channelUrl = searchParams.get("channelUrl") ?? "";
  const topic = searchParams.get("topic") ?? "";
  const topicLimitFromUrl = Number.parseInt(
    searchParams.get("limit") ?? DEFAULT_TOPIC_LIMIT.toString(),
    10
  );
  const topicLimit =
    Number.isFinite(topicLimitFromUrl) && topicLimitFromUrl > 0
      ? Math.min(MAX_TOPIC_LIMIT, topicLimitFromUrl)
      : DEFAULT_TOPIC_LIMIT;
  const sourceSearch = searchParams.get("search") ?? "";
  const pageFromUrl = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const [channel, setChannel] = useState<ChannelCandidate | null>(null);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [rankedVideos, setRankedVideos] = useState<RankedVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [selectedVideosById, setSelectedVideosById] = useState<Map<string, VideoMetadata>>(
    new Map()
  );
  const [query, setQuery] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [knowledgeBaseMode, setKnowledgeBaseMode] =
    useState<KnowledgeBaseMode>("local");
  const [filePerVideo, setFilePerVideo] = useState(false);
  const [isKnowledgeDialogOpen, setIsKnowledgeDialogOpen] = useState(false);
  const [isCreatingKnowledgeBase, setIsCreatingKnowledgeBase] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [knowledgeBaseResult, setKnowledgeBaseResult] = useState("");
  const [knowledgeBaseError, setKnowledgeBaseError] = useState("");
  const [knowledgeBaseTotal, setKnowledgeBaseTotal] = useState(0);
  const [knowledgeBaseCompleted, setKnowledgeBaseCompleted] = useState(0);
  const [knowledgeBaseCurrentVideo, setKnowledgeBaseCurrentVideo] =
    useState<VideoMetadata | null>(null);
  const [knowledgeBaseSkipped, setKnowledgeBaseSkipped] = useState<string[]>([]);
  const [knowledgeBaseStageIndex, setKnowledgeBaseStageIndex] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const page = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExpandSearchVisible, setIsExpandSearchVisible] = useState(false);
  const [expandedTopicLimit, setExpandedTopicLimit] = useState(
    Math.min(MAX_TOPIC_LIMIT, DEFAULT_TOPIC_LIMIT + 25).toString()
  );
  const restoredChannelSearchRef = useRef("");
  const isTopicMode = topic.trim().length > 0;
  const topicTitle = titleFromTopic(topic);
  const topicUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    topic
  )}`;
  const isBusy =
    isLoading || isSearchingVideos || isCreatingKnowledgeBase || isPickingFolder;
  const progressLabel = isCreatingKnowledgeBase
    ? "Building knowledge base"
    : isPickingFolder
    ? "Opening folder picker"
    : isSearchingVideos
    ? "Ranking videos"
    : isLoading
    ? isTopicMode
      ? "Loading topic videos"
      : "Loading channel catalog"
    : "";
  const progressDetail = isCreatingKnowledgeBase
    ? "Fetching transcripts, comments, and writing Markdown files"
    : isPickingFolder
    ? "Waiting for a local folder selection"
    : isSearchingVideos
    ? "Scanning titles, descriptions, tags, and popularity signals"
    : isLoading
    ? "Fetching results from YouTube through the local backend"
    : "";

  useEffect(() => {
    let isCurrent = true;

    async function loadChannel() {
      if (isTopicMode) {
        setChannel(null);
        return;
      }

      if (channelUrl) {
        const stored = readSelectedChannel();

        if (stored?.url === channelUrl) {
          setChannel(stored);
          return;
        }

        try {
          const result = await resolveChannelCandidates(channelUrl, 1);
          const resolved = result.selectedChannel ?? result.candidates[0] ?? null;

          if (!isCurrent) {
            return;
          }

          setChannel(resolved);

          if (resolved) {
            saveSelectedChannel(resolved);
          }
        } catch {
          if (isCurrent) {
            setChannel(null);
          }
        }

        return;
      }

      const stored = readSelectedChannel();

      if (stored) {
        const params = new URLSearchParams({ channelUrl: stored.url });
        router.replace(`/videos?${params.toString()}`);
        return;
      }

      router.replace("/home");
    }

    void loadChannel();

    return () => {
      isCurrent = false;
    };
  }, [channelUrl, isTopicMode, router]);

  useEffect(() => {
    if (!isCreatingKnowledgeBase) {
      return;
    }

    const timer = window.setInterval(() => {
      setKnowledgeBaseStageIndex((value) => (value + 1) % KNOWLEDGE_BASE_STAGES.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isCreatingKnowledgeBase]);

  useEffect(() => {
    if (isTopicMode) {
      return;
    }

    if (!channel) {
      return;
    }

    let isCurrent = true;
    const selectedChannel = channel;

    async function loadVideos() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchVideoPage({
          channelUrl: selectedChannel.url,
          page,
          pageSize: PAGE_SIZE,
          enrich: false,
          includeTotal: false,
        });

        if (!isCurrent) {
          return;
        }

        setVideos(response.videos);
        setRankedVideos([]);
        setHasMore(response.has_more);
        setTotalCount(response.total_count);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setVideos([]);
        setHasMore(false);
        setTotalCount(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load videos for this channel."
        );
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadVideos();

    return () => {
      isCurrent = false;
    };
  }, [channel, isTopicMode, page]);

  useEffect(() => {
    if (!isTopicMode) {
      return;
    }

    let isCurrent = true;
    const activeTopic = topic.trim();

    async function loadTopicVideos() {
      if (!activeTopic) {
        router.replace("/home");
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setSearchPage(1);
      setQuery(activeTopic);

      try {
        const response = await searchTopicVideos({
          query: activeTopic,
          limit: topicLimit,
        });

        if (!isCurrent) {
          return;
        }

        setVideos([]);
        setRankedVideos(response.videos);
        setHasMore(false);
        setTotalCount(response.total_count);
        setSelectedVideoIds(() => {
          const next = new Set<string>();
          response.videos.forEach((video) => {
            if (video.selected) {
              next.add(video.video_id);
            }
          });
          return next;
        });
        setSelectedVideosById(() => {
          const next = new Map<string, VideoMetadata>();
          response.videos.forEach((video) => {
            if (video.selected) {
              next.set(video.video_id, video);
            }
          });
          return next;
        });
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setRankedVideos([]);
        setTotalCount(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Could not search videos."
        );
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadTopicVideos();

    return () => {
      isCurrent = false;
    };
  }, [isTopicMode, router, topic, topicLimit]);

  useEffect(() => {
    if (isTopicMode || !channel || rankedVideos.length > 0 || !hasMore || isLoading) {
      return;
    }

    void fetchVideoPage({
      channelUrl: channel.url,
      page: page + 1,
      pageSize: PAGE_SIZE,
      enrich: false,
      includeTotal: false,
    }).catch(() => undefined);
  }, [channel, hasMore, isLoading, isTopicMode, page, rankedVideos.length]);

  function updatePage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", nextPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleTableScroll() {
    const element = tableScrollRef.current;

    if (
      !element ||
      !isTopicMode ||
      isBusy ||
      topicLimit >= MAX_TOPIC_LIMIT ||
      rankedVideos.length === 0
    ) {
      return;
    }

    const bottomGap = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (bottomGap < 36) {
      if (!isExpandSearchVisible) {
        setExpandedTopicLimit(Math.min(MAX_TOPIC_LIMIT, topicLimit + 25).toString());
      }

      setIsExpandSearchVisible(true);
    } else if (bottomGap > 160) {
      setIsExpandSearchVisible(false);
    }
  }

  function handleExpandTopicSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextLimit = Math.min(
      MAX_TOPIC_LIMIT,
      Math.max(topicLimit + 1, Number.parseInt(expandedTopicLimit, 10) || topicLimit)
    );

    if (nextLimit <= topicLimit) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("topic", topic.trim());
    params.set("limit", nextLimit.toString());
    setIsExpandSearchVisible(false);
    router.push(`/topics?${params.toString()}`);
  }

  const isSearchMode = rankedVideos.length > 0;
  const activeSearchPageSize = isTopicMode ? TOPIC_PAGE_SIZE : PAGE_SIZE;
  const searchFirstIndex = (searchPage - 1) * activeSearchPageSize;
  const displayedVideos = isSearchMode
    ? rankedVideos.slice(searchFirstIndex, searchFirstIndex + activeSearchPageSize)
    : videos;
  const visibleCount = isSearchMode ? rankedVideos.length : videos.length;
  const activePage = isSearchMode ? searchPage : page;
  const activeHasPrevious = activePage > 1;
  const activeHasNext = isSearchMode
    ? searchFirstIndex + activeSearchPageSize < rankedVideos.length
    : hasMore;

  const firstResult = displayedVideos.length > 0
    ? isSearchMode
      ? searchFirstIndex + 1
      : (page - 1) * PAGE_SIZE + 1
    : 0;
  const lastResult = displayedVideos.length > 0
    ? firstResult + displayedVideos.length - 1
    : 0;
  const resultRangeText =
    displayedVideos.length === 0
      ? totalCount === null
        ? "Results 0"
        : `Results 0 of ${totalCount.toLocaleString("en-US")}`
      : isSearchMode
      ? `Results ${firstResult}-${lastResult} of ${visibleCount.toLocaleString("en-US")}`
      : totalCount === null
      ? `Results ${firstResult}-${lastResult}`
      : `Results ${firstResult}-${lastResult} of ${totalCount.toLocaleString("en-US")}`;
  const channelVideoCountText =
    totalCount === null ? channel?.videoCountText : totalCount.toLocaleString("en-US");
  const visibleVideoIds = Array.from(
    new Set(displayedVideos.map((video) => video.video_id))
  );
  const selectedVisibleCount = visibleVideoIds.filter((videoId) =>
    selectedVideoIds.has(videoId)
  ).length;
  const areAllVisibleSelected =
    visibleVideoIds.length > 0 && selectedVisibleCount === visibleVideoIds.length;
  const areSomeVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleVideoIds.length;
  const bulkSelectLabel = isSearchMode ? "Select All Results" : "Select Current Page";
  const selectedScopeText = isSearchMode
    ? `${selectedVideoIds.size} / ${visibleCount} selected`
    : `${selectedVideoIds.size} selected across pages`;
  const knowledgeBaseProgressTotal =
    knowledgeBaseTotal || selectedVideosById.size || selectedVideoIds.size;
  const knowledgeBaseProgressPercent =
    knowledgeBaseProgressTotal > 0
      ? Math.round((knowledgeBaseCompleted / knowledgeBaseProgressTotal) * 100)
      : 0;
  const progressHue = Math.round((knowledgeBaseProgressPercent / 100) * 130);
  const knowledgeBaseStage = KNOWLEDGE_BASE_STAGES[knowledgeBaseStageIndex];
  const knowledgeBaseProgressStyle = {
    width: `${Math.min(100, Math.max(0, knowledgeBaseProgressPercent))}%`,
    background: `linear-gradient(90deg, hsl(${progressHue} 78% 48%), hsl(${Math.min(
      135,
      progressHue + 18
    )} 76% 52%))`,
  };

  function findSelectedVideo(videoId: string): VideoMetadata | null {
    return selectedVideosById.get(videoId) ?? null;
  }

  function toggleVideo(video: VideoMetadata) {
    setSelectedVideoIds((current) => {
      const next = new Set(current);

      if (next.has(video.video_id)) {
        next.delete(video.video_id);
      } else {
        next.add(video.video_id);
      }

      return next;
    });
    setSelectedVideosById((current) => {
      const next = new Map(current);

      if (next.has(video.video_id)) {
        next.delete(video.video_id);
      } else {
        next.set(video.video_id, video);
      }

      return next;
    });
  }

  function toggleVisibleVideos() {
    setSelectedVideoIds((current) => {
      const next = new Set(current);

      if (areAllVisibleSelected) {
        visibleVideoIds.forEach((videoId) => next.delete(videoId));
      } else {
        visibleVideoIds.forEach((videoId) => next.add(videoId));
      }

      return next;
    });
    setSelectedVideosById((current) => {
      const next = new Map(current);

      if (areAllVisibleSelected) {
        visibleVideoIds.forEach((videoId) => next.delete(videoId));
      } else {
        displayedVideos.forEach((video) => next.set(video.video_id, video));
      }

      return next;
    });
  }

  function selectAllVideos() {
    const allVideos = isSearchMode ? rankedVideos : videos;
    setSelectedVideoIds((current) => {
      const next = new Set(current);
      allVideos.forEach((video) => next.add(video.video_id));
      return next;
    });
    setSelectedVideosById((current) => {
      const next = new Map(current);
      allVideos.forEach((video) => next.set(video.video_id, video));
      return next;
    });
  }

  function unselectAllVideos() {
    setSelectedVideoIds(new Set());
    setSelectedVideosById(new Map());
  }

  function updateVisiblePage(nextPage: number) {
    if (isSearchMode) {
      setSearchPage(nextPage);
      return;
    }

    updatePage(nextPage);
  }

  async function runVideoSearch(
    queryOverride?: string,
    options: { replaceUrl?: boolean } = {}
  ): Promise<boolean> {
    const activeQuery = (queryOverride ?? query).trim();
    const replaceUrl = options.replaceUrl ?? true;

    if (!activeQuery || (!channel && !isTopicMode)) {
      return false;
    }

    setQuery(activeQuery);
    setIsSearchingVideos(true);
    setErrorMessage("");
    setSearchPage(1);

    if (replaceUrl) {
      const params = new URLSearchParams(searchParams.toString());

      if (isTopicMode) {
        params.set("topic", activeQuery);
        params.set("limit", topicLimit.toString());
        router.push(`/topics?${params.toString()}`);
        setIsSearchingVideos(false);
        return true;
      }

      params.set("search", activeQuery);
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }

    try {
      const response = isTopicMode
        ? await searchTopicVideos({
            query: activeQuery,
            limit: topicLimit,
          })
        : await searchVideos({
            channelUrl: channel!.url,
            query: activeQuery,
          });

      setRankedVideos(response.videos);
      setHasMore(false);
      setTotalCount(response.total_count);
      setSelectedVideoIds(() => {
        const next = new Set<string>();
        response.videos.forEach((video) => {
          if (video.selected) {
            next.add(video.video_id);
          }
        });
        return next;
      });
      setSelectedVideosById(() => {
        const next = new Map<string, VideoMetadata>();
        response.videos.forEach((video) => {
          if (video.selected) {
            next.set(video.video_id, video);
          }
        });
        return next;
      });

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not search videos.";
      setErrorMessage(message);
      return false;
    } finally {
      setIsSearchingVideos(false);
    }
  }

  useEffect(() => {
    if (isTopicMode) {
      restoredChannelSearchRef.current = "";
      return;
    }

    const activeSearch = sourceSearch.trim();

    if (!channel || !activeSearch || restoredChannelSearchRef.current === activeSearch) {
      return;
    }

    setQuery(activeSearch);
    restoredChannelSearchRef.current = activeSearch;
    void runVideoSearch(activeSearch, { replaceUrl: false });
    // runVideoSearch intentionally stays outside deps; restoredChannelSearchRef prevents repeats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, isTopicMode, sourceSearch]);


  function clearVideoSearch() {
    setQuery("");
    setRankedVideos([]);
    setSearchPage(1);
  }

  async function handleCreateKnowledgeBase() {
    if (
      (!channel && !isTopicMode) ||
      selectedVideoIds.size === 0 ||
      (knowledgeBaseMode === "local" && !outputDir.trim())
    ) {
      return;
    }

    const selectedVideos = Array.from(selectedVideoIds)
      .map((videoId) => selectedVideosById.get(videoId))
      .filter((video): video is VideoMetadata => Boolean(video));

    if (selectedVideos.length === 0) {
      setKnowledgeBaseError("Select at least one video to create a knowledge base.");
      return;
    }

    setIsCreatingKnowledgeBase(true);
    setKnowledgeBaseError("");
    setKnowledgeBaseResult("");
    setKnowledgeBaseTotal(selectedVideos.length);
    setKnowledgeBaseCompleted(0);
    setKnowledgeBaseSkipped([]);
    setKnowledgeBaseStageIndex(0);
    setKnowledgeBaseCurrentVideo(selectedVideos[0] ?? null);

    try {
      const response = await streamKnowledgeBaseCreation({
        channelName: isTopicMode ? topicTitle : channel!.name,
        channelUrl: isTopicMode ? topicUrl : channel!.url,
        outputDir: knowledgeBaseMode === "local" ? outputDir.trim() : "",
        mode: knowledgeBaseMode,
        videos: selectedVideos,
        includeComments: true,
        filePerVideo,
        onEvent: (event: KnowledgeBaseProgressEvent) => {
          if (event.type === "start") {
            setKnowledgeBaseTotal(event.total);
            setKnowledgeBaseCompleted(event.completed);
            return;
          }

          if (event.type === "video_started") {
            setKnowledgeBaseCurrentVideo(findSelectedVideo(event.video.video_id));
            setKnowledgeBaseCompleted(event.completed);
            return;
          }

          if (event.type === "video_done") {
            setKnowledgeBaseCompleted(event.completed);
            return;
          }

          if (event.type === "video_error") {
            setKnowledgeBaseSkipped((current) => [...current, event.message]);
            setKnowledgeBaseCompleted(event.index);
            return;
          }

          if (event.type === "done") {
            setKnowledgeBaseCompleted(event.completed);
          }
        },
      });

      setKnowledgeBaseResult(
        knowledgeBaseMode === "download"
          ? `Created ${response.count} ${response.count === 1 ? "file" : "files"}. Download ready.`
          : `Created ${response.count} ${response.count === 1 ? "file" : "files"} in ${response.output_path}`
      );

      if (knowledgeBaseMode === "download") {
        downloadKnowledgeBasePackage(response);
      }
    } catch (error) {
      setKnowledgeBaseError(
        error instanceof Error
          ? error.message
          : "Could not create the knowledge base."
      );
    } finally {
      setIsCreatingKnowledgeBase(false);
    }
  }

  async function handlePickOutputFolder() {
    setIsPickingFolder(true);
    setKnowledgeBaseError("");
    setKnowledgeBaseResult("");

    try {
      const result = await pickKnowledgeBaseFolder();
      if (result.path) {
        setOutputDir(result.path);
      }
    } catch (error) {
      setKnowledgeBaseError(
        error instanceof Error
          ? error.message
          : "Could not open folder picker."
      );
    } finally {
      setIsPickingFolder(false);
    }
  }

  if (!channel && !isTopicMode) {
    return (
      <main className="flex h-screen items-center justify-center overflow-hidden bg-[var(--yt-page)] text-[var(--yt-foreground)]">
        <div className="flex items-center gap-3 text-sm text-[var(--yt-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading selected channel...
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[var(--yt-page)] px-5 py-5 text-[var(--yt-foreground)] transition-colors duration-300 sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[540px] w-[860px] -translate-x-1/2 rounded-full bg-[var(--yt-glow-one)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-280px] right-[-180px] h-[540px] w-[540px] rounded-full bg-[var(--yt-glow-two)] blur-3xl" />

      <section className="relative mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden">
        <div className="mb-3 grid shrink-0 gap-3 xl:grid-cols-[minmax(320px,420px)_1fr] xl:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              disabled={isBusy}
              onClick={() => {
                if (isTopicMode) {
                  router.push("/home");
                } else if (sourceSearch) {
                  router.push(`/channels?search=${encodeURIComponent(sourceSearch)}`);
                } else {
                  router.push("/home");
                }
              }}
              className="h-10 shrink-0 rounded-full px-3 text-[var(--yt-muted)] hover:bg-red-600/10 hover:text-red-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-[var(--yt-card)] px-3 py-2 backdrop-blur-xl">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-600 text-xs font-black text-white">
                {!isTopicMode && channel?.thumbnailUrl ? (
                  <img
                    src={channel.thumbnailUrl}
                    alt={`${channel.name} thumbnail`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  isTopicMode ? "YT" : channel?.avatarUrl
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {isTopicMode ? topicTitle : channel?.name}
                </p>
                <p className="truncate text-xs text-[var(--yt-muted)]">
                  {isTopicMode
                    ? `Topic search · Videos: ${topicLimit}`
                    : `Subscribers: ${channel?.subscriberCount} · Videos: ${channelVideoCountText}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              <span className="rounded-full bg-[var(--yt-card)] px-3 py-2 text-xs font-medium text-[var(--yt-foreground)]">
                {selectedVideoIds.size === 0
                  ? "No videos selected"
                  : selectedVideoIds.size === 1
                  ? "1 video selected"
                  : `${selectedVideoIds.size} videos selected`}
              </span>
              <Button
                type="button"
                disabled={selectedVideoIds.size === 0 || isBusy}
                onClick={() => {
                  setKnowledgeBaseError("");
                  setKnowledgeBaseResult("");
                  setIsKnowledgeDialogOpen(true);
                }}
                className="h-10 rounded-full px-4"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Create Knowledge Base
              </Button>
          </div>
        </div>

        <div className="mb-3 grid shrink-0 gap-3 xl:grid-cols-[minmax(420px,1fr)_auto] xl:items-center">
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--yt-subtle)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void runVideoSearch();
                  }
                }}
                placeholder={
                  isTopicMode
                    ? "Search within topic results"
                    : "Search videos by title, description, date, or views"
                }
                className="h-11 rounded-full border-[var(--yt-border)] bg-[var(--yt-input)] pl-11 text-[var(--yt-foreground)]"
              />
            </div>

            <Button
              type="button"
              disabled={!query.trim() || isBusy}
              onClick={() => void runVideoSearch()}
              className="h-11 rounded-full px-6"
            >
              {isSearchingVideos ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search Videos
            </Button>

            {isSearchMode && !isTopicMode ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isBusy}
                onClick={clearVideoSearch}
                className="h-11 rounded-full px-5"
              >
                Clear
              </Button>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[var(--yt-muted)] xl:justify-end">
            <span className="rounded-full bg-[var(--yt-card)] px-3 py-2 text-xs">
              {resultRangeText}
            </span>
            <Button
              variant="ghost"
              disabled={!activeHasPrevious || isBusy}
              onClick={() => updateVisiblePage(Math.max(1, activePage - 1))}
              className="h-10 rounded-full px-3"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="min-w-16 text-center text-xs font-medium">
              Page {activePage}
            </span>
            <Button
              variant="ghost"
              disabled={!activeHasNext || isBusy}
              onClick={() => updateVisiblePage(activePage + 1)}
              className="h-10 rounded-full px-3"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-3 shrink-0">
          <ProgressRail
            label={progressLabel}
            detail={progressDetail}
            active={isBusy}
          />
        </div>

        <Dialog
          open={isKnowledgeDialogOpen}
          onOpenChange={(open) => {
            if (isCreatingKnowledgeBase && !open) {
              return;
            }

            setIsKnowledgeDialogOpen(open);
          }}
        >
          <DialogContent
            showCloseButton={!isCreatingKnowledgeBase}
            className={`bg-[var(--yt-page)] text-[var(--yt-foreground)] transition-all duration-300 ${
              isCreatingKnowledgeBase || knowledgeBaseResult || knowledgeBaseSkipped.length > 0
                ? "sm:max-w-2xl"
                : "sm:max-w-lg"
            }`}
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                Create Knowledge Base
              </DialogTitle>
              <DialogDescription className="sr-only">
                Create local Markdown context files from selected videos.
              </DialogDescription>
            </DialogHeader>

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateKnowledgeBase();
              }}
            >
              <div className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-full border border-[var(--yt-border)] bg-[var(--yt-card)] p-1 text-sm font-semibold">
                {(["local", "download"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={isCreatingKnowledgeBase}
                    onClick={() => {
                      setKnowledgeBaseMode(mode);
                      setKnowledgeBaseError("");
                      setKnowledgeBaseResult("");
                    }}
                    className={`rounded-full px-4 py-2 capitalize transition ${
                      knowledgeBaseMode === mode
                        ? "bg-[var(--yt-button)] text-[var(--yt-button-text)] shadow-lg"
                        : "text-[var(--yt-muted)] hover:text-[var(--yt-foreground)]"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {selectedVideoIds.size > 1 ? (
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[var(--yt-border)] bg-[var(--yt-card)] px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--yt-foreground)]">
                      File per video
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--yt-muted)]">
                      Off creates one combined context file.
                    </span>
                  </span>
                  <Checkbox
                    checked={filePerVideo}
                    disabled={isCreatingKnowledgeBase}
                    onCheckedChange={(checked) => setFilePerVideo(checked === true)}
                    aria-label="Create one file per video"
                  />
                </label>
              ) : null}

              {knowledgeBaseMode === "local" ? (
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={outputDir}
                    disabled={isCreatingKnowledgeBase || isPickingFolder}
                    onChange={(event) => setOutputDir(event.target.value)}
                    placeholder="No folder selected"
                    className="h-11 rounded-full border-[var(--yt-border)] bg-[var(--yt-input)] px-5 text-[var(--yt-foreground)]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCreatingKnowledgeBase || isPickingFolder}
                    onClick={() => void handlePickOutputFolder()}
                    className="h-11 rounded-full border-[var(--yt-border)] bg-[var(--yt-card)] px-5 text-[var(--yt-foreground)] hover:bg-[var(--yt-card-strong)]"
                  >
                    {isPickingFolder ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOpen className="mr-2 h-4 w-4" />
                    )}
                    Browse
                  </Button>
                </div>
              ) : null}

              {isCreatingKnowledgeBase || knowledgeBaseResult ? (
                <div className="grid gap-5 rounded-2xl border border-[var(--yt-border)] bg-[var(--yt-card)] p-5">
                  <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)_96px] sm:items-center">
                    <div className="h-24 w-full overflow-hidden rounded-xl bg-red-600/10 sm:w-40">
                      {knowledgeBaseCurrentVideo?.thumbnail_url ? (
                        <img
                          src={knowledgeBaseCurrentVideo.thumbnail_url}
                          alt={`${knowledgeBaseCurrentVideo.title} thumbnail`}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--yt-muted)]">
                          Context
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--yt-subtle)]">
                        {knowledgeBaseResult ? "Complete" : knowledgeBaseStage}
                      </p>
                      <p className="mt-2 line-clamp-3 text-base font-semibold leading-6">
                        {knowledgeBaseCurrentVideo?.title ?? "Finalizing index"}
                      </p>
                      <p className="mt-2 text-xs text-[var(--yt-muted)]">
                        {knowledgeBaseMode === "download"
                          ? "Preparing zip package"
                          : "Writing local context files"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[var(--yt-card-strong)] px-4 py-3 text-center">
                      <p className="text-2xl font-black tabular-nums">
                        {knowledgeBaseProgressPercent}%
                      </p>
                      <p className="mt-1 text-xs text-[var(--yt-muted)]">
                        {knowledgeBaseCompleted}/{knowledgeBaseProgressTotal}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="h-4 overflow-hidden rounded-full bg-[var(--yt-card-strong)]">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={knowledgeBaseProgressStyle}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-[var(--yt-muted)]">
                      <span>{knowledgeBaseResult ? "Ready" : "Processing"}</span>
                      <span className="truncate text-right">
                        {knowledgeBaseResult ? knowledgeBaseResult : "Creating context files"}
                      </span>
                    </div>
                  </div>

                  {knowledgeBaseSkipped.length > 0 ? (
                    <div className="max-h-24 overflow-auto rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700">
                      {knowledgeBaseSkipped.map((message) => (
                        <p key={message}>{message}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : isPickingFolder ? (
                <div className="rounded-xl border border-[var(--yt-border)] bg-[var(--yt-card)] p-4 text-sm text-[var(--yt-muted)]">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for folder selection...
                  </span>
                </div>
              ) : knowledgeBaseError ? (
                <div className="rounded-xl border border-red-500/25 bg-red-600/10 p-4 text-sm text-red-500">
                  {knowledgeBaseError}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={
                    selectedVideoIds.size === 0 ||
                    (knowledgeBaseMode === "local" && !outputDir.trim()) ||
                    isCreatingKnowledgeBase ||
                    isPickingFolder ||
                    Boolean(knowledgeBaseResult)
                  }
                  className="rounded-full px-6"
                >
                  {isCreatingKnowledgeBase ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : knowledgeBaseMode === "download" ? (
                    <Download className="mr-2 h-4 w-4" />
                  ) : (
                    <FolderOpen className="mr-2 h-4 w-4" />
                  )}
                  {isCreatingKnowledgeBase ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--yt-border)] bg-[var(--yt-card)] backdrop-blur-xl">
          <div className="shrink-0 border-b border-[var(--yt-border)] bg-[var(--yt-card-strong)]">
            <div className="grid grid-cols-[48px_minmax(360px,1.6fr)_112px_130px_130px_100px_72px] items-center px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--yt-subtle)] border-b border-[var(--yt-border)]">
              <Checkbox
                checked={
                  areAllVisibleSelected
                    ? true
                    : areSomeVisibleSelected
                    ? "indeterminate"
                    : false
                }
                disabled={displayedVideos.length === 0}
                onCheckedChange={toggleVisibleVideos}
                aria-label="Select all visible videos"
              />
              <span>Video</span>
              <span>Confidence</span>
              <span>Upload date</span>
              <span>Views</span>
              <span>Duration</span>
              <span />
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[var(--yt-border)] text-xs text-[var(--yt-muted)] bg-[var(--yt-card)]/50">
              <span className="font-medium">Bulk actions:</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={visibleCount === 0 || isBusy}
                onClick={selectAllVideos}
                className="h-8 rounded-full px-3 text-xs hover:bg-red-600/10 hover:text-red-500"
              >
                {bulkSelectLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={selectedVideoIds.size === 0 || isBusy}
                onClick={unselectAllVideos}
                className="h-8 rounded-full px-3 text-xs hover:bg-red-600/10 hover:text-red-500"
              >
                Unselect All
              </Button>
              <span className="ml-auto text-[var(--yt-foreground)] font-semibold">
                {selectedScopeText}
              </span>
            </div>
          </div>

          <div
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            className="min-h-0 flex-1 overflow-auto"
          >
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--yt-muted)]">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading videos...
              </div>
            ) : errorMessage ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-500">
                {errorMessage}
              </div>
            ) : displayedVideos.length > 0 ? (
              <div className="min-w-[900px]">
                {displayedVideos.map((video, index) => (
                  <div
                    key={`${video.video_id}-${index}`}
                    data-cursor-light
                    className="grid grid-cols-[48px_minmax(360px,1.6fr)_112px_130px_130px_100px_72px] items-center border-b border-[var(--yt-border)] px-4 py-3 text-sm last:border-b-0 hover:bg-[var(--yt-card-strong)]"
                  >
                    <Checkbox
                      checked={selectedVideoIds.has(video.video_id)}
                      onCheckedChange={() => toggleVideo(video)}
                    />

                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-red-600/10 relative group">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={`${video.title} thumbnail`}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        {video.is_short ? (
                          <div className="absolute inset-0 flex items-end justify-center pb-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5 text-xs font-bold text-white">
                              <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                              Shorts
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="line-clamp-2 font-medium leading-5">
                            {video.title}
                          </p>
                          {video.is_short ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
                              <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                              Shorts
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-[var(--yt-muted)]">
                          {isRankedVideo(video)
                            ? video.rank_reason
                            : video.description || "No description returned."}
                        </p>
                      </div>
                    </div>

                    <span>
                      {isRankedVideo(video) ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${scoreTone(
                            video.topic_score
                          )}`}
                        >
                          {Math.round(video.topic_score)}%
                        </span>
                      ) : (
                        <span className="text-[var(--yt-muted)]">-</span>
                      )}
                    </span>
                    <span className="text-[var(--yt-muted)]">
                      {formatDate(video.upload_date)}
                    </span>
                    <span className="text-[var(--yt-muted)]">
                      {formatNumber(video.view_count)}
                    </span>
                    <span className="text-[var(--yt-muted)]">
                      {video.duration_text ?? "-"}
                    </span>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--yt-muted)] transition hover:bg-red-600/10 hover:text-red-500"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--yt-muted)]">
                No videos match this search.
              </div>
            )}
          </div>
        </div>
      </section>

      {typeof document !== "undefined" &&
      isTopicMode &&
      isExpandSearchVisible &&
      topicLimit < MAX_TOPIC_LIMIT &&
      rankedVideos.length > 0
        ? createPortal(
            <div className="fixed inset-x-4 bottom-7 z-50 flex justify-center pointer-events-none">
              <form
                onSubmit={handleExpandTopicSearch}
                className="pointer-events-auto flex w-full max-w-xl animate-in fade-in slide-in-from-bottom-2 flex-col gap-3 rounded-2xl border border-[var(--yt-border)] bg-[var(--yt-page)]/92 p-4 text-[var(--yt-foreground)] shadow-2xl shadow-black/20 backdrop-blur-2xl duration-200 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Search for more</p>
                  <p className="mt-1 text-xs text-[var(--yt-muted)]">
                    Current {topicLimit}. New max:
                  </p>
                </div>

                <Input
                  type="number"
                  min={topicLimit + 1}
                  max={MAX_TOPIC_LIMIT}
                  value={expandedTopicLimit}
                  onChange={(event) => setExpandedTopicLimit(event.target.value)}
                  className="h-10 w-full rounded-full border-[var(--yt-border)] bg-[var(--yt-input)] text-center text-[var(--yt-foreground)] sm:w-24"
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsExpandSearchVisible(false)}
                    className="h-10 rounded-full px-4"
                  >
                    Later
                  </Button>
                  <Button type="submit" className="h-10 rounded-full px-5">
                    Search broader
                  </Button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
    </main>
  );
}
