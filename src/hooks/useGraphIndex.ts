import graph from "../data/graph.json";
import { buildGraphIndex, type GraphIndex } from "../lib/graph";
import type { GraphFile } from "../lib/schema";

/** JSON import widens literal types; validate.ts checks shape at runtime. */
const graphData = graph as unknown as GraphFile;

/** App-wide graph index (built once) for drawer / search / theme traversal. */
const index: GraphIndex = buildGraphIndex(graphData.nodes, graphData.edges);

export function useGraphIndex(): GraphIndex {
  return index;
}
