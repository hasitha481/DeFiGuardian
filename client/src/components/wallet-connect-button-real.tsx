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
    setIsProcessing(true);
    
    try {
      // Step 1: Connect MetaMask
      if (!connected) {
        toast({
          title: "Connecting to MetaMask",
          description: "Please approve the connection request in MetaMask.",
        });
        
        await connect();
        
        toast({
          title: "MetaMask Connected",
          description: "Now switching to Monad testnet...",
        });
      }

      // Step 2: Switch to Monad testnet
      if (!isCorrectChain) {
        toast({
          title: "Switching Network",
          description: "Please approve the network switch in MetaMask.",
        });
        
        await switchToMonad();
        
        toast({
          title: "Network Switched",
          description: "Connected to Monad testnet. Creating smart account...",
        });
      }

      // Step 3: Create smart account
      if (!smartAccount && account) {
        toast({
          title: "Creating Smart Account",
          description: "Setting up your MetaMask smart account with delegation capabilities...",
        });
        
        await createSmartAccount(account);
        
        toast({
          title: "Smart Account Created",
          description: "Your DeFi Guardian is now active and monitoring!",
        });
        
        onSmartAccountCreated?.();
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
