import {
  useMemo,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  ReactFlow,
  Position as RFPosition,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import eras from "../data/eras.json";
import { getLastEraBands } from "../lib/layout";
import { EVENT_SIZE, PERSON_SIZE } from "../lib/sizes";
import PersonCard from "./PersonCard";
import EventCard from "./EventCard";
import EraBand, { type EraBandProps } from "./EraBand";

export interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  /** Per-node overlay info (collapse control, accents, theme dots, dimming). */
  ui?: ReadonlyMap<string, NodeUi>;
  /** Per-edge overrides (per-mother accent, focus-lineage dimming). */
  edgeUi?: (edge: Edge) => EdgeUi | undefined;
}

/** POLISH per-node overlay state, supplied by App via node data. */
export interface NodeUi {
  /** Outside the focused lineage while focus is on: dimmed. */
  dim?: boolean;
  /** Inside the focused lineage while focus is on: highlighted. */
  lineage?: boolean;
  /** Side character (Lot-like floater): dashed muted outline. */
  side?: boolean;
  /** Per-mother muted accent (multi-wife families). */
  accent?: string | null;
  collapsed?: boolean;
  hasChildren?: boolean;
  onToggleCollapse?: (id: string) => void;
  /** Theme dot colors with '+n' overflow. */
  themeDots?: string[];
}

export interface EdgeUi {
  accent?: string | null;
  dim?: boolean;
}

type Side = "top" | "bottom" | "left" | "right";
const SIDES: { id: Side; position: RFPosition }[] = [
  { id: "top", position: RFPosition.Top },
  { id: "bottom", position: RFPosition.Bottom },
  { id: "left", position: RFPosition.Left },
  { id: "right", position: RFPosition.Right },
];

/**
 * Cards are pure presentational stubs without handles; without handles React
 * Flow anchors edges at right/left — the "mixed TB + LR" look. Wrapping each
 * card with invisible handles on all four sides lets us route every edge from
 * bottom/top (strict top-down) or side-to-side as appropriate.
 *
 * POLISH: the wrapper also renders the card's overlay UI (collapse control,
 * theme dots, event badge) and drives card styling (dimming, side-character
 * outline, per-mother accent) from per-node `data.ui`, so PersonCard/
 * EventCard stay untouched.
 */
const MAX_THEME_DOTS = 4;

function ThemeDots({ colors }: { colors: string[] }) {
  const shown = colors.slice(0, MAX_THEME_DOTS);
  const extra = colors.length - shown.length;
  return (
    <div className="theme-dots" data-no-drawer="1">
      {shown.map((c, i) => (
        <span key={i} className="theme-dot" style={{ backgroundColor: c }} />
      ))}
      {extra > 0 ? <span className="theme-dots-more">+{extra}</span> : null}
    </div>
  );
}

function PersonOverlay(id: string, ui: NodeUi): ReactNode {
  return (
    <>
      {ui.themeDots && ui.themeDots.length > 0 ? (
        <ThemeDots colors={ui.themeDots} />
      ) : null}
      {ui.hasChildren ? (
        <button
          className="collapse-btn"
          data-no-drawer="1"
          title={ui.collapsed ? "Expand descendants" : "Collapse descendants"}
          aria-label={ui.collapsed ? "Expand descendants" : "Collapse descendants"}
          onClick={(e) => {
            e.stopPropagation();
            ui.onToggleCollapse?.(id);
          }}
        >
          {ui.collapsed ? "+" : "\u2212"}
        </button>
      ) : null}
    </>
  );
}

function EventOverlay(_id: string, ui: NodeUi): ReactNode {
  return (
    <>
      {/* Event badge: rounded pill with an icon — never a diamond. */}
      <span className="event-badge" data-no-drawer="1" title="Event">
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M6 0.8 2.6 5.6h2.1L4 9.2 7.4 4.4H5.3z" fill="currentColor" />
        </svg>
      </span>
      {ui.themeDots && ui.themeDots.length > 0 ? (
        <ThemeDots colors={ui.themeDots} />
      ) : null}
    </>
  );
}

