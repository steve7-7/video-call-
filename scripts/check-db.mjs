/**
 * Smoke-test database connectivity and the signal_events schema.
 * Usage: npm run db:check
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

function firstEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function redact(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(unparseable)";
  }
}

function poolConfig(rawUrl) {
  const parsed = new URL(rawUrl);
  parsed.searchParams.delete("pgbouncer");
  parsed.searchParams.delete("supa");
  parsed.searchParams.delete("uselibpqcompat");
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("ssl");
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  return {
    connectionString: parsed.toString(),
    max: 1,
    connectionTimeoutMillis: 8000,
    ssl: local ? false : { rejectUnauthorized: false },
  };
}

const url = firstEnv(
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
);

if (!url) {
  console.error("FAIL  no DATABASE_URL / POSTGRES_URL in the environment");
  process.exit(1);
}

console.log("url   ", redact(url));

const pool = new Pool(poolConfig(url));
const started = Date.now();

try {
  const ping = await pool.query("select 1 as ok, current_database() as db, current_user as usr");
  console.log("ping  ", ping.rows[0], `${Date.now() - started}ms`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS signal_events (
      id SERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS signal_events_room_idx ON signal_events (room_id, id)`,
  );

  const insert = await pool.query(
    `INSERT INTO signal_events (room_id, sender, payload)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id`,
    ["__health__", "check-db", JSON.stringify({ type: "ping", from: "check-db", ts: Date.now() })],
  );
  const id = insert.rows[0].id;
  const read = await pool.query(
    `SELECT id, room_id, sender FROM signal_events WHERE id = $1`,
    [id],
  );
  await pool.query(`DELETE FROM signal_events WHERE id = $1`, [id]);

  if (!read.rows[0] || read.rows[0].room_id !== "__health__") {
    throw new Error("round-trip read did not match inserted row");
  }

  console.log("schema signal_events ok  insert/select/delete id=", id);
  console.log("OK");
  process.exit(0);
} catch (err) {
  console.error("FAIL ", err.message);
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
