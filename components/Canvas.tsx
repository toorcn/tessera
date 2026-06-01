"use client";

import { useLayoutEffect, useEffect, useRef, useState, useCallback } from "react";
import { useStore, RATIOS } from "@/lib/store";
import { computeLayout } from "@/lib/layout/engine";
import { buildSlide, slidesFor } from "@/lib/layout/slide";
import { focalToObjectPosition } from "@/lib/layout/crop";
import { gapPx, spacedRect, GAP_HEX } from "@/lib/layout/spacing";

function useFitFrame(ratioW: number, ratioH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const lastRef = useRef({ w: 0, h: 0 });
  // suppress reflow animation while the container itself is resizing
  const [animating, setAnimating] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const pad = 32;
      const aw = el.clientWidth - pad;
      const ah = el.clientHeight - pad;
      if (aw <= 0 || ah <= 0) return;
      const ratio = ratioW / ratioH;
      let w = aw;
      let h = w / ratio;
      if (h > ah) {
        h = ah;
        w = h * ratio;
      }
      const next = { w: Math.floor(w), h: Math.floor(h) };
      if (next.w === lastRef.current.w && next.h === lastRef.current.h) return;
      lastRef.current = next;
      setAnimating(false);
      setSize(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratioW, ratioH]);
  // re-enable transitions on the frame after a resize has committed
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimating(true));
    return () => cancelAnimationFrame(id);
  }, [size]);
  return { ref, size, animating };
}

