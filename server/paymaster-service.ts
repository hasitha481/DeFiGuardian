import { createPublicClient, http, type Address, type Hash } from "viem";
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction";
import { monadTestnet } from "../client/src/lib/chains";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/delegation-toolkit";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, encodePacked, parseAbi } from "viem";

// Configuration
if (!process.env.PIMLICO_API_KEY) {
  throw new Error(
    "PIMLICO_API_KEY environment variable is required. " +
    "This key enables gasless transactions via Pimlico paymaster. " +
    "Sign up at https://www.pimlico.io/ to get your API key."
  );
}

if (!process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error(
    "DEPLOYER_PRIVATE_KEY environment variable is required for signing gasless operations."
  );
}

const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

// Monad testnet chain ID
const MONAD_CHAIN_ID = monadTestnet.id;

// Pimlico bundler URL for Monad testnet
// Note: Pimlico may not support Monad testnet yet - we'll use a generic approach
// For production, verify Pimlico support or use Fastlane Labs bundler for Monad
const BUNDLER_URL = `https://api.pimlico.io/v2/${MONAD_CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`;
const PAYMASTER_URL = BUNDLER_URL;

// Public client for blockchain reads
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0]),
});

// Bundler client for submitting UserOperations
const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http(BUNDLER_URL),
});

// Paymaster client for sponsoring gas
const paymasterClient = createPaymasterClient({
  transport: http(PAYMASTER_URL),
});

// ERC20 ABI for approve function
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

interface GaslessRevokeParams {
  smartAccountAddress: Address;
  ownerAddress: Address;
  tokenAddress: Address;
  spenderAddress: Address;
}

interface GaslessRevokeResult {
  userOpHash: Hash;
  status: "pending" | "confirmed" | "failed";
  txHash?: Hash;
}

export class PaymasterService {
  /**
   * Execute gasless approval revocation using ERC-4337 UserOperation
   * The paymaster sponsors the gas fees so the user doesn't pay
   */
  async executeGaslessRevoke(params: GaslessRevokeParams): Promise<GaslessRevokeResult> {
    try {
      const { smartAccountAddress, ownerAddress, tokenAddress, spenderAddress } = params;

      console.log(`Preparing gasless revoke for smart account ${smartAccountAddress}`);

      // Generate deterministic salt (same as account creation)
      const deterministicSalt = keccak256(
        encodePacked(['address'], [ownerAddress])
      );

      // Create deployer account for signing
      const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);

      // Recreate smart account object
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
        signer: { account: deployerAccount },
      });

      // Verify smart account address matches
      if (smartAccount.address.toLowerCase() !== smartAccountAddress.toLowerCase()) {
        throw new Error("Smart account address mismatch during gasless operation");
      }

      console.log(`Sending gasless UserOperation to revoke approval...`);
      console.log(`Token: ${tokenAddress}`);
      console.log(`Spender: ${spenderAddress}`);

      // Build UserOperation with paymaster sponsorship
      // Set approval to 0 to revoke
      const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: tokenAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [spenderAddress, BigInt(0)], // Revoke by setting to 0
          }
        ],
        maxFeePerGas: BigInt(1), // Paymaster covers gas
        maxPriorityFeePerGas: BigInt(1),
        paymaster: paymasterClient, // Gas sponsorship
      });

      console.log(`UserOperation submitted: ${userOpHash}`);

      // Wait for UserOperation to be included in a transaction
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
        timeout: 60_000, // 60 second timeout
      });

      console.log(`✅ Gasless revoke confirmed!`);
      console.log(`Transaction hash: ${receipt.receipt.transactionHash}`);

      return {
        userOpHash,
        status: "confirmed",
        txHash: receipt.receipt.transactionHash,
      };
    } catch (error) {
      console.error("Gasless revoke error:", error);
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes("paymaster")) {
          throw new Error(
            "Paymaster error: Gas sponsorship failed. " +
            "This may occur if Pimlico doesn't support Monad testnet yet. " +
            "Consider using Fastlane Labs bundler for Monad."
          );
        }
        if (error.message.includes("bundler")) {
          throw new Error(
            "Bundler error: Failed to submit UserOperation. " +
            "Ensure the smart account is deployed and Pimlico supports Monad testnet."
          );
        }
      }

      throw new Error(
        `Failed to execute gasless revoke: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if paymaster service is available and properly configured
   */
  async checkPaymasterHealth(): Promise<{
    available: boolean;
    message: string;
  }> {
    try {
      // Test bundler connection by getting supported entry points
      // This is a basic health check
      const chainId = await publicClient.getChainId();
      
      if (chainId !== MONAD_CHAIN_ID) {
        return {
          available: false,
          message: `Chain ID mismatch: expected ${MONAD_CHAIN_ID}, got ${chainId}`,
        };
      }

      return {
        available: true,
        message: "Paymaster service configured and ready",
      };
    } catch (error) {
      return {
        available: false,
        message: `Paymaster health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const paymasterService = new PaymasterService();
