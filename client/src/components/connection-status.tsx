import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
  isIndexing?: boolean;
}

export function ConnectionStatus({
  isConnected,
  isIndexing = false,
}: ConnectionStatusProps) {
  if (!isConnected) {
    return (
      <Badge variant="outline" className="gap-1.5" data-testid="status-disconnected">
        <WifiOff className="h-3 w-3" />
        Disconnected
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 bg-success/10 text-success border-success/20"
      data-testid="status-connected"
    >
      <div className="relative">
        <Wifi className="h-3 w-3" />
        {isIndexing && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
        )}
      </div>
      {isIndexing ? "Indexing..." : "Connected"}
    </Badge>
  );
}
