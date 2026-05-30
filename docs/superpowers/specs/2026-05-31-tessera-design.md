# Tessera — Design Spec

_Date: 2026-05-31_

A browser-based collage maker for assembling many event photos (mostly phone selfies with people) into seamless, borderless collages tuned for LinkedIn. Bring-your-own-key AI reorders and restyles the set; everything runs client-side.

A _tessera_ is a single tile in a mosaic, which is what each photo becomes.

## Goals

- Compose collages from up to 50 images (typically 30–40), seamless with zero borders.
- Handle mixed-orientation phone photos (mostly vertical selfies) without slicing off faces.
- Stay smooth and lag-free with 40+ images, including on mobile.
- Export to fixed aspect ratios (1:1, 4:5, 5:4, 9:16, 16:9) as PNG or JPG at high resolution.
- Avoid cramming many faces into one frame: single frame by default, with carousel and legibility-floor options for LinkedIn.
- Reorder photos manually (drag and drop), by one-click AI suggestion, and by freeform chat ("make it warm and candid").
- Add text that photos reflow around, or that floats on top.
- Auto-save so a refresh never loses work.
- Work well on both desktop and mobile.

## Non-goals (v1)

- No accounts, no server-side storage, no multi-user. Everything is local to the browser.
- No multi-project library or cloud sync; one active project, with "start new" and autosave.
- No image editing beyond crop-to-fill and focal point (no filters, brightness, retouch).
- No video.
- No provider beyond OpenAI wired up initially, though the provider layer is swappable.

## Brand identity

- **Name:** Tessera.
- **Palette:** warm paper `#F4F1EA` background, charcoal ink `#1A1A1A` text, single clay/terracotta accent `#C75B39`. No purple, no multicolor translucents, no emoji, no em dashes in UI copy.
- **Type:** Fraunces (editorial serif) for display/wordmark; Inter (grotesque sans) for UI.
- **Tone:** editorial, warm, human, crafted. Not a generic SaaS dashboard.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS.
- Built as a client-side editor (most logic in client components) so it can deploy static/serverless.
- State: Zustand store.
- Drag and drop: dnd-kit.
- Persistence: IndexedDB (via `idb`).
- AI: OpenAI JS SDK called directly from the browser with a user-supplied key (`dangerouslyAllowBrowser`), behind a provider interface. An optional Next.js API route can proxy later, but v1 calls direct.

## Architecture

The system is built around three pure, independently testable modules plus a UI shell and an AI layer.

### Data model

```
Project {
  id
  frame: { ratio: '1:1'|'4:5'|'5:4'|'9:16'|'16:9' }
  mode: 'mosaic'|'grid'|'preset'
  presetId?: string
  density: number            // target tiles-per-area / face-size knob
  legibilityFloor: boolean    // enforce minimum face size, spill overflow
  output: 'single'|'carousel'
  slides: Slide[]             // length 1 when single
  textBlocks: TextBlock[]
}
Slide { id, photoIds: string[] }     // ordered
Photo {
  id
  blob: Blob                 // original, used only at export
  previewBitmap: ImageBitmap // downscaled (~1000px longest side)
  width, height              // natural dimensions
  focalPoint: { x, y }       // 0..1, face-aware
  meta?: PhotoMeta           // cached AI/vision analysis
}
PhotoMeta {
  dominantColors: string[]
  brightness: number
  orientation: 'portrait'|'landscape'|'square'
  faceCount: number
  vibeTags: string[]
}
TextBlock {
  id
  content
  placement: 'tile'|'overlay'   // default 'tile'
  // tile: occupies a cell the layout reflows around
  // overlay: absolute position + optional scrim
  position?: { x, y }           // overlay only, 0..1
  cellWeight?: number           // tile only, relative size
  style: { font, size, align, color, scrim }
}
```

### Module 1: Layout engine (pure)

`computeLayout(items, frameRatio, mode, density, presetId?) -> Rect[]`

- `items` are photo aspect ratios plus any tile-placement text blocks.
- Returns normalized rectangles `{ x, y, w, h }` in 0..1, one per item, covering the frame with no gaps.
- Algorithms:
  - **Mosaic** (default): row/partition packing that balances cell sizes and honors orientation (portrait photos tend to portrait cells). Tunable by `density`.
  - **Grid**: uniform equal cells (square mode).
  - **Preset**: named fixed templates (hero + strip, 2x2 feature, etc.) selected by photo count bucket.
