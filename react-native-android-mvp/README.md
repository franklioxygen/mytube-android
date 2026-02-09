# React Native Android MVP Docs

This document pack defines the minimum API contract for a React Native Android client.

Scope is intentionally limited to **MVP read/play/manage** capabilities and excludes:

- Upload (`/api/upload`, subtitle upload)
- Download workflows (`/api/download*`, `/api/search`, `/api/check-*`, `/api/subscriptions*`, `/api/downloads*`)
- File scanning and cleanup (`/api/scan-*`, `/api/cleanup-temp-files`)

Additional operational docs (`06`-`10`) are included for Android client hardening and future expansion; these can reference non-MVP endpoints when discussing state, idempotency, security, and compatibility policy.

## Document Map

1. `01-api-overview.md`
   - Endpoint scope, role matrix, and media URL strategy.
2. `02-auth-session.md`
   - Password/passkey login flows, cookie session handling in React Native.
3. `03-data-models.md`
   - Core response models and client-side normalized model suggestions.
4. `04-error-handling.md`
   - Error formats, status codes, and retry/fallback policy.
5. `05-openapi-mvp.yaml`
   - OpenAPI subset for codegen and contract testing.
6. `06-state-and-polling.md`
   - Download/task state definitions and practical polling strategy for mobile clients.
7. `07-idempotency-and-concurrency.md`
   - Duplicate request behavior, cancel/pause/resume conflicts, and de-dup logic notes.
8. `08-settings-dictionary.md`
   - `/api/settings` field-by-field dictionary (meaning, unit, scope, permissions).
9. `09-security.md`
   - Transport/auth/rate-limit/security controls and RN client security requirements.
10. `10-compatibility-and-versioning.md`
   - Backward compatibility rules, deprecation handling, and upgrade checklist.

## Recommended MVP Screens -> API Mapping

- Login screen
  - `GET /api/settings/password-enabled`
  - `GET /api/settings/passkeys/exists`
  - `GET /api/settings/reset-password-cooldown` (optional; for reset-password cooldown UX)
  - `POST /api/settings/verify-admin-password`
  - `POST /api/settings/verify-visitor-password`
  - `POST /api/settings/passkeys/authenticate`
  - `POST /api/settings/passkeys/authenticate/verify`
- Home/feed screen
  - `GET /api/videos`
- Video detail/player
  - `GET /api/videos/:id`
  - `GET /api/videos/:id/comments`
  - `POST /api/videos/:id/view`
  - `PUT /api/videos/:id/progress`
  - `POST /api/videos/:id/rate`
  - `GET /api/cloud/signed-url` (when needed for cloud files)
- Collections
  - `GET /api/collections`
  - `POST /api/collections` (optional)
  - `PUT /api/collections/:id` (optional)
  - `DELETE /api/collections/:id` (optional)
- Settings/about
  - `GET /api/settings`
  - `PATCH /api/settings` (only fields your app actually edits)
  - `GET /api/system/version`
  - `POST /api/settings/logout`
