import { Suspense } from "react";

import { ChannelResultsRoute } from "@/components/channel/channel-results-route";

export default function ChannelsPage() {
  return (
    <Suspense fallback={null}>
      <ChannelResultsRoute />
    </Suspense>
  );
}
