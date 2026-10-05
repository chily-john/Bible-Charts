import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import eraDefs from "../data/eras.json";
import { eraBaseRank } from "./graph";
import {
  ERA_BAND_HEADER,
  ERA_BAND_PADDING,
  EVENT_GAP,
  EVENT_SIZE,
  EVENT_SLOT_DX,
  FREE_NODE_GAP,
  PERSON_SIZE,
  RANK_GAP,
  SPOUSE_GAP,
  UNIT_GAP,
} from "./sizes";

/*
 * LAYOUT RULES R1–R6 (LOCKED). Read before touching this file.
 *
 * R1 RANK=GENERATION: rank(node) = longest parent-edge chain from founders
 *     (rank 0 = Adam/Eve; founders = no incoming parent edge). Siblings share
 *     parents so they share a rank by construction. Spouse components are
 *     lifted to their max member rank (wives sit in the husband's rank).
 *     Encounter-only persons (Lot) inherit their anchor's rank. Event nodes
 *     have NO rank (R4). y is FIXED by rank:
 *         y = rank * (PERSON_SIZE.height + RANK_GAP)
 *     ELK is used ONLY to order x WITHIN a rank (one partition per rank).
 *     A post-pass pins every y to the rank formula, so ELK can NEVER move a
 *     node across ranks or reassign layers. No hand-positioning anywhere.
 *
 * R2 NO COMPACTNESS OPTIMIZATION (explicit user requirement — precise
 *     arrangement beats flowchart compactness). ELK options are chosen to
 *     disable/shrink anything that trades correctness for short edges:
 *       - elk.algorithm = org.eclipse.elk.layered
 *         (top-down layered; required for partition support)
 *       - elk.direction = DOWN on root AND every child
 *         (pure top-down; no LR variant can leak in)
 *       - elk.partitioning.activate = true, one partition per GENERATION rank
 *         (elk.partitioning.partition = `${rank}` on each child; partitions
 *         stack top-down for direction DOWN, so ELK orders x within a rank
 *         and can never pull a node into another rank's layer)
 *       - elk.layered.layering.strategy = INTERACTIVE
 *         (respects partitions/model order; NO layer reassignment to shorten
 *         edges — long edges such as canaan->nimrod "~gap" stay long & clean)
 *       - elk.layered.crossingMinimization.strategy = INTERACTIVE
 *         (conservative, WITHIN-rank only; respects input order, no
 *         aggressive sweeps that break edge-order)
 *       - elk.layered.nodePlacement.strategy = INTERACTIVE
 *         (no edge-length-driven placement across ranks; Brandes-Koepf would
 *         trade rank purity for short edges, so it is deliberately NOT used)
 *       - elk.layered.considerModelOrder.strategy = NODES_AND_EDGES
 *         (R6: children/edges are fed to ELK pre-sorted by the R5/R6 key, and
 *         ELK must respect that order instead of reordering for compactness)
 *       - elk.layered.cycleBreaking.strategy = GREEDY
 *         (parent graph is a DAG — validation rejects parent cycles — so this
 *         is a formality; GREEDY is the minimal non-reordering choice)
 *       - elk.edgeRouting = ORTHOGONAL (clean top-down edges; edge shape never
 *         feeds back into placement because y is pinned post-pass)
 *       - elk.spacing.nodeNode / nodeNodeBetweenLayers = fixed gaps only
 *         (uniform breathing room; between-layers spacing is informational —
 *         final y pitch is always PERSON_SIZE.height + RANK_GAP)
 *
 * R3 ONLY spouse+parent AFFECT POSITION: the ELK input graph is built from
 *     spouse edges (merged into family-unit nodes) + parent edges ONLY.
 *     encounter/event edges are excluded from the ELK pass entirely and are
 *     routed post-pass as straight lines between computed positions
 *     (encounter=dotted, event=thin muted long-dash, never dark solid).
 *
 * R4 EVENTS FLOAT, NEVER RANK: event nodes are NOT in the ELK pass.
 *     Post-pass placement beside/below the first anchor person with a
 *     per-anchor slot offset so multiple events never stack. the_fall anchors
 *     Adam+Eve (same row) → placed between/below the pair. the_flood → Noah,
 *     babel → Nimrod. (cain_abel was DELETED — that story lives in Cain/Abel
 *     markdown + Gen 4 refs.)
 *
 * R5 CENTERED DESCENT; OFFSHOOTS PEEL RIGHT (amended): within-rank x is
 *     anchored to the family column, NOT left-packed. Each family unit's
 *     children are centered under the unit's x (unit x = mean of member
 *     positions), so a single main child sits exactly under its parent unit
 *     and the main bloodline (Adam-Seth-Noah-Shem-Abraham-Isaac-Jacob-Judah)
 *     reads as near-vertical columns. Offshoot subtrees (roots marked
 *     lineage:false — Cain line, Canaan/Nimrod, Ishmael/Esau) peel RIGHT of
 *     the main column at the same rank and their descendants stay with
 *     them. The within-rank ORDER key is still (rank, lineage true-first,
 *     edge-order index in graph.json, id); Lot-like floaters sit right of
 *     everything on their rank. Two passes: pass 1 = existing ELK/R5 order
 *     as a seed only; pass 2 = top-down centering from founders with a
 *     per-rank overlap sweep (subtrees shift right, never across ranks).
 *     No left-right mode, no special casing.
 *
 * R6 EDGE ORDER IS LAW: spouse-edge order in graph.json = wife left-to-right
 *     (member order inside a family unit); parent edges grouped by mother then
 *     birth order = sibling order. Layout derives order ONLY from these
 *     (plus the R5 key). See docs/DATA_GUIDE.md.
 *
 * R7 ERA STACKING (era-aware rank floors): rank is era-aware. Founder nodes
 *     (no incoming parent edge) get baseRank = 1 + max rank of all nodes in
 *     strictly earlier eras (era order from eras.json; the earliest era
 *     present keeps base 0 so R1's "rank 0 = Adam/Eve" holds). Generation
 *     rank then accumulates +1 per parent step within the component, so a
 *     new era's roots stack BELOW the previous era's floor (exodus roots sit
 *     under the patriarchs floor, not beside Adam/Eve) and future eras stack
 *     likewise. Multi-era components keep their computed rank — the parent
 *     chain wins over the era floor — and EraBand boxes (pure bounding boxes
 *     of member ranks, never shifts) stretch to contain them. y stays
 *     rank * (PERSON_SIZE.height + RANK_GAP).
 */

