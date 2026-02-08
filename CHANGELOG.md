# Changelog

## [0.1.0] - 2026-02-08

### Added
- **Core Backend** — 17 modules: Trio client, webhook receiver, session manager, heartbeat monitor, OpenClaw delivery, privacy redaction, YouTube validator, quota tracker, SQLite schema, retention worker
- **Frontend Dashboard** — React 18 with 10 components: stream setup, condition builder, session control, stats cards, event feed, snapshot viewer, agent bindings, privacy pipeline, resource gauges
- **Containerization** — Multi-stage Dockerfile, docker-compose.yml, health check
- **CI/CD** — GitHub Actions workflow with lint, test, build (backend + frontend), 80% coverage threshold
- **Security** — Rate limiting (60 req/min API, 10 req/min session creation), CORS policy, security headers (X-Content-Type-Options, X-Frame-Options, HSTS), Zod input validation, API key masking in logs
- **Observability** — Request logging middleware, Prometheus metrics endpoint (/metrics), React error boundary, toast notification system, structured error responses
- **Responsive UI** — 3-column collapses to stacked layout on mobile/tablet, skeleton loaders
- **OpenClaw Skill** — clawhub.json manifest, SKILL.md documentation
- **E2E Tests** — Playwright smoke tests for dashboard load, health check, metrics
- **Documentation** — README, PRD, streaming guide, latency budget, cost model, security checklist

### Architecture
- TypeScript + Hono (HTTP) + better-sqlite3 + pino (logging)
- Trio (MachineFi) for YouTube Live stream monitoring via Google Gemini VLM
- BYOK model: users supply their own Google Gemini API key
- 10-minute job cap with automatic <2s gap restarts
- Privacy-first: face blurring enabled by default, fail-closed design
