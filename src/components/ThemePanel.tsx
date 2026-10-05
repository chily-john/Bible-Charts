import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Theme } from "../lib/schema";
import { themeColorFor } from "../lib/themeColors";
import { useGraphIndex } from "../hooks/useGraphIndex";

export interface ThemePanelProps {
  themes: readonly Theme[];
  /** Single-active highlight; null = no highlight. */
  active: string | null;
  onActivate: (id: string | null) => void;
  /** Jump to a node from the theme's tagged-node list (app centers canvas). */
  onSelectNode: (id: string) => void;
}

/**
 * Canvas highlight CSS: the active theme's tagged nodes keep full opacity and
 * get an accent ring; every other node dims. Scoped to React Flow node wrappers
 * (data-id) so cards themselves stay layout-agnostic.
 */
export function themeHighlightCss(color: string, ids: readonly string[]): string {
  const highlighted = ids
    .map((id) => `.react-flow__node[data-id="${id}"]`)
    .join(", ");
  const dimmed = ids.length
    ? `.react-flow__node:not([data-id="${ids.join('"]):not([data-id="')}"])`
    : null;
  return `
    .react-flow__node { transition: opacity 200ms ease, box-shadow 200ms ease; }
    ${dimmed ? `${dimmed} { opacity: 0.18; }` : ""}
    ${highlighted ? `${highlighted} { opacity: 1; box-shadow: 0 0 0 3px ${color}, 0 0 14px ${color}66; border-radius: 10px; z-index: 6; }` : ""}
  `;
}

/** Theme legend + single-active highlight + expandable theme detail view. */
export default function ThemePanel({
  themes,
  active,
  onActivate,
  onSelectNode,
}: ThemePanelProps) {
  const index = useGraphIndex();
  const themeIds = themes.map((t) => t.id);
  const activeTheme = themes.find((t) => t.id === active) ?? null;
  const taggedNodes = useMemo(
    () => (activeTheme ? index.nodesForTheme(activeTheme.id) : []),
    [index, activeTheme]
  );

  const highlightCss = useMemo(() => {
    if (!activeTheme) return "";
    return themeHighlightCss(
      themeColorFor(themeIds, activeTheme.id),
      taggedNodes.map((n) => n.id)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTheme, taggedNodes]);

  return (
    <div className="flex flex-col gap-2">
      {activeTheme ? <style>{highlightCss}</style> : null}

      <div className="flex flex-wrap items-center gap-2">
        {themes.map((t) => {
          const color = themeColorFor(themeIds, t.id);
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onActivate(on ? null : t.id)}
              title={t.summary}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                on
                  ? "text-white shadow"
                  : active !== null
                    ? "text-slate-400"
                    : "text-slate-600 hover:brightness-95"
              }`}
              style={{
                backgroundColor: on ? color : "transparent",
                borderColor: color,
                boxShadow: on ? `0 0 0 2px ${color}88` : undefined,
              }}
            >
              {t.name}
            </button>
          );
        })}
        {active !== null ? (
          <button
            onClick={() => onActivate(null)}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Clear
          </button>
        ) : null}
      </div>

      {activeTheme ? (
        <div className="w-96 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              {activeTheme.name}
            </h3>
            <button
              aria-label="Close theme detail"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onActivate(null)}
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-600">{activeTheme.summary}</p>
          <article className="prose prose-sm mt-2 max-w-none text-sm text-slate-700">
            <ReactMarkdown>{activeTheme.description}</ReactMarkdown>
          </article>
          {activeTheme.url ? (
            <a
              href={activeTheme.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium text-sky-700 underline hover:text-sky-900"
            >
              Learn more →
            </a>
          ) : null}
          <div className="mt-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Tagged nodes
            </h4>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {taggedNodes.length === 0 ? (
                <li className="text-xs text-slate-400">No tagged nodes yet.</li>
              ) : (
                taggedNodes.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => onSelectNode(n.id)}
                      className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs text-slate-700 hover:border-slate-500 hover:bg-slate-50"
                    >
                      {n.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
