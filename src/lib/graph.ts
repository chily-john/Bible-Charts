import type { EdgeDraft, NodeDraft, Span, Theme } from "./schema";

/**
 * Pure graph traversal helpers for the drawer, search, and theme panel.
 * Parent edges point parent -> child. Spouse edges are undirected.
 * Traversal is spouse-aware: a child's "father" is the husband of the mother
 * that carries the parent edge (the recorded parent edge source is treated as
 * the mother when that person has a spouse).
 */
export type Relation =
  | "spouse"
  | "mother"
  | "father"
  | "parent"
  | "child"
  | "event"
  | "participant"
  | "encounter";

export interface RelatedNode {
  id: string;
  label: string;
  subtitle?: string;
  kind: NodeDraft["kind"];
  relation: Relation;
}

export interface GraphIndex {
  nodes: ReadonlyMap<string, NodeDraft>;
  edges: readonly EdgeDraft[];
  getNode(id: string): NodeDraft | undefined;
  spousesOf(id: string): NodeDraft[];
  /** mother/father/parent links for a child node. */
  parentsOf(id: string): RelatedNode[];
  /** children via this node and via its spouses. */
  childrenOf(id: string): RelatedNode[];
  eventsOf(id: string): RelatedNode[];
  encountersOf(id: string): RelatedNode[];
  /** All related nodes, deduped, ordered spouse, parents, children, events, encounters. */
  related(id: string): RelatedNode[];
  /** Nodes carrying a theme tag. */
  nodesForTheme(themeId: string): NodeDraft[];
  /** Themes a node is tagged with. */
  themesOf(node: NodeDraft, themes: readonly Theme[]): Theme[];
}

/** Display a span like `Gen 12:1-Gen 25:10`, or `—` when unknown. */
export function formatSpan(span: Span | null | undefined): string {
  if (!span) return "—";
  return span.start === span.end ? span.start : `${span.start}–${span.end}`;
}

