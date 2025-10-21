import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { analyzeRisk } from "./ai-risk-analyzer";
import { smartAccountService } from "./smart-account-service";
import { transactionService } from "./transaction-service";
import type { Address } from "viem";
import { createPublicClient, http } from 'viem';
import { monadTestnet } from "../client/src/lib/chains";
import type {
  InsertSmartAccount,
  InsertRiskEvent,
  InsertUserSettings,
  InsertAuditLog,
  DashboardStats,
} from "@shared/schema";
import { deploySmartAccountSchema } from "@shared/schema";

// WebSocket clients map
const wsClients = new Map<string, Set<WebSocket>>();

// Simple in-memory rate limiting for deployment endpoints
const deploymentRateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_DEPLOYMENTS_PER_WINDOW = 3; // Max 3 deployments per minute per owner

function checkRateLimit(ownerAddress: string): boolean {
  const now = Date.now();
  const timestamps = deploymentRateLimits.get(ownerAddress) || [];
  
  // Filter out old timestamps outside the window
  const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_DEPLOYMENTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }
  
  // Add current timestamp and update map
  recentTimestamps.push(now);
  deploymentRateLimits.set(ownerAddress, recentTimestamps);
  return true;
}

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
      // Validate request body with Zod
      const validationResult = deploySmartAccountSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request parameters",
          details: validationResult.error.issues 
        });
      }

      const { smartAccountAddress, ownerAddress } = validationResult.data;

      // Check rate limit
      if (!checkRateLimit(ownerAddress)) {
        return res.status(429).json({
          error: "Rate limit exceeded. Please wait before deploying again."
        });
      }

      // If account already exists in storage assume deployed and return 409
      const existing = await storage.getSmartAccount(smartAccountAddress.toLowerCase());
      if (existing) {
        return res.status(409).json({ error: "Smart account is already deployed on-chain" });
      }

      // Deploy smart account to Monad testnet
      const deploymentResult = await smartAccountService.deploySmartAccount({
        smartAccountAddress: smartAccountAddress as Address,
        ownerAddress: ownerAddress as Address,
      });

      // Update account status in storage (create only if not exists)
      const updatedBalance = await smartAccountService.getBalance(smartAccountAddress as Address);
      try {
        await storage.createSmartAccount({
          address: smartAccountAddress,
          ownerAddress,
          balance: updatedBalance,
          network: "monad-testnet",
        });
      } catch (e) {
        // If storage already has it, ignore
        console.warn("createSmartAccount storage warning:", e);
      }

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

  // Public config endpoint (used by client to open the app in a new tab)
  app.get('/api/config', async (req, res) => {
    try {
      const publicUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
      return res.json({ publicUrl });
    } catch (err) {
      console.error('Config endpoint error:', err);
      return res.status(500).json({ error: 'Failed to fetch config' });
    }
  });

  // Start monitoring (poll RPC) for one or more addresses
  app.post('/api/monitor/start', async (req, res) => {
    try {
      const { addresses } = req.body as { addresses?: string[] };
      if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: 'addresses[] required' });
      }
      const { startMonitoringAddress } = await import('./monitor-service');
      await Promise.all(addresses.filter(Boolean).map((a) => startMonitoringAddress(a)));
      return res.json({ success: true, monitoring: addresses.length });
    } catch (err) {
      console.error('monitor/start error:', err);
      return res.status(500).json({ error: 'Failed to start monitoring' });
    }
  });

  // Ingest a specific transaction hash and create risk events from its logs
  app.post('/api/monitor/ingest-tx', async (req, res) => {
    try {
      const { txHash, addresses } = req.body as { txHash?: string; addresses?: string[] };
      if (!txHash || typeof txHash !== 'string') {
        return res.status(400).json({ error: 'txHash required' });
      }

      const client = createPublicClient({ chain: monadTestnet, transport: http(monadTestnet.rpcUrls.default.http[0]) });
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

      const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
      const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

      const addrSet = new Set((addresses || []).map((a) => a.toLowerCase()));
      const created: any[] = [];

      for (const log of receipt.logs || []) {
        try {
          const topic0 = log.topics?.[0];
          if (!topic0) continue;
          if (topic0 === APPROVAL) {
            const owner = `0x${(log.topics?.[1] ?? '').slice(26)}`.toLowerCase();
            const spender = `0x${(log.topics?.[2] ?? '').slice(26)}`.toLowerCase();
            const value = BigInt(log.data ?? '0');
            const accountAddress = addrSet.size > 0 ? ([...addrSet].find((a) => a === owner) || owner) : owner;

            const whitelisted = ((await storage.getUserSettings(accountAddress))?.whitelistedAddresses as string[]) || [];
            const risk = await analyzeRisk({
              eventType: 'approval',
              tokenSymbol: undefined,
              spenderAddress: spender,
              amount: value.toString(),
              accountAddress,
              whitelistedAddresses: whitelisted,
            });

            const event = await storage.createRiskEvent({
              accountAddress,
              eventType: 'approval',
              tokenAddress: log.address?.toLowerCase() || '',
              tokenSymbol: undefined,
              spenderAddress: spender,
              amount: value.toString(),
              riskScore: risk.score,
              riskLevel: risk.level,
              aiReasoning: risk.reasoning,
              txHash: log.transactionHash || receipt.transactionHash,
              blockNumber: String(log.blockNumber ?? receipt.blockNumber ?? 0n),
              status: 'detected',
            });

            // Auto-revoke if enabled and high risk
            try {
              const settings = await storage.getUserSettings(accountAddress);
              if (settings?.autoRevokeEnabled && risk.score > (settings.riskThreshold || 70)) {
                const smart = await storage.getSmartAccount(accountAddress);
                if (smart) {
                  const result = await transactionService.executeGaslessRevoke({
                    tokenAddress: (log.address?.toLowerCase() || '') as Address,
                    spenderAddress: spender as Address,
                    ownerAddress: smart.ownerAddress as Address,
                    smartAccountAddress: accountAddress as Address,
                  });
                  await storage.updateRiskEventStatus(event.id, 'revoked');
                  await storage.createAuditLog({
                    accountAddress,
                    action: 'revoke_approval',
                    eventId: event.id,
                    status: result.status === 'confirmed' ? 'success' : 'pending',
                    details: { reason: 'Auto-revoked due to high risk score', riskScore: risk.score, gasless: true, userOpHash: result.userOpHash, blockNumber: result.blockNumber?.toString() },
                    txHash: result.txHash,
                  });
                }
              }
            } catch (e) {
              console.error('auto-revoke (ingest-tx) failed', e);
            }

            created.push(event);
            const clients = wsClients.get(accountAddress);
            if (clients) {
              const message = JSON.stringify({ type: 'new_event', data: event });
              clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(message); });
            }
          } else if (topic0 === TRANSFER) {
            const from = `0x${(log.topics?.[1] ?? '').slice(26)}`.toLowerCase();
            const to = `0x${(log.topics?.[2] ?? '').slice(26)}`.toLowerCase();
            const value = BigInt(log.data ?? '0');
            const candidate = addrSet.size > 0 ? ([...addrSet].find((a) => a === from || a === to) || from) : from;
            const accountAddress = candidate;

            const whitelisted = ((await storage.getUserSettings(accountAddress))?.whitelistedAddresses as string[]) || [];
            const risk = await analyzeRisk({
              eventType: 'transfer',
              tokenSymbol: undefined,
              spenderAddress: undefined,
              amount: value.toString(),
              accountAddress,
              whitelistedAddresses: whitelisted,
            });

            const event = await storage.createRiskEvent({
              accountAddress,
              eventType: 'transfer',
              tokenAddress: log.address?.toLowerCase() || '',
              tokenSymbol: undefined,
              spenderAddress: undefined,
              amount: value.toString(),
              riskScore: risk.score,
              riskLevel: risk.level,
              aiReasoning: risk.reasoning,
              txHash: log.transactionHash || receipt.transactionHash,
              blockNumber: String(log.blockNumber ?? receipt.blockNumber ?? 0n),
              status: 'detected',
            });

            created.push(event);
            const clients = wsClients.get(accountAddress);
            if (clients) {
              const message = JSON.stringify({ type: 'new_event', data: event });
              clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(message); });
            }
          }
        } catch (e) {
          console.warn('Failed to parse log from tx:', receipt.transactionHash, e);
        }
      }

      return res.json({ success: true, events: created });
    } catch (err) {
      console.error('ingest-tx error:', err);
      return res.status(500).json({ error: 'Failed to ingest tx' });
    }
  });

  // Dashboard Stats (supports comma-separated addresses)
  app.get("/api/dashboard/stats/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      const addresses = accountAddress.split(',').map((s) => s.trim()).filter(Boolean);
      const events = addresses.length > 1 ? await storage.getRiskEventsFor(addresses) : await storage.getRiskEvents(addresses[0]);

      // Use settings of the first address for whitelisted count
      const settings = await storage.getUserSettings(addresses[0]);

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

  // Envio webhook to receive indexed events from Envio HyperIndex/HyperSync
  // Expects JSON: { events: [ { type: 'approval'|'transfer', accountAddress, tokenAddress, tokenSymbol?, spenderAddress?, amount, txHash, blockNumber } ] }
  app.post('/api/envio/webhook', async (req, res) => {
    try {
      const secret = process.env.ENVIO_WEBHOOK_SECRET;
      const header = req.headers['x-envio-secret'] as string | undefined;
      if (secret && header !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const payload = req.body as any;
      if (!payload || !Array.isArray(payload.events)) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      const created: any[] = [];

      for (const ev of payload.events) {
        try {
          const eventType = (ev.type || ev.eventType || '').toLowerCase();
          const accountAddress = (ev.accountAddress || ev.owner || ev.from || ev.to || ev.address || '').toLowerCase();
          const tokenAddress = (ev.tokenAddress || ev.address || '').toLowerCase();
          const tokenSymbol = ev.tokenSymbol || ev.symbol || null;
          const spenderAddress = ev.spenderAddress || ev.spender || null;
          const amount = ev.amount ? String(ev.amount) : (ev.value ? String(ev.value) : '0');
          const txHash = ev.txHash || ev.transactionHash || ev.tx || null;
          const blockNumber = ev.blockNumber ? String(ev.blockNumber) : (ev.block ? String(ev.block) : null);

          if (!accountAddress || !tokenAddress) continue;

          // run risk analysis
          const whitelistedAddresses = ((await storage.getUserSettings(accountAddress))?.whitelistedAddresses as string[]) || [];
          const risk = await analyzeRisk({
            eventType: eventType === 'approval' ? 'approval' : 'transfer',
            tokenSymbol: tokenSymbol || undefined,
            spenderAddress: spenderAddress || undefined,
            amount: amount,
            accountAddress,
            whitelistedAddresses,
          });

          // create risk event in storage
          const insert: import('@shared/schema').InsertRiskEvent = {
            accountAddress,
            eventType: eventType === 'approval' ? 'approval' : 'transfer',
            tokenAddress,
            tokenSymbol: tokenSymbol || undefined,
            spenderAddress: spenderAddress || undefined,
            amount,
            riskScore: risk.score,
            riskLevel: risk.level,
            aiReasoning: risk.reasoning,
            txHash: txHash || undefined,
            blockNumber: blockNumber || undefined,
            status: 'detected',
          };

          const createdEvent = await storage.createRiskEvent(insert);

          // broadcast via websocket
          const clients = wsClients.get(accountAddress as string);
          if (clients) {
            const message = JSON.stringify({ type: 'new_event', data: createdEvent });
            clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) client.send(message);
            });
          }

          created.push(createdEvent);
        } catch (err) {
          console.error('Failed to process envio event:', err);
        }
      }

      return res.json({ success: true, createdCount: created.length });
    } catch (error) {
      console.error('Envio webhook error:', error);
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Risk Events Routes
  app.get("/api/events/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      const addresses = accountAddress.split(',').map((s) => s.trim()).filter(Boolean);
      const events = addresses.length > 1 ? await storage.getRiskEventsFor(addresses) : await storage.getRiskEvents(addresses[0]);
      return res.json(events);
    } catch (error) {
      console.error("Events fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/recent/:accountAddress", async (req, res) => {
    try {
      const { accountAddress } = req.params;
      const addresses = accountAddress.split(',').map((s) => s.trim()).filter(Boolean);
      const events = addresses.length > 1 ? await storage.getRiskEventsFor(addresses) : await storage.getRiskEvents(addresses[0]);
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
      console.log(`[Auto-Revoke Check] Settings:`, {
        autoRevokeEnabled: settings?.autoRevokeEnabled,
        riskThreshold: settings?.riskThreshold,
        riskScore: riskAnalysis.score,
        hasSpender: !!spenderAddress,
      });

      if (
        settings?.autoRevokeEnabled &&
        riskAnalysis.score > (settings.riskThreshold || 70) &&
        spenderAddress // Must have spender address for revocation
      ) {
        console.log(`[Auto-Revoke] Triggering auto-revoke for event...`);
        try {
          // Get smart account to find owner address
          const smartAccount = await storage.getSmartAccount(accountAddress);
          if (!smartAccount) {
            throw new Error("Smart account not found for auto-revoke");
          }

          // Execute gasless auto-revoke via paymaster (user doesn't pay gas!)
          const revokeResult = await transactionService.executeGaslessRevoke({
            tokenAddress: tokenAddress as Address,
            spenderAddress: spenderAddress as Address,
            ownerAddress: smartAccount.ownerAddress as Address,
            smartAccountAddress: accountAddress as Address,
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
              gasless: true,
              userOpHash: revokeResult.userOpHash,
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

  // Revoke approval using gasless transactions (paymaster sponsorship)
  app.post("/api/events/revoke", async (req, res) => {
    try {
      const { eventId } = req.body;
      const event = await storage.getRiskEvent(eventId);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (!event.spenderAddress || !event.tokenAddress) {
        return res.status(400).json({ error: "Event missing required addresses" });
      }

      // Get smart account to find owner address
      const smartAccount = await storage.getSmartAccount(event.accountAddress);
      if (!smartAccount) {
        return res.status(404).json({ error: "Smart account not found" });
      }

      console.log(`Executing gasless revoke for event ${eventId}...`);

      // Execute gasless revocation via paymaster (user doesn't pay gas!)
      const revokeResult = await transactionService.executeGaslessRevoke({
        tokenAddress: event.tokenAddress as Address,
        spenderAddress: event.spenderAddress as Address,
        ownerAddress: smartAccount.ownerAddress as Address, // EOA owner
        smartAccountAddress: event.accountAddress as Address, // Smart account contract
      });

      // Update event status
      await storage.updateRiskEventStatus(eventId, "revoked");

      // Create audit log with real transaction
      await storage.createAuditLog({
        accountAddress: event.accountAddress,
        action: "revoke_approval",
        eventId,
        status: revokeResult.status === "confirmed" ? "success" : "pending",
        details: {
          manual: true,
          gasless: true,
          userOpHash: revokeResult.userOpHash,
          message: "Gasless revocation via paymaster - user paid no gas fees",
        },
        txHash: revokeResult.txHash,
      });

      // Broadcast update
      const clients = wsClients.get(event.accountAddress);
      if (clients) {
        const message = JSON.stringify({
          type: "event_updated",
          data: { eventId, status: "revoked", txHash: revokeResult.txHash },
        });
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      return res.json({
        success: true,
        txHash: revokeResult.txHash,
        userOpHash: revokeResult.userOpHash,
        status: revokeResult.status,
        gasless: true,
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

  // Debug: fetch transaction and logs on-chain (useful to trace why a tx didn't surface in Envio/RPC polling)
  app.get('/api/debug/tx/:txHash', async (req, res) => {
    try {
      const { txHash } = req.params;
      const account = (req.query.account as string | undefined)?.toLowerCase();
      const publicClient = createPublicClient({ chain: monadTestnet, transport: http(monadTestnet.rpcUrls.default.http[0]) });

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

      let logs: any[] = [];
            if (receipt) {
              // fetch logs for this transaction (fetch block logs then filter by transactionHash)
              const fromBlock = BigInt(receipt.blockNumber as unknown as number);
              const toBlock = BigInt(receipt.blockNumber as unknown as number);
              const blockLogs = await publicClient.getLogs({
                fromBlock,
                toBlock,
              } as any);
              logs = blockLogs.filter((l) => l.transactionHash === (txHash as `0x${string}`));
            }

      // parse for Transfer/Approval topics
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

      const parsed = logs.map((l) => {
        return {
          address: l.address,
          topics: l.topics,
          data: l.data,
          logIndex: l.logIndex,
          blockNumber: l.blockNumber,
          isTransfer: l.topics[0] === TRANSFER_TOPIC,
          isApproval: l.topics[0] === APPROVAL_TOPIC,
        };
      });

      const matched = account
        ? parsed.filter((p) => p.topics.some((t: string) => t && t.toLowerCase().includes(account.replace('0x',''))))
        : [];

      // Convert BigInt values to strings to avoid JSON serialization errors
      const bigintToString = (input: any): any => {
        if (typeof input === 'bigint') return input.toString();
        if (Array.isArray(input)) return input.map(bigintToString);
        if (input && typeof input === 'object') {
          const out: any = {};
          for (const k of Object.keys(input)) {
            out[k] = bigintToString(input[k]);
          }
          return out;
        }
        return input;
      };

      return res.json({ receipt: bigintToString(receipt), logs: bigintToString(parsed), matched: bigintToString(matched) });
    } catch (error) {
      console.error('Debug tx endpoint error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
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
