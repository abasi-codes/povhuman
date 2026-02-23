import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { logger } from "../logger.js";
import type { ChainReceipt, TaskEscrowAccount } from "./types.js";

interface SolanaChainConfig {
  rpcUrl: string;
  programId: string;
  explorerUrl: string;
  cluster: string;
  authorityKeypair: string; // base58-encoded secret key, or empty for mock
}

/**
 * Mock Solana escrow client. Generates realistic-looking signatures and PDAs
 * but does not interact with a real on-chain program (that's Phase 2B).
 */
export class SolanaChainClient {
  private config: SolanaChainConfig;
  private authority: Keypair;

  constructor(config: SolanaChainConfig) {
    this.config = config;
    // If a real keypair is provided, use it; otherwise generate a throwaway one for mock sigs
    if (config.authorityKeypair) {
      try {
        this.authority = Keypair.fromSecretKey(bs58.decode(config.authorityKeypair));
      } catch {
        this.authority = Keypair.generate();
      }
    } else {
      this.authority = Keypair.generate();
    }
    logger.info(
      { authority: this.authority.publicKey.toBase58(), program: config.programId || "(mock)" },
      "SolanaChainClient initialized",
    );
  }

  /** Generate a realistic base58 signature (88 chars) */
  private mockSignature(): string {
    const bytes = Keypair.generate().secretKey.slice(0, 64);
    return bs58.encode(bytes);
  }

  /** Generate a deterministic PDA-like address from task_id */
  private mockPda(taskId: string): string {
    const encoder = new TextEncoder();
    const seed = encoder.encode(`escrow:${taskId}`);
    // Use first 32 bytes of a hash-like derivation
    const bytes = new Uint8Array(32);
    for (let i = 0; i < seed.length && i < 32; i++) {
      bytes[i] = seed[i];
    }
    // Fill remaining with deterministic values
    for (let i = seed.length; i < 32; i++) {
      bytes[i] = (bytes[i % seed.length] * 7 + i) & 0xff;
    }
    return bs58.encode(bytes);
  }

  private mockSlot(): number {
    return 300_000_000 + Math.floor(Math.random() * 1_000_000);
  }

  private explorerTxUrl(signature: string): string {
    return `${this.config.explorerUrl}/tx/${signature}?cluster=${this.config.cluster}`;
  }

  /**
   * Create a task escrow account. Agent deposits SOL.
   */
  async createTaskEscrow(
    taskId: string,
    agentWallet: string,
    lamports: number,
  ): Promise<{ receipt: ChainReceipt; pda: string }> {
    // Simulate ~200ms network delay
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 100));

    const signature = this.mockSignature();
    const pda = this.mockPda(taskId);
    const slot = this.mockSlot();

    logger.info(
      { taskId, agentWallet, lamports, signature: signature.slice(0, 16) + "...", pda: pda.slice(0, 16) + "..." },
      "Mock escrow created",
    );

    return {
      receipt: {
        signature,
        slot,
        program_id: this.config.programId || "VHesc1111111111111111111111111111111111111111",
        explorer_url: this.explorerTxUrl(signature),
      },
      pda,
    };
  }

  /**
   * Human claims the task escrow.
   */
  async claimTask(
    taskId: string,
    humanWallet: string,
    pda: string,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));

    const signature = this.mockSignature();
    const slot = this.mockSlot();

    logger.info(
      { taskId, humanWallet, signature: signature.slice(0, 16) + "..." },
      "Mock escrow claimed",
    );

    return {
      signature,
      slot,
      program_id: this.config.programId || "VHesc1111111111111111111111111111111111111111",
      explorer_url: this.explorerTxUrl(signature),
    };
  }

  /**
   * Record a checkpoint verification on-chain.
   */
  async verifyCheckpoint(
    taskId: string,
    checkpointId: string,
    verificationHash: string,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));

    const signature = this.mockSignature();
    const slot = this.mockSlot();

    logger.info(
      { taskId, checkpointId, signature: signature.slice(0, 16) + "..." },
      "Mock checkpoint verified on-chain",
    );

    return {
      signature,
      slot,
      program_id: this.config.programId || "VHesc1111111111111111111111111111111111111111",
      explorer_url: this.explorerTxUrl(signature),
    };
  }

  /**
   * Complete task and release escrow SOL to the human.
   */
  async completeAndRelease(
    taskId: string,
    pda: string,
    verificationHash: string,
    checkpointCount: number,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 150));

    const signature = this.mockSignature();
    const slot = this.mockSlot();

    logger.info(
      { taskId, checkpointCount, signature: signature.slice(0, 16) + "..." },
      "Mock escrow released",
    );

    return {
      signature,
      slot,
      program_id: this.config.programId || "VHesc1111111111111111111111111111111111111111",
      explorer_url: this.explorerTxUrl(signature),
    };
  }

  /**
   * Cancel task and refund escrow SOL to the agent.
   */
  async cancelAndRefund(
    taskId: string,
    pda: string,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 100));

    const signature = this.mockSignature();
    const slot = this.mockSlot();

    logger.info(
      { taskId, signature: signature.slice(0, 16) + "..." },
      "Mock escrow refunded",
    );

    return {
      signature,
      slot,
      program_id: this.config.programId || "VHesc1111111111111111111111111111111111111111",
      explorer_url: this.explorerTxUrl(signature),
    };
  }

  /**
   * Look up a task escrow account (mock).
   */
  async getEscrowAccount(taskId: string): Promise<TaskEscrowAccount | null> {
    // In mock mode, always return null (no real on-chain state)
    return null;
  }
}
