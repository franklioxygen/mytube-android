# Build From Source

For developers and contributors. End users should follow the [setup guide](setup.md) and install a prebuilt APK instead.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 or 22 LTS | 25.x works but is not officially supported by RN 0.83 |
| npm | bundled with Node | `pnpm` and `yarn` should also work |
| JDK | 21 (JBR) | Bundled with Android Studio; no separate install needed |
| Android Studio | Ladybug or newer | Includes the Android SDK and platform tools |
| Android SDK | Platform 36, build-tools 36.0.0 | Installed via Studio's SDK Manager |

---

## Clone and install

```sh
git clone https://github.com/franklioxygen/mytube-android.git
cd mytube-android
npm install
```

This pulls the JS dependencies. Android Gradle dependencies are resolved on the first build.

---

## Configure the backend URL for development

For local development, the app defaults to `http://10.0.2.2:5551/api` — the emulator's address for your host's `localhost`. If your MyTube backend runs somewhere else, edit:

```
.env.development    # API_BASE_URL and BACKEND_BASE_URL for dev builds
.env.production     # for release builds
```

The user can still override the URL on first launch via the in-app setup screen.

---

## Configure the node binary for Android Studio (macOS only)

> **Skip this if you only build from the command line.** It's specifically for builds triggered from Android Studio's Build / Run buttons.

On macOS, Android Studio launched from the Dock or Finder gets a stripped `PATH` that doesn't include Homebrew (`/opt/homebrew/bin`). Gradle then can't find the `node` and `npx` executables that the React Native gradle plugin invokes for codegen and bundling, and the build fails with `Cannot run program 'node'`.

The repo includes hooks that read a `nodeBinary` Gradle property and pass an absolute path to the RN gradle plugin instead of relying on `PATH`. To enable, add to `~/.gradle/gradle.properties`:

```
nodeBinary=/opt/homebrew/bin/node
```

Adjust the path if your node lives elsewhere (`which node` from your shell will tell you). Without this property the build still works from the command line (where `PATH` is correct) — it only matters for Studio's stripped environment.

Two other follow-ups for the same Studio launch issue:

- After saving the property, kill any stale Gradle daemon Studio may have spawned earlier: `pkill -f GradleDaemon`. Then trigger Build again — Studio will spawn a new daemon that reads the updated property.
- You can also set `launchctl config user path "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"` and reboot, which fixes the underlying PATH issue for all GUI apps. But Studio may still strip its own PATH on launch, so the `nodeBinary` property is the more reliable fix.

---

## Run on an emulator or device

Start an emulator (Android Studio → Device Manager) or plug in a device with USB debugging enabled, then:

```sh
npm run android
```

This launches Metro (the JS bundler) and installs the debug APK on the connected device.

If you have multiple devices, pass `--deviceId` to `react-native run-android`.

---

## Build a release APK

```sh
cd android
./gradlew :app:assembleRelease
```

The signed APK lands in `android/app/build/outputs/apk/release/`. By default the release build is signed with the debug keystore (see `android/app/build.gradle`); for a public release you should generate your own keystore and update the `signingConfigs` block.

For a versioned release with automatic tagging:

```sh
./release.sh patch        # bump patch, tag, push
./release.sh 1.2.0        # set explicit version
```

`release.sh` requires a clean working tree on the `main` branch.

---

## Project layout

```
src/
├── app/              # navigation, providers, top-level layout
├── core/
│   ├── api/          # HTTP client, endpoints, error/unwrap helpers
│   ├── auth/         # AuthContext, passkey, role storage
│   ├── config/       # runtime config (backend URL storage)
│   ├── repositories/ # query-keyed wrappers over endpoint modules
│   └── utils/        # env, duration, layout, polling, etc.
├── features/         # screens by feature (player, home, auth, settings, ...)
└── types/            # shared TypeScript model definitions
android/              # native Android project (Gradle, AGP, Kotlin)
documents/            # docs (you are here)
```

---

## Common scripts

```sh
npm run android       # run debug on connected device/emulator
npm run start         # start Metro by itself
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm test              # jest
```

---

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for known build issues — node-not-found errors, Gradle daemon caching, AGP / Kotlin version pitfalls.
