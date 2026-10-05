# Data Guide

How to edit the graph data (`src/data/*.json`) and content (`src/content/**/*.md`).

## Files

| File | Contents |
| --- | --- |
| `src/data/eras.json` | 8 eras in fixed order: `primordial`, `patriarchs`, `exodus_wilderness`, `pre_kings`, `kings`, `exile_return`, `jesus`, `church` |
| `src/data/graph.json` | `{ nodes, edges }` — the lineage graph |
| `src/data/themes.json` | Themes with summary, markdown `description`, and `url` (nullable) |
| `src/content/people/<id>.md` | Markdown body for person `<id>` (missing file = warning only) |
| `src/content/events/<id>.md` | Markdown body for event `<id>` |

## Node schema (Zod: `src/lib/schema.ts`)

```json
{
  "id": "abraham",                 // snake_case, unique
  "kind": "person",                // "person" | "event"
  "label": "Abraham",
  "subtitle": "optional",
  "lineage": true,                 // false marks offshoots/side branches
  "tags": ["covenants"],           // theme ids from themes.json
  "span": { "start": "Gen 12:1", "end": "Gen 25:8" },  // nullable for now
  "refs": ["Gen 12:1", "Gen 15"],  // same ref forms
  "era": "patriarchs"              // era id from eras.json
}
```

## Edge schema

```json
{ "from": "abraham", "to": "sarah", "type": "spouse", "label": "optional", "secondary": false }
```

- `type`: `spouse` | `parent` | `encounter` | `event`

## Conventions

- **Spouse edges**: husband → wife, rendered with **no arrow**.
- **Parent edges**: mother → child (arrow). Use father → child only when the
  mother is unnamed (e.g. `noah → shem`). `from` is the parent, `to` is the child.
- **Encounter edges**: dotted, e.g. `abraham → lot`.
- **Event edges**: thin dashed person → event links.
- **Gap labels**: when generations are skipped, add `"label": "~gap"` on the
  parent edge (e.g. `canaan → nimrod`, `shem → eber`).
- **Era field**: every node carries an era. Primordial covers up to Babel;
  patriarchs starts at Eber. Era order in `eras.json` drives layout.
- **Lineage flag**: `lineage: false` marks offshoots (Cain line, Canaan/Nimrod,
  Lot). They keep real parent edges; the main line is the lineage chain.
- **Span convention**: refs/spans use `Gen 12:1` or chapter-only `Gen 12` forms.
  Wave 0 leaves `span: null` (missing span is a warning only).
- **Tags**: theme ids. Unknown tags are errors.

## Validation

Run after every edit:

```
npm run validate
```

- **Errors** (block render, CLI exits non-zero): duplicate ids, edges to missing
  nodes, unknown kind/type/tag/era, unparseable ref or `start > end`, spouse
  involving a non-person, parent cycles.
- **Warnings** (never block): missing span, missing markdown, side character
  (`lineage: false`) without an encounter/event edge, event without an edge.
  (The orphan rule was abandoned — orphans are warning-level at most.)

## Easy adds

- **Themes**: append to `src/data/themes.json`. Color is automatic
  (`src/lib/themeColors.ts` cycles a muted, colorblind-safe palette).
- **Eras**: append to `src/data/eras.json` (order = left-to-right/top-to-bottom).
- **Serpent note**: the serpent node is cut for now; add it later as a person or
  event node with a note, and a future `dragon` theme can carry the thread.
  (Cut deliberately: no serpent/serpent-edge exists in `graph.json`; the Fall
  is carried by the floating `the_fall` era-marker event + Adam/Eve markdown.)

## Layout rules R1–R6 (LOCKED — precise arrangement beats compactness)

- **R1 RANK=GENERATION**: `rank(node)` = longest parent-edge chain from
  founders (`rank 0` = Adam/Eve; founders = no incoming parent edge).
  Siblings share parents → same rank by construction. `y = rank *
  (cardH + rankGap)` with constants in `src/lib/sizes.ts`. ELK orders `x`
  WITHIN a rank only (one partition per rank); it can never move a node
  across ranks. No hand-positioning anywhere.
- **R2 NO COMPACTNESS OPTIMIZATION**: layering respects partitions (no layer
  reassignment to shorten edges); crossing minimization is within-rank and
  conservative; no edge-length-driven placement across ranks. Long `~gap`
  edges (Canaan→Nimrod, cross-era jumps) stay long and clean. Every ELK
  option is documented with its reason in the header comment of
  `src/lib/layout.ts`.
- **R3 ONLY spouse+parent AFFECT POSITION**: the ELK input graph is built
  from spouse+parent edges only. Encounter/event edges are excluded from
  layout and routed post-pass as straight lines (encounter = dotted slate,
  event = thin muted long-dash, never dark solid).
- **R4 EVENTS FLOAT, NEVER RANK**: event nodes are not in the ELK pass.
  Post-pass they sit beside/below their first anchor person with a per-event
  slot so multiple events never stack. `the_fall` anchors Adam+Eve → floats
  between/below the pair (its markdown covers the heavenly + human falls).
  `the_flood` → Noah, `babel` → Nimrod. The `cain_abel` event node was
  DELETED (that story lives in Cain/Abel markdown + `Gen 4` refs).
- **R5 OFF-LINEAGE GOES RIGHT, SAME RANK**: within-rank x-order key =
  `(rank, lineage true-first, edge-order index in graph.json, id)`. The Cain
  line shares ranks with the Seth line but sits right; Lot sits in Abraham's
  rank off to the side. No left-right mode, no special casing.
- **R6 EDGE ORDER IS LAW**: spouse-edge order in `graph.json` = wife
  left-to-right; parent edges grouped by mother then birth order = sibling
  order. Layout derives order ONLY from these (plus the R5 key).
- **Fall kept as floating era-marker**: `the_fall` is intentionally NOT a
  ranked node — it floats near the Adam/Eve pair as the primordial era's
  marker event. Do not give it parent/spouse edges or expect it in a rank.