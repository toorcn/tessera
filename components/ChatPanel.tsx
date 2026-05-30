"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { createOpenAiProvider } from "@/lib/ai/openai";
import type { OrderItem, ReorderResult } from "@/lib/ai/provider";

interface Msg {
  role: "you" | "tessera";
  text: string;
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ChatPanel() {
  const s = useStore();
  const [keyInput, setKeyInput] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, s.aiBusy]);

  const orientationOf = (id: string): OrderItem["orientation"] => {
    const p = s.photos[id];
    if (p?.meta) return p.meta.orientation;
    if (!p) return "square";
    return p.width < p.height ? "portrait" : p.width > p.height ? "landscape" : "square";
  };

  const orderItems = (): OrderItem[] =>
    s.order.map((id) => ({ id, meta: s.photos[id]?.meta, orientation: orientationOf(id) }));

  const saveKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    s.setApiKey(k);
    try {
      localStorage.setItem("tessera-key", k);
    } catch {
      /* ignore */
    }
    setKeyInput("");
  };

  const applyResult = (r: ReorderResult) => {
    if (r.order.length) s.reorder(r.order);
    if (r.hints?.mode) s.setMode(r.hints.mode, undefined);
    if (typeof r.hints?.density === "number") s.setDensity(r.hints.density);
    setMessages((m) => [...m, { role: "tessera", text: r.note || "Reordered your photos." }]);
  };

  const analyze = async () => {
    const need = s.order.filter((id) => s.photos[id] && !s.photos[id].meta);
    if (!need.length) {
      setMessages((m) => [...m, { role: "tessera", text: "Every photo is already analyzed." }]);
      return;
    }
    s.setAi({ analyzing: true, aiError: undefined });
    try {
      const items = await Promise.all(
        need.map(async (id) => ({ id, dataUrl: await blobUrlToDataUrl(s.photos[id].previewUrl) })),
      );
      const provider = createOpenAiProvider(s.apiKey);
      const metas = await provider.analyze(items);
      Object.entries(metas).forEach(([id, meta]) => s.setMeta(id, meta));
      setMessages((m) => [...m, { role: "tessera", text: `Analyzed ${Object.keys(metas).length} photos. Reorders will now read colour, light, and faces.` }]);
    } catch (e) {
      s.setAi({ aiError: errMsg(e) });
    }
    s.setAi({ analyzing: false });
  };

  const suggest = async () => {
    s.setAi({ aiBusy: true, aiError: undefined });
    try {
      const provider = createOpenAiProvider(s.apiKey);
      applyResult(await provider.suggestOrder(orderItems()));
    } catch (e) {
      s.setAi({ aiError: errMsg(e) });
    }
    s.setAi({ aiBusy: false });
  };

  const send = async () => {
    const p = prompt.trim();
    if (!p) return;
    setMessages((m) => [...m, { role: "you", text: p }]);
    setPrompt("");
    s.setAi({ aiBusy: true, aiError: undefined });
    try {
      const provider = createOpenAiProvider(s.apiKey);
      applyResult(await provider.chatReorder(orderItems(), p));
    } catch (e) {
      s.setAi({ aiError: errMsg(e) });
    }
    s.setAi({ aiBusy: false });
  };

  if (!s.apiKey) {
    return (
      <div className="flex h-full flex-col gap-3">
        <h3 className="field-label">Connect AI</h3>
        <p className="text-sm text-ink-soft">
          Tessera reorders your collage with your own OpenAI key. It is saved only in this browser and sent straight to OpenAI, never to us.
        </p>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="sk-..."
          className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink/40"
        />
        <button className="btn-primary" onClick={saveKey} disabled={!keyInput.trim()}>
          Save key
        </button>
        <p className="text-[11px] text-ink-soft">You can still compose, reorder by hand, and export without a key.</p>
      </div>
    );
  }

  const busy = s.aiBusy || s.analyzing;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-2">
        <h3 className="field-label">AI stylist</h3>
        <button
          className="text-[11px] text-ink-soft underline-offset-2 hover:underline"
          onClick={() => {
            s.setApiKey("");
            try {
              localStorage.removeItem("tessera-key");
            } catch {
              /* ignore */
            }
          }}
        >
          Disconnect
        </button>
      </div>

      <div className="flex gap-2 pb-2">
        <button className="btn-outline flex-1 text-xs" onClick={analyze} disabled={busy || !s.order.length}>
          {s.analyzing ? "Analyzing..." : "Analyze photos"}
        </button>
        <button className="btn-outline flex-1 text-xs" onClick={suggest} disabled={busy || s.order.length < 2}>
          Suggest order
        </button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto scroll-quiet rounded-lg border border-line bg-paper-deep/30 p-3">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-ink-soft">
            Try: &ldquo;group shots first, then close-ups&rdquo; or &ldquo;warm and candid, save the sunset for last&rdquo;.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "you" ? "text-right" : ""}>
            <span
              className={`inline-block max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                m.role === "you" ? "bg-ink text-paper" : "bg-paper text-ink border border-line"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {busy && <p className="text-sm text-ink-soft">Thinking...</p>}
        {s.aiError && <p className="text-sm text-clay-deep">{s.aiError}</p>}
      </div>

      <div className="flex gap-2 pt-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && send()}
          placeholder="Describe a style..."
          className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink/40"
        />
        <button className="btn-primary" onClick={send} disabled={busy || !prompt.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

function errMsg(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/401|invalid|api key/i.test(msg)) return "That key was rejected. Check it in the AI panel.";
  if (/429|rate/i.test(msg)) return "Rate limited by OpenAI. Wait a moment and retry.";
  return `Something went wrong: ${msg}`;
}
