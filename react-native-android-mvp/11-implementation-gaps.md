# Implementation Gaps (Closed)

This file tracks implementation gaps identified during the MVP audit and their resolution status.

## Completed

1. Security hardening for API/media URL handling
- Enforced HTTPS-only API base URL override in production builds.
- Added mixed-content downgrade rejection for media URLs when host base is HTTPS.
- Applied the same mixed-content policy to cloud signed playback URL fallback path.
- Aligned env lookup to support `API_BASE_URL` (and backward-compatible `MYTUBE_API_BASE_URL`).

2. Required idempotency/concurrency guardrail
- Added a global in-flight write request guard keyed by `method + normalized target`.
- Applied the guard to write endpoints (`POST`/`PUT`/`DELETE`) for auth, videos, collections, and settings.

3. Error-handling retry policy parity
- Aligned polling query retries with `04-error-handling.md` so only transient `NETWORK`/`SERVER` errors auto-retry.
- Explicitly prevents polling retries for non-retriable 4xx classes (`400/401/403/404/409/429`).

4. Compatibility/schema tolerance verification coverage
- Added tests for mixed envelope unwrapping.
- Added tests for in-flight dedup behavior.
- Added tests for mixed-content URL rejection policy.
- Added repository-level compatibility tests for additive fields and unknown future task statuses.

5. Transport retry safety for write operations
- Restricted automatic HTTP retries to idempotent read methods only (`GET`/`HEAD`/`OPTIONS`).
- Prevented automatic replay of non-idempotent writes (`POST`/`PUT`/`DELETE`/`PATCH`) to avoid duplicate side effects.

6. Query-layer retry policy de-duplication
- Disabled global React Query default retries to avoid stacked retries on top of transport/polling retry logic.
- Kept endpoint-specific polling retries as the source of truth for polling behavior.

7. Auth startup role normalization when login is disabled
- Startup auth probe now clears persisted role state when `loginRequired=false`.
- Prevents stale persisted `visitor` role from incorrectly forcing read-only UI in open-access mode.

8. Added regression tests for new guardrails
- Added API client tests that verify write methods are excluded from automatic retries.
- Added auth startup role tests that verify open-access mode clears persisted role.

9. Settings theme runtime parity
- Replaced fixed dark Paper theme usage with a runtime theme provider that reads `/api/settings` `theme` (`light`/`dark`/`system`).
- Added system-color fallback behavior for `theme=system` so UI now follows server-configured theme semantics.

10. Auth-state handling parity for `403` polling failures
- Updated API client unauthorized trigger policy so `403 FORBIDDEN` on read flows (`GET`/`HEAD`/`OPTIONS`) is treated as a re-auth state.
- Preserved write-flow behavior so visitor role `403` on write endpoints does not incorrectly force logout.
- Added API client tests to lock this behavior.

11. Navigation and lint stability cleanup
- Removed unstable nested header component creation in root navigator (`header: renderTopBar`) to avoid remount/state-reset risk.
- Removed remaining lint warnings in providers/passkey helpers; lint now passes cleanly.

12. Settings language runtime parity
- Added settings-backed language sync in `LanguageProvider` so app i18n now follows `/api/settings` `language` on startup/session refresh.
- Updated Settings screen language picker to edit staged value and persist through `PATCH /api/settings` (admin/open mode only) instead of local-only toggling.
- Kept visitor role behavior aligned with settings policy by rendering language as read-only for visitor mode.

13. Explicit transport retry policy lock for `429`
- Added `429` to the non-retriable status set in API error policy constants to match documented retry rules.
- Added regression assertion to ensure rate-limit errors are never auto-retried by transport policy.

14. Server URL validation/sanitization hardening
- Hardened API base URL normalization to accept only valid `http`/`https` URLs.
- Added normalization that strips query/hash fragments and enforces a single `/api` suffix.
- Added fallback behavior so malformed overrides are rejected and safe defaults are used.

15. Background polling retry lifecycle parity
- Updated downloads/subscriptions polling retries to stop when app is backgrounded or screen is unfocused.
- Ensures retry loops do not continue while inactive, aligning with mobile lifecycle security guidance.

16. Strict transport retry method hardening
- Tightened HTTP retry method classification so missing/invalid methods are treated as non-retryable.
- Prevents accidental fallback retries when request method metadata is absent, preserving read-only retry policy guarantees.
- Added client retry-policy tests for undefined/empty methods.

17. Cloud playback compatibility/fallback hardening
- Hardened cloud signed-URL handling to tolerate envelope-normalized payloads where `url` is present but explicit `success` is omitted.
- Added playback fallback to documented `/cloud/videos/:filename` redirect route when cloud signing is unavailable, so video detail metadata/comments still load.
- Added repository compatibility coverage for cloud thumbnail hydration with success-less signed-URL payloads.

18. Polling jitter and mixed-content strictness alignment
- Updated polling jitter to `+/-20%` to better match documented anti-thundering-herd guidance.
- Hardened mixed-content rejection with case-insensitive HTTP scheme detection to block downgrade bypass variants (for example `HTTP://...`).
- Added regression tests for uppercase-scheme mixed-content rejection and cloud redirect URL generation.

## Validation

- `npm run typecheck`: pass
- `npm test -- --runInBand`: pass
- `npm run lint`: pass (no warnings)
