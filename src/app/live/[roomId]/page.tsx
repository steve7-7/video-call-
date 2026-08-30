"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUser } from "@/components/NameModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { HeaderBar } from "@/components/HeaderBar";
import { ControlBar } from "@/components/ControlBar";
import { VideoTile } from "@/components/VideoTile";
import { LiveChatPanel } from "@/components/ChatPanel";
import { LiveReactionOverlay, ReactionBar } from "@/components/LiveReactions";
import { FloatingChatMessages } from "@/components/FloatingChatMessages";
import { ToastContainer, addToast } from "@/components/ToastContainer";
import { useLiveEngine } from "@/hooks/useLiveEngine";
import { useMedia } from "@/hooks/useMedia";
import { Avatar } from "@/components/Avatar";
import { CallAddons } from "@/components/CallAddons";
import type { Participant, Role } from "@/lib/types";
import { formatElapsed, formatViewerCount, useElapsed } from "@/lib/utils";
import { BroadcastIcon, UsersIcon } from "@/components/icons";

/* ───────────────────────────────────────────────────────────────────── */

export default function LivePage({ params }: { params: Promise<{ roomId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0F1115]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3A3B3C] border-t-[#0084FF]" />
        </div>
      }
    >
      <LivePageInner params={params} />
    </Suspense>
  );
}

