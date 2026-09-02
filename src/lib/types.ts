/** A participant in a call room. */
export interface Participant {
  id: string;
  name: string;
  /** Optional avatar image URL. If not provided, initials avatar is used. */
  avatarUrl?: string;
}

/** A chat message exchanged inside a call. */
export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  body: string;
  ts: number;
}

/** WebRTC signaling messages exchanged over the signaling provider. */
export type SignalMessage =
  | { type: "hello"; from: string; name: string; role: Role; ts: number }
  | { type: "presence"; from: string; participants: Participant[]; role: Role; ts: number }
  | { type: "hand_raise"; from: string; name?: string; raised: boolean; ts: number }
  | { type: "screen_share"; from: string; to: string; sdp: RTCSessionDescriptionInit; name?: string; ts: number }
  | { type: "screen_answer"; from: string; to: string; sdp: RTCSessionDescriptionInit; ts: number }
  | { type: "screen_ice"; from: string; to: string; candidate: RTCIceCandidateInit; ts: number }
  | { type: "screen_stop"; from: string; name?: string; ts: number }
  | { type: "virtual_bg"; from: string; name?: string; enabled: boolean; ts: number }
  | { type: "recording"; from: string; name?: string; enabled: boolean; ts: number }
  | {
      type: "offer";
      from: string;
      name?: string;
      to: string;
      sdp: RTCSessionDescriptionInit;
      ts: number;
    }
  | {
      type: "answer";
      from: string;
      name?: string;
      to: string;
      sdp: RTCSessionDescriptionInit;
      ts: number;
    }
  | {
      type: "ice";
      from: string;
      to: string;
      candidate: RTCIceCandidateInit;
      ts: number;
    }
  | { type: "leave"; from: string; name: string; ts: number }
  | { type: "ping"; from: string; ts: number }
  | {
      type: "chat";
      from: string;
      name: string;
      body: string;
      ts: number;
      msgId: string;
    }
  | {
      type: "reaction";
      from: string;
      emoji: string;
      ts: number;
      msgId: string;
    }
  | {
      type: "hand_raise";
      from: string;
      name?: string;
      raised: boolean;
      ts: number;
    }
  | {
      type: "screen_share";
      from: string;
      to: string;
      sdp: RTCSessionDescriptionInit;
      name?: string;
      ts: number;
    }
  | {
      type: "screen_answer";
      from: string;
      to: string;
      sdp: RTCSessionDescriptionInit;
      ts: number;
    }
  | { type: "screen_stop"; from: string; name?: string; ts: number }
  | { type: "screen_ice"; from: string; to: string; candidate: RTCIceCandidateInit; ts: number }
  | { type: "virtual_bg"; from: string; name?: string; enabled: boolean; ts: number }
  | { type: "recording"; from: string; name?: string; enabled: boolean; ts: number }
  | { type: "filter"; from: string; filter: VideoFilter; ts: number }
  | { type: "poll_create"; from: string; name?: string; poll: Poll; ts: number }
  | { type: "poll_vote"; from: string; pollId: string; optionId: string; ts: number }
  | { type: "poll_close"; from: string; pollId: string; ts: number }
  | { type: "breakout"; from: string; name?: string; rooms: BreakoutRoom[]; ts: number }
  | { type: "breakout_end"; from: string; ts: number }
  | { type: "noise_suppression"; from: string; name?: string; enabled: boolean; ts: number };

/** Whether a participant is broadcasting or watching. */
export type Role = "host" | "viewer";

/** Floating live reaction rendered in the overlay. */
export interface LiveReaction {
  id: string;
  emoji: string;
  /** 0 = left, 1 = right */
  lane: number;
  createdAt: number;
}

/** Interface implemented by both the Supabase Realtime and local signaling providers. */
export interface Signaling {
  readonly kind: "supabase" | "local";
  connect(): void;
  disconnect(): void;
  send(msg: SignalMessage): void;
  onMessage(cb: (msg: SignalMessage) => void): void;
  /** Emitted presence snapshot (Supabase mode) — used to reconcile participants. */
  onPresence(cb: (participants: Participant[]) => void): void;
}

/** Media device preferences persisted to localStorage. */
export interface MediaSettings {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  videoOn: boolean;
  micOn: boolean;
  /** "user" = front, "environment" = back, "left"/"right" = multi-cam setups. */
  facingMode: "user" | "environment";
  torch: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  /** Optional avatar image URL (base64 or data URL). If not provided, initials avatar is used. */
  avatarUrl?: string;
}

/** Video filter options for self-view and broadcast. */
export type VideoFilter = "none" | "bw" | "sepia" | "cool" | "warm";

export interface PollOption {
  id: string;
  label: string;
  /** participant IDs who voted for this option */
  voters: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  closed: boolean;
  createdBy: string;
  createdAt: number;
}

export interface BreakoutRoom {
  id: string;
  name: string;
  /** participant IDs assigned to this room */
  participants: string[];
}
