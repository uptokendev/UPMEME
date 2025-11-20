/// <reference types="vite/client" />

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