export default function Canvas() {
  const {
    order,
    photos,
    texts,
    frameRatio,
    mode,
    presetId,
    density,
    spacing,
    gapColor,
    output,
    perSlide,
    currentSlide,
    setCurrentSlide,
    setFocal,
    selectText,
    selectedTextId,
    updateText,
  } = useStore();

  const ratio = RATIOS[frameRatio];
  const { ref, size, animating } = useFitFrame(ratio.w, ratio.h);
  const moveClass = animating ? "tile-move " : "";
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const slides = slidesFor(order, output, perSlide);
  const slideIndex = Math.min(currentSlide, slides.length - 1);
  const { items, overlays } = buildSlide(order, photos, texts, output, perSlide, slideIndex);
  const rects = computeLayout(
    items.map((it) => ({ aspect: it.aspect })),
    { w: ratio.w, h: ratio.h },
    mode,
    density,
    presetId,
  );
  const gpx = gapPx(spacing, size.w);

  const onFocalDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      const target = e.currentTarget as HTMLElement;
      const move = (ev: PointerEvent) => {
        const r = target.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
        const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
        setFocal(id, { x, y });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [setFocal],
  );

  const onOverlayDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.stopPropagation();
      const frame = (e.currentTarget as HTMLElement).parentElement!;
      const move = (ev: PointerEvent) => {
        const r = frame.getBoundingClientRect();
        const x = Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width));
        const y = Math.min(0.98, Math.max(0.02, (ev.clientY - r.top) / r.height));
        updateText(id, { pos: { x, y } });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [updateText],
  );

  const empty = items.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={ref}
        className="relative flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={() => {
          setSelectedPhoto(null);
          selectText(undefined);
        }}
      >
        {empty ? (
          <div className="fade-up text-center">
            <div aria-hidden className="mx-auto mb-5 grid h-16 w-16 grid-cols-3 gap-[3px] opacity-70">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <span key={i} className="rounded-[2px]" style={{ background: i % 4 === 0 ? "#C75B39" : "#D8D2C4" }} />
              ))}
            </div>
            <p className="font-display text-[26px] font-medium text-ink">A blank wall, for now</p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink-soft">
              Add your event photos and Tessera arranges them into a seamless print.
            </p>
          </div>
        ) : (
          <div
            className="relative overflow-hidden print-mount"
            style={{ width: size.w, height: size.h, background: GAP_HEX[gapColor] }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it, i) => {
              const r = rects[i];
              if (!r) return null;
              const box = spacedRect(r, size.w, size.h, gpx);
              const seam = gpx > 0 ? 0 : 1; // hairline overlap only in seamless mode
              const style = {
                left: box.x,
                top: box.y,
                width: box.w + seam,
                height: box.h + seam,
              } as const;

              if (it.kind === "text" && it.text) {
                const t = it.text;
                return (
                  <div
                    key={it.id}
                    className={`${moveClass}fade-up absolute flex items-center justify-center p-2 text-center`}
                    style={{
                      ...style,
                      animationDelay: `${Math.min(i, 20) * 28}ms`,
                      background: t.color === "paper" ? "#1A1A1A" : "#F4F1EA",
                      color: t.color === "paper" ? "#F4F1EA" : "#1A1A1A",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectText(t.id);
                    }}
                  >
                    <span
                      className="font-display leading-tight"
                      style={{
                        fontSize: (t.fontSize / 100) * size.h,
                        textAlign: t.align,
                        outline: selectedTextId === t.id ? "2px solid #C75B39" : "none",
                        outlineOffset: 4,
                      }}
                    >
                      {t.content}
                    </span>
                  </div>
                );
              }

              const p = it.photo!;
              const selected = selectedPhoto === p.id;
              return (
                <div
                  key={it.id}
                  className={`${moveClass}fade-up group absolute`}
                  style={{ ...style, animationDelay: `${Math.min(i, 20) * 28}ms`, cursor: selected ? "crosshair" : "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPhoto(p.id);
                    selectText(undefined);
                  }}
                  onPointerDown={(e) => selected && onFocalDrag(p.id, e)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.previewUrl}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full select-none object-cover"
                    style={{ objectPosition: focalToObjectPosition(p.focal) }}
                  />
                  {!selected && (
                    <div className="pointer-events-none absolute inset-0 opacity-0 ring-2 ring-inset ring-clay/60 transition-opacity duration-150 group-hover:opacity-100" />
                  )}
                  {selected && (
                    <>
                      <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-clay" />
                      <div
                        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-clay shadow"
                        style={{ left: `${p.focal.x * 100}%`, top: `${p.focal.y * 100}%` }}
                      />
                      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink/80 px-2 py-0.5 text-[10px] text-paper">
                        drag to set the focus
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {overlays.map((t) => (
              <div
                key={t.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none px-3 py-1"
                style={{
                  left: `${t.pos.x * 100}%`,
                  top: `${t.pos.y * 100}%`,
                  background: t.scrim ? "rgba(26,26,26,0.45)" : "transparent",
                  borderRadius: 6,
                  outline: selectedTextId === t.id ? "2px solid #C75B39" : "none",
                  outlineOffset: 3,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectText(t.id);
                }}
                onPointerDown={(e) => onOverlayDrag(t.id, e)}
              >
                <span
                  className="font-display leading-tight"
                  style={{
                    fontSize: (t.fontSize / 100) * size.h,
                    color: t.color === "paper" ? "#F4F1EA" : "#1A1A1A",
                  }}
                >
                  {t.content}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {output === "carousel" && slides.length > 1 && (
        <div className="flex items-center justify-center gap-3 pb-1 pt-2">
          <button
            className="btn-ghost px-2 py-1"
            onClick={() => setCurrentSlide(Math.max(0, slideIndex - 1))}
            disabled={slideIndex === 0}
          >
            Prev
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setCurrentSlide(i)}
                className="h-2 w-2 rounded-full transition-colors"
                style={{ background: i === slideIndex ? "#1A1A1A" : "#D8D2C4" }}
              />
            ))}
          </div>
          <button
            className="btn-ghost px-2 py-1"
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, slideIndex + 1))}
            disabled={slideIndex === slides.length - 1}
          >
            Next
          </button>
          <span className="ml-1 text-xs text-ink-soft">
            Slide {slideIndex + 1} of {slides.length}
          </span>
        </div>
      )}
    </div>
  );
}
