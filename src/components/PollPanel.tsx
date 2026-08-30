"use client";

import { useState } from "react";
import type { Poll } from "@/lib/types";
import { CloseIcon } from "@/components/icons";

export function PollPanel({
  polls,
  myId,
  canCreate,
  onCreate,
  onVote,
  onClosePoll,
  onHide,
}: {
  polls: Poll[];
  myId: string;
  /** Only hosts (live) and group-call hosts should be able to create. */
  canCreate: boolean;
  onCreate: (question: string, options: string[]) => void;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
  onHide: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const totalVoters = (p: Poll) => {
    const set = new Set<string>();
    p.options.forEach((o) => o.voters.forEach((v) => set.add(v)));
    return set.size;
  };

  const submit = () => {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (q.length < 3 || opts.length < 2) return;
    onCreate(q, opts);
    setQuestion("");
    setOptions(["", ""]);
    setShowCreate(false);
  };

  return (
    <div className="flex h-full flex-col bg-[#242526]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#3A3B3C] px-4">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          📊 Polls
        </span>
        <button
          onClick={onHide}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#B0B3B8] hover:bg-[#3A3B3C]"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {polls.length === 0 && !showCreate && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-4xl">📊</p>
            <p className="text-sm font-semibold text-white">No polls yet</p>
            <p className="text-xs text-[#B0B3B8]">
              {canCreate
                ? "Create a poll to gather quick feedback from everyone."
                : "Wait for a host to start a poll."}
            </p>
          </div>
        )}

        {canCreate && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full rounded-xl border border-dashed border-[#4E4F50] py-3 text-sm font-semibold text-[#0084FF] transition hover:bg-[#3A3B3C]"
          >
            + Create poll
          </button>
        )}

        {showCreate && (
          <div className="rounded-xl bg-[#3A3B3C] p-3 space-y-2">
            <input
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question…"
              maxLength={120}
              className="w-full rounded-lg border border-[#4E4F50] bg-[#242526] px-3 py-2 text-sm text-white outline-none placeholder:text-[#8A8D91] focus:border-[#0084FF]"
            />
            {options.map((o, i) => (
              <input
                key={i}
                value={o}
                onChange={(e) =>
                  setOptions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                }
                placeholder={`Option ${i + 1}`}
                maxLength={50}
                className="w-full rounded-lg border border-[#4E4F50] bg-[#242526] px-3 py-2 text-sm text-white outline-none placeholder:text-[#8A8D91] focus:border-[#0084FF]"
              />
            ))}
            {options.length < 4 && (
              <button
                onClick={() => setOptions((prev) => [...prev, ""])}
                className="text-xs font-semibold text-[#0084FF] hover:underline"
              >
                + Add option
              </button>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setQuestion("");
                  setOptions(["", ""]);
                }}
                className="flex-1 rounded-full border border-[#4E4F50] py-1.5 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="flex-1 rounded-full bg-[#0084FF] py-1.5 text-sm font-semibold text-white"
              >
                Publish
              </button>
            </div>
          </div>
        )}

        {polls.map((p) => {
          const total = totalVoters(p) || 1;
          const myVote = p.options.find((o) => o.voters.includes(myId));
          return (
            <div key={p.id} className="rounded-xl bg-[#3A3B3C] p-3 space-y-2">
              <p className="text-sm font-bold text-white">{p.question}</p>
              <div className="space-y-1.5">
                {p.options.map((o) => {
                  const pct = Math.round((o.voters.length / total) * 100);
                  const selected = myVote?.id === o.id;
                  return (
                    <button
                      key={o.id}
                      disabled={p.closed}
                      onClick={() => onVote(p.id, o.id)}
                      className={`relative w-full overflow-hidden rounded-lg border px-3 py-1.5 text-left text-sm transition ${
                        selected
                          ? "border-[#0084FF] text-white"
                          : "border-[#4E4F50] text-white hover:border-[#8AB4F8]"
                      }`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-[#0084FF]/30 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="relative flex items-center justify-between">
                        <span className="font-medium">{o.label}</span>
                        <span className="text-xs text-[#B0B3B8]">
                          {pct}% · {o.voters.length}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#B0B3B8]">
                  {totalVoters(p)} vote{totalVoters(p) === 1 ? "" : "s"}
                  {p.closed && " · closed"}
                </span>
                {canCreate && !p.closed && (
                  <button
                    onClick={() => onClosePoll(p.id)}
                    className="text-xs font-semibold text-[#8AB4F8] hover:underline"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
