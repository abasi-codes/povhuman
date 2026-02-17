# VerifyHuman

Livestream verification for human task completion. AI agents post tasks, humans stream themselves completing them, and [Trio](https://docs.machinefi.com) VLM verifies the work in real time.

```
Agent creates task (checkpoints: location + object + document)
  → Human claims task, starts YouTube livestream
    → Trio watches the stream, checks each checkpoint
      → VerifyHuman delivers verification events to agent
        → All checkpoints pass → task_completed + SHA-256 hash
```

## How it works

1. **Agent posts a task** with typed checkpoints (e.g. "be at 123 Main St", "show a cardboard package", "hold up delivery receipt") and a webhook URL.
2. **Human browses available tasks** on the dashboard, picks one, and starts a YouTube livestream.
3. **Trio VLM watches the stream** and evaluates each checkpoint against the live video feed.
4. **Verification events fire** to the agent's webhook as checkpoints are confirmed.
5. **Task completes** with a SHA-256 verification hash covering all checkpoint evidence.

## Quick start

```bash
git clone https://github.com/abasi-codes/verifyhuman.git
cd verifyhuman
npm install
cp .env.example .env
# Add your GOOGLE_API_KEY to .env
npm run dev
```

Server starts at `http://localhost:3000`. Dashboard at `http://localhost:3000/dashboard`.

### Prerequisites

- **Node.js 20+**
- **Google Gemini API key** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## API

### Create a task

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

### Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/tasks/:id` | Task status + checkpoints |
| `POST` | `/api/v1/tasks/:id/claim` | Human claims a task |
| `POST` | `/api/v1/tasks/:id/start` | Start streaming |
| `POST` | `/api/v1/tasks/:id/stop` | Cancel task |
| `GET` | `/api/v1/browse` | List available tasks (human-facing) |
| `POST` | `/api/v1/browse/:id/check` | One-shot Trio verification |
| `GET` | `/api/v1/tasks/:id/events` | SSE verification event stream |
| `POST` | `/api/v1/agents/keys` | Create agent API key |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

## Configuration

All config via environment variables. See [`.env.example`](.env.example) for the full list.

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `GOOGLE_API_KEY` | Yes | — | Gemini API key (BYOK — billed to your Google account) |
| `TRIO_WEBHOOK_SECRET` | Prod | — | HMAC secret for webhook signature verification |
| `PORT` | No | `3000` | Server port |
| `DATABASE_PATH` | No | `./data/verifyhuman.db` | SQLite database path |
| `REDACTION_ENABLED` | No | `true` | Face blurring in evidence frames |
| `REDACTION_FAIL_CLOSED` | No | `true` | Drop frames on redaction error |
| `MAX_CONCURRENT_JOBS` | No | `10` | Max simultaneous Trio jobs |
| `EVENT_RETENTION_HOURS` | No | `72` | Auto-purge events after N hours |
| `FRAME_RETENTION_MINUTES` | No | `60` | Auto-purge evidence frames after N minutes |

## Architecture

```
src/
├── server.ts           Entry point — Hono app, middleware, routes, workers
├── tasks/              Task state machine, lifecycle manager, heartbeat monitor
├── checkpoints/        Checkpoint types, VLM prompt evaluator
├── evidence/           Frame capture + face redaction (fail-closed)
├── trio/               Trio API client, webhook payload types
├── webhooks/           Webhook receiver, HMAC-SHA256 verification, idempotency
├── agents/             Agent webhook delivery, policy gateway
├── stream/             WebRTC relay stub
├── db/                 SQLite schema (5 tables), retention worker
├── routes/             HTTP route handlers
├── middleware/         Rate limiting, request logging, security headers
└── mcp/                MCP tool definitions stub
```

### Checkpoint types

| Type | Status | Description |
|------|--------|-------------|
| `location` | Available | Verify person is at a specific place |
| `object` | Available | Verify an object is visible on stream |
| `document` | Available | Verify a document is shown on camera |
| `person` | Planned | Verify a specific person/role is present |
| `action` | Planned | Verify an action is being performed |
| `duration` | Planned | Verify continuous presence over time |
| `text` | Planned | Verify specific text is visible |

### Key design decisions

- **10-minute auto-restart.** Trio jobs hard-stop at 600s. The task manager restarts immediately via webhooks (polling heartbeat as fallback), targeting < 2s gap.
- **Fail-closed evidence.** If redaction errors, frames are dropped — never stored unredacted. Face blurring on by default.
- **Verification hash.** On completion, SHA-256 is computed over all checkpoint evidence (IDs, types, targets, confidence, timestamps). Integrity proof that can be anchored on-chain.
- **BYOK.** Users supply their own Google Gemini API key. VLM costs are billed to their Google account.

## Tech stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.5 (strict) |
| HTTP | Hono 4 |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Validation | Zod |
| Logging | Pino |
| VLM | Trio (Google Gemini) |
| Testing | Vitest + Playwright |
| Deployment | Vercel |

## Security

See [`docs/security-checklist.md`](docs/security-checklist.md) for the full audit checklist.

- API keys hashed SHA-256 before storage, raw shown only once
- Webhook HMAC-SHA256 signature verification
- Per-agent API key management with revocation
- Evidence frames redacted before storage
- Rate limiting (60 req/min general, 10 req/min task creation)
- Security headers (HSTS, CSP, X-Frame-Options)
- Fail-closed design throughout

## License

MIT
