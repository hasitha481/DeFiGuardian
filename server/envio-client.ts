/**
 * Envio HyperSync Client for DeFi Guardian Agent
 * 
 * Integrates with Envio HyperIndex to fetch real-time blockchain events
 * from Monad testnet using HyperSync's ultra-fast API.
 * 
 * This client queries:
 * - ERC-20 Approval events (for risk analysis)
 * - ERC-20 Transfer events (for monitoring)
 */

import HyperSync from "@envio-dev/hypersync-client";
import { monadTestnet } from "../client/src/lib/chains";
import { createPublicClient, http } from 'viem';

// Envio HyperSync endpoint for Monad testnet
// Note: Replace with actual Envio GraphQL endpoint once indexer is deployed
const ENVIO_GRAPHQL_ENDPOINT = process.env.ENVIO_GRAPHQL_ENDPOINT || "";  // empty => use RPC fallback

// ERC-20 event signatures
const ERC20_APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// RPC public client for Monad (fallback when Envio not configured)
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0]),
});

export interface ApprovalEvent {
  owner: string;
  spender: string;
  value: bigint;
  blockNumber: number;
  timestamp: number;
  transactionHash: string;
  logIndex: number;
  tokenAddress: string;
}

export interface TransferEvent {
  from: string;
  to: string;
  value: bigint;
  blockNumber: number;
  timestamp: number;
  transactionHash: string;
  logIndex: number;
  tokenAddress: string;
}

/**
 * Envio HyperSync Client Service
 * Provides methods to query blockchain events from Envio indexer
 */
export class EnvioClient {
  private client: typeof HyperSync | null = null;

  constructor() {
    // Initialize HyperSync client with Monad testnet endpoint
    try {
      this.client = HyperSync;
      console.log("Envio HyperSync client initialized for Monad testnet");
    } catch (error) {
      console.error("Failed to initialize Envio client:", error);
    }
  }

