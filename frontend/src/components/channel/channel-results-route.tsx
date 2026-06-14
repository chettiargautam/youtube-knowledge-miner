"use client";

import { useSearchParams } from "next/navigation";

import { ChannelSearchHero } from "@/components/channel/channel-search-hero";

export function ChannelResultsRoute() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";

  return <ChannelSearchHero key={search} initialSearchQuery={search} resultsOnly />;
}
