import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type Pool as PgPool } from "pg";
import * as schema from "./schema";
import {
  getConnectionString,
  hasDatabaseConfig,
  poolConfigFromUrl,
} from "./config";

export { getConnectionString, hasDatabaseConfig, poolConfigFromUrl };

type AppDb = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __vidCallPool?: PgPool;
  __vidCallDb?: AppDb;
  __vidCallSchema?: Promise<void>;
};

function getPool(): PgPool {
  if (!globalForDb.__vidCallPool) {
    globalForDb.__vidCallPool = new Pool(poolConfigFromUrl(getConnectionString()));
    globalForDb.__vidCallPool.on("error", (err) => {
      console.error("[db] idle client error", err.message);
    });
  }
  return globalForDb.__vidCallPool;
}

export function getDb(): AppDb {
  if (!globalForDb.__vidCallDb) {
    globalForDb.__vidCallDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__vidCallDb;
}

/**
 * Create the signaling table if a fresh database has never been migrated.
 * Safe to call on every request — it runs once per process.
 */
export function ensureSchema(): Promise<void> {
  if (!globalForDb.__vidCallSchema) {
    globalForDb.__vidCallSchema = applySchema().catch((err) => {
      globalForDb.__vidCallSchema = undefined;
      throw err;
    });
  }
  return globalForDb.__vidCallSchema;
}

async function applySchema(): Promise<void> {
  const pool = getPool();
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
  await pool.query(
    `CREATE INDEX IF NOT EXISTS signal_events_created_at_idx ON signal_events (created_at)`,
  );
}

/** Drop signaling rows older than one hour so the fallback table cannot grow forever. */
export async function pruneSignalEvents(): Promise<number> {
  const result = await getPool().query(
    `DELETE FROM signal_events WHERE created_at < NOW() - INTERVAL '1 hour'`,
  );
  return result.rowCount ?? 0;
}

/**
 * Lazily-initialized database handle.
 *
 * Importing this module (e.g. during `next build`, when Next collects page
 * data for API routes) no longer requires database env vars — the connection
 * is opened on first use, at request time. A missing URL therefore only
 * affects the API routes that actually need the database.
 */
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop) {
    const value = Reflect.get(getDb(), prop);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});

/** Raw pg pool, initialized lazily for the same reason as `db`. */
export const pool: PgPool = new Proxy({} as PgPool, {
  get(_target, prop) {
    const value = Reflect.get(getPool(), prop);
    return typeof value === "function" ? value.bind(getPool()) : value;
  },
});
