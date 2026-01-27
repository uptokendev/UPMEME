import { ethers } from "ethers";
import { getPublicRpcUrls, type SupportedChainId } from "./chainConfig";

// Cache 1 provider per chain id
const providerCache = new Map<number, ethers.Provider>();

function networkName(chainId: number) {
  return chainId === 56 ? "bsc" : "bsc-testnet";
}

/**
 * Read-only JSON-RPC provider for public data (logs, reads).
 *
 * IMPORTANT:
 * - We DISABLE batching (batchMaxCount: 1) because public BSC endpoints
 *   often rate-limit when getLogs requests are batched.
 * - We set staticNetwork to avoid extra "detectNetwork" chatter.
 */
export function getReadProvider(chainId: SupportedChainId): ethers.Provider {
  const cached = providerCache.get(chainId);
  if (cached) return cached;

  const urls = getPublicRpcUrls(chainId);
  if (!urls.length) {
    throw new Error(`Missing public RPC url for chainId=${chainId}`);
  }

  const network = { chainId, name: networkName(chainId) } as any;

  const mk = (url: string) =>
    new ethers.JsonRpcProvider(
      url,
      network,
      {
        staticNetwork: true,
        // Disable batching to reduce "-32005 rate limit" issues
        batchMaxCount: 1,
        batchStallTime: 0,
      } as any
    );

  // If multiple RPCs are configured (comma-separated env), use a FallbackProvider.
  // This prevents the UI from completely breaking when one endpoint rate-limits.
  const provider: ethers.Provider =
    urls.length === 1
      ? mk(urls[0])
      : new ethers.FallbackProvider(
          urls.map((u, i) => ({
            provider: mk(u),
            priority: i + 1,
            weight: 1,
            stallTimeout: 1500,
          })),
          1 // quorum
        );

  providerCache.set(chainId, provider);
  return provider;
}
