use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

// This will be replaced with the actual deployed program ID.
// For devnet testing, generate with: `solana-keygen grind --starts-with VH:1`
declare_id!("VHescrow11111111111111111111111111111111111");

#[program]
pub mod verify_human {
    use super::*;

    /// Initialize the program config with an authority.
    /// Called once after deployment.
    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16) -> Result<()> {
        instructions::initialize::handler(ctx, fee_bps)
    }

    /// Agent creates a task and deposits SOL into an escrow PDA.
    pub fn create_task(
        ctx: Context<CreateTask>,
        task_id: String,
        checkpoint_count: u8,
        escrow_lamports: u64,
    ) -> Result<()> {
        instructions::create_task::handler(ctx, task_id, checkpoint_count, escrow_lamports)
    }

    /// Human claims an open task.
    pub fn claim_task(ctx: Context<ClaimTask>, task_id: String) -> Result<()> {
        instructions::claim_task::handler(ctx, task_id)
    }

    /// Authority verifies a checkpoint (called by the backend after Trio VLM confirms).
    pub fn verify_checkpoint(
        ctx: Context<VerifyCheckpoint>,
        task_id: String,
        checkpoint_index: u8,
    ) -> Result<()> {
        instructions::verify_checkpoint::handler(ctx, task_id, checkpoint_index)
    }

    /// Authority completes the task and releases escrow SOL to the human.
    pub fn complete_and_release(
        ctx: Context<CompleteAndRelease>,
        task_id: String,
        verification_hash: [u8; 32],
    ) -> Result<()> {
        instructions::complete_and_release::handler(ctx, task_id, verification_hash)
    }

    /// Cancel a task and refund escrow SOL to the agent.
    /// Can be called by the authority or the agent.
    pub fn cancel_and_refund(ctx: Context<CancelAndRefund>, task_id: String) -> Result<()> {
        instructions::cancel_and_refund::handler(ctx, task_id)
    }
}
