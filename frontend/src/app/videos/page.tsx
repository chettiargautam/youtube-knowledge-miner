import { Suspense } from "react";

import { VideoSelectorPlaceholder } from "@/components/videos/video-selector-placeholder";

export default function VideosPage() {
  return (
    <Suspense fallback={null}>
      <VideoSelectorPlaceholder />
    </Suspense>
  );
}