export function buildGraphIndex(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[]
): GraphIndex {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Undirected spouse adjacency.
  const spouseIds = new Map<string, string[]>();
  // parent -> children and child -> parents (parent edges only).
  const childIdsByParent = new Map<string, string[]>();
  const parentIdsByChild = new Map<string, string[]>();
  // person -> event ids (event edges).
  const eventIdsByPerson = new Map<string, string[]>();
  const personIdsByEvent = new Map<string, string[]>();
  // undirected encounter adjacency.
  const encounterIds = new Map<string, string[]>();

  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const e of edges) {
    switch (e.type) {
      case "spouse":
        push(spouseIds, e.from, e.to);
        push(spouseIds, e.to, e.from);
        break;
      case "parent":
        push(childIdsByParent, e.from, e.to);
        push(parentIdsByChild, e.to, e.from);
        break;
      case "event":
        push(eventIdsByPerson, e.from, e.to);
        push(personIdsByEvent, e.to, e.from);
        break;
      case "encounter":
        push(encounterIds, e.from, e.to);
        push(encounterIds, e.to, e.from);
        break;
    }
  }

  const toNode = (id: string): NodeDraft | undefined => nodeById.get(id);

  const toRelated = (id: string, relation: Relation): RelatedNode | undefined => {
    const n = toNode(id);
    if (!n) return undefined;
    return { id: n.id, label: n.label, subtitle: n.subtitle, kind: n.kind, relation };
  };

  const spousesOf = (id: string): NodeDraft[] =>
    (spouseIds.get(id) ?? []).map(toNode).filter((n): n is NodeDraft => n !== undefined);

  const parentsOf = (id: string): RelatedNode[] => {
    const out: RelatedNode[] = [];
    const seen = new Set<string>();
    for (const parentId of parentIdsByChild.get(id) ?? []) {
      const parent = toNode(parentId);
      if (!parent || seen.has(parentId)) continue;
      seen.add(parentId);
      const spouses = spousesOf(parentId);
      if (spouses.length > 0) {
        // Recorded parent-edge source is the mother; her husband(s) are the father(s).
        out.push({ id: parent.id, label: parent.label, subtitle: parent.subtitle, kind: parent.kind, relation: "mother" });
        for (const spouse of spouses) {
          if (seen.has(spouse.id)) continue;
          seen.add(spouse.id);
          out.push({ id: spouse.id, label: spouse.label, subtitle: spouse.subtitle, kind: spouse.kind, relation: "father" });
        }
      } else {
        out.push({ id: parent.id, label: parent.label, subtitle: parent.subtitle, kind: parent.kind, relation: "parent" });
      }
    }
    return out;
  };

  const childrenOf = (id: string): RelatedNode[] => {
    const out: RelatedNode[] = [];
    const seen = new Set<string>();
    const parentIds = [id, ...(spouseIds.get(id) ?? [])];
    for (const parentId of parentIds) {
      for (const childId of childIdsByParent.get(parentId) ?? []) {
        if (seen.has(childId)) continue;
        const rel = toRelated(childId, "child");
        if (rel) {
          seen.add(childId);
          out.push(rel);
        }
      }
    }
    return out;
  };

  const eventsOf = (id: string): RelatedNode[] => {
    const node = toNode(id);
    if (!node) return [];
    const out: RelatedNode[] = [];
    const seen = new Set<string>();
    const add = (otherId: string, relation: Relation) => {
      if (seen.has(otherId)) return;
      const rel = toRelated(otherId, relation);
      if (rel) {
        seen.add(otherId);
        out.push(rel);
      }
    };
    if (node.kind === "event") {
      for (const personId of personIdsByEvent.get(id) ?? []) add(personId, "participant");
    } else {
      for (const eventId of eventIdsByPerson.get(id) ?? []) add(eventId, "event");
    }
    return out;
  };

  const encountersOf = (id: string): RelatedNode[] => {
    const out: RelatedNode[] = [];
    const seen = new Set<string>();
    for (const otherId of encounterIds.get(id) ?? []) {
      if (seen.has(otherId)) continue;
      const rel = toRelated(otherId, "encounter");
      if (rel) {
        seen.add(otherId);
        out.push(rel);
      }
    }
    return out;
  };

  const related = (id: string): RelatedNode[] => {
    const ordered: Relation[] = [
      "spouse",
      "mother",
      "father",
      "parent",
      "child",
      "event",
      "participant",
      "encounter",
    ];
    const byRelation = new Map<Relation, RelatedNode[]>();
    const collect = (rel: Relation, list: RelatedNode[]) => {
      byRelation.set(rel, [...(byRelation.get(rel) ?? []), ...list]);
    };
    collect("spouse", (spouseIds.get(id) ?? []).map((sid) => toRelated(sid, "spouse")).filter((r): r is RelatedNode => r !== undefined));
    const parents = parentsOf(id);
    collect("mother", parents.filter((p) => p.relation === "mother"));
    collect("father", parents.filter((p) => p.relation === "father"));
    collect("parent", parents.filter((p) => p.relation === "parent"));
    collect("child", childrenOf(id));
    const events = eventsOf(id);
    collect("event", events.filter((e) => e.relation === "event"));
    collect("participant", events.filter((e) => e.relation === "participant"));
    collect("encounter", encountersOf(id));

    const out: RelatedNode[] = [];
    const seen = new Set<string>();
    for (const relation of ordered) {
      for (const rel of byRelation.get(relation) ?? []) {
        if (seen.has(rel.id) || rel.id === id) continue;
        seen.add(rel.id);
        out.push(rel);
      }
    }
    return out;
  };

  const nodesForTheme = (themeId: string): NodeDraft[] =>
    nodes.filter((n) => n.tags.includes(themeId));

  const themesOf = (node: NodeDraft, themes: readonly Theme[]): Theme[] =>
    themes.filter((t) => node.tags.includes(t.id));

  return {
    nodes: nodeById,
    edges,
    getNode: toNode,
    spousesOf,
    parentsOf,
    childrenOf,
    eventsOf,
    encountersOf,
    related,
    nodesForTheme,
    themesOf,
  };
}

