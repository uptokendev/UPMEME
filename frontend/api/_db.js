import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

function readCa() {
  const ca = process.env.PG_CA_CERT;
  if (!ca) return null;
  return ca.includes("\\n") ? ca.replace(/\\n/g, "\n") : ca;
}

if (!DATABASE_URL) {
  console.error("[api/_db] Missing DATABASE_URL env var");
}

let _pool = globalThis.__upmeme_pool;

if (!_pool && DATABASE_URL) {
  const ca = readCa();

  console.log("[api/_db] Creating pool. Has CA:", Boolean(ca));

  _pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: ca
      ? { ca, rejectUnauthorized: true }
      : { rejectUnauthorized: false },
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
