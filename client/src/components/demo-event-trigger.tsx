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
          <DialogTitle>Simulate Risk Event</DialogTitle>
          <DialogDescription>
            Create a demo event to test AI risk analysis and auto-revoke features
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="event-type">Event Type</Label>
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
            <Input
              id="token"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
              placeholder="USDC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
            />
          </div>

          <Button
            onClick={handleCreateEvent}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Create Demo Event"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
