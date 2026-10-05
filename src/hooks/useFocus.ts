import { useMemo, useState } from "react";
import { buildGraphIndex } from "../lib/graph";
import type { EdgeDraft, NodeDraft } from "../lib/schema";

/**
 * POLISH focus-lineage: with a node selected, "Focus lineage" highlights its
 * ancestors + descendants (spouse-aware) and dims everything else.
 *
 * Traversal is spouse-aware using the existing graph.ts helpers:
 * - parentsOf() resolves a child's father as the husband of the mother that
 *   carries the parent edge, so Abraham's line includes both father and mother.
 * - childrenOf() counts children through spouses, so all wives' children are
 *   in the descendant set.
 * - Each ancestor's/descendant's own spouses join the line (family units).
 * - Events floating on line members float with the line.
 *
 * Highlight policy (POLISH decision, documented): LAST-WINS between focus
 * lineage and theme highlight. Theme highlight dims every non-theme node via
 * injected global CSS (ThemePanel owns that), so allowing both to dim at once
 * would fight over node opacity. Instead, activating a theme clears focus
 * highlighting and enabling Focus lineage clears the active theme; the
 * selection itself persists so either can be re-enabled instantly.
 */
export function computeLineageIds(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[],
  rootId: string
): Set<string> {
  const index = buildGraphIndex(nodes, edges);
  const ids = new Set<string>([rootId]);
  const unit = (id: string) => [id, ...index.spousesOf(id).map((s) => s.id)];

  // The root's own family unit (e.g. Abraham + Sarah + Hagar) is in the line.
  for (const member of unit(rootId)) ids.add(member);

  // Ancestors (spouse-aware) + their spouses.
  const up = [rootId];
  const seenUp = new Set<string>([rootId]);
  while (up.length > 0) {
    const id = up.shift()!;
    for (const parent of index.parentsOf(id)) {
      for (const member of unit(parent.id)) {
        ids.add(member);
        if (!seenUp.has(member)) {
          seenUp.add(member);
          up.push(member);
        }
      }
    }
  }

  // Descendants (childrenOf already counts children via spouses) + spouses.
  const down = [rootId];
  const seenDown = new Set<string>([rootId]);
  while (down.length > 0) {
    const id = down.shift()!;
    for (const child of index.childrenOf(id)) {
      for (const member of unit(child.id)) {
        ids.add(member);
        if (!seenDown.has(member)) {
          seenDown.add(member);
          down.push(member);
        }
      }
    }
  }

  // Events of the line float with it.
  for (const id of [...ids]) {
    for (const rel of index.eventsOf(id)) {
      if (rel.kind === "event") ids.add(rel.id);
    }
  }
  return ids;
}

export interface FocusApi {
  /** Selected node (drawer/canvas selection doubles as the focus root). */
  focusId: string | null;
  setFocusId(id: string | null): void;
  /** 'Focus lineage' toggle state. */
  focusActive: boolean;
  setFocusActive(active: boolean): void;
  /** Clear action: drops selection and turns focus highlighting off. */
  clearFocus(): void;
  /** Ancestors + descendants + floating events of the focused node. */
  lineageIds: ReadonlySet<string>;
}

export function useFocus(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[]
): FocusApi {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusActive, setFocusActive] = useState(false);

  const lineageIds = useMemo(
    () =>
      focusId !== null && focusActive
        ? computeLineageIds(nodes, edges, focusId)
        : new Set<string>(),
    [nodes, edges, focusId, focusActive]
  );

  const clearFocus = () => {
    setFocusActive(false);
    setFocusId(null);
  };

  return { focusId, setFocusId, focusActive, setFocusActive, clearFocus, lineageIds };
}
