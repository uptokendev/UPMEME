import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Contract, ethers } from "ethers";
import LaunchCampaignArtifact from "@/abi/LaunchCampaign.json";
import { useWallet } from "@/hooks/useWallet";
import { getActiveChainId, type SupportedChainId } from "@/lib/chainConfig";
import { getReadProvider } from "@/lib/readProvider";

const CAMPAIGN_ABI = (LaunchCampaignArtifact as any)?.abi ?? LaunchCampaignArtifact;

// Keep this lower on public RPCs. You can increase later once you move to a paid RPC.
const LOOKBACK_BLOCKS_DEFAULT = 8_000;

// Chunk size for eth_getLogs
const LOG_CHUNK_SIZE = 700;

type TimeframeKey = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAME_TO_SECONDS: Record<TimeframeKey, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export type CurveCandle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimitish(e: any): boolean {
  const code = e?.code ?? e?.error?.code ?? e?.info?.error?.code;
  const msg = String(e?.message ?? e?.info?.error?.message ?? "").toLowerCase();
  return (
    code === -32005 ||
    msg.includes("rate limit") ||
    msg.includes("limit exceeded") ||
    msg.includes("triggered rate limit")
  );
}

async function withBackoff<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: any = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isRateLimitish(e) || i === retries) break;
      await sleep(200 * (i + 1) * (i + 1));
    }
  }
  throw lastErr;
}

function createSemaphore(max: number) {
  let inFlight = 0;
  const queue: Array<() => void> = [];

  const acquire = async () => {
    if (inFlight < max) {
      inFlight++;
      return;
    }
    await new Promise<void>((resolve) => queue.push(resolve));
    inFlight++;
  };

  const release = () => {
    inFlight--;
    const next = queue.shift();
    if (next) next();
  };

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

// Only allow one curve log scan at a time (per browser tab)
const runCurveScanLimited = createSemaphore(1);

async function getLogsChunked(
  provider: ethers.Provider,
  params: { address: string; topics?: (string | string[] | null)[] },
  fromBlock: number,
  toBlock: number
) {
  const out: any[] = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_SIZE) {
    const end = Math.min(toBlock, start + LOG_CHUNK_SIZE - 1);

    const chunk = await withBackoff(
      () => provider.getLogs({ ...params, fromBlock: start, toBlock: end } as any),
      3
    );

    out.push(...chunk);
    await sleep(80);
  }
  return out;
}

function aggregateCandles(trades: { time: number; price: number; amount: number }[], tfSec: number): CurveCandle[] {
  if (!trades.length) return [];

  // trades must be sorted by time asc
  const candles: CurveCandle[] = [];
  let curBucket = Math.floor(trades[0].time / tfSec) * tfSec;

  let open = trades[0].price;
  let high = trades[0].price;
  let low = trades[0].price;
  let close = trades[0].price;
  let volume = 0;

  for (const t of trades) {
    const bucket = Math.floor(t.time / tfSec) * tfSec;

    if (bucket !== curBucket) {
      candles.push({ time: curBucket, open, high, low, close, volume });

      curBucket = bucket;
      open = t.price;
      high = t.price;
      low = t.price;
      close = t.price;
      volume = 0;
    }

    high = Math.max(high, t.price);
    low = Math.min(low, t.price);
    close = t.price;
    volume += t.amount;
  }

  candles.push({ time: curBucket, open, high, low, close, volume });
  return candles;
}

export function useCurveTrades(campaignAddress?: string | null, lookbackBlocks?: number) {
  const { chainId: walletChainId } = useWallet() as any;

  const activeChainId = useMemo<SupportedChainId>(() => {
    return getActiveChainId(walletChainId) as SupportedChainId;
  }, [walletChainId]);

  const provider = useMemo(() => getReadProvider(activeChainId), [activeChainId]);

  const [timeframe, setTimeframe] = useState<TimeframeKey>("1m");
  const [candles, setCandles] = useState<CurveCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // used to ignore stale async results
  const reqIdRef = useRef(0);

  const refresh = useCallback(() => {
    reqIdRef.current += 1;
  }, []);

  const load = useCallback(async () => {
    if (!campaignAddress) {
      setCandles([]);
      setError(null);
      return;
    }

    const myReqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);

    try {
      await runCurveScanLimited(async () => {
        // if something else refreshed while we were waiting, abort early
        if (myReqId !== reqIdRef.current) return;

        const campaign = new Contract(campaignAddress, CAMPAIGN_ABI, provider) as any;
        const iface = new ethers.Interface(CAMPAIGN_ABI);

        const latest = await provider.getBlockNumber();
        const lb = Math.max(500, lookbackBlocks ?? LOOKBACK_BLOCKS_DEFAULT);
        const fromBlock = Math.max(0, latest - lb);

        // Topics
        const buyTopic = iface.getEvent("TokensPurchased").topicHash;
        const sellTopic = iface.getEvent("TokensSold").topicHash;

        // Pull logs sequentially (parallel is what tends to trip public RPCs)
        const buyLogs = await getLogsChunked(
          provider,
          { address: campaignAddress, topics: [buyTopic] },
          fromBlock,
          latest
        );

        const sellLogs = await getLogsChunked(
          provider,
          { address: campaignAddress, topics: [sellTopic] },
          fromBlock,
          latest
        );

        // Block timestamp cache
        const blockTimeCache = new Map<number, number>();
        const getBlockTime = async (bn: number): Promise<number> => {
          const cached = blockTimeCache.get(bn);
          if (cached) return cached;

          const block = await withBackoff(() => provider.getBlock(bn) as any, 3);
          const t = Number((block as any)?.timestamp ?? 0);
          blockTimeCache.set(bn, t);
          // small pacing for getBlock as well
          await sleep(40);
          return t;
        };

        const trades: { time: number; price: number; amount: number }[] = [];

        for (const log of buyLogs) {
          const parsed = iface.parseLog(log);
          const costWei = parsed.args.cost as bigint;
          const tokensWei = parsed.args.tokens as bigint;

          const ts = await getBlockTime(log.blockNumber);
          const cost = Number(ethers.formatEther(costWei));
          const tokens = Number(ethers.formatUnits(tokensWei, 18));
          const price = tokens > 0 ? cost / tokens : 0;

          if (Number.isFinite(price) && price > 0) {
            trades.push({ time: ts, price, amount: tokens });
          }
        }

        for (const log of sellLogs) {
          const parsed = iface.parseLog(log);
          const payoutWei = parsed.args.payout as bigint;
          const tokensWei = parsed.args.tokens as bigint;

          const ts = await getBlockTime(log.blockNumber);
          const payout = Number(ethers.formatEther(payoutWei));
          const tokens = Number(ethers.formatUnits(tokensWei, 18));
          const price = tokens > 0 ? payout / tokens : 0;

          if (Number.isFinite(price) && price > 0) {
            trades.push({ time: ts, price, amount: tokens });
          }
        }

        // If another refresh happened mid-flight, ignore results
        if (myReqId !== reqIdRef.current) return;

        trades.sort((a, b) => a.time - b.time);

        const tfSec = TIMEFRAME_TO_SECONDS[timeframe];
        const aggregated = aggregateCandles(trades, tfSec);

        setCandles(aggregated);
      });
    } catch (e: any) {
      // If another request superseded us, ignore error
      if (myReqId !== reqIdRef.current) return;

      console.warn("[useCurveTrades] failed", e);
      setError(String(e?.message ?? e));
      setCandles([]);
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }, [campaignAddress, provider, timeframe, lookbackBlocks]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    timeframe,
    setTimeframe,
    candles,
    loading,
    error,
    refresh,
  };
}
