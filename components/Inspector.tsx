"use client";

import { useState } from "react";
import { useStore, RATIOS, type RatioKey } from "@/lib/store";
import type { LayoutMode } from "@/lib/layout/engine";
import { renderToBlobs, renderToPdf, type ExportFormat } from "@/lib/export/render";

const RATIO_KEYS: RatioKey[] = ["1:1", "4:5", "5:4", "9:16", "16:9"];
const MODES: { key: LayoutMode; label: string; preset?: string }[] = [
  { key: "mosaic", label: "Mosaic" },
  { key: "grid", label: "Grid" },
  { key: "preset", label: "Spotlight", preset: "hero" },
];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Inspector() {
  const s = useStore();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [hi, setHi] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const hasPhotos = s.order.length > 0;

  const params = () => ({
    order: s.order,
    photos: s.photos,
    texts: s.texts,
    frameRatio: s.frameRatio,
    mode: s.mode,
    presetId: s.presetId,
    density: s.density,
    output: s.output,
    perSlide: s.perSlide,
    multiplier: hi ? 2 : 1,
  });

  const exportImages = async () => {
    setBusy("Rendering...");
    try {
      const blobs = await renderToBlobs(params(), format);
      const ext = format === "png" ? "png" : "jpg";
      blobs.forEach((b, i) =>
        download(b, blobs.length > 1 ? `tessera-${i + 1}.${ext}` : `tessera.${ext}`),
      );
    } catch (e) {
      console.error(e);
      setBusy("Export failed");
      setTimeout(() => setBusy(null), 1500);
      return;
    }
    setBusy(null);
  };

  const exportPdf = async () => {
    setBusy("Building PDF...");
    try {
      download(await renderToPdf(params()), "tessera-carousel.pdf");
    } catch (e) {
      console.error(e);
    }
    setBusy(null);
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto scroll-quiet pr-1">
      <section>
        <h3 className="field-label mb-2">Aspect ratio</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {RATIO_KEYS.map((k) => (
            <button
              key={k}
              data-active={s.frameRatio === k}
              onClick={() => s.setFrame(k)}
              className="seg-tile rounded-md border border-line py-2 text-xs text-ink-soft transition-colors data-[active=true]:border-ink data-[active=true]:bg-ink data-[active=true]:text-paper"
            >
              {k}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          Exports at {RATIOS[s.frameRatio].px[0] * (hi ? 2 : 1)} x {RATIOS[s.frameRatio].px[1] * (hi ? 2 : 1)} px
        </p>
      </section>

      <section>
        <h3 className="field-label mb-2">Layout</h3>
        <div className="seg">
          {MODES.map((m) => (
            <button
              key={m.key + (m.preset ?? "")}
              data-active={s.mode === m.key && s.presetId === m.preset}
              onClick={() => s.setMode(m.key, m.preset)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {s.mode === "mosaic" && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="field-label">Density</h3>
            <span className="text-xs text-ink-soft">{Math.round(s.density * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.density}
            onChange={(e) => s.setDensity(Number(e.target.value))}
            className="w-full accent-clay"
          />
          <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
            <span>Fewer, bigger</span>
            <span>More, smaller</span>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h3 className="field-label">Keep faces legible</h3>
          <button
            role="switch"
            aria-checked={s.legibilityFloor}
            onClick={s.toggleFloor}
            className="relative h-5 w-9 rounded-full transition-colors"
            style={{ background: s.legibilityFloor ? "#C75B39" : "#D8D2C4" }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-all"
              style={{ left: s.legibilityFloor ? 18 : 2 }}
            />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">Caps how small any face can get; overflow moves to a new slide.</p>
      </section>

      <section>
        <h3 className="field-label mb-2">Output</h3>
        <div className="seg">
          <button data-active={s.output === "single"} onClick={() => s.setOutput("single")}>
            Single frame
          </button>
          <button data-active={s.output === "carousel"} onClick={() => s.setOutput("carousel")}>
            Carousel
          </button>
        </div>
        {s.output === "carousel" && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-ink-soft">Photos per slide</span>
              <span className="text-xs font-medium text-ink">{s.perSlide}</span>
            </div>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={s.perSlide}
              onChange={(e) => s.setPerSlide(Number(e.target.value))}
              className="w-full accent-clay"
            />
          </div>
        )}
      </section>

      <section className="mt-auto rounded-lg border border-line bg-paper-deep/50 p-3">
        <h3 className="field-label mb-2">Export</h3>
        <div className="mb-2 flex gap-2">
          <div className="seg flex-1">
            <button data-active={format === "png"} onClick={() => setFormat("png")}>
              PNG
            </button>
            <button data-active={format === "jpg"} onClick={() => setFormat("jpg")}>
              JPG
            </button>
          </div>
          <button
            onClick={() => setHi((v) => !v)}
            data-active={hi}
            className="seg-tile rounded-md border border-line px-3 text-xs text-ink-soft data-[active=true]:border-ink data-[active=true]:bg-ink data-[active=true]:text-paper"
            title="2x resolution"
          >
            2x
          </button>
        </div>
        <button className="btn-primary w-full" onClick={exportImages} disabled={!hasPhotos || !!busy}>
          {busy ?? (s.output === "carousel" ? "Export slides" : "Export image")}
        </button>
        {s.output === "carousel" && (
          <button className="btn-outline mt-2 w-full" onClick={exportPdf} disabled={!hasPhotos || !!busy}>
            Export carousel PDF
          </button>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">
          PNG is lossless and best for crisp text. JPG is smaller for photo-heavy collages.
        </p>
      </section>
    </div>
  );
}
