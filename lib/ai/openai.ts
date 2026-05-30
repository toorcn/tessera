import OpenAI from "openai";
import type { PhotoMeta } from "@/lib/store";
import type { AiProvider, AnalyzeItem, OrderItem, ReorderResult } from "@/lib/ai/provider";

const MODEL = "gpt-4o-mini"; // vision-capable and inexpensive
const ANALYZE_BATCH = 6;

function client(apiKey: string) {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

export function createOpenAiProvider(apiKey: string): AiProvider {
  const openai = client(apiKey);

  return {
    async analyze(items: AnalyzeItem[]): Promise<Record<string, PhotoMeta>> {
      const out: Record<string, PhotoMeta> = {};
      for (let i = 0; i < items.length; i += ANALYZE_BATCH) {
        const batch = items.slice(i, i + ANALYZE_BATCH);
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
          {
            type: "text",
            text:
              "For each image in order, return JSON {\"items\":[{\"dominantColors\":[hex,hex],\"brightness\":0..1,\"orientation\":\"portrait|landscape|square\",\"faceCount\":int,\"vibeTags\":[two short words]}]}. One entry per image, same order.",
          },
          ...batch.map(
            (b): OpenAI.Chat.ChatCompletionContentPart => ({
              type: "image_url",
              image_url: { url: b.dataUrl, detail: "low" },
            }),
          ),
        ];
        const res = await openai.chat.completions.create({
          model: MODEL,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content }],
        });
        const parsed = safeJson(res.choices[0]?.message?.content);
        const arr: PhotoMeta[] = Array.isArray(parsed?.items) ? parsed.items : [];
        batch.forEach((b, idx) => {
          const m = arr[idx];
          if (m) out[b.id] = normalizeMeta(m);
        });
      }
      return out;
    },

    async suggestOrder(items: OrderItem[]): Promise<ReorderResult> {
      return runOrder(
        openai,
        items,
        "Reorder these photos into the most visually pleasing sequence for a social collage: vary orientation so portraits and landscapes alternate, create a gentle rhythm of brightness, and group similar colours into runs rather than scattering them.",
      );
    },

    async chatReorder(items: OrderItem[], prompt: string): Promise<ReorderResult> {
      return runOrder(
        openai,
        items,
        `Reorder these photos to match this request from the user: "${prompt}". You may also suggest a layout mode (mosaic or grid) and a density 0..1 if it fits the request.`,
      );
    },
  };
}

async function runOrder(openai: OpenAI, items: OrderItem[], instruction: string): Promise<ReorderResult> {
  const indexed = items.map((it, i) => ({
    i,
    orientation: it.orientation,
    brightness: it.meta?.brightness,
    colors: it.meta?.dominantColors,
    vibe: it.meta?.vibeTags,
    faces: it.meta?.faceCount,
  }));
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You arrange photo collages. Reply ONLY with JSON {"order":[indices],"mode":"mosaic|grid"?,"density":0..1?,"note":"one short sentence"}. The order array must be a permutation of every input index.',
      },
      { role: "user", content: `${instruction}\n\nPhotos:\n${JSON.stringify(indexed)}` },
    ],
  });
  const parsed = safeJson(res.choices[0]?.message?.content) ?? {};
  const idxOrder: number[] = Array.isArray(parsed.order) ? parsed.order : [];
  const seen = new Set<number>();
  const order: string[] = [];
  for (const idx of idxOrder) {
    if (typeof idx === "number" && items[idx] && !seen.has(idx)) {
      seen.add(idx);
      order.push(items[idx].id);
    }
  }
  // append any the model dropped, preserving original order
  items.forEach((it, i) => {
    if (!seen.has(i)) order.push(it.id);
  });
  const hints: ReorderResult["hints"] = {};
  if (parsed.mode === "mosaic" || parsed.mode === "grid") hints.mode = parsed.mode;
  if (typeof parsed.density === "number") hints.density = Math.min(1, Math.max(0, parsed.density));
  return { order, hints: Object.keys(hints).length ? hints : undefined, note: parsed.note };
}

function safeJson(text: string | null | undefined): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeMeta(m: any): PhotoMeta {
  const orientation =
    m.orientation === "portrait" || m.orientation === "landscape" || m.orientation === "square"
      ? m.orientation
      : "square";
  return {
    dominantColors: Array.isArray(m.dominantColors) ? m.dominantColors.slice(0, 3) : [],
    brightness: typeof m.brightness === "number" ? Math.min(1, Math.max(0, m.brightness)) : 0.5,
    orientation,
    faceCount: typeof m.faceCount === "number" ? m.faceCount : 0,
    vibeTags: Array.isArray(m.vibeTags) ? m.vibeTags.slice(0, 3).map(String) : [],
  };
}
