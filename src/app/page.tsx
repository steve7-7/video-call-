"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NameModal, getUser } from "@/components/NameModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { BroadcastTopicModal, type BroadcastTopic } from "@/components/BroadcastTopicModal";
import { Sidebar, type HistoryEntry } from "@/components/Sidebar";
import { Avatar } from "@/components/Avatar";
import { useMedia } from "@/hooks/useMedia";
import { makeRoomCode } from "@/lib/utils";
import {
  BroadcastIcon,
  CalendarIcon,
  ChatIcon,
  GearIcon,
  LinkIcon,
  LogoIcon,
  MenuIcon,
  MicIcon,
  VideoIcon,
} from "@/components/icons";
import { ScheduleModal } from "@/components/ScheduleModal";
import { ScheduledList } from "@/components/ScheduledList";
import { useScheduledCalls } from "@/hooks/useScheduledCalls";

const HISTORY_KEY = "calls:history";

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushHistory(entry: HistoryEntry) {
  const next = [entry, ...loadHistory().filter((h) => h.id !== entry.id)].slice(0, 15);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

/* ───── Settings launcher (re-mounts useMedia inside the modal) ───── */

/**
 * Mounted only while `open` is true (see call site), so the hook order stays
 * stable — `useMedia` must never sit behind an early return.
 */
function SettingsLauncher({ onClose }: { onClose: () => void }) {
  const media = useMedia();
  return <SettingsPanel media={media} onClose={onClose} title="Camera & microphone setup" showFacingAndTorch />;
}

/* ───────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(getUser);
  const [nameModal, setNameModal] = useState(!getUser());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [toast, setToast] = useState("");
  const [topicModal, setTopicModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scheduled = useScheduledCalls();

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const ensureUser = (): boolean => {
    if (!getUser()) {
      setNameModal(true);
      return false;
    }
    return true;
  };

  const createCall = (type: "one_to_one" | "group") => {
    if (!ensureUser()) return;
    const code = makeRoomCode();
    pushHistory({ id: code, type, at: Date.now() });
    router.push(`/call/${code}`);
  };

  const goLive = () => {
    if (!ensureUser()) return;
    setTopicModal(true);
  };

  const startLiveWithTopic = (topic: BroadcastTopic) => {
    const code = makeRoomCode();
    pushHistory({ id: code, type: "live", at: Date.now() });
    const params = new URLSearchParams({ role: "host", title: topic.title });
    if (topic.description) params.set("desc", topic.description);
    router.push(`/live/${code}?${params.toString()}`);
    setTopicModal(false);
  };

  const joinRoom = (type: "call" | "live") => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setToast(`Enter a valid room code to ${type === "live" ? "watch" : "join"}.`);
      setTimeout(() => setToast(""), 2500);
      return;
    }
    if (!ensureUser()) return;
    pushHistory({ id: code, type: type === "live" ? "live" : "group", at: Date.now() });
    router.push(type === "live" ? `/live/${code}?role=viewer` : `/call/${code}`);
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    router.push(entry.type === "live" ? `/live/${entry.id}?role=viewer` : `/call/${entry.id}`);
  };

  const handleScheduledJoin = (s: { roomId: string; type: "call" | "live" }) => {
    if (!s.roomId) {
      setToast("Open the schedule and add a room code to join.");
      setTimeout(() => setToast(""), 2500);
      return;
    }
    router.push(s.type === "live" ? `/live/${s.roomId}?role=viewer` : `/call/${s.roomId}`);
  };

  return (
    <div className="flex h-dscreen flex-col bg-[#F0F2F5] text-[#050505]">
      {/* ── Top bar ── */}
      <header className="flex h-14 items-center justify-between border-b border-[#CED0D4] bg-white px-4 safe-top">
        <div className="flex items-center gap-2.5">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4E6EB] text-[#050505] transition hover:bg-[#D8DADF] md:hidden"
            title="Recent activity"
          >
            <MenuIcon size={20} />
          </button>
          <LogoIcon size={32} />
          <span className="text-xl font-bold tracking-tight">VidCall</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4E6EB] text-[#050505] transition hover:bg-[#D8DADF]"
            title="Camera & microphone settings"
          >
            <GearIcon size={20} />
          </button>
          {user && <Avatar name={user.name} size={38} online />}
        </div>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          history={history}
          onSelect={handleHistorySelect}
          onNewCall={() => createCall("group")}
        />

        {/* Mobile drawer */}
        {sidebarOpen && (
          <Sidebar
            history={history}
            onSelect={handleHistorySelect}
            onNewCall={() => {
              setSidebarOpen(false);
              createCall("group");
            }}
            mobileOpen
            onMobileClose={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
          <div className="w-full max-w-lg">
            {/* Hero card */}
            <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.1)] sm:p-8">
              <div className="mb-6 flex flex-col items-center gap-3 text-center">
                <LogoIcon size={64} />
                <h1 className="text-2xl font-bold tracking-tight">
                  Video calls &amp; live broadcasts
                </h1>
                <p className="text-sm text-[#65676B]">
                  One-on-one calls, group calls, and Go Live streams.
                  Share a link — no account needed.
                </p>
              </div>

              {/* ── Action buttons ── */}
              <div className="space-y-3">
                <button
                  onClick={() => createCall("one_to_one")}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0084FF] py-3 font-semibold text-white transition hover:bg-[#0073E6] active:scale-[0.99]"
                >
                  <VideoIcon size={18} />
                  New one-on-one call
                </button>
                <button
                  onClick={() => createCall("group")}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#CED0D4] bg-white py-3 font-semibold text-[#050505] transition hover:bg-[#F0F2F5] active:scale-[0.99]"
                >
                  <VideoIcon size={18} className="text-[#0084FF]" />
                  New group call
                </button>
                <button
                  onClick={goLive}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F02849] to-[#FA3E4E] py-3 font-semibold text-white shadow-md transition hover:opacity-95 active:scale-[0.99]"
                >
                  <BroadcastIcon size={18} />
                  Go Live · broadcast to viewers
                </button>
              </div>

              {/* ── New: schedule a call ── */}
              <button
                onClick={() => setScheduleOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#CED0D4] py-2.5 text-sm font-semibold text-[#65676B] transition hover:border-[#0084FF] hover:text-[#0084FF]"
              >
                <CalendarIcon size={15} />
                Schedule a call for later
              </button>

              {/* ── Join with code ── */}
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#CED0D4]" />
                <span className="text-xs font-bold text-[#65676B]">JOIN WITH A CODE</span>
                <span className="h-px flex-1 bg-[#CED0D4]" />
              </div>

              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <div className="flex min-w-0 flex-1 basis-full items-center gap-2 rounded-full border border-[#CED0D4] bg-[#F0F2F5] px-4 sm:basis-auto">
                  <LinkIcon size={16} className="shrink-0 text-[#65676B]" />
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CALL OR LIVE CODE"
                    maxLength={10}
                    className="w-full bg-transparent py-3 text-sm font-semibold tracking-widest outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-[#65676B]"
                  />
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <button
                    onClick={() => joinRoom("call")}
                    className="flex-1 rounded-full bg-[#E7F3FF] px-4 py-3 font-semibold text-[#0084FF] transition hover:bg-[#D4E9FF] sm:flex-none sm:px-5"
                    title="Join a call"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => joinRoom("live")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#FDE2E4] px-4 py-3 font-semibold text-[#F02849] transition hover:bg-[#FAC9CC] sm:flex-none"
                    title="Watch a live broadcast"
                  >
                    <BroadcastIcon size={16} /> Watch
                  </button>
                </div>
              </div>
            </div>

            {/* ── New: scheduled-calls preview ── */}
            {scheduled.items.length > 0 && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#050505]">Upcoming</h2>
                  <span className="text-xs text-[#65676B]">{scheduled.items.length}</span>
                </div>
                <ScheduledList
                  items={scheduled.items}
                  onRemove={scheduled.remove}
                  onJoin={handleScheduledJoin}
                />
              </div>
            )}

            {/* ── Footer badges ── */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-2 text-[13px] text-[#65676B]">
              <span className="flex items-center gap-1.5">
                <MicIcon size={14} /> Mic & camera settings
              </span>
              <span className="flex items-center gap-1.5">
                <ChatIcon size={14} /> In-call chat
              </span>
              <span className="flex items-center gap-1.5">
                <BroadcastIcon size={14} /> Live reactions
              </span>
            </div>

            {/* ── Toast ── */}
            {toast && (
              <div className="mt-4 rounded-xl bg-[#1B1F24] px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
                {toast}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      {settingsOpen && <SettingsLauncher onClose={() => setSettingsOpen(false)} />}
      <NameModal
        open={nameModal}
        onDone={(u) => {
          setUser(u);
          setNameModal(false);
        }}
      />
      <BroadcastTopicModal
        open={topicModal}
        onCancel={() => setTopicModal(false)}
        onStart={startLiveWithTopic}
      />
      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSchedule={scheduled.add}
      />
    </div>
  );
}
