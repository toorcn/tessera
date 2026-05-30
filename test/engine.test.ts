import { describe, it, expect } from "vitest";
import { computeLayout, type LayoutItem, type Frame } from "@/lib/layout/engine";

const frame45: Frame = { w: 4, h: 5 };
const square: Frame = { w: 1, h: 1 };

function items(aspects: number[]): LayoutItem[] {
  return aspects.map((a) => ({ aspect: a }));
}

function coverage(rects: { w: number; h: number }[]): number {
  return rects.reduce((s, r) => s + r.w * r.h, 0);
}

describe("computeLayout mosaic", () => {
  it("covers the whole frame with no gaps for N=1..12", () => {
    for (let n = 1; n <= 12; n++) {
      const its = items(Array.from({ length: n }, (_, i) => (i % 2 ? 0.75 : 1.4)));
      const rects = computeLayout(its, frame45, "mosaic");
      expect(rects).toHaveLength(n);
      expect(coverage(rects)).toBeCloseTo(1, 5);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(-1e-9);
        expect(r.y).toBeGreaterThanOrEqual(-1e-9);
        expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("is deterministic", () => {
    const its = items([1, 0.7, 1.5, 0.8, 1.2, 0.6]);
    const a = computeLayout(its, frame45, "mosaic");
    const b = computeLayout(its, frame45, "mosaic");
    expect(a).toEqual(b);
  });

  it("gives a portrait photo a narrower cell than a landscape photo in the same row", () => {
    // wide frame forces a single row so both items share it
    const wide: Frame = { w: 10, h: 1 };
    const rects = computeLayout(items([1.8, 0.6]), wide, "mosaic");
    expect(rects).toHaveLength(2);
    expect(rects[0].y).toBeCloseTo(rects[1].y, 6); // same row
    expect(rects[1].w).toBeLessThan(rects[0].w); // portrait (0.6) narrower than landscape (1.8)
  });

  it("higher density produces more rows (smaller cells)", () => {
    const its = items(Array(16).fill(1));
    const sparse = computeLayout(its, frame45, "mosaic", 0.1);
    const dense = computeLayout(its, frame45, "mosaic", 0.9);
    const distinctYs = (rs: { y: number }[]) => new Set(rs.map((r) => r.y.toFixed(4))).size;
    expect(distinctYs(dense)).toBeGreaterThanOrEqual(distinctYs(sparse));
  });
});

describe("computeLayout grid", () => {
  it("covers the frame with equal cells when N fills the grid", () => {
    const rects = computeLayout(items(Array(9).fill(1)), square, "grid");
    expect(coverage(rects)).toBeCloseTo(1, 5);
    const w0 = rects[0].w;
    const h0 = rects[0].h;
    for (const r of rects) {
      expect(r.w).toBeCloseTo(w0, 6);
      expect(r.h).toBeCloseTo(h0, 6);
    }
  });

  it("stays seamless when the last row is partial", () => {
    const rects = computeLayout(items(Array(7).fill(1)), square, "grid");
    expect(coverage(rects)).toBeCloseTo(1, 5);
  });
});

describe("computeLayout preset", () => {
  it("returns the preset template when one matches the count", () => {
    const rects = computeLayout(items(Array(3).fill(1)), frame45, "preset", 0.5, "hero");
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 1, h: 0.62 });
  });

  it("falls back to mosaic when no preset matches", () => {
    const rects = computeLayout(items(Array(4).fill(1)), frame45, "preset", 0.5, "hero");
    expect(coverage(rects)).toBeCloseTo(1, 5);
  });
});

describe("computeLayout edge", () => {
  it("returns [] for no items", () => {
    expect(computeLayout([], frame45, "mosaic")).toEqual([]);
  });
});
