# Settings Dictionary (`/api/settings`)

This file defines the current backend contract for settings fields.

## 1. Endpoint Basics

- Read: `GET /api/settings`
- Write: `POST /api/settings` (partial update)

Response note:

- `GET /api/settings` does **not** return raw `password` / `visitorPassword`.
- It returns computed flags:
  - `isPasswordSet`
  - `isVisitorPasswordSet`

## 2. Access Control Summary

- `admin`: full read/write for whitelisted settings.
- `visitor`:
  - `GET /api/settings` allowed.
  - `POST /api/settings` allowed only when body contains only:
    - `cloudflaredTunnelEnabled`
    - `cloudflaredToken`
- unauthenticated:
  - if `loginEnabled=true`: blocked for `/api/settings`.
  - if `loginEnabled=false`: allowed.

## 3. Validation and Normalization Rules

- `maxConcurrentDownloads < 1` -> normalized to `1`.
- `websiteName` max length `15` (truncated).
- `itemsPerPage < 1` -> normalized to `12`.
- `defaultSort` must be one of:
  - `dateDesc`, `dateAsc`, `viewsDesc`, `viewsAsc`, `nameAsc`, `videoDateDesc`, `videoDateAsc`, `random`
  - invalid value -> `dateDesc`
- `tags` must be unique case-insensitively.
- `password` / `visitorPassword` are hashed before storage when provided.
- Unknown keys are ignored by backend whitelist.

## 4. Field Dictionary

`R/W` column values:

- `admin RW`: admin read/write
- `visitor R`: visitor read-only
- `visitor RW*`: visitor write only under Cloudflare-only body rule
- `computed`: response-only field, not writable

## 4.1 Auth and Access

| Field | Type | Unit / Format | Default | Impact Scope | R/W | Notes |
|---|---|---|---|---|---|---|
| `loginEnabled` | boolean | flag | `false` | global auth gate | admin RW, visitor R | When true, unauthenticated access is blocked for non-public routes. |
| `password` | string | plain text on write, hashed at rest | `""` | admin login | admin RW, visitor R (not returned) | Empty/omitted write keeps existing hash. |
| `isPasswordSet` | boolean | flag | computed | login UI | computed | True when admin password hash exists. |
| `passwordLoginAllowed` | boolean | flag | implicit `true` | password login flow | admin RW, visitor R | `false` disables password login paths. |
| `allowResetPassword` | boolean | flag | implicit `true` | reset-password endpoint and login UI | admin RW, visitor R | `false` blocks reset flow. |
| `visitorUserEnabled` | boolean | flag | implicit `true` | visitor login availability | admin RW, visitor R | Controls visitor account login. |
| `visitorPassword` | string | plain text on write, hashed at rest | unset | visitor login secret | admin RW, visitor R (not returned) | Empty/omitted write keeps existing hash. |
| `isVisitorPasswordSet` | boolean | flag | computed | login UI | computed | True when visitor password hash exists. |

## 4.2 Playback and Download Behavior

| Field | Type | Unit / Format | Default | Impact Scope | R/W | Notes |
|---|---|---|---|---|---|---|
| `defaultAutoPlay` | boolean | flag | `false` | player default | admin RW, visitor R | Frontend autoplay default. |
| `defaultAutoLoop` | boolean | flag | `false` | player default | admin RW, visitor R | Frontend loop default. |
| `pauseOnFocusLoss` | boolean | flag | `false` | player behavior | admin RW, visitor R | Pause video when window loses focus. |
| `playFromBeginning` | boolean | flag | `false` | player start position | admin RW, visitor R | If true, ignores saved progress on open. |
| `subtitlesEnabled` | boolean | flag | `true` | subtitle UI default | admin RW, visitor R | Default subtitle enable state. |
| `preferredAudioLanguage` | string | language code (for yt-dlp format preference) | unset | YouTube/Bilibili download format selection | admin RW, visitor R | Used to bias audio language in yt-dlp format expression. |
| `maxConcurrentDownloads` | number | count | `3` | queue throughput and task slot wait | admin RW, visitor R | Min value normalized to `1`. |
| `dontSkipDeletedVideo` | boolean | flag | unset (`false` behavior) | de-dup and re-download behavior | admin RW, visitor R | If true, previously deleted source videos are auto re-downloadable. |
| `ytDlpConfig` | string | multiline yt-dlp options text | unset | downloader behavior | admin RW, visitor R | Parsed into flags; network options propagated to calls. |
| `proxyOnlyYoutube` | boolean | flag | unset (`false`) | downloader network behavior | admin RW, visitor R | When true, parsed proxy from `ytDlpConfig` is only applied to YouTube URLs. |
| `playSoundOnTaskComplete` | string | sound key | `""` | frontend UX | admin RW, visitor R | Frontend maps key to local sound file. |

## 4.3 Storage and Cloud

