# MyTube for Android

Android client for [**MyTube**](https://github.com/franklioxygen/mytube) — your self-hosted video library for YouTube, Bilibili, Twitch, MissAV, and other [yt-dlp-supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md). Stream your collections, manage downloads, and keep tabs on your subscriptions from your phone or tablet.

Built with React Native. Talks to a MyTube backend you host yourself.

[中文](README-zh.md)

## Screenshots

**Tablet**

<table>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/37c6d7a0-ddbf-458b-b565-4273d018809c" alt="Tablet — library" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/8c28f3c7-6fda-4c4f-bcc8-fc642d2b9d05" alt="Tablet — video detail" /></td>
  </tr>
</table>

**Phone**

<table>
  <tr>
    <td align="center" width="50%"><img src="https://github.com/user-attachments/assets/778b78de-a000-4fff-b3fb-05b452f405d2" alt="Phone — library" width="280" /></td>
    <td align="center" width="50%"><img src="https://github.com/user-attachments/assets/cbd67ed1-cf84-4eb4-9e1a-e487a741fa66" alt="Phone — video detail" width="280" /></td>
  </tr>
</table>

---

## What you can do

- **Browse and play** your MyTube library with rating, view counts, and resume position.
- **Search and filter** videos by source, author, tags, and collection.
- **Manage collections** — create, add, remove, and delete.
- **Watch subscriptions** — see what your subscribed YouTube/Bilibili/Twitch channels are auto-downloading.
- **See download status** — pending, active, history.
- **Cast-friendly UI** with subtitles, loop, fullscreen, and variable playback speed.
- **Login protection** — supports MyTube's admin/visitor passwords and passkeys.
- **Tablet layout** — adapts for larger screens with a side menu.

---

## Requirements

Before installing the app, you need:

1. **An Android device** running Android 7.0 (Nougat, API 24) or newer.
2. **A running MyTube backend** that the device can reach over the network. See the [MyTube setup guide](https://github.com/franklioxygen/mytube#getting-started) to install it (Docker recommended).
3. **A URL pointing to that backend** — either an HTTPS public URL (e.g. via [Cloudflare Tunnel](https://github.com/franklioxygen/mytube#cloudflare-tunnel) — built into MyTube) or a LAN address like `http://192.168.1.50:5551` if you only use it on your home network.

> **Tip:** If you use MyTube's built-in Cloudflare Tunnel, you'll get a free HTTPS URL like `https://mytube.example.com` that works from anywhere. That's the simplest path for using this app outside your home Wi-Fi.

---

## Install

1. Download the latest APK from the [Releases page](https://github.com/franklioxygen/mytube-android/releases).
2. On your Android device, open the file and tap **Install**. You may need to allow installation from unknown sources for your browser or file manager.
3. Open **MyTube** from your app drawer.

> Google Play distribution is not currently available. The app is installed by sideloading the signed APK.

---

## First-time setup — connect to your MyTube backend

When you launch the app for the first time you'll see the **Backend URL** screen. This is where you point the app at your MyTube server.

1. Enter the URL of your MyTube backend.
   - **HTTPS public URL** (recommended): `https://mytube.example.com`
   - **Local network**: `http://192.168.1.50:5551` (replace with your server's LAN IP and port)
   - Do **not** include a trailing `/api` — the app appends that for you.
2. Tap **Test connection**. A green check means the server is reachable.
3. Tap **Save**. You'll be taken to the login screen (if your MyTube has login protection enabled) or directly to the library.
4. Log in with the admin or visitor password set in your MyTube settings, or use a registered passkey.

You can change the backend URL later by clearing the app's data, or via the in-app settings (depending on your MyTube role).

---

## Documentation

- [Setup guide](documents/setup.md) — full step-by-step for installing the app and connecting to MyTube.
- [Build from source](documents/build-from-source.md) — for developers and contributors.
- [Troubleshooting](documents/troubleshooting.md) — common issues and fixes.

---

## Build from source

If you'd rather build the APK yourself or contribute:

```sh
git clone https://github.com/franklioxygen/mytube-android.git
cd mytube-android
npm install
npm run android   # boots Metro and installs on a connected device/emulator
```

See [documents/build-from-source.md](documents/build-from-source.md) for prerequisites (Node, JDK 21, Android SDK), per-machine configuration (the `nodeBinary` gradle property for Android Studio launches), and how to produce a release APK.

---

## Related projects

- **[MyTube](https://github.com/franklioxygen/mytube)** — the backend + web frontend this app talks to. Self-hosted, Docker-ready, open source.
- **[MyTube Chrome extension](https://github.com/franklioxygen/mytube/tree/master/chrome-extension)** — queue downloads from any browser tab.

## License

See [LICENSE](LICENSE) in the repository root.
