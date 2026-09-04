import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type Pool as PgPool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __vidCallPool?: PgPool;
  __vidCallDb?: NodePgDatabase;
};

function getConnectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    throw new Error(
      "No database URL found. Set DATABASE_URL (or POSTGRES_URL) in the environment.",
    );
  }
  return url;
}

function getPool(): PgPool {
  if (!globalForDb.__vidCallPool) {
    globalForDb.__vidCallPool = new Pool({
      connectionString: getConnectionString(),
      max: 5,
    });
  }
  return globalForDb.__vidCallPool;
}

export function getDb(): NodePgDatabase {
  if (!globalForDb.__vidCallDb) {
    globalForDb.__vidCallDb = drizzle(getPool());
  }
  return globalForDb.__vidCallDb;
}

/**
 * Lazily-initialized database handle.
 *
 * Importing this module (e.g. during `next build`, when Next collects page
 * data for API routes) no longer requires database env vars — the connection
 * is opened on first use, at request time. A missing URL therefore only
 * affects the API routes that actually need the database.
 */
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
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
