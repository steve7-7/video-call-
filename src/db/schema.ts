import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import type { SignalMessage } from "@/lib/types";

/**
 * Signaling events used by the built-in fallback signaling provider.
 * When Supabase Realtime credentials are configured (NEXT_PUBLIC_SUPABASE_URL
 * + NEXT_PUBLIC_SUPABASE_ANON_KEY) the app uses Supabase Realtime broadcast
 * channels for WebRTC signaling instead, and this table is unused.
 *
 * The table is created automatically on first API request via `ensureSchema()`.
 */
export const signalEvents = pgTable(
  "signal_events",
  {
    id: serial("id").primaryKey(),
    roomId: text("room_id").notNull(),
    sender: text("sender").notNull(),
    payload: jsonb("payload").$type<SignalMessage>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("signal_events_room_idx").on(table.roomId, table.id),
    index("signal_events_created_at_idx").on(table.createdAt),
  ],
);

export type SignalEventRow = typeof signalEvents.$inferSelect;
