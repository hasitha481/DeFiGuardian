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

  // Robust provider detection with EIP-6963 support
  const selectInjectedProvider = () => {
    try {
      const win = window as any;
      if (win && win.ethereum) {
        if (Array.isArray(win.ethereum.providers) && win.ethereum.providers.length > 0) {
          const mm = win.ethereum.providers.find((p: any) => p.isMetaMask);
          return mm || win.ethereum.providers.find((p: any) => !!p) || win.ethereum.providers[0];
        }
        if (win.ethereum.isMetaMask) return win.ethereum;
        return win.ethereum;
      }
    } catch (err) {
      console.warn('selectInjectedProvider error', err);
    }
    return undefined;
  };

  const requestEip6963Provider = async (timeoutMs = 400): Promise<any | undefined> => {
    try {
      const announced: any[] = [];
      const onAnnounce = (event: any) => {
        try { announced.push(event?.detail?.provider); } catch (_) {}
      };
      window.addEventListener('eip6963:announceProvider', onAnnounce as any);
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      await new Promise((r) => setTimeout(r, timeoutMs));
      window.removeEventListener('eip6963:announceProvider', onAnnounce as any);
      if (announced.length > 0) {
        const mm = announced.find((p) => p && p.isMetaMask);
        return mm || announced[0];
      }
    } catch (err) {
      console.warn('EIP-6963 discovery failed', err);
    }
    return undefined;
  };

  const getPreferredProvider = async (): Promise<any | undefined> => {
    const injected = selectInjectedProvider();
    if (injected) return injected;
    const discovered = await requestEip6963Provider();
    if (discovered) return discovered;
    return provider; // fallback from SDK if available
  };

  const effectiveProvider = provider || selectInjectedProvider();

  const connect = useCallback(async () => {
    console.log("[WalletContext.connect] Starting connection");
    let accounts: string[] | undefined = undefined;

    // Prefer direct connection to injected MetaMask to avoid SDK provider re-injection issues
    try {
      console.log("[WalletContext.connect] Attempting direct provider request");
      const eff = await getPreferredProvider();
      console.log("[WalletContext.connect] Preferred provider:", !!eff);
      if (eff && typeof eff.request === 'function') {
        console.log("[WalletContext.connect] Sending eth_requestAccounts");
        const result = await eff.request({ method: 'eth_requestAccounts' });
        console.log("[WalletContext.connect] Got result:", result);
        accounts = Array.isArray(result) ? result : undefined;
      }
    } catch (err) {
      console.warn("[WalletContext.connect] Direct request failed:", err);
      // ignore and fallback to SDK
    }

    if ((!accounts || accounts.length === 0) && sdk) {
      try {
        console.log("[WalletContext.connect] Trying SDK connect");
        accounts = await sdk.connect();
        console.log("[WalletContext.connect] SDK connect result:", accounts);
      } catch (err) {
        console.warn("[WalletContext.connect] SDK connect failed:", err);
        // last resort: re-attempt injected provider
        const eff2 = await getPreferredProvider();
        if (eff2 && typeof eff2.request === 'function') {
          const result = await eff2.request({ method: 'eth_requestAccounts' });
          accounts = Array.isArray(result) ? result : undefined;
        }
      }
    }

    if (!accounts || accounts.length === 0) {
      const err = "No accounts found. Ensure MetaMask is installed and unlocked.";
      console.error("[WalletContext.connect]", err);
      throw new Error(err);
    }
    console.log("[WalletContext.connect] Connection successful, account:", accounts[0]);
    return accounts[0];
  }, [sdk]);

  const switchToMonad = useCallback(async () => {
    const eff = effectiveProvider || (await getPreferredProvider());
    if (!eff) {
      throw new Error("Provider not available");
    }

    try {
      await eff.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${monadTestnet.id.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await eff.request({
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
  }, [provider, effectiveProvider]);

  const createSmartAccountFn = useCallback(async (ownerAddress: string) => {
    setIsCreatingSmartAccount(true);

    try {
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

      // Immediately start backend monitoring for the newly created smart account and the owner EOA
      try {
        const addresses = [account?.address, ownerAddress].filter(Boolean);
        if (addresses.length > 0) {
          await fetch('/api/monitor/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses }),
          }).catch(() => {});
        }
      } catch (_) {}

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
    if (!effectiveProvider) return;

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
      if (typeof effectiveProvider.on === "function") {
        effectiveProvider.on("accountsChanged", handleAccountsChanged);
        effectiveProvider.on("chainChanged", handleChainChanged);
      }
    } catch (err) {
      console.warn("Failed to attach provider listeners:", err);
    }

    return () => {
      try {
        if (typeof effectiveProvider.removeListener === "function") {
          effectiveProvider.removeListener("accountsChanged", handleAccountsChanged);
          effectiveProvider.removeListener("chainChanged", handleChainChanged);
        }
      } catch (err) {}
    };
  }, [effectiveProvider]);

  // Auto-start backend monitoring for the connected EOA when on Monad
  useEffect(() => {
    const start = async () => {
      try {
        const addr = account?.toLowerCase();
        if (!addr) return;
        if (!isCorrectChain) return;
        await fetch('/api/monitor/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: [addr] }),
        }).catch(() => {});
      } catch (_) {}
    };
    start();
  }, [account, isCorrectChain]);

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
