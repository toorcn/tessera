// Autosave the project to IndexedDB so a refresh never loses work.
// Photos are stored as their original blobs; previews are regenerated on load.

import { openDB, type IDBPDatabase } from "idb";
import { useStore, type Photo, type TextBlock, type RatioKey, type OutputMode } from "@/lib/store";
import type { LayoutMode } from "@/lib/layout/engine";
import { previewFromBlob } from "@/lib/image/pipeline";

const DB_NAME = "tessera";
const STORE = "kv";
const KEY = "current";

interface StoredPhoto {
  id: string;
  name: string;
  hash: string;
  width: number;
  height: number;
  focal: { x: number; y: number };
  meta?: Photo["meta"];
  blob: Blob;
}

interface Snapshot {
  order: string[];
  texts: TextBlock[];
  frameRatio: RatioKey;
  mode: LayoutMode;
  presetId?: string;
  density: number;
  legibilityFloor: boolean;
  output: OutputMode;
  perSlide: number;
  photos: StoredPhoto[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function saveProject(): Promise<void> {
  const s = useStore.getState();
  const snapshot: Snapshot = {
    order: s.order,
    texts: s.texts,
    frameRatio: s.frameRatio,
    mode: s.mode,
    presetId: s.presetId,
    density: s.density,
    legibilityFloor: s.legibilityFloor,
    output: s.output,
    perSlide: s.perSlide,
    photos: s.order
      .map((id) => s.photos[id])
      .filter((p): p is Photo => Boolean(p))
      .map((p) => ({
        id: p.id,
        name: p.name,
        hash: p.hash,
        width: p.width,
        height: p.height,
        focal: p.focal,
        meta: p.meta,
        blob: p.originalBlob,
      })),
  };
  try {
    const db = await getDb();
    await db.put(STORE, snapshot, KEY);
  } catch (e) {
    console.warn("Autosave unavailable", e);
  }
}

export async function loadProject(): Promise<boolean> {
  let snapshot: Snapshot | undefined;
  try {
    const db = await getDb();
    snapshot = await db.get(STORE, KEY);
  } catch (e) {
    console.warn("Could not read saved project", e);
    return false;
  }
  if (!snapshot || !snapshot.photos?.length) return false;

  const photos: Record<string, Photo> = {};
  for (const sp of snapshot.photos) {
    try {
      const { previewUrl } = await previewFromBlob(sp.blob);
      photos[sp.id] = {
        id: sp.id,
        name: sp.name,
        hash: sp.hash,
        previewUrl,
        originalBlob: sp.blob,
        width: sp.width,
        height: sp.height,
        focal: sp.focal,
        meta: sp.meta,
      };
    } catch (e) {
      console.warn("Skipping unreadable photo", sp.name, e);
    }
  }

  useStore.getState().hydrate({
    photos,
    order: snapshot.order.filter((id) => photos[id]),
    texts: snapshot.texts ?? [],
    frameRatio: snapshot.frameRatio,
    mode: snapshot.mode,
    presetId: snapshot.presetId,
    density: snapshot.density,
    legibilityFloor: snapshot.legibilityFloor,
    output: snapshot.output,
    perSlide: snapshot.perSlide,
  });
  return true;
}

export async function clearProject(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, KEY);
  } catch {
    /* ignore */
  }
}
