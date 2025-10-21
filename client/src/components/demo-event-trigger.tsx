import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

interface DemoEventTriggerProps {
  accountAddress: string;
}

export function DemoEventTrigger({ accountAddress }: DemoEventTriggerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [eventType, setEventType] = useState("approval");
  const [amount, setAmount] = useState("1000");
  const [tokenSymbol, setTokenSymbol] = useState("USDC");
  const [txHash, setTxHash] = useState("");
  const [relatedAddress, setRelatedAddress] = useState("");

  const handleCreateEvent = async () => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/events/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountAddress,
          eventType,
          tokenAddress: "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
          tokenSymbol,
          spenderAddress: "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
          amount,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      toast({
        title: "Demo Event Created",
        description: "A simulated risk event has been created for testing.",
      });

      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Failed to Create Event",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-demo-event">
          <Zap className="h-4 w-4 mr-2" />
          Simulate Event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simulate or Ingest Events</DialogTitle>
          <DialogDescription>
            Create a demo event or ingest a real Monad transaction hash to index its logs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="event-type">Demo Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger id="event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approval">Approval</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Token Symbol</Label>
            <Input id="token" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} placeholder="USDC" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" />
          </div>

          <Button onClick={handleCreateEvent} disabled={isCreating} className="w-full">
            {isCreating ? "Creating..." : "Create Demo Event"}
          </Button>

          <div className="border-t pt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tx">Ingest Monad Tx Hash</Label>
              <Input id="tx" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel">Related Address (optional EOA/Smart Account)</Label>
              <Input id="rel" value={relatedAddress} onChange={(e) => setRelatedAddress(e.target.value)} placeholder="0x..." />
            </div>
            <Button onClick={async () => {
              setIsCreating(true);
              try {
                const addrs = [accountAddress, relatedAddress].filter(Boolean);
                const response = await fetch('/api/monitor/ingest-tx', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ txHash, addresses: addrs }),
                });
                if (!response.ok) throw new Error('Failed to ingest tx');
                const data = await response.json();
                toast({ title: 'Transaction Ingested', description: `${data.events?.length || 0} event(s) created from tx` });
                setIsOpen(false);
              } catch (e) {
                toast({ title: 'Ingest Failed', description: 'Could not ingest transaction hash.', variant: 'destructive' });
              } finally {
                setIsCreating(false);
              }
            }} disabled={isCreating || !txHash} className="w-full">
              {isCreating ? 'Ingesting...' : 'Ingest Tx'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
