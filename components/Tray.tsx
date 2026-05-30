"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "@/lib/store";

const MAX_PHOTOS = 50;

function Thumb({ id, index }: { id: string; index: number }) {
  const photo = useStore((s) => s.photos[id]);
  const removePhoto = useStore((s) => s.removePhoto);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  if (!photo) return null;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, animationDelay: `${Math.min(index, 24) * 22}ms` }}
      className={`group fade-up relative aspect-square overflow-hidden rounded-md border border-line bg-paper-deep transition-shadow ${
        isDragging ? "z-10 opacity-80 shadow-panel ring-1 ring-clay/50" : "hover:shadow-tile"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.previewUrl}
        alt={photo.name}
        loading="lazy"
        decoding="async"
        className="h-full w-full cursor-grab touch-none object-cover active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />
      <button
        onClick={() => removePhoto(id)}
        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-paper group-hover:flex"
        aria-label="Remove photo"
      >
        <span className="text-xs leading-none">x</span>
      </button>
      {photo.meta && photo.meta.faceCount > 0 && (
        <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1 text-[9px] font-medium text-paper">
          {photo.meta.faceCount} {photo.meta.faceCount === 1 ? "face" : "faces"}
        </span>
      )}
    </div>
  );
}

export default function Tray() {
  const order = useStore((s) => s.order);
  const addFiles = useStore((s) => s.addFiles);
  const reorder = useStore((s) => s.reorder);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, Math.max(0, MAX_PHOTOS - order.length));
    if (!arr.length) return;
    setLoading(true);
    await addFiles(arr);
    setLoading(false);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as string);
    const newIndex = order.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    reorder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="field-label">Photos {order.length > 0 && `· ${order.length}/${MAX_PHOTOS}`}</h2>
        {order.length > 0 && (
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => inputRef.current?.click()}>
            Add more
          </button>
        )}
      </div>

      <div
        className={`relative min-h-0 flex-1 overflow-y-auto scroll-quiet rounded-lg border border-dashed p-2 transition-colors ${
          dragOver ? "border-clay bg-paper-deep" : "border-line"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {order.length === 0 ? (
          <button
            className="flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-2 text-center"
            onClick={() => inputRef.current?.click()}
          >
            <span className="font-display text-lg text-ink">Drop photos here</span>
            <span className="text-sm text-ink-soft">or click to browse. Up to {MAX_PHOTOS} images.</span>
          </button>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                {order.map((id, i) => (
                  <Thumb key={id} id={id} index={i} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {loading && (
          <div className="absolute inset-x-0 bottom-0 bg-paper/90 py-2 text-center text-xs text-ink-soft">
            Processing photos...
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="px-1 pt-2 text-[11px] text-ink-soft">Drag thumbnails to reorder. Click a photo on the canvas to set its focus.</p>
    </div>
  );
}
