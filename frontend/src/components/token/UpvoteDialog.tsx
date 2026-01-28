import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useBnbUsdPrice } from "@/hooks/useBnbUsdPrice";
import { getActiveChainId, getVoteTreasuryAddress } from "@/lib/chainConfig";

const UPVOTE_ABI = [
  "function voteWithBNB(address campaign, bytes32 meta) payable",
  "function assetConfig(address asset) view returns (bool enabled, uint256 minAmount)",
];

function safeLowerHex(s?: string | null): string {
  const v = String(s ?? "").trim();
  return v ? v.toLowerCase() : "";
}

type Props = {
  campaignAddress: string;
  className?: string;
  buttonVariant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  buttonSize?: "default" | "sm" | "lg" | "icon";
};

/**
 * Upvote Dialog (BNB-only for v1)
 * - Reads minAmount for native (address(0)) from the UPVoteTreasury contract
 * - Suggests ~$1 in BNB using live BNB/USD price (best-effort)
 * - Sends one payable tx => one vote
 */
export function UpvoteDialog({
  campaignAddress,
  className,
  buttonVariant = "secondary",
  buttonSize = "sm",
}: Props) {
  const { toast } = useToast();
  const wallet = useWallet();
  const { priceUsd } = useBnbUsdPrice();

  const chainId = getActiveChainId(wallet.chainId);
  const treasuryAddress = useMemo(() => {
    return safeLowerHex(getVoteTreasuryAddress(chainId));
  }, [chainId]);

  const [open, setOpen] = useState(false);
  const [loadingCfg, setLoadingCfg] = useState(false);
  const [minAmountWei, setMinAmountWei] = useState<bigint | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [hasContractCode, setHasContractCode] = useState<boolean | null>(null);
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [estTotalWei, setEstTotalWei] = useState<bigint | null>(null);
  const [insufficient, setInsufficient] = useState<boolean>(false);
  const [amountBnb, setAmountBnb] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);