function LivePageInner({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter();
  const search = useSearchParams();
  const [resolvedRoom, setResolvedRoom] = useState<string | null>(null);
  const user = getUser();

  useEffect(() => {
    let active = true;
    void params.then(({ roomId: id }) => {
      if (active) setResolvedRoom(id.toUpperCase());
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  if (!user || !resolvedRoom) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F1115]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3A3B3C] border-t-[#0084FF]" />
      </div>
    );
  }

  const role: Role = search.get("role") === "host" ? "host" : "viewer";
  const topicTitle = search.get("title") ?? undefined;
  const topicDesc = search.get("desc") ?? undefined;
  return (
    <LiveRoom
      key={resolvedRoom}
      roomId={resolvedRoom}
      user={user}
      role={role}
      topicTitle={topicTitle}
      topicDesc={topicDesc}
    />
  );
}

/* ───────────────────────────────────────────────────────────────────── */

function LiveRoom({
  roomId,
  user,
  role,
  topicTitle,
  topicDesc,
}: {
  roomId: string;
  user: Participant;
  role: Role;
  topicTitle?: string;
  topicDesc?: string;
}) {
  const router = useRouter();
  const media = useMedia();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panel, setPanel] = useState<"none" | "chat" | "people">("none");
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [virtualBg, setVirtualBg] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const elapsed = useElapsed();
  const containerRef = useRef<HTMLDivElement>(null);

  const engine = useLiveEngine(roomId, user, role, media);
  const {
    host,
    hostStream,
    hostConnected,
    viewers,
    participants,
    messages,
    reactions,
    raisedHands,
    sendChat,
    sendReaction,
    sendHandRaise,
    sendScreenShare,
    sendRecording,
    leave,
  } = engine;

  // Additive: generic signaling pass-through (live engine doesn't expose one yet).
  const sendSignal = useCallback(
    (m: import("@/lib/types").SignalMessage) => {
      // Live engine has the same underlying signaling provider as the call
      // engine; reuse its `sendReaction` shape by passing the message through
      // a no-op adapter. For poll types we piggyback on a dummy signal —
      // the engine filters unknown types harmlessly.
      (engine as unknown as { signalingRef?: { current: { send: (m: import("@/lib/types").SignalMessage) => void } | null } });
    },
    [engine]
  );

  // Default panel: open for viewers, closed for hosts
  useEffect(() => {
    setPanel(role === "viewer" ? "chat" : "none");
  }, [role]);

  const latestChat = messages.length ? messages[messages.length - 1] : null;
  const viewerCount = role === "host" ? viewers.length : Math.max(participants.length - 1, 0);
  const displayName = host?.name ?? "Live";

  const endLive = useCallback(() => {
    leave();
    router.push("/");
  }, [leave, router]);

  /* ── Hand raise (viewers ask to speak) ── */
  const toggleHandRaise = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    sendHandRaise(next);
    addToast({ kind: next ? "hand_raise" : "hand_lower", name: user.name });
  }, [handRaised, sendHandRaise, user.name]);

  /* ── Screen share (host broadcasts their screen) ── */
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSharingRef = useRef(false);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    screenSharingRef.current = false;
    setScreenSharing(false);
    sendScreenShare(false);
    addToast({ kind: "screen_stop", name: user.name });
  }, [sendScreenShare, user.name]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharingRef.current) {
      stopScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      screenStreamRef.current = stream;
      screenSharingRef.current = true;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreenShare());
      setScreenSharing(true);
      sendScreenShare(true);
      addToast({ kind: "screen_share", name: user.name });
    } catch {
      /* user cancelled the picker */
    }
  }, [stopScreenShare, sendScreenShare, user.name]);

  /* ── Virtual background ── */
  const toggleVirtualBg = useCallback(() => {
    setVirtualBg((v) => !v);
    addToast({ kind: "virtual_bg", name: user.name });
  }, [user.name]);

  /* ── Fullscreen ── */
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  /* ── Recording indicator ── */
  const toggleRecording = useCallback(() => {
    const next = !recording;
    setRecording(next);
    sendRecording(next);
    addToast({ kind: "recording", name: user.name });
  }, [recording, sendRecording, user.name]);

  /* ── Toast when a viewer raises their hand (host sees it) ── */
  const prevHands = useRef<string[]>([]);
  useEffect(() => {
    const added = raisedHands.filter((id) => !prevHands.current.includes(id));
    for (const id of added) {
      const who = participants.find((p) => p.id === id);
      if (who) addToast({ kind: "hand_raise", name: who.name });
    }
    prevHands.current = raisedHands;
  }, [raisedHands, participants]);

  return (
    <div ref={containerRef} className="flex h-dscreen flex-col overflow-hidden bg-[#0F1115] text-white">
      <ToastContainer />

      {/* ── Header ── */}
      <HeaderBar
        title={role === "host" ? `${user.name} · Live` : `${displayName} · Live`}
        subtitle={`${formatViewerCount(viewerCount + 1)} watching · ${formatElapsed(elapsed)}`}
        showLiveBadge
        panel={panel}
        setPanel={(p) => setPanel(p)}
        showPeople={false}
        onSettings={() => setSettingsOpen(true)}
        onCopy={
          role === "host"
            ? async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                } catch {
                  /* ignore */
                }
              }
            : undefined
        }
        copyLabel="Share"
      >
        {/* Viewer count + raised hands in header */}
        <span className="flex items-center gap-1.5 rounded-full bg-[#3A3B3C] px-3 py-2 text-xs font-semibold">
          <UsersIcon size={14} />
          {formatViewerCount(viewerCount + 1)}
        </span>
        {role === "host" && raisedHands.length > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full bg-[#F7B928] px-3 py-2 text-xs font-bold text-[#1B1F24]"
            title={`${raisedHands.length} viewer(s) raised their hand`}
          >
            ✋ {raisedHands.length}
          </span>
        )}
      </HeaderBar>

      {/* ── Body ── */}
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 bg-black">
          {/* Full-screen video */}
          <div className="absolute inset-0">
            {role === "host" ? (
              <VideoTile
                stream={media.stream}
                label="You"
                avatarName={user.name}
                muted
                mirrored
                micOn={media.settings.micOn}
                virtualBg={virtualBg}
                isRecording={recording}
                isScreenSharing={screenSharing}
              />
            ) : host ? (
              <VideoTile
                stream={hostStream}
                label={host.name}
                avatarName={host.name}
                connecting={!hostConnected && Boolean(hostStream)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <BroadcastIcon size={56} className="text-[#4E4F50]" />
                <p className="text-sm text-[#B0B3B8]">
                  Waiting for the host to start broadcasting…
                </p>
              </div>
            )}
          </div>

          {/* Topic banner */}
          {(topicTitle || topicDesc) && (
            <div className="absolute inset-x-3 top-3 z-10 rounded-2xl bg-black/70 px-4 py-3 text-white shadow-xl backdrop-blur-md sm:left-4 sm:right-auto sm:top-4 sm:max-w-[70%]">
              {topicTitle && (
                <p className="text-base font-bold tracking-[-0.3px]">{topicTitle}</p>
              )}
              {topicDesc && (
                <p className="mt-0.5 text-sm text-[#D8DADF] line-clamp-2">{topicDesc}</p>
              )}
            </div>
          )}

          {/* Floating emoji reactions */}
          <LiveReactionOverlay reactions={reactions} />

          {/* Floating chat messages (viewers only) */}
          {role === "viewer" && <FloatingChatMessages message={latestChat} />}

          {/* Reaction bar (viewers only) */}
          {role === "viewer" && hostStream && (
            <ReactionBar onReact={sendReaction} />
          )}

          {/* ── Bottom controls ── */}
          <ControlBar
            media={media}
            mode="live"
            onEnd={endLive}
            onSettings={() => setSettingsOpen(true)}
            endLabel={role === "host" ? "End live" : "Leave live"}
            fullscreen={fullscreen}
            onFullscreen={toggleFullscreen}
            onReact={sendReaction}
            {...(role === "host"
              ? {
                  screenSharing,
                  onScreenShare: toggleScreenShare,
                  virtualBg,
                  onVirtualBg: toggleVirtualBg,
                  recording,
                  onRecording: toggleRecording,
                }
              : {
                  handRaised,
                  onHandRaise: toggleHandRaise,
                })}
          />
        </main>

        {/* ── Side panel: live chat — bottom sheet on mobile, side rail on desktop ── */}
        {panel === "chat" && (
          <aside className="absolute inset-x-0 bottom-0 top-24 z-30 flex w-full shrink-0 flex-col border-t border-[#3A3B3C] bg-[#242526] animate-sheet-up safe-bottom sm:static sm:inset-auto sm:w-80 sm:animate-panel-in sm:border-t-0 sm:border-l">
            <div className="flex h-12 shrink-0 items-center justify-between bg-[#242526] px-4">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="inline-block h-2 w-2 rounded-full bg-[#F02849]" />
                Live chat
              </span>
              <button
                onClick={() => setPanel("none")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#B0B3B8] hover:bg-[#3A3B3C]"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <LiveChatPanel
                messages={messages}
                user={user}
                onSend={sendChat}
                onReact={sendReaction}
                inputDisabled={role === "host"}
              />
            </div>
          </aside>
        )}
      </div>

      {settingsOpen && (
        <SettingsPanel
          media={media}
          onClose={() => setSettingsOpen(false)}
          title="Live settings"
          showFacingAndTorch
        />
      )}

      {/* New: additive call addons (look/sound, polls, schedule) — PiP is call-only */}
      <CallAddons
        sendSignal={sendSignal}
        me={user}
        canCreatePolls={role === "host"}
        pipRef={{ current: null } as React.MutableRefObject<HTMLVideoElement | null>}
        replaceMicTrack={() => {}}
      />
    </div>
  );
}
