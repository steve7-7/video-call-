"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoFilter } from "@/lib/features";
import { VIDEO_FILTERS } from "@/lib/features";

/** New feature: apply a CSS video filter to a MediaStream's tracks in real time. */
export function useVideoFilter() {
  const [filter, setFilter] = useState<VideoFilter>("none");
  const processorRef = useRef<((f: VideoFilter) => void) | null>(null);

  const attach = useCallback((stream: MediaStream | null) => {
    // No-op: filters are applied via CSS on the <video> element.
    // This hook is kept as a state container for the current filter.
    if (stream) {
      const v = stream.getVideoTracks()[0];
      if (v) v.contentHint = "motion";
    }
  }, []);

  const cssFilter = VIDEO_FILTERS.find((f) => f.id === filter)?.cssFilter ?? "none";

  return {
    filter,
    setFilter,
    cssFilter,
    attach,
  };
}
