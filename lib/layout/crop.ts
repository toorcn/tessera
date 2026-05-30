// Face-aware crop math, shared by the CSS preview and the export canvas.

export interface Focal {
  x: number; // 0..1
  y: number; // 0..1
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** CSS object-position string biased toward the focal point. */
export function focalToObjectPosition(focal: Focal): string {
  return `${clamp01(focal.x) * 100}% ${clamp01(focal.y) * 100}%`;
}

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Cover-fit source rectangle for drawing an image into a cell on canvas,
 * centered on the focal point and clamped inside the image bounds.
 */
export function coverSourceRect(
  imgW: number,
  imgH: number,
  cellW: number,
  cellH: number,
  focal: Focal,
): SourceRect {
  const coverScale = Math.max(cellW / imgW, cellH / imgH);
  const sw = cellW / coverScale;
  const sh = cellH / coverScale;
  const sx = clamp(focal.x * imgW - sw / 2, 0, imgW - sw);
  const sy = clamp(focal.y * imgH - sh / 2, 0, imgH - sh);
  return { sx, sy, sw, sh };
}

function clamp(v: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, v));
}
