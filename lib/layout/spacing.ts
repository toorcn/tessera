// Uniform spacing between and around tiles, shared by preview and export so the
// gap looks identical on screen and in the exported file. spacing is 0..1.

import type { Rect } from "@/lib/layout/engine";

export type GapColor = "paper" | "white" | "ink";

export const GAP_HEX: Record<GapColor, string> = {
  paper: "#F4F1EA",
  white: "#FFFFFF",
  ink: "#1A1A1A",
};

const MAX_GAP_FRACTION = 0.06; // at spacing=1, gap is 6% of the frame width

/** Gap size in pixels for a given frame width. */
export function gapPx(spacing: number, frameW: number): number {
  return Math.max(0, Math.min(1, spacing)) * MAX_GAP_FRACTION * frameW;
}

export interface PxBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Convert a seamless normalized rect into a pixel box with uniform `gpx`
 * spacing on every edge (outer margin and interior gaps are equal). gpx=0
 * reproduces the seamless full-bleed layout exactly.
 */
export function spacedRect(r: Rect, W: number, H: number, gpx: number): PxBox {
  const innerW = W - gpx;
  const innerH = H - gpx;
  const bx = gpx / 2 + r.x * innerW;
  const by = gpx / 2 + r.y * innerH;
  const bw = r.w * innerW;
  const bh = r.h * innerH;
  return {
    x: bx + gpx / 2,
    y: by + gpx / 2,
    w: Math.max(0, bw - gpx),
    h: Math.max(0, bh - gpx),
  };
}
