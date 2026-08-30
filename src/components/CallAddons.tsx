"use client";

/**
 * Additive component: bridges all new features into the call page without
 * touching the existing engine/page code. It opens as floating side panels
 * (polls, scheduled) and a "Look & Sound" modal — driven entirely by local
 * state. The page passes a ref of the remote <video> element for PiP.
 */
import { useEffect, useRef, useState } from "react";
import { usePiP } from "@/hooks/usePiP";
import { useNoiseSuppression } from "@/hooks/useNoiseSuppression";
import { useVideoFilter } from "@/hooks/useVideoFilter";
import { usePolls } from "@/hooks/usePolls";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { PollPanel } from "@/components/PollPanel";
import {
  CalendarIcon,
  PipIcon,
  PollIcon,
  SparkleIcon,
  CloseIcon,
} from "@/components/icons";
import type { Participant, SignalMessage } from "@/lib/types";
import type { ScheduledCall } from "@/hooks/useScheduledCalls";
import { ScheduledList } from "@/components/ScheduledList";
import { ScheduleModal } from "@/components/ScheduleModal";
import { useScheduledCalls } from "@/hooks/useScheduledCalls";
import { useRouter } from "next/navigation";

export function CallAddons(props: {
  /** Function that pushes a raw SignalMessage to the room channel. */
  sendSignal: (m: SignalMessage) => void;
  /** Local user info (needed for poll/raise attribution). */
  me: Participant;
  /** Whether the local user can create polls. */
  canCreatePolls: boolean;
  /** Reference to the most-recently clicked remote <video>. */
  pipRef: React.MutableRefObject<HTMLVideoElement | null>;
  /** Function that swaps the mic track for one with noise suppression applied. */
  replaceMicTrack: (s: MediaStream) => void;
}) {
  const { sendSignal, me, canCreatePolls, pipRef, replaceMicTrack } = props;
  const [panel, setPanel] = useState<"none" | "polls" | "schedule">("none");
  const [lookOpen, setLookOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const pip = usePiP();
  const filter = useVideoFilter();
  const noise = useNoiseSuppression();
  const polls = usePolls(sendSignal);
  const scheduled = useScheduledCalls();
  const router = useRouter();
  const bgAppliedRef = useRef<string>("none");
  const filterAppliedRef = useRef<string>("none");

  // Listen for poll/breakout messages from the channel.
  useEffect(() => {
    // usePolls doesn't auto-receive — we expose a subscribe via a window event
    // the call page can fire when it sees a poll_create/vote/close message.
    const onPoll = (e: Event) => {
      const detail = (e as CustomEvent).detail as SignalMessage;
      if (!detail) return;
      if (detail.type === "poll_create") {
        polls.upsert(detail.poll);
      } else if (detail.type === "poll_vote") {
        const poll = polls.polls.find((p) => p.id === detail.pollId);
        if (poll) {
          const cleaned = {
            ...poll,
            options: poll.options.map((o) => ({
              ...o,
              voters: o.voters.filter((v) => v !== detail.from),
            })),
          };
          const updated = {
            ...cleaned,
            options: cleaned.options.map((o) =>
              o.id === detail.optionId
                ? { ...o, voters: [...o.voters, detail.from] }
                : o
            ),
          };
          polls.upsert(updated);
        }
      } else if (detail.type === "poll_close") {
        const poll = polls.polls.find((p) => p.id === detail.pollId);
        if (poll) polls.upsert({ ...poll, closed: true });
      }
    };
    window.addEventListener("vidcall:signal-poll", onPoll as EventListener);
    return () => window.removeEventListener("vidcall:signal-poll", onPoll as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply noise suppression when toggled
  useEffect(() => {
    let active = true;
    if (noise.enabled) {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true, video: false })
        .then(async (s) => {
          if (!active) return;
          const out = await noise.attach(s);
          if (out && active) replaceMicTrack(out);
        })
        .catch(() => {});
    } else {
      // restore unprocessed audio
      navigator.mediaDevices
        ?.getUserMedia({ audio: true, video: false })
        .then((s) => {
          if (active) replaceMicTrack(s);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noise.enabled]);

  const bgId = bgAppliedRef.current;
  const filterId = filterAppliedRef.current;

  return (
    <>
      {/* Floating buttons row at the right edge */}
      <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex flex-col gap-2 safe-top">
        <AddonButton
          title="Look & Sound"
          onClick={() => setLookOpen(true)}
          active={lookOpen}
        >
          <SparkleIcon size={18} />
        </AddonButton>
        <AddonButton
          title="Polls"
          onClick={() => setPanel(panel === "polls" ? "none" : "polls")}
          active={panel === "polls"}
        >
          <PollIcon size={18} />
        </AddonButton>
        <AddonButton
          title="Picture-in-picture"
          onClick={() => pip.toggle(pipRef.current)}
          active={pip.isPip}
        >
          <PipIcon size={18} />
        </AddonButton>
        <AddonButton
          title="Schedule"
          onClick={() => setPanel(panel === "schedule" ? "none" : "schedule")}
          active={panel === "schedule"}
        >
          <CalendarIcon size={18} />
        </AddonButton>
      </div>

      {/* Look & Sound modal */}
      {lookOpen && (
        <BackgroundPicker
          filter={filterId as "none" | "bw" | "sepia" | "cool" | "warm"}
          background={bgId}
          onFilterChange={(id) => {
            filterAppliedRef.current = id;
            filter.setFilter(id);
          }}
          onBackgroundChange={(id) => {
            bgAppliedRef.current = id;
          }}
          onClose={() => setLookOpen(false)}
          noiseSuppression={noise.enabled}
          onNoiseSuppressionChange={(v) => noise.setEnabled(v)}
        />
      )}

      {/* Side panel: polls / schedule */}
      {panel !== "none" && (
        <div className="absolute right-0 top-16 z-30 flex h-[calc(100dvh-4rem)] w-full max-w-sm flex-col border-l border-[#3A3B3C] bg-[#242526] animate-panel-in sm:w-80">
          {panel === "polls" ? (
            <PollPanel
              polls={polls.polls}
              myId={me.id}
              canCreate={canCreatePolls}
              onCreate={(q, opts) => polls.createPoll(q, opts)}
              onVote={(pollId, optionId) => polls.vote(pollId, optionId, me.id)}
              onClosePoll={(id) => polls.closePoll(id)}
              onHide={() => setPanel("none")}
            />
          ) : (
            <SchedulePanel
              items={scheduled.items}
              onRemove={scheduled.remove}
              onJoin={(s) => {
                if (s.roomId) {
                  router.push(s.type === "live" ? `/live/${s.roomId}?role=viewer` : `/call/${s.roomId}`);
                } else {
                  setScheduleOpen(true);
                }
              }}
              onCreate={() => setScheduleOpen(true)}
              onHide={() => setPanel("none")}
            />
          )}
        </div>
      )}

      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSchedule={scheduled.add}
      />
    </>
  );
}

function AddonButton({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition shadow-md ${
        active
          ? "bg-[#0084FF] text-white"
          : "bg-[#1B1F24] text-white hover:bg-[#2A2E34]"
      }`}
    >
      {children}
    </button>
  );
}

function SchedulePanel({
  items,
  onRemove,
  onJoin,
  onCreate,
  onHide,
}: {
  items: ScheduledCall[];
  onRemove: (id: string) => void;
  onJoin: (s: ScheduledCall) => void;
  onCreate: () => void;
  onHide: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#242526]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#3A3B3C] px-4">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <CalendarIcon size={16} />
          Scheduled
        </span>
        <button
          onClick={onHide}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#B0B3B8] hover:bg-[#3A3B3C]"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-4xl">📅</p>
            <p className="text-sm font-semibold text-white">Nothing scheduled</p>
            <p className="text-xs text-[#B0B3B8]">
              Plan a call and we&apos;ll remind you when it&apos;s time.
            </p>
          </div>
        ) : (
          <ScheduledList items={items} onRemove={onRemove} onJoin={onJoin} />
        )}
      </div>
      <div className="border-t border-[#3A3B3C] p-3">
        <button
          onClick={onCreate}
          className="w-full rounded-full bg-[#0084FF] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0073E6]"
        >
          + New scheduled call
        </button>
      </div>
    </div>
  );
}
