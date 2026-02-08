# Security (RN Android)

This document defines required security posture for a React Native Android client and maps it to the current backend implementation.

## 1. Transport Security (HTTPS and Certificates)

## 1.1 Production Requirement

- Use HTTPS for all production traffic.
- Do not ship cleartext HTTP API base URLs in production builds.

Current backend reality:

- Backend can run on HTTP in local/LAN setups.
- Auth cookie `secure` flag is controlled by `SECURE_COOKIES=true`.

Implication:

- In production, deploy behind HTTPS and set `SECURE_COOKIES=true`.

## 1.2 Certificate Strategy (Android)

Recommended:

- Trust system CA store for standard deployments.
- Add certificate pinning only with a rotation plan.

Pinning policy if enabled:

- Pin at least 2 valid keys (current + next).
- Keep an emergency update path for pin rollover.
- Never pin short-lived CDN edge certs without backup strategy.

## 2. Authentication and Session Security

Current auth model:

- Primary: HTTP-only JWT cookie (`mytube_auth_token`, 24h).
- Additional UI cookie: `mytube_role` (non-HTTP-only, role only).
- Compatibility fallback: `Authorization: Bearer <token>` also accepted.

Cookie attributes:

- `httpOnly: true` for auth token
- `sameSite: "lax"`
- `secure`: env-controlled

Client requirement:

- Prefer cookie-based session when possible.
- If bearer mode is used, treat token as secret and store in secure storage only.

## 3. Rate Limiting and Abuse Controls

Server-side controls:

- General limiter: `1000 requests / 15 minutes / IP`
- Auth limiter (stricter): `5 requests / 15 minutes / IP`, `skipSuccessfulRequests=true`
- Additional login cooldown: progressive wait time via login attempt tracking

Important exemptions:

- Some high-frequency routes are excluded from general limiter, including streaming and download-related paths.

Client handling requirements:

- Handle `429` as first-class response.
- Back off and retry with increasing intervals.
- Avoid aggressive background polling when app is not active.

## 4. Input and Routing Security Controls in Backend

Implemented protections include:

- SSRF checks:
  - `validateUrl` blocks private/internal targets
  - `validateUrlWithAllowlist` for allowlisted domains and safe path checks
- Path traversal protections:
  - `resolveSafePath` and directory validators
- Redirect allowlist validation for cloud redirect endpoints
- Hook upload safeguards:
  - allowed hook names only
  - risky command pattern scan on uploaded scripts

## 5. Sensitive Data and Logging

Existing logging safeguards:

- Log message sanitization (`sanitizeLogMessage`) to reduce log injection risk.
- `redactSensitive()` helper exists.

Operational caution:

- Sensitive data redaction is not globally enforced automatically in all log call sites.
- Password reset flow currently logs the newly generated password to backend logs.

Required operational controls:

- Restrict backend log access.
- Define log retention and scrubbing policy.
- Avoid collecting raw auth secrets in centralized log systems.

## 6. RN Client Security Checklist (Must Have)

- Enforce HTTPS base URL in production.
- Reject mixed-content or downgraded cleartext paths.
- Avoid logging:
  - passwords
  - tokens
  - cookie headers
- Treat `401/403/429` as security states, not generic transport errors.
- Pause polling and sensitive retries when app goes background.
- Validate and sanitize user-entered server URL (self-hosted mode).

## 7. Security Gaps to Track

- `cors({ origin: true, credentials: true })` is permissive by default; restrict origin list in production deployments.
- Settings response can include sensitive cloud credentials for authenticated roles; apply least-privilege policy at deployment level.
