# 02 Auth Session Compliance Gaps (Non-RN Code)

This document tracks `react-native-android-mvp/02-auth-session.md` items that are **not solvable purely in React Native JS/TS** and require backend or Android native configuration.

## 1) Cookie Issuance/Clearing Is Backend-Owned

- Spec reference: session cookies (`mytube_auth_token`, `mytube_role`) and logout cookie clearing.
- Why RN code cannot implement this: mobile clients can send cookies (`withCredentials`), but cannot create HTTP-only cookies for backend auth.
- Required files to change:
  - Backend route/controller for:
    - `POST /api/settings/verify-admin-password`
    - `POST /api/settings/verify-visitor-password`
    - `POST /api/settings/passkeys/authenticate/verify`
    - `POST /api/settings/logout`
  - Backend cookie/session utility (if centralized).
- Code to add in backend handlers (Express example):

```ts
res.cookie('mytube_auth_token', token, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.SECURE_COOKIES === 'true',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
});

res.cookie('mytube_role', role, {
  httpOnly: false,
  sameSite: 'lax',
  secure: process.env.SECURE_COOKIES === 'true',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
});

// logout
res.clearCookie('mytube_auth_token', { path: '/' });
res.clearCookie('mytube_role', { path: '/' });
```

- RN-side already present: `src/core/api/client.ts` sets `withCredentials: true`.

## 2) Android Cleartext Policy Is Native Config

- Spec reference: allow cleartext only for local `http://` development.
- Why RN code cannot implement this: Android network cleartext policy is enforced by manifest/security config before JS runs.
- Required files to change:
  - `android/app/src/main/AndroidManifest.xml`
  - `android/app/build.gradle`
  - `android/app/src/main/res/xml/network_security_config.xml`
  - `android/app/src/release/res/xml/network_security_config.xml`
- Code to add (if missing):

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
  android:usesCleartextTraffic="${usesCleartextTraffic}"
  android:networkSecurityConfig="@xml/network_security_config" />
```

```gradle
// android/app/build.gradle
buildTypes {
  debug {
    manifestPlaceholders = [usesCleartextTraffic: "true"]
  }
  release {
    manifestPlaceholders = [usesCleartextTraffic: "false"]
  }
}
```

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
```

```xml
<!-- android/app/src/release/res/xml/network_security_config.xml -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

## 3) Production HTTPS Enforcement Is Native + Build Config

- Spec reference: enforce HTTPS in production.
- Why RN code alone is insufficient: JS checks can be bypassed by native calls/libs and do not replace platform traffic policy.
- Required files to change:
  - `android/app/src/release/res/xml/network_security_config.xml`
  - `android/app/build.gradle` (release placeholder must disable cleartext)
  - Optional hardening in `android/app/src/main/res/xml/network_security_config.xml` using domain-config rules.
- Code to add:

```xml
<!-- release: block all cleartext -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

```gradle
release {
  manifestPlaceholders = [usesCleartextTraffic: "false"]
}
```

- RN-side defense-in-depth already present: `src/core/utils/env.ts` rejects non-HTTPS API overrides when `__DEV__` is false.

## 4) OS Secure Storage Requires Native-Backed Module/Setup

- Spec reference: prefer OS secure storage for sensitive local state.
- Why this is not pure RN JS: secure-at-rest guarantees depend on Android Keystore/iOS Keychain primitives exposed by native-backed libraries.
- Required files to change:
  - `src/core/auth/roleStorage.ts` (storage adapter swap/hardening)
  - Native-backed secure storage integration files (library setup, platform config)
    - e.g. `android/app/src/main/java/...` module/config when using keystore-backed encryption keys.
- Code to add (one viable pattern):

```ts
// src/core/auth/roleStorage.ts
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({
  id: 'auth-storage',
  // Key must come from OS keystore-backed retrieval, not hardcoded JS.
  encryptionKey: getKeystoreBackedKey(),
});
```

- Note: `failedAttempts`/`waitTime` are transient UI fields and should remain in memory state (not persisted).
