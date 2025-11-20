import { BrowserProvider, JsonRpcSigner } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";

type WalletHook = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string;
  chainId?: number;
  connecting: boolean;
  connect: () => Promise<void>;
  isConnected: boolean;
};

export function useWallet(): WalletHook {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number>();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    const browserProvider = new BrowserProvider(window.ethereum);
    setProvider(browserProvider);

    const handleAccountsChanged = (accounts: string[]) => {
      const primary = accounts[0] ?? "";
      setAccount(primary);
      if (primary) {
        browserProvider.getSigner().then(setSigner).catch(() => setSigner(null));
      } else {
        setSigner(null);
      }
    };

    const handleChainChanged = (hexChainId: string) => {
      try {
        setChainId(Number(BigInt(hexChainId)));
      } catch {
        setChainId(undefined);
      }
    };

    browserProvider
      .send("eth_accounts", [])
      .then(handleAccountsChanged)
      .catch(() => undefined);

    browserProvider
      .getNetwork()
      .then((network) => setChainId(Number(network.chainId)))
      .catch(() => undefined);

    window.ethereum?.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum?.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!provider) {
      throw new Error("No wallet available");
    }
    setConnecting(true);
    try {
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      if (accounts.length === 0) {
        throw new Error("No accounts returned");
      }
      const signerInstance = await provider.getSigner();
      setSigner(signerInstance);
      setAccount(accounts[0]);
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  return useMemo(
    () => ({
      provider,
      signer,
      account,
      chainId,
      connecting,
      connect,
      isConnected: Boolean(account),
    }),
    [provider, signer, account, chainId, connecting, connect]
  );
}
