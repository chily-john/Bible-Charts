import { useEffect, useState } from "react";

export type ContentKind = "people" | "events";

/** Lazily-loaded markdown bodies from src/content/<kind>/<id>.md. */
const markdownLoaders = import.meta.glob("../content/**/*.md", {
  query: "?raw",
  import: "default",
});

const cache = new Map<string, string>();

function loadMarkdown(kind: ContentKind, id: string): Promise<string> {
  const key = `../content/${kind}/${id}.md`;
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const loader = markdownLoaders[key];
  if (!loader) return Promise.resolve("");
  return loader().then((raw) => {
    const text = typeof raw === "string" ? raw : "";
    cache.set(key, text);
    return text;
  });
}

/** Markdown body for a node id, or null while loading / when absent. */
export function useMarkdown(kind: ContentKind, id: string | null): string | null {
  const [text, setText] = useState<string | null>(() => {
    if (!id) return null;
    return cache.get(`../content/${kind}/${id}.md`) ?? null;
  });

  useEffect(() => {
    if (!id) {
      setText(null);
      return;
    }
    let cancelled = false;
    loadMarkdown(kind, id).then((t) => {
      if (!cancelled) setText(t);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  return text;
}
