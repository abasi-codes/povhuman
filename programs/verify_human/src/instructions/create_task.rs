use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Config, TaskEscrow, MAX_TASK_ID_LEN, MAX_CHECKPOINTS};
use crate::error::VHError;

#[derive(Accounts)]
#[instruction(task_id: String, checkpoint_count: u8, escrow_lamports: u64)]
pub struct CreateTask<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = agent,
        space = 8 + TaskEscrow::INIT_SPACE,
        seeds = [b"escrow", task_id.as_bytes()],
        bump,
    )]
    pub escrow: Account<'info, TaskEscrow>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateTask>,
    task_id: String,
    checkpoint_count: u8,
    escrow_lamports: u64,
) -> Result<()> {
    require!(task_id.len() <= MAX_TASK_ID_LEN, VHError::TaskIdTooLong);
    require!(escrow_lamports > 0, VHError::ZeroEscrow);
    require!((checkpoint_count as usize) <= MAX_CHECKPOINTS, VHError::CheckpointOutOfBounds);

    // Transfer SOL from agent to escrow PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.agent.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        ),
        escrow_lamports,
    )?;

    let escrow = &mut ctx.accounts.escrow;
    escrow.task_id = task_id.clone();
    escrow.agent = ctx.accounts.agent.key();
    escrow.human = Pubkey::default();
    escrow.escrow_lamports = escrow_lamports;
    escrow.status = TaskEscrow::STATUS_OPEN;
    escrow.checkpoint_count = checkpoint_count;
    escrow.checkpoints_verified = 0;
    escrow.verified_bitmap = 0;
    escrow.verification_hash = [0u8; 32];
    escrow.created_at = Clock::get()?.unix_timestamp;
    escrow.completed_at = 0;
    escrow.bump = ctx.bumps.escrow;

    let config = &mut ctx.accounts.config;
    config.task_count = config.task_count.checked_add(1).ok_or(VHError::Overflow)?;

    msg!(
        "Task created: {} | escrow: {} lamports | checkpoints: {}",
        task_id,
        escrow_lamports,
        checkpoint_count,
    );
    Ok(())
}
