"use client";

import { useStore, type TextAlign } from "@/lib/store";

const ALIGNS: TextAlign[] = ["left", "center", "right"];

export default function TextEditor() {
  const texts = useStore((s) => s.texts);
  const order = useStore((s) => s.order);
  const addText = useStore((s) => s.addText);
  const updateText = useStore((s) => s.updateText);
  const removeText = useStore((s) => s.removeText);
  const selectedTextId = useStore((s) => s.selectedTextId);
  const selectText = useStore((s) => s.selectText);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto scroll-quiet pr-1">
      <button className="btn-outline w-full" onClick={addText}>
        Add text block
      </button>

      {texts.length === 0 && (
        <p className="text-sm text-ink-soft">
          Add a title, date, or caption. Place it as a tile and the photos rearrange around it, or float it over the collage.
        </p>
      )}

      {texts.map((t) => {
        const active = t.id === selectedTextId;
        return (
          <div
            key={t.id}
            onClick={() => selectText(t.id)}
            className={`rounded-lg border p-3 transition-colors ${active ? "border-clay bg-paper-deep/40" : "border-line"}`}
          >
            <textarea
              value={t.content}
              onChange={(e) => updateText(t.id, { content: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-md border border-line bg-paper px-2.5 py-2 font-display text-base text-ink outline-none focus:border-ink/40"
            />

            <div className="mt-3 space-y-3">
              <div>
                <span className="field-label">Placement</span>
                <div className="seg mt-1">
                  <button data-active={t.placement === "tile"} onClick={() => updateText(t.id, { placement: "tile" })}>
                    Tile (reflow)
                  </button>
                  <button data-active={t.placement === "overlay"} onClick={() => updateText(t.id, { placement: "overlay" })}>
                    Float on top
                  </button>
                </div>
              </div>

              {t.placement === "tile" && order.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="field-label">Position in collage</span>
                    <span className="text-xs text-ink-soft">{t.tileIndex} / {order.length}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={order.length}
                    step={1}
                    value={Math.min(t.tileIndex, order.length)}
                    onChange={(e) => updateText(t.id, { tileIndex: Number(e.target.value) })}
                    className="mt-1 w-full accent-clay"
                  />
                  <p className="text-[11px] text-ink-soft">Slide it and the photos repack around the text.</p>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <span className="field-label">Size</span>
                  <input
                    type="range"
                    min={3}
                    max={14}
                    step={0.5}
                    value={t.fontSize}
                    onChange={(e) => updateText(t.id, { fontSize: Number(e.target.value) })}
                    className="mt-1 w-full accent-clay"
                  />
                </div>
                <div>
                  <span className="field-label">Align</span>
                  <div className="seg mt-1">
                    {ALIGNS.map((a) => (
                      <button key={a} data-active={t.align === a} onClick={() => updateText(t.id, { align: a })} className="px-2">
                        {a[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="field-label">Color</span>
                  <div className="seg mt-1">
                    <button data-active={t.color === "ink"} onClick={() => updateText(t.id, { color: "ink" })}>
                      Ink
                    </button>
                    <button data-active={t.color === "paper"} onClick={() => updateText(t.id, { color: "paper" })}>
                      Paper
                    </button>
                  </div>
                </div>
                {t.placement === "overlay" && (
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={t.scrim}
                      onChange={(e) => updateText(t.id, { scrim: e.target.checked })}
                      className="accent-clay"
                    />
                    Scrim
                  </label>
                )}
              </div>

              <button className="btn-ghost w-full text-xs text-clay-deep" onClick={() => removeText(t.id)}>
                Remove text
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
