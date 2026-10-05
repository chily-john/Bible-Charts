import type { Edge, Node } from "@xyflow/react";
import type { EdgeDraft, NodeDraft } from "./schema";
import type { Position } from "./layout";
import { EVENT_SIZE, PERSON_SIZE } from "./sizes";

const EDGE_STYLE: Record<EdgeDraft["type"], React.CSSProperties> = {
  spouse: { stroke: "#64748b", strokeWidth: 2 },
  parent: { stroke: "#334155", strokeWidth: 2 },
  encounter: { stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: "2 6" },
  event: { stroke: "#a16207", strokeWidth: 1, strokeDasharray: "6 4" },
};

const ARROW_TYPES: Record<EdgeDraft["type"], boolean> = {
  spouse: false,
  parent: true,
  encounter: false,
  event: false,
};

/** Convert validated graph data + computed layout into React Flow elements. */
export function toFlowElements(
  nodes: readonly NodeDraft[],
  edges: readonly EdgeDraft[],
  layout: Map<string, Position>
): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = nodes.map((n, i) => {
    const size = n.kind === "person" ? PERSON_SIZE : EVENT_SIZE;
    return {
      id: n.id,
      type: n.kind,
      position: layout.get(n.id) ?? { x: (i % 6) * (size.width + 60), y: Math.floor(i / 6) * 220 },
      data: { label: n.label, subtitle: n.subtitle },
    };
  });

  const rfEdges: Edge[] = edges.map((e, i) => ({
    id: `edge-${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label,
    style: EDGE_STYLE[e.type],
    markerEnd: ARROW_TYPES[e.type]
      ? { type: "arrowclosed" as const, color: EDGE_STYLE[e.type].stroke as string }
      : undefined,
  }));

  return { nodes: rfNodes, edges: rfEdges };
}