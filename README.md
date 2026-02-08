# World Through My Eyes

OpenClaw connector that lets agents perceive a user's live, first-person world via YouTube Live + [Trio](https://docs.machinefi.com) (MachineFi).

Paste a YouTube Live URL. Pick what your agent should notice. Get structured perception events delivered to your OpenClaw agents in seconds.

## How it works

```
YouTube Live stream
  -> Trio (captures frames, runs VLM condition checks)
    -> Webhook to this backend
      -> Privacy redaction (face blur, screen blur, location filtering)
        -> OpenClaw agent (via /hooks/wake or /hooks/agent)
```

The agent receives a `PerceptionEvent` with an explanation, optional frame snapshot, and metadata every time a condition triggers.

## Prerequisites

1. **A YouTube Live stream** from any device (phone, webcam, GoPro, etc.)
2. **A Google Gemini API key** — get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
3. **Node.js 20+**

## Quick start

```bash
git clone https://github.com/abasi-codes/povhuman.git
cd povhuman
npm install
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY
npm run dev
```

The server starts at `http://localhost:3000`.

## API

### Validate a stream

```bash
curl -X POST http://localhost:3000/sessions/validate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}'
```

### Test a condition (one-shot)

```bash
curl -X POST http://localhost:3000/sessions/test-condition \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtube.com/watch?v=VIDEO_ID",
    "preset_id": "person_talking"
  }'
```

### Start a monitoring session

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "stream_url": "https://youtube.com/watch?v=VIDEO_ID",
    "preset_ids": ["person_talking", "laptop_screen"],
    "interval_seconds": 30,
    "agent_ids": ["my-agent"]
  }'
```

### Pause / Stop

```bash
curl -X POST http://localhost:3000/sessions/SESSION_ID/pause
curl -X POST http://localhost:3000/sessions/SESSION_ID/stop
```

### List condition presets

```bash
curl http://localhost:3000/sessions/presets
```

Available presets: `person_talking`, `indoors`, `laptop_screen`, `driving`, `crowd`, `qr_code`.

## Configuration

All config is via environment variables. See [`.env.example`](.env.example) for the full list.

| Variable | Required | Description |
|----------|:---:|-------------|
| `GOOGLE_API_KEY` | Yes | Your Gemini API key (BYOK — costs billed to your Google account) |
| `TRIO_WEBHOOK_SECRET` | Prod | HMAC secret for webhook signature verification |
| `OPENCLAW_BASE_URL` | If using OpenClaw | Base URL for OpenClaw webhook delivery |
| `OPENCLAW_BEARER_TOKEN` | If using OpenClaw | Auth token for OpenClaw hooks |
| `YOUTUBE_API_KEY` | No | Enables live status checks (oEmbed used as free fallback) |
| `REDACTION_ENABLED` | No | `true` (default) to enable face blurring |

## Architecture

```
src/
├── trio/           Trio API client and types
├── webhooks/       Webhook receiver, HMAC verification, idempotency
├── sessions/       Session manager, auto-restart loop, heartbeat monitor
├── openclaw/       Event delivery, MCP config, policy gateway
├── privacy/        Redaction middleware (fail-closed)
├── youtube/        URL validation, quota tracking
├── conditions/     Preset conditions, condition combiner
├── db/             SQLite schema, retention worker
├── routes/         HTTP routes
└── server.ts       Main entrypoint
```

### Key design decisions

**10-minute auto-restart.** Trio jobs hard-stop after 600 seconds. The session manager detects this via webhooks (and a polling heartbeat fallback) and restarts immediately, targeting <2 second gap.

**Condition combining.** Trio limits 10 concurrent jobs per account. Multiple conditions are combined into a single prompt so one job can test many conditions at once.

**Fail-closed redaction.** If the privacy redaction service errors, frames are dropped rather than sent unredacted. Face blurring is on by default for BIPA/GDPR compliance.

**Webhook idempotency.** Trio uses at-least-once delivery. The receiver deduplicates events and responds 200 immediately (within Trio's 5-second window) before processing asynchronously.

**Policy gateway.** Agents never receive raw stream URLs. The policy gateway enforces per-agent permission scopes and strips sensitive fields.

## Latency

This is not sub-second real-time. Total end-to-end latency:

| Hop | Delay |
|-----|-------|
| YouTube stream delay | 2-60s |
| Trio capture + Gemini inference | 4-12s |
| Webhook + redaction + delivery | <2s |
| **Total** | **10-75s** |

Set your YouTube stream to **ultra-low latency** mode and use `input_mode: "frames"` for the fastest perception (~10 seconds total).

See [`docs/latency-budget.md`](docs/latency-budget.md) for the full breakdown.

## Cost

VLM costs are billed directly by Google via your Gemini API key. Trio itself is free.

| Scenario | Cost/Day (8 hrs) |
|----------|-----------------|
| 30s interval, prefilter on | ~$0.006 |
| 15s interval, prefilter on | ~$0.011 |
| 15s interval, prefilter off | ~$0.038 |

See [`docs/cost-model.md`](docs/cost-model.md) for details.

## Streaming device guide

Any device that can produce a YouTube Live URL works. See [`docs/streaming-guide.md`](docs/streaming-guide.md) for setup instructions for phones, GoPros, webcams, OBS, and smart glasses.

**Note:** Ray-Ban Meta Gen 2 does not support livestreaming. Gen 1 streams to Facebook/Instagram only (requires a Restream.io relay to reach YouTube).

## OpenClaw Skill

Install as an OpenClaw Skill:

```bash
clawhub install world-through-my-eyes
```

See [`skills/world-through-my-eyes/SKILL.md`](skills/world-through-my-eyes/SKILL.md) for the skill spec.

## Security

See [`docs/security-checklist.md`](docs/security-checklist.md) and [`AGENTS.md`](AGENTS.md).

- API keys are environment-only (never in config files or logs)
- Webhook HMAC-SHA256 signature verification
- Per-session agent isolation
- Starting/stopping monitoring requires explicit user confirmation
- Frames retained max 15 minutes, with a no-storage mode available

## License

MIT
