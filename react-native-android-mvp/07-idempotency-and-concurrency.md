# Idempotency and Concurrency (RN Android)

This document describes repeat-request behavior, conflict patterns, and de-dup logic from the current backend implementation.

## 1. Core Rules

- Not all write endpoints are idempotent.
- Some endpoints are best-effort no-op on duplicates.
- Some endpoints return duplicate-style business errors (usually `4xx`).
- Some endpoints can still race under highly concurrent requests.

## 2. MVP Write Endpoints

| Endpoint | Repeat Request Behavior | Conflict / Error Pattern | Client Recommendation |
|---|---|---|---|
| `POST /api/videos/{id}/view` | Non-idempotent. Each successful call increments `viewCount`. | `404` if video does not exist. | Trigger once per playback start/resume event, with debounce and in-flight lock. |
| `PUT /api/videos/{id}/progress` | Last-write-wins overwrite for `progress`. Same payload is effectively idempotent. | `400` invalid payload; `404` if video missing. | Throttle writes (for example every 5-15s plus on pause/background) and keep only latest pending value. |
| `POST /api/videos/{id}/rate` | Last-write-wins overwrite for `rating` (`1..5`). | `400` invalid rating; `404` if video missing. | Prevent rapid repeated taps; retry only the latest selected rating. |
| `POST /api/collections` | Non-idempotent create. Repeated submits create multiple collections. | `400` when required fields are missing. | Apply button lock / one-shot submit to prevent double creation. |
| `PUT /api/collections/{id}` | Name/add/remove updates are target-state writes; repeating the same operation is effectively idempotent. | `404` collection missing. | Use per-collection write lock and refresh detail/list after success. |
| `DELETE /api/collections/{id}` | First call deletes; repeat may return not found. | `404` if already deleted or never existed. | After local delete success, treat later `404` as terminal and refresh list. |
| `PATCH /api/settings` | Partial-update patch; overlapping writes are last-write-wins per field. Same payload converges to same state. | `400` validation, `401` unauthorized, `403` forbidden. | Serialize settings writes, send changed keys only, and avoid concurrent submits. |

## 3. Endpoint Behavior Matrix (Download/Subscription, Non-MVP)

| Endpoint | Repeat Request Behavior | Conflict / Error Pattern | Client Recommendation |
|---|---|---|---|
| `POST /api/download` | Single-video flow has de-dup check by source video ID. May return `skipped` response. | Usually returns success with skip info; invalid input -> `400`. | Use client-side request lock per normalized URL to avoid double taps. |
| `POST /api/download` with `forceDownload=true` | Allows re-download for previously deleted record. | N/A | Expose as explicit "re-download" action only. |
| `POST /api/downloads/cancel/:id` | If active: cancel. If queued: remove. If missing: still returns success message. | Usually no conflict response. | Safe to retry. Treat as best-effort cancel. |
| `DELETE /api/downloads/queue/:id` | Removes if queued; otherwise no-op. | Returns success message. | Safe to retry. |
| `DELETE /api/downloads/queue` | Clears queue; repeated calls no-op. | Returns success message. | Safe to retry. |
| `POST /api/subscriptions` | Duplicate by same `authorUrl` is rejected. | Duplicate-style service error (`duplicate`). | Refresh list and reuse existing subscription if already present. |
| `POST /api/subscriptions/playlist` | Duplicate by same playlist URL is rejected. | Duplicate-style service error (`duplicate`). | Same as above. |
| `POST /api/subscriptions/channel-playlists` | Existing playlists are skipped; watcher creation is idempotent (returns existing watcher). | Returns counts (`subscribedCount`, `skippedCount`). | Safe to retry at workflow level. |
| `DELETE /api/subscriptions/:id` | Missing subscription is treated as already deleted. | Returns success message. | Safe to retry. |
| `PUT /api/subscriptions/:id/pause` | Sets paused flag to `1`; repeated call is effectively no-op. | Not-found may bubble as server error. | Treat as eventually consistent; refresh list after call. |
| `PUT /api/subscriptions/:id/resume` | Sets paused flag to `0`; repeated call is effectively no-op. | Not-found may bubble as server error. | Same as above. |
| `DELETE /api/subscriptions/tasks/:id` | If task already `completed`/`cancelled`: no-op success. If missing: error. | Missing task throws. | Retry only after re-fetching task list. |
| `PUT /api/subscriptions/tasks/:id/pause` | Valid only when task is `active`. | Invalid state throws. | Disable pause button unless status is `active`. |
| `PUT /api/subscriptions/tasks/:id/resume` | Valid only when task is `paused`. | Invalid state throws. | Disable resume button unless status is `paused`. |
| `DELETE /api/subscriptions/tasks/:id/delete` | Deletes task record; repeat on missing task errors. | Missing task throws. | Soft-delete in UI, then refresh tasks. |

## 4. De-dup Logic for Downloads (`video_downloads`)

Backend tracks source-level download history in `video_downloads`:

- Key fields: `sourceVideoId`, `sourceUrl`, `platform`, `status`
- `status` is `exists` or `deleted`

Behavior:

- If `exists`: download is skipped and recorded as history `skipped`.
- If `deleted`:
  - default: skip and return "previously deleted" info
  - with `forceDownload=true` or setting `dontSkipDeletedVideo=true`: proceed with re-download

Important scope note:

- Source de-dup check in `POST /api/download` is skipped for multi-part/collection workflows (`downloadAllParts` or `downloadCollection`).

## 5. Concurrency Controls in Continuous Tasks

Backend protections:

- `processingTasks` set prevents concurrent processing of the same task ID.
- Task processor checks task status repeatedly during loop and while waiting for download slots.
- Task cancellation is best-effort and also tries to cancel matched active downloads.

Slot control:

- Per-video execution waits for available slot based on `settings.maxConcurrentDownloads`.

## 6. Known Race Windows

- Download de-dup is check-then-act, not a single DB unique-constraint transaction by `sourceVideoId`.
- Subscription duplicate checks are also check-then-insert.

So two near-simultaneous requests can still create duplicate work in edge cases.

## 7. RN Client Guardrails (Required)

- Add client-side in-flight key for write actions:
  - example key: `method + normalizedUrlOrId`
- Disable action buttons while request is in-flight.
- For cancel/pause/resume/delete:
  - optimistic UI update
  - immediate list refetch after response
- On duplicate-like failures:
  - switch to list refresh and reuse existing resource.
- Keep all write actions retry-safe only where endpoint behavior is known to be idempotent (table above).
