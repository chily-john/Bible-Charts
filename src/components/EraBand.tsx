import { ERA_BAND } from "../lib/sizes";

export interface EraBandProps {
  label: string;
  width?: number;
  height?: number;
}

/**
 * Labeled background band rendered behind one era's nodes (registered by
 * Canvas as the `eraBand` node type with `zIndex: -1`). Size comes from the
 * era's computed layout bounding box (see computeLayout's `bands`).
 */
export default function EraBand({
  label,
  width = ERA_BAND.width,
  height = ERA_BAND.height,
}: EraBandProps) {
  return (
    <div
      className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60"
      style={{ width, height, pointerEvents: "none" }}
    >
      <div className="px-3 pt-2 text-sm font-medium tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}
