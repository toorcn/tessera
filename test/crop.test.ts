import { describe, it, expect } from "vitest";
import { focalToObjectPosition, coverSourceRect } from "@/lib/layout/crop";

describe("focalToObjectPosition", () => {
  it("maps focal point to a percentage string", () => {
    expect(focalToObjectPosition({ x: 0.5, y: 0.25 })).toBe("50% 25%");
  });
  it("clamps out-of-range values", () => {
    expect(focalToObjectPosition({ x: -1, y: 2 })).toBe("0% 100%");
  });
});

describe("coverSourceRect", () => {
  it("produces a source rect matching the cell aspect", () => {
    const r = coverSourceRect(1000, 1000, 400, 500, { x: 0.5, y: 0.5 });
    expect(r.sw / r.sh).toBeCloseTo(400 / 500, 5);
  });

  it("stays inside the image bounds", () => {
    const r = coverSourceRect(1000, 800, 400, 500, { x: 0.95, y: 0.95 });
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.sw).toBeLessThanOrEqual(1000 + 1e-9);
    expect(r.sy + r.sh).toBeLessThanOrEqual(800 + 1e-9);
  });

  it("centers on the focal point when there is room", () => {
    const r = coverSourceRect(2000, 1000, 500, 500, { x: 0.5, y: 0.5 });
    // square crop from a landscape image, centered horizontally
    expect(r.sx + r.sw / 2).toBeCloseTo(1000, 5);
  });
});
