import { useCallback, useState } from "react";
import {
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export interface ToolbarProps {
  /** 'Focus lineage' toggle (disabled until a node is selected). */
  focusActive: boolean;
  hasFocusTarget: boolean;
  onToggleFocus: () => void;
  /** Clear action: selection + focus highlighting. */
  onClearFocus: () => void;
  showEvents: boolean;
  onToggleShowEvents: () => void;
  showSideCharacters: boolean;
  onToggleShowSideCharacters: () => void;
  onExpandAll: () => void;
}

const ERA_BAND_PREFIX = "era-band-";

/**
 * Whole-graph export via html-to-image, following the @xyflow/react
 * "download image" example (verified against reactflow.dev/examples/misc/
 * download-image): capture `.react-flow__viewport` and set the capture
 * transform from getNodesBounds + getViewportForBounds so the PNG covers the
 * whole graph regardless of the current on-screen viewport. Era-band nodes are
 * excluded from the bounds (their fixed band height would add dead space) and
 * the capture background is forced white. UI chrome (minimap/controls) lives
 * outside the viewport element, so it is excluded automatically.
 *
 * SVG export uses html-to-image's toSvg (no extra dependency). Its output
 * embeds HTML via <foreignObject>, which some non-browser renderers (e.g.
 * librsvg-based tools) ignore — fine for browsers/design tools, noted as a
 * caveat in the button tooltip.
 */
function captureGraph(
  nodes: Node[],
  kind: "png" | "svg"
): { dataUrl: Promise<string>; width: number; height: number } | null {
  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el || nodes.length === 0) return null;

  const bounds = getNodesBounds(nodes.filter((n) => !n.id.startsWith(ERA_BAND_PREFIX)));
  const pad = 48;
  const width = Math.max(Math.ceil(bounds.width + pad * 2), 1);
  const height = Math.max(Math.ceil(bounds.height + pad * 2), 1);
  const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, pad / width);
  const options = {
    backgroundColor: "#ffffff",
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  };
  const dataUrl =
    kind === "png" ? toPng(el, options) : toSvg(el, options);
  return { dataUrl, width, height };
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

const btn =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
const btnOn =
  "rounded-md border border-slate-800 bg-slate-800 px-2.5 py-1.5 text-sm text-white shadow-sm transition hover:bg-slate-700";

/** POLISH toolbar: focus + collapse + toggles + export. */
export default function Toolbar({
  focusActive,
  hasFocusTarget,
  onToggleFocus,
  onClearFocus,
  showEvents,
  onToggleShowEvents,
  showSideCharacters,
  onToggleShowSideCharacters,
  onExpandAll,
}: ToolbarProps) {
  const { getNodes } = useReactFlow();
  const [busy, setBusy] = useState<"png" | "svg" | null>(null);

  const exportImage = useCallback(
    async (kind: "png" | "svg") => {
      setBusy(kind);
      try {
        const capture = captureGraph(getNodes(), kind);
        if (!capture) return;
        const date = new Date().toISOString().slice(0, 10);
        download(await capture.dataUrl, `bible-lineage-${date}.${kind}`);
      } finally {
        setBusy(null);
      }
    },
    [getNodes]
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-md">
        <span className="pr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Focus
        </span>
        <button
          className={focusActive ? btnOn : btn}
          aria-pressed={focusActive}
          disabled={!hasFocusTarget}
          title={
            hasFocusTarget
              ? "Highlight the selected node's ancestors + descendants, dim the rest"
              : "Select a node first"
          }
          onClick={onToggleFocus}
        >
          Focus lineage
        </button>
        <button
          className={btn}
          disabled={!hasFocusTarget && !focusActive}
          title="Clear the selection and focus highlighting"
          onClick={onClearFocus}
        >
          Clear
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button
          className={showEvents ? btnOn : btn}
          aria-pressed={showEvents}
          title="Show or hide floating event cards (re-runs layout)"
          onClick={onToggleShowEvents}
        >
          Show events
        </button>
        <button
          className={showSideCharacters ? btnOn : btn}
          aria-pressed={showSideCharacters}
          title="Show or hide side characters like Lot (re-runs layout)"
          onClick={onToggleShowSideCharacters}
        >
          Show side characters
        </button>
        <button
          className={btn}
          title="Expand every collapsed subtree"
          onClick={onExpandAll}
        >
          Expand all
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button
          className={btn}
          disabled={busy !== null}
          title="Export the whole graph as a PNG (fit-view capture)"
          onClick={() => exportImage("png")}
        >
          {busy === "png" ? "Exporting…" : "Export PNG"}
        </button>
        <button
          className={btn}
          disabled={busy !== null}
          title="Export the whole graph as SVG (HTML-embedded; some non-browser renderers skip it)"
          onClick={() => exportImage("svg")}
        >
          {busy === "svg" ? "Exporting…" : "Export SVG"}
        </button>
      </div>
    </div>
  );
}
