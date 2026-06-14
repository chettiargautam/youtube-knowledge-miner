"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Link2, Loader2, Search } from "lucide-react";

import { resolveChannelCandidates, resolveChannelDetails } from "@/lib/api";
import { saveSelectedChannel } from "@/lib/selection-store";
import type { ChannelCandidate } from "@/types/channel";
import { YouTubePlayLogo, YouTubeWordmark } from "@/components/icons/youtube-wordmark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChannelCandidateCard } from "@/components/channel/channel-candidate-card";

const RESULTS_PER_PAGE = 6;

type ChannelSearchHeroProps = {
  initialSearchQuery?: string;
  resultsOnly?: boolean;
};

export function ChannelSearchHero({
  initialSearchQuery = "",
  resultsOnly = false,
}: ChannelSearchHeroProps) {
  const router = useRouter();

  const [input, setInput] = useState(initialSearchQuery);
  const [isSearching, setIsSearching] = useState(
    resultsOnly && initialSearchQuery.trim().length > 1
  );
  const [candidates, setCandidates] = useState<ChannelCandidate[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelCandidate | null>(
    null
  );
  const hasSearched = resultsOnly;
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(1);

  const canSearch = input.trim().length > 1 && !isSearching;
  const totalPages = Math.max(1, Math.ceil(candidates.length / RESULTS_PER_PAGE));
  const visibleCandidates = candidates.slice(
    (page - 1) * RESULTS_PER_PAGE,
    page * RESULTS_PER_PAGE
  );
  const youtubeSearchHref = input.trim()
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(input.trim())}`
    : "https://www.youtube.com";

  const goToVideoSelection = useCallback((channel: ChannelCandidate) => {
    saveSelectedChannel(channel);
    const params = new URLSearchParams({
      channelUrl: channel.url,
    });

    if (input.trim()) {
      params.set("search", input.trim());
    }

    router.push(`/videos?${params.toString()}`);
  }, [input, router]);

  function updateChannel(updatedChannel: ChannelCandidate) {
    setCandidates((items) =>
      items.map((item) => (item.id === updatedChannel.id ? updatedChannel : item))
    );
    setSelectedChannel((current) =>
      current?.id === updatedChannel.id ? updatedChannel : current
    );
  }

  async function selectChannel(channel: ChannelCandidate) {
    setSelectedChannel(channel);

    if (channel.videoCount !== null) {
      return;
    }

    try {
      const detailedChannel = await resolveChannelDetails(channel);
      updateChannel(detailedChannel);
    } catch {
      return;
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSearch) {
      return;
    }

    const query = input.trim();

    if (!resultsOnly) {
      setIsSearching(true);
      setErrorMessage("");

      try {
        const result = await resolveChannelCandidates(query, 24);

        if (result.inputType === "youtube_url" && result.selectedChannel) {
          goToVideoSelection(result.selectedChannel);
          return;
        }

        router.push(`/channels?search=${encodeURIComponent(query)}`);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not connect to the backend server."
        );
      } finally {
        setIsSearching(false);
      }

      return;
    }

    router.push(`/channels?search=${encodeURIComponent(query)}`);
  }

  useEffect(() => {
    if (!resultsOnly) {
      return;
    }

    const query = initialSearchQuery.trim();

    if (!query) {
      return;
    }

    let isCurrent = true;

    async function loadResultsFromRoute() {
      try {
        const result = await resolveChannelCandidates(query, 24);

        if (!isCurrent) {
          return;
        }

        if (result.inputType === "youtube_url" && result.selectedChannel) {
          goToVideoSelection(result.selectedChannel);
          return;
        }

        setCandidates(result.candidates);
        setSelectedChannel(result.selectedChannel);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not connect to the backend server."
        );
      } finally {
        if (isCurrent) {
          setIsSearching(false);
        }
      }
    }

    void loadResultsFromRoute();

    return () => {
      isCurrent = false;
    };
  }, [goToVideoSelection, initialSearchQuery, resultsOnly]);

  return (
    <main className="relative h-screen overflow-hidden bg-[var(--yt-page)] text-[var(--yt-foreground)] transition-colors duration-300">
      <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[540px] w-[860px] -translate-x-1/2 rounded-full bg-[var(--yt-glow-one)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-280px] left-[-180px] h-[540px] w-[540px] rounded-full bg-[var(--yt-glow-two)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-340px] right-[-200px] h-[660px] w-[660px] rounded-full bg-[var(--yt-glow-one)] blur-3xl" />

      <section className="relative mx-auto flex h-screen w-full max-w-[1500px] flex-col overflow-hidden px-5 sm:px-8 lg:px-10">
        <div
          className={
            hasSearched
              ? "mx-auto w-full max-w-5xl shrink-0 pt-5"
              : "mx-auto flex w-full max-w-[1280px] flex-1 flex-col items-center justify-center pb-16 pt-12 text-center"
          }
        >
          {!hasSearched ? (
            <h1 className="max-w-[1220px] text-balance text-5xl font-black leading-[0.95] tracking-[-0.065em] sm:text-6xl md:text-7xl lg:text-[5.8rem] xl:text-[6.7rem]">
              Turn any{" "}
              <YouTubeWordmark
                className="inline-flex items-center gap-[0.12em] whitespace-nowrap align-[-0.08em]"
                iconClassName="h-[0.64em] w-[0.92em] shrink-0 drop-shadow-[0_0_26px_rgba(220,38,38,0.28)]"
                textClassName="font-black tracking-[-0.08em] text-[var(--yt-foreground)]"
              />{" "}
              channel into a clean research source.
            </h1>
          ) : (
            <div className="mb-3 flex w-full items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--yt-subtle)]">
                  Channel search results
                </p>
                <h1 className="mt-1 text-xl font-black tracking-tight">View channel results</h1>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  router.push("/home");
                }}
                className="rounded-full text-[var(--yt-muted)] hover:bg-red-600/10 hover:text-red-500"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className={
              hasSearched
                ? "mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row"
                : "mt-8 flex w-full max-w-3xl flex-col gap-3 sm:flex-row"
            }
          >
            <div className="group relative flex-1">
              <div className="pointer-events-none absolute inset-0 rounded-full bg-red-600/0 opacity-0 blur-xl transition-all duration-300 ease-out group-hover:bg-red-600/20 group-hover:opacity-100 group-focus-within:bg-red-600/25 group-focus-within:opacity-100" />

              <Link2 className="pointer-events-none absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--yt-subtle)] transition-all duration-300 ease-out group-hover:scale-110 group-hover:text-red-500 group-focus-within:scale-110 group-focus-within:text-red-500" />

              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Paste channel URL or exact channel name"
                className="relative h-12 cursor-text rounded-full border-[var(--yt-border)] bg-[var(--yt-input)] pl-12 pr-5 text-base text-[var(--yt-foreground)] shadow-2xl shadow-black/10 outline-none transition-all duration-300 ease-out placeholder:text-[var(--yt-subtle)] hover:-translate-y-0.5 hover:border-red-500/45 hover:bg-[var(--yt-card-strong)] hover:shadow-[0_0_0_1px_rgba(220,38,38,0.18),0_22px_70px_rgba(220,38,38,0.14)] focus-visible:-translate-y-0.5 focus-visible:border-red-500/60 focus-visible:ring-red-500/25"
              />
            </div>

            <Button
              type="submit"
              disabled={!canSearch}
              className="group h-12 cursor-pointer rounded-full bg-[var(--yt-button)] px-7 text-base font-semibold text-[var(--yt-button-text)] shadow-2xl shadow-black/10 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.025] hover:bg-red-600 hover:text-white hover:shadow-[0_0_0_1px_rgba(220,38,38,0.3),0_22px_70px_rgba(220,38,38,0.28)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:bg-[var(--yt-button)] disabled:hover:text-[var(--yt-button-text)] disabled:hover:shadow-black/10"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Checking
                </>
              ) : (
                <>
                  Find channel
                  <Search className="ml-2 h-5 w-5 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:scale-110" />
                </>
              )}
            </Button>
          </form>

          {errorMessage ? (
            <Card className="mx-auto mt-4 w-full max-w-5xl border-red-500/25 bg-red-600/10 p-4 text-left text-red-500">
              <p className="text-sm font-medium">Backend error</p>
              <p className="mt-1 text-sm opacity-90">{errorMessage}</p>
            </Card>
          ) : null}

        </div>

        {hasSearched ? (
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col pt-4">
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              {isSearching ? (
                <div className="grid gap-3">
                  {[0, 1, 2, 3].map((item) => (
                    <Card
                      key={item}
                      className="h-36 animate-pulse border-[var(--yt-border)] bg-[var(--yt-card)]"
                    />
                  ))}
                </div>
              ) : visibleCandidates.length > 0 ? (
                <div className="grid gap-3">
                  {visibleCandidates.map((channel) => (
                    <ChannelCandidateCard
                      key={channel.id}
                      channel={channel}
                      selected={selectedChannel?.id === channel.id}
                      onSelect={(channel) => void selectChannel(channel)}
                      onChannelUpdate={updateChannel}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-[var(--yt-border)] bg-[var(--yt-card)] p-8 text-center text-[var(--yt-foreground)]">
                  <p className="text-lg font-semibold">No channel matches found.</p>
                  <p className="mt-2 text-sm text-[var(--yt-subtle)]">
                    Try a full YouTube channel URL, handle, or a closer exact
                    channel name.
                  </p>
                </Card>
              )}
            </div>

            <div className="z-20 shrink-0 py-4">
              <div className="flex flex-col items-stretch justify-between gap-3 rounded-3xl bg-[var(--yt-page)]/90 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:flex-row sm:items-center">
                <p className="text-sm font-medium">
                  {selectedChannel
                    ? `${selectedChannel.name} selected.`
                    : "Select a channel to continue."}
                </p>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {candidates.length > RESULTS_PER_PAGE ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--yt-muted)] sm:justify-start">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={page === 1}
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                        className="h-9 rounded-full px-3"
                      >
                        Previous
                      </Button>
                      <span className="min-w-16 text-center">
                        {page} / {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={page === totalPages}
                        onClick={() =>
                          setPage((value) => Math.min(totalPages, value + 1))
                        }
                        className="h-9 rounded-full px-3"
                      >
                        Next
                      </Button>
                    </div>
                  ) : null}

                  <Button
                    disabled={!selectedChannel}
                    onClick={() => {
                      if (selectedChannel) {
                        goToVideoSelection(selectedChannel);
                      }
                    }}
                    className="group cursor-pointer rounded-full bg-[var(--yt-button)] text-[var(--yt-button-text)] shadow-xl shadow-black/10 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.025] hover:bg-red-600 hover:text-white hover:shadow-[0_18px_60px_rgba(220,38,38,0.25)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:bg-[var(--yt-button)] disabled:hover:text-[var(--yt-button-text)]"
                  >
                    Continue to video selection
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <a
            href={youtubeSearchHref}
            target="_blank"
            rel="noreferrer"
            className="group mx-auto mb-10 inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-4 py-2 text-xs text-[var(--yt-subtle)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-red-500/25 hover:bg-red-600/10 hover:text-red-500 hover:shadow-[0_18px_50px_rgba(220,38,38,0.16)]"
          >
            <YouTubePlayLogo className="h-3.5 w-5 opacity-80 transition-all duration-300 ease-out group-hover:scale-110 group-hover:opacity-100 group-hover:drop-shadow-[0_0_16px_rgba(220,38,38,0.45)]" />
            Find your channel URL from YouTube directly
          </a>
        )}
      </section>
    </main>
  );
}
