// src/constants/mockDexTrades.ts
// Mock DEX trade data (used in MOCK MODE for tokens that are already graduated).
//
// These are NOT on-chain; they exist purely so the UI can render a realistic post-graduation view
// (DexScreener iframe + recent trades + timeframe analytics).

export type MockDexTrade = {
  timestamp: number; // unix seconds
  side: "buy" | "sell";
  tokensWei: bigint;
  nativeWei: bigint; // BNB (wei)
  pricePerToken: number; // BNB/token
  trader: string;
  txHash: string;
};

const BASE_TS = 1733800000; // TokenDetails normalizes around "now"
const ADDR = [
  "0x3f2a0bD1B17B2D2b8b1B2b9E3c2f58b9c2aE1111",
  "0x9f1bA1dE2c3D4e5F6a7B8c9D0e1F2a3B4c5D2222",
  "0x1111222233334444555566667777888899990000",
  "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
];

// Simple deterministic "hash" to make tx-looking strings without Node/Buffer.
function pseudoHash(prefix: string, i: number): string {
  let h = 2166136261;
  const s = `${prefix}-${i}`;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  // Expand to 32 bytes hex by repeating patterns
  const base = (h >>> 0).toString(16).padStart(8, "0");
  return `0x${base.repeat(8)}`.slice(0, 66);
}

function makeDexTrades(opts: {
  symbol: string;
  startPrice: number;
  endPrice: number;
  count?: number;
  baseTs?: number;
}): MockDexTrade[] {
  const count = opts.count ?? 24;
  const out: MockDexTrade[] = [];
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 1 : i / (count - 1);
    // A little volatility
    const drift = opts.startPrice + (opts.endPrice - opts.startPrice) * frac;
    const wiggle = (Math.sin(i * 0.9) + Math.cos(i * 0.5)) * 0.00002;
    const price = Math.max(0, drift + wiggle);

    const side: "buy" | "sell" = i % 3 === 0 ? "sell" : "buy";

    // 0.02–0.29 BNB per trade
    const bnb = 0.02 + (i % 10) * 0.03;
    const nativeWei = BigInt(Math.floor(bnb * 1e18));

    // token amount from price (tokens = bnb / price)
    const tokens = price > 0 ? bnb / price : 0;
    const tokensWei = BigInt(Math.floor(tokens * 1e18));

    out.push({
      timestamp: (opts.baseTs ?? BASE_TS) + i * 1800, // 30min spacing
      side,
      tokensWei,
      nativeWei,
      pricePerToken: Number(price.toFixed(8)),
      trader: ADDR[i % ADDR.length],
      txHash: pseudoHash(opts.symbol, i),
    });
  }
  return out;
}

const DEX_TRADES_BY_SYMBOL: Record<string, MockDexTrade[]> = {
  // Pick a few mock tokens to be "already graduated"
  ZENITH: makeDexTrades({ symbol: "ZENITH", startPrice: 0.00035, endPrice: 0.00062 }),
  APEX: makeDexTrades({ symbol: "APEX", startPrice: 0.00030, endPrice: 0.00058 }),
  SVMACC: makeDexTrades({ symbol: "SVMACC", startPrice: 0.00018, endPrice: 0.00026 }),
};

// Best-effort mock DEX liquidity in BNB equivalent for the graduated mock tokens.
// Used to mimic the post-graduation "Liquidity" metric in TokenDetails.
const DEX_LIQUIDITY_BNB_BY_SYMBOL: Record<string, number> = {
  ZENITH: 245.6,
  APEX: 198.2,
  SVMACC: 121.9,
};

export function getMockDexTradesForSymbol(symbol?: string | null): MockDexTrade[] {
  if (!symbol) return [];
  const key = symbol.toUpperCase();
  return DEX_TRADES_BY_SYMBOL[key] ?? [];
}

export function getMockDexLiquidityBnbForSymbol(symbol?: string | null): number | undefined {
  if (!symbol) return undefined;
  const key = symbol.toUpperCase();
  return DEX_LIQUIDITY_BNB_BY_SYMBOL[key];
}
