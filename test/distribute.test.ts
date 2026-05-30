import { describe, it, expect } from "vitest";
import { distribute } from "@/lib/layout/distribute";

describe("distribute", () => {
  it("chunks ids in order", () => {
    expect(distribute([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("preserves order across slides", () => {
    const ids = Array.from({ length: 30 }, (_, i) => i);
    const slides = distribute(ids, 8);
    expect(slides.flat()).toEqual(ids);
    expect(slides).toHaveLength(4);
    expect(slides[0]).toHaveLength(8);
    expect(slides[3]).toHaveLength(6);
  });

  it("guards against perSlide < 1", () => {
    expect(distribute([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
  });

  it("returns a single empty slide for no ids", () => {
    expect(distribute([], 8)).toEqual([[]]);
  });
});
