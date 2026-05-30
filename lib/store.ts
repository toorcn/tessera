"use client";

import { create } from "zustand";
import type { LayoutMode } from "@/lib/layout/engine";
import { processFile } from "@/lib/image/pipeline";

export type RatioKey = "1:1" | "4:5" | "5:4" | "9:16" | "16:9";

export const RATIOS: Record<RatioKey, { w: number; h: number; px: [number, number] }> = {
  "1:1": { w: 1, h: 1, px: [1080, 1080] },
  "4:5": { w: 4, h: 5, px: [1080, 1350] },
  "5:4": { w: 5, h: 4, px: [1350, 1080] },
  "9:16": { w: 9, h: 16, px: [1080, 1920] },
  "16:9": { w: 16, h: 9, px: [1920, 1080] },
};

export interface PhotoMeta {
  dominantColors: string[];
  brightness: number; // 0..1
  orientation: "portrait" | "landscape" | "square";
  faceCount: number;
  vibeTags: string[];
}

export interface Photo {
  id: string;
  name: string;
  hash: string;
  previewUrl: string; // object URL of downscaled preview
  originalBlob: Blob; // full-res, used only at export
  width: number;
  height: number;
  focal: { x: number; y: number };
  meta?: PhotoMeta;
}

export type TextPlacement = "tile" | "overlay";
export type TextAlign = "left" | "center" | "right";

export interface TextBlock {
  id: string;
  content: string;
  placement: TextPlacement;
  tileIndex: number; // insertion slot among items (tile mode)
  pos: { x: number; y: number }; // overlay mode, 0..1
  fontSize: number; // relative to frame height, %
  align: TextAlign;
  color: "ink" | "paper";
  scrim: boolean;
  weight: number; // relative cell weight in tile mode
}

export type OutputMode = "single" | "carousel";

interface State {
  photos: Record<string, Photo>;
  order: string[];
  texts: TextBlock[];
  frameRatio: RatioKey;
  mode: LayoutMode;
  presetId?: string;
  density: number;
  legibilityFloor: boolean;
  output: OutputMode;
  perSlide: number;
  currentSlide: number;
  selectedTextId?: string;
  apiKey: string;
  aiBusy: boolean;
  aiError?: string;
  analyzing: boolean;
  hydrated: boolean;

  addFiles: (files: File[]) => Promise<void>;
  removePhoto: (id: string) => void;
  reorder: (order: string[]) => void;
  setFrame: (r: RatioKey) => void;
  setMode: (m: LayoutMode, presetId?: string) => void;
  setDensity: (d: number) => void;
  toggleFloor: () => void;
  setOutput: (o: OutputMode) => void;
  setPerSlide: (n: number) => void;
  setCurrentSlide: (i: number) => void;
  setFocal: (id: string, focal: { x: number; y: number }) => void;
  setMeta: (id: string, meta: PhotoMeta) => void;
  addText: () => void;
  updateText: (id: string, patch: Partial<TextBlock>) => void;
  removeText: (id: string) => void;
  selectText: (id?: string) => void;
  setApiKey: (k: string) => void;
  setAi: (patch: { aiBusy?: boolean; aiError?: string; analyzing?: boolean }) => void;
  newProject: () => void;
  hydrate: (s: Partial<State>) => void;
}

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.floor(performance.now() * 1000)}`);

export const useStore = create<State>((set, get) => ({
  photos: {},
  order: [],
  texts: [],
  frameRatio: "4:5",
  mode: "mosaic",
  presetId: undefined,
  density: 0.5,
  legibilityFloor: true,
  output: "single",
  perSlide: 9,
  currentSlide: 0,
  selectedTextId: undefined,
  apiKey: "",
  aiBusy: false,
  aiError: undefined,
  analyzing: false,
  hydrated: false,

  addFiles: async (files) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const result = await processFile(file);
        const id = uid();
        const photo: Photo = {
          id,
          name: file.name,
          hash: result.hash,
          previewUrl: result.previewUrl,
          originalBlob: file,
          width: result.width,
          height: result.height,
          focal: result.focal,
        };
        set((s) => ({ photos: { ...s.photos, [id]: photo }, order: [...s.order, id] }));
      } catch (e) {
        console.error("Failed to process", file.name, e);
      }
    }
  },

  removePhoto: (id) =>
    set((s) => {
      const photo = s.photos[id];
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      const photos = { ...s.photos };
      delete photos[id];
      return { photos, order: s.order.filter((x) => x !== id) };
    }),

  reorder: (order) => set({ order }),
  setFrame: (frameRatio) => set({ frameRatio }),
  setMode: (mode, presetId) => set({ mode, presetId }),
  setDensity: (density) => set({ density }),
  toggleFloor: () => set((s) => ({ legibilityFloor: !s.legibilityFloor })),
  setOutput: (output) => set({ output, currentSlide: 0 }),
  setPerSlide: (perSlide) => set({ perSlide: Math.max(2, Math.min(20, perSlide)) }),
  setCurrentSlide: (currentSlide) => set({ currentSlide }),
  setFocal: (id, focal) =>
    set((s) => (s.photos[id] ? { photos: { ...s.photos, [id]: { ...s.photos[id], focal } } } : {})),
  setMeta: (id, meta) =>
    set((s) => (s.photos[id] ? { photos: { ...s.photos, [id]: { ...s.photos[id], meta } } } : {})),

  addText: () => {
    const id = uid();
    const block: TextBlock = {
      id,
      content: "Your event title",
      placement: "tile",
      tileIndex: Math.floor(get().order.length / 2),
      pos: { x: 0.5, y: 0.5 },
      fontSize: 6,
      align: "center",
      color: "paper",
      scrim: true,
      weight: 1,
    };
    set((s) => ({ texts: [...s.texts, block], selectedTextId: id }));
  },
  updateText: (id, patch) =>
    set((s) => ({ texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  removeText: (id) =>
    set((s) => ({
      texts: s.texts.filter((t) => t.id !== id),
      selectedTextId: s.selectedTextId === id ? undefined : s.selectedTextId,
    })),
  selectText: (selectedTextId) => set({ selectedTextId }),

  setApiKey: (apiKey) => set({ apiKey }),
  setAi: (patch) => set(patch),

  newProject: () => {
    const { photos } = get();
    Object.values(photos).forEach((p) => URL.revokeObjectURL(p.previewUrl));
    set({
      photos: {},
      order: [],
      texts: [],
      currentSlide: 0,
      selectedTextId: undefined,
      presetId: undefined,
      mode: "mosaic",
    });
  },

  hydrate: (s) => set({ ...s, hydrated: true }),
}));
