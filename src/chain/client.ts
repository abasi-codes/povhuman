import { ethers } from "ethers";
import { logger } from "../logger.js";
import type { ChainReceipt } from "./types.js";

interface ZgChainConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  chainId: number;
  explorerUrl: string;
}

const CONTRACT_ABI = [
  "function recordVerification(string calldata taskId, bytes32 verificationHash, uint32 checkpointCount) external",
  "function verifyTask(string calldata taskId) external view returns (bytes32, uint32, uint64, bool)",
  "function verifyByHash(bytes32 taskIdHash) external view returns (bytes32, uint32, uint64, bool)",
  "function transferOwnership(address newOwner) external",
  "function owner() external view returns (address)",
  "event VerificationRecorded(bytes32 indexed taskIdHash, bytes32 verificationHash, uint32 checkpointCount, uint64 timestamp)",
];

export class ZgChainClient {
  private contract: ethers.Contract;
  private config: ZgChainConfig;

  constructor(config: ZgChainConfig) {
    this.config = config;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    this.contract = new ethers.Contract(config.contractAddress, CONTRACT_ABI, wallet);
  }

  async recordVerification(
    taskId: string,
    verificationHash: string,
    checkpointCount: number,
  ): Promise<ChainReceipt> {
    // Convert SHA-256 hex to 0x-prefixed bytes32
    const hashBytes32 = "0x" + verificationHash;

    const tx = await this.contract.recordVerification(taskId, hashBytes32, checkpointCount);
    const receipt = await tx.wait(1);

    const taskIdHash = ethers.keccak256(ethers.toUtf8Bytes(taskId));

    logger.info(
      { taskId, txHash: receipt.hash, blockNumber: receipt.blockNumber },
      "Verification recorded on 0G Chain",
    );

    return {
      tx_hash: receipt.hash,
      block_number: receipt.blockNumber,
      contract_address: this.config.contractAddress,
      chain_id: this.config.chainId,
      task_id_hash: taskIdHash,
      explorer_url: `${this.config.explorerUrl}/tx/${receipt.hash}`,
    };
  }

  async verifyTask(
    taskId: string,
  ): Promise<{ verificationHash: string; checkpointCount: number; timestamp: number; exists: boolean } | null> {
    try {
      const [hash, count, ts, exists] = await this.contract.verifyTask(taskId);
      if (!exists) return null;
      return {
        verificationHash: hash.slice(2), // strip 0x prefix
        checkpointCount: Number(count),
        timestamp: Number(ts),
        exists: true,
      };
    } catch (err) {
      logger.warn({ err, taskId }, "On-chain verification lookup failed");
      return null;
    }
  }
}