function withHandles(
  Comp: ComponentType<any>,
  overlay?: (id: string, ui: NodeUi) => ReactNode
): ComponentType<any> {
  function Handled(props: Record<string, any>) {
    const ui = (props.data as Record<string, any> | undefined)?.ui as
      | NodeUi
      | undefined;
    return (
      <div
        className={[
          "node-wrap",
          "relative",
          ui?.dim ? "node-dim" : "",
          ui?.lineage ? "node-lineage" : "",
          ui?.side ? "node-side" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          ui?.accent ? ({ "--card-accent": ui.accent } as CSSProperties) : undefined
        }
        data-accent={ui?.accent ? "true" : undefined}
      >
        {SIDES.map(({ id, position }) => (
          <Handle
            key={id}
            id={`${id}-in`}
            type="target"
            position={position}
            style={{ opacity: 0 }}
          />
        ))}
        {SIDES.map(({ id, position }) => (
          <Handle
            key={id}
            id={`${id}-out`}
            type="source"
            position={position}
            style={{ opacity: 0 }}
          />
        ))}
        <div className="card-slot">
          <Comp {...props} />
        </div>
        {ui && overlay ? overlay(String(props.id), ui) : null}
      </div>
    );
  }
  return Handled;
}

const nodeTypes: NodeTypes = {
  person: withHandles(PersonCard, PersonOverlay),
  event: withHandles(EventCard, EventOverlay),
  eraBand: ({ data }: NodeProps) => <EraBand {...(data as unknown as EraBandProps)} />,
};

const sizeOf = (n: Node) => (n.type === "event" ? EVENT_SIZE : PERSON_SIZE);

/**
 * flow.ts (owned elsewhere) encodes the semantic edge type in its stroke
 * style; recover it here to pick anchors:
 * - parent:    bottom of parent -> top of child, arrow already at child end
 * - spouse:    straight left/right edge along the family-unit row
 * - encounter/event: routed between computed positions (nodes never move)
 *
 * R3/R4 wiring rule: the ONLY edges without a markerEnd or dash are spouse
 * edges, so the `spouse` fallback below is exact — there is no style
 * fall-through. To make that guarantee structural (multi-anchor event edges
 * like the_fall's two links can never render dark solid), the encounter/
 * event branches below FORCE their stroke style instead of inheriting
 * whatever style the edge arrives with.
 */
function classifyEdge(e: Edge): "parent" | "spouse" | "encounter" | "event" {
  if (e.markerEnd) return "parent";
  const dash = (e.style as CSSProperties | undefined)?.strokeDasharray;
  if (dash === "2 6") return "encounter";
  if (dash === "6 4") return "event";
  return "spouse";
}

const eraLabel = (era: string) =>
  eras.find((x) => x.id === era)?.label ?? era;

/** Miro-like read-only canvas: pan/zoom, fitView, minimap, controls. */
export default function Canvas({ nodes, edges, ui, edgeUi }: CanvasProps) {
  // Era bands computed by computeLayout, rendered behind the graph.
  const bandNodes = useMemo<Node[]>(
    () =>
      getLastEraBands().map((b) => ({
        id: `era-band-${b.era}`,
        type: "eraBand",
        position: { x: b.x, y: b.y },
        data: { label: eraLabel(b.era), width: b.width, height: b.height },
        draggable: false,
        connectable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      })),
    [nodes, edges]
  );

  const styledNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => {
        const nodeUi = ui?.get(n.id);
        return {
          ...n,
          // Fallback anchors: source at bottom, target at top (pure top-down).
          sourcePosition: RFPosition.Bottom,
          targetPosition: RFPosition.Top,
          data: nodeUi ? { ...(n.data as object), ui: nodeUi } : n.data,
        };
      }),
    [nodes, ui]
  );

  const wiredEdges = useMemo<Edge[]>(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // POLISH: per-edge overrides (per-mother accent, focus dimming) layered on
    // top of the routing/styling rules below — accent also tints the arrow.
    const applyEdgeUi = (e: Edge): Edge => {
      const o = edgeUi?.(e);
      if (!o) return e;
      const style: CSSProperties = { ...(e.style as CSSProperties | undefined) };
      let markerEnd = e.markerEnd;
      if (o.accent) {
        style.stroke = o.accent;
        if (markerEnd && typeof markerEnd === "object") {
          markerEnd = { ...markerEnd, color: o.accent };
        }
      }
      if (o.dim) style.opacity = 0.12;
      return { ...e, style, markerEnd };
    };
    return edges.map((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) return e;
      const kind = classifyEdge(e);

      if (kind === "parent") {
        return applyEdgeUi({
          ...e,
          type: "smoothstep",
          sourceHandle: "bottom-out",
          targetHandle: "top-in",
        });
      }

      if (kind === "spouse") {
        // Straight edge along the family-unit row, husband <-> wives.
        const sLeft = s.position.x <= t.position.x;
        return applyEdgeUi({
          ...e,
          type: "straight",
          sourceHandle: sLeft ? "right-out" : "left-out",
          targetHandle: sLeft ? "left-in" : "right-in",
        });
      }

      // Encounter/event (R3/R4): straight lines between fixed positions with
      // FORCED styles — dotted slate for encounter, thin muted long-dash for
      // events, for ANY anchor count. Never dark solid, never inherited.
      const dx = Math.abs(s.position.x - t.position.x);
      const dy = Math.abs(s.position.y - t.position.y);
      const horizontal = dx >= dy;
      const sLeft = s.position.x <= t.position.x;
      const forcedStyle =
        kind === "encounter"
          ? { stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: "2 6" }
          : { stroke: "#a8a29e", strokeWidth: 1, strokeDasharray: "10 6" };
      return applyEdgeUi({
        ...e,
        type: "straight",
        style: forcedStyle,
        sourceHandle: horizontal ? (sLeft ? "right-out" : "left-out") : "bottom-out",
        targetHandle: horizontal ? (sLeft ? "left-in" : "right-in") : "top-in",
      });
    });
  }, [nodes, edges, edgeUi]);

  return (
    <ReactFlow
      nodes={[...bandNodes, ...styledNodes]}
      edges={wiredEdges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      elevateNodesOnSelect={false}
      fitView
      minZoom={0.05}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <MiniMap pannable zoomable className="polish-minimap" />
      <Controls className="polish-controls" />
    </ReactFlow>
  );
}
