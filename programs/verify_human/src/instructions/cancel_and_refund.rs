use anchor_lang::prelude::*;
use crate::state::{Config, TaskEscrow};
use crate::error::VHError;

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct CancelAndRefund<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"escrow", task_id.as_bytes()],
        bump = escrow.bump,
        close = agent,
    )]
    pub escrow: Account<'info, TaskEscrow>,

    /// Agent who deposited — receives the refund.
    /// CHECK: Validated against escrow.agent.
    #[account(
        mut,
        constraint = agent.key() == escrow.agent @ VHError::UnauthorizedAgent,
    )]
    pub agent: AccountInfo<'info>,

    /// Authority or the agent can cancel.
    #[account(
        constraint = (
            signer.key() == config.authority ||
            signer.key() == escrow.agent
        ) @ VHError::UnauthorizedAuthority,
    )]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelAndRefund>, _task_id: String) -> Result<()> {
    let escrow = &ctx.accounts.escrow;

    // Can only cancel if Open or Claimed (not Completed)
    require!(
        escrow.status == TaskEscrow::STATUS_OPEN || escrow.status == TaskEscrow::STATUS_CLAIMED,
        VHError::InvalidTaskStatus,
    );

    msg!(
        "Task cancelled and escrow refunded: {} | {} lamports -> {}",
        escrow.task_id,
        escrow.escrow_lamports,
        ctx.accounts.agent.key(),
    );

    // The `close = agent` attribute handles transferring remaining lamports
    // (rent + escrow) back to the agent and zeroing the account.
    Ok(())
}
