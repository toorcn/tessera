import type { PhotoMeta } from "@/lib/store";
import type { LayoutMode } from "@/lib/layout/engine";

export interface AnalyzeItem {
  id: string;
  dataUrl: string;
}

export interface OrderItem {
  id: string;
  meta?: PhotoMeta;
  orientation: "portrait" | "landscape" | "square";
}

export interface ReorderResult {
  order: string[];
  hints?: { mode?: LayoutMode; density?: number };
  note?: string;
}

export interface AiProvider {
  analyze(items: AnalyzeItem[]): Promise<Record<string, PhotoMeta>>;
  suggestOrder(items: OrderItem[]): Promise<ReorderResult>;
  chatReorder(items: OrderItem[], prompt: string): Promise<ReorderResult>;
}
