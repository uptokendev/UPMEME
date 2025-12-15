import type { RawTradeEvent, Transaction } from "@/types/token";

// App convention: everything is expressed in BNB (no USD conversion)
export function mapRawTradeToTransaction(
  raw: RawTradeEvent,
  opts?: { marketCapBnb?: string }
): Transaction {
  const date = new Date(raw.timestamp * 1000);

  const bnb = Number(raw.baseAmountWei) / 1e18;
  const token = Number(raw.tokenAmount) / 1e18;
  const price = token > 0 ? bnb / token : 0;

  return {
    time: date.toLocaleTimeString(), // e.g. "14:32:11" (you can switch to relative-time if you prefer)
    type: raw.side,
    amount: token.toFixed(0),
    bnb: `${bnb.toFixed(4)} BNB`,
    price: `${price.toFixed(8)} BNB`,
    mcap: opts?.marketCapBnb ?? "—",
    trader: shortenAddress(raw.trader),
    tx: raw.txHash,
  };
}

function shortenAddress(addr: string): string {
  if (!addr) return "";
  return addr.length > 10
    ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
    : addr;
}
