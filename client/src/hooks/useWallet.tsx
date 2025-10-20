import { useSDK } from "@metamask/sdk-react";
import { useCallback, useEffect, useState } from "react";
import { monadTestnet } from "@/lib/chains";
import type { SmartAccount } from "@shared/schema";

export function useWallet() {
  const { sdk, connected, connecting, provider, chainId, account } = useSDK();
  const [smartAccount, setSmartAccount] = useState<SmartAccount | null>(null);
  const [isCreatingSmartAccount, setIsCreatingSmartAccount] = useState(false);

  // Check if connected to Monad testnet
  const isCorrectChain = chainId === `0x${monadTestnet.id.toString(16)}`;

  const connect = useCallback(async () => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }

      // Connect to MetaMask
      const accounts = await sdk.connect();
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      return accounts[0];
    } catch (error) {
      console.error("Failed to connect:", error);
      throw error;
    }
  }, [sdk]);

  const switchToMonad = useCallback(async () => {
    if (!provider) {
      throw new Error("Provider not available");
    }

    try {
      // Try to switch to Monad testnet
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${monadTestnet.id.toString(16)}` }],
      });
    } catch (switchError: any) {
      // Chain doesn't exist, add it
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

  const createSmartAccount = useCallback(async (ownerAddress: string) => {
    setIsCreatingSmartAccount(true);
    
    try {
      // Call backend to create/register smart account with Delegation Toolkit
      const response = await fetch("/api/smart-account/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAddress }),
      });

      if (!response.ok) {
        throw new Error("Failed to create smart account");
      }

      const account = await response.json();
      setSmartAccount(account);
      return account;
    } catch (error) {
      console.error("Failed to create smart account:", error);
      throw error;
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

  // Listen for account changes
  useEffect(() => {
    if (!provider) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        setSmartAccount(null);
      }
    };

    const handleChainChanged = () => {
      // Reload on chain change for safety
      window.location.reload();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider]);

  return {
    // Connection state
    connected,
    connecting,
    account,
    chainId,
    isCorrectChain,
    
    // Smart account
    smartAccount,
    isCreatingSmartAccount,
    
    // Actions
    connect,
    disconnect,
    switchToMonad,
    createSmartAccount,
    
    // Provider for transactions
    provider,
  };
}
