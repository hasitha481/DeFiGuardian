import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSDK } from "@metamask/sdk-react";
import { monadTestnet } from "@/lib/chains";
import type { SmartAccount } from "@shared/schema";

interface WalletContextValue {
  // MetaMask SDK state
  connected: boolean;
  connecting: boolean;
  account: string | undefined;
  chainId: string | undefined;
  isCorrectChain: boolean;
  provider: any;
  
  // Smart account state (shared across all components)
  smartAccount: SmartAccount | null;
  isCreatingSmartAccount: boolean;
  
  // Actions
  connect: () => Promise<string>;
  disconnect: () => void;
  switchToMonad: () => Promise<void>;
  createSmartAccount: (ownerAddress: string) => Promise<SmartAccount>;
  setSmartAccount: (account: SmartAccount | null) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { sdk, connected, connecting, provider, chainId, account } = useSDK();
  const [smartAccount, setSmartAccount] = useState<SmartAccount | null>(null);
  const [isCreatingSmartAccount, setIsCreatingSmartAccount] = useState(false);

  const isCorrectChain = chainId === `0x${monadTestnet.id.toString(16)}`;

  const connect = useCallback(async () => {
    if (!sdk) {
      throw new Error("SDK not initialized");
    }
    const accounts = await sdk.connect();
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found");
    }
    return accounts[0];
  }, [sdk]);

  const switchToMonad = useCallback(async () => {
    if (!provider) {
      throw new Error("Provider not available");
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${monadTestnet.id.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${monadTestnet.id.toString(16)}`,
              chainName: monadTestnet.name,
              nativeCurrency: monadTestnet.nativeCurrency,
              rpcUrls: [monadTestnet.rpcUrls.default.http[0]],
              blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }, [provider]);

  const createSmartAccountFn = useCallback(async (ownerAddress: string) => {
    setIsCreatingSmartAccount(true);
    
    try {
      // If running inside an iframe (Builder preview), warn the user that wallet flow may be limited
      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isInIframe) {
        console.warn("createSmartAccount called inside iframe; MetaMask may not work in this environment.");
      }

      const response = await fetch("/api/smart-account/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAddress }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to create smart account");
      }

      const account = await response.json();
      setSmartAccount(account);
      return account;
    } catch (error: any) {
      console.error("Failed to create smart account:", error);
      throw new Error(error?.message || "Failed to create smart account");
    } finally {
      setIsCreatingSmartAccount(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (sdk) {
      sdk.terminate();
    }
    setSmartAccount(null);
  }, [sdk]);

  // Listen for account changes (guard against multiple injected providers / injection failures)
  useEffect(() => {
    if (!provider) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      try {
        const accounts = args[0] as string[];
        if (accounts.length === 0) {
          setSmartAccount(null);
        }
      } catch (err) {
        console.warn("accountsChanged handler error:", err);
      }
    };

    const handleChainChanged = () => {
      try {
        window.location.reload();
      } catch (err) {
        console.warn("chainChanged handler error:", err);
      }
    };

    try {
      // Some injected providers may throw when adding listeners; guard against it
      if (typeof provider.on === "function") {
        provider.on("accountsChanged", handleAccountsChanged);
        provider.on("chainChanged", handleChainChanged);
      }
    } catch (err) {
      console.warn("Failed to attach provider listeners:", err);
    }

    return () => {
      try {
        if (typeof provider.removeListener === "function") {
          provider.removeListener("accountsChanged", handleAccountsChanged);
          provider.removeListener("chainChanged", handleChainChanged);
        }
      } catch (err) {
        /* ignore */
      }
    };
  }, [provider]);

  const value: WalletContextValue = {
    connected,
    connecting,
    account,
    chainId,
    isCorrectChain,
    provider,
    smartAccount,
    isCreatingSmartAccount,
    connect,
    disconnect,
    switchToMonad,
    createSmartAccount: createSmartAccountFn,
    setSmartAccount,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
