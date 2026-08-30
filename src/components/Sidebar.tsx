"use client";

import { Avatar } from "@/components/Avatar";
import { BroadcastIcon, PlusIcon, SearchIcon, VideoIcon } from "@/components/icons";
import { formatTimestamp } from "@/lib/utils";

export interface HistoryEntry {
  id: string;
  type: "one_to_one" | "group" | "live";
  at: number;
}

const TYPE_LABELS: Record<HistoryEntry["type"], { title: (id: string) => string; subtitle: string; icon: "call" | "live" }> = {
  one_to_one: { title: (id) => `Call · ${id}`, subtitle: "One-on-one video call", icon: "call" },
  group:      { title: (id) => `Group call · ${id}`, subtitle: "Group video call", icon: "call" },
  live:       { title: (id) => `Live · ${id}`, subtitle: "Live broadcast", icon: "live" },
};

export function Sidebar({
  history,
  onSelect,
  onNewCall,
  mobileOpen = false,
  onMobileClose,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onNewCall: () => void;
  /** When true, renders as a full-height slide-in drawer (mobile). */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  if (mobileOpen) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/50 animate-fade-in md:hidden"
          onClick={onMobileClose}
        />
        <aside className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r border-[#CED0D4] bg-white shadow-2xl animate-panel-in md:hidden safe-top safe-bottom">
          <SidebarContent
            history={history}
            onSelect={onSelect}
            onNewCall={onNewCall}
            onClose={onMobileClose}
          />
        </aside>
      </>
    );
  }

  return (
    <aside className="hidden w-80 flex-col border-r border-[#CED0D4] bg-white md:flex">
      <SidebarContent history={history} onSelect={onSelect} onNewCall={onNewCall} />
    </aside>
  );
}

function SidebarContent({
  history,
  onSelect,
  onNewCall,
  onClose,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onNewCall: () => void;
  onClose?: () => void;
}) {
  const handleSelect = (entry: HistoryEntry) => {
    onSelect(entry);
    onClose?.();
  };
  return (
    <>
      {/* Search */}
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-full bg-[#F0F2F5] px-3 py-2">
          <SearchIcon size={16} className="text-[#65676B]" />
          <input
            placeholder="Search recent"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#65676B]"
          />
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-[13px] font-bold text-[#65676B]">RECENT ACTIVITY</span>
        <button
          onClick={onNewCall}
          className="flex items-center gap-1 text-[13px] font-semibold text-[#0084FF] hover:underline"
        >
          <PlusIcon size={14} /> New
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F3FF]">
              <VideoIcon size={26} className="text-[#0084FF]" />
            </div>
            <p className="text-sm font-semibold text-[#050505]">No activity yet</p>
            <p className="text-xs text-[#65676B]">
              Start a call or go live and it will show up here.
            </p>
          </div>
        ) : (
          history.map((entry) => {
            const meta = TYPE_LABELS[entry.type];
            const avatarLabel =
              entry.type === "live"
                ? `Live ${entry.id.slice(0, 3)}`
                : entry.type === "group"
                  ? `Group ${entry.id.slice(0, 3)}`
                  : entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => handleSelect(entry)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[#F0F2F5]"
              >
                <Avatar name={avatarLabel} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{meta.title(entry.id)}</p>
                  <p className="text-[13px] text-[#65676B]">
                    {meta.subtitle} · {formatTimestamp(entry.at)}
                  </p>
                </div>
                {meta.icon === "live" ? (
                  <BroadcastIcon size={18} className="shrink-0 text-[#F02849]" />
                ) : (
                  <VideoIcon size={18} className="shrink-0 text-[#0084FF]" />
                )}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