export interface LayoutNode {
  id: string;
  kind: "person" | "event";
  era: string;
  /** Present at runtime (App passes full node drafts). Defaults true, except
   *  parent-/spouse-disconnected persons (e.g. Lot) which default false so
   *  they sort right per R5 without an App.tsx change. */
  lineage?: boolean;
}

export interface LayoutEdge {
  from: string;
  to: string;
  type: "spouse" | "parent" | "encounter" | "event";
}

export interface Position {
  x: number;
  y: number;
}

/** Screen-space rectangle of one era band (rendered behind the era's nodes). */
export interface EraBandRect {
  era: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult extends Map<string, Position> {
  bands: EraBandRect[];
}

interface FamilyUnit {
  id: string;
  members: string[];
  era: string;
  width: number;
  height: number;
}

// Canvas reads the bands produced by the last computeLayout() call (it only
// receives the flat React Flow node/edge lists, so it cannot see them otherwise).
let lastBands: EraBandRect[] = [];
export function getLastEraBands(): readonly EraBandRect[] {
  return lastBands;
}

const sizeOf = (n: LayoutNode) => (n.kind === "person" ? PERSON_SIZE : EVENT_SIZE);

/** Vertical pitch between generation ranks (R1). */
export const rankY = (rank: number): number => rank * (PERSON_SIZE.height + RANK_GAP);

/**
 * Strict top-down generation-ranked layout (R1–R6).
 *
 * 1. rank() from parent edges with R7 era floors (founder comps start at
 *    their era's floor); spouse components share max rank; Lot-like
 *    encounter-only persons inherit their anchor's rank; events are rankless.
 * 2. ELK sees ONLY spouse+parent structure (family units + parent edges),
 *    one partition per rank, conservative options (see header) — x within a
 *    rank only.
 * 3. Post-pass: y pinned to rankY(rank); x by R5 centered descent (pass 1 =
 *    ELK/R5 seed order, pass 2 = children centered under their parent unit,
 *    offshoot subtrees peeled right of the main column); events + off-graph
 *    persons floated beside/below anchors, never stacked.
 */
export async function computeLayout(
  visibleNodes: readonly LayoutNode[],
  visibleEdges: readonly LayoutEdge[]
): Promise<LayoutResult> {
  const positions = new Map<string, Position>();
  const result: LayoutResult = Object.assign(positions, { bands: [] as EraBandRect[] });
  if (visibleNodes.length === 0) {
    lastBands = [];
    return result;
  }

  const nodeById = new Map(visibleNodes.map((n) => [n.id, n]));
  const edgeIndex = new Map<LayoutEdge, number>();
  visibleEdges.forEach((e, i) => edgeIndex.set(e, i));

  // R7: era order from eras.json (unknown eras keep first-appearance order
  // after the known ones). Bands and era floors both follow this order.
  const eraIndex = new Map<string, number>();
  eraDefs.forEach((e, i) => eraIndex.set(e.id, i));
  const appearance: string[] = [];
  for (const n of visibleNodes) if (!appearance.includes(n.era)) appearance.push(n.era);
  const eraOrder = [...appearance].sort((a, b) => {
    const ia = eraIndex.get(a);
    const ib = eraIndex.get(b);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return appearance.indexOf(a) - appearance.indexOf(b);
  });

  // ---- 1. Generation ranks (R1) -------------------------------------------
  // Spouse components collapse first (wives join the husband's component),
  // then rank = longest parent-edge path over the component DAG. This keeps
  // children of a spouse-only parent correct (Ishmael via Hagar sits one
  // below Abraham's component, not at rank 1). Spouse-only persons (Sarah/
  // Hagar) and founders (Adam/Eve) fall out naturally; encounter-only
  // persons (Lot) and childless comps inherit their anchor's rank below.
  const personNodes = visibleNodes.filter((n) => n.kind === "person");

  const spouseNeighbors = new Map<string, string[]>();
  for (const e of visibleEdges) {
    if (e.type !== "spouse") continue;
    if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
    if (!spouseNeighbors.has(e.from)) spouseNeighbors.set(e.from, []);
    if (!spouseNeighbors.has(e.to)) spouseNeighbors.set(e.to, []);
    spouseNeighbors.get(e.from)!.push(e.to);
    spouseNeighbors.get(e.to)!.push(e.from);
  }
  const compOf = new Map<string, number>();
  const compMembers: string[][] = [];
  {
    const seen = new Set<string>();
    for (const n of personNodes) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      const members: string[] = [];
      const queue = [n.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        members.push(id);
        compOf.set(id, compMembers.length);
        for (const nb of spouseNeighbors.get(id) ?? []) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }
      compMembers.push(members);
    }
  }
  // Longest parent-edge path over the component DAG (cycle-safe).
  const compParents = new Map<number, Set<number>>();
  const compParentEdgeCount = new Map<number, number>();
  for (const e of visibleEdges) {
    if (e.type !== "parent") continue;
    const cu = compOf.get(e.from);
    const cv = compOf.get(e.to);
    if (cu === undefined || cv === undefined || cu === cv) continue;
    if (!compParents.has(cv)) compParents.set(cv, new Set());
    compParents.get(cv)!.add(cu);
    compParentEdgeCount.set(cu, (compParentEdgeCount.get(cu) ?? 0) + 1);
    compParentEdgeCount.set(cv, (compParentEdgeCount.get(cv) ?? 0) + 1);
  }
  const compRankMemo = new Map<number, number>();
  const eraBaseMemo = new Map<string, number>();
  // R7 ERA STACKING: a founder component (no incoming parent edge) starts at
  // its era's floor — baseRank = 1 + max rank of all nodes in strictly
  // earlier eras (eraBaseRank helper) — so a new era's roots stack BELOW the
  // previous era's floor instead of sharing rank 0 with Adam/Eve. Generation
  // rank then accumulates +1 per parent step within the component. Multi-era
  // components keep their computed rank: the parent chain wins over the era
  // floor (e.g. Eber stays one below Shem). Cycle-safe like the raw pass.
  const eraBaseOf = (era: string, stack: Set<string>): number => {
    const hit = eraBaseMemo.get(era);
    if (hit !== undefined) return hit;
    const key = `era:${era}`;
    if (stack.has(key)) return 0; // era-crossing edge: break, don't hang
    stack.add(key);
    const base = eraBaseRank(era, eraOrder, personNodes, (id) => {
      const c = compOf.get(id);
      return c === undefined ? 0 : compRankOf(c, stack);
    });
    stack.delete(key);
    eraBaseMemo.set(era, base);
    return base;
  };
  const compRankOf = (c: number, stack: Set<string>): number => {
    const hit = compRankMemo.get(c);
    if (hit !== undefined) return hit;
    const key = `comp:${c}`;
    if (stack.has(key)) return 0;
    const parents = compParents.get(c);
    if (!parents || parents.size === 0) {
      // Founder component: max era floor over its members (R7).
      const top = Math.max(
        ...compMembers[c].map((id) => eraBaseOf(nodeById.get(id)!.era, stack)),
        0
      );
      compRankMemo.set(c, top);
      return top;
    }
    stack.add(key);
    let best = 0;
    for (const p of parents) best = Math.max(best, compRankOf(p, stack));
    stack.delete(key);
    compRankMemo.set(c, best + 1);
    return best + 1;
  };
  const rank = new Map<string, number>();
  compMembers.forEach((members, c) => {
    const r = compRankOf(c, new Set());
    for (const id of members) rank.set(id, r);
  });
  const incidentStructural = new Map<string, number>();
  for (const e of visibleEdges) {
    if (e.type !== "spouse" && e.type !== "parent") continue;
    incidentStructural.set(e.from, (incidentStructural.get(e.from) ?? 0) + 1);
    incidentStructural.set(e.to, (incidentStructural.get(e.to) ?? 0) + 1);
  }
  const anchorRankOf = (id: string): number | undefined => {
    for (const e of visibleEdges) {
      if (e.type !== "encounter" && e.type !== "event") continue;
      const other = e.from === id ? e.to : e.to === id ? e.from : undefined;
      if (other === undefined) continue;
      const r = rank.get(other);
      if (r !== undefined && nodeById.get(other)?.kind === "person") return r;
    }
    return undefined;
  };
  for (const n of personNodes) {
    // A comp with no parent-edge incidence has no DAG rank of its own, so an
    // encounter/event anchor lends it one (Lot joins Abraham's rank). Ranked
    // comps (incl. every spouse comp with a parent link) keep theirs.
    const comp = compOf.get(n.id);
    if (comp !== undefined && (compParentEdgeCount.get(comp) ?? 0) === 0) {
      const inherited = anchorRankOf(n.id);
      if (inherited !== undefined) rank.set(n.id, inherited);
    }
  }

