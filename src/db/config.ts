import type { PoolConfig } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Query params that are not libpq options. Prisma/Supabase add these to
 * connection strings; passing them through node-postgres can break startup.
 */
const NON_LIBPQ_PARAMS = ["pgbouncer", "supa", "uselibpqcompat"] as const;

export function firstEnv(env: NodeJS.Dict<string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function connectionStringFromEnv(
  env: NodeJS.Dict<string> = process.env,
): string | undefined {
  const url = firstEnv(
    env,
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
  );
  if (url) return url;

  const user = firstEnv(env, "POSTGRES_USER", "PGUSER");
  const password = firstEnv(env, "POSTGRES_PASSWORD", "PGPASSWORD");
  const host = firstEnv(env, "POSTGRES_HOST", "PGHOST");
  const database = firstEnv(env, "POSTGRES_DATABASE", "PGDATABASE") ?? "postgres";
  const port = firstEnv(env, "POSTGRES_PORT", "PGPORT") ?? "5432";
  if (!user || !password || !host) return undefined;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function getConnectionString(env: NodeJS.Dict<string> = process.env): string {
  const url = connectionStringFromEnv(env);
  if (!url) {
    throw new Error(
      "No database URL found. Set DATABASE_URL (or POSTGRES_URL) in the environment.",
    );
  }
  return url;
}

export function hasDatabaseConfig(env: NodeJS.Dict<string> = process.env): boolean {
  return Boolean(connectionStringFromEnv(env));
}

/**
 * Strip adapter-only query flags and decide SSL.
 * Remote hosts (Supabase pooler / direct) require TLS; local docker/postgres does not.
 */
export function poolConfigFromUrl(rawUrl: string): PoolConfig {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL / POSTGRES_URL is not a valid connection string.");
  }

  for (const param of NON_LIBPQ_PARAMS) {
    parsed.searchParams.delete(param);
  }

  const sslMode = (parsed.searchParams.get("sslmode") ?? "").toLowerCase();
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("ssl");

  const local = LOCAL_HOSTS.has(parsed.hostname);
  const sslDisabled = sslMode === "disable";

  const config: PoolConfig = {
    connectionString: parsed.toString(),
    max: process.env.VERCEL ? 1 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    keepAlive: true,
  };

  if (!local && !sslDisabled) {
    // Supabase and most hosted Postgres require TLS. rejectUnauthorized is
    // false so pooler certificates that don't match verify-full still work
    // (pg 8.20 treats sslmode=require as verify-full).
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}
