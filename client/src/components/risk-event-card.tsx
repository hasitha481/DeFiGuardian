import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Ban,
  Eye,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { RiskScoreBadge } from "./risk-score-badge";
import type { RiskEvent } from "@shared/schema";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RiskEventCardProps {
  event: RiskEvent;
  onRevoke?: (eventId: string) => void;
  onIgnore?: (eventId: string) => void;
  onWhitelist?: (address: string) => void;
  isProcessing?: boolean;
}

export function RiskEventCard({
  event,
  onRevoke,
  onIgnore,
  onWhitelist,
  isProcessing = false,
}: RiskEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const formatTime = (timestamp: Date | string) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getStatusBadge = () => {
    switch (event.status) {
      case "detected":
        return <Badge variant="secondary">Detected</Badge>;
      case "processing":
        return <Badge variant="secondary">Processing</Badge>;
      case "revoked":
        return <Badge className="bg-success text-success-foreground">Revoked</Badge>;
      case "ignored":
        return <Badge variant="outline">Ignored</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`card-event-${event.id}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="outline" className="capitalize">
                  {event.eventType}
                </Badge>
                <RiskScoreBadge score={event.riskScore} level={event.riskLevel} size="sm" />
                {getStatusBadge()}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{event.tokenSymbol || "Unknown Token"}</span>
                <span>•</span>
                <span className="font-mono text-xs">{formatAmount(event.amount)}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(event.timestamp)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between mb-3"
              data-testid="button-toggle-details"
            >
              <span className="text-xs">
                {isExpanded ? "Hide Details" : "View Details"}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4">
            <div className="space-y-3 text-sm">
              {event.spenderAddress && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    Spender Address
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {formatAddress(event.spenderAddress)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        window.open(
                          `https://testnet.monadexplorer.com/address/${event.spenderAddress}`,
                          "_blank"
                        )
                      }
                      data-testid="button-view-spender"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {event.tokenAddress && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    Token Contract
                  </span>
                  <span className="font-mono text-xs">
                    {formatAddress(event.tokenAddress)}
                  </span>
                </div>
              )}

              {event.txHash && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    Transaction Hash
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {formatAddress(event.txHash)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        window.open(
                          `https://testnet.monadexplorer.com/tx/${event.txHash}`,
                          "_blank"
                        )
                      }
                      data-testid="button-view-transaction"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {event.aiReasoning && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    AI Risk Analysis
                  </span>
                  <p className="text-xs leading-relaxed bg-muted/50 p-3 rounded-md">
                    {event.aiReasoning}
                  </p>
                </div>
              )}
            </div>

            {event.status === "detected" && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onRevoke?.(event.id)}
                  disabled={isProcessing}
                  data-testid="button-revoke"
                >
                  <Ban className="h-3 w-3 mr-1.5" />
                  Revoke Approval
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onIgnore?.(event.id)}
                  disabled={isProcessing}
                  data-testid="button-ignore"
                >
                  <Eye className="h-3 w-3 mr-1.5" />
                  Ignore
                </Button>
                {event.spenderAddress && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onWhitelist?.(event.spenderAddress!)}
                    disabled={isProcessing}
                    data-testid="button-whitelist"
                  >
                    <ShieldCheck className="h-3 w-3 mr-1.5" />
                    Whitelist
                  </Button>
                )}
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
