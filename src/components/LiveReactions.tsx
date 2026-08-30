"use client";

import { useEffect, useState } from "react";
import type { LiveReaction as LiveReactionType } from "@/lib/types";

/**
 * Floating emoji reactions that drift upward across the video area. Each
 * reaction is randomly assigned to one of several horizontal lanes and
 * animates from bottom to top via CSS keyframes (see globals.css).
 */
export function LiveReactionOverlay({ reactions }: { reactions: LiveReactionType[] }) {
  // Force a re-render when the array reference changes so the CSS animation
  // restarts for each new emoji.
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="live-reaction"
          style={{ left: `${5 + r.lane * 90}%` }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
}

export function ReactionBar({
  onReact,
  disabled,
}: {
  onReact: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const EMOJIS = ["❤️", "😂", "😮", "😢", "👏", "🔥", "🎉", "👍"];

  // Auto-collapse after 4s of inactivity
  useEffect(() => {
    if (hidden) return;
    const t = setTimeout(() => setHidden(true), 4500);
    return () => clearTimeout(t);
  }, [hidden, onReact]);

  if (disabled) return null;

  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-20 -translate-x-1/2 safe-bottom-mb sm:bottom-32">
      {hidden ? (
        <button
          onClick={() => setHidden(false)}
          className="flex h-11 items-center gap-2 rounded-full bg-[#1B1F24]/90 px-4 text-sm font-semibold text-white shadow-xl backdrop-blur-md transition hover:bg-[#2A2E34]"
        >
          React ❤️
        </button>
      ) : (
        <div className="no-scrollbar flex max-w-[92vw] items-center gap-1 overflow-x-auto rounded-full bg-[#1B1F24]/90 px-2 py-2 shadow-xl backdrop-blur-md">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onReact(e)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl transition hover:scale-125 hover:bg-white/10 active:scale-95 sm:h-10 sm:w-10 sm:text-2xl"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
