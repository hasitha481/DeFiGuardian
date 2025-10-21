import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Rocket, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeploySmartAccountButtonProps {
  smartAccountAddress: string;
  ownerAddress: string;
  isDeployed: boolean;
}

interface DeploymentResponse {
  success: boolean;
  txHash: string;
  blockNumber: string;
  gasUsed: string;
  explorerUrl: string;
}

export function DeploySmartAccountButton({
  smartAccountAddress,
  ownerAddress,
  isDeployed,
}: DeploySmartAccountButtonProps) {
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResponse | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deployMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/smart-account/deploy", {
        method: "POST",
        body: JSON.stringify({
          smartAccountAddress,
          ownerAddress,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return await response.json() as DeploymentResponse;
    },
    onSuccess: (data: DeploymentResponse) => {
      setDeploymentResult(data);
      setShowSuccessDialog(true);
      
      // Invalidate queries to refresh account status
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", smartAccountAddress] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-account", smartAccountAddress] });
      
      toast({
        title: "Smart Account Deployed",
        description: "Your smart account is now live on Monad testnet",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy smart account. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isDeployed) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2" data-testid="button-already-deployed">
        <CheckCircle2 className="h-4 w-4 text-success" />
        Deployed On-Chain
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => deployMutation.mutate()}
        disabled={deployMutation.isPending}
        className="gap-2"
        data-testid="button-deploy-smart-account"
      >
        {deployMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4" />
            Deploy to Monad
          </>
        )}
      </Button>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent data-testid="dialog-deployment-success">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Smart Account Deployed Successfully!
            </DialogTitle>
            <DialogDescription>
              Your smart account is now deployed on Monad testnet blockchain
            </DialogDescription>
          </DialogHeader>
          
          {deploymentResult && (
            <div className="space-y-3 py-4">
              <div>
                <span className="text-sm font-medium">Transaction Hash</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">
                    {deploymentResult.txHash}
                  </code>
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium">Block Number</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {deploymentResult.blockNumber}
                </p>
              </div>
              
              <div>
                <span className="text-sm font-medium">Gas Used</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {parseInt(deploymentResult.gasUsed).toLocaleString()} wei
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {deploymentResult && (
              <Button
                variant="outline"
                onClick={() => window.open(deploymentResult.explorerUrl, '_blank')}
                className="gap-2"
                data-testid="button-view-transaction"
              >
                <ExternalLink className="h-4 w-4" />
                View on Explorer
              </Button>
            )}
            <Button onClick={() => setShowSuccessDialog(false)} data-testid="button-close-dialog">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
