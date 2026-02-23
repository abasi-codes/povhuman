use anchor_lang::prelude::*;
use crate::state::TaskEscrow;
use crate::error::VHError;

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct ClaimTask<'info> {
    #[account(
        mut,
        seeds = [b"escrow", task_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, TaskEscrow>,

    pub human: Signer<'info>,
}

pub fn handler(ctx: Context<ClaimTask>, _task_id: String) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    require!(escrow.status == TaskEscrow::STATUS_OPEN, VHError::InvalidTaskStatus);
    require!(escrow.human == Pubkey::default(), VHError::AlreadyClaimed);

    escrow.human = ctx.accounts.human.key();
    escrow.status = TaskEscrow::STATUS_CLAIMED;

    msg!(
        "Task claimed: {} | human: {}",
        escrow.task_id,
        escrow.human,
    );
    Ok(())
}
