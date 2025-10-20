import {
  createPublicClient,
  createWalletClient,
  custom,
  parseAbi,
  type Address,
  type Hash,
} from "viem";
import { monadTestnet } from "@/lib/chains";

// ERC20 ABI for approve function
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

// Public client for reading blockchain state
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: custom((window as any).ethereum),
});

interface RevokeApprovalParams {
  tokenAddress: Address;
  spenderAddress: Address;
  ownerAddress: Address;
}

interface RevokeResult {
  txHash: Hash;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: bigint;
}

export class TransactionClient {
  /**
   * Revoke ERC-20 approval using user's MetaMask wallet
   * This is the CORRECT way to revoke approvals - user signs with their wallet
   */
  async revokeApproval(params: RevokeApprovalParams): Promise<RevokeResult> {
    const { tokenAddress, spenderAddress, ownerAddress } = params;

    if (!(window as any).ethereum) {
      throw new Error("MetaMask not detected. Please install MetaMask extension.");
    }

    try {
      // Create wallet client using user's MetaMask wallet
      const walletClient = createWalletClient({
        account: ownerAddress,
        chain: monadTestnet,
        transport: custom((window as any).ethereum),
      });

      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ownerAddress, spenderAddress],
      });

      if (currentAllowance === BigInt(0)) {
        console.log("Approval already revoked");
        return {
          txHash: `0x${"0".repeat(64)}` as Hash,
          status: "confirmed",
        };
      }

      // Prepare the revoke transaction (approve with 0 amount)
      const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddress, BigInt(0)],
        chain: monadTestnet,
      });

      console.log(`Revoke transaction submitted: ${txHash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000,
      });

      return {
        txHash,
        status: receipt.status === "success" ? "confirmed" : "failed",
        blockNumber: receipt.blockNumber,
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
   * Check if user has approved a spender for a token
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
}

export const transactionClient = new TransactionClient();
