import { useEffect, useMemo, useState } from "react";

type BnbUsdState = {
  price: number | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
};

const STORAGE_KEY = "launchit:bnbUsdPrice:v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readCache(): { price: number; updatedAt: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { price?: unknown; updatedAt?: unknown };
    const price = typeof parsed.price === "number" ? parsed.price : null;
    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : null;
    if (price == null || updatedAt == null) return null;
    return { price, updatedAt };
  } catch {
    return null;
  }
}

function writeCache(price: number) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ price, updatedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

/**
 * Fetches BNB/USD reference price for UI conversions (e.g., Market Cap in USD).
 * Source: CoinGecko simple price endpoint.
 *
 * Notes:
 * - Best-effort utility for display purposes only.
 * - Uses localStorage caching to reduce request volume.
 */
export function useBnbUsdPrice(enabled: boolean = true, refreshMs: number = 60_000): BnbUsdState {
  const cached = useMemo(() => (typeof window !== "undefined" ? readCache() : null), []);

  const [price, setPrice] = useState<number | null>(cached?.price ?? null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.updatedAt ?? null);
  const [loading, setLoading] = useState<boolean>(enabled && !(cached && Date.now() - cached.updatedAt < CACHE_TTL_MS));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const fetchPrice = async () => {
      try {
        setError(null);

        const cache = readCache();
        if (cache && Date.now() - cache.updatedAt < CACHE_TTL_MS) {
          if (!cancelled) {
            setPrice(cache.price);
            setUpdatedAt(cache.updatedAt);
            setLoading(false);
          }
          return;
        }

        setLoading(true);

        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd",
          { headers: { Accept: "application/json" } }
        );

        if (!res.ok) throw new Error(`BNB price fetch failed (${res.status})`);
        const data = (await res.json()) as any;

        const p = Number(data?.binancecoin?.usd);
        if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid BNB/USD price");

        writeCache(p);

        if (!cancelled) {
          setPrice(p);
          setUpdatedAt(Date.now());
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoading(false);
          setError(e?.message ? String(e.message) : "BNB price fetch failed");
        }
      }
    };

    fetchPrice();
    intervalId = window.setInterval(fetchPrice, refreshMs);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [enabled, refreshMs]);

  return { price, loading, error, updatedAt };
}
