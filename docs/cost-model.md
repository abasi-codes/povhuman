# Cost Model

All VLM costs are billed directly by Google via the agent's Gemini API key (BYOK model). Trio itself is free.

## Per-Verification VLM Costs (Gemini Flash)

| Scenario | VLM Calls/Hour | Cost/Hour | Cost/30min Task |
|----------|---------------|-----------|-----------------|
| 15s interval, prefilter ON (70% skip) | ~72 actual calls | ~$0.0014 | ~$0.001 |
| 15s interval, prefilter OFF | ~240 calls | ~$0.0048 | ~$0.002 |
| 30s interval, prefilter ON | ~36 actual calls | ~$0.0007 | ~$0.0004 |

**Cost per VLM call:** ~$0.00002 (Gemini Flash)

## Per-Task Cost Estimates

| Task Duration | Checkpoints | Estimated VLM Cost |
|---------------|-------------|-------------------|
| 15 minutes | 2 | ~$0.005 |
| 30 minutes | 3 | ~$0.01 |
| 1 hour | 5 | ~$0.02 |
| 2 hours | 5 | ~$0.04 |

## Infrastructure Costs

| Component | Cost | Notes |
|-----------|------|-------|
| ProofStream server | ~$20-50/mo | Node.js on VPS or serverless |
| WebRTC relay (Janus) | ~$50-200/mo | Scales with concurrent streams |
| Evidence redaction | ~$360/mo | GPU for face blur (shared) |
| Database | ~$10-30/mo | SQLite or managed Postgres |

## Cost Optimization

1. Use `enable_prefilter: true` (default) — reduces VLM calls by 70-90%
2. Use `frames` mode (default) — cheapest, sufficient for checkpoint verification
3. Multiple checkpoints combined into single Trio prompt (automatic)
4. Tasks auto-expire after `max_duration_seconds` to prevent runaway costs