| Field | Type | Unit / Format | Default | Impact Scope | R/W | Notes |
|---|---|---|---|---|---|---|
| `cloudDriveEnabled` | boolean | flag | `false` | cloud upload/signing/redirect paths | admin RW, visitor R | Must be true with credentials for cloud operations. |
| `openListApiUrl` | string | URL (expected OpenList API endpoint) | `""` | cloud API calls | admin RW, visitor R | Used by cloud service config. |
| `openListToken` | string | token string | `""` | cloud API auth | admin RW, visitor R | Sensitive; currently returned by `GET /api/settings` to authenticated users. |
| `openListPublicUrl` | string | URL | `""` | cloud public redirect origin | admin RW, visitor R | Used for redirect origin allowlist checks. |
| `cloudDrivePath` | string | path string | `""` | cloud upload root path | admin RW, visitor R | Falls back to `/` in cloud config parser. |
| `cloudDriveScanPaths` | string | newline-separated absolute paths | `""` | cloud scanner include paths | admin RW, visitor R | Invalid/non-absolute lines are dropped by parser. |
| `moveSubtitlesToVideoFolder` | boolean | flag | unset (`false`) | subtitle file location and migration | admin RW, visitor R | Triggers async move job when toggled. |
| `moveThumbnailsToVideoFolder` | boolean | flag | unset (`false`) | thumbnail file location and migration | admin RW, visitor R | Triggers async move job when toggled. |
| `saveAuthorFilesToCollection` | boolean | flag | unset (`false`) | collection organization during downloads/subscriptions | admin RW, visitor R | Controls author-vs-root collection strategy. |
| `mountDirectories` | string | newline-separated absolute directories | unset | frontend scan helper state | admin RW, visitor R | Stored setting; actual scan uses request body in `/api/scan-mount-directories`. |

## 4.4 Cloudflare Tunnel and Host Allowlist

| Field | Type | Unit / Format | Default | Impact Scope | R/W | Notes |
|---|---|---|---|---|---|---|
| `cloudflaredTunnelEnabled` | boolean | flag | unset (`false`) | Cloudflared process control | admin RW, visitor RW* | May start/stop/restart tunnel service. |
| `cloudflaredToken` | string | token string | unset | Cloudflared named tunnel auth | admin RW, visitor RW* | Empty can imply quick tunnel mode. |
| `allowedHosts` | string | comma-separated hosts | unset | frontend dev server allowed hosts (`VITE_ALLOWED_HOSTS`) | admin RW, visitor R | Backend writes to `frontend/.env.local` best-effort when changed. |

## 4.5 UI and Presentation

| Field | Type | Unit / Format | Default | Impact Scope | R/W | Notes |
|---|---|---|---|---|---|---|
| `language` | string | locale code | `en` | frontend i18n | admin RW, visitor R | Global UI language preference. |
| `theme` | string | `light` \| `dark` \| `system` | `system` | frontend theme mode | admin RW, visitor R | Consumed by ThemeContext and settings UI. |
| `showThemeButton` | boolean | flag | `true` | header controls | admin RW, visitor R | Toggles theme switch button visibility. |
| `websiteName` | string | text (max 15 chars) | `MyTube` | login/header/title branding | admin RW, visitor R | Longer values are truncated server-side. |
| `homeSidebarOpen` | boolean | flag | `true` | home page layout | admin RW, visitor R | Persisted sidebar expanded/collapsed state. |
| `itemsPerPage` | number | count | `12` | pagination | admin RW, visitor R | Min value normalized to `12` fallback. |
| `infiniteScroll` | boolean | flag | `false` | home feed pagination mode | admin RW, visitor R | Disables page-size editing in UI when enabled. |
| `videoColumns` | number | count | `4` | home grid layout | admin RW, visitor R | Frontend supports typical values 2-6. |
| `showYoutubeSearch` | boolean | flag | `true` | search UI/results source mix | admin RW, visitor R | Controls whether YouTube online results are shown. |
| `defaultSort` | string | enum | `dateDesc` | default video sort order | admin RW, visitor R | Invalid value normalized to `dateDesc`. |
| `showTagsOnThumbnail` | boolean | flag | `true` | card rendering | admin RW, visitor R | Toggle tag chips overlay on thumbnails. |

## 4.6 Tags and Classification

| Field | Type | Unit / Format | Default | Impact Scope | R/W | Notes |
|---|---|---|---|---|---|---|
| `tags` | string[] | case-sensitive labels (unique case-insensitively) | unset | global tag list and editing options | admin RW, visitor R | Case-insensitive duplicates rejected. |
| `authorTags` | object | `{ [normalizedAuthor: string]: string[] }` | unset | filtering | admin RW, visitor R | Used by frontend tag filtering in author dimension. |
| `collectionTags` | object | `{ [collectionId: string]: string[] }` | unset | filtering | admin RW, visitor R | Used by frontend tag filtering in collection dimension. |

## 5. Non-Whitelisted Frontend Fields

Frontend types may include legacy/UI-only keys (for example `tmdbApiKey`, `hooks` object).  
Backend settings storage whitelist ignores unknown keys, so these are not persisted via `/api/settings`.
