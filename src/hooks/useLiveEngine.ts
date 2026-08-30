"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  LiveReaction,
  Participant,
  Role,
  Signaling,
  SignalMessage,
} from "@/lib/types";
import { createSignaling } from "@/lib/signaling";
import type { MediaController } from "@/hooks/useMedia";

export interface LiveEngine {
  role: Role;
  host: Participant | null;
  hostStream: MediaStream | null;
  hostConnected: boolean;
  /** All viewers present (host excluded). */
  viewers: Participant[];
  /** All viewers + host. */
  participants: Participant[];
  messages: ChatMessage[];
  reactions: LiveReaction[];
  /** IDs of viewers currently raising their hand. */
  raisedHands: string[];
  connected: boolean;
  providerKind: "supabase" | "local";
  /** Host-only: send a chat message to viewers. */
  sendChat: (body: string) => void;
  /** Anyone: send an emoji reaction. */
  sendReaction: (emoji: string) => void;
  /** Viewer: raise/lower hand to ask to speak. */
  sendHandRaise: (raised: boolean) => void;
  /** Host: announce screen-share / recording state to viewers. */
  sendScreenShare: (sharing: boolean) => void;
  sendRecording: (recording: boolean) => void;
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
const REACTION_TTL_MS = 4000;
const REACTION_LIMIT = 80;

/**
 * Live broadcast engine. A single host streams video to many viewers; viewers
 * are never connected peer-to-peer with each other (one-way fan-out).
 *  - Host: waits for viewer hellos, creates an offer to each new viewer, sends
 *    chat + reacts to the channel.
 *  - Viewer: connects to the signaling channel, receives the host's offer,
 *    answers, and renders the host's stream.
 */
export function useLiveEngine(
  roomId: string,
  user: Participant,
  role: Role,
  media: MediaController
): LiveEngine {
  const [host, setHost] = useState<Participant | null>(role === "host" ? user : null);
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [hostConnected, setHostConnected] = useState(false);
  const [viewers, setViewers] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [providerKind, setProviderKind] = useState<"supabase" | "local">("local");

  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const viewersRef = useRef<Participant[]>([]);
  const signalingRef = useRef<Signaling | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const userRef = useRef(user);
  userRef.current = user;
  const hostIdRef = useRef<string | null>(role === "host" ? user.id : null);
  const hostSeenRef = useRef(false);
  const reactionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const track = useCallback((v: Participant[]) => {
    viewersRef.current = v;
    setViewers(v);
  }, []);

  const trackHost = useCallback((h: Participant | null, stream: MediaStream | null, isConnected: boolean) => {
    setHost(h);
    setHostStream(stream);
    setHostConnected(isConnected);
  }, []);

  /* ---------------- RTC ---------------- */

  const attachTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = mediaRef.current.stream;
    if (!stream) return;
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
  }, []);

  const flushIce = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    const queue = pendingIceRef.current.get(peerId) ?? [];
    pendingIceRef.current.delete(peerId);
    if (!pc || pc.remoteDescription === null) return;
    for (const candidate of queue) {
      void pc.addIceCandidate(candidate).catch(() => {});
    }
  }, []);

  const createViewerConnection = useCallback(
    (viewerId: string, viewerName: string) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcsRef.current.set(viewerId, pc);
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        signalingRef.current?.send({
          type: "ice",
          from: userRef.current.id,
          to: viewerId,
          candidate: e.candidate.toJSON(),
          ts: Date.now(),
        });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setHostConnected(true);
        }
      };
      attachTracks(pc);
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          signalingRef.current?.send({
            type: "offer",
            from: userRef.current.id,
            name: userRef.current.name,
            to: viewerId,
            sdp: pc.localDescription!,
            ts: Date.now(),
          });
        })
        .catch((err) => console.warn("live offer failed", err));
      return pc;
    },
    [attachTracks]
  );

  const acceptHostOffer = useCallback(
    (hostId: string, hostName: string, sdp: RTCSessionDescriptionInit) => {
      let pc = pcsRef.current.get(hostId);
      if (!pc) {
        pc = new RTCPeerConnection(RTC_CONFIG);
        pcsRef.current.set(hostId, pc);
        pc.onicecandidate = (e) => {
          if (!e.candidate) return;
          signalingRef.current?.send({
            type: "ice",
            from: userRef.current.id,
            to: hostId,
            candidate: e.candidate.toJSON(),
            ts: Date.now(),
          });
        };
        pc.ontrack = (e) => {
          const stream = e.streams[0] ?? new MediaStream([e.track]);
          setHostStream(stream);
        };
        pc.onconnectionstatechange = () => {
          if (pc!.connectionState === "connected") setHostConnected(true);
        };
      }
      void pc
        .setRemoteDescription(sdp)
        .then(() => flushIce(hostId))
        .then(() => pc!.createAnswer())
        .then((answer) => pc!.setLocalDescription(answer))
        .then(() => {
          signalingRef.current?.send({
            type: "answer",
            from: userRef.current.id,
            name: userRef.current.name,
            to: hostId,
            sdp: pc!.localDescription!,
            ts: Date.now(),
          });
        })
        .catch((err) => console.warn("live answer failed", err));
      trackHost({ id: hostId, name: hostName }, hostStream, false);
    },
    [flushIce, hostStream, trackHost]
  );

  /* ---------------- reactions ---------------- */

  const addReaction = useCallback(
    (id: string, emoji: string) => {
      const lane = Math.random();
      const r: LiveReaction = {
        id,
        emoji,
        lane,
        createdAt: Date.now(),
      };
      setReactions((prev) => [...prev.slice(-(REACTION_LIMIT - 1)), r]);
      const timer = setTimeout(() => {
        setReactions((prev) => prev.filter((x) => x.id !== id));
        reactionTimersRef.current.delete(id);
      }, REACTION_TTL_MS);
      reactionTimersRef.current.set(id, timer);
    },
    []
  );

  /* ---------------- message handler ---------------- */

  const handleMessage = useCallback(
    (msg: SignalMessage) => {
      const myId = userRef.current.id;
      switch (msg.type) {
        case "hello": {
          if (role === "host") {
            if (msg.from === myId) break;
            if (msg.role !== "viewer") break;
            // New viewer — open an offer.
            const viewer: Participant = { id: msg.from, name: msg.name };
            const next = viewersRef.current.some((v) => v.id === viewer.id)
              ? viewersRef.current
              : [...viewersRef.current, viewer];
            track(next);
            if (mediaRef.current.stream) createViewerConnection(msg.from, msg.name);
          } else {
            // Viewer receives a host hello
            if (msg.role !== "host" || msg.from === myId) break;
            hostIdRef.current = msg.from;
            hostSeenRef.current = true;
            setHost({ id: msg.from, name: msg.name });
            // Nudge the host so they create an offer to us
            signalingRef.current?.send({
              type: "hello",
              from: myId,
              name: userRef.current.name,
              role: "viewer",
              ts: Date.now(),
            });
          }
          break;
        }
        case "presence": {
          if (role === "host") {
            const next = msg.participants.filter(
              (p) => p.id !== myId && p.id !== (hostIdRef.current ?? "")
            );
            track(next);
          }
          break;
        }
        case "offer": {
          if (role !== "viewer") break;
          if (msg.to !== myId) break;
          hostIdRef.current = msg.from;
          hostSeenRef.current = true;
          acceptHostOffer(msg.from, msg.name ?? "Host", msg.sdp);
          break;
        }
        case "answer": {
          if (role !== "host") break;
          if (msg.to !== myId) break;
          const pc = pcsRef.current.get(msg.from);
          if (!pc) break;
          void pc.setRemoteDescription(msg.sdp).then(() => flushIce(msg.from));
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
            void pc.addIceCandidate(msg.candidate).catch(() => {});
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
        case "reaction": {
          addReaction(msg.msgId, msg.emoji);
          break;
        }
        case "leave": {
          if (role === "host") {
            track(viewersRef.current.filter((v) => v.id !== msg.from));
            const pc = pcsRef.current.get(msg.from);
            if (pc) {
              pc.close();
              pcsRef.current.delete(msg.from);
            }
          } else if (role === "viewer" && hostIdRef.current === msg.from) {
            setHost(null);
            setHostStream(null);
            setHostConnected(false);
          }
          break;
        }
        case "ping": {
          // No-op for live
          break;
        }
        case "hand_raise": {
          if (msg.from === myId) break;
          setRaisedHands((prev) =>
            msg.raised
              ? prev.includes(msg.from)
                ? prev
                : [...prev, msg.from]
              : prev.filter((id) => id !== msg.from)
          );
          break;
        }
        default:
          break;
      }
    },
    [acceptHostOffer, addReaction, createViewerConnection, flushIce, role, track]
  );

  const onPresence = useCallback(
    (list: Participant[]) => {
      if (role !== "host") return;
      const next = list.filter(
        (p) => p.id !== userRef.current.id && p.id !== (hostIdRef.current ?? "")
      );
      track(next);
    },
    [role, track]
  );

  /* ---------------- lifecycle ---------------- */

  useEffect(() => {
    const sig = createSignaling(roomId, user, role);
    signalingRef.current = sig;
    setProviderKind(sig.kind);
    sig.onMessage(handleMessage);
    sig.onPresence(onPresence);
    sig.connect();

    const readyTimer = setTimeout(() => setConnected(true), 1500);

    return () => {
      clearTimeout(readyTimer);
      sig.send({ type: "leave", from: user.id, name: user.name, ts: Date.now() });
      sig.disconnect();
      for (const pc of pcsRef.current.values()) pc.close();
      pcsRef.current.clear();
      for (const t of reactionTimersRef.current.values()) clearTimeout(t);
      reactionTimersRef.current.clear();
    };
  }, [roomId, user.id, user.name, role, handleMessage, onPresence]);

  /* When the host's stream becomes available (after device pick), push it to all PCs */
  useEffect(() => {
    if (role !== "host" || !media.streamEpoch) return;
    const stream = mediaRef.current.stream;
    if (!stream) return;
    for (const pc of pcsRef.current.values()) {
      for (const track of stream.getTracks()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) void sender.replaceTrack(track).catch(() => {});
      }
    }
  }, [media.streamEpoch, role]);

  const sendChat = useCallback(
    (body: string) => {
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
    },
    []
  );

  const sendReaction = useCallback((emoji: string) => {
    const msg: SignalMessage = {
      type: "reaction",
      from: userRef.current.id,
      emoji,
      ts: Date.now(),
      msgId: uid(),
    };
    signalingRef.current?.send(msg);
    addReaction(msg.msgId, emoji);
  }, [addReaction]);

  const sendHandRaise = useCallback((raised: boolean) => {
    signalingRef.current?.send({
      type: "hand_raise",
      from: userRef.current.id,
      name: userRef.current.name,
      raised,
      ts: Date.now(),
    });
  }, []);

  const sendScreenShare = useCallback((sharing: boolean) => {
    signalingRef.current?.send(
      sharing
        ? {
            type: "virtual_bg", // reuse lightweight announce channel
            from: userRef.current.id,
            name: userRef.current.name,
            enabled: true,
            ts: Date.now(),
          }
        : { type: "screen_stop", from: userRef.current.id, name: userRef.current.name, ts: Date.now() }
    );
  }, []);

  const sendRecording = useCallback((recording: boolean) => {
    signalingRef.current?.send({
      type: "recording",
      from: userRef.current.id,
      name: userRef.current.name,
      enabled: recording,
      ts: Date.now(),
    });
  }, []);

  const leave = useCallback(() => {
    signalingRef.current?.send({ type: "leave", from: user.id, name: user.name, ts: Date.now() });
    signalingRef.current?.disconnect();
    for (const pc of pcsRef.current.values()) pc.close();
    pcsRef.current.clear();
  }, [user.id, user.name]);

  const participants: Participant[] = role === "host" ? [user, ...viewers] : (host ? [host, ...viewers] : []);

  return {
    role,
    host: role === "host" ? user : host,
    hostStream,
    hostConnected,
    viewers,
    participants,
    messages,
    reactions,
    raisedHands,
    connected,
    providerKind,
    sendChat,
    sendReaction,
    sendHandRaise,
    sendScreenShare,
    sendRecording,
    leave,
  };
}
