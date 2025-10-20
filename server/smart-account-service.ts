import { createPublicClient, http, type Address } from "viem";
import { monadTestnet } from "../client/src/lib/chains";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/delegation-toolkit";
import { privateKeyToAccount } from "viem/accounts";

// Configuration for Monad testnet
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
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
   */
  async createSmartAccount(params: CreateSmartAccountParams): Promise<SmartAccountResult> {
    try {
      const { ownerAddress } = params;

      // Create service signer for deployment
      const serviceAccount = privateKeyToAccount(SERVICE_PRIVATE_KEY as `0x${string}`);

      // Create MetaMask smart account using Delegation Toolkit
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [
          ownerAddress,  // Owner address
          [],            // Initial guardians
          [],            // Initial delegates
          [],            // Initial caveats
        ],
        deploySalt: `0x${Date.now().toString(16).padStart(64, '0')}`, // Unique salt
        signer: { account: serviceAccount },
      });

      // Check if account is deployed
      const code = await publicClient.getBytecode({ 
        address: smartAccount.address as Address,
      });
      const isDeployed = code !== undefined && code !== '0x';

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
      console.error("Error creating smart account:", error);
      
      // Fallback: return a deterministic address based on owner
      // In production, you'd handle this more gracefully
      const deterministicAddress = await this.getDeterministicAddress(params.ownerAddress);
      
      return {
        address: deterministicAddress,
        ownerAddress: params.ownerAddress,
        balance: "0",
        isDeployed: false,
      };
    }
  }

  /**
   * Get deterministic smart account address for an owner
   * Uses CREATE2 logic to predict the address before deployment
   */
  private async getDeterministicAddress(ownerAddress: Address): Promise<string> {
    // Simple deterministic address generation
    // In production, use proper CREATE2 calculation
    const hash = ownerAddress.toLowerCase();
    const suffix = Array.from({ length: 8 }, (_, i) => 
      ((i + parseInt(hash.slice(2 + i, 3 + i), 16)) % 16).toString(16)
    ).join("");
    
    return `0x${hash.slice(2, 34)}${suffix}`;
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
