// Builds the ordered item list for a slide, shared by preview and export so
// what you see is exactly what gets rendered. Tile text blocks are inserted
// into the photo sequence; overlay text blocks are returned separately.

import type { Photo, TextBlock, OutputMode } from "@/lib/store";
import { distribute } from "@/lib/layout/distribute";

export interface SlideItem {
  kind: "photo" | "text";
  id: string;
  aspect: number;
  photo?: Photo;
  text?: TextBlock;
}

export interface BuiltSlide {
  items: SlideItem[];
  overlays: TextBlock[];
}

const TEXT_TILE_ASPECT = 2.0;

export function slidesFor(order: string[], output: OutputMode, perSlide: number): string[][] {
  if (output === "single") return [order];
  return distribute(order, perSlide);
}

export function buildSlide(
  order: string[],
  photos: Record<string, Photo>,
  texts: TextBlock[],
  output: OutputMode,
  perSlide: number,
  slideIndex: number,
): BuiltSlide {
  const slides = slidesFor(order, output, perSlide);
  const ids = slides[slideIndex] ?? [];
  const items: SlideItem[] = ids
    .map((id) => photos[id])
    .filter((p): p is Photo => Boolean(p))
    .map((p) => ({ kind: "photo" as const, id: p.id, aspect: p.width / p.height || 1, photo: p }));

  // tile/overlay text live on the first slide in this prototype
  const overlays: TextBlock[] = [];
  if (slideIndex === 0) {
    for (const t of texts) {
      if (t.placement === "overlay") {
        overlays.push(t);
      } else {
        const at = Math.min(Math.max(t.tileIndex, 0), items.length);
        items.splice(at, 0, {
          kind: "text",
          id: t.id,
          aspect: TEXT_TILE_ASPECT * (t.weight || 1),
          text: t,
        });
      }
    }
  }
  return { items, overlays };
}
