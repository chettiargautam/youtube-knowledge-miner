import { Suspense } from "react";

import { VideoSelectorPlaceholder } from "@/components/videos/video-selector-placeholder";

export default function TopicsPage() {
  return (
    <Suspense fallback={null}>
      <VideoSelectorPlaceholder />
    </Suspense>
  );
}
