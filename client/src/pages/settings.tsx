import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, Save } from "lucide-react";
import type { UserSettings } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface SettingsPageProps {
  smartAccountAddress: string;
}

export default function SettingsPage({ smartAccountAddress }: SettingsPageProps) {
  const { toast } = useToast();
  const [newAddress, setNewAddress] = useState("");

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings", smartAccountAddress],
  });

  const [localSettings, setLocalSettings] = useState<Partial<UserSettings>>({});

  // Sync local settings when query data changes
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<UserSettings>) => {
      return await apiRequest("PUT", "/api/settings", {
        accountAddress: smartAccountAddress,
        ...updatedSettings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings", smartAccountAddress] });
      toast({
        title: "Settings Updated",
        description: "Your security settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(localSettings);
  };

  const addWhitelistAddress = () => {
    if (!newAddress) return;

    const addresses = (localSettings.whitelistedAddresses as string[]) || [];
    if (addresses.includes(newAddress)) {
      toast({
        title: "Address Already Whitelisted",
        description: "This address is already in your whitelist.",
        variant: "destructive",
      });
      return;
    }

    setLocalSettings({
      ...localSettings,
      whitelistedAddresses: [...addresses, newAddress],
    });
    setNewAddress("");
  };

  const removeWhitelistAddress = (address: string) => {
    const addresses = (localSettings.whitelistedAddresses as string[]) || [];
    setLocalSettings({
      ...localSettings,
      whitelistedAddresses: addresses.filter((a) => a !== address),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const currentSettings = { ...settings, ...localSettings };
  const threshold = currentSettings.riskThreshold || 70;
  const autoRevoke = currentSettings.autoRevokeEnabled || false;
  const whitelistedAddresses = (currentSettings.whitelistedAddresses as string[]) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your security preferences and risk thresholds
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Management</CardTitle>
          <CardDescription>
            Control how the AI Guardian responds to detected risks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-revoke">Automatic Revocation</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically revoke high-risk approvals
                </p>
              </div>
              <Switch
                id="auto-revoke"
                checked={autoRevoke}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, autoRevokeEnabled: checked })
                }
                data-testid="switch-auto-revoke"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Risk Threshold</Label>
                <Badge variant="outline" data-testid="badge-threshold-value">
                  {threshold}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Events with risk scores above this threshold will trigger automatic actions
              </p>
              <Slider
                value={[threshold]}
                onValueChange={([value]) =>
                  setLocalSettings({ ...localSettings, riskThreshold: value })
                }
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-risk-threshold"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low (0)</span>
                <span>Medium (50)</span>
                <span>High (100)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Whitelisted Addresses</CardTitle>
          <CardDescription>
            Trusted contracts that won't trigger risk alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="0x..."
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWhitelistAddress()}
              data-testid="input-whitelist-address"
            />
            <Button
              onClick={addWhitelistAddress}
              disabled={!newAddress}
              data-testid="button-add-whitelist"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {whitelistedAddresses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No whitelisted addresses yet. Add trusted contracts to skip risk checks.
            </p>
          ) : (
            <div className="space-y-2">
              {whitelistedAddresses.map((address) => (
                <div
                  key={address}
                  className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                  data-testid={`whitelist-item-${address}`}
                >
                  <span className="font-mono text-sm break-all">{address}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeWhitelistAddress(address)}
                    data-testid={`button-remove-${address}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          size="lg"
          data-testid="button-save-settings"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
