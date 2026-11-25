# Sylvi

Browser-based ID photo sheet layout tool for print shops. Lay out 1x1, 2x2, passport, and custom ID photo packages onto standard photo or bond paper and print them at true size—without manually formatting sheets in Word. Built for print shops in the Philippines.

Upload or paste a customer's photo, pick a package, choose your paper, and download a print-ready PDF, PNG, or JPG with cut guides, or print straight from the browser.

## Features

- **100% browser-based & private:** Customer photos never leave the shop's computer (friendly to RA 10173 / Data Privacy Act compliance). Layout, face detection, cropping, color adjustments, and file export all run locally.
- **On-device auto-crop:** Uses MediaPipe face detection (loaded on first photo and cached for offline use) to frame each size to its target head ratio, with manual crop adjustment and automatic plain-backdrop edge fill. If no face is detected, the photo is centered.
- **Image adjustments:** Per-photo brightness, contrast, saturation, warmth, and sharpness controls.
- **Straight-cut guillotine packing:** Automatically packs one or multiple customers onto a sheet using edge-to-edge cuts that separate cleanly on a paper trimmer.
- **Built-in & custom packages:** Ships with standard print-shop packages (Packages A–D and whole-sheet fills) plus custom package creation.
- **True-size export & printing:** Generates exact-dimension PDFs (in points), 300 DPI PNG/JPG files (bundled as a ZIP for multi-sheet image exports), or prints directly from the browser. Includes crop marks, cut lines, or white borders, plus an optional 1-inch calibration check line.
- **Offline PWA:** Works offline after the first visit and can be installed as a standalone app that opens directly into the workspace (`/app/`).
- **Optional shop accounts:** Runs with zero backend setup as a guest app. When configured with Supabase, shops can sign in via Google or email link to sync custom packages, shop details, and settings across computers (never customer photos).

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite 8 (multi-entry build: `/` landing page, `/app/` workspace) |
| **State & Local Storage** | Zustand, IndexedDB (`idb-keyval`) |
| **On-Device Face Detection** | MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) with self-hosted WASM runtime & `blaze_face_short_range.tflite` |
| **Export & Packaging** | `pdf-lib` (vector PDF generation), HTML5 Canvas 2D + custom 300 DPI PNG/JPG metadata injection, `fflate` (ZIP bundling) |
| **Offline / PWA** | `vite-plugin-pwa`, custom Workbox service worker (`src/sw.ts`) |
| **UI, Motion & Fonts** | Motion, GSAP, Lucide React, Hugeicons, React Bits components, Geist & Schibsted Grotesk variable fonts |
| **Optional Cloud Sync** | Supabase (`@supabase/supabase-js`, PostgreSQL with RLS, Google OAuth & email OTP) |
| **Testing** | Vitest, jsdom, PostgreSQL sync verification suite (`supabase/tests/`) |

## Requirements

