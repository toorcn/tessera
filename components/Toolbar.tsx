"use client";

import { useStore } from "@/lib/store";
import { clearProject } from "@/lib/persist/db";

export default function Toolbar() {
  const newProject = useStore((s) => s.newProject);
  const count = useStore((s) => s.order.length);

  const onNew = async () => {
    if (count > 0 && !confirm("Start a new collage? This clears the current photos.")) return;
    newProject();
    await clearProject();
  };

  return (
    <header className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-2xl font-semibold tracking-tight text-ink">Tessera</span>
        <span className="hidden text-xs text-ink-soft sm:inline">seamless collages, made to share</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-ink-soft sm:inline">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-clay align-middle" /> autosaved
        </span>
        <button className="btn-outline" onClick={onNew}>
          New
        </button>
      </div>
    </header>
  );
}
