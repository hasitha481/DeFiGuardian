import { MetaMaskProvider as SDKProvider } from "@metamask/sdk-react";
import type { ReactNode } from "react";

interface MetaMaskProviderProps {
  children: ReactNode;
}

export function MetaMaskProvider({ children }: MetaMaskProviderProps) {
  return (
    <SDKProvider
      sdkOptions={{
        dappMetadata: {
          name: "DeFi Guardian Agent",
          url: typeof window !== "undefined" ? window.location.origin : "",
          iconUrl: typeof window !== "undefined" ? `${window.location.origin}/icon.png` : "",
        },
        logging: {
          developerMode: true,
        },
        checkInstallationImmediately: false,
        preferDesktop: true,
        // Prevent SDK from redefining window.ethereum when an extension already injected it
        injectProvider: false,
        shouldShimWeb3: false,
      }}
    >
      {children}
    </SDKProvider>
  );
}
