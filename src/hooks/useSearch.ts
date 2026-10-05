import { useMemo } from "react";
import Fuse from "fuse.js";
import type { NodeDraft, Theme } from "../lib/schema";
import { useGraphIndex } from "./useGraphIndex";

/** Person / side (non-lineage person) / event node, or theme. */
export type SearchHit =
  | { type: "node"; node: NodeDraft; kind: "person" | "side" | "event" }
  | { type: "theme"; theme: Theme };

export function nodeKindBadge(node: NodeDraft): "person" | "side" | "event" {
  if (node.kind === "event") return "event";
  return node.lineage ? "person" : "side";
}

interface SearchableNode {
  id: string;
  label: string;
  subtitle: string;
  themeNames: string;
}

/** Fuzzy search over node name / subtitle / theme labels plus theme names. */
export function useSearch(query: string, themes: readonly Theme[]): SearchHit[] {
  const index = useGraphIndex();

  const { nodeFuse, themeFuse } = useMemo(() => {
    const themeNameById = new Map(themes.map((t) => [t.id, t.name]));
    const searchable: SearchableNode[] = [...index.nodes.values()].map((n) => ({
      id: n.id,
      label: n.label,
      subtitle: n.subtitle ?? "",
      themeNames: n.tags.map((t) => themeNameById.get(t) ?? t).join(" "),
    }));
    return {
      nodeFuse: new Fuse(searchable, {
        keys: ["label", "subtitle", "themeNames"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
      themeFuse: new Fuse([...themes], { keys: ["name", "summary"], threshold: 0.4 }),
    };
  }, [index, themes]);

  return useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const nodeHits: SearchHit[] = nodeFuse.search(q, { limit: 6 }).flatMap((r) => {
      const node = index.getNode(r.item.id);
      return node ? [{ type: "node" as const, node, kind: nodeKindBadge(node) }] : [];
    });
    const themeHits: SearchHit[] = themeFuse
      .search(q, { limit: 3 })
      .map((r) => ({ type: "theme" as const, theme: r.item }));
    return [...nodeHits, ...themeHits];
  }, [query, nodeFuse, themeFuse, index]);
}