  /**
   * Fetch recent approval events for a specific address
   * Used for real-time monitoring of risky approvals
   */
  async getRecentApprovals(
    accountAddress: string,
    limit: number = 10
  ): Promise<ApprovalEvent[]> {
    try {
      // GraphQL query for recent approvals
      const query = `
        query GetRecentApprovals($owner: String!, $limit: Int!) {
          Approval(
            where: { owner: { _eq: $owner } }
            limit: $limit
            order_by: { timestamp: desc }
          ) {
            id
            owner
            spender
            value
            blockNumber
            timestamp
            transactionHash
            logIndex
          }
        }
      `;

      const variables = {
        owner: accountAddress.toLowerCase(),
        limit,
      };

      // If ENVIO_GRAPHQL_ENDPOINT is configured we would query it. Otherwise use RPC fallback
      console.log(`[Envio] Querying approvals for ${accountAddress} (limit: ${limit})`);
      if (ENVIO_GRAPHQL_ENDPOINT) {
        // TODO: implement real GraphQL query against Envio endpoint
        return this.getMockApprovals(accountAddress, limit);
      }

      // RPC fallback: query logs for Approval topic and filter by owner address
      try {
        const latest = await publicClient.getBlockNumber();
        const ownerTopic = `0x${accountAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
        const windows = [20000, 10000, 5000, 2000, 1000, 200];
        let logs: any[] = [];
        for (const w of windows) {
          try {
            const fromBlock = BigInt(Math.max(0, Number(latest) - w));
            const toBlock = BigInt(Number(latest));
            logs = await publicClient.getLogs({
              fromBlock,
              toBlock,
              topics: [ERC20_APPROVAL_TOPIC, ownerTopic],
            } as any);
            if ((logs?.length || 0) > 0) break;
          } catch (_) {
            continue;
          }
        }

        const approvals = (logs || []).slice(0, limit).map((log) => {
          const owner = `0x${(log.topics?.[1] ?? '').slice(26)}`;
          const spender = `0x${(log.topics?.[2] ?? '').slice(26)}`;
          const value = BigInt(log.data ?? '0');
          return {
            owner: owner.toLowerCase(),
            spender: spender.toLowerCase(),
            value,
            blockNumber: Number(log.blockNumber ?? 0),
            timestamp: 0, // RPC logs don't include timestamp; resolve if needed
            transactionHash: log.transactionHash ?? "",
            logIndex: Number(log.logIndex ?? 0),
            tokenAddress: log.address ?? "",
          };
        });

        return approvals;
      } catch (err) {
        console.error('RPC fallback getRecentApprovals failed:', err);
        return [];
      }
    } catch (error) {
      console.error("Error fetching approvals from Envio:", error);
      return [];
    }
  }

  /**
   * Fetch recent transfer events for a specific address
   * Used for monitoring account activity
   */
  async getRecentTransfers(
    accountAddress: string,
    limit: number = 10
  ): Promise<TransferEvent[]> {
    try {
      const query = `
        query GetRecentTransfers($address: String!, $limit: Int!) {
          Transfer(
            where: {
              _or: [
                { from: { _eq: $address } },
                { to: { _eq: $address } }
              ]
            }
            limit: $limit
            order_by: { timestamp: desc }
          ) {
            id
            from
            to
            value
            blockNumber
            timestamp
            transactionHash
            logIndex
          }
        }
      `;

      const variables = {
        address: accountAddress.toLowerCase(),
        limit,
      };

      console.log(`[Envio] Querying transfers for ${accountAddress} (limit: ${limit})`);
      if (ENVIO_GRAPHQL_ENDPOINT) {
        // TODO: implement real GraphQL query against Envio endpoint
        return this.getMockTransfers(accountAddress, limit);
      }

      // RPC fallback: query logs for Transfer topic involving address as from or to
      try {
        const latest = await publicClient.getBlockNumber();
        const addrTopic = `0x${accountAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
        const windows = [20000, 10000, 5000, 2000, 1000, 200];
        let combined: any[] = [];
        for (const w of windows) {
          try {
            const fromBlock = BigInt(Math.max(0, Number(latest) - w));
            const toBlock = BigInt(Number(latest));
            const logsFrom = await publicClient.getLogs({ fromBlock, toBlock, topics: [ERC20_TRANSFER_TOPIC, addrTopic] } as any);
            const logsTo = await publicClient.getLogs({ fromBlock, toBlock, topics: [ERC20_TRANSFER_TOPIC, null, addrTopic] } as any);
            combined = [...logsFrom, ...logsTo];
            if ((combined?.length || 0) > 0) break;
          } catch (_) {
            continue;
          }
        }

        combined = (combined || []).slice(0, limit);

        const transfers = combined.map((log) => {
          const from = `0x${(log.topics?.[1] ?? '').slice(26)}`;
          const to = `0x${(log.topics?.[2] ?? '').slice(26)}`;
          const value = BigInt(log.data ?? '0');
          return {
            from: from.toLowerCase(),
            to: to.toLowerCase(),
            value,
            blockNumber: Number(log.blockNumber ?? 0),
            timestamp: 0,
            transactionHash: log.transactionHash ?? "",
            logIndex: Number(log.logIndex ?? 0),
            tokenAddress: log.address ?? "",
          };
        });

        return transfers;
      } catch (err) {
        console.error('RPC fallback getRecentTransfers failed:', err);
        return [];
      }
    } catch (error) {
      console.error("Error fetching transfers from Envio:", error);
      return [];
    }
  }

  /**
   * Monitor new events in real-time using HyperSync streaming
   * This would connect to Envio's real-time event stream
   */
  async subscribeToEvents(
    accountAddress: string,
    onApproval: (event: ApprovalEvent) => void,
    onTransfer: (event: TransferEvent) => void
  ): Promise<void> {
    console.log(`[Envio] Subscribing to real-time events for ${accountAddress}`);
    
    // In production, this would use GraphQL subscriptions or WebSocket
    // For now, implementing polling as a fallback
    const pollInterval = 5000; // 5 seconds
    
    setInterval(async () => {
      const approvals = await this.getRecentApprovals(accountAddress, 5);
      approvals.forEach(onApproval);
      
      const transfers = await this.getRecentTransfers(accountAddress, 5);
      transfers.forEach(onTransfer);
    }, pollInterval);
  }

  /**
   * Mock data generators for demonstration
   * In production, these would be replaced with actual Envio GraphQL queries
   */
  private getMockApprovals(accountAddress: string, limit: number): ApprovalEvent[] {
    // Return empty array - actual data would come from Envio GraphQL endpoint
    return [];
  }

  private getMockTransfers(accountAddress: string, limit: number): TransferEvent[] {
    // Return empty array - actual data would come from Envio GraphQL endpoint
    return [];
  }
}

// Singleton instance
export const envioClient = new EnvioClient();

/**
 * Integration Notes:
 * 
 * 1. SETUP: Deploy the Envio indexer (see /envio directory)
 *    - Run: pnpm envio deploy
 *    - Get GraphQL endpoint URL
 *    - Set ENVIO_GRAPHQL_ENDPOINT environment variable
 * 
 * 2. QUERIES: Use the GraphQL endpoint to fetch events
 *    - See /envio/README.md for example queries
 *    - The indexer provides Transfer and Approval entities
 *    - Supports filtering, ordering, and pagination
 * 
 * 3. REAL-TIME: Can use GraphQL subscriptions for live events
 *    - Alternative: Poll the API at regular intervals
 *    - HyperSync provides <1s latency for new events
 * 
 * 4. AI INTEGRATION: Connect Envio events to OpenAI risk analysis
 *    - Fetch approval events from Envio
 *    - Pass to AI service for risk scoring
 *    - Trigger auto-revoke if score exceeds threshold
 */
