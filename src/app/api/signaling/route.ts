import { NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { db, ensureSchema, pruneSignalEvents } from "@/db";
import { signalEvents } from "@/db/schema";
import type { SignalMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROOM_ID_LENGTH = 64;
const MAX_PAYLOAD_SIZE = 16_000;

function dbUnavailable(err: unknown) {
  const message = err instanceof Error ? err.message : "database error";
  console.error("[signaling] database error:", message);
  return NextResponse.json(
    { error: "database unavailable", detail: message },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") ?? "";
  const after = Number(searchParams.get("after") ?? "0");

  if (!roomId || roomId.length > MAX_ROOM_ID_LENGTH) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const events = await db
      .select()
      .from(signalEvents)
      .where(and(eq(signalEvents.roomId, roomId), gt(signalEvents.id, after)))
      .orderBy(asc(signalEvents.id))
      .limit(300);

    return NextResponse.json({
      events: events.map((e) => ({ id: e.id, message: e.payload })),
    });
  } catch (err) {
    return dbUnavailable(err);
  }
}

export async function POST(request: Request) {
  let body: { roomId?: string; message?: SignalMessage };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { roomId, message } = body;
  if (!roomId || !message || roomId.length > MAX_ROOM_ID_LENGTH) {
    return NextResponse.json({ error: "roomId and message are required" }, { status: 400 });
  }
  if (JSON.stringify(message).length > MAX_PAYLOAD_SIZE) {
    return NextResponse.json({ error: "message too large" }, { status: 413 });
  }

  try {
    await ensureSchema();
    const [row] = await db
      .insert(signalEvents)
      .values({
        roomId,
        sender: message.from,
        payload: message,
      })
      .returning({ id: signalEvents.id });

    void pruneSignalEvents().catch((err) => {
      console.warn("[signaling] prune failed:", err instanceof Error ? err.message : err);
    });

    return NextResponse.json({ id: row?.id ?? 0 }, { status: 201 });
  } catch (err) {
    return dbUnavailable(err);
  }
}
