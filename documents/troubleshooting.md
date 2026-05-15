# Troubleshooting

Known issues and fixes for the MyTube Android app and its build.

---

## End-user issues

### "Cannot reach server" on the backend setup screen

- Open the URL in your phone's browser. If that fails too, the issue is network/server, not the app.
- For LAN URLs (`http://192.168.X.X:5551`), make sure your phone is on the same Wi-Fi network as the MyTube server.
- For public URLs, HTTPS is mandatory. Self-signed certificates are rejected by Android by default — use Cloudflare Tunnel (built into MyTube) or a real Let's Encrypt cert.

### "Timed out"

- Your MyTube backend is reachable but slow. Try again — the test has an 8-second timeout.
- If it keeps timing out, check the backend host for CPU/disk pressure.

### Login fails repeatedly

- Use the password that matches the role you need: admin vs. visitor are separate fields.
- After several failures the backend rate-limits login attempts. Wait for the on-screen countdown to expire before retrying.
- Forgot the password? See MyTube's [password recovery](https://github.com/franklioxygen/mytube/blob/master/documents/en/api-endpoints.md#password--session) — must be performed on the backend host.

### Videos won't play

- The app streams directly from your MyTube backend. If a specific video won't play in the web frontend either, it's a backend or source issue.
- For very large files over a slow connection, give the player a few seconds to buffer.

### App stuck on splash screen or showing a blank screen

- Make sure your MyTube backend is on a recent version. Older versions may not implement the endpoints the app expects.
- Clear app data (Android Settings → Apps → MyTube → Storage → Clear data) and reconnect the backend.

---

## Build issues (developers)

### `Cannot run program 'node'` when building from Android Studio

This is the most common build failure on macOS. Studio launches with a stripped `PATH` and Gradle can't find your node binary.

**Fix:** Add to `~/.gradle/gradle.properties`:

```
nodeBinary=/opt/homebrew/bin/node
```

Then kill any stale daemon: `pkill -f GradleDaemon`. See [build-from-source.md](build-from-source.md#configure-the-node-binary-for-android-studio-macos-only) for the full explanation.

### Build fails after switching AGP / Gradle versions

If you upgrade AGP or the Gradle wrapper and then see Kotlin metadata errors like:

```
Module was compiled with an incompatible version of Kotlin.
The actual metadata version is 2.3.0, but the compiler version 2.1.0 can read versions up to 2.2.0.
```

This means Gradle's bundled Kotlin stdlib version is ahead of the Kotlin compiler version the RN gradle plugin uses. Two common causes:

1. **Stale Gradle daemon.** Studio caches daemons. Kill them: `pkill -f GradleDaemon`, then rebuild.
2. **Two wrappers out of sync.** This repo has one wrapper at `android/gradle/wrapper/gradle-wrapper.properties` *and* the included RN plugin has its own at `node_modules/@react-native/gradle-plugin/gradle/wrapper/gradle-wrapper.properties`. If Studio's upgrade assistant modified one but not the other, Studio may pick the higher version. Align them.

The current known-working combo for RN 0.83.1 in this project:

- Gradle 9.0.0
- AGP 8.13.2
- Kotlin 2.1.20

AGP 9.x is not currently viable because several RN native libraries (e.g. `react-native-mmkv`) still use APIs AGP 9 removed.

### `Cannot run program 'npx'` during settings.gradle evaluation

Same root cause as the `node` issue — Studio's stripped `PATH` doesn't include `npx`. The repo's `settings.gradle` reads the `nodeBinary` property and invokes the RN CLI directly via that node binary, so the fix is the same: set `nodeBinary` in `~/.gradle/gradle.properties`.

### Gradle build hangs at "Daemon will be stopped"

Kill all daemons: `pkill -f GradleDaemon`. Then run `./gradlew --stop` to be safe, and rebuild.

### `npm install` resets node_modules edits

If you've been hand-patching files inside `node_modules/` (e.g. RN gradle plugin), `npm install` will overwrite them. Use [`patch-package`](https://github.com/ds300/patch-package) to capture these patches durably:

```sh
npm install --save-dev patch-package
# after editing node_modules/some-package
npx patch-package some-package
```

The generated `patches/*.patch` is committed and re-applied on each `npm install` via a `postinstall` script.

### Metro fails to start with EADDRINUSE

Another Metro instance is already running on port 8081. Find and kill it:

```sh
lsof -ti:8081 | xargs kill
```

Then `npm start` again.

---

If you hit something not covered here, please open an issue with the full build log and the output of:

```sh
node -v
npm -v
java -version
./android/gradlew --version
```
