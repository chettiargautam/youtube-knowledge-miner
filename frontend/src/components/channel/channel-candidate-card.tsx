"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Users,
} from "lucide-react";

import type { ChannelCandidate } from "@/types/channel";
import { resolveChannelDetails } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ChannelCandidateCardProps = {
  channel: ChannelCandidate;
  selected: boolean;
  onSelect: (channel: ChannelCandidate) => void;
  onChannelUpdate: (channel: ChannelCandidate) => void;
};

export function ChannelCandidateCard({
  channel,
  selected,
  onSelect,
  onChannelUpdate,
}: ChannelCandidateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState("");

  async function toggleDescription() {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setDescriptionError("");
    setIsLoadingDescription(true);

    try {
      const detailedChannel = await resolveChannelDetails(channel);
      onChannelUpdate(detailedChannel);
      setIsExpanded(true);
    } catch {
      setDescriptionError("Could not load more description text.");
      setIsExpanded(true);
    } finally {
      setIsLoadingDescription(false);
    }
  }

  return (
    <Card
      className={cn(
        "group cursor-pointer border-[var(--yt-border)] bg-[var(--yt-card)] p-4 text-[var(--yt-foreground)] shadow-xl shadow-black/10 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-red-500/35 hover:bg-[var(--yt-card-strong)] hover:shadow-[0_20px_70px_rgba(220,38,38,0.14)]",
        selected &&
          "border-red-500/45 bg-[var(--yt-card-strong)] ring-1 ring-red-500/25"
      )}
      onClick={() => onSelect(channel)}
    >
      <div className="flex gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-red-600 text-sm font-black tracking-tight text-white shadow-lg shadow-red-950/20">
          {channel.thumbnailUrl ? (
            <img
              src={channel.thumbnailUrl}
              alt={`${channel.name} thumbnail`}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <img
              src="/logo.png"
              alt=""
              className="h-9 w-9 object-contain"
              draggable={false}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="truncate text-lg font-semibold tracking-tight">
                  {channel.name}
                </h3>

                {channel.verified ? (
                  <BadgeCheck className="h-4.5 w-4.5 fill-[#3ea6ff] text-white" />
                ) : null}

                {selected ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--yt-subtle)]">
                {channel.handle ? <span>{channel.handle}</span> : null}

                {channel.handle ? (
                  <span className="h-1 w-1 rounded-full bg-[var(--yt-border)]" />
                ) : null}

                <a
                  href={channel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition hover:text-red-500"
                  onClick={(event) => event.stopPropagation()}
                >
                  Open channel
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {channel.verified ? (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-[#3ea6ff]/10 text-[#3ea6ff] hover:bg-[#3ea6ff]/10"
                >
                  <BadgeCheck className="mr-1 h-3.5 w-3.5 fill-[#3ea6ff] text-white" />
                  Verified
                </Badge>
              ) : null}

              <Badge
                variant="secondary"
                className="rounded-full bg-red-600/10 text-red-500 hover:bg-red-600/10"
              >
                {Math.round(channel.matchScore)}% match
              </Badge>
            </div>
          </div>

          <div className="mt-3">
            <p
              className={cn(
                "text-sm leading-6 text-[var(--yt-muted)]",
                !isExpanded && "max-h-12 overflow-hidden"
              )}
            >
              {channel.description}
            </p>

            {channel.url ? (
              <button
                type="button"
                className="mt-1 cursor-pointer text-xs font-medium text-red-500 transition hover:text-red-600"
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleDescription();
                }}
              >
                {isLoadingDescription ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading description
                  </span>
                ) : isExpanded ? (
                  "Show less"
                ) : (
                  "Read full description"
                )}
              </button>
            ) : null}

            {descriptionError ? (
              <p className="mt-1 text-xs text-red-500">{descriptionError}</p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--yt-muted)]">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--yt-border)] bg-[var(--yt-card)] px-3 py-1.5">
              <Users className="h-3.5 w-3.5" />
              Subscribers: {channel.subscriberCount}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
