# Change Log

| Date | Change | Why | Impact | Owner |
|---|---|---|---|---|
| 2026-02-10 | Added mount-time debug log in `HomeScreen` with `useEffect` and `console.log('[HomeScreen] Screen mounted');` | Improve local runtime visibility when the home screen mounts during debugging | Developers can confirm mount lifecycle from logs without stepping through code | Codex |
| 2026-02-09 | Added `failedAttempts` to `AuthContext` state and wired login/passkey failure/success/reset paths | Close missing 02-auth-session login failure-field compliance | Auth state now exposes backend failure-attempt count for UI and future policy hooks | Codex |
| 2026-02-09 | Updated `LoginScreen` to render failed-attempt count and added auth-context regression test | Ensure user-visible compliance + prevent regressions | Login screen now shows `Failed attempts: N` when backend returns it | Codex |
| 2026-02-09 | Added `docs/auth-session-compliance-gaps.md` with backend/native-only items and required file-level code snippets | Track non-RN gaps explicitly per compliance request | Clear implementation ownership for cookies, cleartext/HTTPS native config, and secure storage hardening | Codex |