// Load wallet BNB balance when dialog opens / account changes
useEffect(() => {
  if (!open) return;
  if (!wallet.provider) return;
  if (!wallet.account) {
    setBalanceWei(null);
    return;
  }
  let cancelled = false;
  (async () => {
    try {
      const bal = await wallet.provider.getBalance(wallet.account);
      if (cancelled) return;
      setBalanceWei(BigInt(bal));
    } catch {
      if (cancelled) return;
      setBalanceWei(null);
    }
  })();
  return () => {
    cancelled = true;
  };
}, [open, wallet.provider, wallet.account, chainId]);


  const suggestedBnb = useMemo(() => {
    const p = Number(priceUsd ?? 0);
    if (!Number.isFinite(p) || p <= 0) return null;
    const bnb = 1 / p; // ~$1
    // show with 6 decimals for UX
    return String(Math.max(0, bnb).toFixed(6));
  }, [priceUsd]);

  // Load minAmount + enabled whenever dialog opens (or chain changes)
  useEffect(() => {
    if (!open) return;
    if (!treasuryAddress) {
      setMinAmountWei(null);
      setEnabled(false);
      setHasContractCode(null);
      return;
    }
    if (!wallet.provider) return;

    let cancelled = false;
    setLoadingCfg(true);
    (async () => {
      try {
        // Guardrail: if the address has no bytecode, the contract is not deployed on this chain.
        const code = await wallet.provider.getCode(treasuryAddress);
        const hasCode = code != null && code !== "0x";
        if (cancelled) return;
        setHasContractCode(hasCode);
        if (!hasCode) {
          setEnabled(false);
          setMinAmountWei(null);
          return;
        }

        const c = new ethers.Contract(treasuryAddress, UPVOTE_ABI, wallet.provider);
        const res = await c.assetConfig(ethers.ZeroAddress);
        // ethers v6 returns a Result: [enabled, minAmount] + named props
        const isEnabled = Boolean(res?.enabled ?? res?.[0]);
        const min = BigInt(res?.minAmount ?? res?.[1] ?? 0);
        if (cancelled) return;
        setEnabled(isEnabled);
        setMinAmountWei(min);

        // Pre-fill amount as max(minAmount, suggested ~$1)
        let minBnb = "";
        try {
          minBnb = ethers.formatEther(min);
        } catch {
          minBnb = "";
        }

        const minNum = Number(minBnb || "0");
        const sugNum = Number(suggestedBnb || "0");
        const chosen = Math.max(minNum, sugNum || 0);
        setAmountBnb(
          chosen > 0 ? chosen.toFixed(6) : (minBnb ? String(minBnb) : "")
        );
      } catch (e: any) {
        if (cancelled) return;
        setEnabled(false);
        setMinAmountWei(null);
        setHasContractCode(false);
      } finally {
        if (!cancelled) setLoadingCfg(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, treasuryAddress, wallet.provider, suggestedBnb]);

  const humanMin = useMemo(() => {
    if (minAmountWei == null) return "—";
    try {
      return ethers.formatEther(minAmountWei);
    } catch {
      return "—";
    }
  }, [minAmountWei]);


// Estimate total cost (value + gas) and mark insufficient balance.
useEffect(() => {
  if (!open) return;
  if (!wallet.provider) return;
  if (!wallet.account) return;
  if (!treasuryAddress) return;
  if (hasContractCode === false) return;
  if (!enabled) return;

  let cancelled = false;
  (async () => {
    try {
      // Parse value
      let valueWei: bigint;
      try {
        valueWei = ethers.parseEther(String(amountBnb || "0"));
      } catch {
        setEstTotalWei(null);
        setInsufficient(false);
        return;
      }
      if (valueWei <= 0n) {
        setEstTotalWei(null);
        setInsufficient(false);
        return;
      }
      if (minAmountWei != null && valueWei < minAmountWei) {
        // Too low amount is handled elsewhere; don't flag as insufficient.
        setEstTotalWei(null);
        setInsufficient(false);
        return;
      }

      const provider = wallet.provider;
      const fee = await provider.getFeeData();
      const gasPrice = BigInt(fee.gasPrice ?? 0n);

      // If gas price is missing, fall back to just value comparison.
      if (gasPrice === 0n) {
        setEstTotalWei(valueWei);
        if (balanceWei != null) setInsufficient(balanceWei < valueWei);
        return;
      }

      const c = new ethers.Contract(treasuryAddress, UPVOTE_ABI, provider);
      const meta = ethers.keccak256(ethers.toUtf8Bytes("user"));
      let gasLimit: bigint;
      try {
        gasLimit = BigInt(await c.voteWithBNB.estimateGas(campaignAddress, meta, { value: valueWei }));
      } catch {
        // If estimation fails for any reason, use a conservative fallback.
        gasLimit = 150000n;
      }

      // Add a buffer (20%) to avoid borderline failures
      const bufferedGas = (gasLimit * 120n) / 100n;
      const total = valueWei + bufferedGas * gasPrice;

      if (cancelled) return;
      setEstTotalWei(total);
      if (balanceWei != null) setInsufficient(balanceWei < total);
    } catch {
      if (cancelled) return;
      setEstTotalWei(null);
      setInsufficient(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [open, wallet.provider, wallet.account, treasuryAddress, hasContractCode, enabled, amountBnb, minAmountWei, campaignAddress, balanceWei]);

  const canUpvote = Boolean(
    treasuryAddress &&
      hasContractCode !== false &&
      enabled &&
      campaignAddress &&
      wallet.provider &&
      amountBnb &&
      Number(amountBnb) > 0 && !insufficient
  );

  const handleUpvote = async () => {
    try {
      if (!treasuryAddress) {
        toast({ title: "UP Vote is not configured", description: "Missing vote treasury address for this chain." });
        return;
      }
      if (hasContractCode === false) {
        toast({
          title: "UP Vote contract not deployed",
          description: "The configured vote treasury address has no contract code on this network. Switch networks or update the contract address.",
        });
        return;
      }
      if (!wallet.signer) {
        await wallet.connect();
      }
      if (!wallet.signer) {
        toast({ title: "Wallet not connected", description: "Please connect your wallet to upvote." });
        return;
      }

      // Validate amount
      let valueWei: bigint;
      try {
        valueWei = ethers.parseEther(String(amountBnb));
      } catch {
        toast({ title: "Invalid amount", description: "Enter a valid BNB amount." });
        return;
      }
      if (minAmountWei != null && valueWei < minAmountWei) {
        toast({
          title: "Amount too low",
          description: `Minimum is ${humanMin} BNB for 1 vote.`,
        });
        return;
      }


// Check balance (value + estimated gas)
if (balanceWei != null) {
  // If we computed estTotalWei, use it; else at least ensure value fits.
  const needed = estTotalWei ?? valueWei;
  if (balanceWei < needed) {
    toast({
      title: "Insufficient BNB",
      description: "You don't have enough BNB to cover the vote fee (and gas).",
    });
    return;
  }
}

      setSubmitting(true);
      const c = new ethers.Contract(treasuryAddress, UPVOTE_ABI, wallet.signer);
      const meta = ethers.keccak256(ethers.toUtf8Bytes("user"));
      const tx = await c.voteWithBNB(campaignAddress, meta, { value: valueWei });

      toast({ title: "Upvote sent", description: "Waiting for confirmation…" });
      await tx.wait();
      toast({ title: "Upvoted", description: "Your vote has been recorded." });
      setOpen(false);
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || "Transaction failed");
      toast({ title: "Upvote failed", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          className={className}
          disabled={!treasuryAddress}
          title={!treasuryAddress ? "UP Vote treasury not configured" : "Upvote"}
        >
          UP Vote
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>UP Vote</DialogTitle>
          <DialogDescription>
            Pay a small BNB fee to upvote this campaign. 1 transaction = 1 vote.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {loadingCfg ? (
              "Loading fee…"
            ) : enabled ? (
              <>
                Minimum fee: <span className="text-foreground">{humanMin} BNB</span>
                {suggestedBnb ? (
                  <>
                    {" "}• Suggested (~$1): <span className="text-foreground">{suggestedBnb} BNB</span>
                  </>
                ) : null}
              </>
            ) : (
              "UP Vote is currently disabled on this chain."
            )}
          </div>


<div className="text-xs text-muted-foreground">
  Balance:{" "}
  <span className="text-foreground">
    {balanceWei != null ? `${Number(ethers.formatEther(balanceWei)).toFixed(6)} BNB` : "—"}
  </span>
  {insufficient ? (
    <span className="ml-2 text-destructive">Insufficient for this vote.</span>
  ) : null}
</div>

          <div className="flex items-center gap-2">
            <Input
              value={amountBnb}
              onChange={(e) => setAmountBnb(e.target.value)}
              placeholder="0.001"
              inputMode="decimal"
            />
            <div className="text-sm text-muted-foreground">BNB</div>
          </div>

          <div className="text-xs text-muted-foreground">
            Off-chain cooldown & daily caps apply to keep the list fair.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpvote}
            disabled={!canUpvote || submitting || loadingCfg}
          >
            {submitting ? "Upvoting…" : "Confirm Upvote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
