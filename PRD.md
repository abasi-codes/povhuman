# ProofStream — Product Requirements Document

**Version:** 0.2.0 | **Date:** 2026-02-14 | **Status:** POC Scaffold Complete

---

## Problem

RentAHuman.ai has 70K+ humans and 80+ AI agents, but no real-time proof that hired humans actually complete tasks. Agents post tasks, humans claim them, but there's no verifiable evidence of completion — just trust. This blocks payment release and limits the platform's reliability.

## Solution

**ProofStream** is a livestream verification system for human task completion. AI agents post tasks with specific checkpoints (location, object, document). Humans stream from their phone while working. Trio's vision-language model watches the stream in real-time and verifies each checkpoint. When all checkpoints pass, the agent receives a completion webhook with a cryptographic integrity hash.

**Core flow:** Agent creates task with criteria → ProofStream generates stream URL → human streams while working → Trio detects checkpoints → agent receives verification webhook → payment releases.

## How It Works

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│  1. STREAM   │───▶│  2. VERIFY    │───▶│  3. EVIDENCE   │───▶│  4. DELIVER   │
│  Human phone │    │  Trio VLM     │    │  Capture +     │    │  Webhook to   │
│  → WebRTC    │    │  checks each  │    │  redaction     │    │  AI agent     │
│  relay       │    │  checkpoint   │    │  (fail-closed) │    │  + hash       │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
```

## Use Cases

| Domain | Example |
|---|---|
| **Delivery verification** | "Deliver package to 123 Main St" — verify location + package visible |
| **Service completion** | "Clean apartment 4B" — verify location + cleaning supplies visible |
| **Document handling** | "File paperwork at city hall" — verify location + document shown |
| **Inspection** | "Check roof for damage" — verify location + photos of specific areas |
| **Errand running** | "Pick up prescription at Walgreens" — verify store + prescription bag |

## Target Users

- **AI agent developers** building task-completion verification
- **RentAHuman.ai platform** for human-agent task workflows
- **Gig economy platforms** needing proof-of-work verification

## Business Model

**BYOK (Bring Your Own Key)** — agents supply their own Google Gemini API key. VLM inference costs billed directly to their Google account.

| Usage Pattern | VLM Cost/Task (est.) |
|---|---|
| 15s interval, 30-min task | ~$0.02 |
| 15s interval, 1-hr task | ~$0.04 |
| 15s interval, 2-hr task | ~$0.08 |

## Architecture

```
Human Phone ──WebRTC──▶ Relay ──RTSP──▶ Trio (MachineFi) ──webhook──▶ ProofStream ──▶ AI Agent
                                          │                              │
                                          │ VLM: Gemini Flash (BYOK)     ├─ Checkpoint Evaluator
                                          │ 10-min jobs, auto-restart     ├─ Evidence Capture
                                          │ 15s check interval            ├─ SQLite (WAL mode)
                                          │                               └─ Heartbeat monitor
```

## API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/tasks` | Create verification task |
| `GET` | `/api/v1/tasks/:id` | Get task status + checkpoints |
| `POST` | `/api/v1/tasks/:id/claim` | Human claims task |
| `POST` | `/api/v1/tasks/:id/start` | Start streaming |
| `POST` | `/api/v1/tasks/:id/stop` | Cancel task |
| `GET` | `/api/v1/tasks/:id/events` | Verification events |
| `GET` | `/api/v1/tasks/:id/checkpoints` | Checkpoint statuses |
| `POST` | `/api/v1/agents/keys` | Create agent API key |
| `POST` | `/webhooks/trio` | Trio webhook ingestion |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

**Checkpoint types (POC):** `location`, `object`, `document`
**Scaffolded:** `person`, `action`, `duration`, `text`

## Constraints

| Constraint | Value |
|---|---|
| End-to-end latency | 5-30 seconds (WebRTC + VLM + delivery) |
| Trio job max duration | 600 seconds; auto-restart with <2s gap |
| Max concurrent jobs | 10 per account |
| Webhook response time | <5 seconds (async processing) |
| Evidence frame retention | 60 minutes |
| Event retention | 72 hours |
| Max task duration | Configurable, default 1 hour |

## Privacy & Security

- **Fail-closed evidence capture** — if redaction errors, frames are dropped
- **Face blurring on by default** — evidence frames redacted before storage
- **Agent isolation** — agents never receive raw stream URLs
- **API key management** — per-agent keys with revocation
- **Verification hash** — SHA-256 integrity hash of checkpoint evidence

## Verification Model

**Livestream only** — human streams from phone while working, Trio watches in real-time, checkpoints verified live. No photo-upload tier.

## Current Status

POC scaffold complete. Core modules implemented: task manager, checkpoint evaluator, evidence capture, stream relay (stub), agent delivery, MCP tool definitions (stub). React dashboard adapted for task workflows.

## Roadmap

| Milestone | Scope |
|---|---|
| **POC** | 3 checkpoint types, WebRTC relay stub, demo flow |
| **v1.0** | WebRTC relay (Janus/Cloudflare WHIP), RentAHuman integration, payment triggers |
| **v1.5** | All 7 checkpoint types, multi-checkpoint sequencing, confidence calibration |
| **v2.0** | On-chain verification hashes, dispute resolution, human reputation scoring |
