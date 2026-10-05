import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Theme } from "../lib/schema";
import { formatSpan, type Relation } from "../lib/graph";
import { themeColorFor } from "../lib/themeColors";
import { useGraphIndex } from "../hooks/useGraphIndex";
import { useMarkdown } from "../hooks/useContent";

export interface DrawerProps {
  nodeId: string | null;
  onClose: () => void;
  /** Open another node (jump links); the app centers the canvas on it. */
  onJump: (id: string) => void;
  /** Toggle a theme highlight from a theme badge. */
  onThemeSelect: (themeId: string) => void;
  themes: readonly Theme[];
}

const RELATION_LABEL: Record<Relation, string> = {
  spouse: "Spouse",
  mother: "Mother",
  father: "Father",
  parent: "Parent",
  child: "Child",
  event: "Event",
  participant: "Participant",
  encounter: "Encounter",
};

/** Detail drawer: identity, range, themes, markdown body, refs, related jump links. */
export default function Drawer({
  nodeId,
  onClose,
  onJump,
  onThemeSelect,
  themes,
}: DrawerProps) {
  const index = useGraphIndex();
  const node = nodeId ? index.getNode(nodeId) : undefined;
  const markdown = useMarkdown(
    node ? (node.kind === "person" ? "people" : "events") : "people",
    node ? node.id : null
  );

  useEffect(() => {
    if (!nodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodeId, onClose]);

  if (!node) return null;

  const themeIds = themes.map((t) => t.id);
  const nodeThemes = index.themesOf(node, themes);
  const related = index.related(node.id);

  return (
    <aside
      data-testid="detail-drawer"
      className="absolute right-0 top-0 z-10 flex h-full w-96 flex-col border-l border-slate-200 bg-white shadow-xl"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{node.label}</h2>
          {node.subtitle ? (
            <p className="text-sm text-slate-500">{node.subtitle}</p>
          ) : null}
        </div>
        <button
          aria-label="Close drawer"
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Full range
            </dt>
            <dd className="text-slate-700">{formatSpan(node.span)}</dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Themes
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {nodeThemes.length === 0 ? (
                <span className="text-slate-400">—</span>
              ) : (
                nodeThemes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onThemeSelect(t.id)}
                    title={`Highlight theme: ${t.name}`}
                    className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-white transition hover:brightness-110"
                    style={{
                      backgroundColor: themeColorFor(themeIds, t.id),
                      borderColor: themeColorFor(themeIds, t.id),
                    }}
                  >
                    {t.name}
                  </button>
                ))
              )}
            </dd>
          </div>
        </dl>

        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            About
          </h3>
          {markdown ? (
            <article className="prose prose-sm mt-1 max-w-none text-sm text-slate-700">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </article>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              {markdown === null ? "Loading…" : "No markdown body yet."}
            </p>
          )}
        </section>

        {node.refs.length > 0 ? (
          <section className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Key references
            </h3>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {node.refs.map((ref) => (
                <li
                  key={ref}
                  className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700"
                >
                  {ref}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Related
            </h3>
            <ul className="mt-1 divide-y divide-slate-100">
              {related.map((rel) => (
                <li key={`${rel.relation}-${rel.id}`}>
                  <button
                    onClick={() => onJump(rel.id)}
                    className="flex w-full items-center justify-between gap-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <span className="text-sm text-slate-700 hover:underline">
                      {rel.label}
                      {rel.subtitle ? (
                        <span className="text-xs text-slate-400"> · {rel.subtitle}</span>
                      ) : null}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {RELATION_LABEL[rel.relation]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
