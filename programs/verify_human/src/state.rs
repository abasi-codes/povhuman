use anchor_lang::prelude::*;

/// Maximum length of a task_id string (bytes).
pub const MAX_TASK_ID_LEN: usize = 64;

/// Maximum number of checkpoints per task.
pub const MAX_CHECKPOINTS: usize = 10;

/// Global program configuration. One per program deployment.
/// PDA seeds: ["config"]
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Program authority — can verify checkpoints and release escrow.
    pub authority: Pubkey,

    /// Fee basis points taken on release (0 = no fee). Reserved for future use.
    pub fee_bps: u16,

    /// Total tasks created (monotonic counter).
    pub task_count: u64,

    /// Bump seed for this PDA.
    pub bump: u8,
}

/// Per-task escrow account holding SOL.
/// PDA seeds: ["escrow", task_id]
#[account]
#[derive(InitSpace)]
pub struct TaskEscrow {
    /// The task identifier (e.g. "task-wash-dishes").
    #[max_len(64)]
    pub task_id: String,

    /// Agent wallet that deposited the escrow.
    pub agent: Pubkey,

    /// Human wallet that claimed the task (Pubkey::default() if unclaimed).
    pub human: Pubkey,

    /// Lamports held in escrow.
    pub escrow_lamports: u64,

    /// Task status: 0=Open, 1=Claimed, 2=Completed, 3=Cancelled
    pub status: u8,

    /// Number of checkpoints for this task.
    pub checkpoint_count: u8,

    /// Number of checkpoints verified so far.
    pub checkpoints_verified: u8,

    /// Bitmap of verified checkpoints (up to MAX_CHECKPOINTS).
    /// Bit i is set when checkpoint i is verified.
    pub verified_bitmap: u16,

    /// SHA-256 verification hash (set on completion). 32 bytes.
    pub verification_hash: [u8; 32],

    /// Unix timestamp when escrow was created.
    pub created_at: i64,

    /// Unix timestamp when task was completed (0 if not yet).
    pub completed_at: i64,

    /// Bump seed for this PDA.
    pub bump: u8,
}

impl TaskEscrow {
    pub const STATUS_OPEN: u8 = 0;
    pub const STATUS_CLAIMED: u8 = 1;
    pub const STATUS_COMPLETED: u8 = 2;
    pub const STATUS_CANCELLED: u8 = 3;
}
