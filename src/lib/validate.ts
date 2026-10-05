import {
  erasFileSchema,
  graphFileSchema,
  themesFileSchema,
  type EdgeDraft,
  type NodeDraft,
} from "./schema";

export interface Issue {
  /** Data file the problem lives in, e.g. `src/data/graph.json`. */
  file: string;
  /** Node/edge/theme id involved, or `—` when not id-specific. */
  id: string;
  problem: string;
}

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}

export interface ContentIndex {
  /** ids with a markdown file under src/content/people/ */
  people: Set<string>;
  /** ids with a markdown file under src/content/events/ */
  events: Set<string>;
}

const GRAPH_FILE = "src/data/graph.json";
const ERAS_FILE = "src/data/eras.json";
const THEMES_FILE = "src/data/themes.json";

const REF_RE = /^([1-3]?[A-Za-z]+)\s+(\d+)(?::(\d+))?$/;

interface ParsedRef {
  book: string;
  chapter: number;
  verse: number;
}

/** Parse `Gen 12:1` / `Gen 12`. Returns null when unparseable. */
export function parseRef(raw: string): ParsedRef | null {
  const m = REF_RE.exec(raw.trim());
  if (!m) return null;
  return {
    book: m[1].toLowerCase(),
    chapter: Number(m[2]),
    verse: m[3] ? Number(m[3]) : 1,
  };
}

function refAfter(a: ParsedRef, b: ParsedRef): boolean {
  if (a.chapter !== b.chapter) return a.chapter > b.chapter;
  return a.verse > b.verse;
}

function detectParentCycles(edges: EdgeDraft[]): string[][] {
  const parents = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "parent") continue;
    // parent edge: from = parent, to = child
    parents.set(e.to, [...(parents.get(e.to) ?? []), e.from]);
  }
  const cycles: string[][] = [];
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (id: string) => {
    const s = state.get(id);
    if (s === "done") return;
    if (s === "visiting") {
      const at = stack.indexOf(id);
      cycles.push([...stack.slice(at), id]);
      return;
    }
    state.set(id, "visiting");
    stack.push(id);
    for (const p of parents.get(id) ?? []) visit(p);
    stack.pop();
    state.set(id, "done");
  };
  for (const id of parents.keys()) visit(id);
  return cycles;
}

/**
 * Referential / consistency checks shared by the app and the `npm run validate` CLI.
 * ERRORs block render and make the CLI exit non-zero. WARNINGS never block.
 */
