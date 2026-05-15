# Setup Guide

This guide walks you through installing the MyTube Android app and connecting it to your self-hosted MyTube backend.

If you're just looking for a quick install, see the [README](../README.md#install). This doc covers each step in more detail and includes common pitfalls.

---

## Step 1 — Make sure MyTube is running

The app is a **client**. It needs a MyTube backend to talk to. If you don't have one yet:

1. Follow the [MyTube installation instructions](https://github.com/franklioxygen/mytube#getting-started). Docker is the easiest path.
2. Make sure the backend is up and reachable. Open it in a browser from any device and verify you can log in.
3. Take note of the **base URL** of your MyTube — the part before `/api`. For example:
   - `https://mytube.example.com` (if you use a domain + HTTPS)
   - `http://192.168.1.50:5551` (if you only use it on your home network)

> **Do not** include `/api` in the URL. The app adds that automatically.

---

## Step 2 — Pick a network strategy

How your phone reaches MyTube depends on where you want to use the app:

### A) Use it from anywhere (recommended)

You need an HTTPS URL that's reachable from the public internet. The two simplest options:

- **Cloudflare Tunnel** (built into MyTube) — gives you a free `https://your-name.example.com` URL with no port forwarding. See [MyTube's Cloudflare Tunnel docs](https://github.com/franklioxygen/mytube#cloudflare-tunnel).
- **Your own reverse proxy + domain** — Caddy, nginx, Traefik, etc., terminating HTTPS to MyTube.

### B) Home Wi-Fi only

Use your MyTube server's LAN IP directly: `http://192.168.X.X:5551`.

- The phone must be on the same Wi-Fi network as the MyTube server.
- This is fine for testing but won't work when you're away from home.
- HTTP is acceptable here because the traffic stays inside your LAN.

### C) Android emulator (developers)

If you're running the app in an Android emulator with MyTube on the same machine, use the special host address `10.0.2.2`:

```
http://10.0.2.2:5551
```

`10.0.2.2` is how the emulator reaches `localhost` on its host.

---

## Step 3 — Install the APK

1. Download the latest signed APK from the [Releases page](https://github.com/franklioxygen/mytube-android/releases).
2. Move the file to your Android device (USB, AirDroid, Telegram-to-self, email, whatever you use).
3. Tap the APK in your file manager. Android will prompt you to install — accept.
   - If you get "blocked by Play Protect": tap **Install anyway**.
   - If you get "install unknown apps not allowed": follow the prompt to allow your file manager or browser to install APKs, then retry.
4. Open the **MyTube** app from your home screen or app drawer.

> The APK is not on the Google Play Store. Sideloading is the only distribution channel right now.

---

## Step 4 — Connect to your backend

On first launch you'll see the **Backend URL** setup screen.

1. Enter your MyTube base URL from Step 1.
2. Tap **Test connection**.
   - **Server reachable** (green) — your URL is correct and MyTube is responding. Continue.
   - **Cannot reach server / Timed out** — see [Troubleshooting](#troubleshooting) below.
3. Tap **Save**. You're done with backend setup.

The URL is saved on the device. You won't see this screen again unless you clear the app's data.

---

## Step 5 — Log in

After saving the backend URL:

- If **password login is enabled** on your MyTube, you'll see the login screen. Enter the admin or visitor password configured in your MyTube settings.
- If **passkeys are registered** on your MyTube, tap the passkey button and authenticate with your fingerprint/face/PIN.
- If **login is disabled**, you'll go directly to the library.

Roles work the same as on the web:

- **Admin** — full read/write access.
- **Visitor** — read-only. Can browse, play, and rate, but not download/delete/edit.

---

## Troubleshooting

### Connection test fails

- Try opening your MyTube URL in your phone's browser. If that also fails, the problem is network (firewall, DNS, server down) rather than the app.
- HTTPS URL is mandatory if you're connecting over the public internet. Mixed HTTP/HTTPS will be rejected.
- For LAN URLs, make sure you're on the same Wi-Fi network as the MyTube server.
- If you self-signed a TLS certificate, Android may refuse it. Use Cloudflare Tunnel or a real certificate (Let's Encrypt) instead.

### Login fails

- The password screen has separate fields for admin and visitor — enter the password matching the role you want.
- If you forgot your password, see [MyTube's password recovery docs](https://github.com/franklioxygen/mytube/blob/master/documents/en/api-endpoints.md#password--session) — recovery is performed from the backend host.

### App crashes on startup or shows a blank screen

- Make sure your MyTube backend is on a recent version. The app expects current API contracts.
- Clear the app's data (Android Settings → Apps → MyTube → Storage → Clear data) and re-enter the backend URL.

If none of the above helps, please file an issue with your Android version, the device model, and the steps you tried.
