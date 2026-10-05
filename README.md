# Bible Lineage & Themes Explorer

An interactive, teaching-quality map of biblical lineage and themes — from the
primordial history (Adam, Noah, Babel) through the patriarchs (Abraham's line)
and the exodus (Moses, Aaron, Miriam) — built as a React + ELK web app. It
replaces a hand-drawn Excalidraw chart: every card carries its Scripture refs,
span, theme tags, and a markdown panel, so the chart stays accurate and
extensible as the data grows instead of being redrawn by hand.

> **Screenshots:** none yet — placeholder. Add rendered-chart screenshots here
> once the layout stabilizes.

## Quickstart

```bash
npm install
npm run dev        # vite dev server
npm run validate   # schema + graph invariants (tsx scripts/validate.ts)
npm run test       # vitest
npm run build      # production build
```

## Data workflow

All data lives in `src/data/` and `src/content/`:

- `graph.json` — nodes + edges (the lineage graph)
- `themes.json` — theme definitions (summary, markdown description, url)
- `eras.json` — era ids in fixed order
- `src/content/people/<id>.md`, `src/content/events/<id>.md` — per-node markdown

### Edge types

| Type | Meaning | Rendering |
| --- | --- | --- |
| `spouse` | husband → wife | no arrow |
| `parent` | mother → child (father → child only if mother unnamed) | arrow |
| `encounter` | relationship links (e.g. Abraham → Lot) | dotted |
| `event` | person → event link | thin dashed |

### Conventions

- **Eras**: every node carries an `era`; era order in `eras.json` drives the
  era bands. Current eras: `primordial`, `patriarchs`, `exodus_wilderness`,
  `pre_kings`, `kings`, `exile_return`, `jesus`, `church`.
- **Lineage flag**: `lineage: false` marks offshoots (Cain line, Canaan/Nimrod,
  Lot) — they keep real parent edges but sit right of the main line.
- **Gap labels**: skipped generations get `"label": "~gap"` on the parent edge.
- After editing, run `npm run validate`.

Full conventions and schemas: [docs/DATA_GUIDE.md](docs/DATA_GUIDE.md).

## Layout rules (locked)

- **R1** — `rank = generation`: longest parent-edge chain from founders; ELK
  orders x *within* a rank only.
- **R2** — no compactness optimization; long `~gap` edges stay long and clean.
- **R3** — only spouse + parent edges affect position; encounter/event edges
  are routed post-pass.
- **R4** — event nodes float beside/below their anchor person, never in a rank.
- **R5** — off-lineage nodes go right, same rank; no special casing.
- **R6** — edge order in `graph.json` is law: wife order left→right, sibling
  order by parent-edge order.

No hand-positioning anywhere; precise arrangement beats compactness.
Main-line children descend centered below parents; each era stacks below
the previous instead of overlapping.

## Themes

Six v0 themes: `tree_of_life`, `covenants`, `exodus_way`, `wilderness`,
`mountain`, `cities`. Each theme uses a muted cycling palette; nodes tag theme
ids. Adding a theme = one entry in `themes.json` + tags on relevant nodes.

## Project status

- **Wave 0 + Wave B**: 41 nodes (primordial + patriarchs + exodus pack) live.
- **In progress**: completing Abraham's line (Isaac → Jacob/Esau and beyond).
- **Planned**: remaining exodus-era expansion, Scripture span research
  proposals pending review.

## Repo

- Remote: `github-personal:chily-john/Bible-Charts`
- Stack: React 18, @xyflow/react, elkjs, Vite, Tailwind 4, Zod, Vitest
