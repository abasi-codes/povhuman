# Latency Budget

Total time from "event happens in the real world" to "agent knows about it."

```
Real-world event
│
├── YouTube Stream Delay .............. 2-60 seconds
│   ├── Ultra-low latency: 2-5s
│   ├── Low latency: 5-15s
│   └── Normal latency: 15-60s
│
├── Trio Capture + VLM Inference ...... 4-12 seconds
│   ├── frames mode: ~4s
│   ├── clip mode: ~8s
│   └── hybrid mode (default): ~12s
│
├── Webhook Delivery .................. <1 second
│
├── Privacy Redaction ................. ~25-55 ms (negligible)
│
├── OpenClaw Event Processing ......... <1 second
│
└── Agent Receives Perception Event
    ────────────────────────────────
    TOTAL: ~10-75 seconds
```

## Latency by Configuration

| YouTube Mode | Trio Input Mode | Total Latency (typical) |
|-------------|----------------|----------------------|
| Ultra-low | frames | ~10 seconds |
| Ultra-low | hybrid | ~18 seconds |
| Low | frames | ~12 seconds |
| Low | hybrid | ~25 seconds |
| Normal | frames | ~25 seconds |
| Normal | hybrid | ~75 seconds |

## What this means

- **Good for:** Monitoring, alerts, periodic awareness, event triggers where seconds don't matter
- **Not good for:** Real-time conversation, instant reactions, time-critical guidance
- The 2-second delivery SLA in the PRD applies only to the webhook-to-agent hop, not end-to-end

## Auto-restart Gap

Trio jobs stop after 10 minutes. During restart, there is a ~1-2 second gap:

```
Job 1 running ─────────── Job 1 stops
                              │
                              ├── gap (~1-2s)
                              │
                          Job 2 starts ─────────── Job 2 stops
                                                       │
                                                       └── ...
```

Target: <2 second restart gap. Actual gap is logged per-restart for monitoring.

## Future: Tier 2 Low-Latency Architecture

WebRTC-based solutions (LiveKit, Stream Vision Agents) + Gemini Live API can achieve <500ms end-to-end latency — a 150x improvement. This requires a dedicated app instead of pasting a YouTube URL. See the v2 roadmap.
