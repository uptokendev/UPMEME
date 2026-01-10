import { ethers } from "ethers";
import { getPublicRpcUrl, type SupportedChainId } from "./chainConfig";

// Cache 1 provider per chain id
const providerCache = new Map<number, ethers.JsonRpcProvider>();

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
export function getReadProvider(chainId: SupportedChainId): ethers.JsonRpcProvider {
  const cached = providerCache.get(chainId);
  if (cached) return cached;

  const url = getPublicRpcUrl(chainId);
  if (!url) {
    throw new Error(`Missing public RPC url for chainId=${chainId}`);
  }

  const network = { chainId, name: networkName(chainId) } as any;

  const provider = new ethers.JsonRpcProvider(
    url,
    network,
    {
      staticNetwork: true,
      // Disable batching to reduce "-32005 rate limit" issues
      batchMaxCount: 1,
      batchStallTime: 0,
    } as any
  );

  providerCache.set(chainId, provider);
  return provider;
}