// ---------------------------------------------------------------------------
// POLISH: visibility (collapse + toggles) — hidden-set computation.
// ---------------------------------------------------------------------------

export interface VisibilityOptions {
  /** Person ids whose descendant subtrees are collapsed. */
  collapsed?: ReadonlySet<string>;
  /** Toolbar 'Show events' toggle (default true). */
  showEvents?: boolean;
  /** Toolbar 'Show side characters' toggle (default true). */
  showSideCharacters?: boolean;
}

/**
 * Side characters are off-lineage persons floated beside the graph (Lot):
 * persons with no incident spouse/parent edges at all, anchored to the graph
 * only by encounter/event links. Note this is NOT the `lineage` flag — that
 * flag marks non-main branches (Cain's line, Canaan, Nimrod) for layout
 * ordering and those stay regular graph people.
 */
export function computeSideCharacterIds(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[]
): Set<string> {
  const structural = new Set<string>();
  for (const e of edges) {
    if (e.type === "spouse" || e.type === "parent") {
      structural.add(e.from);
      structural.add(e.to);
    }
  }
  const out = new Set<string>();
  for (const n of nodes) {
    if (n.kind === "person" && !structural.has(n.id)) out.add(n.id);
  }
  return out;
}

/**
 * Compute the set of node ids hidden by the current collapse/toggle state.
 *
 * - Collapsing a person hides every spouse-aware transitive descendant
 *   (children of anyone in the hidden family unit, matching childrenOf) plus
 *   spouses who married into the hidden subtree. The collapsed card itself
 *   (and its spouses) stay visible.
 * - Events and side floaters attached to hidden people hide with them.
 * - The 'Show events' / 'Show side characters' toggles hide those kinds
 *   outright.
 *
 * Hiding is recomputed from scratch on every state change, so expanding (or
 * toggling back on) restores the exact prior node set. Callers filter both
 * nodes and any edge touching a hidden node, then re-run the layout.
 */
export function computeHiddenIds(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[],
  options: VisibilityOptions = {}
): Set<string> {
  const {
    collapsed = new Set<string>(),
    showEvents = true,
    showSideCharacters = true,
  } = options;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const spouseIds = new Map<string, string[]>();
  const childIdsByParent = new Map<string, string[]>();
  const personIdsByEvent = new Map<string, string[]>();
  const encounterIds = new Map<string, string[]>();

  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const e of edges) {
    switch (e.type) {
      case "spouse":
        push(spouseIds, e.from, e.to);
        push(spouseIds, e.to, e.from);
        break;
      case "parent":
        push(childIdsByParent, e.from, e.to);
        break;
      case "event":
        push(personIdsByEvent, e.to, e.from);
        break;
      case "encounter":
        push(encounterIds, e.from, e.to);
        push(encounterIds, e.to, e.from);
        break;
    }
  }

  const hidden = new Set<string>();

  // 1. Collapsed subtrees (the collapsed card itself stays).
  for (const rootId of collapsed) {
    if (!nodeById.has(rootId)) continue;
    const rootSpouses = new Set(spouseIds.get(rootId) ?? []);
    const queue: string[] = [];
    const processed = new Set<string>();
    const enqueue = (id: string) => {
      if (!processed.has(id)) queue.push(id);
    };
    for (const seed of [rootId, ...rootSpouses]) {
      for (const c of childIdsByParent.get(seed) ?? []) enqueue(c);
    }
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (processed.has(id)) continue;
      processed.add(id);
      hidden.add(id);
      for (const c of childIdsByParent.get(id) ?? []) enqueue(c);
      // Spouses who married into the subtree hide with it, and their children
      // (via any partner) are spouse-aware descendants of the subtree.
      for (const sp of spouseIds.get(id) ?? []) {
        if (sp === rootId || rootSpouses.has(sp) || processed.has(sp)) continue;
        hidden.add(sp);
        for (const c of childIdsByParent.get(sp) ?? []) enqueue(c);
      }
    }
  }

  // 2. Attached events + side floaters follow their people; toggles hide a
  //    whole kind outright.
  const sideIds = computeSideCharacterIds(nodes, edges);
  for (const n of nodes) {
    if (n.kind === "event") {
      const attached = (personIdsByEvent.get(n.id) ?? []).some((p) => hidden.has(p));
      if (!showEvents || attached) hidden.add(n.id);
    } else if (sideIds.has(n.id)) {
      const attached = (encounterIds.get(n.id) ?? []).some((x) => hidden.has(x));
      if (!showSideCharacters || attached) hidden.add(n.id);
    }
  }

  return hidden;
}

