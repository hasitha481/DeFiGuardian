import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

interface RiskScoreBadgeProps {
  score: number;
  level: "low" | "medium" | "high";
  showIcon?: boolean;
  size?: "sm" | "default";
}

export function RiskScoreBadge({
  score,
  level,
  showIcon = true,
  size = "default",
}: RiskScoreBadgeProps) {
  const getVariant = () => {
    switch (level) {
      case "low":
        return "default" as const;
      case "medium":
        return "secondary" as const;
      case "high":
        return "destructive" as const;
    }
  };

  const getIcon = () => {
    switch (level) {
      case "low":
        return <CheckCircle className="h-3 w-3" />;
      case "medium":
        return <AlertCircle className="h-3 w-3" />;
      case "high":
        return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const getColorClass = () => {
    switch (level) {
      case "low":
        return "bg-success text-success-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "high":
        return "bg-destructive text-destructive-foreground";
    }
  };

  return (
    <Badge
      variant={getVariant()}
      className={`${getColorClass()} gap-1 ${size === "sm" ? "text-xs py-0.5" : ""}`}
      data-testid={`badge-risk-${level}`}
    >
      {showIcon && getIcon()}
      <span className="font-semibold">{score}</span>
      <span className="font-normal">/ 100</span>
    </Badge>
  );
}
