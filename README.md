# Tessera

Seamless, borderless photo collages tuned for sharing. Drop in dozens of event
photos, arrange them by hand or with AI, drop in a title that the photos rearrange
around, and export in any social aspect ratio.

A _tessera_ is a single tile in a mosaic, which is what each photo becomes.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # layout engine, crop math, carousel distribution
npm run build        # production build
```

## What it does

- **Up to 50 photos**, packed seamlessly with zero gaps.
- **Three layouts:** Mosaic (sizes cells by orientation), Grid (square mode), and
  Spotlight (a preset hero template). Single frame by default.
- **Spacing control:** a slider adds uniform gaps between and around the photos
  (matted-print look), with a choice of gap color (paper, white, or ink). Zero by
  default for a fully seamless collage.
- **HEIC support:** iPhone photos (HEIC/HEIF) are decoded automatically; any file
  that genuinely can't be read is reported instead of silently dropped.
- **Face-aware cropping** so filling a cell never slices off heads. Click any photo
  on the canvas and drag to set its focus.
- **Reorder** by dragging thumbnails, by one-click AI suggestion, or by chatting a
  style ("group shots first, then close-ups").
- **Text** as a tile the photos reflow around, or as a draggable overlay.
- **Carousel mode** splits a large set across slides so faces stay legible on
  LinkedIn; export as multiple images or one PDF.
- **Export** to 1:1, 4:5, 5:4, 9:16, or 16:9 as PNG (lossless) or JPG, at up to 2x
  resolution.
- **Autosave** to IndexedDB so a refresh never loses work. Works on desktop and mobile.

## AI (bring your own key)

The AI stylist uses your own OpenAI key, entered in the AI panel and stored only in
your browser (localStorage), sent directly to OpenAI and never to any server here.
Photos are analyzed once on upload (colour, light, faces, vibe) and cached; reorders
then run on that cached metadata, so they stay fast and cheap with 40+ photos. The
provider lives behind an interface (`lib/ai/provider.ts`) so another OpenAI-compatible
endpoint can be swapped in.

## Architecture

- `lib/layout/engine.ts` — pure layout: aspect ratios + frame -> normalized rects.
- `lib/layout/crop.ts` — face-aware cover-crop math (preview + export share it).
- `lib/layout/distribute.ts` — carousel slide splitting.
- `lib/layout/slide.ts` — builds a slide's item list (photos + tile text).
- `lib/image/pipeline.ts` — off-thread decode, downscaled previews, focal detection.
- `lib/export/render.ts` — re-renders the exact rects to a high-res canvas, then PNG/JPG/PDF.
- `lib/persist/db.ts` — IndexedDB autosave/restore.
- `lib/store.ts` — Zustand store and types.
- `components/` — Canvas, Tray, Inspector, TextEditor, ChatPanel, Toolbar.

Design notes: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Performance

Originals are never rendered during editing. Each photo is decoded off the main
thread and downscaled to a ~1000px preview; full-resolution bytes are touched only at
export time. That keeps the editor smooth with 40-plus images.
