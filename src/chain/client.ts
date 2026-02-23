import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import bs58 from "bs58";
import { logger } from "../logger.js";
import type { ChainReceipt, TaskEscrowAccount } from "./types.js";

// Import the IDL JSON (will be loaded at runtime)
import idlJson from "./idl/verify_human.json" assert { type: "json" };

export interface SolanaChainConfig {
  rpcUrl: string;
  programId: string;
  explorerUrl: string;
  cluster: string;
  authorityKeypair: string; // base58-encoded secret key, or empty for mock
  /** When true AND programId + authorityKeypair are valid, use real on-chain calls */
  liveMode?: boolean;
}

/**
 * Solana escrow client.
 * - Live mode: sends real transactions to the deployed Anchor program.
 * - Mock mode (default): generates realistic-looking signatures without on-chain interaction.
 */
export class SolanaChainClient {
  private config: SolanaChainConfig;
  private authority: Keypair;
  private live: boolean;

  // Real Anchor objects — only set in live mode
  private connection?: Connection;
  private program?: Program;
  private configPda?: PublicKey;

  constructor(config: SolanaChainConfig) {
    this.config = config;

    // Parse authority keypair
    if (config.authorityKeypair) {
      try {
        this.authority = Keypair.fromSecretKey(bs58.decode(config.authorityKeypair));
      } catch {
        this.authority = Keypair.generate();
      }
    } else {
      this.authority = Keypair.generate();
    }

    // Determine mode: live requires valid programId + real keypair + explicit opt-in
    const hasProgram = config.programId && config.programId.length >= 32;
    const hasKeypair = config.authorityKeypair && config.authorityKeypair.length > 40;
    this.live = !!(config.liveMode && hasProgram && hasKeypair);

    if (this.live) {
      this.initLiveMode();
    }

    logger.info(
      {
        authority: this.authority.publicKey.toBase58(),
        program: config.programId || "(mock)",
        mode: this.live ? "LIVE" : "MOCK",
      },
      "SolanaChainClient initialized",
    );
  }

  get isLive(): boolean {
    return this.live;
  }

  // ─── INITIALIZATION ───

  private initLiveMode(): void {
    this.connection = new Connection(this.config.rpcUrl, "confirmed");

    const programId = new PublicKey(this.config.programId);

    // Derive config PDA: ["config"]
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      programId,
    );
    this.configPda = configPda;

