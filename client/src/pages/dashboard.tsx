import { useQuery } from "@tanstack/react-query";
import { Activity, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StatsCard } from "@/components/stats-card";
import { RiskEventCard } from "@/components/risk-event-card";
import { EmptyState } from "@/components/empty-state";
import { DemoEventTrigger } from "@/components/demo-event-trigger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RiskEvent, DashboardStats } from "@shared/schema";

interface DashboardPageProps {
  smartAccountAddress: string;
  onRevoke: (eventId: string) => void;
  onIgnore: (eventId: string) => void;
  onWhitelist: (address: string) => void;
}

export default function DashboardPage({
  smartAccountAddress,
  onRevoke,
  onIgnore,
  onWhitelist,
}: DashboardPageProps) {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", smartAccountAddress],
  });

  const { data: recentEvents, isLoading: eventsLoading } = useQuery<RiskEvent[]>({
    queryKey: ["/api/events/recent", smartAccountAddress],
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your smart account security and risk events
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Events"
          value={stats?.totalEvents || 0}
          description="All detected events"
          icon={Activity}
        />
        <StatsCard
          title="High Risk Events"
          value={stats?.highRiskEvents || 0}
          description="Requiring attention"
          icon={AlertTriangle}
        />
        <StatsCard
          title="Auto-Revoked"
          value={stats?.autoRevoked || 0}
          description="Automatically protected"
          icon={Shield}
        />
        <StatsCard
          title="Whitelisted"
          value={stats?.whitelistedContracts || 0}
          description="Trusted contracts"
          icon={CheckCircle2}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest risk events detected for your smart account
              </CardDescription>
            </div>
            <DemoEventTrigger accountAddress={smartAccountAddress} />
          </div>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !recentEvents || recentEvents.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No Events Detected"
              description="Your smart account is secure. We'll notify you when we detect any risk events."
            />
          ) : (
            <div className="space-y-4">
              {recentEvents.slice(0, 5).map((event) => (
                <RiskEventCard
                  key={event.id}
                  event={event}
                  onRevoke={onRevoke}
                  onIgnore={onIgnore}
                  onWhitelist={onWhitelist}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
