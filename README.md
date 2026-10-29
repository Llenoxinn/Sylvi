# Sylvi

Lay out ID photo packages (1x1, 2x2, passport and custom sizes) and print them at true size, without formatting anything in Word. Built for print shops in the Philippines.

Upload or paste a photo, pick a package on the wheel, pick the paper, and download a PDF, PNG or JPG with crop marks, or print straight away.

## Run it

```bash
npm ci
npm run dev        # landing page at http://localhost:5173, the tool at /app/
npm test           # layout, image loading, export, storage and account-sync tests
npm run typecheck  # TypeScript checks for the app, build config and service worker
npm run build      # production build in dist/
```

Use Node 24.15 or newer in the 24.x line. Node 22.22.2+ and 26+ are also supported; the installed test tools no longer support Node 20.

## How it works

- **Everything happens in the browser.** Photos are never uploaded. Layout, cropping, adjustments and PDF creation all run on the shop's computer.
- **Auto-crop** uses MediaPipe's face detector, loaded the first time a photo is added (about 4 MB compressed, then cached for offline use). If no face is found, the photo is centered.
- **True size.** PDFs are created at the exact paper size in points; PNG and JPG files carry 300 DPI metadata. Remind customers and staff to print at **Actual size (100%)**.
- **Straight cuts.** The packer only makes layouts that can be separated with edge-to-edge cuts on a trimmer.
- **Recent jobs.** The last 2 downloaded or printed jobs stay in this browser (IndexedDB) for 24 hours by default. Expired copies are removed while Sylvi runs or when it next opens. Original photos and downloads are kept. Recent jobs are shared by everyone using this browser profile.
- **Input limits.** JPG, PNG and WebP photos up to 25 MB and 40 megapixels; up to 20 photos and 2,000 layout copies per job. Dimensions are checked before decoding and photos are decoded at a maximum edge of 3,200 pixels.
- **Works offline** after the first visit (installable as an app).

## Shop accounts (optional)

Without configuration Sylvi runs as a guest app and the sign-in button is hidden. Signed-in shops sync their custom packages, settings and shop details (name, mobile number, city) across computers. Shops sign in with Google, or with an emailed link.

1. Create a [Supabase](https://supabase.com) project.
2. Run the SQL files in `supabase/migrations/` in order, from `0001_shop_accounts.sql` through `0004_safe_settings_sync.sql`, in its SQL editor. Existing projects need only the migrations they have not already applied. Apply `0004` before deploying this version to prevent delayed settings uploads from overwriting newer shop settings.
3. In Authentication → URL Configuration, set the Site URL to your domain and add `http://localhost:5173/app/` and `https://<your-domain>/app/` to the redirect URLs.
4. Copy `.env.example` to `.env.local` and fill in the project URL and the publishable key (`sb_publishable_…`, or the legacy anon key), both shown under the dashboard's Connect button. Never use the secret or service_role key: `VITE_` variables are visible to every visitor.

Google sign-in:

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then set up Google Auth Platform (the OAuth consent screen): External audience, app name Sylvi, your support email. Only the default `email`, `profile` and `openid` scopes are needed.
2. Create an OAuth client of type Web application. Add `http://localhost:5173` and your domain to Authorized JavaScript origins, and `https://<project-ref>.supabase.co/auth/v1/callback` to Authorized redirect URIs (Supabase shows this exact URL on its Google provider page).
3. In Supabase, go to Authentication → Sign In / Providers → Google, turn it on, and paste the client ID and secret.
4. While the Google app is in Testing, only the test users you list can sign in. Publish it to let any shop sign in. Google asks for a home page and privacy policy link.

Only packages, settings and shop details are synced. Customer photos stay on each computer.

To check the database sync guard and account isolation, run `supabase/tests/shop_settings_sync.sql` as `postgres` after all migrations in a disposable Supabase test database. The test rolls back its changes and raises an error if a check fails.

Account caches are separated by the authenticated user ID. Guest packages stay in their own browser cache and are not automatically uploaded into a shop account. Sync failures remain visible in Settings; reconnecting, returning to Sylvi, or **Retry sync** retries pending changes, including package deletions.

Earlier versions used unscoped `sylvi:settings` and `sylvi:packages` browser-storage keys. These have no reliable owner, so this version leaves them intact for manual recovery and never assigns them to a signed-in account. Synced packages return from the shop account. Recent jobs created by this version store their package contents so reprints are unaffected by later package edits; older jobs show a warning or refuse to reopen if their original package was deleted.

## Deploy

`npm run build` produces a static site in `dist/`. Host it on any static host (Netlify, Vercel, Cloudflare Pages). Add the two `VITE_SUPABASE_*` variables in the host's settings if you use accounts.

## Project layout

```
src/lib/layout     guillotine packer, package expansion, crop-mark geometry
src/lib/image      photo loading, face detection, crop maths, adjustments
src/lib/export     PDF / PNG / JPG export, DPI metadata, printing
src/lib/storage    settings, custom packages, recent jobs
src/state          zustand store, layout and export hooks
src/components     UI, including React Bits OptionWheel and Dock
```