- **Node.js:** `24.15.0+` (recommended), `22.22.2+` (22.x), or `26.0.0+` — defined in `package.json` (`engines.node`). Node 20 is not supported by the installed test tooling.
- **npm:** Bundled with Node.js (uses `package-lock.json`).
- **Browser:** Any modern desktop or mobile browser with HTML5 Canvas, WebAssembly, and IndexedDB support.
- **Optional (only for shop accounts):** A [Supabase](https://supabase.com) project, plus a [Google Cloud](https://console.cloud.google.com) OAuth client if enabling Google sign-in.

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/Llenoxinn/sylvi.git
cd sylvi

# 2. Install exact dependencies
npm ci

# 3. (Optional) Configure environment variables for shop accounts
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

Open:
- Landing page: `http://localhost:5173/`
- Photo layout tool: `http://localhost:5173/app/`

> **Note:** `predev` and `prebuild` automatically run `scripts/copy-mediapipe.mjs` to copy the MediaPipe WASM runtime from `node_modules` into `public/mediapipe/` so face detection works offline with no third-party CDN dependency.

## Commands

| Command | Description |
| --- | --- |
| `npm ci` | Install exact locked dependencies |
| `npm run dev` | Copy MediaPipe WASM assets and start the Vite dev server (`/` and `/app/`) |
| `npm run build` | Copy MediaPipe WASM assets, run TypeScript build checks (`tsc -b`), and create a production build in `dist/` |
| `npm run preview` | Locally preview the production build from `dist/` |
| `npm test` | Run the Vitest test suite (layout packer, image loading, export, storage, security, and cloud sync) |
| `npm run typecheck` | Run TypeScript checks across the app, Vite config, and service worker (`tsc -b`) |

## Built-In Sizes, Packages & Papers

- **Photo sizes:** `1x1` (1×1 in), `2x2` (2×2 in), `Passport` (35×45 mm), `1.5x1.5`, `2x2.5`, and custom sizes (1–300 mm).
- **Starter packages:**
  - **Package A:** 2 × `2x2`, 7 × `1x1`
  - **Package B:** 4 × `2x2`, 8 × `1x1`
  - **Package C:** 4 × `Passport`, 6 × `1x1`
  - **Package D:** 8 × `Passport`
  - **Whole sheet 1x1** / **Whole sheet 2x2** (fills remaining space on the sheet)
- **Paper sizes:** `3R` (3.5×5 in), `4R` (4×6 in), `5R` (5×7 in), `A4` (210×297 mm), `Short bond` (8.5×11 in / Letter), `Long bond` (8.5×13 in), and custom paper (up to 500 mm), with `auto`, `portrait`, or `landscape` orientation and adjustable margins.

## How It Works & Input Limits

- **Local-only image processing:** Photos are never uploaded to any server. Everything runs directly in the browser.
- **On-demand face model:** The MediaPipe face detector (~4 MB compressed) loads the first time a photo is added and is cached by the service worker (`sylvi-face-model`) for offline reuse.
- **True-size printing:** PDFs use exact paper dimensions in points; PNG and JPG exports embed 300 DPI metadata. Always print at **Actual size (100%)** (disable "Fit to page" in the print dialog).
- **Recent jobs:** The last 2 downloaded or printed jobs are stored locally in IndexedDB for 24 hours by default. Expired jobs are cleaned up while Sylvi runs or when it next opens. Original files and downloaded exports are untouched. Recent jobs are shared by everyone using the same browser profile.
- **Input limits:**
  - Formats: `JPG`, `PNG`, `WebP`
  - Max file size: `25 MB` per photo
  - Max resolution: `40 megapixels` (dimensions are checked before decoding; photos decode at a max edge of `3,200 px`)
  - Per job: up to `20 photos` and `2,000 layout copies` (`200` copies per package item, `20` items per package)

## Environment Variables

Environment variables are **optional**. Without them, Sylvi runs completely as a guest app and hides sign-in controls. Copy `.env.example` to `.env.local` to enable shop accounts:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Optional | Your Supabase publishable key (`sb_publishable_…`) or legacy anon key |

> **Security:** Never put a Supabase `service_role` or secret key in `VITE_*` variables—they are bundled into client-side code and visible to every visitor.

## Shop Accounts (Optional)

Signed-in shops sync only their custom packages, settings, and shop details (name, mobile number, city) across computers via Google sign-in or an emailed magic link. Customer photos remain strictly on each device.

### 1. Set up Supabase

1. Create a [Supabase](https://supabase.com) project.
2. Run the SQL migrations in `supabase/migrations/` in order in the Supabase SQL Editor:
   - `0001_shop_accounts.sql`
   - `0002_grant_api_access.sql`
   - `0003_safe_package_sync.sql`
   - `0004_safe_settings_sync.sql`
   
   Existing projects only need unapplied migrations. Apply `0004` before deploying to prevent delayed settings uploads from overwriting newer shop settings.
3. In **Authentication → URL Configuration**, set **Site URL** to your production domain and add `http://localhost:5173/app/` and `https://<your-domain>/app/` to **Redirect URLs**.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (found under the dashboard's **Connect** button).

### 2. Enable Google Sign-In (Optional)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project and configure **Google Auth Platform** (OAuth consent screen): External audience, app name `Sylvi`, and your support email. Only the default `email`, `profile`, and `openid` scopes are required.
2. Create an OAuth 2.0 client of type **Web application**:
   - **Authorized JavaScript origins:** `http://localhost:5173` and `https://<your-domain>`
   - **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback` (exact URL shown in Supabase's Google provider settings)
3. In Supabase, open **Authentication → Sign In / Providers → Google**, enable it, and enter the Client ID and Client Secret.
4. While the Google OAuth app is in **Testing**, only listed test users can sign in. Publish the app (requires home page and privacy policy links) to allow any shop to sign in.

### 3. Database Verification & Sync Behavior

- **Verify sync guards & isolation:** Run `supabase/tests/shop_settings_sync.sql` as `postgres` after all migrations in a disposable Supabase test database. The script rolls back its changes and raises an error if any check fails.
- **Account isolation & retries:** Browser caches are scoped by authenticated user ID. Guest packages stay in their own cache and are not auto-uploaded into a shop account. Failed syncs stay visible in **Settings** and retry automatically on reconnect, focus return, or **Retry sync** (including package deletions).
- **Legacy storage compatibility:** Earlier versions stored unscoped `sylvi:settings` and `sylvi:packages` keys in browser storage. This version leaves them untouched for manual recovery and never attaches them to a signed-in account. Recent jobs created by this version embed their package snapshot so later package edits do not break reprints.

## Deployment

`npm run build` outputs a static multi-page site to `dist/` (landing page at `/`, workspace at `/app/`).

Deploy `dist/` to any static host such as **Netlify**, **Vercel**, or **Cloudflare Pages**:
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node version:** `22.22.2+`, `24.15.0+`, or `26+`
- **Environment variables:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your host's settings only if you want shop accounts enabled.

## Project Structure

```text
.
├── index.html                  # Landing page entry (/)
├── app/index.html              # Workspace app entry (/app/)
├── public/
│   ├── favicon.svg             # App & PWA icon
│   ├── landing/                # Landing page imagery
│   └── models/                 # Local MediaPipe BlazeFace TFLite model
├── scripts/
│   └── copy-mediapipe.mjs      # Copies MediaPipe WASM assets into public/mediapipe/
├── src/
│   ├── landing/                # Marketing landing page & interactive sheet demo
│   ├── components/             # Workspace UI, crop editor, print bar, React Bits components
│   ├── state/                  # Zustand store, layout and export hooks
│   ├── lib/
│   │   ├── layout/             # Guillotine packer, package expansion, crop-mark geometry
│   │   ├── image/              # Photo loading, face detection, crop math, backdrop fill, adjustments
│   │   ├── export/             # PDF / PNG / JPG / ZIP export, 300 DPI metadata, browser printing
│   │   ├── storage/            # Settings, custom packages, recent jobs (IndexedDB)
│   │   └── cloud.ts            # Optional Supabase auth & sync client
│   ├── styles/                 # Design tokens, base styles, transitions, workspace styles
│   └── sw.ts                   # Custom Workbox PWA service worker
├── supabase/
│   ├── migrations/             # Ordered PostgreSQL schema & RLS migrations (0001–0004)
│   └── tests/                  # Database sync guard & account isolation SQL tests
└── docs/
    └── DESIGN.md               # Visual & interaction design specification
```
