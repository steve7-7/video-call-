"use client";

import { useCallback, useRef, useState } from "react";
import type { Poll, SignalMessage } from "@/lib/types";

/**
 * New feature: in-call polls. The hook is purely additive — it doesn't touch
 * any existing engine. The owner wires it to the signaling layer by passing
 * a `send` function (typically `engine.sendChat` already exists; we add a
 * dedicated `sendSignal` for non-chat messages).
 */
export function usePolls(sendSignal: (msg: SignalMessage) => void) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const pollsRef = useRef<Poll[]>([]);

  const upsert = useCallback((poll: Poll) => {
    pollsRef.current = [
      ...pollsRef.current.filter((p) => p.id !== poll.id),
      poll,
    ];
    setPolls([...pollsRef.current]);
  }, []);



  const createPoll = useCallback(
    (question: string, options: string[]) => {
      if (options.length < 2) return;
      const id = `poll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const poll: Poll = {
        id,
        question: question.trim(),
        options: options.map((label) => ({ id: `${id}-${label}`, label, voters: [] })),
        closed: false,
        createdBy: "",
        createdAt: Date.now(),
      };
      upsert(poll);
      sendSignal({
        type: "poll_create",
        from: "",
        poll,
        ts: Date.now(),
      });
    },
    [sendSignal, upsert]
  );

  const vote = useCallback(
    (pollId: string, optionId: string, voterId: string) => {
      const current = pollsRef.current.find((p) => p.id === pollId);
      if (!current || current.closed) return;
      // Remove any previous vote by this voter in any option of this poll
      const cleaned: Poll = {
        ...current,
        options: current.options.map((o) => ({
          ...o,
          voters: o.voters.filter((v) => v !== voterId),
        })),
      };
      const updated: Poll = {
        ...cleaned,
        options: cleaned.options.map((o) =>
          o.id === optionId ? { ...o, voters: [...o.voters, voterId] } : o
        ),
      };
      upsert(updated);
      sendSignal({
        type: "poll_vote",
        from: voterId,
        pollId,
        optionId,
        ts: Date.now(),
      });
    },
    [sendSignal, upsert]
  );

  const closePoll = useCallback(
    (pollId: string) => {
      const current = pollsRef.current.find((p) => p.id === pollId);
      if (!current) return;
      upsert({ ...current, closed: true });
      sendSignal({ type: "poll_close", from: "", pollId, ts: Date.now() });
    },
    [sendSignal, upsert]
  );

  return { polls, createPoll, vote, closePoll, upsert };
}