export function validateGraph(
  graphInput: unknown,
  erasInput: unknown,
  themesInput: unknown,
  content: ContentIndex
): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  const erasParsed = erasFileSchema.safeParse(erasInput);
  const themesParsed = themesFileSchema.safeParse(themesInput);
  const graphParsed = graphFileSchema.safeParse(graphInput);

  if (!erasParsed.success) {
    for (const issue of erasParsed.error.issues) {
      errors.push({ file: ERAS_FILE, id: "—", problem: issue.message });
    }
  }
  if (!themesParsed.success) {
    for (const issue of themesParsed.error.issues) {
      errors.push({ file: THEMES_FILE, id: "—", problem: issue.message });
    }
  }
  if (!graphParsed.success) {
    for (const issue of graphParsed.error.issues) {
      errors.push({
        file: GRAPH_FILE,
        id: issue.path.join(".") || "—",
        problem: issue.message,
      });
    }
    return { errors, warnings };
  }

  const graph = graphParsed.data;
  const eraIds = new Set((erasParsed.success ? erasParsed.data : []).map((e) => e.id));
  const themeIds = new Set((themesParsed.success ? themesParsed.data : []).map((t) => t.id));

  // --- duplicate ids -------------------------------------------------
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (seen.has(node.id)) {
      errors.push({ file: GRAPH_FILE, id: node.id, problem: "duplicate node id" });
    }
    seen.add(node.id);
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  // --- node checks ---------------------------------------------------
  for (const node of graph.nodes) {
    if (!eraIds.has(node.era)) {
      errors.push({
        file: GRAPH_FILE,
        id: node.id,
        problem: `unknown era '${node.era}'`,
      });
    }
    for (const tag of node.tags) {
      if (!themeIds.has(tag)) {
        errors.push({
          file: GRAPH_FILE,
          id: node.id,
          problem: `unknown tag '${tag}' (not in themes.json)`,
        });
      }
    }

    // refs: every ref must parse
    for (const ref of node.refs) {
      if (!parseRef(ref)) {
        errors.push({
          file: GRAPH_FILE,
          id: node.id,
          problem: `unparseable ref '${ref}' (expected forms: 'Gen 12:1' or 'Gen 12')`,
        });
      }
    }

    // span: must parse and start <= end
    if (node.span) {
      const start = parseRef(node.span.start);
      const end = parseRef(node.span.end);
      if (!start) {
        errors.push({
          file: GRAPH_FILE,
          id: node.id,
          problem: `unparseable span start '${node.span.start}'`,
        });
      }
      if (!end) {
        errors.push({
          file: GRAPH_FILE,
          id: node.id,
          problem: `unparseable span end '${node.span.end}'`,
        });
      }
      if (start && end) {
        if (start.book !== end.book) {
          errors.push({
            file: GRAPH_FILE,
            id: node.id,
            problem: `span crosses books ('${node.span.start}' .. '${node.span.end}')`,
          });
        } else if (refAfter(start, end)) {
          errors.push({
            file: GRAPH_FILE,
            id: node.id,
            problem: `span start after end ('${node.span.start}' > '${node.span.end}')`,
          });
        }
      }
    } else {
      warnings.push({
        file: GRAPH_FILE,
        id: node.id,
        problem: "missing span (Wave 1 fills verse spans)",
      });
    }

    // markdown content
    const hasMd =
      node.kind === "person" ? content.people.has(node.id) : content.events.has(node.id);
    if (!hasMd) {
      warnings.push({
        file: `src/content/${node.kind === "person" ? "people" : "events"}/${node.id}.md`,
        id: node.id,
        problem: "missing markdown file",
      });
    }
  }

  // --- edge checks ---------------------------------------------------
  const linked = new Set<string>();
  for (const edge of graph.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    linked.add(edge.from);
    linked.add(edge.to);

    if (!from) {
      errors.push({
        file: GRAPH_FILE,
        id: `${edge.from}->${edge.to}`,
        problem: `edge references missing node '${edge.from}'`,
      });
    }
    if (!to) {
      errors.push({
        file: GRAPH_FILE,
        id: `${edge.from}->${edge.to}`,
        problem: `edge references missing node '${edge.to}'`,
      });
    }
    if (edge.type === "spouse" && ((from && from.kind !== "person") || (to && to.kind !== "person"))) {
      errors.push({
        file: GRAPH_FILE,
        id: `${edge.from}->${edge.to}`,
        problem: "spouse edge involves a non-person node",
      });
    }
    if (edge.type === "event" && from && to && from.kind === to.kind) {
      warnings.push({
        file: GRAPH_FILE,
        id: `${edge.from}->${edge.to}`,
        problem: "event edge normally links a person to an event",
      });
    }
  }

  // --- parent cycles (ERROR) ----------------------------------------
  for (const cycle of detectParentCycles(graph.edges)) {
    errors.push({
      file: GRAPH_FILE,
      id: cycle.join("->"),
      problem: "parent cycle",
    });
  }

  // --- warnings-only rules ------------------------------------------
  for (const node of graph.nodes) {
    const isSideChar = node.kind === "person" && node.lineage === false;
    if (isSideChar) {
      const hasSocialEdge = graph.edges.some(
        (e) =>
          (e.from === node.id || e.to === node.id) &&
          (e.type === "encounter" || e.type === "event")
      );
      if (!hasSocialEdge) {
        warnings.push({
          file: GRAPH_FILE,
          id: node.id,
          problem: "side character (lineage:false) without encounter/event edge",
        });
      }
    }
    if (node.kind === "event" && !linked.has(node.id)) {
      warnings.push({
        file: GRAPH_FILE,
        id: node.id,
        problem: "event without any edge",
      });
    }
    if (node.kind === "person" && !graph.edges.some((e) => e.from === node.id || e.to === node.id)) {
      warnings.push({
        file: GRAPH_FILE,
        id: node.id,
        problem: "orphan node (no edges) — orphan rule abandoned, warning only",
      });
    }
  }

  return { errors, warnings };
}