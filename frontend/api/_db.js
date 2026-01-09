import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

// Fail fast with a clear message (instead of mysterious 500s)
if (!DATABASE_URL) {
  console.error("[api/_db] Missing DATABASE_URL env var");
}

// In serverless, reuse the pool across invocations if possible
let _pool = globalThis.__upmeme_pool;

if (!_pool && DATABASE_URL) {
  _pool = new Pool({
    connectionString: DATABASE_URL,
    // Most hosted Postgres (Supabase included) needs SSL from serverless
    ssl: { rejectUnauthorized: false },
    // Prevent connection storms
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalThis.__upmeme_pool = _pool;

  _pool.on("error", (err) => {
    console.error("[api/_db] Pool error", err);
  });
}

export const pool = _pool;
