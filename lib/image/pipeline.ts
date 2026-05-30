// Image pipeline: decode off the main thread, produce a lightweight preview,
// and find a face-aware focal point. Originals are kept untouched for export.

import { fileKey } from "@/lib/hash";

const PREVIEW_MAX = 1000; // longest edge of the editing preview

export interface ProcessResult {
  previewUrl: string;
  width: number;
  height: number;
  focal: { x: number; y: number };
  hash: string;
}

// faces usually sit a little above the vertical centre, especially in selfies
const DEFAULT_FOCAL = { x: 0.5, y: 0.42 };

/** Decode and downscale any image blob to a small preview object URL. */
export async function makePreview(blob: Blob): Promise<{ previewUrl: string; width: number; height: number; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
  const pw = Math.max(1, Math.round(width * scale));
  const ph = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, pw, ph);

  const previewBlob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85),
  );
  return { previewUrl: URL.createObjectURL(previewBlob), width, height, bitmap };
}

export async function processFile(file: File): Promise<ProcessResult> {
  const { previewUrl, width, height, bitmap } = await makePreview(file);
  const focal = await detectFocal(bitmap).catch(() => DEFAULT_FOCAL);
  bitmap.close?.();
  return { previewUrl, width, height, focal, hash: fileKey(file) };
}

/** Regenerate just the preview URL for a stored blob (used on project reload). */
export async function previewFromBlob(blob: Blob): Promise<{ previewUrl: string; width: number; height: number }> {
  const { previewUrl, width, height, bitmap } = await makePreview(blob);
  bitmap.close?.();
  return { previewUrl, width, height };
}

async function detectFocal(bitmap: ImageBitmap): Promise<{ x: number; y: number }> {
  const FaceDetector = (globalThis as unknown as { FaceDetector?: new () => { detect: (s: ImageBitmap) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
  if (!FaceDetector) return DEFAULT_FOCAL;
  try {
    const detector = new FaceDetector();
    const faces = await detector.detect(bitmap);
    if (!faces.length) return DEFAULT_FOCAL;
    // average the face centres so groups stay framed
    let cx = 0;
    let cy = 0;
    for (const f of faces) {
      cx += (f.boundingBox.x + f.boundingBox.width / 2) / bitmap.width;
      cy += (f.boundingBox.y + f.boundingBox.height / 2) / bitmap.height;
    }
    return { x: cx / faces.length, y: cy / faces.length };
  } catch {
    return DEFAULT_FOCAL;
  }
}
