import { useEffect, useState } from "react";
import type { NodeDraft, Span } from "../lib/schema";
import { useGraphIndex } from "./useGraphIndex";

/**
 * Scripture-overlap search seam.
 *
 * The canon-parser task (src/lib/refs.ts) plugs in here without touching this
 * file's callers: the module is discovered with import.meta.glob, so builds
 * succeed before refs.ts exists and pick it up automatically once it lands.
 * Expected surface used when available (as implemented in src/lib/refs.ts):
 *   - parseRange(text: string): RefRange | null   (null for non-reference text)
 *   - overlap(a: RefRange, b: RefRange): boolean
 *
 * Until then a stub overlap matches a node when any of its refs strings
 * contains the query text.
 */

interface RefsModule {
  parseRange?: (text: string) => unknown | null;
  overlap?: (a: unknown, b: unknown) => boolean;
}

const refsLoaders = import.meta.glob("../lib/refs.ts");

let refsModule: RefsModule | null | undefined; // undefined = not loaded yet

async function loadRefs(): Promise<RefsModule | null> {
  if (refsModule !== undefined) return refsModule;
  const loader = refsLoaders["../lib/refs.ts"];
  if (!loader) {
    refsModule = null;
  } else {
    try {
      refsModule = (await loader()) as RefsModule;
    } catch {
      refsModule = null;
    }
  }
  return refsModule;
}

export interface ScriptureHit {
  node: NodeDraft;
  /** The node ref that overlapped (or the stub-matched ref text). */
  ref: string;
}

/** Stub overlap used while refs.ts is missing: substring match on ref strings. */
function stubOverlap(query: string, nodes: readonly NodeDraft[]): ScriptureHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: ScriptureHit[] = [];
  for (const node of nodes) {
    const ref = node.refs.find((r) => r.toLowerCase().includes(q));
    if (ref) hits.push({ node, ref });
  }
  return hits;
}

/** True overlap via refs.ts (parseRange + overlap) when the module exists. */
function realOverlap(
  refs: RefsModule,
  query: string,
  nodes: readonly NodeDraft[],
  spans: ReadonlyMap<string, Span | null | undefined>
): ScriptureHit[] | null {
  if (!refs.parseRange || !refs.overlap) return null;
  let queryRange: unknown;
  try {
    queryRange = refs.parseRange(query);
  } catch {
    return null; // not reference text — fall back to the stub matcher
  }
  if (!queryRange) return null; // query is not a scripture reference

  const hits: ScriptureHit[] = [];
  for (const node of nodes) {
    let matched = false;
    for (const ref of node.refs) {
      try {
        const nodeRange = refs.parseRange(ref);
        if (nodeRange && refs.overlap(nodeRange, queryRange)) {
          hits.push({ node, ref });
          matched = true;
          break;
        }
      } catch {
        // unparseable stored ref — skip
      }
    }
    // Node-level span (graph.json span field) also participates in overlap.
    const span = spans.get(node.id);
    if (!matched && span) {
      try {
        const spanRange = refs.parseRange(`${span.start} - ${span.end}`);
        if (spanRange && refs.overlap(spanRange, queryRange)) {
          hits.push({ node, ref: `${span.start}\u2013${span.end}` });
        }
      } catch {
        // ignore
      }
    }
  }
  return hits;
}

/** Scripture-overlap hits for a query (stub overlap until refs.ts lands). */
export function useScriptureHits(query: string): ScriptureHit[] {
  const index = useGraphIndex();
  const [hits, setHits] = useState<ScriptureHit[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const nodes = [...index.nodes.values()];
    const spans = new Map(nodes.map((n) => [n.id, n.span]));
    let cancelled = false;
    loadRefs().then((refs) => {
      if (cancelled) return;
      const result =
        (refs ? realOverlap(refs, q, nodes, spans) : null) ?? stubOverlap(q, nodes);
      setHits(result.slice(0, 4));
    });
    return () => {
      cancelled = true;
    };
  }, [query, index]);

  return hits;
}
