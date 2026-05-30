"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { loadProject, saveProject } from "@/lib/persist/db";
import Toolbar from "@/components/Toolbar";
import Tray from "@/components/Tray";
import Canvas from "@/components/Canvas";
import Inspector from "@/components/Inspector";
import TextEditor from "@/components/TextEditor";
import ChatPanel from "@/components/ChatPanel";

type RightTab = "design" | "text" | "ai";
type MobilePanel = "none" | "photos" | "design" | "text" | "ai";

export default function Page() {
  const [rightTab, setRightTab] = useState<RightTab>("design");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("none");
  const setApiKey = useStore((s) => s.setApiKey);

  // restore saved project + key once on mount
  useEffect(() => {
    loadProject().catch(() => {});
    try {
      const k = localStorage.getItem("tessera-key");
      if (k) setApiKey(k);
    } catch {
      /* ignore */
    }
  }, [setApiKey]);

  // debounced autosave on any persisted change
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsub = useStore.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => saveProject(), 600);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const rightPanel = (tab: RightTab) =>
    tab === "design" ? <Inspector /> : tab === "text" ? <TextEditor /> : <ChatPanel />;

  return (
    <div className="flex h-[100dvh] flex-col bg-paper">
      <Toolbar />

      {/* Desktop: three panes */}
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[300px_1fr_340px] lg:gap-0">
        <aside className="min-h-0 border-r border-line p-4">
          <Tray />
        </aside>
        <main className="min-h-0">
          <Canvas />
        </main>
        <aside className="flex min-h-0 flex-col border-l border-line p-4">
          <div className="seg mb-3">
            <button data-active={rightTab === "design"} onClick={() => setRightTab("design")}>
              Design
            </button>
            <button data-active={rightTab === "text"} onClick={() => setRightTab("text")}>
              Text
            </button>
            <button data-active={rightTab === "ai"} onClick={() => setRightTab("ai")}>
              AI
            </button>
          </div>
          <div className="min-h-0 flex-1">{rightPanel(rightTab)}</div>
        </aside>
      </div>

      {/* Mobile: canvas + bottom sheet */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <main className="min-h-0 flex-1">
          <Canvas />
        </main>

        {mobilePanel !== "none" && (
          <div className="max-h-[60dvh] overflow-hidden border-t border-line bg-paper p-4 shadow-panel">
            <div className="mb-2 flex justify-end">
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setMobilePanel("none")}>
                Close
              </button>
            </div>
            <div className="h-[48dvh]">
              {mobilePanel === "photos" && <Tray />}
              {mobilePanel === "design" && <Inspector />}
              {mobilePanel === "text" && <TextEditor />}
              {mobilePanel === "ai" && <ChatPanel />}
            </div>
          </div>
        )}

        <nav className="grid grid-cols-4 border-t border-line bg-paper">
          {(["photos", "design", "text", "ai"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setMobilePanel((cur) => (cur === p ? "none" : p))}
              data-active={mobilePanel === p}
              className="py-3 text-xs font-medium capitalize text-ink-soft data-[active=true]:bg-paper-deep data-[active=true]:text-ink"
            >
              {p}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
