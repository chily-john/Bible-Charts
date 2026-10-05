import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlowProvider, type Edge } from "@xyflow/react";
import eras from "./data/eras.json";
import themes from "./data/themes.json";
import graph from "./data/graph.json";
import { computeLayout } from "./lib/layout";
import { toFlowElements } from "./lib/flow";
import { validateGraph, type Issue } from "./lib/validate";
import { themeColorFor } from "./lib/themeColors";
import type { EdgeDraft, GraphFile, NodeDraft } from "./lib/schema";
import { useCenterNode } from "./hooks/useCenterNode";
import { useCollapse } from "./hooks/useCollapse";
import { useFocus } from "./hooks/useFocus";
import { useGraphIndex } from "./hooks/useGraphIndex";
import Canvas, { type EdgeUi, type NodeUi } from "./components/Canvas";
import Drawer from "./components/Drawer";
import ThemePanel from "./components/ThemePanel";
import Search from "./components/Search";
import Toolbar from "./components/Toolbar";

// Which content markdown exists (Wave 0 has only 2 stubs).
const contentModules = import.meta.glob("./content/**/*.md", { query: "?raw" });

// JSON import widens literal types; cast for typed use (validateGraph checks shape at runtime).
const graphData = graph as unknown as GraphFile;

function buildContentIndex() {
  const people = new Set<string>();
  const events = new Set<string>();
  for (const path of Object.keys(contentModules)) {
    const m = /\/content\/(people|events)\/([^/]+)\.md$/.exec(path);
    if (!m) continue;
    (m[1] === "people" ? people : events).add(m[2]);
  }
  return { people, events };
}

