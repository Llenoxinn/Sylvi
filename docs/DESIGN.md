# Sylvi design decisions

Decisions agreed with the project owner on 2026-10-18. The formal written spec and plan review were skipped at the owner's request, so this file is the record.

## Product

- **Name:** Sylvi. Ricus is the owner's character; the UI is deliberately *not* soil- or garden-themed.
- **Job:** replace formatting ID photo sheets by hand in Word. Upload a photo, pick a package, paper and file format, get a print-ready sheet with cut guides.
- **Audience:** anyone, mainly people running print shops in the Philippines. 1x1 and 2x2 are inches; passport is 35 × 45 mm.

## Scope (v1)

| Area | Decision |
| --- | --- |
| Platform | Website running entirely in the browser (Vite + React + TypeScript), installable, offline after first visit |
| Paper | User picks: 3R, 4R, 5R, A4, Short bond (Letter), Long bond (8.5 × 13 in), or custom. Orientation auto/portrait/landscape, adjustable margin (photo paper defaults to borderless) |
| Layouts | One photo many copies, mixed sizes from one photo, and several customers on one sheet. Overflow goes to extra sheets |
| Packages | Built-in A–D (from the owner's reference menu) plus "whole sheet" fills; shops can create, edit and delete their own |
| Photo editing | Automatic face-based crop, then optional drag/zoom crop, brightness, contrast, sharpness |
| Cut guides | Default crop marks; alternatives are thin cut lines or a white border. Optional 1-inch check line |
| Export | PDF, PNG, JPG at 300 DPI; print via the browser dialog at Actual size |
| Accounts | Optional sign-in (Supabase magic link) syncing custom packages and settings only |
| Recent jobs | Last 2 jobs, on the device only (customer photos are personal data under RA 10173), auto-delete after 24 h by default; shops can choose 1 h / 12 h / 24 h / 7 days |

Out of scope for v1: background removal/replacement, and the borderless printer-driver workaround (an OS printer setting, not something the app controls).

## Layout engine

Guillotine shelf packing (`src/lib/layout/pack.ts`): photos are laid in shelves of one size spanning their region, biggest first, and the leftover end of each shelf is packed recursively with smaller photos. Every split runs edge to edge, so sheets can always be cut with straight trimmer cuts. Auto orientation tries both and keeps the one with fewer sheets.

## Visual direction

- The sheet preview is the hero: it sits on a cutting-mat green with an inch (or centimetre) grid and rulers at the sheet's true scale.
- Everything else is quiet: cool off-white panels, near-black ink, and process magenta (from CMYK) only for the main action, selection and marks.
- Type: Schibsted Grotesk, self-hosted for offline use.
- Motion is limited to moments that explain a change: photos gliding when the layout re-packs, the scan line while a face is being found and the fade when the crop lands, dialog and toast entrances. Everything respects reduced motion.
