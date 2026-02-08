# Security Checklist

## API Key Management (BYOK)

- [ ] `GOOGLE_API_KEY` stored ONLY in environment variables or a secrets manager
- [ ] Key is NEVER written to config files, logs, or source code
- [ ] Key is NEVER exposed to OpenClaw agents or stored in OpenClaw config
- [ ] Key rotation procedure documented and tested
- [ ] Users informed that VLM costs are billed to their Google account

## Webhook Security

- [ ] `TRIO_WEBHOOK_SECRET` configured for HMAC-SHA256 verification
- [ ] `X-Trio-Signature` header verified on every incoming webhook
- [ ] Webhook endpoint responds within 5 seconds (process async)
- [ ] Idempotency tracking prevents duplicate event processing
- [ ] Fallback polling via `GET /jobs/{job_id}` as backup

## OpenClaw Agent Isolation

- [ ] `session.dmScope: "per-channel-peer"` set for per-session isolation
- [ ] Agents NEVER receive raw YouTube stream URLs
- [ ] Policy gateway enforces permission scopes (events, frames, digests)
- [ ] Starting/stopping monitoring requires explicit user confirmation
- [ ] Agent bindings can be instantly revoked

## Privacy & Redaction

- [ ] Face blurring enabled by default (`REDACTION_ENABLED=true`)
- [ ] Fail-closed mode active (`REDACTION_FAIL_CLOSED=true`)
- [ ] Private location detection drops frames from bathrooms/bedrooms
- [ ] Frames retained for max 15 minutes (configurable)
- [ ] "No storage" mode available for privacy-sensitive users

## Legal Compliance

- [ ] BIPA: No facial geometry collected without consent (faces are blurred before VLM)
- [ ] GDPR: Redaction applied before frames sent to Google's Gemini API
- [ ] EU AI Act: No real-time biometric identification in public spaces
- [ ] YouTube ToS: Frame capture delegated to Trio (contractual arm's length)
- [ ] Captured frames never stored longer than the processing window

## Infrastructure

- [ ] HTTPS enforced for all webhook endpoints
- [ ] Rate limiting on API endpoints
- [ ] No sensitive data in application logs
- [ ] Database encrypted at rest
- [ ] Graceful shutdown handles in-flight events
