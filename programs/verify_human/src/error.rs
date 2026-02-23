use anchor_lang::prelude::*;

#[error_code]
pub enum VHError {
    #[msg("Task is not in the expected status for this operation")]
    InvalidTaskStatus,

    #[msg("Escrow amount must be greater than zero")]
    ZeroEscrow,

    #[msg("Task has already been claimed")]
    AlreadyClaimed,

    #[msg("Task has not been claimed yet")]
    NotClaimed,

    #[msg("Checkpoint index out of bounds")]
    CheckpointOutOfBounds,

    #[msg("Checkpoint already verified")]
    CheckpointAlreadyVerified,

    #[msg("Not all required checkpoints have been verified")]
    IncompleteCheckpoints,

    #[msg("Only the authority can perform this action")]
    UnauthorizedAuthority,

    #[msg("Only the agent can cancel this task")]
    UnauthorizedAgent,

    #[msg("Task ID exceeds maximum length")]
    TaskIdTooLong,

    #[msg("Arithmetic overflow")]
    Overflow,
}
