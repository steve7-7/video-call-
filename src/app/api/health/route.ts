import { ensureSchema, hasDatabaseConfig, pool } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  if (!hasDatabaseConfig()) {
    return Response.json(
      {
        ok: false,
        database: false,
        error: "No DATABASE_URL / POSTGRES_URL configured",
        latencyMs: Date.now() - started,
      },
      { status: 503 },
    );
  }

  try {
    await ensureSchema();
    await pool.query("select 1");
    const { rows } = await pool.query<{ rel: string | null }>(
      "select to_regclass('public.signal_events') as rel",
    );
    const rel = rows[0]?.rel;

    return Response.json({
      ok: true,
      database: true,
      schema: rel ? "signal_events" : "missing",
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "database error";
    console.error("[health] database check failed:", message);
    return Response.json(
      {
        ok: false,
        database: false,
        error: message,
        latencyMs: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
