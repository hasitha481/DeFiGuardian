import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hash,
} from "viem";
import { monadTestnet } from "../client/src/lib/chains";
import { privateKeyToAccount } from "viem/accounts";

// ERC20 ABI for approve function
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

// Public client for reading blockchain state
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0]),
});

// Service account for signing transactions (in production, use user's wallet or delegation)
const SERVICE_PRIVATE_KEY =
  process.env.SERVICE_ACCOUNT_KEY ||
  "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");

interface RevokeApprovalParams {
  tokenAddress: Address;
  spenderAddress: Address;
  ownerAddress: Address; // Smart account address
}

interface RevokeResult {
  txHash: Hash;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: bigint;
  gasUsed?: bigint;
}

export class TransactionService {
  /**
   * Get transaction data for revoking ERC-20 approval
   * Returns data needed for client-side signing with MetaMask
   */
  async prepareRevokeTransaction(params: RevokeApprovalParams): Promise<{
    tokenAddress: Address;
    spenderAddress: Address;
    ownerAddress: Address;
  }> {
    // Return transaction parameters for client-side signing
    return params;
  }

  /**
   * DEPRECATED: Server-side approval revocation requires user wallet or delegation
   * Use client-side signing instead (see transaction-client.ts)
   */
  async revokeApproval(params: RevokeApprovalParams): Promise<RevokeResult> {
    const { tokenAddress, spenderAddress, ownerAddress } = params;

    try {
      // Check current allowance first
      const currentAllowance = await this.getAllowance(
        tokenAddress,
        ownerAddress,
        spenderAddress
      );

      if (currentAllowance === BigInt(0)) {
        console.log("Approval already revoked (allowance is 0)");
        // Return a fake successful transaction for already-revoked approvals
        return {
          txHash: `0x${"0".repeat(64)}` as Hash,
          status: "confirmed",
          blockNumber: BigInt(0),
        };
      }

      // LIMITATION: This implementation demonstrates the transaction structure
      // but uses a service account which CANNOT revoke approvals for smart accounts.
      // For real functionality, use client-side signing (see transaction-client.ts)
      // or implement delegation/bundler integration.
      //
      // The correct flow is:
      // 1. Frontend calls transactionClient.revokeApproval() with user's wallet
      // 2. User signs transaction via MetaMask
      // 3. Frontend submits tx hash back to backend for tracking
      
      console.warn(
        "MOCK: Server-side revocation cannot actually revoke smart account approvals. " +
        "Implement Task 3b (Frontend Transaction Integration) for real functionality."
      );

      // Return mock success for development/testing
      // In production, this would fail because service account != smart account
      const mockTxHash = `0x${Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("")}` as Hash;

      return {
        txHash: mockTxHash,
        status: "confirmed",
        blockNumber: BigInt(Math.floor(Math.random() * 1000000)),
        gasUsed: BigInt(21000),
      };
    } catch (error) {
      console.error("Error revoking approval:", error);
      throw new Error(
        `Failed to revoke approval: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check current allowance for a token
   */
  async getAllowance(
    tokenAddress: Address,
    ownerAddress: Address,
    spenderAddress: Address
  ): Promise<bigint> {
    try {
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ownerAddress, spenderAddress],
      });

      return allowance;
    } catch (error) {
      console.error("Error checking allowance:", error);
      return BigInt(0);
    }
  }

  /**
   * Get token information (symbol, decimals)
   */
  async getTokenInfo(tokenAddress: Address): Promise<{
    symbol: string;
    decimals: number;
  } | null> {
    try {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);

      return { symbol, decimals };
    } catch (error) {
      console.error("Error getting token info:", error);
      return null;
    }
  }

  /**
   * Get transaction status by hash
   */
  async getTransactionStatus(txHash: Hash): Promise<{
    status: "pending" | "confirmed" | "failed" | "not_found";
    blockNumber?: bigint;
  }> {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      
      return {
        status: receipt.status === "success" ? "confirmed" : "failed",
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      // Transaction not found or still pending
      return { status: "not_found" };
    }
  }
}

export const transactionService = new TransactionService();
