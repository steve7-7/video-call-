"use client";

import { useState } from "react";
import { CloseIcon, LogoIcon } from "@/components/icons";
import type { ScheduledCall } from "@/hooks/useScheduledCalls";

/** New feature: schedule a call for later and get a browser reminder. */
export function ScheduleModal({
  open,
  onClose,
  onSchedule,
  defaultRoomId,
}: {
  open: boolean;
  onClose: () => void;
  onSchedule: (s: Omit<ScheduledCall, "id" | "createdAt" | "notified">) => void;
  defaultRoomId?: string;
}) {
  const [title, setTitle] = useState("Team sync");
  const [roomId, setRoomId] = useState(defaultRoomId ?? "");
  const [type, setType] = useState<"call" | "live">("call");
  const [whenIso, setWhenIso] = useState(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = () => {
    if (title.trim().length < 2) {
      setError("Please enter a title.");
      return;
    }
    const when = new Date(whenIso).getTime();
    if (Number.isNaN(when) || when <= Date.now()) {
      setError("Please pick a time in the future.");
      return;
    }
    onSchedule({ title: title.trim(), when, roomId: roomId.trim().toUpperCase(), type });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl animate-sheet-up safe-bottom sm:rounded-2xl sm:animate-fade-in">
        <div className="mx-auto mb-3 h-1.5 w-10 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={36} />
            <h2 className="text-lg font-bold text-[#050505]">Schedule a call</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4E6EB] text-[#050505] transition hover:bg-[#D8DADF]"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-semibold text-[#050505]">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          className="mb-3 w-full rounded-lg border border-[#CED0D4] px-3 py-2.5 text-sm text-[#050505] outline-none focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/30"
        />

        <label className="mb-1.5 block text-sm font-semibold text-[#050505]">Room code</label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          maxLength={10}
          placeholder="(leave blank to fill later)"
          className="mb-3 w-full rounded-lg border border-[#CED0D4] px-3 py-2.5 text-sm font-semibold tracking-widest text-[#050505] outline-none focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/30"
        />

        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setType("call")}
            className={`flex-1 rounded-full border py-2 text-sm font-semibold transition ${
              type === "call"
                ? "border-[#0084FF] bg-[#E7F3FF] text-[#0084FF]"
                : "border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            Video call
          </button>
          <button
            onClick={() => setType("live")}
            className={`flex-1 rounded-full border py-2 text-sm font-semibold transition ${
              type === "live"
                ? "border-[#F02849] bg-[#FDE2E4] text-[#F02849]"
                : "border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            Live broadcast
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-semibold text-[#050505]">When</label>
        <input
          type="datetime-local"
          value={whenIso}
          onChange={(e) => setWhenIso(e.target.value)}
          className="mb-3 w-full rounded-lg border border-[#CED0D4] px-3 py-2.5 text-sm text-[#050505] outline-none focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/30"
        />

        {error && <p className="mb-3 text-sm text-[#F02849]">{error}</p>}

        <button
          onClick={submit}
          className="w-full rounded-full bg-[#0084FF] py-2.5 font-semibold text-white transition hover:bg-[#0073E6]"
        >
          Schedule
        </button>
      </div>
    </div>
  );
}