- Deterministic: identical inputs produce identical rects, so preview and export match exactly.
- A text block in `tile` placement is just another item occupying a cell; the engine reflows photos around it.

### Module 2: Image pipeline

- On upload: read File, decode with `createImageBitmap` inside a Web Worker, produce a downscaled preview bitmap (~1000px longest side) for editing; retain the original blob for export only.
- Focal point: detect a face box with the browser `FaceDetector` API where available; otherwise center, or override from AI meta. Stored as `focalPoint`, used to set `object-position` so cropping never cuts off faces.
- Memory hygiene: revoke object URLs and close bitmaps when photos are removed; virtualize the tray.

### Module 3: Carousel distribution (pure)

`distribute(orderedPhotoIds, perSlide) -> Slide[]`

- Splits the ordered set across slides honoring a per-slide count.
- Used by carousel mode and by the legibility floor (overflow that won't fit at the minimum face size spills into an extra slide).

### AI layer

- Provider interface (`analyze`, `suggestOrder`, `chatReorder`) with an OpenAI implementation.
- On upload (optional, requires key): batched vision analysis produces `PhotoMeta`, cached in IndexedDB keyed by a content hash so re-uploads are free.
- **Suggest** and **chat** operate on cached `PhotoMeta` only (cheap, fast), returning a new photo order and optional layout/style hints; they do not re-send images. Vision is only used for the initial per-photo analysis.
- Key stored in `localStorage`; entered in Settings; never transmitted anywhere except OpenAI.

### Rendering

- **Editor:** absolutely-positioned DOM tiles using layout rects scaled to the on-screen frame, `object-fit: cover` with `object-position` from focal point. DOM gives crisp text and easy drag interaction.
- **Export:** the same rects are drawn onto an offscreen `<canvas>` at target resolution using full-res decoded images and crop math, then `canvas.toBlob` to PNG or JPEG. Carousel/PDF export loops slides.

## Features

### Composition

- Modes: Mosaic (default), Grid (square mode), Presets, plus Auto/Suggest.
- Single frame by default. Carousel mode and legibility floor available as options.
- Face-aware crop on every tile.

### Reordering

- Manual drag and drop in tray and on tiles (dnd-kit).
- One-click AI Suggest for visual flow.
- Chat panel for freeform restyle requests.

### Text

- Default placement is `tile` (photos reflow around it). Toggle to `overlay` (draggable, optional scrim).
- Style controls: font (brand set), size, alignment, color (ink/paper), scrim on/off.

### Export

- Ratios: 1:1, 4:5, 5:4, 9:16, 16:9.
- Format: PNG (default, lossless) or JPG (quality slider).
- Resolution: LinkedIn-tuned targets (e.g. 4:5 -> 1080x1350) with a 2x quality multiplier.
- Carousel: multiple PNGs or a single carousel PDF.

### Persistence & responsive

- Autosave project (photos as blobs + state) to IndexedDB; restore on load; "start new" clears.
- Desktop: three-pane layout (tray · canvas · inspector/chat).
- Mobile: canvas on top, bottom-sheet tabs for tray/chat/inspector, touch drag.

## Error handling

- Missing/invalid API key: AI actions disabled with an inline prompt to add a key; manual editing fully works without it.
- AI request failure or rate limit: surface a non-blocking error, keep current order; retry available.
- Unsupported/corrupt image: skip with a per-file notice, continue with the rest.
- `FaceDetector` unavailable: silently fall back to center/AI focal point.
- IndexedDB unavailable or quota exceeded: warn that autosave is off; editing still works in-memory.
- Export memory pressure with large sets: cap export multiplier and process canvas draws sequentially.

## Testing

- Layout engine: unit tests for coverage (no gaps, in-bounds rects), determinism, orientation handling, density response.
- Crop math: focal-point-to-`object-position` and canvas crop produce expected source rectangles.
- Carousel distribution: correct counts, ordering preserved, overflow behavior.
- Export: assert canvas dimensions per ratio/multiplier and sample pixels to confirm seamless coverage.
- Store actions: add/remove/reorder photos, mode switches, text placement toggles.

## Open implementation notes

- Pick exact preset templates per photo-count bucket during implementation.
- Confirm OpenAI vision model and batching strategy for cost at analysis time.
- `.superpowers/` is git-ignored (brainstorm artifacts).
