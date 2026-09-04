import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { Participant, SignalMessage, Signaling } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return cachedClient;
}

/* ------------------------------------------------------------------ */
/* Supabase Realtime provider                                          */
/* ------------------------------------------------------------------ */

class SupabaseSignaling implements Signaling {
  readonly kind = "supabase" as const;
  private channel: RealtimeChannel | null = null;
  private handlers: Array<(msg: SignalMessage) => void> = [];
  private presenceHandlers: Array<(p: Participant[]) => void> = [];
  private role: "host" | "viewer";

  constructor(
    private roomId: string,
    private user: Participant,
    role: "host" | "viewer" = "viewer"
  ) {
    this.role = role;
  }

  connect() {
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client.channel(`call-room:${this.roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const msg = payload as SignalMessage;
        if (msg && msg.from !== this.user.id) this.emit(msg);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Participant>();
        const list = Object.values(state)
          .flat()
          .map((p) => ({ id: p.id, name: p.name }));
        this.presenceHandlers.forEach((cb) => cb(list));
      });

    this.channel = channel;
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ id: this.user.id, name: this.user.name });
        this.send({ type: "hello", from: this.user.id, name: this.user.name, role: this.role, ts: Date.now() });
      }
    });
  }

  disconnect() {
    this.channel?.unsubscribe();
    this.channel = null;
  }

  send(msg: SignalMessage) {
    if (!this.channel) return;
    void this.channel.send({ type: "broadcast", event: "signal", payload: msg });
  }

  onMessage(cb: (msg: SignalMessage) => void) {
    this.handlers.push(cb);
  }

  onPresence(cb: (p: Participant[]) => void) {
    this.presenceHandlers.push(cb);
  }

  private emit(msg: SignalMessage) {
    this.handlers.forEach((cb) => cb(msg));
  }
}

/* ------------------------------------------------------------------ */
/* Local provider — Next.js API routes + PostgreSQL (long-polling)     */
/* ------------------------------------------------------------------ */

const POLL_INTERVAL = 700;

class LocalSignaling implements Signaling {
  readonly kind = "local" as const;
  private handlers: Array<(msg: SignalMessage) => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastId = 0;
  private connected = false;
  private role: "host" | "viewer";

  constructor(
    private roomId: string,
    private user: Participant,
    role: "host" | "viewer" = "viewer"
  ) {
    this.role = role;
  }

  connect() {
    if (this.connected) return;
    this.connected = true;
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL);
    // Announce ourselves; existing members answer with presence + offers.
    this.send({ type: "hello", from: this.user.id, name: this.user.name, role: this.role, ts: Date.now() });
  }

  disconnect() {
    this.connected = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  send(msg: SignalMessage) {
    void fetch("/api/signaling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.roomId, message: msg }),
    }).catch(() => {});
  }

  onMessage(cb: (msg: SignalMessage) => void) {
    this.handlers.push(cb);
  }

  onPresence() {
    // Presence is reconstructed from hello/presence messages in local mode.
  }

  private async poll() {
    try {
      const res = await fetch(`/api/signaling?roomId=${encodeURIComponent(this.roomId)}&after=${this.lastId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { events: Array<{ id: number; message: SignalMessage }> };
      const cutoff = Date.now() - 10 * 60 * 1000;
      for (const event of data.events) {
        this.lastId = Math.max(this.lastId, event.id);
        // Skip stale events from a previous session in the same room.
        if (event.message.ts < cutoff) continue;
        if (event.message.from !== this.user.id) this.emit(event.message);
      }
    } catch {
      // transient network error — keep polling
    }
  }

  private emit(msg: SignalMessage) {
    this.handlers.forEach((cb) => cb(msg));
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export function createSignaling(
  roomId: string,
  user: Participant,
  role: "host" | "viewer" = "viewer"
): Signaling {
  if (hasSupabaseConfig()) {
    try {
      return new SupabaseSignaling(roomId, user, role);
    } catch {
      // fall through to local provider
    }
  }
  return new LocalSignaling(roomId, user, role);
}
