// Pure layout engine. Given items (by aspect ratio) and a frame, returns
// normalized rectangles (0..1 on both axes) that tile the frame with no gaps.
// The same output drives both the on-screen preview and the export canvas.

export type LayoutMode = "mosaic" | "grid" | "preset";

export interface LayoutItem {
  /** natural aspect ratio = width / height */
  aspect: number;
}

export interface Frame {
  /** relative width unit, e.g. 4 for 4:5 */
  w: number;
  /** relative height unit, e.g. 5 for 4:5 */
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clampAspect = (a: number) => {
  if (!Number.isFinite(a) || a <= 0) return 1;
  // keep extreme panoramas/strips from dominating
  return Math.min(Math.max(a, 0.4), 2.6);
};

/** Split n items into `rows` ordered groups as evenly as possible. */
function partitionEven(n: number, rows: number): number[] {
  const groups: number[] = [];
  const base = Math.floor(n / rows);
  let remainder = n % rows;
  for (let i = 0; i < rows; i++) {
    groups.push(base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return groups;
}

function chooseRowCount(n: number, frame: Frame, density: number): number {
  if (n <= 1) return 1;
  const ratio = frame.h / frame.w; // taller frames want more rows
  const densityFactor = 0.7 + density * 0.8; // 0..1 slider -> 0.7..1.5
  const rows = Math.round(Math.sqrt(n * ratio) * densityFactor);
  return Math.min(Math.max(rows, 1), n);
}

function mosaic(items: LayoutItem[], frame: Frame, density: number): Rect[] {
  const n = items.length;
  const rows = chooseRowCount(n, frame, density);
  const groups = partitionEven(n, rows);

  // Each row's natural height fills the frame width at a shared height.
  // Rows of narrower (portrait) photos end up taller, giving them more room.
  const rowHeights: number[] = [];
  let cursor = 0;
  const rowItems: LayoutItem[][] = [];
  for (const count of groups) {
    const group = items.slice(cursor, cursor + count);
    cursor += count;
    rowItems.push(group);
    const sumAspect = group.reduce((s, it) => s + clampAspect(it.aspect), 0);
    rowHeights.push(frame.w / sumAspect);
  }
  const totalH = rowHeights.reduce((s, h) => s + h, 0);
  const hScale = frame.h / totalH;

  const rects: Rect[] = [];
  let y = 0;
  for (let r = 0; r < rowItems.length; r++) {
    const group = rowItems[r];
    const rowH = rowHeights[r] * hScale;
    const sumAspect = group.reduce((s, it) => s + clampAspect(it.aspect), 0);
    let x = 0;
    for (const it of group) {
      const w = (clampAspect(it.aspect) / sumAspect) * frame.w;
      rects.push({ x: x / frame.w, y: y / frame.h, w: w / frame.w, h: rowH / frame.h });
      x += w;
    }
    y += rowH;
  }
  return rects;
}

function grid(items: LayoutItem[], frame: Frame): Rect[] {
  const n = items.length;
  if (n === 0) return [];
  const cols = Math.max(1, Math.round(Math.sqrt(n * (frame.w / frame.h))));
  const rows = Math.ceil(n / cols);
  const cellH = 1 / rows;
  const rects: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const itemsInRow = Math.min(cols, n - row * cols);
    const cellW = 1 / itemsInRow;
    const col = i - row * cols;
    rects.push({ x: col * cellW, y: row * cellH, w: cellW, h: cellH });
  }
  return rects;
}

/**
 * Preset templates keyed by item count. A preset is a fixed set of rects.
 * Falls back to mosaic when no preset matches the count.
 */
const PRESETS: Record<string, Record<number, Rect[]>> = {
  hero: {
    3: [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.5, h: 0.38 },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
    ],
    5: [
      { x: 0, y: 0, w: 0.66, h: 0.66 },
      { x: 0.66, y: 0, w: 0.34, h: 0.33 },
      { x: 0.66, y: 0.33, w: 0.34, h: 0.33 },
      { x: 0, y: 0.66, w: 0.5, h: 0.34 },
      { x: 0.5, y: 0.66, w: 0.5, h: 0.34 },
    ],
  },
};

export function computeLayout(
  items: LayoutItem[],
  frame: Frame,
  mode: LayoutMode = "mosaic",
  density = 0.5,
  presetId?: string,
): Rect[] {
  if (items.length === 0) return [];
  if (mode === "grid") return grid(items, frame);
  if (mode === "preset" && presetId) {
    const preset = PRESETS[presetId]?.[items.length];
    if (preset) return preset.map((r) => ({ ...r }));
  }
  return mosaic(items, frame, density);
}
