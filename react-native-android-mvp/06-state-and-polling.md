# State and Polling (RN Android)

This document defines the actual state model used by the backend and recommended polling behavior for a React Native Android client.

## 1. Scope

State-related APIs covered:

- `GET /api/download-status`
- `GET /api/downloads/history`
- `GET /api/subscriptions/tasks`
- `GET /api/subscriptions`

## 2. State Model (Actual Backend Behavior)

## 2.1 Download Queue State (`/api/download-status`)

Response shape:

```json
{
  "activeDownloads": [/* DownloadInfo */],
  "queuedDownloads": [/* DownloadInfo */]
}
```

Underlying status values in storage are:

- `active`
- `queued`

Notes:

- There is no explicit `completed`/`failed` status in this endpoint.
- Completion/failure is reflected by disappearing from `activeDownloads` and then appearing in download history.

## 2.2 Download History State (`/api/downloads/history`)

History `status` values:

- `success`
- `failed`
- `skipped`
- `deleted`

Usage:

- `failed`: download failed or was cancelled at manager level.
- `skipped`: de-dup skip (already exists).
- `deleted`: source was downloaded before but local file was deleted and not re-downloaded.

## 2.3 Continuous Task State (`/api/subscriptions/tasks`)

Task `status` values:

- `active`
- `paused`
- `completed`
- `cancelled`

Important:

- API uses `cancelled` (double `l`).
- There is no task-level `queued` state.
- There is no task-level `failed` status value.

Failure in continuous tasks is represented by:

- `failedCount` increment
- optional `error` field on task record
- related `failed` entries in `download_history`

## 2.4 Requested vs Implemented Statuses

If your client model includes `queued/active/paused/completed/failed/cancelled`, map as:

- `queued`: only for download queue (`/api/download-status`), not continuous tasks.
- `failed`: derive from counters/history, not from `task.status`.
- `cancelled`: direct task terminal state.

## 3. Practical State Machines

## 3.1 Download Queue

```text
queued -> active -> (success | failed)
active -> cancel request -> removed from queue status + history status=failed
```

## 3.2 Continuous Task

```text
active <-> paused
active -> completed
active/paused -> cancelled
```

Per-video failures do not force task status to `failed`; task can remain `active` and continue.

## 4. Polling Strategy (Recommended)

## 4.1 Download Queue Polling

Endpoint: `GET /api/download-status`

Recommended interval:

- `2000ms` while `activeDownloads.length > 0 || queuedDownloads.length > 0`
- stop polling when both are empty

This matches current web behavior.

## 4.2 Continuous Task Polling

Endpoint: `GET /api/subscriptions/tasks`

Recommended interval:

- `10000ms` when any task is `active` or `paused`
- `60000ms` when all tasks are terminal (`completed`/`cancelled`) or no tasks exist

This matches current web behavior.

## 4.3 Subscription List Polling

Endpoint: `GET /api/subscriptions`

Recommended interval:

- `30000ms` for list freshness (counts, last check time, pause state)

## 4.4 Mobile Lifecycle Rules

- Poll only in foreground (`AppState === "active"`).
- On app resume, do an immediate refetch before restarting intervals.
- Stop active polling when user leaves related screen.
- Use jitter (for example +/-20%) to avoid synchronized spikes across devices.

## 5. Retry/Backoff Recommendation

For transient network failures:

- retry delays: `2s -> 5s -> 10s -> 20s -> 60s (cap)`
- reset to normal interval on first successful poll

For auth failures:

- `401/403`: stop polling and trigger re-auth flow
- `429`: respect retry-after behavior if present, otherwise back off to >= `60s`

## 6. Client-Side Normalization Tips

- Treat download completion as "ID removed from `/api/download-status`", then read `/api/downloads/history` if you need final reason.
- Treat continuous task terminal states strictly as:
  - `completed`
  - `cancelled`
- Derive "has failures" from `failedCount > 0` or history, not from `task.status`.
