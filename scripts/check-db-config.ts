import {
  connectionStringFromEnv,
  hasDatabaseConfig,
  poolConfigFromUrl,
} from "../src/db/config.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(!hasDatabaseConfig({}), "empty env should be false");
assert(hasDatabaseConfig({ DATABASE_URL: "postgresql://u:p@localhost/db" }), "DATABASE_URL");
assert(
  connectionStringFromEnv({ POSTGRES_URL: "postgresql://u:p@h/db" }) === "postgresql://u:p@h/db",
  "POSTGRES_URL",
);

const fromParts = connectionStringFromEnv({
  POSTGRES_USER: "postgres",
  POSTGRES_PASSWORD: "p@ss:word",
  POSTGRES_HOST: "db.example.com",
  POSTGRES_DATABASE: "app",
});
assert(fromParts?.includes("p%40ss%3Aword"), `password is encoded: ${fromParts}`);
assert(fromParts?.includes("db.example.com:5432/app"), "host/db assembled");

const local = poolConfigFromUrl("postgresql://postgres:postgres@127.0.0.1:5432/app_db");
assert(!local.ssl, `local should not force ssl, got ${JSON.stringify(local.ssl)}`);

const remote = poolConfigFromUrl(
  "postgres://postgres.proj:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x&pgbouncer=true",
);
assert(
  remote.ssl && typeof remote.ssl === "object" && remote.ssl.rejectUnauthorized === false,
  "remote ssl",
);
assert(!String(remote.connectionString).includes("pgbouncer"), "pgbouncer stripped");
assert(!String(remote.connectionString).includes("supa="), "supa stripped");
assert(!String(remote.connectionString).includes("sslmode"), "sslmode stripped");

let threw = false;
try {
  poolConfigFromUrl("not-a-url");
} catch {
  threw = true;
}
assert(threw, "invalid url should throw");

console.log("config checks OK");
