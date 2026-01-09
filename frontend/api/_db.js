import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

function loadRepoCa() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const caPath = path.join(__dirname, "certs", "aiven-ca.pem");
    const ca = fs.readFileSync(caPath, "utf8");
    return ca;
  } catch {
    return null;
  }
}

let _pool = globalThis.__upmeme_pool;

if (!_pool) {
  if (!DATABASE_URL) throw new Error("DATABASE_URL missing");

  const ca = loadRepoCa();

  console.log("[api/_db] CA loaded from repo:", Boolean(ca));

  _pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalThis.__upmeme_pool = _pool;

  _pool.on("error", (err) => console.error("[api/_db] Pool error", err));
}

export const pool = _pool;
