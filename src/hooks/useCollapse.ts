import { useCallback, useMemo, useState } from "react";
import { computeHiddenIds, computeSideCharacterIds } from "../lib/graph";
import type { EdgeDraft, NodeDraft } from "../lib/schema";

/**
 * POLISH collapse/expand + visibility toggles.
 *
 * - `collapsed` holds person ids whose descendant subtrees are hidden (the
 *   collapsed card itself stays). Default: all expanded (Wave 0 graph).
 * - `showEvents` / `showSideCharacters` are the toolbar toggles; hiding a kind
 *   re-runs layout because the app filters nodes+edges from `hiddenIds` and
 *   recomputes. Lineage order is preserved automatically: ranks are
 *   generation-based (longest parent-edge chain), and toggling events/side
 *   characters removes no parent/spouse edges, so every remaining person keeps
 *   the exact rank and sibling order it had before.
 * - `hiddenIds` is recomputed from scratch on every change, so expanding (or
 *   re-enabling a toggle) restores the previous node set exactly.
 */
export interface CollapseApi {
  collapsed: ReadonlySet<string>;
  isCollapsed(id: string): boolean;
  toggleCollapse(id: string): void;
  /** Toolbar 'Expand all'. */
  expandAll(): void;
  /** Toolbar 'Show events' toggle. */
  showEvents: boolean;
  toggleShowEvents(): void;
  /** Toolbar 'Show side characters' toggle. */
  showSideCharacters: boolean;
  toggleShowSideCharacters(): void;
  /** Node ids hidden by the current collapse/toggle state. */
  hiddenIds: ReadonlySet<string>;
  /** Side characters (Lot-like floaters), independent of toggles. */
  sideIds: ReadonlySet<string>;
}

export function useCollapse(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[]
): CollapseApi {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [showEvents, setShowEvents] = useState(true);
  const [showSideCharacters, setShowSideCharacters] = useState(true);

  const hiddenIds = useMemo(
    () => computeHiddenIds(nodes, edges, { collapsed, showEvents, showSideCharacters }),
    [nodes, edges, collapsed, showEvents, showSideCharacters]
  );

  const sideIds = useMemo(() => computeSideCharacterIds(nodes, edges), [nodes, edges]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const toggleShowEvents = useCallback(() => setShowEvents((v) => !v), []);
  const toggleShowSideCharacters = useCallback(
    () => setShowSideCharacters((v) => !v),
    []
  );

  return {
    collapsed,
    isCollapsed: (id: string) => collapsed.has(id),
    toggleCollapse,
    expandAll,
    showEvents,
    toggleShowEvents,
    showSideCharacters,
    toggleShowSideCharacters,
    hiddenIds,
    sideIds,
  };
}
