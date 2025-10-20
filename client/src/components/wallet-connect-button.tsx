import { useState } from "react";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface WalletConnectButtonProps {
  smartAccount?: {
    address: string;
    balance: string;
    network: string;
  } | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting?: boolean;
}

export function WalletConnectButton({
  smartAccount,
  onConnect,
  onDisconnect,
  isConnecting = false,
}: WalletConnectButtonProps) {
  const { toast } = useToast();

  const copyAddress = () => {
    if (smartAccount?.address) {
      navigator.clipboard.writeText(smartAccount.address);
      toast({
        title: "Address copied",
        description: "Smart account address copied to clipboard",
      });
    }
  };

  const openExplorer = () => {
    if (smartAccount?.address) {
      window.open(
        `https://testnet.monadexplorer.com/address/${smartAccount.address}`,
        "_blank"
      );
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    return num.toFixed(4);
  };

  if (!smartAccount) {
    return (
      <Button
        onClick={onConnect}
        disabled={isConnecting}
        size="default"
        data-testid="button-connect-wallet"
      >
        <Wallet className="h-4 w-4 mr-2" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-wallet-menu">
          <Wallet className="h-4 w-4" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-mono">{formatAddress(smartAccount.address)}</span>
            <span className="text-xs text-muted-foreground">
              {formatBalance(smartAccount.balance)} MON
            </span>
          </div>
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Smart Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Address</span>
            <span className="text-sm font-mono break-all">{smartAccount.address}</span>
          </div>
          <div className="flex flex-col gap-1 mt-3">
            <span className="text-xs text-muted-foreground">Balance</span>
            <span className="text-sm font-semibold">
              {formatBalance(smartAccount.balance)} MON
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-3">
            <span className="text-xs text-muted-foreground">Network</span>
            <span className="text-sm">Monad Testnet</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress} data-testid="button-copy-address">
          <Copy className="h-4 w-4 mr-2" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openExplorer} data-testid="button-view-explorer">
          <ExternalLink className="h-4 w-4 mr-2" />
          View on Explorer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDisconnect} data-testid="button-disconnect">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
