// Minimal ambient types for elkjs (bundled build ships no per-path types).
declare module "elkjs/lib/elk.bundled.js" {
  interface ElkNode {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    layoutOptions?: Record<string, string>;
    children?: ElkNode[];
    edges?: ElkEdge[];
  }
  interface ElkEdge {
    id: string;
    sources: string[];
    targets: string[];
  }
  interface ElkLayoutOptions {
    "elk.algorithm"?: string;
    "elk.direction"?: string;
    "elk.spacing.nodeNode"?: string;
    "elk.layered.spacing.nodeNodeBetweenLayers"?: string;
    [key: string]: string | undefined;
  }
  export default class ELK {
    constructor(options?: { workerUrl?: string; workerFactory?: unknown });
    layout(graph: ElkNode, opts?: { layoutOptions?: ElkLayoutOptions }): Promise<ElkNode>;
  }
  export type { ElkNode, ElkEdge, ElkLayoutOptions };
}