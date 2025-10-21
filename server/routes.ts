import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { analyzeRisk } from "./ai-risk-analyzer";
import { smartAccountService } from "./smart-account-service";
import { transactionService } from "./transaction-service";
import type { Address } from "viem";
import type {
  InsertSmartAccount,
  InsertRiskEvent,
  InsertUserSettings,
  InsertAuditLog,
  DashboardStats,
} from "@shared/schema";

// WebSocket clients map
const wsClients = new Map<string, Set<WebSocket>>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Smart Account Routes
  // Real smart account creation with Delegation Toolkit
  app.post("/api/smart-account/create", async (req, res) => {
    try {
      const { ownerAddress } = req.body;

      if (!ownerAddress) {
        return res.status(400).json({ error: "Owner address required" });
      }

      // Note: In production, implement proper owner-to-account lookup
      // For now, proceed with creating deterministic smart account

      // Create real smart account using Delegation Toolkit
      const smartAccountData = await smartAccountService.createSmartAccount({
        ownerAddress,
      });

      const account = await storage.createSmartAccount({
        address: smartAccountData.address,
        ownerAddress: smartAccountData.ownerAddress,
        balance: smartAccountData.balance,
        network: "monad-testnet",
      });

      // Create default settings
      await storage.upsertUserSettings({
        accountAddress: account.address,
        riskThreshold: 70,
        autoRevokeEnabled: false,
        whitelistedAddresses: [],
        notificationsEnabled: true,
      });

      // Create welcome audit log
      await storage.createAuditLog({
        accountAddress: account.address,
        action: "account_created",
        status: "success",
        details: { ownerAddress },
      });

      return res.json(account);
    } catch (error) {
      console.error("Smart account creation error:", error);
      return res.status(500).json({ error: "Failed to create smart account" });
    }
  });

  // Deploy smart account on-chain
  app.post("/api/smart-account/deploy", async (req, res) => {
    try {
      const { smartAccountAddress, ownerAddress } = req.body;

      if (!smartAccountAddress || !ownerAddress) {
        return res.status(400).json({ error: "Smart account address and owner address required" });
      }

      // Deploy smart account to Monad testnet
      const deploymentResult = await smartAccountService.deploySmartAccount({
        smartAccountAddress: smartAccountAddress as Address,
        ownerAddress: ownerAddress as Address,
      });

      // Update account status in storage
      const updatedBalance = await smartAccountService.getBalance(smartAccountAddress as Address);
      await storage.createSmartAccount({
        address: smartAccountAddress,
        ownerAddress,
        balance: updatedBalance,
        network: "monad-testnet",
      });

      // Create audit log for deployment
      await storage.createAuditLog({
        accountAddress: smartAccountAddress,
        action: "smart_account_deployed",
        status: "success",
        details: {
          blockNumber: deploymentResult.blockNumber,
          gasUsed: deploymentResult.gasUsed,
        },
        txHash: deploymentResult.txHash,
      });

      return res.json({
        success: true,
        txHash: deploymentResult.txHash,
        blockNumber: deploymentResult.blockNumber,
        gasUsed: deploymentResult.gasUsed,
        explorerUrl: `https://explorer.testnet.monad.xyz/tx/${deploymentResult.txHash}`,
      });
    } catch (error) {
      console.error("Smart account deployment error:", error);
      
      // Log failed deployment attempt
      if (req.body.smartAccountAddress) {
        await storage.createAuditLog({
          accountAddress: req.body.smartAccountAddress,
          action: "smart_account_deployed",
          status: "failed",
          details: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }

      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to deploy smart account" 
      });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      const events = await storage.getRiskEvents(accountAddress);
      const settings = await storage.getUserSettings(accountAddress);

      const stats: DashboardStats = {
        totalEvents: events.length,
        highRiskEvents: events.filter((e) => e.riskLevel === "high").length,
        autoRevoked: events.filter((e) => e.status === "revoked").length,
        whitelistedContracts: (settings?.whitelistedAddresses as string[] || []).length,
      };

      return res.json(stats);
    } catch (error) {
      console.error("Stats error:", error);
      return res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Risk Events Routes
  app.get("/api/events/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      const events = await storage.getRiskEvents(accountAddress);
      return res.json(events);
    } catch (error) {
      console.error("Events fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/recent/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      const events = await storage.getRiskEvents(accountAddress);
      return res.json(events.slice(0, 5));
    } catch (error) {
      console.error("Recent events error:", error);
      return res.status(500).json({ error: "Failed to fetch recent events" });
    }
  });

  // Create risk event (simulated Envio webhook)
  app.post("/api/events/simulate", async (req, res) => {
    try {
      const {
        accountAddress,
        eventType,
        tokenAddress,
        tokenSymbol,
        spenderAddress,
        amount,
      } = req.body;

      const settings = await storage.getUserSettings(accountAddress);
      const whitelistedAddresses = (settings?.whitelistedAddresses as string[]) || [];

      // Analyze risk with AI
      const riskAnalysis = await analyzeRisk({
        eventType,
        tokenSymbol,
        spenderAddress,
        amount,
        accountAddress,
        whitelistedAddresses,
      });

      const eventData: InsertRiskEvent = {
        accountAddress,
        eventType,
        tokenAddress,
        tokenSymbol,
        spenderAddress,
        amount,
        riskScore: riskAnalysis.score,
        riskLevel: riskAnalysis.level,
        aiReasoning: riskAnalysis.reasoning,
        txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        blockNumber: String(Math.floor(Math.random() * 1000000)),
        status: "detected",
      };

      const event = await storage.createRiskEvent(eventData);

      // Check if auto-revoke is enabled and threshold exceeded
      if (
        settings?.autoRevokeEnabled &&
        riskAnalysis.score > (settings.riskThreshold || 70) &&
        spenderAddress // Must have spender address for revocation
      ) {
        try {
          // Execute real blockchain transaction to auto-revoke approval
          const revokeResult = await transactionService.revokeApproval({
            tokenAddress: tokenAddress as Address,
            spenderAddress: spenderAddress as Address,
            ownerAddress: accountAddress as Address,
          });

          await storage.updateRiskEventStatus(event.id, "revoked");
          
          await storage.createAuditLog({
            accountAddress,
            action: "revoke_approval",
            eventId: event.id,
            status: revokeResult.status === "confirmed" ? "success" : "pending",
            details: {
              reason: "Auto-revoked due to high risk score",
              riskScore: riskAnalysis.score,
              gasUsed: revokeResult.gasUsed?.toString(),
              blockNumber: revokeResult.blockNumber?.toString(),
            },
            txHash: revokeResult.txHash,
          });

          event.status = "revoked";
        } catch (autoRevokeError) {
          console.error("Auto-revoke failed:", autoRevokeError);
          // Don't fail the entire request if auto-revoke fails
          await storage.createAuditLog({
            accountAddress,
            action: "revoke_approval",
            eventId: event.id,
            status: "failed",
            details: {
              reason: "Auto-revoke attempted but failed",
              error: autoRevokeError instanceof Error ? autoRevokeError.message : "Unknown error",
            },
          });
        }
      }

      // Broadcast to WebSocket clients
      const clients = wsClients.get(accountAddress);
      if (clients) {
        const message = JSON.stringify({
          type: "new_event",
          data: event,
        });
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      return res.json(event);
    } catch (error) {
      console.error("Event creation error:", error);
      return res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Revoke approval confirmation - Called after client-side MetaMask signing
  app.post("/api/events/revoke-confirm", async (req, res) => {
    try {
      const { eventId, txHash, status } = req.body;
      const event = await storage.getRiskEvent(eventId);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (!event.tokenAddress || !event.spenderAddress) {
        return res.status(400).json({ error: "Event missing required addresses" });
      }

      // CRITICAL SECURITY: Verify transaction on-chain before accepting
      try {
        const txStatus = await transactionService.getTransactionStatus(txHash as Address);
        
        if (txStatus.status === "not_found" || txStatus.status === "pending") {
          // Transaction not confirmed yet - store as pending
          await storage.createAuditLog({
            accountAddress: event.accountAddress,
            action: "revoke_approval",
            eventId,
            status: "pending",
            details: {
              manual: true,
              method: "user_wallet_signature",
              message: "Transaction submitted but not yet confirmed on-chain",
              txStatus: txStatus.status,
            },
            txHash,
          });

          return res.json({
            success: false,
            txHash,
            status: "pending",
            message: "Transaction not yet confirmed. Please wait for blockchain confirmation.",
          });
        }

        if (txStatus.status === "failed") {
          // Transaction failed on-chain
          await storage.createAuditLog({
            accountAddress: event.accountAddress,
            action: "revoke_approval",
            eventId,
            status: "failed",
            details: {
              manual: true,
              method: "user_wallet_signature",
              message: "Transaction failed on-chain",
            },
            txHash,
          });

          return res.status(400).json({
            error: "Transaction failed on blockchain",
            txHash,
          });
        }

        // Transaction confirmed - now verify the allowance was actually set to 0
        const currentAllowance = await transactionService.getAllowance(
          event.tokenAddress as Address,
          event.accountAddress as Address,
          event.spenderAddress as Address
        );

        if (currentAllowance !== BigInt(0)) {
          // Allowance not zero - revocation didn't work or wrong transaction
          await storage.createAuditLog({
            accountAddress: event.accountAddress,
            action: "revoke_approval",
            eventId,
            status: "failed",
            details: {
              manual: true,
              method: "user_wallet_signature",
              message: "Transaction confirmed but allowance not zero - verification failed",
              currentAllowance: currentAllowance.toString(),
            },
            txHash,
          });

          return res.status(400).json({
            error: "Transaction confirmed but approval was not revoked (allowance not zero)",
            txHash,
            currentAllowance: currentAllowance.toString(),
          });
        }

        // SUCCESS: Transaction confirmed AND allowance is zero
        await storage.updateRiskEventStatus(eventId, "revoked");

        await storage.createAuditLog({
          accountAddress: event.accountAddress,
          action: "revoke_approval",
          eventId,
          status: "success",
          details: {
            manual: true,
            method: "user_wallet_signature",
            message: "Revocation verified on-chain - allowance confirmed zero",
            blockNumber: txStatus.blockNumber?.toString(),
          },
          txHash,
        });

        // Broadcast update via WebSocket
        const clients = wsClients.get(event.accountAddress);
        if (clients) {
          const message = JSON.stringify({
            type: "event_updated",
            data: { eventId, status: "revoked", txHash },
          });
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }

        return res.json({
          success: true,
          txHash,
          status: "confirmed",
          blockNumber: txStatus.blockNumber?.toString(),
        });
      } catch (verificationError) {
        // On-chain verification failed
        console.error("On-chain verification error:", verificationError);
        
        await storage.createAuditLog({
          accountAddress: event.accountAddress,
          action: "revoke_approval",
          eventId,
          status: "failed",
          details: {
            error: verificationError instanceof Error ? verificationError.message : "Unknown error",
            method: "user_wallet_signature",
            message: "Failed to verify transaction on-chain",
          },
          txHash,
        });

        return res.status(500).json({
          error: "Failed to verify transaction on blockchain",
          details: verificationError instanceof Error ? verificationError.message : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Revoke confirmation error:", error);
      
      const { eventId } = req.body;
      const event = await storage.getRiskEvent(eventId);
      if (event) {
        await storage.createAuditLog({
          accountAddress: event.accountAddress,
          action: "revoke_approval",
          eventId,
          status: "failed",
          details: {
            error: error instanceof Error ? error.message : "Unknown error",
            method: "user_wallet_signature",
          },
        });
      }

      return res.status(500).json({
        error: "Failed to confirm revocation",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // LEGACY: Revoke approval - Now uses mock transactions (real flow uses revoke-confirm)
  app.post("/api/events/revoke", async (req, res) => {
    try {
      const { eventId } = req.body;
      const event = await storage.getRiskEvent(eventId);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (!event.spenderAddress) {
        return res.status(400).json({ error: "Event missing spender address" });
      }

      console.warn("DEPRECATED: Use /api/events/revoke-confirm with client-side signing");

      // Mock transaction hash for legacy support
      const mockTxHash = `0x${Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("")}` as Address;

      // Update event status
      await storage.updateRiskEventStatus(eventId, "revoked");

      // Create audit log with mock transaction
      await storage.createAuditLog({
        accountAddress: event.accountAddress,
        action: "revoke_approval",
        eventId,
        status: "success",
        details: {
          manual: true,
          mock: true,
          message: "Mock revocation - upgrade to client-side signing",
        },
        txHash: mockTxHash,
      });

      // Broadcast update
      const clients = wsClients.get(event.accountAddress);
      if (clients) {
        const message = JSON.stringify({
          type: "event_updated",
          data: { eventId, status: "revoked", txHash: mockTxHash },
        });
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      return res.json({
        success: true,
        txHash: mockTxHash,
        status: "confirmed",
      });
    } catch (error) {
      console.error("Revoke error:", error);
      
      const { eventId } = req.body;
      const event = await storage.getRiskEvent(eventId);
      if (event) {
        await storage.createAuditLog({
          accountAddress: event.accountAddress,
          action: "revoke_approval",
          eventId,
          status: "failed",
          details: { error: error instanceof Error ? error.message : "Unknown error" },
        });
      }
      
      return res.status(500).json({
        error: "Failed to revoke approval",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Ignore event
  app.post("/api/events/ignore", async (req, res) => {
    try {
      const { eventId } = req.body;
      const event = await storage.getRiskEvent(eventId);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      await storage.updateRiskEventStatus(eventId, "ignored");

      await storage.createAuditLog({
        accountAddress: event.accountAddress,
        action: "ignore_event",
        eventId,
        status: "success",
        details: {},
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Ignore error:", error);
      return res.status(500).json({ error: "Failed to ignore event" });
    }
  });

  // Settings Routes
  app.get("/api/settings/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      let settings = await storage.getUserSettings(accountAddress);

      if (!settings) {
        // Create default settings
        settings = await storage.upsertUserSettings({
          accountAddress,
          riskThreshold: 70,
          autoRevokeEnabled: false,
          whitelistedAddresses: [],
          notificationsEnabled: true,
        });
      }

      return res.json(settings);
    } catch (error) {
      console.error("Settings fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const data: InsertUserSettings = req.body;
      const settings = await storage.upsertUserSettings(data);

      await storage.createAuditLog({
        accountAddress: data.accountAddress,
        action: "update_settings",
        status: "success",
        details: data,
      });

      return res.json(settings);
    } catch (error) {
      console.error("Settings update error:", error);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/settings/whitelist", async (req, res) => {
    try {
      const { accountAddress, contractAddress } = req.body;
      const settings = await storage.getUserSettings(accountAddress);

      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }

      const addresses = (settings.whitelistedAddresses as string[]) || [];
      if (!addresses.includes(contractAddress)) {
        addresses.push(contractAddress);
      }

      const updated = await storage.upsertUserSettings({
        ...settings,
        whitelistedAddresses: addresses,
      });

      await storage.createAuditLog({
        accountAddress,
        action: "whitelist_address",
        status: "success",
        details: { contractAddress },
      });

      return res.json(updated);
    } catch (error) {
      console.error("Whitelist error:", error);
      return res.status(500).json({ error: "Failed to whitelist address" });
    }
  });

  // Audit Logs Route
  app.get("/api/audit/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      const logs = await storage.getAuditLogs(accountAddress);
      return res.json(logs);
    } catch (error) {
      console.error("Audit logs error:", error);
      return res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  // Reference to javascript_websocket blueprint
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection");

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "subscribe" && message.accountAddress) {
          const accountAddress = message.accountAddress;
          
          if (!wsClients.has(accountAddress)) {
            wsClients.set(accountAddress, new Set());
          }
          
          wsClients.get(accountAddress)!.add(ws);
          
          ws.send(JSON.stringify({
            type: "connection_status",
            data: { connected: true },
          }));

          console.log(`Client subscribed to ${accountAddress}`);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      // Remove from all subscriptions
      wsClients.forEach((clients) => {
        clients.delete(ws);
      });
      console.log("WebSocket connection closed");
    });
  });

  return httpServer;
}
