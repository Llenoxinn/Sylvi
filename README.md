# Sylvi

Lay out ID photo packages (1x1, 2x2, passport and custom sizes) and print them at true size, without formatting anything in Word. Built for print shops in the Philippines.

Upload or paste a photo, pick a package on the wheel, pick the paper, and download a PDF, PNG or JPG with crop marks, or print straight away.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # layout engine, crop, DPI and guide tests
npm run build      # production build in dist/
```

Requires Node 20 or newer.

## How it works

- **Everything happens in the browser.** Photos are never uploaded. Layout, cropping, adjustments and PDF creation all run on the shop's computer.
- **Auto-crop** uses MediaPipe's face detector, loaded the first time a photo is added (about 4 MB compressed, then cached for offline use). If no face is found, the photo is centered.
- **True size.** PDFs are created at the exact paper size in points; PNG and JPG files carry 300 DPI metadata. Remind customers and staff to print at **Actual size (100%)**.
- **Straight cuts.** The packer only makes layouts that can be separated with edge-to-edge cuts on a trimmer.
- **Recent jobs.** The last 2 downloaded or printed jobs stay in this browser (IndexedDB) for 24 hours by default, then delete themselves.
- **Works offline** after the first visit (installable as an app).

## Shop accounts (optional)

Without configuration Sylvi runs as a guest app and the sign-in button is hidden. To let shops sync their custom packages and settings across computers:

1. Create a [Supabase](https://supabase.com) project.
2. Run `supabase/migrations/0001_shop_accounts.sql` in its SQL editor.
3. In Authentication, enable email sign-in (magic link) and add your site URL to the redirect URLs.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.

Only packages and settings are synced. Customer photos stay on each computer.

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