/**
 * R7 ERA STACKING helper (owned by the layout-rules task).
 *
 * baseRank for founder nodes (no incoming parent edge) = 1 + max rank of all
 * nodes in STRICTLY EARLIER eras, where "earlier" follows the era order from
 * src/data/eras.json and `rankOf` yields a node's FINAL rank (the layout's
 * spouse-component-lifted rank). The earliest era present keeps base 0, so R1
 * (rank 0 = Adam/Eve) is preserved; generation rank then accumulates +1 per
 * parent step within the component from that base. Returns 0 for the earliest
 * era present or an era with no visible earlier-era nodes.
 */
export function eraBaseRank(
  era: string,
  eraOrder: readonly string[],
  nodes: readonly { id: string; era?: string }[],
  rankOf: (id: string) => number
): number {
  const idx = eraOrder.indexOf(era);
  if (idx <= 0) return 0; // earliest era present: founders stay at rank 0
  let best = -1;
  for (const n of nodes) {
    const ni = eraOrder.indexOf(n.era ?? "");
    if (ni < 0 || ni >= idx) continue; // strictly earlier eras only
    best = Math.max(best, rankOf(n.id));
  }
  return best + 1;
}

/**
 * R1 RANK=GENERATION helper (owned by the layout-rules task).
 *
 * rank(node) = longest parent-edge chain from founders. Founders (no incoming
 * parent edge) are rank 0 here — this is the RAW pass; R7 era floors (founder
 * baseRank = 1 + max rank of strictly earlier eras, see eraBaseRank) and
 * spouse-component lifting are applied by the layout's component pass.
 * Every other node is 1 + max(rank of its parents).
 * Siblings share parents, so they share a rank by construction. Spouse-only
 * persons (no parent edges at all, e.g. Sarah/Hagar) score 0 here — the
 * layout pass lifts each spouse component to its max member rank, so wives
 * sit in their husband's rank. Encounter-only persons (Lot) also score 0
 * here and inherit their anchor's rank in the layout pass. Cycle-safe
 * (validation forbids parent cycles; a repeated node on the DFS stack
 * contributes 0 rather than recursing forever).
 */
export function computeGenerationRank(
  nodes: readonly { id: string }[],
  edges: readonly { from: string; to: string; type: string }[]
): Map<string, number> {
  const parentIdsByChild = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "parent") continue;
    const list = parentIdsByChild.get(e.to);
    if (list) list.push(e.from);
    else parentIdsByChild.set(e.to, [e.from]);
  }
  const ids = new Set(nodes.map((n) => n.id));
  const memo = new Map<string, number>();
  const rankOf = (id: string, stack: Set<string>): number => {
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    if (stack.has(id)) return 0; // parent cycle: break, don't hang
    const parents = (parentIdsByChild.get(id) ?? []).filter((p) => ids.has(p));
    if (parents.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    stack.add(id);
    let best = 0;
    for (const p of parents) best = Math.max(best, rankOf(p, stack));
    stack.delete(id);
    memo.set(id, best + 1);
    return best + 1;
  };
  for (const n of nodes) rankOf(n.id, new Set());
  return memo;
}
