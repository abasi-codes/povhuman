import { randomBytes, timingSafeEqual } from "node:crypto";

interface PendingChallenge {
  nonce: string;
  task_id: string;
  expires_at: number;
}

const challenges = new Map<string, PendingChallenge>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup expired challenges every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challenges) {
    if (challenge.expires_at < now) {
      challenges.delete(id);
    }
  }
}, 60_000).unref();

/**
 * Create a new attestation challenge with a random nonce.
 */
export function createChallenge(taskId: string): {
  challenge_id: string;
  nonce: string;
  expires_at: string;
} {
  const challengeId = randomBytes(16).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;

  challenges.set(challengeId, {
    nonce,
    task_id: taskId,
    expires_at: expiresAt,
  });

  return {
    challenge_id: challengeId,
    nonce,
    expires_at: new Date(expiresAt).toISOString(),
  };
}

/**
 * Verify and consume a challenge (single-use).
 * Returns true if valid, false if expired/invalid/already used.
 */
export function verifyChallenge(challengeId: string): boolean {
  const challenge = challenges.get(challengeId);
  if (!challenge) return false;
  if (challenge.expires_at < Date.now()) {
    challenges.delete(challengeId);
    return false;
  }

  // Single-use: delete after verification
  challenges.delete(challengeId);
  return true;
}
