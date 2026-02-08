# Error Handling (RN Android MVP)

## 1. Why Error Handling Needs Normalization

The backend currently returns errors in multiple shapes due backward compatibility and endpoint history.
Your mobile API layer should normalize these into one internal error type.

## 2. Observed Error Shapes

## 2.1 Generic wrapped error

```json
{
  "success": false,
  "error": "Some message"
}
```

## 2.2 DownloadError / ServiceError middleware output

```json
{
  "error": "Readable error message",
  "type": "validation | not_found | duplicate | execution | database | migration | ...",
  "recoverable": true
}
```

## 2.3 Auth failure returned as HTTP 200 (password verify endpoints)

```json
{
  "success": false,
  "message": "Incorrect admin password",
  "waitTime": 120000,
  "failedAttempts": 4,
  "statusCode": 401
}
```

Important: for these endpoints, body-level `statusCode` must be interpreted even when HTTP status is 200.

## 2.4 Role/Auth middleware errors

```json
{
  "success": false,
  "error": "Authentication required. Please log in to access this resource."
}
```

or

```json
{
  "success": false,
  "error": "Visitor role: Write operations are not allowed."
}
```

## 2.5 Fallback unhandled error

```json
{
  "error": "Internal server error"
}
```

## 3. Status Code Guide

- `200`: success, or auth failure on verify-password endpoints (inspect body)
- `400`: validation/business error
- `401`: unauthenticated or passkey verify failure
- `403`: forbidden by role policy
- `404`: not found
- `409`: duplicate/conflict (service-level duplicate)
- `429`: represented either as HTTP 429 or body `statusCode: 429` on auth endpoints
- `500`: internal/server execution errors

## 4. Recommended Client Error Model

```ts
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "SERVER"
  | "NETWORK"
  | "UNKNOWN";

export interface AppError {
  code: AppErrorCode;
  httpStatus?: number;
  message: string;
  backendType?: string;
  recoverable?: boolean;
  waitTimeMs?: number;
  raw?: unknown;
}
```

## 5. Parsing Rules (Suggested)

1. If network exception/no response -> `NETWORK`
2. Else read `status = response.status`
3. Parse body:
   - if body has `statusCode` and `success === false`, treat `statusCode` as effective status
4. Map effective status:
   - 401 -> `UNAUTHENTICATED`
   - 403 -> `FORBIDDEN`
   - 404 -> `NOT_FOUND`
   - 409 -> `CONFLICT`
   - 429 -> `RATE_LIMIT`
   - 400 -> `VALIDATION`
   - 500+ -> `SERVER`
5. Keep raw payload for diagnostics

## 6. Retry Policy

Safe to auto-retry (with backoff):

- network timeouts / transient network failures
- `5xx` (limited retries, e.g. max 2)

Do not auto-retry:

- `400/401/403/404/409`
- auth body failures with `success:false` and explicit message

Special case:

- auth wait lock (`waitTime` present): disable login submit button until countdown ends

## 7. UX Guidance

- `UNAUTHENTICATED`: redirect to login screen
- `FORBIDDEN`: hide write actions and show role-limited notice
- `VALIDATION`: inline form hint
- `RATE_LIMIT`: countdown with retry timer
- `SERVER/NETWORK`: non-blocking retry affordance + toast/snackbar
