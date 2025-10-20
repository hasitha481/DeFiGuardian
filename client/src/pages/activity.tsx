import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RiskEventCard } from "@/components/risk-event-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RiskEvent } from "@shared/schema";

interface ActivityPageProps {
  smartAccountAddress: string;
  onRevoke: (eventId: string) => void;
  onIgnore: (eventId: string) => void;
  onWhitelist: (address: string) => void;
}

export default function ActivityPage({
  smartAccountAddress,
  onRevoke,
  onIgnore,
  onWhitelist,
}: ActivityPageProps) {
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: events, isLoading } = useQuery<RiskEvent[]>({
    queryKey: ["/api/events", smartAccountAddress],
  });

  const filteredEvents = events?.filter((event) => {
    if (riskFilter !== "all" && event.riskLevel !== riskFilter) return false;
    if (statusFilter !== "all" && event.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Activity Feed</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of all risk events
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>All Events</CardTitle>
              <CardDescription>
                {filteredEvents?.length || 0} event(s) found
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[140px]" data-testid="filter-risk-level">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="detected">Detected</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                </SelectContent>
              </Select>

              {(riskFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => {
                    setRiskFilter("all");
                    setStatusFilter("all");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !filteredEvents || filteredEvents.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No Events Found"
              description={
                riskFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters to see more events."
                  : "Your smart account is secure. We'll notify you when we detect any risk events."
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event) => (
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
