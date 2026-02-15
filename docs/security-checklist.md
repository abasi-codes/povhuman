# Security Checklist

## API Key Management (BYOK)

- [ ] `GOOGLE_API_KEY` stored ONLY in environment variables or a secrets manager
- [ ] Key is NEVER written to config files, logs, or source code
- [ ] Key is NEVER exposed to agents or included in webhook payloads
- [ ] Key rotation procedure documented and tested
- [ ] Agents informed that VLM costs are billed to their Google account

## Agent API Keys

- [ ] Agent keys hashed (SHA-256) before storage — raw key shown only once
- [ ] Key revocation available via `DELETE /api/v1/agents/keys/:keyId`
- [ ] Keys prefixed with `vh_` for identification
- [ ] Revoked keys immediately rejected on subsequent requests

## Webhook Security

- [ ] `TRIO_WEBHOOK_SECRET` configured for HMAC-SHA256 verification
- [ ] `X-Trio-Signature` header verified on every incoming webhook
- [ ] Webhook endpoint responds within 5 seconds (process async)
- [ ] Idempotency tracking prevents duplicate event processing
- [ ] Fallback polling via heartbeat monitor as backup

## Evidence & Privacy

- [ ] Face blurring enabled by default (`REDACTION_ENABLED=true`)
- [ ] Fail-closed mode active (`REDACTION_FAIL_CLOSED=true`)
- [ ] Evidence frames cleared after 60 minutes (retention worker)
- [ ] Agents never receive raw stream URLs
- [ ] Verification hash (SHA-256) generated from checkpoint evidence on completion

## Agent Isolation

- [ ] Agents receive only structured verification events, not raw frames
- [ ] Policy gateway strips stream URLs and sensitive metadata
- [ ] Creating/cancelling tasks requires explicit authorization
- [ ] Each agent uses its own API key for authentication

## Infrastructure

- [ ] HTTPS enforced for all webhook endpoints
- [ ] Rate limiting: 60 req/min general, 10 req/min for task creation
- [ ] No sensitive data in application logs (pino redaction configured)
- [ ] Graceful shutdown handles in-flight events
- [ ] Security headers: HSTS, X-Frame-Options, CSP, Permissions-Policy
