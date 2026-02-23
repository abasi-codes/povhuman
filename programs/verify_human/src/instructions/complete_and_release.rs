use anchor_lang::prelude::*;
use crate::state::{Config, TaskEscrow};
use crate::error::VHError;

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct CompleteAndRelease<'info> {
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

    /// Human who completed the task — receives the escrowed SOL.
    /// CHECK: Validated against escrow.human.
    #[account(
        mut,
        constraint = human.key() == escrow.human @ VHError::NotClaimed,
    )]
    pub human: AccountInfo<'info>,

    /// The program authority.
    #[account(
        constraint = authority.key() == config.authority @ VHError::UnauthorizedAuthority,
    )]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CompleteAndRelease>,
    _task_id: String,
    verification_hash: [u8; 32],
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    require!(
        escrow.status == TaskEscrow::STATUS_CLAIMED,
        VHError::InvalidTaskStatus,
    );
    require!(
        escrow.checkpoints_verified >= escrow.checkpoint_count,
        VHError::IncompleteCheckpoints,
    );

    // Transfer escrowed SOL from PDA to human
    let escrow_lamports = escrow.escrow_lamports;

    // Use the escrow account's lamports directly (PDA-owned SOL)
    let escrow_info = escrow.to_account_info();
    let human_info = ctx.accounts.human.to_account_info();

    **escrow_info.try_borrow_mut_lamports()? -= escrow_lamports;
    **human_info.try_borrow_mut_lamports()? += escrow_lamports;

    escrow.status = TaskEscrow::STATUS_COMPLETED;
    escrow.verification_hash = verification_hash;
    escrow.completed_at = Clock::get()?.unix_timestamp;
    escrow.escrow_lamports = 0;

    msg!(
        "Task completed and escrow released: {} | {} lamports -> {}",
        escrow.task_id,
        escrow_lamports,
        ctx.accounts.human.key(),
    );
    Ok(())
}
