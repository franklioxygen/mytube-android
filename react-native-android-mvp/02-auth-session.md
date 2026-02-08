# Auth and Session (RN Android MVP)

## 1. Session Basics

- Session token is set via `Set-Cookie` (HTTP-only): `mytube_auth_token`
- Role cookie is also set: `mytube_role` (non-HTTP-only)
- Token lifetime: 24 hours
- Login APIs return role in response body, but token is stored in cookie, not JSON.

## 2. Password Login Flow (Admin/Visitor)

1. Check auth mode:
   - `GET /api/settings/password-enabled`
2. Show login options:
   - password and/or passkey based on response fields
3. Submit password:
   - admin: `POST /api/settings/verify-admin-password`
   - visitor: `POST /api/settings/verify-visitor-password`
4. On success:
   - response: `{ success: true, role: "admin" | "visitor" }`
   - cookie is set; subsequent requests use same HTTP client with credentials enabled
5. On failure:
   - response is typically HTTP 200 with:
     - `{ success: false, message, waitTime?, failedAttempts?, statusCode }`
   - `statusCode` inside JSON indicates intended auth failure code (401/429)

## 3. Passkey Login Flow

1. Check passkey availability:
   - `GET /api/settings/passkeys/exists`
2. Start challenge:
   - `POST /api/settings/passkeys/authenticate`
   - response includes `{ options, challenge }`
3. Run WebAuthn in client (if available in RN stack):
   - collect authenticator assertion
4. Verify challenge:
   - `POST /api/settings/passkeys/authenticate/verify`
   - body: `{ body: <authenticatorResponse>, challenge: string }`
5. On success:
   - `{ success: true, role: "admin" }`
   - session cookie is set

## 4. Logout

- Call `POST /api/settings/logout`
- Backend clears both auth cookies.

## 5. React Native Networking Requirements

## 5.1 Axios

Set `withCredentials: true` globally:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: "http://10.0.2.2:5551/api",
  withCredentials: true,
  timeout: 15000,
});
```

## 5.2 Fetch

Always send:

```ts
fetch(url, {
  method: "GET",
  credentials: "include",
});
```

## 5.3 Android cleartext

If using `http://` during local dev, allow cleartext traffic in Android network security config.

## 6. Auth State Probe Strategy

At app startup:

1. `GET /api/settings/password-enabled`
2. If `loginRequired=true` and no valid cookie:
   - first protected request returns `401`
   - navigate to login screen
3. If login not required:
   - go directly to content flow

## 7. Permission-Aware UI

Use returned role to gate write actions:

- `visitor`:
  - allow browsing and playback
  - disable collection editing/rating/progress writes unless confirmed allowed in your deployment policy
- `admin`:
  - full write UI can be enabled

## 8. Security Notes for Mobile

- Do not persist password in AsyncStorage/plain files.
- Prefer OS secure storage for sensitive local state.
- Do not log full response headers containing cookies.
- Enforce HTTPS in production.
