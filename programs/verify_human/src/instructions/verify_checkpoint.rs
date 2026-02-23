use anchor_lang::prelude::*;
use crate::state::{Config, TaskEscrow};
use crate::error::VHError;

#[derive(Accounts)]
#[instruction(task_id: String, checkpoint_index: u8)]
pub struct VerifyCheckpoint<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"escrow", task_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, TaskEscrow>,

    /// The program authority (backend server) that verifies checkpoints.
    #[account(
        constraint = authority.key() == config.authority @ VHError::UnauthorizedAuthority,
    )]
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<VerifyCheckpoint>,
    _task_id: String,
    checkpoint_index: u8,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    require!(
        escrow.status == TaskEscrow::STATUS_CLAIMED,
        VHError::InvalidTaskStatus,
    );
    require!(
        (checkpoint_index as u8) < escrow.checkpoint_count,
        VHError::CheckpointOutOfBounds,
    );

    let bit = 1u16 << checkpoint_index;
    require!(escrow.verified_bitmap & bit == 0, VHError::CheckpointAlreadyVerified);

    escrow.verified_bitmap |= bit;
    escrow.checkpoints_verified = escrow
        .checkpoints_verified
        .checked_add(1)
        .ok_or(VHError::Overflow)?;

    msg!(
        "Checkpoint verified: task={} index={} ({}/{})",
        escrow.task_id,
        checkpoint_index,
        escrow.checkpoints_verified,
        escrow.checkpoint_count,
    );
    Ok(())
}
