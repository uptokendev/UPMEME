// src/constants/mockCurveTrades.ts
// Mock curve data used in MOCK MODE to mimic bonding-curve activity.
//
// NOTE:
// - Pre-graduation tokens render the internal CurvePriceChart using these points.
// - Graduated tokens are expected to render the DexScreener iframe instead.

export type MockCurveEvent = {
  timestamp: number;     // Unix timestamp in seconds
  pricePerToken: number; // BNB per token
};

const START_TS = 1733700000; // fixed base; TokenDetails normalizes these around "now" for timeframe windows
const STEP = 300; // 5 minutes per point

function makeCurve(
  startPrice: number,
  endPrice: number,
  points = 16,
  startTs = START_TS,
  step = STEP
): MockCurveEvent[] {
  const out: MockCurveEvent[] = [];
  for (let i = 0; i < points; i++) {
    const frac = points === 1 ? 1 : i / (points - 1);
    const eased = Math.pow(frac, 1.25);
    const price = startPrice + (endPrice - startPrice) * eased;
    out.push({
      timestamp: startTs + i * step,
      pricePerToken: Number(price.toFixed(8)),
    });
  }
  return out;
}

// One curve per mock token symbol
const LIT_CURVE_EVENTS = makeCurve(0.00008, 0.00018);
const MOCK2_CURVE_EVENTS = makeCurve(0.00010, 0.00030);
const PIAIPIN_CURVE_EVENTS = makeCurve(0.00002, 0.00009);
const NOVA_CURVE_EVENTS = makeCurve(0.00005, 0.00012);
const ZENITH_CURVE_EVENTS = makeCurve(0.00015, 0.00060);
const APEX_CURVE_EVENTS = makeCurve(0.00012, 0.00055);
const LIGHT_CURVE_EVENTS = makeCurve(0.00003, 0.00008);
const MAGIK_CURVE_EVENTS = makeCurve(0.00004, 0.00011);
const SVMACC_CURVE_EVENTS = makeCurve(0.00009, 0.00025);
const MID_CURVE_EVENTS = makeCurve(0.00006, 0.00014);
const DANIEL_CURVE_EVENTS = makeCurve(0.00001, 0.00005);

const EVENTS_BY_SYMBOL: Record<string, MockCurveEvent[]> = {
  LIT: LIT_CURVE_EVENTS,
  MOCK2: MOCK2_CURVE_EVENTS,
  PIAIPIN: PIAIPIN_CURVE_EVENTS,
  NOVA: NOVA_CURVE_EVENTS,
  ZENITH: ZENITH_CURVE_EVENTS,
  APEX: APEX_CURVE_EVENTS,
  LIGHT: LIGHT_CURVE_EVENTS,
  MAGIK: MAGIK_CURVE_EVENTS,
  SVMACC: SVMACC_CURVE_EVENTS,
  MID: MID_CURVE_EVENTS,
  DANIEL: DANIEL_CURVE_EVENTS,
};

export function getMockCurveEventsForSymbol(symbol?: string | null): MockCurveEvent[] {
  if (!symbol) return [];
  const key = symbol.toUpperCase();
  return EVENTS_BY_SYMBOL[key] ?? [];
}