function ErrorOverlay({ errors }: { errors: Issue[] }) {
  return (
    <div className="absolute inset-0 z-20 overflow-auto bg-rose-50 p-8">
      <h1 className="text-lg font-semibold text-rose-800">
        Data errors — render blocked ({errors.length})
      </h1>
      <ul className="mt-4 space-y-1 font-mono text-sm text-rose-900">
        {errors.map((e, i) => (
          <li key={i}>
            <span className="font-semibold">{e.file}</span> · {e.id} · {e.problem}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * POLISH per-mother accents: in multi-wife family units (a spouse component
 * where some member has 2+ spouses) each mother (the recorded parent-edge
 * source is the mother) gets a muted color; her parent edges and her
 * children's cards pick it up. Single-wife families are unaffected.
 */
const MOTHER_COLORS = ["#8c6d5c", "#3f7a70", "#7a5c8c", "#8c8c3f"];

function computeMotherAccents(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[]
): Map<string, string> {
  const spouseIds = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };
  for (const e of edges) {
    if (e.type === "spouse") {
      push(spouseIds, e.from, e.to);
      push(spouseIds, e.to, e.from);
    } else if (e.type === "parent") {
      push(childrenByParent, e.from, e.to);
    }
  }

  const accent = new Map<string, string>();
  const seen = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== "person" || seen.has(n.id)) continue;
    const comp: string[] = [];
    const queue = [n.id];
    seen.add(n.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      comp.push(id);
      for (const sp of spouseIds.get(id) ?? []) {
        if (!seen.has(sp)) {
          seen.add(sp);
          queue.push(sp);
        }
      }
    }
    const multiWife = comp.some((id) => (spouseIds.get(id) ?? []).length > 1);
    if (!multiWife) continue;
    const mothers = comp.filter((id) => (childrenByParent.get(id) ?? []).length > 0);
    mothers.forEach((mother, i) => {
      const color = MOTHER_COLORS[i % MOTHER_COLORS.length];
      accent.set(mother, color);
      for (const c of childrenByParent.get(mother) ?? []) accent.set(c, color);
    });
  }
  return accent;
}

function Explorer() {
  const [query, setQuery] = useState("");
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const centerNode = useCenterNode();
  const index = useGraphIndex();

  // POLISH state: focus lineage (selection + toggle) and collapse/toggles.
  const focus = useFocus(graphData.nodes, graphData.edges);
  const collapse = useCollapse(graphData.nodes, graphData.edges);

  const validation = useMemo(
    () => validateGraph(graphData, eras, themes, buildContentIndex()),
    []
  );

  // Hide-set -> visible nodes/edges -> layout. Collapsing or toggling changes
  // `visible`, which re-runs computeLayout (clean re-layout). Lineage order is
  // preserved automatically: ranks are generation-based and no parent/spouse
  // edge is removed by the toggles, so remaining people keep rank + sibling
  // order exactly.
  const visible = useMemo(() => {
    const nodes = graphData.nodes.filter((n) => !collapse.hiddenIds.has(n.id));
    const edges = graphData.edges.filter(
      (e) => !collapse.hiddenIds.has(e.from) && !collapse.hiddenIds.has(e.to)
    );
    return { nodes, edges };
  }, [collapse.hiddenIds]);

  useEffect(() => {
    if (validation.errors.length > 0) return;
    let cancelled = false;
    computeLayout(visible.nodes, visible.edges).then((p) => {
      if (!cancelled) setPositions(p);
    });
    return () => {
      cancelled = true;
    };
  }, [validation.errors.length, visible]);

  const { nodes, edges } = useMemo(
    () => toFlowElements(visible.nodes, visible.edges, positions),
    [visible, positions]
  );

  // Per-mother accents + per-node overlay state for the canvas.
  const accentByPerson = useMemo(
    () => computeMotherAccents(graphData.nodes, graphData.edges),
    []
  );
  const themeIdList = useMemo(() => themes.map((t) => t.id), []);

  const nodeUi = useMemo(() => {
    const out = new Map<string, NodeUi>();
    for (const n of visible.nodes) {
      out.set(n.id, {
        // Focus policy: last-wins with theme highlight (enabling one turns the
        // other off), so dimming never fights ThemePanel's injected CSS.
        dim: focus.focusActive && !focus.lineageIds.has(n.id),
        lineage: focus.focusActive && focus.lineageIds.has(n.id),
        side: collapse.sideIds.has(n.id),
        accent: accentByPerson.get(n.id) ?? null,
        collapsed: collapse.collapsed.has(n.id),
        hasChildren: n.kind === "person" && index.childrenOf(n.id).length > 0,
        onToggleCollapse: collapse.toggleCollapse,
        themeDots: n.tags.map((t) => themeColorFor(themeIdList, t)),
      });
    }
    return out;
  }, [
    visible.nodes,
    focus.focusActive,
    focus.lineageIds,
    collapse.sideIds,
    collapse.collapsed,
    collapse.toggleCollapse,
    accentByPerson,
    index,
    themeIdList,
  ]);

  const edgeUi = useCallback(
    (e: Edge): EdgeUi | undefined => {
      const isParent = Boolean(e.markerEnd);
      const inside =
        focus.lineageIds.has(e.source) && focus.lineageIds.has(e.target);
      return {
        accent: isParent ? accentByPerson.get(e.source) ?? null : null,
        dim: focus.focusActive && !inside,
      };
    },
    [accentByPerson, focus.focusActive, focus.lineageIds]
  );

  /** Open a node and center the canvas on it (search hits, jump links, theme lists). */
  const jumpToNode = (id: string) => {
    focus.setFocusId(id);
    centerNode(id);
  };

  /** Last-wins highlight policy: enabling focus clears the active theme. */
  const toggleFocus = () => {
    if (!focus.focusActive) setActiveTheme(null);
    focus.setFocusActive(!focus.focusActive);
  };

  /** Last-wins highlight policy: activating a theme suspends focus dimming. */
  const selectTheme = (id: string | null) => {
    if (id) focus.setFocusActive(false);
    setActiveTheme(id);
  };

  /**
   * Node clicks: delegate from the canvas wrapper via the React Flow node
   * wrapper's data-id, so the drawer opens without canvas-component coupling.
   * Overlay controls (collapse +/-, theme dots, event badge) opt out with
   * data-no-drawer.
   */
  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("[data-no-drawer]")) return;
    const el = (e.target as Element).closest<HTMLElement>(".react-flow__node[data-id]");
    const id = el?.getAttribute("data-id");
    if (id) focus.setFocusId(id);
  };

  return (
    <div className="relative h-screen w-screen">
      {validation.errors.length > 0 ? (
        <ErrorOverlay errors={validation.errors} />
      ) : (
        <>
          <div className="absolute left-4 top-4 z-10 flex flex-col items-start gap-3 rounded-lg bg-white/90 p-3 shadow">
            <div className="flex items-center gap-3">
              <Search
                value={query}
                onChange={setQuery}
                themes={themes}
                onSelectNode={jumpToNode}
                onSelectTheme={(id) =>
                  selectTheme(activeTheme === id ? null : id)
                }
              />
            </div>
            <ThemePanel
              themes={themes}
              active={activeTheme}
              onActivate={selectTheme}
              onSelectNode={jumpToNode}
            />
          </div>
          <div className="absolute right-4 top-4 z-10">
            <Toolbar
              focusActive={focus.focusActive}
              hasFocusTarget={focus.focusId !== null}
              onToggleFocus={toggleFocus}
              onClearFocus={focus.clearFocus}
              showEvents={collapse.showEvents}
              onToggleShowEvents={collapse.toggleShowEvents}
              showSideCharacters={collapse.showSideCharacters}
              onToggleShowSideCharacters={collapse.toggleShowSideCharacters}
              onExpandAll={collapse.expandAll}
            />
          </div>
          <div className="absolute inset-0" onClickCapture={handleCanvasClick}>
            <Canvas nodes={nodes} edges={edges} ui={nodeUi} edgeUi={edgeUi} />
          </div>
          <Drawer
            nodeId={focus.focusId}
            onClose={focus.clearFocus}
            onJump={jumpToNode}
            onThemeSelect={(id) => selectTheme(activeTheme === id ? null : id)}
            themes={themes}
          />
          {validation.warnings.length > 0 ? (
            <div className="absolute bottom-3 left-4 z-10 rounded bg-amber-50/90 px-3 py-1 text-xs text-amber-800">
              {validation.warnings.length} warning(s) — see `npm run validate`
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Explorer />
    </ReactFlowProvider>
  );
}
