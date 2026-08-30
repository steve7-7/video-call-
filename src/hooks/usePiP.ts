"use client";

import { useCallback, useRef, useState } from "react";

/**
 * New feature: request Picture-in-Picture for a given <video> element.
 * Browser support is broad (Chrome, Edge, Safari) and gracefully no-ops
 * where missing.
 */
export function usePiP() {
  const pippingRef = useRef(false);
  const [isPip, setIsPip] = useState(false);

  const toggle = useCallback(async (video: HTMLVideoElement | null) => {
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        pippingRef.current = false;
        setIsPip(false);
        return;
      }
      // Older Safari uses webkitPresentationMode
      const w = video as HTMLVideoElement & {
        webkitSupportsPresentationMode?: (m: string) => boolean;
        webkitSetPresentationMode?: (m: string) => void;
      };
      if (typeof w.webkitSetPresentationMode === "function") {
        w.webkitSetPresentationMode("picture-in-picture");
        pippingRef.current = true;
        setIsPip(true);
        return;
      }
      if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        pippingRef.current = true;
        setIsPip(true);
      }
    } catch (err) {
      console.warn("PiP toggle failed", err);
    }
  }, []);

  return { toggle, isPip };
}
