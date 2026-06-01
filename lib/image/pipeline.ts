// Image pipeline: decode (incl. HEIC from phones) off the main thread, produce a
// lightweight preview, and find a face-aware focal point. The decodable blob is
// returned so export uses something the canvas can actually read.

import { fileKey } from "@/lib/hash";

const PREVIEW_MAX = 1000; // longest edge of the editing preview

export interface ProcessResult {
  previewUrl: string;
  width: number;
  height: number;
  focal: { x: number; y: number };
  hash: string;
  /** blob the canvas can decode (HEIC is converted to JPEG); store this for export */
  exportBlob: Blob;
}

// faces usually sit a little above the vertical centre, especially in selfies
const DEFAULT_FOCAL = { x: 0.5, y: 0.42 };

export function isHeic(file: { type?: string; name?: string }): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/.test(name);
}

async function heicToJpeg(blob: Blob): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : (out as Blob);
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** the blob that decoded successfully (converted for HEIC) */
  blob: Blob;
  cleanup: () => void;
}

/**
 * Decode any supported image into a canvas-drawable source.
 * Order: HEIC->JPEG conversion when needed, then createImageBitmap,
 * then an <img> element fallback for formats createImageBitmap rejects.
 */
async function decodeImage(input: Blob, fileName?: string): Promise<Decoded> {
  let blob = input;
  if (isHeic({ type: input.type, name: fileName })) {
    blob = await heicToJpeg(input);
  }

  try {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      blob,
      cleanup: () => bitmap.close?.(),
    };
  } catch {
    // fall back to the browser's <img> decoder (handles some profiles createImageBitmap rejects)
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        blob,
        cleanup: () => URL.revokeObjectURL(url),
      };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = url;
  });
}

/** Decode and downscale any image blob to a small preview object URL. */
export async function makePreview(
  blob: Blob,
  fileName?: string,
): Promise<{ previewUrl: string; width: number; height: number; exportBlob: Blob; decoded: Decoded }> {
  const decoded = await decodeImage(blob, fileName);
  const { width, height } = decoded;
  const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
  const pw = Math.max(1, Math.round(width * scale));
  const ph = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    decoded.cleanup();
    throw new Error("2d context unavailable");
  }
  ctx.drawImage(decoded.source, 0, 0, pw, ph);

  const previewBlob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85),
  );
  return { previewUrl: URL.createObjectURL(previewBlob), width, height, exportBlob: decoded.blob, decoded };
}

export async function processFile(file: File): Promise<ProcessResult> {
  const { previewUrl, width, height, exportBlob, decoded } = await makePreview(file, file.name);
  const focal = await detectFocal(decoded.source).catch(() => DEFAULT_FOCAL);
  decoded.cleanup();
  return { previewUrl, width, height, focal, hash: fileKey(file), exportBlob };
}

/** Regenerate just the preview URL for a stored (already decodable) blob on reload. */
export async function previewFromBlob(blob: Blob): Promise<{ previewUrl: string; width: number; height: number }> {
  const { previewUrl, width, height, decoded } = await makePreview(blob);
  decoded.cleanup();
  return { previewUrl, width, height };
}

async function detectFocal(source: CanvasImageSource): Promise<{ x: number; y: number }> {
  const FaceDetector = (
    globalThis as unknown as {
      FaceDetector?: new () => { detect: (s: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> };
    }
  ).FaceDetector;
  if (!FaceDetector) return DEFAULT_FOCAL;
  const w = (source as { width?: number; naturalWidth?: number }).width ?? (source as HTMLImageElement).naturalWidth;
  const h = (source as { height?: number; naturalHeight?: number }).height ?? (source as HTMLImageElement).naturalHeight;
  if (!w || !h) return DEFAULT_FOCAL;
  try {
    const detector = new FaceDetector();
    const faces = await detector.detect(source);
    if (!faces.length) return DEFAULT_FOCAL;
    let cx = 0;
    let cy = 0;
    for (const f of faces) {
      cx += (f.boundingBox.x + f.boundingBox.width / 2) / w;
      cy += (f.boundingBox.y + f.boundingBox.height / 2) / h;
    }
    return { x: cx / faces.length, y: cy / faces.length };
  } catch {
    return DEFAULT_FOCAL;
  }
}
