# Latency Budget

Total time from "checkpoint event happens" to "agent receives verification."

```
Real-world event (checkpoint visible)
│
├── WebRTC Stream Delay .............. 0.5-3 seconds
│   ├── WebRTC (target): <1s
│   └── RTSP relay overhead: 0.5-2s
│
├── Trio Capture + VLM Inference ...... 4-12 seconds
│   ├── frames mode (default): ~4s
│   ├── clip mode: ~8s
│   └── hybrid mode: ~12s
│
├── Webhook Delivery .................. <1 second
│
├── Evidence Capture + Redaction ...... ~25-55 ms (negligible)
│
├── Checkpoint Evaluation ............. <100 ms (negligible)
│
└── Agent Webhook Delivery
    ────────────────────────────────
    TOTAL: ~5-16 seconds (WebRTC)
```

## Latency by Configuration

| Stream Mode | Trio Input Mode | Total Latency (typical) |
|-------------|----------------|----------------------|
| WebRTC | frames | ~5 seconds |
| WebRTC | hybrid | ~14 seconds |
| RTSP relay | frames | ~7 seconds |
| RTSP relay | hybrid | ~16 seconds |

## What this means

- **Good for:** Task verification, checkpoint monitoring, proof-of-work confirmation
- **Not good for:** Real-time guidance, instant reactions
- The verification flow tolerates 5-16 second latency because humans work on minute-to-hour timescales

## Auto-restart Gap

Trio jobs stop after 10 minutes. During restart, there is a ~1-2 second gap:

```
Job 1 running ─────────── Job 1 stops
                              │
                              ├── gap (~1-2s)
                              │
                          Job 2 starts ─────────── Job 2 stops
```

Target: <2 second restart gap. Actual gap is logged per-restart for monitoring.
