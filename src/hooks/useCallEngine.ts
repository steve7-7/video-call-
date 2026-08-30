"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, LiveReaction, Participant, Signaling, SignalMessage } from "@/lib/types";
import { createSignaling } from "@/lib/signaling";
import type { MediaController } from "@/hooks/useMedia";

export interface RemotePeer {
  id: string;
  name: string;
  stream: MediaStream | null;
  connected: boolean;
  lastSeen: number;
  handRaised: boolean;
  isScreenSharing: boolean;
  virtualBg: boolean;
  isRecording: boolean;
  /** 0..1 connection quality */
  quality: number;
}

export interface CallEngine {
  participants: Participant[];
  peers: RemotePeer[];
  messages: ChatMessage[];
  reactions: LiveReaction[];
  connected: boolean;
  providerKind: "supabase" | "local";
  sendChat: (body: string) => void;
  sendReaction: (emoji: string) => void;
  sendHandRaise: (raised: boolean) => void;
  leave: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

let idCounter = 0;
const uid = () => `m-${Date.now()}-${idCounter++}`;

export function useCallEngine(
  roomId: string,
  user: Participant,
  media: MediaController
): CallEngine {
  const [participants, setParticipants] = useState<Participant[]>([user]);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [connected, setConnected] = useState(false);
  const [providerKind, setProviderKind] = useState<"supabase" | "local">("local");

  const peersRef = useRef(new Map<string, RemotePeer>());
  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const participantsRef = useRef<Participant[]>([user]);
  const signalingRef = useRef<Signaling | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const userRef = useRef(user);

  const getPeer = useCallback((id: string): RemotePeer | undefined => {
    return peersRef.current.get(id);
  }, []);

  const upsertPeer = useCallback((id: string, name: string, patch?: Partial<RemotePeer>) => {
    const existing = peersRef.current.get(id);
    const defaults = { handRaised: false, isScreenSharing: false, virtualBg: false, isRecording: false, quality: 0 };
    const next: RemotePeer = existing
      ? { ...existing, ...patch }
      : { id, name, stream: null, connected: false, lastSeen: Date.now(), ...defaults, ...patch };
    if (!existing && patch) next.lastSeen = Date.now();
    peersRef.current.set(id, next);
    setPeers(Array.from(peersRef.current.values()));
  }, []);

  const ensurePeer = useCallback((id: string, name: string) => {
    if (!peersRef.current.has(id)) upsertPeer(id, name);
  }, [upsertPeer]);

  /* ---------------- RTCPeerConnection plumbing ---------------- */

  const attachTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = mediaRef.current.stream;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
  }, []);

  const replaceTracksOnPeers = useCallback(() => {
    const stream = mediaRef.current.stream;
    if (!stream) return;
    for (const pc of pcsRef.current.values()) {
      for (const track of stream.getTracks()) {
        const sender = pc
          .getSenders()
          .find((s) => s.track?.kind === track.kind);
        if (sender) void sender.replaceTrack(track).catch(() => {});
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, name: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcsRef.current.set(peerId, pc);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        signalingRef.current?.send({
          type: "ice",
          from: userRef.current.id,
          to: peerId,
          candidate: e.candidate.toJSON(),
          ts: Date.now(),
        });
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        const existing = getPeer(peerId);
        upsertPeer(peerId, existing?.name ?? name, { stream, connected: true });
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          upsertPeer(peerId, name, { connected: true });
        } else if (state === "failed" || state === "closed") {
          upsertPeer(peerId, name, { connected: false });
        }
      };

      attachTracks(pc);
      return pc;
    },
    [attachTracks, getPeer, upsertPeer]
  );

  const flushIce = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    const queue = pendingIceRef.current.get(peerId) ?? [];
    pendingIceRef.current.delete(peerId);
    if (!pc || pc.remoteDescription === null) return;
    for (const candidate of queue) {
      void pc.addIceCandidate(candidate).catch((err) => console.warn("ice add failed", err));
    }
  }, []);

  const maybeOffer = useCallback(
    (peerId: string, name: string) => {
      // Deterministic initiator: the participant with the larger id offers.
      if (peerId < userRef.current.id) return;
      const existing = pcsRef.current.get(peerId);
      if (existing) {
        const st = existing.connectionState;
        if (st === "connected" || st === "connecting" || st === "new") return;
      }
      const pc = existing ?? createPeerConnection(peerId, name);
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          signalingRef.current?.send({
            type: "offer",
            from: userRef.current.id,
            to: peerId,
            sdp: pc.localDescription!,
            ts: Date.now(),
          });
        })
        .catch((err) => console.warn("offer failed", err));
    },
    [createPeerConnection]
  );

  const removePeer = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcsRef.current.delete(peerId);
    }
    pendingIceRef.current.delete(peerId);
    peersRef.current.delete(peerId);
    setPeers(Array.from(peersRef.current.values()));
    setParticipants((prev) => prev.filter((p) => p.id !== peerId));
    participantsRef.current = participantsRef.current.filter((p) => p.id !== peerId);
  }, []);

  const handleMessage = useCallback(
    (msg: SignalMessage) => {
      const myId = userRef.current.id;
      const now = Date.now();

      switch (msg.type) {
        case "hello": {
          ensurePeer(msg.from, msg.name);
          upsertPeer(msg.from, msg.name, { lastSeen: now });
          // Respond with presence so the newcomer knows who is here.
          signalingRef.current?.send({
            type: "presence",
            from: myId,
            participants: participantsRef.current,
            role: "viewer",
            ts: now,
          });
          if (mediaRef.current.stream) maybeOffer(msg.from, msg.name);
          break;
        }
        case "presence": {
          const others = msg.participants.filter((p) => p.id !== myId);
          if (others.length > 0) {
            const next = Array.from(
              new Map([...participantsRef.current, ...others].map((p) => [p.id, p])).values()
            );
            participantsRef.current = next;
            setParticipants(next);
            for (const p of others) {
              ensurePeer(p.id, p.name);
              upsertPeer(p.id, p.name, { lastSeen: now });
              if (mediaRef.current.stream) maybeOffer(p.id, p.name);
            }
          }
          break;
        }
        case "offer": {
          if (msg.to !== myId) break;
          ensurePeer(msg.from, msg.name ?? "Guest");
          let pc = pcsRef.current.get(msg.from);
          if (!pc) pc = createPeerConnection(msg.from, msg.name ?? "Guest");
          void pc
            .setRemoteDescription(msg.sdp)
            .then(() => flushIce(msg.from))
            .then(() => pc!.createAnswer())
            .then((answer) => pc!.setLocalDescription(answer))
            .then(() => {
              signalingRef.current?.send({
                type: "answer",
                from: myId,
                to: msg.from,
                sdp: pc!.localDescription!,
                ts: Date.now(),
              });
            })
            .catch((err) => console.warn("answer failed", err));
          break;
        }
        case "answer": {
          if (msg.to !== myId) break;
          const pc = pcsRef.current.get(msg.from);
          if (!pc) break;
          void pc.setRemoteDescription(msg.sdp).then(() => flushIce(msg.from)).catch((err) =>
            console.warn("setRemote failed", err)
          );
          break;
        }
        case "ice": {
          if (msg.to !== myId) break;
          const pc = pcsRef.current.get(msg.from);
          if (!pc) break;
          if (pc.remoteDescription === null) {
            const queue = pendingIceRef.current.get(msg.from) ?? [];
            queue.push(msg.candidate);
            pendingIceRef.current.set(msg.from, queue);
          } else {
            void pc.addIceCandidate(msg.candidate).catch((err) => console.warn("ice failed", err));
          }
          break;
        }
        case "chat": {
          setMessages((prev) => [...prev.slice(-199), {
            id: msg.msgId,
            from: msg.from,
            name: msg.name,
            body: msg.body,
            ts: msg.ts,
          }]);
          break;
        }
        case "leave": {
          removePeer(msg.from);
          break;
        }
        case "ping": {
          if (peersRef.current.has(msg.from)) {
            upsertPeer(msg.from, peersRef.current.get(msg.from)!.name, { lastSeen: now });
          }
          break;
        }
        case "reaction": {
          const lane = Math.random();
          const r: LiveReaction = { id: msg.msgId, emoji: msg.emoji, lane, createdAt: msg.ts };
          setReactions((prev) => [...prev.slice(-79), r]);
          setTimeout(() => setReactions((prev) => prev.filter((x) => x.id !== msg.msgId)), 4000);
          break;
        }
        case "hand_raise": {
          const peer = peersRef.current.get(msg.from);
          if (peer) upsertPeer(msg.from, peer.name, { handRaised: msg.raised });
          break;
        }
        case "screen_share": {
          if (msg.to !== myId) break;
          ensurePeer(msg.from, msg.name ?? "Guest");
          upsertPeer(msg.from, msg.name ?? "Guest", { isScreenSharing: true });
          // Accept screen share offer
          const pc = pcsRef.current.get(msg.from);
          if (pc) {
            void pc.setRemoteDescription(msg.sdp).then(() => flushIce(msg.from))
              .then(() => pc!.createAnswer())
              .then((answer) => pc!.setLocalDescription(answer))
              .then(() => {
                signalingRef.current?.send({
                  type: "screen_answer",
                  from: myId,
                  to: msg.from,
                  sdp: pc!.localDescription!,
                  ts: Date.now(),
                });
              });
          }
          break;
        }
        case "screen_answer": {
          // Handled by screen sharing logic
          break;
        }
        case "screen_stop": {
          const peer2 = peersRef.current.get(msg.from);
          if (peer2) upsertPeer(msg.from, peer2.name, { isScreenSharing: false });
          break;
        }
        case "screen_ice": {
          if (msg.to !== myId) break;
          const pc2 = pcsRef.current.get(msg.from);
          if (!pc2) break;
          void pc2.addIceCandidate(msg.candidate).catch(() => {});
          break;
        }
        case "virtual_bg": {
          const peer3 = peersRef.current.get(msg.from);
          if (peer3) upsertPeer(msg.from, peer3.name, { virtualBg: msg.enabled });
          break;
        }
        case "recording": {
          const peer4 = peersRef.current.get(msg.from);
          if (peer4) upsertPeer(msg.from, peer4.name, { isRecording: msg.enabled });
          break;
        }
      }
    },
    [createPeerConnection, ensurePeer, flushIce, maybeOffer, upsertPeer, removePeer]
  );

  const onPresence = useCallback(
    (list: Participant[]) => {
      const others = list.filter((p) => p.id !== userRef.current.id);
      const next = Array.from(
        new Map([...participantsRef.current, ...others].map((p) => [p.id, p])).values()
      );
      participantsRef.current = next;
      setParticipants(next);
      for (const p of others) {
        ensurePeer(p.id, p.name);
        upsertPeer(p.id, p.name, { lastSeen: Date.now() });
        if (mediaRef.current.stream) maybeOffer(p.id, p.name);
      }
      // Clean up peers that left (Supabase mode).
      const liveIds = new Set(list.map((p) => p.id));
      for (const id of Array.from(peersRef.current.keys())) {
        if (!liveIds.has(id)) removePeer(id);
      }
    },
    [ensurePeer, maybeOffer, removePeer, upsertPeer]
  );

  /* ---------------- lifecycle ---------------- */

  useEffect(() => {
    const sig = createSignaling(roomId, user);
    signalingRef.current = sig;
    setProviderKind(sig.kind);
    sig.onMessage(handleMessage);
    sig.onPresence(onPresence);
    sig.connect();

    const heartbeat = setInterval(() => {
      sig.send({ type: "ping", from: user.id, ts: Date.now() });
    }, 8000);

    // Stale-peer cleanup (local provider mode).
    const staleTimer = setInterval(() => {
      if (sig.kind !== "local") return;
      const cutoff = Date.now() - 45_000;
      for (const peer of peersRef.current.values()) {
        if (peer.lastSeen < cutoff) {
          removePeer(peer.id);
          participantsRef.current = participantsRef.current.filter((p) => p.id !== peer.id);
          setParticipants([...participantsRef.current]);
        }
      }
    }, 10_000);

    const onUnload = () => {
      sig.send({ type: "leave", from: user.id, name: user.name, ts: Date.now() });
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onUnload);

    const readyTimer = setTimeout(() => setConnected(true), 2500);

    return () => {
      clearInterval(heartbeat);
      clearInterval(staleTimer);
      clearTimeout(readyTimer);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onUnload);
      sig.send({ type: "leave", from: user.id, name: user.name, ts: Date.now() });
      sig.disconnect();
      for (const pc of pcsRef.current.values()) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      }
      pcsRef.current.clear();
      peersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user.id]);

  /* Re-place tracks on peers after device changes */
  useEffect(() => {
    replaceTracksOnPeers();
  }, [media.streamEpoch, replaceTracksOnPeers]);

  /* Poll WebRTC stats to derive a 0..1 connection-quality score per peer. */
  useEffect(() => {
    const timer = setInterval(() => {
      for (const [peerId, pc] of pcsRef.current.entries()) {
        if (pc.connectionState !== "connected") continue;
        void pc
          .getStats()
          .then((stats) => {
            let packetsLost = 0;
            let packetsReceived = 0;
            let jitter = 0;
            stats.forEach((report) => {
              if (report.type === "inbound-rtp" && !report.isRemote) {
                packetsLost += report.packetsLost ?? 0;
                packetsReceived += report.packetsReceived ?? 0;
                jitter = Math.max(jitter, report.jitter ?? 0);
              }
            });
            const total = packetsLost + packetsReceived;
            const lossRatio = total > 0 ? packetsLost / total : 0;
            // Blend packet loss and jitter into a single 0..1 score.
            const lossScore = 1 - Math.min(1, lossRatio * 10);
            const jitterScore = 1 - Math.min(1, jitter / 0.1);
            const score = Math.max(0.05, lossScore * 0.7 + jitterScore * 0.3);
            const existing = peersRef.current.get(peerId);
            if (existing && Math.abs(existing.quality - score) > 0.05) {
              upsertPeer(peerId, existing.name, { quality: score });
            }
          })
          .catch(() => {});
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [upsertPeer]);

  const sendChat = useCallback((body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const msg: SignalMessage = {
      type: "chat",
      from: userRef.current.id,
      name: userRef.current.name,
      body: trimmed,
      ts: Date.now(),
      msgId: uid(),
    };
    signalingRef.current?.send(msg);
    setMessages((prev) => [...prev.slice(-199), {
      id: msg.msgId,
      from: msg.from,
      name: msg.name,
      body: msg.body,
      ts: msg.ts,
    }]);
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    const msg: SignalMessage = {
      type: "reaction",
      from: userRef.current.id,
      emoji,
      ts: Date.now(),
      msgId: uid(),
    };
    signalingRef.current?.send(msg);
    const lane = Math.random();
    const r: LiveReaction = { id: msg.msgId, emoji, lane, createdAt: msg.ts };
    setReactions((prev) => [...prev.slice(-79), r]);
    setTimeout(() => setReactions((prev) => prev.filter((x) => x.id !== msg.msgId)), 4000);
  }, []);

  const sendHandRaise = useCallback((raised: boolean) => {
    signalingRef.current?.send({
      type: "hand_raise",
      from: userRef.current.id,
      raised,
      ts: Date.now(),
    });
  }, []);

  const leave = useCallback(() => {
    signalingRef.current?.send({ type: "leave", from: user.id, name: user.name, ts: Date.now() });
    signalingRef.current?.disconnect();
    for (const pc of pcsRef.current.values()) pc.close();
    pcsRef.current.clear();
    peersRef.current.clear();
    setPeers([]);
  }, [user.id, user.name]);

  // Additive: generic signaling pass-through for new features (polls, etc.).
  // Not part of the public CallEngine type — consumers cast to access it.
  const sendSignal = useCallback((m: SignalMessage) => {
    signalingRef.current?.send(m);
  }, []);

  return {
    participants,
    peers,
    messages,
    reactions,
    connected,
    providerKind,
    sendChat,
    sendReaction,
    sendHandRaise,
    leave,
    sendSignal,
  } as CallEngine & { sendSignal: typeof sendSignal };
}
