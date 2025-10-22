import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { MetaMaskProvider } from "./contexts/MetaMaskContext";
import { WalletProvider } from "./contexts/WalletContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";

createRoot(document.getElementById("root")!).render(
  <MetaMaskProvider>
    <WalletProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <App />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WalletProvider>
  </MetaMaskProvider>
);