    // Create an AnchorProvider with the authority wallet
    const wallet = {
      publicKey: this.authority.publicKey,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        if (tx instanceof Transaction) {
          tx.partialSign(this.authority);
        }
        return tx;
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        for (const tx of txs) {
          if (tx instanceof Transaction) {
            tx.partialSign(this.authority);
          }
        }
        return txs;
      },
    };

    const provider = new AnchorProvider(this.connection!, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    this.program = new Program(idlJson as any, provider);

    logger.info({ configPda: configPda.toBase58() }, "Live Anchor program loaded");
  }

  // ─── PDA DERIVATION ───

  private deriveEscrowPda(taskId: string): [PublicKey, number] {
    const programId = new PublicKey(this.config.programId);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(taskId)],
      programId,
    );
  }

  private explorerTxUrl(signature: string): string {
    return `${this.config.explorerUrl}/tx/${signature}?cluster=${this.config.cluster}`;
  }

  // ─── MOCK HELPERS ───

  private mockSignature(): string {
    const bytes = Keypair.generate().secretKey.slice(0, 64);
    return bs58.encode(bytes);
  }

  private mockPda(taskId: string): string {
    const encoder = new TextEncoder();
    const seed = encoder.encode(`escrow:${taskId}`);
    const bytes = new Uint8Array(32);
    for (let i = 0; i < seed.length && i < 32; i++) {
      bytes[i] = seed[i];
    }
    for (let i = seed.length; i < 32; i++) {
      bytes[i] = (bytes[i % seed.length] * 7 + i) & 0xff;
    }
    return bs58.encode(bytes);
  }

  private mockSlot(): number {
    return 300_000_000 + Math.floor(Math.random() * 1_000_000);
  }

  private mockReceipt(signature?: string): ChainReceipt {
    const sig = signature ?? this.mockSignature();
    return {
      signature: sig,
      slot: this.mockSlot(),
      program_id: this.config.programId || "VHescrow11111111111111111111111111111111111",
      explorer_url: this.explorerTxUrl(sig),
    };
  }

  // ─── PUBLIC API ───

  /**
   * Create a task escrow account. Agent deposits SOL.
   */
  async createTaskEscrow(
    taskId: string,
    agentWallet: string,
    lamports: number,
  ): Promise<{ receipt: ChainReceipt; pda: string }> {
    if (this.live && this.program) {
      return this.liveCreateTaskEscrow(taskId, agentWallet, lamports);
    }
    return this.mockCreateTaskEscrow(taskId, agentWallet, lamports);
  }

  /**
   * Human claims the task escrow.
   */
  async claimTask(
    taskId: string,
    humanWallet: string,
    pda: string,
  ): Promise<ChainReceipt> {
    if (this.live && this.program) {
      return this.liveClaimTask(taskId, humanWallet);
    }
    return this.mockClaimTask(taskId, humanWallet);
  }

  /**
   * Record a checkpoint verification on-chain.
   */
  async verifyCheckpoint(
    taskId: string,
    checkpointId: string,
    verificationHash: string,
    checkpointIndex?: number,
  ): Promise<ChainReceipt> {
    if (this.live && this.program && checkpointIndex !== undefined) {
      return this.liveVerifyCheckpoint(taskId, checkpointIndex);
    }
    return this.mockVerifyCheckpoint(taskId, checkpointId);
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
    if (this.live && this.program) {
      return this.liveCompleteAndRelease(taskId, verificationHash);
    }
    return this.mockCompleteAndRelease(taskId, checkpointCount);
  }

  /**
   * Cancel task and refund escrow SOL to the agent.
   */
  async cancelAndRefund(
    taskId: string,
    pda: string,
  ): Promise<ChainReceipt> {
    if (this.live && this.program) {
      return this.liveCancelAndRefund(taskId);
    }
    return this.mockCancelAndRefund(taskId);
  }

  /**
   * Look up a task escrow account.
   */
  async getEscrowAccount(taskId: string): Promise<TaskEscrowAccount | null> {
    if (this.live && this.program) {
      return this.liveGetEscrowAccount(taskId);
    }
    return null;
  }

  // ─── LIVE ANCHOR CALLS ───

  private async liveCreateTaskEscrow(
    taskId: string,
    agentWallet: string,
    lamports: number,
  ): Promise<{ receipt: ChainReceipt; pda: string }> {
    const [escrowPda] = this.deriveEscrowPda(taskId);
    const agentPubkey = new PublicKey(agentWallet);

    // Note: in live mode, the agent signs the tx from the frontend.
    // Here the authority submits on behalf, so we use the authority as payer.
    // In a production flow, the agent wallet would sign client-side.
    const tx = await this.program!.methods
      .createTask(taskId, 1, new BN(lamports))
      .accounts({
        config: this.configPda!,
        escrow: escrowPda,
        agent: this.authority.publicKey, // authority acts as agent for demo
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const slot = await this.connection!.getSlot();

    logger.info(
      { taskId, lamports, signature: tx.slice(0, 16) + "...", pda: escrowPda.toBase58() },
      "Live escrow created",
    );

    return {
      receipt: {
        signature: tx,
        slot,
        program_id: this.config.programId,
        explorer_url: this.explorerTxUrl(tx),
      },
      pda: escrowPda.toBase58(),
    };
  }

  private async liveClaimTask(
    taskId: string,
    humanWallet: string,
  ): Promise<ChainReceipt> {
    const [escrowPda] = this.deriveEscrowPda(taskId);

    // The human needs to sign — in a backend-driven flow, this would need
    // the human's signature passed from the frontend. For now, authority signs.
    const tx = await this.program!.methods
      .claimTask(taskId)
      .accounts({
        escrow: escrowPda,
        human: this.authority.publicKey, // proxy for demo
      })
      .rpc();

    const slot = await this.connection!.getSlot();

    logger.info({ taskId, humanWallet, signature: tx.slice(0, 16) + "..." }, "Live escrow claimed");

    return {
      signature: tx,
      slot,
      program_id: this.config.programId,
      explorer_url: this.explorerTxUrl(tx),
    };
  }

  private async liveVerifyCheckpoint(
    taskId: string,
    checkpointIndex: number,
  ): Promise<ChainReceipt> {
    const [escrowPda] = this.deriveEscrowPda(taskId);

    const tx = await this.program!.methods
      .verifyCheckpoint(taskId, checkpointIndex)
      .accounts({
        config: this.configPda!,
        escrow: escrowPda,
        authority: this.authority.publicKey,
      })
      .rpc();

    const slot = await this.connection!.getSlot();

    logger.info({ taskId, checkpointIndex, signature: tx.slice(0, 16) + "..." }, "Live checkpoint verified");

    return {
      signature: tx,
      slot,
      program_id: this.config.programId,
      explorer_url: this.explorerTxUrl(tx),
    };
  }

  private async liveCompleteAndRelease(
    taskId: string,
    verificationHash: string,
  ): Promise<ChainReceipt> {
    const [escrowPda] = this.deriveEscrowPda(taskId);

    // Fetch the escrow to get the human's pubkey
    const escrowAccount = await (this.program!.account as any).taskEscrow.fetch(escrowPda);
    const humanPubkey = escrowAccount.human as PublicKey;

    // Convert hex hash to 32-byte array
    const hashBytes = Buffer.from(verificationHash, "hex");
    const hashArray = Array.from(hashBytes.slice(0, 32));
    // Pad if short
    while (hashArray.length < 32) hashArray.push(0);

    const tx = await this.program!.methods
      .completeAndRelease(taskId, hashArray)
      .accounts({
        config: this.configPda!,
        escrow: escrowPda,
        human: humanPubkey,
        authority: this.authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const slot = await this.connection!.getSlot();

    logger.info({ taskId, signature: tx.slice(0, 16) + "..." }, "Live escrow released");

    return {
      signature: tx,
      slot,
      program_id: this.config.programId,
      explorer_url: this.explorerTxUrl(tx),
    };
  }

  private async liveCancelAndRefund(
    taskId: string,
  ): Promise<ChainReceipt> {
    const [escrowPda] = this.deriveEscrowPda(taskId);

    // Fetch the escrow to get the agent's pubkey
    const escrowAccount = await (this.program!.account as any).taskEscrow.fetch(escrowPda);
    const agentPubkey = escrowAccount.agent as PublicKey;

    const tx = await this.program!.methods
      .cancelAndRefund(taskId)
      .accounts({
        config: this.configPda!,
        escrow: escrowPda,
        agent: agentPubkey,
        signer: this.authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const slot = await this.connection!.getSlot();

    logger.info({ taskId, signature: tx.slice(0, 16) + "..." }, "Live escrow refunded");

    return {
      signature: tx,
      slot,
      program_id: this.config.programId,
      explorer_url: this.explorerTxUrl(tx),
    };
  }

  private async liveGetEscrowAccount(taskId: string): Promise<TaskEscrowAccount | null> {
    try {
      const [escrowPda] = this.deriveEscrowPda(taskId);
      const account = await (this.program!.account as any).taskEscrow.fetch(escrowPda);

      const statusMap: Record<number, TaskEscrowAccount["status"]> = {
        0: "deposited",
        1: "deposited",
        2: "released",
        3: "refunded",
      };

      return {
        task_id: account.taskId,
        agent_wallet: (account.agent as PublicKey).toBase58(),
        human_wallet: (account.human as PublicKey).equals(PublicKey.default)
          ? null
          : (account.human as PublicKey).toBase58(),
        escrow_lamports: (account.escrowLamports as BN).toNumber(),
        status: statusMap[account.status] ?? "deposited",
        deposit_signature: "", // not stored on-chain
        release_signature: null,
        pda: escrowPda.toBase58(),
      };
    } catch (err) {
      logger.debug({ err, taskId }, "Escrow account not found on-chain");
      return null;
    }
  }

  // ─── MOCK IMPLEMENTATIONS ───

  private async mockCreateTaskEscrow(
    taskId: string,
    agentWallet: string,
    lamports: number,
  ): Promise<{ receipt: ChainReceipt; pda: string }> {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 100));
    const pda = this.mockPda(taskId);
    const receipt = this.mockReceipt();

    logger.info(
      { taskId, agentWallet, lamports, signature: receipt.signature.slice(0, 16) + "...", pda: pda.slice(0, 16) + "..." },
      "Mock escrow created",
    );

    return { receipt, pda };
  }

  private async mockClaimTask(
    taskId: string,
    humanWallet: string,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
    const receipt = this.mockReceipt();

    logger.info({ taskId, humanWallet, signature: receipt.signature.slice(0, 16) + "..." }, "Mock escrow claimed");
    return receipt;
  }

  private async mockVerifyCheckpoint(
    taskId: string,
    checkpointId: string,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
    const receipt = this.mockReceipt();

    logger.info({ taskId, checkpointId, signature: receipt.signature.slice(0, 16) + "..." }, "Mock checkpoint verified on-chain");
    return receipt;
  }

  private async mockCompleteAndRelease(
    taskId: string,
    checkpointCount: number,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 150));
    const receipt = this.mockReceipt();

    logger.info({ taskId, checkpointCount, signature: receipt.signature.slice(0, 16) + "..." }, "Mock escrow released");
    return receipt;
  }

  private async mockCancelAndRefund(
    taskId: string,
  ): Promise<ChainReceipt> {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 100));
    const receipt = this.mockReceipt();

    logger.info({ taskId, signature: receipt.signature.slice(0, 16) + "..." }, "Mock escrow refunded");
    return receipt;
  }
}
