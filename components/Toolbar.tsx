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
    <header className="flex items-center justify-between border-b border-line bg-paper/80 px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-[7px] bg-ink">
          <span className="grid grid-cols-2 gap-[2px]">
            <span className="h-[6px] w-[6px] rounded-[1px] bg-paper" />
            <span className="h-[6px] w-[6px] rounded-[1px] bg-clay" />
            <span className="h-[6px] w-[6px] rounded-[1px] bg-clay" />
            <span className="h-[6px] w-[6px] rounded-[1px] bg-paper" />
          </span>
        </span>
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[26px] font-semibold leading-none tracking-tight text-ink">Tessera</span>
          <span className="hidden text-xs italic text-ink-soft sm:inline">seamless collages, made to share</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-xs text-ink-soft sm:inline-flex">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-clay pulse-soft" />
          autosaved
        </span>
        <button className="btn-outline" onClick={onNew}>
          New
        </button>
      </div>
    </header>
  );
}
