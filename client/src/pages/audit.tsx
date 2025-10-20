import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { FileText, ExternalLink, Download } from "lucide-react";
import type { AuditLog } from "@shared/schema";

interface AuditPageProps {
  smartAccountAddress: string;
}

export default function AuditPage({ smartAccountAddress }: AuditPageProps) {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit", smartAccountAddress],
  });

  const formatTime = (timestamp: Date | string) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  };

  const getActionBadge = (action: string) => {
    const badgeMap: Record<string, { variant: any; label: string }> = {
      revoke_approval: { variant: "destructive", label: "Revoked" },
      ignore_event: { variant: "secondary", label: "Ignored" },
      whitelist_address: { variant: "default", label: "Whitelisted" },
      update_settings: { variant: "outline", label: "Updated" },
    };

    const config = badgeMap[action] || { variant: "outline", label: action };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      success: { className: "bg-success text-success-foreground", label: "Success" },
      failed: { className: "bg-destructive text-destructive-foreground", label: "Failed" },
      pending: { className: "bg-warning text-warning-foreground", label: "Pending" },
    };

    const config = statusMap[status] || { className: "", label: status };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const exportLogs = () => {
    if (!logs) return;
    
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `audit-logs-${smartAccountAddress}-${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Audit Log</h1>
          <p className="text-muted-foreground">
            Complete history of all security actions
          </p>
        </div>
        {logs && logs.length > 0 && (
          <Button
            variant="outline"
            onClick={exportLogs}
            data-testid="button-export-logs"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            {logs?.length || 0} action(s) recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Audit Logs"
              description="Security actions will be recorded here for transparency and compliance."
            />
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-md border hover-elevate"
                  data-testid={`audit-log-${log.id}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex gap-2 flex-wrap">
                      {getActionBadge(log.action)}
                      {getStatusBadge(log.status)}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>

                  {log.details && (
                    <div className="text-sm text-muted-foreground mb-2">
                      {JSON.stringify(log.details)}
                    </div>
                  )}

                  {log.txHash && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Tx Hash:</span>
                      <span className="text-xs font-mono">{log.txHash}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          window.open(
                            `https://testnet.monadexplorer.com/tx/${log.txHash}`,
                            "_blank"
                          )
                        }
                        data-testid="button-view-tx"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
