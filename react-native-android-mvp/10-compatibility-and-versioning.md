# Compatibility and Versioning

This document defines how to keep RN Android client compatibility stable as backend APIs evolve.

## 1. Current Versioning Reality

- API paths are not namespaced by major version (no `/api/v1` path family).
- Contract evolution currently happens in-place on existing endpoints.

Client consequence:

- Use tolerant parsing and runtime capability checks.
- Do not assume strict schema lockstep by app version alone.

## 2. Existing Backward-Compatibility Patterns in Codebase

Observed conventions:

- Mixed response styles are intentionally kept:
  - direct payloads
  - wrapped payloads (`{ success, data, ... }`)
- Deprecated endpoint still present:
  - `POST /api/settings/verify-password` (deprecated, still supported)
- Legacy alias field preserved:
  - collection `title` alongside `name`
- Auth compatibility path preserved:
  - bearer header fallback in addition to cookie auth
- Settings storage is whitelist-based:
  - unknown keys are ignored (safe for forward-compatible clients)
- DB migrations are auto-run on startup.

## 3. Field Evolution Policy (Recommended)

## 3.1 Additive Changes

- Add new fields as optional.
- Keep existing fields unchanged in meaning and type.
- Do not require new fields in old endpoints without defaults.

## 3.2 Deprecations

- Mark field/endpoint deprecated in docs first.
- Keep deprecated behavior for at least one full release cycle.
- Provide replacement endpoint/field and migration notes.

## 3.3 Breaking Changes

If breaking behavior is unavoidable:

- Prefer introducing new endpoint shape (or versioned route) instead of changing old semantics in place.
- Keep old behavior until mobile minimum supported backend version is communicated.

## 4. Client Compatibility Rules (Must Have)

- Unknown fields: ignore safely.
- Missing optional fields: apply app defaults.
- Unknown enum/status value: map to `unknown` bucket and avoid crash.
- Mixed response envelope: always normalize before domain mapping.
- Time values: treat as epoch milliseconds when returned by backend task/download entities.

## 5. Status and Enum Compatibility Notes

- Continuous task status currently supports:
  - `active`, `paused`, `completed`, `cancelled`
- Download history status currently supports:
  - `success`, `failed`, `skipped`, `deleted`

Compatibility rule:

- Client should not hard-crash on new future status values.

## 6. Upgrade Checklist for RN Releases

Before shipping app update against newer backend:

1. Verify auth flows:
   - password login
   - visitor login
   - passkey login (if used)
2. Run schema tolerance check for:
   - `/api/videos`
   - `/api/videos/:id`
   - `/api/settings`
   - `/api/subscriptions/tasks` (if feature enabled)
3. Validate polling and retry behavior under:
   - `401`
   - `403`
   - `429`
   - transient network failures
4. Validate de-dup/cancel behavior for repeated actions.
5. Read `/api/system/version` and compare release notes for migration advisories.

## 7. Documentation Update Contract

For every backend change affecting clients, update at least:

- endpoint doc (`api-endpoints.md` or OpenAPI subset)
- state/transition doc when statuses change
- this compatibility doc when deprecations or migration steps are introduced
