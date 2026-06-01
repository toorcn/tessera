// High-resolution export. Re-renders the exact same layout rects onto an
// offscreen canvas using full-resolution originals, then encodes to PNG/JPG.

import { computeLayout } from "@/lib/layout/engine";
import { coverSourceRect } from "@/lib/layout/crop";
import { buildSlide, slidesFor } from "@/lib/layout/slide";
import { gapPx, spacedRect, GAP_HEX, type GapColor } from "@/lib/layout/spacing";
import { RATIOS, type RatioKey, type Photo, type TextBlock, type OutputMode } from "@/lib/store";
import type { LayoutMode } from "@/lib/layout/engine";

export interface RenderParams {
  order: string[];
  photos: Record<string, Photo>;
  texts: TextBlock[];
  frameRatio: RatioKey;
  mode: LayoutMode;
  presetId?: string;
  density: number;
  spacing: number;
  gapColor: GapColor;
  output: OutputMode;
  perSlide: number;
  multiplier: number; // 1 or 2
}

export type ExportFormat = "png" | "jpg";

const PAPER = "#F4F1EA";
const INK = "#1A1A1A";

async function renderSlide(params: RenderParams, slideIndex: number): Promise<HTMLCanvasElement> {
  const ratio = RATIOS[params.frameRatio];
  const W = ratio.px[0] * params.multiplier;
  const H = ratio.px[1] * params.multiplier;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = GAP_HEX[params.gapColor];
  ctx.fillRect(0, 0, W, H);
  const gpx = gapPx(params.spacing, W);

  const { items, overlays } = buildSlide(
    params.order,
    params.photos,
    params.texts,
    params.output,
    params.perSlide,
    slideIndex,
  );
  const rects = computeLayout(
    items.map((it) => ({ aspect: it.aspect })),
    { w: ratio.w, h: ratio.h },
    params.mode,
    params.density,
    params.presetId,
  );

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const r = rects[i];
    const box = spacedRect(r, W, H, gpx);
    const dx = box.x;
    const dy = box.y;
    const dw = box.w;
    const dh = box.h;

    if (it.kind === "photo" && it.photo) {
      const bmp = await createImageBitmap(it.photo.originalBlob);
      const src = coverSourceRect(bmp.width, bmp.height, dw, dh, it.photo.focal);
      ctx.drawImage(bmp, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh);
      bmp.close?.();
    } else if (it.kind === "text" && it.text) {
      drawTextCell(ctx, it.text, dx, dy, dw, dh, H);
    }
  }

  for (const t of overlays) drawOverlay(ctx, t, W, H);
  return canvas;
}

function drawTextCell(
  ctx: CanvasRenderingContext2D,
  t: TextBlock,
  x: number,
  y: number,
  w: number,
  h: number,
  frameH: number,
) {
  ctx.fillStyle = t.color === "paper" ? INK : PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = t.color === "paper" ? PAPER : INK;
  const size = (t.fontSize / 100) * frameH;
  ctx.font = `600 ${size}px Georgia, serif`;
  ctx.textAlign = t.align === "left" ? "left" : t.align === "right" ? "right" : "center";
  ctx.textBaseline = "middle";
  const tx = t.align === "left" ? x + w * 0.06 : t.align === "right" ? x + w * 0.94 : x + w / 2;
  wrapText(ctx, t.content, tx, y + h / 2, w * 0.88, size * 1.2);
}

function drawOverlay(ctx: CanvasRenderingContext2D, t: TextBlock, W: number, H: number) {
  const size = (t.fontSize / 100) * H;
  ctx.font = `600 ${size}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = t.pos.x * W;
  const cy = t.pos.y * H;
  const metrics = ctx.measureText(t.content);
  if (t.scrim) {
    const padX = size * 0.7;
    const padY = size * 0.5;
    ctx.fillStyle = "rgba(26,26,26,0.45)";
    roundRect(ctx, cx - metrics.width / 2 - padX, cy - size / 2 - padY, metrics.width + padX * 2, size + padY * 2, size * 0.18);
    ctx.fill();
  }
  ctx.fillStyle = t.color === "paper" ? PAPER : INK;
  ctx.fillText(t.content, cx, cy);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineH));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function toBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  const type = format === "png" ? "image/png" : "image/jpeg";
  const quality = format === "png" ? undefined : 0.92;
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality),
  );
}

/** Render every slide and return one blob per slide. */
export async function renderToBlobs(params: RenderParams, format: ExportFormat): Promise<Blob[]> {
  const slides = slidesFor(params.order, params.output, params.perSlide);
  const blobs: Blob[] = [];
  for (let i = 0; i < slides.length; i++) {
    const canvas = await renderSlide(params, i);
    blobs.push(await toBlob(canvas, format));
  }
  return blobs;
}

/** Bundle all slides into one PDF (LinkedIn document carousel). */
export async function renderToPdf(params: RenderParams): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const ratio = RATIOS[params.frameRatio];
  const W = ratio.px[0];
  const H = ratio.px[1];
  const slides = slidesFor(params.order, params.output, params.perSlide);
  const pdf = new jsPDF({ orientation: W >= H ? "landscape" : "portrait", unit: "px", format: [W, H] });
  for (let i = 0; i < slides.length; i++) {
    const canvas = await renderSlide(params, i);
    const img = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([W, H], W >= H ? "landscape" : "portrait");
    pdf.addImage(img, "JPEG", 0, 0, W, H);
  }
  return pdf.output("blob");
}
