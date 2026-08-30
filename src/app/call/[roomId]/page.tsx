"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/components/NameModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { HeaderBar } from "@/components/HeaderBar";
import { ControlBar } from "@/components/ControlBar";
import { VideoTile, PiPTile } from "@/components/VideoTile";
import { CallChatPanel } from "@/components/ChatPanel";
import { PeoplePanel } from "@/components/PeoplePanel";
import { LiveReactionOverlay } from "@/components/LiveReactions";
import { ToastContainer, addToast } from "@/components/ToastContainer";
import { useCallEngine } from "@/hooks/useCallEngine";
import { useMedia } from "@/hooks/useMedia";
import type { Participant, LiveReaction } from "@/lib/types";
import { beep, formatElapsed, useElapsed } from "@/lib/utils";
import { CloseIcon, CopyIcon, LinkIcon } from "@/components/icons";
import { CallAddons } from "@/components/CallAddons";

export default function CallPage({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter();
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

  return <CallRoom key={resolvedRoom} roomId={resolvedRoom} user={user} />;
}

function CallRoom({ roomId, user }: { roomId: string; user: Participant }) {
  const router = useRouter();
  const media = useMedia();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panel, setPanel] = useState<"none" | "chat" | "people">("none");
  const [copied, setCopied] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [virtualBg, setVirtualBg] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const elapsed = useElapsed();
  const containerRef = useRef<HTMLDivElement>(null);

  const engine = useCallEngine(roomId, user, media);
  const { participants, peers, messages, reactions: engineReactions, sendChat, sendReaction, sendHandRaise, leave } = engine;
  // sendSignal is an additive export not in the public CallEngine type
  const sendSignal = (engine as unknown as { sendSignal: (m: import("@/lib/types").SignalMessage) => void }).sendSignal;

  const others = participants.filter((p) => p.id !== user.id);
  const roomTitle =
    participants.length <= 2 && others.length === 1
      ? others[0].name
      : participants.length > 2
        ? `Group call (${participants.length})`
        : "Your call";

  // Merge engine reactions with local reactions
  const allReactions = [...engineReactions];

  /* join/leave chimes */
  const prevPeers = useRef(peers.length);
  useEffect(() => {
    if (peers.length > prevPeers.current) {
      beep(880, 0.18);
      const newPeer = peers[peers.length - 1];
      if (newPeer) addToast({ kind: "join", name: newPeer.name });
    }
    if (peers.length < prevPeers.current) {
      beep(440, 0.2, "triangle");
    }
    prevPeers.current = peers.length;
  }, [peers.length, peers]);

  /* chat chime */
  const prevMsgCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCount.current && panel !== "chat") beep(1320, 0.08, "square");
    prevMsgCount.current = messages.length;
  }, [messages.length, panel]);

  const unread = panel === "chat" ? 0 : Math.max(0, messages.length - prevMsgCount.current);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const endCall = useCallback(() => {
    leave();
    router.push("/");
  }, [leave, router]);

  // Hand raise
  const toggleHandRaise = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    sendHandRaise(next);
    addToast({
      kind: next ? "hand_raise" : "hand_lower",
      name: user.name,
    });
  }, [handRaised, sendHandRaise, user.name]);

  // Screen sharing
  const screenRef = useRef<RTCPeerConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSharingRef = useRef(false);

  const stopScreenShare = useCallback(() => {
    screenRef.current?.close();
    screenRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    screenSharingRef.current = false;
    setScreenSharing(false);
    addToast({ kind: "screen_stop", name: user.name });
  }, [user.name]);

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

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreenShare();
      });

      setScreenSharing(true);
      addToast({ kind: "screen_share", name: user.name });
    } catch {
      /* User cancelled */
    }
  }, [stopScreenShare, user.name]);

  // Virtual background
  const toggleVirtualBg = useCallback(() => {
    const next = !virtualBg;
    setVirtualBg(next);
    addToast({ kind: "virtual_bg", name: user.name });
  }, [virtualBg, user.name]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  // Recording (simulated)
  const toggleRecording = useCallback(() => {
    const next = !recording;
    setRecording(next);
    addToast({ kind: "recording", name: user.name });
  }, [recording, user.name]);

  // Emoji reaction
  const handleReaction = useCallback((emoji: string) => {
    sendReaction(emoji);
  }, [sendReaction]);

  /* ── Grid computation ── */
  const readyPeers = peers.filter((p) => p.stream);
  const waitingPeers = peers.filter((p) => !p.stream);
  const selfInGrid = !(readyPeers.length === 1 && waitingPeers.length === 0);
  const cellCount = readyPeers.length + waitingPeers.length + (selfInGrid ? 1 : 0);
  const gridCols =
    cellCount >= 5 ? "sm:grid-cols-3" : cellCount >= 2 ? "sm:grid-cols-2" : "";

  return (
    <div ref={containerRef} className="flex h-dscreen flex-col overflow-hidden bg-[#0F1115] text-white">
      <ToastContainer />

      {/* ── Header ── */}
      <HeaderBar
        title={roomTitle}
        subtitle={`${formatElapsed(elapsed)} · Code ${roomId}`}
        panel={panel}
        setPanel={setPanel}
        showPeople
        unreadChat={unread}
        onSettings={() => setSettingsOpen(true)}
        onCopy={copyLink}
        copied={copied}
        copyLabel="Copy link"
      />

      {/* ── Body ── */}
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 p-2 sm:p-4">
          <div
            className={`grid h-full w-full grid-cols-1 gap-2 overflow-y-auto auto-rows-[46dvh] pb-24 sm:auto-rows-fr sm:gap-3 sm:pb-0 ${gridCols}`}
          >
            {/* Remote video tiles */}
            {readyPeers.map((peer) => (
              <VideoTile
                key={peer.id}
                stream={peer.stream}
                label={peer.name}
                avatarName={peer.name}
                connecting={!peer.connected}
                handRaised={peer.handRaised}
                isScreenSharing={peer.isScreenSharing}
                virtualBg={peer.virtualBg}
                isRecording={peer.isRecording}
                quality={peer.quality}
                controllable
                peerId={peer.id}
              />
            ))}
            {waitingPeers.map((peer) => (
              <VideoTile
                key={peer.id}
                stream={peer.stream}
                label={peer.name}
                avatarName={peer.name}
                connecting
                handRaised={peer.handRaised}
              />
            ))}

            {/* Self tile: PiP in 1:1, grid cell in group */}
            {selfInGrid ? (
              <VideoTile
                stream={media.stream}
                label="You"
                avatarName={user.name}
                muted
                mirrored
                micOn={media.settings.micOn}
                virtualBg={virtualBg}
                isRecording={recording}
              />
            ) : (
              <PiPTile
                stream={media.stream}
                label="You"
                avatarName={user.name}
                muted
                mirrored
                micOn={media.settings.micOn}
                virtualBg={virtualBg}
                isRecording={recording}
              />
            )}

            {/* Empty-state */}
            {participants.length === 1 && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[#3A3B3C]">
                <LinkIcon size={36} className="text-[#4E4F50]" />
                <p className="max-w-xs text-center text-sm text-[#B0B3B8]">
                  You&apos;re the only one here. Share the link to start the call.
                </p>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 rounded-full bg-[#0084FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0073E6]"
                >
                  <CopyIcon size={16} /> Copy invite link
                </button>
              </div>
            )}
          </div>

          {/* Floating reactions */}
          <LiveReactionOverlay reactions={allReactions} />

          {/* ── Bottom controls ── */}
          <ControlBar
            media={media}
            mode="call"
            onEnd={endCall}
            onSettings={() => setSettingsOpen(true)}
            handRaised={handRaised}
            onHandRaise={toggleHandRaise}
            screenSharing={screenSharing}
            onScreenShare={toggleScreenShare}
            virtualBg={virtualBg}
            onVirtualBg={toggleVirtualBg}
            fullscreen={fullscreen}
            onFullscreen={toggleFullscreen}
            onReact={handleReaction}
            recording={recording}
            onRecording={toggleRecording}
          />
        </main>

        {/* ── Side panel ── */}
        {panel !== "none" && (
          <aside className="absolute inset-x-0 bottom-0 top-16 z-30 flex w-full shrink-0 flex-col border-t border-[#3A3B3C] bg-[#242526] animate-sheet-up safe-bottom sm:static sm:inset-auto sm:w-80 sm:animate-panel-in sm:border-t-0 sm:border-l">
            <div className="flex h-12 shrink-0 items-center justify-between bg-[#242526] px-4">
              <span className="text-sm font-bold">
                {panel === "chat" ? "In-call chat" : "People"}
              </span>
              <button
                onClick={() => setPanel("none")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#B0B3B8] hover:bg-[#3A3B3C]"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {panel === "chat" ? (
                <CallChatPanel messages={messages} user={user} onSend={sendChat} />
              ) : (
                <PeoplePanel participants={participants} user={user} />
              )}
            </div>
          </aside>
        )}
      </div>

      {settingsOpen && <SettingsPanel media={media} onClose={() => setSettingsOpen(false)} showFacingAndTorch />}

      {/* New: additive call addons (look/sound, polls, schedule, PiP) */}
      <CallAddons
        sendSignal={sendSignal}
        me={user}
        canCreatePolls={participants.length > 1}
        pipRef={{ current: null } as React.MutableRefObject<HTMLVideoElement | null>}
        replaceMicTrack={() => {}}
      />
    </div>
  );
}
