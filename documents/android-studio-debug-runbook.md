# Android Studio Debug Runbook (Metro Script Load)

## Scope
This runbook is for **Android Studio debug app runs** only.

- In scope: debug variant + Metro runtime
- Out of scope: release-style runs, release bundle packaging, instrumentation/release tests

## Problem Signature
Red screen in app:

`Unable to load script. Make sure you're running Metro ...`

In this project, this usually means:

1. Metro is not running on `:8081`
2. `adb reverse` mapping is missing

## Standard Debug Run Flow (Manual Prep)

1. Start Metro from project root:

```sh
npm start
```

2. In another terminal, set reverse mapping:

```sh
/Users/franklioxygen/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

3. In Android Studio:
- Use Build Variant `debug`
- Run app (not release run config)

## Required Pre-Run Verification

Run these commands before pressing Run:

1. Metro check:

```sh
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

2. Device check:

```sh
/Users/franklioxygen/Library/Android/sdk/platform-tools/adb devices -l
```

3. Reverse check:

```sh
/Users/franklioxygen/Library/Android/sdk/platform-tools/adb reverse --list
```

Expected reverse output includes:

`tcp:8081 tcp:8081`

## Fallback If Red Screen Persists

1. Confirm Android Studio build variant is `debug`.
2. Re-apply reverse mapping (it can be lost after emulator/device restart):

```sh
/Users/franklioxygen/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

3. Open React Native Dev Settings and confirm host is `localhost:8081` (using reverse strategy).
4. Stop and restart Metro, then rerun app.

## Validation Scenarios

1. Happy path: Metro running + reverse set + debug variant -> app loads.
2. Metro missing: reverse set but no Metro -> red screen reproduces.
3. Reverse missing: Metro running but no reverse -> red screen reproduces.
4. Recovery: set reverse + restart Metro/app -> app loads.

## Acceptance Criteria

1. Android Studio debug run starts without `Unable to load script`.
2. Pre-run checks reliably show readiness.
3. Steps remain repeatable after emulator restart.

## Assumptions and Defaults

1. Routing strategy is always `adb reverse` for consistency.
2. Deliverable is operational runbook only (no app code changes).
