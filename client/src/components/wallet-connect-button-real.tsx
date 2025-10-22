import { Button } from "@/components/ui/button";
import { Wallet, Loader2, AlertTriangle } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface WalletConnectButtonRealProps {
  onSmartAccountCreated?: () => void;
  compact?: boolean; // Compact mode for header
}

export function WalletConnectButtonReal({ onSmartAccountCreated, compact = false }: WalletConnectButtonRealProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    connected,
    connecting,
    account,
    isCorrectChain,
    smartAccount,
    isCreatingSmartAccount,
    connect,
    switchToMonad,
    createSmartAccount,
  } = useWallet();

  const handleFullConnect = async () => {
    console.error("[CRITICAL] handleFullConnect called - this proves click works");
    setIsProcessing(true);
    console.log("[WalletConnect] Button clicked, starting connection flow");

    // Check if MetaMask is available (ignore other wallets)
    const win = typeof window !== "undefined" ? (window as any) : undefined;
    const metaMaskProvider = win?.ethereum?.providers?.find((p: any) => p && p.isMetaMask) || (win?.ethereum?.isMetaMask ? win.ethereum : undefined);
    const hasMetaMask = !!metaMaskProvider;
    console.log("[WalletConnect] MetaMask detected:", hasMetaMask);

    if (!hasMetaMask) {
      console.error("[CRITICAL] MetaMask not found (other wallets detected). Showing install prompt.");
      toast({
        title: "MetaMask Required",
        description: "Please install the MetaMask extension (disable Backpack/Razor/Nightly) and refresh.",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    try {
      // Step 1: Connect MetaMask
      if (!connected) {
        console.log("[WalletConnect] Initiating MetaMask connection");
        toast({
          title: "Connecting to MetaMask",
          description: "Please approve the connection request in MetaMask.",
        });

        await connect();
        console.log("[WalletConnect] MetaMask connection successful");

        toast({
          title: "MetaMask Connected",
          description: "Now switching to Monad testnet...",
        });
      } else {
        console.log("[WalletConnect] Already connected to MetaMask");
      }

      // Step 2: Switch to Monad testnet
      if (!isCorrectChain) {
        console.log("[WalletConnect] Switching to Monad testnet, isCorrectChain:", isCorrectChain);
        toast({
          title: "Switching Network",
          description: "Please approve the network switch in MetaMask.",
        });

        await switchToMonad();
        console.log("[WalletConnect] Network switch successful");

        toast({
          title: "Network Switched",
          description: "Connected to Monad testnet. Creating smart account...",
        });
      } else {
        console.log("[WalletConnect] Already on correct chain");
      }

      // Start backend monitoring for the EOA immediately (auto-ingest, no manual input)
      try {
        if (account) {
          await fetch('/api/monitor/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: [account] }),
          }).catch(() => {});
        }
      } catch (_) {}

      // Step 3: Create smart account
      if (!smartAccount && account) {
        console.log("[WalletConnect] Creating smart account for:", account);
        toast({
          title: "Creating Smart Account",
          description: "Setting up your MetaMask smart account with delegation capabilities...",
        });

        await createSmartAccount(account);
        console.log("[WalletConnect] Smart account created successfully");

        toast({
          title: "Smart Account Created",
          description: "Your DeFi Guardian is now active and monitoring!",
        });

        onSmartAccountCreated?.();
      } else {
        console.log("[WalletConnect] Smart account already exists or no account connected", { smartAccount, account });
      }
    } catch (error: any) {
      console.error("[WalletConnect] Connection error:", error);
      const errorMsg = error?.message || "Failed to complete setup. Please try again.";
      console.error("[WalletConnect] Error message:", errorMsg);

      toast({
        title: "Connection Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      console.log("[WalletConnect] Connection flow completed");
    }
  };

  // Already have smart account
  if (smartAccount) {
    return null;
  }

  // Show network warning if connected but wrong chain
  if (connected && !isCorrectChain) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            Please switch to Monad Testnet to continue.
          </AlertDescription>
        </Alert>
        <Button
          onClick={handleFullConnect}
          disabled={isProcessing}
          size="lg"
          className="w-full shadow-md"
          data-testid="button-switch-network"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Switching Network...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-5 w-5" />
              Switch to Monad Testnet
            </>
          )}
        </Button>
      </div>
    );
  }

  const isLoading = connecting || isCreatingSmartAccount || isProcessing;

  // Compact mode for header
  if (compact) {
    return (
      <Button
        onClick={handleFullConnect}
        disabled={isLoading}
        className="shadow-sm"
        data-testid="button-wallet-connect"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {connecting ? "Connecting..." : 
             isCreatingSmartAccount ? "Creating..." :
             "Processing..."}
          </>
        ) : (
          <>
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </>
        )}
      </Button>
    );
  }

  // Full mode for hero section
  return (
    <Button
      onClick={handleFullConnect}
      disabled={isLoading}
      size="lg"
      className="w-full shadow-md"
      data-testid="button-wallet-connect"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {connecting ? "Connecting MetaMask..." : 
           isCreatingSmartAccount ? "Creating Smart Account..." :
           "Processing..."}
        </>
      ) : (
        <>
          <Wallet className="mr-2 h-5 w-5" />
          Connect MetaMask Smart Account
        </>
      )}
    </Button>
  );
}
