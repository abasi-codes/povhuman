# AGENTS.md — World Through My Eyes Connector

## Confirmation Rules

The following actions MUST require explicit user confirmation before execution:

1. **start_monitoring** — Starting a new monitoring session (creates Trio jobs, incurs API costs)
2. **stop_monitoring** — Stopping an active session (terminates all jobs, revokes agent bindings)
3. **change_conditions** — Modifying what the agent watches for (restarts jobs with new conditions)
4. **bind_agent** — Granting a new agent access to perception events
5. **revoke_agent** — Revoking an agent's access to a session

## Security Rules

- NEVER store API keys (GOOGLE_API_KEY, OPENCLAW_BEARER_TOKEN) in config files, source code, or logs
- NEVER expose raw YouTube stream URLs to agents — use the policy gateway
- NEVER send unredacted frames when redaction is enabled — fail closed
- All agent bindings use `session.dmScope: "per-channel-peer"` for isolation
- Webhook signature verification is mandatory in production

## Architecture Notes

- Trio jobs auto-stop after 10 minutes — the session manager auto-restarts them
- The webhook receiver must respond within 5 seconds — process events asynchronously
- YouTube API quota is 10,000 units/day — use batched videos.list (1 unit) instead of search.list (100 units)
- VLM costs are billed to the user's Google account via their Gemini API key (BYOK model)
