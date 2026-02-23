/**
 * Program IDL type for verify_human.
 * Auto-generated from anchor build — do not edit manually.
 * Regenerate after program changes with: anchor build && cp target/idl/verify_human.json src/chain/idl/
 */
export type VerifyHuman = {
  address: string;
  metadata: {
    name: "verify_human";
    version: "0.1.0";
    spec: "0.1.0";
    description: string;
  };
  instructions: [
    {
      name: "initialize";
      discriminator: number[];
      accounts: Array<{
        name: string;
        writable?: boolean;
        signer?: boolean;
        pda?: { seeds: Array<{ kind: string; value?: number[]; path?: string }> };
        address?: string;
      }>;
      args: [{ name: "fee_bps"; type: "u16" }];
    },
    {
      name: "create_task";
      discriminator: number[];
      accounts: Array<{
        name: string;
        writable?: boolean;
        signer?: boolean;
        pda?: { seeds: Array<{ kind: string; value?: number[]; path?: string }> };
        address?: string;
      }>;
      args: [
        { name: "task_id"; type: "string" },
        { name: "checkpoint_count"; type: "u8" },
        { name: "escrow_lamports"; type: "u64" },
      ];
    },
    {
      name: "claim_task";
      discriminator: number[];
      accounts: Array<{
        name: string;
        writable?: boolean;
        signer?: boolean;
        pda?: { seeds: Array<{ kind: string; value?: number[]; path?: string }> };
      }>;
      args: [{ name: "task_id"; type: "string" }];
    },
    {
      name: "verify_checkpoint";
      discriminator: number[];
      accounts: Array<{
        name: string;
        writable?: boolean;
        signer?: boolean;
        pda?: { seeds: Array<{ kind: string; value?: number[]; path?: string }> };
      }>;
      args: [
        { name: "task_id"; type: "string" },
        { name: "checkpoint_index"; type: "u8" },
      ];
    },
    {
      name: "complete_and_release";
      discriminator: number[];
      accounts: Array<{
        name: string;
        writable?: boolean;
        signer?: boolean;
        pda?: { seeds: Array<{ kind: string; value?: number[]; path?: string }> };
        address?: string;
      }>;
      args: [
        { name: "task_id"; type: "string" },
        { name: "verification_hash"; type: { array: ["u8", 32] } },
      ];
    },
    {
      name: "cancel_and_refund";
      discriminator: number[];
      accounts: Array<{
        name: string;
        writable?: boolean;
        signer?: boolean;
        pda?: { seeds: Array<{ kind: string; value?: number[]; path?: string }> };
        address?: string;
      }>;
      args: [{ name: "task_id"; type: "string" }];
    },
  ];
  accounts: Array<{
    name: string;
    discriminator: number[];
  }>;
  errors: Array<{
    code: number;
    name: string;
    msg: string;
  }>;
  types: Array<{
    name: string;
    type: {
      kind: "struct";
      fields: Array<{
        name: string;
        type: string | { array: [string, number] };
      }>;
    };
  }>;
};

/** Decoded on-chain Config account */
export interface ConfigAccount {
  authority: string; // base58 pubkey
  feeBps: number;
  taskCount: bigint;
  bump: number;
}

/** Decoded on-chain TaskEscrow account */
export interface TaskEscrowAccount {
  taskId: string;
  agent: string; // base58 pubkey
  human: string; // base58 pubkey (default = unclaimed)
  escrowLamports: bigint;
  status: number; // 0=Open, 1=Claimed, 2=Completed, 3=Cancelled
  checkpointCount: number;
  checkpointsVerified: number;
  verifiedBitmap: number;
  verificationHash: Uint8Array; // 32 bytes
  createdAt: bigint;
  completedAt: bigint;
  bump: number;
}

export const ESCROW_STATUS = {
  OPEN: 0,
  CLAIMED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
} as const;
