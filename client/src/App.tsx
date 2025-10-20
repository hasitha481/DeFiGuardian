import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MetaMaskProvider } from "@/contexts/MetaMaskContext";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { ConnectionStatus } from "@/components/connection-status";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import ActivityPage from "@/pages/activity";
import SettingsPage from "@/pages/settings";
import AuditPage from "@/pages/audit";
import NotFound from "@/pages/not-found";
import type { SmartAccount } from "@shared/schema";

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
  const { toast } = useToast();
  const { smartAccount, disconnect } = useWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!smartAccount) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
      socket.send(JSON.stringify({
        type: "subscribe",
        accountAddress: smartAccount.address,
      }));
    };

    socket.onmessage = (event) => {
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
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [smartAccount, toast]);

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: "Disconnected",
      description: "MetaMask wallet has been disconnected.",
    });
  };

  const handleRevoke = async (eventId: string) => {
    try {
      const response = await fetch("/api/events/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      if (!response.ok) {
        throw new Error("Failed to revoke");
      }

      toast({
        title: "Approval Revoked",
        description: "The risky approval has been revoked successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
    } catch (error) {
      toast({
        title: "Revocation Failed",
        description: "Failed to revoke approval. Please try again.",
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
              <div className="text-sm">
                <div className="font-mono text-xs text-muted-foreground">
                  {smartAccount.address.slice(0, 6)}...{smartAccount.address.slice(-4)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {smartAccount.balance} MON
                </div>
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
