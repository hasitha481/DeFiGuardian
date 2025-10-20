import { Shield, Zap, Brain, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletConnectButtonReal } from "@/components/wallet-connect-button-real";

interface LandingPageProps {
  onSmartAccountCreated?: () => void;
}

export default function LandingPage({ onSmartAccountCreated }: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">DeFi Guardian Agent</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Security</p>
            </div>
          </div>
          <WalletConnectButtonReal onSmartAccountCreated={onSmartAccountCreated} />
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6 shadow-sm">
              <Zap className="h-4 w-4" />
              Powered by MetaMask Smart Accounts & AI
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Protect Your DeFi Assets with
              <br />
              <span className="text-primary bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">AI-Powered Risk Analysis</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Real-time monitoring and automated approval management for your MetaMask Smart Account on Monad testnet. Let AI guard your assets 24/7.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <div className="flex-1 max-w-md">
                <WalletConnectButtonReal onSmartAccountCreated={onSmartAccountCreated} />
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 mb-4">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>AI Risk Detection</CardTitle>
                  <CardDescription>
                    GPT-5 powered analysis evaluates every approval and transaction in real-time with explainable risk scores
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Auto-Revoke Approvals</CardTitle>
                  <CardDescription>
                    Gasless transactions automatically revoke risky approvals using MetaMask Delegation Toolkit
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 mb-4">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Smart Account Security</CardTitle>
                  <CardDescription>
                    Built on Monad testnet with ERC-4337 account abstraction for enhanced security and control
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">How It Works</h3>
              <p className="text-muted-foreground">
                Three simple steps to secure your DeFi assets
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex gap-4 items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Connect Smart Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Create or connect your MetaMask Smart Account on Monad testnet
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Configure Protection</h4>
                  <p className="text-sm text-muted-foreground">
                    Set your risk thresholds and whitelist trusted contracts
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Stay Protected</h4>
                  <p className="text-sm text-muted-foreground">
                    AI monitors all activity and automatically revokes risky approvals
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with MetaMask Delegation Toolkit, Monad Testnet, Envio & OpenAI</p>
        </div>
      </footer>
    </div>
  );
}
