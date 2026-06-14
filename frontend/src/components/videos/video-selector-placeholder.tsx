"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Loader2,
  Search,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  createKnowledgeBase,
  fetchVideoPage,
  pickKnowledgeBaseFolder,
  resolveChannelCandidates,
  searchVideos,
} from "@/lib/api";
import { readSelectedChannel, saveSelectedChannel } from "@/lib/selection-store";
import type { ChannelCandidate } from "@/types/channel";
import type { RankedVideo, VideoMetadata } from "@/types/video";
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

export function VideoSelectorPlaceholder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelUrl = searchParams.get("channelUrl") ?? "";
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
  const [isKnowledgeDialogOpen, setIsKnowledgeDialogOpen] = useState(false);
  const [isCreatingKnowledgeBase, setIsCreatingKnowledgeBase] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [knowledgeBaseResult, setKnowledgeBaseResult] = useState("");
  const [knowledgeBaseError, setKnowledgeBaseError] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const page = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadChannel() {
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
  }, [channelUrl, router]);

  useEffect(() => {
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
  }, [channel, page]);

  useEffect(() => {
    if (!channel || rankedVideos.length > 0 || !hasMore || isLoading) {
      return;
    }

    void fetchVideoPage({
      channelUrl: channel.url,
      page: page + 1,
      pageSize: PAGE_SIZE,
      enrich: false,
      includeTotal: false,
    }).catch(() => undefined);
  }, [channel, hasMore, isLoading, page, rankedVideos.length]);

  function updatePage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", nextPage.toString());
    router.push(`/videos?${params.toString()}`);
  }

  const isSearchMode = rankedVideos.length > 0;
  const searchFirstIndex = (searchPage - 1) * PAGE_SIZE;
  const displayedVideos = isSearchMode
    ? rankedVideos.slice(searchFirstIndex, searchFirstIndex + PAGE_SIZE)
    : videos;
  const visibleCount = isSearchMode ? rankedVideos.length : videos.length;
  const activePage = isSearchMode ? searchPage : page;
  const activeHasPrevious = activePage > 1;
  const activeHasNext = isSearchMode
    ? searchFirstIndex + PAGE_SIZE < rankedVideos.length
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
  const visibleVideoIds = displayedVideos.map((video) => video.video_id);
  const selectedVisibleCount = visibleVideoIds.filter((videoId) =>
    selectedVideoIds.has(videoId)
  ).length;
  const areAllVisibleSelected =
    visibleVideoIds.length > 0 && selectedVisibleCount === visibleVideoIds.length;
  const areSomeVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleVideoIds.length;

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

  function updateVisiblePage(nextPage: number) {
    if (isSearchMode) {
      setSearchPage(nextPage);
      return;
    }

    updatePage(nextPage);
  }

  async function runVideoSearch(): Promise<boolean> {
    const activeQuery = query.trim();

    if (!channel || !activeQuery) {
      return false;
    }

    setQuery(activeQuery);
    setIsSearchingVideos(true);
    setErrorMessage("");
    setSearchPage(1);

    try {
      const response = await searchVideos({
        channelUrl: channel.url,
        query: activeQuery,
      });

      setRankedVideos(response.videos);
      setHasMore(false);
      setTotalCount(response.total_count);
      setSelectedVideoIds((current) => {
        const next = new Set(current);
        response.videos.forEach((video) => {
          if (video.selected) {
            next.add(video.video_id);
          }
        });
        return next;
      });
      setSelectedVideosById((current) => {
        const next = new Map(current);
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


  function clearVideoSearch() {
    setQuery("");
    setRankedVideos([]);
    setSearchPage(1);
  }

  async function handleCreateKnowledgeBase() {
    if (!channel || selectedVideosById.size === 0 || !outputDir.trim()) {
      return;
    }

    setIsCreatingKnowledgeBase(true);
    setKnowledgeBaseError("");
    setKnowledgeBaseResult("");

    try {
      const response = await createKnowledgeBase({
        channelName: channel.name,
        channelUrl: channel.url,
        outputDir: outputDir.trim(),
        videos: Array.from(selectedVideosById.values()),
        includeComments: true,
      });

      setKnowledgeBaseResult(
        `Created ${response.count} files in ${response.output_path}`
      );
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

  if (!channel) {
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
              onClick={() => {
                if (sourceSearch) {
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
                {channel.thumbnailUrl ? (
                  <img
                    src={channel.thumbnailUrl}
                    alt={`${channel.name} thumbnail`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  channel.avatarUrl
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{channel.name}</p>
                <p className="truncate text-xs text-[var(--yt-muted)]">
                  Subscribers: {channel.subscriberCount} · Videos: {channelVideoCountText}
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              <span className="rounded-full bg-[var(--yt-card)] px-3 py-2 text-xs font-medium text-[var(--yt-foreground)]">
                Selected: {selectedVideoIds.size}
              </span>
              <Button
                type="button"
                disabled={selectedVideoIds.size === 0}
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
                placeholder="Search videos by title, description, date, or views"
                className="h-11 rounded-full border-[var(--yt-border)] bg-[var(--yt-input)] pl-11 text-[var(--yt-foreground)]"
              />
            </div>

            <Button
              type="button"
              disabled={!query.trim() || isSearchingVideos}
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

            {isSearchMode ? (
              <Button
                type="button"
                variant="ghost"
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
              disabled={!activeHasPrevious || isLoading}
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
              disabled={!activeHasNext || isLoading}
              onClick={() => updateVisiblePage(activePage + 1)}
              className="h-10 rounded-full px-3"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        <Dialog open={isKnowledgeDialogOpen} onOpenChange={setIsKnowledgeDialogOpen}>
          <DialogContent className="bg-[var(--yt-page)] text-[var(--yt-foreground)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Knowledge Base</DialogTitle>
              <DialogDescription>
                Choose a local folder. The backend will create a channel folder
                and one Markdown file per selected video, replacing matching files
                that already exist.
              </DialogDescription>
            </DialogHeader>

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateKnowledgeBase();
              }}
            >
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

              <div className="rounded-xl border border-[var(--yt-border)] bg-[var(--yt-card)] p-4 text-sm text-[var(--yt-muted)]">
                {isCreatingKnowledgeBase ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating files, fetching transcripts, and checking comments...
                  </span>
                ) : isPickingFolder ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for folder selection...
                  </span>
                ) : knowledgeBaseResult ? (
                  <span className="text-emerald-600">{knowledgeBaseResult}</span>
                ) : knowledgeBaseError ? (
                  <span className="text-red-500">{knowledgeBaseError}</span>
                ) : (
                  <span>
                    Selected videos: {selectedVideoIds.size}. Transcripts are pulled
                    from YouTube captions when available. Existing matching files
                    will be overwritten.
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isCreatingKnowledgeBase}
                  onClick={() => setIsKnowledgeDialogOpen(false)}
                  className="rounded-full px-5"
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  disabled={
                    selectedVideoIds.size === 0 ||
                    !outputDir.trim() ||
                    isCreatingKnowledgeBase ||
                    isPickingFolder ||
                    Boolean(knowledgeBaseResult)
                  }
                  className="rounded-full px-6"
                >
                  {isCreatingKnowledgeBase ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          <div className="grid shrink-0 grid-cols-[48px_minmax(360px,1.6fr)_112px_130px_130px_100px_72px] items-center border-b border-[var(--yt-border)] bg-[var(--yt-card-strong)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--yt-subtle)]">
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

          <div className="min-h-0 flex-1 overflow-auto">
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
                {displayedVideos.map((video) => (
                  <div
                    key={video.video_id}
                    className="grid grid-cols-[48px_minmax(360px,1.6fr)_112px_130px_130px_100px_72px] items-center border-b border-[var(--yt-border)] px-4 py-3 text-sm last:border-b-0 hover:bg-[var(--yt-card-strong)]"
                  >
                    <Checkbox
                      checked={selectedVideoIds.has(video.video_id)}
                      onCheckedChange={() => toggleVideo(video)}
                    />

                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-red-600/10">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={`${video.title} thumbnail`}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium leading-5">
                          {video.title}
                        </p>
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
    </main>
  );
}
