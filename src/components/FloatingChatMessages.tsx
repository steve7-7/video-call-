"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";

interface FloatingMsg {
  id: string;
  text: string;
  from: string;
  name: string;
  createdAt: number;
}

/**
 * Floating chat messages that appear on the video area when the user is
 * watching a live broadcast. They fade in from the bottom and drift upward
 * in random lanes — exactly like the emoji reactions.
 */
export function FloatingChatMessages({ message }: { message: ChatMessage | null }) {
  const [items, setItems] = useState<FloatingMsg[]>([]);

  useEffect(() => {
    if (!message) return;
    const fm: FloatingMsg = {
      id: message.id,
      text: message.body,
      from: message.from,
      name: message.name,
      createdAt: Date.now(),
    };
    setItems((prev) => [...prev.slice(-6), fm]);

    const timer = setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== fm.id));
    }, 5200);

    return () => clearTimeout(timer);
  }, [message]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {items.map((m, idx) => {
        const lane = ((idx * 31) % 5) / 5; // deterministic pseudo-random lane
        return (
          <div
            key={m.id}
            className="floating-chat"
            style={{ left: `${8 + lane * 80}%` }}
          >
            <span className="font-semibold text-[#FFFB]">{m.name}:</span> {m.text}
          </div>
        );
      })}
    </div>
  );
}
