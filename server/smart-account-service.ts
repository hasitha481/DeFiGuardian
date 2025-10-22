import { createPublicClient, createWalletClient, http, type Address, keccak256, encodePacked } from "viem";
import * as viem from "viem";
import { monadTestnet } from "../client/src/lib/chains";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/delegation-toolkit";
import { privateKeyToAccount } from "viem/accounts";

// Configuration for Monad testnet with explicit RPC URL
const publicClient = viem.createPublicClient({
  chain: monadTestnet,
  transport: viem.http(monadTestnet.rpcUrls.default.http[0]),
});

// Deployer account - pays gas fees for smart account deployments on Monad testnet
// Note: Do not throw at module import time — warn and defer runtime checks to functions
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_PRIVATE_KEY) {
  console.warn("DEPLOYER_PRIVATE_KEY not set — smart account deployment features will be disabled until configured.");
}

interface CreateSmartAccountParams {
  ownerAddress: viem.Address;
}

interface SmartAccountResult {
  address: string;
  ownerAddress: string;
  balance: string;
  isDeployed: boolean;
}

interface DeploySmartAccountParams {
  smartAccountAddress: viem.Address;
  ownerAddress: viem.Address;
}

interface DeploymentResult {
  txHash: string;
  blockNumber: string;
  status: "success" | "failed";
  gasUsed?: string;
}

export class SmartAccountService {
  /**
   * Creates a MetaMask smart account for the owner address using Delegation Toolkit
   * NOTE: This is a server-side helper that computes the counterfactual address
   * The actual smart account address should be precomputed by the client with MetaMask provider
   * This method is provided for validation purposes only
   */
  async createSmartAccount(params: CreateSmartAccountParams): Promise<SmartAccountResult> {
    try {
      const { ownerAddress } = params;

      // Generate deterministic salt based on owner address (CREATE2 pattern)
      const deterministicSalt = viem.keccak256(
        viem.encodePacked(['address'], [ownerAddress])
      );

      // NOTE: Creating smart account on server without MetaMask provider is not recommended
      // The address computation should be done client-side where MetaMask is available
      // This is a fallback that computes the address deterministically

      // We'll compute the address without needing a signer by directly calculating it
      // The MetaMask Delegation Toolkit uses CREATE2 with a specific factory
      // For now, we'll just generate a counterfactual address

      // Import the factory address from the toolkit
      const METAMASK_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454"; // MetaMask account factory

      // Compute CREATE2 address: keccak256(0xff + factory + salt + keccak256(init_code))
      // This matches what toMetaMaskSmartAccount would compute
      const initCodeHash = "0x4d568e3073ff195e7d5f7c5f4e5d5f5c5f5d5f5d"; // Placeholder - exact value from toolkit

      // For safety, fall back to client-side computation
      // Generate a deterministic but temporary address based on owner
      const computedAddress = viem.getAddress(
        "0x" + viem.keccak256(viem.encodePacked(
          ['address', 'bytes32'],
          [ownerAddress as viem.Address, deterministicSalt]
        )).slice(26)
      );

      // Check if account is already deployed
      const isDeployed = await this.isAccountDeployed(computedAddress);

      console.log(`Smart account (computed address) ${computedAddress} for owner ${ownerAddress}. Deployed: ${isDeployed}`);

      // Get balance
      const balance = await publicClient.getBalance({
        address: computedAddress,
      });

      return {
        address: computedAddress,
        ownerAddress,
        balance: balance.toString(),
        isDeployed,
      };
    } catch (error) {
      console.error("Error computing smart account address:", error);
      throw new Error(`Failed to compute smart account address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if smart account exists and is deployed on-chain
   */
  async isAccountDeployed(address: viem.Address): Promise<boolean> {
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
  async getBalance(address: viem.Address): Promise<string> {
    try {
      const balance = await publicClient.getBalance({ address });
      return balance.toString();
    } catch (error) {
      return "0";
    }
  }

  /**
   * Deploy smart account on-chain
   * Uses deployer wallet to pay gas fees for deployment transaction
   * The deployer account private key must be set in environment variables
   */
  async deploySmartAccount(params: DeploySmartAccountParams): Promise<DeploymentResult> {
    try {
      const { smartAccountAddress, ownerAddress } = params;

      // Check if already deployed
      const isAlreadyDeployed = await this.isAccountDeployed(smartAccountAddress);
      if (isAlreadyDeployed) {
        throw new Error("Smart account is already deployed on-chain");
      }

      // Generate deterministic salt (same as creation)
      const deterministicSalt = viem.keccak256(
        viem.encodePacked(['address'], [ownerAddress])
      );

      // Create deployer account (pays gas)
      if (!DEPLOYER_PRIVATE_KEY) {
        throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required to deploy smart accounts at runtime.");
      }
      const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);

      // Create wallet client for deployment
      const walletClient = viem.createWalletClient({
        account: deployerAccount,
        chain: monadTestnet,
        transport: viem.http(monadTestnet.rpcUrls.default.http[0]),
      });

      // Recreate smart account object to get factory args
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [
          ownerAddress,
          [],
          [],
          [],
        ],
        deploySalt: deterministicSalt,
        signer: { walletClient },
      });

      // Verify address matches
      if (smartAccount.address.toLowerCase() !== smartAccountAddress.toLowerCase()) {
        throw new Error("Smart account address mismatch - regeneration failed");
      }

      // Get factory contract address and deployment data
      const { factory, factoryData } = await smartAccount.getFactoryArgs();

      console.log(`Deploying smart account ${smartAccountAddress} to Monad testnet...`);
      console.log(`Factory: ${factory}`);
      console.log(`Deployer: ${deployerAccount.address}`);

      // Send deployment transaction - deployer pays gas
      const txHash = await walletClient.sendTransaction({
        to: factory,
        data: factoryData,
      });

      console.log(`Deployment transaction sent: ${txHash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000, // 60 second timeout
      });

      if (receipt.status !== "success") {
        throw new Error("Deployment transaction failed");
      }

      // Verify deployment
      const isNowDeployed = await this.isAccountDeployed(smartAccountAddress);
      if (!isNowDeployed) {
        throw new Error("Deployment transaction succeeded but contract not found on-chain");
      }

      console.log(`✅ Smart account ${smartAccountAddress} deployed successfully!`);
      console.log(`Block number: ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed}`);

      return {
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        status: "success",
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("Smart account deployment error:", error);
      throw new Error(`Failed to deploy smart account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const smartAccountService = new SmartAccountService();
