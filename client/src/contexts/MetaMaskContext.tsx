import { MetaMaskProvider as SDKProvider } from "@metamask/sdk-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface MetaMaskProviderProps {
  children: ReactNode;
}

export function MetaMaskProvider({ children }: MetaMaskProviderProps) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return;
        const { publicUrl } = await res.json();
        if (!cancelled) setPublicUrl(publicUrl || null);
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dappUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const here = window.location.origin;
    if (publicUrl && typeof publicUrl === "string") {
      try {
        const parsed = new URL(publicUrl);
        return parsed.origin;
      } catch (_) {
        return publicUrl;
      }
    }
    return here;
  }, [publicUrl]);

  const iconUrl = useMemo(() => (dappUrl ? `${dappUrl}/icon.png` : ""), [dappUrl]);

  return (
    <SDKProvider
      sdkOptions={{
        dappMetadata: {
          name: "DeFi Guardian Agent",
          url: dappUrl,
          iconUrl,
        },
        logging: { developerMode: true },
        checkInstallationImmediately: false,
        preferDesktop: true,
        injectProvider: false,
        shouldShimWeb3: false,
      }}
    >
      {children}
    </SDKProvider>
  );
}
