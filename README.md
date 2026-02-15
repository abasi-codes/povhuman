# VerifyHuman

Livestream verification for human task completion. AI agents verify real-world work via live video + [Trio](https://docs.machinefi.com) VLM.

Agent creates task with checkpoints → human streams from phone → Trio verifies each checkpoint live → agent gets webhook with verification hash.

## How it works

```
AI Agent creates task (checkpoints: location + object + document)
  -> Human claims task, gets stream URL
    -> Human streams from phone while working
      -> Trio watches stream, checks each checkpoint
        -> VerifyHuman delivers verification events to agent
          -> All checkpoints pass → task_completed + SHA-256 hash
```

## Prerequisites

1. **A Google Gemini API key** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. **Node.js 20+**

## Quick start

```bash
git clone https://github.com/abasi-codes/verifyhuman.git
cd verifyhuman
npm install
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY
npm run dev
```

Server starts at `http://localhost:3000`.

## API

### Create a verification task

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Deliver package to 123 Main St",
    "webhook_url": "https://your-agent.com/webhook",
    "checkpoints": [
      { "type": "location", "target": "123 Main Street" },
      { "type": "object", "target": "cardboard package" },
      { "type": "document", "target": "delivery receipt" }
    ]
  }'
```

### Get task status

```bash
curl http://localhost:3000/api/v1/tasks/TASK_ID
```

### Human claims task

```bash
curl -X POST http://localhost:3000/api/v1/tasks/TASK_ID/claim \
  -H "Content-Type: application/json" \
  -d '{ "human_id": "human-123" }'
```

### Start streaming

```bash
curl -X POST http://localhost:3000/api/v1/tasks/TASK_ID/start
```

### Cancel task

```bash
curl -X POST http://localhost:3000/api/v1/tasks/TASK_ID/stop
```

### Health check

```bash
curl http://localhost:3000/health
# { "status": "ok", "service": "verifyhuman", "version": "0.2.0" }
```

## Configuration

All config via environment variables. See [`.env.example`](.env.example).

| Variable | Required | Description |
|----------|:---:|-------------|
| `GOOGLE_API_KEY` | Yes | Gemini API key (BYOK — costs billed to your Google account) |
| `TRIO_WEBHOOK_SECRET` | Prod | HMAC secret for webhook signature verification |
| `REDACTION_ENABLED` | No | `true` (default) to enable face blurring in evidence |

## Architecture

```
src/
├── tasks/          Task manager, state machine, heartbeat
├── checkpoints/    Checkpoint types, evaluator, prompt templates
├── evidence/       Evidence capture + redaction (fail-closed)
├── stream/         WebRTC relay stub
├── agents/         Agent webhook delivery, policy gateway
├── mcp/            MCP tool definitions stub
├── trio/           Trio API client and types
├── webhooks/       Webhook receiver, HMAC verification, idempotency
├── db/             SQLite schema, retention worker
├── routes/         HTTP routes (tasks, health, events, agents, metrics)
├── middleware/     Rate limiting, logging, security headers
└── server.ts       Main entrypoint
```

### Key design decisions

**Checkpoint-based verification.** Tasks have typed checkpoints (location, object, document). Each is converted to a Trio VLM prompt. Multiple checkpoints are combined into a single Trio job to conserve the 10-job limit.

**10-minute auto-restart.** Trio jobs hard-stop after 600 seconds. The task manager restarts immediately via webhooks (and a polling heartbeat fallback), targeting <2 second gap.

**Fail-closed evidence capture.** If the redaction service errors, evidence frames are dropped rather than stored unredacted. Face blurring is on by default.

**Verification hash.** On task completion, a SHA-256 hash is generated from all checkpoint evidence (IDs, types, targets, confidence, timestamps). This provides an integrity proof that can later be anchored on-chain.

## Checkpoint Types

| Type | Status | Description |
|------|--------|-------------|
| `location` | Available | Verify person is at a specific location |
| `object` | Available | Verify an object is visible |
| `document` | Available | Verify a document is shown |
| `person` | Coming soon | Verify a person/role is present |
| `action` | Coming soon | Verify an action is being performed |
| `duration` | Coming soon | Verify continuous presence |
| `text` | Coming soon | Verify specific text is visible |

## Security

See [`docs/security-checklist.md`](docs/security-checklist.md) and [`AGENTS.md`](AGENTS.md).

- API keys are environment-only (never in config files or logs)
- Webhook HMAC-SHA256 signature verification
- Per-agent API key management with revocation
- Evidence frames redacted before storage
- Fail-closed design throughout

## License

MIT
