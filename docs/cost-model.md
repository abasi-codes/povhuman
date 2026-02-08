# Cost Model

All VLM costs are billed directly by Google via your Gemini API key (BYOK model). Trio itself appears to be free or near-free.

## Per-Session VLM Costs (Gemini Flash)

| Scenario | VLM Calls/Hour | Cost/Hour | Cost/Day (8hr) |
|----------|---------------|-----------|----------------|
| 30s interval, prefilter ON (70% skip) | ~36 actual calls | ~$0.0007 | ~$0.006 |
| 15s interval, prefilter ON | ~72 actual calls | ~$0.0014 | ~$0.011 |
| 15s interval, prefilter OFF | ~240 calls | ~$0.0048 | ~$0.038 |

**Cost per VLM call:** ~$0.00002 (Gemini Flash)

**Key levers:**
- `enable_prefilter: true` (default) reduces VLM calls by 70-90%
- Higher `interval_seconds` reduces calls linearly
- `frames` input mode is cheapest; `hybrid` is most expensive but most accurate

## Infrastructure Costs

| Component | Cost | Notes |
|-----------|------|-------|
| Webhook receiver (serverless) | ~$5-20/mo | AWS Lambda / Cloudflare Worker |
| Privacy redaction GPU | ~$360/mo | NVIDIA T4, handles 18-40 streams |
| Database (events, sessions) | ~$10-50/mo | Postgres on managed service |
| YouTube Data API v3 | Free | 10,000 units/day quota is plenty |

## YouTube API Quota Budget

| Operation | Cost (units) | Daily Budget (of 10,000) |
|-----------|-------------|--------------------------|
| `videos.list` (up to 50 IDs) | 1 | Use this for status checks |
| `search.list` | 100 | NEVER use for status checks |
| oEmbed | 0 (free) | Basic validation only |

**Budget math:** 50 streams polled every 2 min = 720 units/day. Well within limit.

## Cost Optimization Tips

1. Start with `interval_seconds: 30` and `enable_prefilter: true`
2. Only reduce interval for time-sensitive conditions (driving, person detection)
3. Use `frames` mode instead of `hybrid` if motion detection isn't needed
4. Combine multiple conditions into a single job (our condition combiner does this automatically)
5. Monitor costs via Trio's `/metrics` Prometheus endpoint
