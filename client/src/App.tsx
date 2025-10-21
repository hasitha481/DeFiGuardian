import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MetaMaskProvider } from "@/contexts/MetaMaskContext";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { ConnectionStatus } from "@/components/connection-status";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Copy, Check } from "lucide-react";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import ActivityPage from "@/pages/activity";
import SettingsPage from "@/pages/settings";
import AuditPage from "@/pages/audit";
import NotFound from "@/pages/not-found";
import { transactionClient } from "@/lib/transaction-client";
import type { SmartAccount } from "@shared/schema";
import type { Address } from "viem";

function Router({
  smartAccount,
  onRevoke,
  onIgnore,
  onWhitelist,
}: {
  smartAccount: SmartAccount | null;
  onRevoke: (eventId: string) => void;
  onIgnore: (eventId: string) => void;
  onWhitelist: (address: string) => void;
}) {
  if (!smartAccount) {
    return null;
  }

  return (
    <Switch>
      <Route path="/">
        <DashboardPage
          smartAccountAddress={smartAccount.address}
          onRevoke={onRevoke}
          onIgnore={onIgnore}
          onWhitelist={onWhitelist}
        />
      </Route>
      <Route path="/activity">
        <ActivityPage
          smartAccountAddress={smartAccount.address}
          onRevoke={onRevoke}
          onIgnore={onIgnore}
          onWhitelist={onWhitelist}
        />
      </Route>
      <Route path="/settings">
        <SettingsPage smartAccountAddress={smartAccount.address} />
      </Route>
      <Route path="/audit">
        <AuditPage smartAccountAddress={smartAccount.address} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  // Suppress noisy wallet injection errors caused by other extensions running in Builder preview
  useEffect(() => {
    const handler = (evt: Event) => {
      try {
        const e = evt as ErrorEvent;
        const msg = e?.message || '';
        if (
          msg.includes('Cannot redefine property: ethereum') ||
          msg.includes('Failed to assign ethereum proxy') ||
          msg.includes('Invalid property descriptor') ||
          msg.includes('Cannot set property ethereum of')
        ) {
          // prevent console spam in preview; attempt to stop default handling
          try { e.preventDefault(); } catch (_) {}
          return;
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('error', handler as EventListener);
    return () => window.removeEventListener('error', handler as EventListener);
  }, []);
  const { toast } = useToast();
  const { smartAccount, disconnect, account, isCorrectChain } = useWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Detect multiple injected wallets that can conflict with MetaMask and warn the user
  useEffect(() => {
    try {
      const win = window as any;
      const providers = win?.ethereum?.providers;
      if (Array.isArray(providers) && providers.length > 1) {
        const hasMetaMask = providers.some((p: any) => p && p.isMetaMask);
        const others = providers.filter((p: any) => !p?.isMetaMask).length;
        if (hasMetaMask && others > 0) {
          toast({
            title: "Multiple Wallet Extensions Detected",
            description:
              "We detected several wallet extensions (e.g., Backpack, Razor, Nightly). For reliable connection, disable non-MetaMask wallets or set MetaMask as default.",
          });
        }
      }
    } catch (_) {
      // ignore
    }
  }, [toast]);

  // Real-time updates: prefer WebSocket; robustly fall back to polling on error/close or when running on Netlify
  useEffect(() => {
    if (!smartAccount) return;

    const startPolling = () => {
      setIsConnected(false);
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
      }, 5000);
      return poll;
    };

    const isInIframe = window.self !== window.top;
    const isNetlify = /netlify\.app$/i.test(window.location.host);

    if (isInIframe || isNetlify) {
      if (isInIframe) {
        toast({
          title: "Preview Mode: Limited Wallet Support",
          description:
            "You're running inside Builder preview. MetaMask and real-time WebSocket updates may not work here. Open the app in a new tab to enable full wallet functionality.",
        });
      }
      const poll = startPolling();
      return () => clearInterval(poll);
    }

    let pollHandle: any;
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
        try {
          socket.send(JSON.stringify({ type: "subscribe", accountAddress: smartAccount.address }));
        } catch (err) {
          console.warn("WebSocket send failed:", err);
        }
      };

      socket.onerror = (e) => {
        console.warn("WebSocket error, switching to polling:", e);
        try { socket.close(); } catch (_) {}
        if (!pollHandle) pollHandle = startPolling();
      };

      socket.onclose = () => {
        setIsConnected(false);
        if (!pollHandle) pollHandle = startPolling();
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "new_event") {
            toast({
              title: "New Risk Event Detected",
              description: `${message.data.eventType} detected with risk score ${message.data.riskScore}`,
            });
            setIsIndexing(true);
            setTimeout(() => setIsIndexing(false), 2000);

            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          } else if (message.type === "event_updated") {
            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
            queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
          }
        } catch (err) {
          console.warn("Invalid WebSocket message", err);
        }
      };

      return () => {
        try { socket.close(); } catch (_) {}
        if (pollHandle) clearInterval(pollHandle);
      };
    } catch (err) {
      console.warn("Failed to create WebSocket, falling back to polling:", err);
      const poll = startPolling();
      return () => clearInterval(poll);
    }
  }, [smartAccount, toast]);

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: "Disconnected",
      description: "MetaMask wallet has been disconnected.",
    });
  };

  const handleCopyAddress = async () => {
    if (!smartAccount) return;
    
    try {
      await navigator.clipboard.writeText(smartAccount.address);
      setCopiedAddress(true);
      toast({
        title: "Address Copied",
        description: "Smart account address copied to clipboard",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy address. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async (eventId: string) => {
    if (!smartAccount) return;

    try {
      toast({
        title: "Processing Revocation",
        description: "Executing gasless transaction - you won't pay any gas fees!",
      });

      // Execute gasless revocation via paymaster (no MetaMask signature needed!)
      const response = await fetch("/api/events/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to revoke approval");
      }

      const result = await response.json();

      toast({
        title: "Approval Revoked (Gasless!)",
        description: `Transaction confirmed! No gas fees paid. ${result.txHash ? `Hash: ${result.txHash.slice(0, 10)}...` : ""}`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    } catch (error) {
      console.error("Revocation error:", error);
      toast({
        title: "Revocation Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to revoke approval. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleIgnore = async (eventId: string) => {
    try {
      const response = await fetch("/api/events/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      if (!response.ok) {
        throw new Error("Failed to ignore");
      }

      toast({
        title: "Event Ignored",
        description: "This event will no longer trigger alerts.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    } catch (error) {
      toast({
        title: "Action Failed",
        description: "Failed to ignore event. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleWhitelist = async (address: string) => {
    try {
      const response = await fetch("/api/settings/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountAddress: smartAccount?.address,
          contractAddress: address,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to whitelist");
      }

      toast({
        title: "Address Whitelisted",
        description: "This contract has been added to your trusted list.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    } catch (error) {
      toast({
        title: "Whitelist Failed",
        description: "Failed to whitelist address. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!smartAccount) {
    return <LandingPage onSmartAccountCreated={() => {
      toast({
        title: "Smart Account Created",
        description: "Your DeFi Guardian is now active and monitoring!",
      });
    }} />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ConnectionStatus
                isConnected={isConnected}
                isIndexing={isIndexing}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="text-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="font-mono text-xs text-muted-foreground cursor-help">
                        {smartAccount.address.slice(0, 6)}...{smartAccount.address.slice(-4)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs">{smartAccount.address}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-xs text-muted-foreground">
                    {smartAccount.balance} MON
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyAddress}
                  data-testid="button-copy-address"
                >
                  {copiedAddress ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                data-testid="button-disconnect"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              <Router
                smartAccount={smartAccount}
                onRevoke={handleRevoke}
                onIgnore={handleIgnore}
                onWhitelist={handleWhitelist}
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <MetaMaskProvider>
      <WalletProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </WalletProvider>
    </MetaMaskProvider>
  );
}