  // Effective lineage for the R5 key: explicit flag wins; otherwise a
  // structural person defaults true, a disconnected floater (Lot) false.
  const lineageOf = (id: string): boolean => {
    const explicit = nodeById.get(id)?.lineage;
    if (explicit !== undefined) return explicit;
    return (incidentStructural.get(id) ?? 0) > 0;
  };

  // Edge-order index per node (R6): min index over incident spouse/parent
  // edges in graph.json order. Siblings share a mother → birth order falls
  // out of the parent-edge indices; wives fall out of spouse-edge indices.
  const orderIndexOf = (id: string): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const e of visibleEdges) {
      if (e.type !== "spouse" && e.type !== "parent") continue;
      if (e.from !== id && e.to !== id) continue;
      best = Math.min(best, edgeIndex.get(e) ?? Number.POSITIVE_INFINITY);
    }
    return best;
  };
  const orderIndex = new Map<string, number>();
  for (const n of visibleNodes) orderIndex.set(n.id, orderIndexOf(n.id));

  // ---- 2. Family units (spouse components; R3/R6: wife order = row order) --
  const unitOf = new Map<string, string>();
  const units: FamilyUnit[] = [];
  {
    const seen = new Set<string>();
    for (const n of personNodes) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      // FIFO walk keeps row order: husband first, wives in spouse-edge order.
      const members: string[] = [];
      const queue = [n.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        members.push(id);
        for (const nb of spouseNeighbors.get(id) ?? []) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }
      const widths = members.map((id) => sizeOf(nodeById.get(id)!).width);
      const heights = members.map((id) => sizeOf(nodeById.get(id)!).height);
      const unit: FamilyUnit = {
        id: `unit__${members.join("__")}`,
        members,
        era: nodeById.get(members[0])!.era,
        width: widths.reduce((a, b) => a + b, 0) + SPOUSE_GAP * (members.length - 1),
        height: Math.max(...heights),
      };
      units.push(unit);
      for (const id of members) unitOf.set(id, unit.id);
    }
  }
  const unitById = new Map(units.map((u) => [u.id, u]));
  const unitRank = new Map<string, number>();
  for (const u of units) {
    unitRank.set(u.id, Math.max(...u.members.map((id) => rank.get(id) ?? 0)));
  }
  // R5 within-rank key for a unit: lineage true-first (any member true keeps
  // the family on the main side), then min edge-order index, then id.
  const unitKey = (u: FamilyUnit): [number, number, number, string] => [
    unitRank.get(u.id) ?? 0,
    u.members.some((id) => lineageOf(id)) ? 0 : 1,
    Math.min(...u.members.map((id) => orderIndex.get(id) ?? Number.POSITIVE_INFINITY)),
    u.id,
  ];
  const cmpKey = (
    a: [number, number, number, string],
    b: [number, number, number, string]
  ): number =>
    a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0);

  // ---- 3. ELK input: spouse+parent ONLY (R3), one partition per rank (R1) --
  // Parent edges only; encounter/event edges must NOT influence placement.
  const elkEdges: NonNullable<ElkNode["edges"]> = [];
  {
    const seenPair = new Set<string>();
    for (const e of visibleEdges) {
      if (e.type !== "parent") continue;
      const su = unitOf.get(e.from);
      const tu = unitOf.get(e.to);
      if (!su || !tu || su === tu) continue;
      const key = `${su}->${tu}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      elkEdges.push({ id: `pe${elkEdges.length}`, sources: [su], targets: [tu] });
    }
  }

  // Only structurally connected units take part in ELK x-ordering. Floaters
  // (Lot) and ALL event cards are placed in the post-pass (R4/R5) so they can
  // never be layered, stacked, or drag a rank.
  const layeredUnits = new Set<string>();
  for (const u of units) {
    if (u.members.length > 1) {
      layeredUnits.add(u.id);
      continue;
    }
    const id = u.members[0];
    if ((incidentStructural.get(id) ?? 0) > 0) layeredUnits.add(u.id);
  }
  // Parent edges between layered units only (a floater can never be an ELK
  // endpoint — it has no parent edges by construction).
  const layeredElkEdges = elkEdges.filter(
    (e) => layeredUnits.has(e.sources[0]) && layeredUnits.has(e.targets[0])
  );

  // Children pre-sorted by the R5 key; with considerModelOrder NODES_AND_EDGES
  // ELK respects data order instead of reordering for compactness (R2/R6).
  const sortedLayered = units
    .filter((u) => layeredUnits.has(u.id))
    .sort((a, b) => cmpKey(unitKey(a), unitKey(b)));
  const elkChildren: ElkNode[] = sortedLayered.map((u) => ({
    id: u.id,
    width: u.width,
    height: u.height,
    layoutOptions: {
      "elk.direction": "DOWN",
      // ONE PARTITION PER GENERATION RANK (R1): ELK orders x within a
      // partition and can never move a node across ranks.
      "elk.partitioning.partition": `${unitRank.get(u.id) ?? 0}`,
    },
  }));
  // Edges in graph.json order (R6: edge order is law).
  layeredElkEdges.sort((a, b) => {
    const ia = Number(a.id.slice(2));
    const ib = Number(b.id.slice(2));
    return ia - ib;
  });

  const root: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "org.eclipse.elk.layered",
      "elk.direction": "DOWN",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.partitioning.activate": "true",
      "elk.spacing.nodeNode": `${SPOUSE_GAP * 2}`,
      "elk.layered.spacing.nodeNodeBetweenLayers": `${RANK_GAP}`,
      "elk.layered.cycleBreaking.strategy": "GREEDY",
      "elk.layered.layering.strategy": "INTERACTIVE",
      "elk.layered.crossingMinimization.strategy": "INTERACTIVE",
      "elk.layered.nodePlacement.strategy": "INTERACTIVE",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: elkChildren,
    edges: layeredElkEdges,
  };

  const elk = new ELK();
  const laidOut: { children?: ElkNode[] } =
    elkChildren.length > 0 ? await elk.layout(root) : {};
  const elkX = new Map<string, number>();
  for (const g of laidOut.children ?? []) elkX.set(g.id, g.x ?? 0);

  // ---- 4. Within-rank x: R5 CENTERED DESCENT (two passes) -----------------
  // PASS 1 (seed only): existing R5 order — ELK x when it already agrees with
  // the R5/R6 key, else a left-packed re-seat (data order is law).
  // PASS 2 (authoritative): ranks top-down from founders. Each family unit's
  // children are centered under the unit's x ("family column"); offshoot
  // subtrees (roots with lineage:false) peel RIGHT of the main column at
  // their rank and stay together. A per-rank overlap sweep shifts subtrees
  // right — never across ranks (R1/R2).
  const seedX = new Map<string, number>();
  const rowOrder = new Map<number, FamilyUnit[]>();
  {
    // Group layered units per rank.
    const byRank = new Map<number, FamilyUnit[]>();
    for (const u of sortedLayered) {
      const r = unitRank.get(u.id) ?? 0;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(u);
    }
    for (const [r, group] of byRank) {
      // ELK x-order within the rank…
      const byElkX = [...group].sort((a, b) => (elkX.get(a.id) ?? 0) - (elkX.get(b.id) ?? 0));
      // …must agree with the R5 data key; if ELK ever swaps, data wins.
      const r5 = [...group].sort((a, b) => cmpKey(unitKey(a), unitKey(b)));
      const agrees = byElkX.every((u, i) => u.id === r5[i].id);
      const ordered = agrees ? byElkX : r5;
      rowOrder.set(r, ordered);
      if (agrees) {
        for (const u of ordered) seedX.set(u.id, elkX.get(u.id) ?? 0);
      } else {
        let x = Math.min(...group.map((u) => elkX.get(u.id) ?? 0));
        for (const u of ordered) {
          seedX.set(u.id, x);
          x += u.width + UNIT_GAP;
        }
      }
    }
  }

  // Unit anchor = mean of member centers ("unit x = mean of member
  // positions"); member widths are uniform in practice, but this is computed
  // generally.
  const memberOffset = (u: FamilyUnit): number => {
    let sum = 0;
    let dx = 0;
    for (const id of u.members) {
      const w = sizeOf(nodeById.get(id)!).width;
      sum += dx + w / 2;
      dx += w + SPOUSE_GAP;
    }
    return sum / u.members.length;
  };
  const unitCenter = (u: FamilyUnit, x: number): number => x + memberOffset(u);

  // Parent units per unit (parent edges only, R3).
  const parentUnitsOf = new Map<string, string[]>();
  for (const e of visibleEdges) {
    if (e.type !== "parent") continue;
    const su = unitOf.get(e.from);
    const tu = unitOf.get(e.to);
    if (!su || !tu || su === tu) continue;
    const list = parentUnitsOf.get(tu) ?? [];
    if (!list.includes(su)) list.push(su);
    parentUnitsOf.set(tu, list);
  }

  // R5 offshoot: a unit is inside an offshoot subtree when it is lineage:false
  // or descends from one. The topmost such unit (the root) peels right and its
  // descendants stay with it. Rows are processed top-down (parents always sit
  // at a strictly lower rank), so one pass resolves the flags.
  const unitMain = (u: FamilyUnit): boolean => u.members.some((id) => lineageOf(id));
  const inOffshoot = new Map<string, boolean>();

  const finalX = new Map<string, number>();
  const rows = [...rowOrder.keys()].sort((a, b) => a - b);
  for (const r of rows) {
    const row = rowOrder.get(r)!;
    const rowMain: FamilyUnit[] = [];
    const rowOffRoot: FamilyUnit[] = [];
    const rowOffRest: FamilyUnit[] = [];
    for (const u of row) {
      const parents = parentUnitsOf.get(u.id) ?? [];
      const off = !unitMain(u) || parents.some((p) => inOffshoot.get(p) === true);
      inOffshoot.set(u.id, off);
      if (!off) rowMain.push(u);
      else if (!unitMain(u) && parents.every((p) => inOffshoot.get(p) !== true)) rowOffRoot.push(u);
      else rowOffRest.push(u);
    }

    // Desired x: each family unit's children centered under the unit's x
    // (children sharing a parent set form one centered group). Offshoot roots
    // are set after the main column is known (peel right).
    const desired = new Map<string, number>();
    const groups = new Map<string, FamilyUnit[]>();
    for (const u of [...rowMain, ...rowOffRest]) {
      const parents = (parentUnitsOf.get(u.id) ?? []).filter((p) => finalX.has(p));
      if (parents.length === 0) {
        desired.set(u.id, seedX.get(u.id) ?? 0); // founders keep the pass-1 seed
        continue;
      }
      const key = parents.join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(u);
    }
    for (const [key, members] of groups) {
      const parents = key.split("|");
      const anchor =
        parents.reduce(
          (sum, p) => sum + unitCenter(unitById.get(p)!, finalX.get(p)!),
          0
        ) / parents.length;
      const total =
        members.reduce((w, u) => w + u.width, 0) + UNIT_GAP * (members.length - 1);
      let x = anchor - total / 2;
      for (const u of members) {
        desired.set(u.id, x);
        x += u.width + UNIT_GAP;
      }
    }

    // Left-to-right overlap sweep (subtrees shift right; R5/R6 order is law).
    const sweep = (list: FamilyUnit[], minX: number): number => {
      const sorted = [...list].sort(
        (a, b) =>
          (desired.get(a.id) ?? 0) - (desired.get(b.id) ?? 0) ||
          cmpKey(unitKey(a), unitKey(b))
      );
      let prevRight = minX - UNIT_GAP;
      for (const u of sorted) {
        const x = Math.max(desired.get(u.id) ?? 0, prevRight + UNIT_GAP);
        finalX.set(u.id, x);
        prevRight = x + u.width;
      }
      return prevRight;
    };

    // Main column first …
    const mainRight = sweep(rowMain, Number.NEGATIVE_INFINITY);
    // … then offshoot subtrees peel RIGHT of it at the same rank (R5).
    let peelMin = mainRight;
    if (!Number.isFinite(peelMin)) {
      // No main column on this rank: peel right of the offshoot's parents.
      peelMin = Number.NEGATIVE_INFINITY;
      for (const u of [...rowOffRoot, ...rowOffRest]) {
        for (const p of parentUnitsOf.get(u.id) ?? []) {
          if (!finalX.has(p)) continue;
          peelMin = Math.max(peelMin, finalX.get(p)! + unitById.get(p)!.width);
        }
      }
    }
    const peelBase = Number.isFinite(peelMin) ? peelMin + FREE_NODE_GAP : Number.NEGATIVE_INFINITY;
    for (const u of rowOffRoot) {
      const base = seedX.get(u.id) ?? 0;
      desired.set(u.id, peelBase === Number.NEGATIVE_INFINITY ? base : Math.max(base, peelBase));
    }
    sweep([...rowOffRoot, ...rowOffRest], peelBase);
  }

  // Commit units: y PINNED by rank (R1); x from the descent pass (R5).
  const expandUnit = (unit: FamilyUnit, x0: number, y0: number) => {
    let x = x0;
    for (const id of unit.members) {
      positions.set(id, { x, y: y0 });
      x += sizeOf(nodeById.get(id)!).width + SPOUSE_GAP;
    }
  };
  for (const [r, row] of rowOrder) {
    const y = rankY(r);
    for (const u of row) expandUnit(u, finalX.get(u.id) ?? seedX.get(u.id) ?? 0, y);
  }

  // ---- 5. Floater persons (Lot): anchor rank, right side, same row (R5) ----
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  const notePlaced = (id: string) => {
    const p = positions.get(id);
    if (!p) return;
    const s = sizeOf(nodeById.get(id)!);
    placed.push({ x: p.x, y: p.y, width: s.width, height: s.height });
  };
  for (const u of units) if (layeredUnits.has(u.id)) for (const id of u.members) notePlaced(id);

  const overlaps = (x: number, y: number, w: number, h: number): boolean =>
    placed.some(
      (r) =>
        x < r.x + r.width + SPOUSE_GAP &&
        x + w + SPOUSE_GAP > r.x &&
        y < r.y + r.height + SPOUSE_GAP &&
        y + h + SPOUSE_GAP > r.y
    );
  const shiftRightUntilClear = (x: number, y: number, w: number, h: number): number => {
    let guard = 0;
    while (guard++ < 500 && overlaps(x, y, w, h)) x += w + SPOUSE_GAP * 2;
    return x;
  };

  for (const u of units) {
    if (layeredUnits.has(u.id)) continue;
    const id = u.members[0];
    const r = rank.get(id) ?? 0;
    const y = rankY(r);
    // Right of everything already on this rank (R5: off-lineage goes right).
    let right = 0;
    for (const q of placed) {
      if (Math.abs(q.y - y) < 1) right = Math.max(right, q.x + q.width);
    }
    const x = shiftRightUntilClear(
      right > 0 ? right + FREE_NODE_GAP : 0,
      y,
      u.width,
      u.height
    );
    expandUnit(u, x, y);
    for (const m of u.members) notePlaced(m);
  }

  // ---- 6. Floating events (R4): beside/below first anchor, slotted ---------
  const anchorsOf = (eventId: string): string[] => {
    const out: string[] = [];
    for (const e of visibleEdges) {
      if (e.type !== "event" || e.to !== eventId) continue;
      if (nodeById.get(e.from)?.kind === "person" && positions.has(e.from)) out.push(e.from);
    }
    return out;
  };
  const slotsPerAnchor = new Map<string, number>();
  for (const n of visibleNodes) {
    if (n.kind !== "event") continue;
    const anchors = anchorsOf(n.id);
    if (anchors.length === 0) continue; // orphan event: leave at fallback below
    const s = EVENT_SIZE;
    // Multi-anchor events on one row (the_fall: Adam+Eve) sit between/below
    // the pair; otherwise the event floats below its first anchor with a
    // per-anchor lateral slot so sibling events never stack.
    const rows = new Set(anchors.map((a) => positions.get(a)!.y));
    let x: number;
    let y: number;
    if (rows.size === 1) {
      const cx =
        anchors.reduce((sum, a) => {
          const p = positions.get(a)!;
          return sum + p.x + sizeOf(nodeById.get(a)!).width / 2;
        }, 0) / anchors.length;
      const anchorY = positions.get(anchors[0])!.y;
      const anchorH = sizeOf(nodeById.get(anchors[0])!).height;
      x = cx - s.width / 2;
      y = anchorY + anchorH + EVENT_GAP;
    } else {
      const a = anchors[0];
      const p = positions.get(a)!;
      const anchorSize = sizeOf(nodeById.get(a)!);
      const slot = slotsPerAnchor.get(a) ?? 0;
      const dir = slot === 0 ? 0 : slot % 2 === 1 ? 1 : -1;
      const step = Math.ceil(slot / 2);
      x = p.x + anchorSize.width / 2 - s.width / 2 + dir * step * EVENT_SLOT_DX;
      y = p.y + anchorSize.height + EVENT_GAP;
    }
    const first = anchors[0];
    slotsPerAnchor.set(first, (slotsPerAnchor.get(first) ?? 0) + 1);
    // Events may touch their anchor row (they hang off it by an edge) but
    // must never cover a card: exact-rect guard, no breathing-room padding,
    // so the_fall stays between/below Adam+Eve instead of shoved far right.
    let guard = 0;
    while (
      guard++ < 500 &&
      placed.some((r) => x < r.x + r.width && x + s.width > r.x && y < r.y + r.height && y + s.height > r.y)
    ) {
      x += s.width + SPOUSE_GAP;
    }
    positions.set(n.id, { x, y });
    placed.push({ x, y, width: s.width, height: s.height });
  }

  // ---- 7. Normalize x to a 0-based canvas (uniform shift only) ------------
  // Centered descent can push columns negative; shift everything right so the
  // leftmost card starts at x = 0. A uniform dx never crosses ranks (R1/R2)
  // and never changes within-rank order or centering (R5).
  let minX = Number.POSITIVE_INFINITY;
  for (const p of positions.values()) minX = Math.min(minX, p.x);
  if (Number.isFinite(minX) && minX !== 0) {
    for (const p of positions.values()) p.x -= minX;
  }

  // ---- 8. Era bands: bounding boxes only — NEVER shift nodes (R1/R7) ------
  // A node's y belongs to its rank. Eras stack (R7) but multi-era components
  // keep their computed rank (patriarch Eber sits at rank 7 among primordial
  // ranks), so bands may stretch/overlap; that is correct — rank beats era.
  // No dy shifting, ever.
  const eraNodeIds = new Map<string, string[]>();
  for (const n of visibleNodes) {
    if (!positions.has(n.id)) continue;
    if (!eraNodeIds.has(n.era)) eraNodeIds.set(n.era, []);
    eraNodeIds.get(n.era)!.push(n.id);
  }
  const bands: EraBandRect[] = [];
  for (const era of eraOrder) {
    const ids = eraNodeIds.get(era) ?? [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const id of ids) {
      const p = positions.get(id);
      if (!p) continue;
      const s = sizeOf(nodeById.get(id)!);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s.width);
      maxY = Math.max(maxY, p.y + s.height);
    }
    if (!Number.isFinite(minY)) continue;
    bands.push({
      era,
      x: minX - ERA_BAND_PADDING,
      y: minY - ERA_BAND_PADDING - ERA_BAND_HEADER,
      width: maxX - minX + 2 * ERA_BAND_PADDING,
      height: maxY - minY + 2 * ERA_BAND_PADDING + ERA_BAND_HEADER,
    });
  }

  result.bands = bands;
  lastBands = bands;
  return result;
}
