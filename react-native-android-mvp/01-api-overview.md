# API Overview (RN Android MVP)

## 1. Base URL and Prefix

- Backend host: `http://<host>:5551`
- API prefix: `/api`
- Example full URL: `http://<host>:5551/api/videos`

Android emulator notes:

- Android Emulator -> host machine localhost: use `http://10.0.2.2:5551`
- Physical device -> use machine LAN IP, e.g. `http://192.168.1.100:5551`

## 2. Authentication Model

- Session is cookie-based (HTTP-only cookie `mytube_auth_token`).
- Most APIs are under `/api` and pass through auth + role middleware.
- If login is enabled and no valid session is present, non-public endpoints return `401`.

Public login-related endpoints (available without prior session):

- `GET /api/settings/password-enabled`
- `GET /api/settings/passkeys/exists`
- `GET /api/settings/reset-password-cooldown`
- `POST /api/settings/verify-password` (deprecated)
- `POST /api/settings/verify-admin-password`
- `POST /api/settings/verify-visitor-password`
- `POST /api/settings/passkeys/authenticate`
- `POST /api/settings/passkeys/authenticate/verify`
- `POST /api/settings/logout`

## 3. Role Behavior

- `admin`: full access
- `visitor`: read-only for most resources
  - `GET` endpoints are generally allowed
  - write endpoints (`POST/PUT/DELETE`) are mostly blocked with `403`

For MVP, if you want mutation features (rate/progress/collection edits/settings write), login as `admin`.

## 4. MVP Endpoint Set (Upload/Download/Scan Excluded)

## 4.1 Auth and Session

- `GET /api/settings/password-enabled`
- `GET /api/settings/passkeys/exists`
- `GET /api/settings/reset-password-cooldown`
- `POST /api/settings/verify-admin-password`
- `POST /api/settings/verify-visitor-password`
- `POST /api/settings/passkeys/authenticate`
- `POST /api/settings/passkeys/authenticate/verify`
- `POST /api/settings/logout`

## 4.2 Video Browsing and Playback

- `GET /api/videos`
- `GET /api/videos/:id`
- `GET /api/videos/:id/comments`
- `POST /api/videos/:id/view`
- `PUT /api/videos/:id/progress`
- `POST /api/videos/:id/rate`
- `GET /api/cloud/signed-url` (for cloud-backed files)
- `GET /api/videos/author-channel-url` (optional metadata enhancement)
- `GET /api/videos` currently returns the full list in one response (no server-side pagination/filtering in MVP).

## 4.3 Collections

- `GET /api/collections`
- `POST /api/collections` (optional in MVP)
- `PUT /api/collections/:id` (optional in MVP)
- `DELETE /api/collections/:id` (optional in MVP)

## 4.4 Settings and Version

- `GET /api/settings`
- `POST /api/settings` (only if your mobile app exposes settings edits)
- `GET /api/system/version`

## 5. Media URL Strategy

`video.videoPath` or `video.signedUrl` from `GET /api/videos/:id` may indicate different playback paths:

1. Local file:
   - path like `/videos/<file>`
   - play directly from `http://<host>:5551/videos/<file>`
2. Mount file:
   - backend injects `signedUrl: /api/mount-video/:id`
   - play from that full URL directly
   - this streaming endpoint is intentionally excluded from `05-openapi-mvp.yaml` (the OpenAPI subset focuses on JSON REST contracts)
3. Cloud file:
   - may have `videoPath: "cloud:<name>"`
   - use one of:
     - `signedUrl` returned from `GET /api/videos/:id` (if present), or
     - `GET /api/cloud/signed-url?filename=<name>&type=video`, or
     - `GET /cloud/videos/:filename` redirect route

For thumbnails, use:

- `thumbnailPath` local path (`/images/...`), or
- `signedThumbnailUrl`, or
- `GET /api/cloud/signed-url?filename=<name>&type=thumbnail`

## 6. Response Shape Reality (Important)

The backend currently mixes two patterns:

1. Wrapped shape:
   - `{ success: true, data: ..., message?: string }`
2. Direct shape:
   - arrays/objects returned directly (e.g. `GET /api/videos`, `GET /api/collections`)

Client should normalize both (details in `04-error-handling.md`).

## 7. Explicitly Out of Scope for This MVP

- Upload:
  - `POST /api/upload`
  - `POST /api/videos/:id/subtitles`
- Download and queue:
  - `/api/download`, `/api/search`, `/api/check-*`, `/api/download-status`
  - `/api/downloads/*`
  - `/api/subscriptions*`
- Scan/maintenance:
  - `/api/scan-files`, `/api/scan-mount-directories`, `/api/cleanup-temp-files`
