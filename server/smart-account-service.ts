import { createPublicClient, createWalletClient, http, type Address, keccak256, encodePacked } from "viem";
import { monadTestnet } from "../client/src/lib/chains";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/delegation-toolkit";
import { privateKeyToAccount } from "viem/accounts";

// Configuration for Monad testnet with explicit RPC URL
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0]),
});

// Service account for delegation operations (in production, manage this securely)
const SERVICE_PRIVATE_KEY = process.env.SERVICE_ACCOUNT_KEY || 
  "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

interface CreateSmartAccountParams {
  ownerAddress: Address;
}

interface SmartAccountResult {
  address: string;
  ownerAddress: string;
  balance: string;
  isDeployed: boolean;
}

export class SmartAccountService {
  /**
   * Creates a MetaMask smart account for the owner address using Delegation Toolkit
   * Uses deterministic CREATE2 salt for stable addresses
   */
  async createSmartAccount(params: CreateSmartAccountParams): Promise<SmartAccountResult> {
    try {
      const { ownerAddress } = params;

      // Generate deterministic salt based on owner address (CREATE2 pattern)
      const deterministicSalt = keccak256(
        encodePacked(['address'], [ownerAddress])
      );

      // Create service signer for deployment
      const serviceAccount = privateKeyToAccount(SERVICE_PRIVATE_KEY as `0x${string}`);

      // Create wallet client for deployment transactions
      const walletClient = createWalletClient({
        account: serviceAccount,
        chain: monadTestnet,
        transport: http(monadTestnet.rpcUrls.default.http[0]),
      });

      // Create MetaMask smart account using Delegation Toolkit
      // Uses deterministic CREATE2 to predict the smart account address
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [
          ownerAddress,  // Owner address
          [],            // Initial guardians (empty for EOA-only)
          [],            // Initial public key X coordinates (empty for EOA-only)
          [],            // Initial public key Y coordinates (empty for EOA-only)
        ],
        deploySalt: deterministicSalt, // Deterministic salt based on owner
        signer: { walletClient }, // Wallet Client signer per official docs
      });

      // Check if account is already deployed
      let isDeployed = await this.isAccountDeployed(smartAccount.address as Address);

      // Deploy smart account on-chain if not already deployed
      if (!isDeployed) {
        try {
          // Note: Real deployment would require calling smartAccount.deploy()
          // or sending a UserOperation through a bundler
          // For MVP, we mark as not deployed and show deterministic address
          console.log(`Smart account ${smartAccount.address} created (not yet deployed on-chain)`);
        } catch (deployError) {
          console.warn("Smart account deployment skipped (requires bundler):", deployError);
        }
      }

      // Get balance
      const balance = await publicClient.getBalance({ 
        address: smartAccount.address as Address,
      });

      return {
        address: smartAccount.address,
        ownerAddress,
        balance: balance.toString(),
        isDeployed,
      };
    } catch (error) {
      console.error("Error creating smart account with Delegation Toolkit:", error);
      throw new Error(`Failed to create smart account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if smart account exists and is deployed on-chain
   */
  async isAccountDeployed(address: Address): Promise<boolean> {
    try {
      const code = await publicClient.getBytecode({ address });
      return code !== undefined && code !== '0x';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get balance of smart account
   */
  async getBalance(address: Address): Promise<string> {
    try {
      const balance = await publicClient.getBalance({ address });
      return balance.toString();
    } catch (error) {
      return "0";
    }
  }
}

export const smartAccountService = new SmartAccountService();
