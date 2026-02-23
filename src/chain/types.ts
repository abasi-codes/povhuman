export interface ChainReceipt {
  signature: string;
  slot: number;
  program_id: string;
  explorer_url: string;
}

export interface TaskEscrowAccount {
  task_id: string;
  agent_wallet: string;
  human_wallet: string | null;
  escrow_lamports: number;
  status: "deposited" | "released" | "refunded";
  deposit_signature: string;
  release_signature: string | null;
  pda: string;
}
