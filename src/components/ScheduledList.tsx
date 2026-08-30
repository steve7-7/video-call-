"use client";

import type { ScheduledCall } from "@/hooks/useScheduledCalls";
import { CloseIcon } from "@/components/icons";

/** New feature: render the list of scheduled calls inside the home sidebar. */
export function ScheduledList({
  items,
  onRemove,
  onJoin,
}: {
  items: ScheduledCall[];
  onRemove: (id: string) => void;
  onJoin: (s: ScheduledCall) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-[#65676B]">
        No scheduled calls.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {items.map((s) => {
        const dt = new Date(s.when);
        const isPast = s.when <= Date.now();
        return (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[#F0F2F5]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDE2E4] text-base">
              {s.type === "live" ? "📡" : "📅"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#050505]">{s.title}</p>
              <p className="text-[12px] text-[#65676B]">
                {dt.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                {isPast && " · live now"}
              </p>
            </div>
            <button
              onClick={() => onJoin(s)}
              className="rounded-full bg-[#E7F3FF] px-3 py-1 text-[11px] font-bold text-[#0084FF] hover:bg-[#D4E9FF]"
            >
              Join
            </button>
            <button
              onClick={() => onRemove(s.id)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#65676B] hover:bg-[#D8DADF]"
              title="Remove"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
