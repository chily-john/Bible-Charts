import type { Theme } from "../lib/schema";
import { useSearch, type SearchHit } from "../hooks/useSearch";
import { useScriptureHits } from "../hooks/useScriptureSearch";

export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  themes: readonly Theme[];
  /** Select a node (app centers the canvas and opens the drawer). */
  onSelectNode: (id: string) => void;
  /** Select a theme (app activates its highlight). */
  onSelectTheme: (id: string) => void;
}

const BADGE_STYLE: Record<string, string> = {
  person: "bg-sky-100 text-sky-800",
  side: "bg-violet-100 text-violet-800",
  event: "bg-amber-100 text-amber-800",
  theme: "bg-emerald-100 text-emerald-800",
  ref: "bg-slate-200 text-slate-700",
};

function Badge({ kind }: { kind: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${BADGE_STYLE[kind] ?? "bg-slate-100 text-slate-700"}`}
    >
      {kind}
    </span>
  );
}

/** Search box: fuzzy name/subtitle/theme matching plus scripture-overlap hits. */
export default function Search({
  value,
  onChange,
  themes,
  onSelectNode,
  onSelectTheme,
}: SearchProps) {
  const hits = useSearch(value, themes);
  const scriptureHits = useScriptureHits(value);
  const showDropdown = value.trim().length > 0;

  const select = (hit: SearchHit) => {
    if (hit.type === "node") onSelectNode(hit.node.id);
    else onSelectTheme(hit.theme.id);
    onChange("");
  };

  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) select(hits[0]);
          if (e.key === "Escape") onChange("");
        }}
        placeholder="Search people, events, themes…"
        aria-label="Search"
        className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      />
      {showDropdown ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-80 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          {hits.length === 0 && scriptureHits.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No matches.</p>
          ) : (
            <ul>
              {hits.map((hit) =>
                hit.type === "node" ? (
                  <li key={`node-${hit.node.id}`}>
                    <button
                      onClick={() => select(hit)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                    >
                      <Badge kind={hit.kind} />
                      <span className="text-sm text-slate-800">{hit.node.label}</span>
                      {hit.node.subtitle ? (
                        <span className="text-xs text-slate-400">{hit.node.subtitle}</span>
                      ) : null}
                    </button>
                  </li>
                ) : (
                  <li key={`theme-${hit.theme.id}`}>
                    <button
                      onClick={() => select(hit)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                    >
                      <Badge kind="theme" />
                      <span className="text-sm text-slate-800">{hit.theme.name}</span>
                      <span className="truncate text-xs text-slate-400">
                        {hit.theme.summary}
                      </span>
                    </button>
                  </li>
                )
              )}
              {scriptureHits.map((hit) => (
                <li key={`ref-${hit.node.id}-${hit.ref}`}>
                  <button
                    onClick={() => {
                      onSelectNode(hit.node.id);
                      onChange("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                  >
                    <Badge kind="ref" />
                    <span className="text-sm text-slate-800">{hit.node.label}</span>
                    <span className="font-mono text-xs text-slate-400">{hit.ref}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
