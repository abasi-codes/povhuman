---
name: world-through-my-eyes
version: 0.1.0
description: >
  Live first-person perception for OpenClaw agents via YouTube Live + Trio.
  Paste a YouTube Live URL and let your agent see what you see.
author: openclaw-contrib
tags:
  - perception
  - vision
  - youtube-live
  - trio
  - monitoring
requires:
  - env:GOOGLE_API_KEY
  - env:TRIO_WEBHOOK_SECRET
permissions:
  - network:outbound
  - hooks:wake
  - hooks:agent
session:
  dmScope: per-channel-peer
confirmation_required:
  - start_monitoring
  - stop_monitoring
  - change_conditions
  - bind_agent
  - revoke_agent
---

# World Through My Eyes

Let your OpenClaw agent perceive your live, first-person world.

## What it does

1. You paste a YouTube Live stream URL
2. You choose what your agent should pay attention to (presets or custom conditions)
3. Your agent receives real-time perception events: triggers, explanations, and optional frame snapshots

## Prerequisites

- A YouTube Live stream (from your phone, webcam, GoPro, or any source)
- A Google Gemini API key (get one at https://aistudio.google.com/apikey)
- The `GOOGLE_API_KEY` environment variable set

## Quick Start

```
clawhub install world-through-my-eyes
```

Then in your agent session:

> "Start watching my stream at https://youtube.com/watch?v=..."

## How it works

- Uses Trio (MachineFi) for live stream monitoring
- Conditions are checked every 15-30 seconds
- Events arrive 10-75 seconds after they happen (YouTube stream delay + VLM inference)
- Jobs auto-restart every 10 minutes (transparent, <2 second gap)
- Face blurring is on by default for privacy compliance

## Important: Latency expectations

This is NOT real-time in the sub-second sense. Total latency budget:

| Hop | Delay |
|-----|-------|
| YouTube stream delay | 2-60 seconds |
| Trio capture + VLM inference | 4-12 seconds |
| Webhook delivery | <1 second |
| Agent processing | <1 second |
| **Total** | **10-75 seconds** |

Good for: monitoring, alerts, periodic awareness.
Not good for: real-time conversation, instant reactions.

## Cost

VLM costs are billed directly by Google via your Gemini API key.
Typical: ~$0.01-0.05/day for continuous monitoring.

## Security

- Your Gemini API key is NEVER stored in config files (env vars only)
- Agents never see raw stream URLs
- Per-session isolation prevents cross-user context leakage
- Starting/stopping monitoring requires explicit confirmation
