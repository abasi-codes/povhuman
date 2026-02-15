# AGENTS.md — ProofStream

## Confirmation Rules

The following actions MUST require explicit user confirmation before execution:

1. **create_task** — Creating a verification task (starts monitoring, incurs VLM costs)
2. **cancel_task** — Cancelling a running task (stops all Trio jobs)
3. **start_streaming** — Starting livestream monitoring (begins Trio inference)
4. **revoke_key** — Revoking an agent's API key

## Security Rules

- NEVER store API keys (GOOGLE_API_KEY) in config files, source code, or logs
- NEVER expose raw stream URLs to agents — use the policy gateway
- NEVER store unredacted evidence frames when redaction is enabled — fail closed
- Webhook signature verification is mandatory in production
- Agent API keys are hashed (SHA-256) before storage — raw key shown only once at creation

## Architecture Notes

- Trio jobs auto-stop after 10 minutes — the task manager auto-restarts them
- The webhook receiver must respond within 5 seconds — process events asynchronously
- Multiple checkpoints are combined into a single Trio prompt to conserve the 10-job limit
- VLM costs are billed to the agent's Google account via their Gemini API key (BYOK model)
- Verification hashes are SHA-256 digests of checkpoint evidence, computed locally
