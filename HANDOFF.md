# Handoff — Bible Lineage & Themes Explorer

## What this is
Teaching-quality, pan/zoom lineage + themes map of the Bible (replaces a hand-drawn
Excalidraw). Static front end, no backend. Data-driven: edit text JSON/MD, layout
is computed, never hand-drawn.

## Repo
- Remote: `github-personal:chily-john/Bible-Charts` (SSH alias `github-personal` =
  personal key `~/.ssh/id_ed25519_personal_github`; work machine default SSH would
  use the wrong account — always use the `github-personal` host)
- Branch `main`, pushed through `e19b1d7`. Local git identity overridden per-repo:
  `chilyjohn` / `se.chasej@gmail.com` (global is work identity — do not change).
- Dev: `npm install`, `npm run dev` → http://localhost:5173/
- Checks: `npm run validate` (0 errors expected; warnings ok), `npm run test`
  (40/40), `npm run build`.

## Stack (locked)
Vite + React + TS, `@xyflow/react@12`, **ELK (`elkjs`)** — Dagre was rejected,
do not reintroduce. Tailwind v4 (`@tailwindcss/vite`). Zod (app + `npm run
validate` CLI). `react-markdown`, `html-to-image`, `fuse.js`, Vitest.

## Locked product decisions (do not relitigate without the human)
1. **Rank = generation** (`computeGenerationRank` + `eraBaseRank` in
   `src/lib/graph.ts`): longest parent-chain; siblings share rank by construction.
2. **Era floors**: founders rank at 1 + max rank of earlier eras
   (`eras.json` order: primordial, patriarchs, exodus_wilderness, pre_kings,
   kings, exile_return, jesus, church). New-era roots stack BELOW, never at top.
3. **Only spouse+parent affect position.** Encounter/event edges excluded from
   layout, routed post-pass. **Events float, never rank.**
4. **No compactness optimization** — precise arrangement beats short edges.
   Long `~gap` edges stay long.
5. **No single-person events.** `cain_abel` was deleted (story in markdown +
   refs). `the_fall` kept as floating primordial marker (markdown covers
   heavenly + human falls). Event rule: spans families/era/place.
6. **Orphan rule ABANDONED** (breaks down past the patriarchs; NT is a web).
   Missing spans/markdown = warnings, never errors.
7. **Order is data**: spouse-edge order = wife order; parent edges grouped by
   mother then birth order. Never hand-position.
8. **Offshoots go right, same rank** (`lineage:false`: Cain-line, Esau,
   Canaan/Nimrod, Jethro/Pharaoh). Nimrod descends from **Canaan** with `~gap`,
   NOT from Ham.
9. **Centered descent (IN PROGRESS, not yet verified on disk)**: children should
   center under their family unit (near-vertical bloodline columns), not pack to
   the far left. A branch was mid-work — check `layout.ts` for two-pass
   centering; relaunch if absent.
10. **Themes**: v0 = tree_of_life, covenants, exodus_way, wilderness, mountain,
    cities. Muted colorblind-safe cycled palette (`palette[i % len]`), white bg.
    Verified URLs only (covenants, exodus_way, wilderness, mountain, cities);
    tree_of_life url null. Rainbow-ROGYBIV was rejected. Advent/Easter deferred.
    Recurrence (Babel/city reappearing) = theme highlight for v1; a `motif` node
    type is a future upgrade. Serpent/dragons-theme cut for now (easy-add later).

## Data state (65 nodes / ~50 edges)
- Wave 0: primordial + patriarchs through Jacob's full family (4 wives in order
  Leah, Rachel, Bilhah, Zilpah + Dinah + 12 sons), Lot, Ishmael, Keturah line.
- Wave B: exodus pack (Amram/Jochebed, Moses/Aaron/Miriam, Zipporah, Jethro,
  pharaoh_exodus, burning_bush/exodus/sinai events).
- `src/data/span-research.json`: 30/30 Wave-0 span proposals with
  confidence flags — **NOT merged into graph.json**. Low-confidence (spot-check):
  adam, eve, enoch_cain, lamech_cain, jabal, jubal, tubal_cain, ham, japheth,
  canaan. Merge high-confidence first, then ask human about the rest.

## Tooling quirks (read this before delegating)
- TrailStep provider `pi` is fixed **locally** in `.trailstep/config.json`
  (`command: node` + absolute `cli.js`, because `shell:false` can't spawn the
  `pi` shell shim on Windows). Human is fixing upstream — if delegates fail with
  `spawn pi ENOENT`, the local fix was lost; reapply.
- Agent model IDs must use `openrouter/meta/muse-spark-1.3-contributor`
  (non-contributor 404s on Meta). Other known-good: `xiaomi/mimo-v2.6-pro`,
  `z-ai/glm-5.3-flash`, `deepseek/deepseek-v4-flash-0731`.
- Delegates **do the work then fail parsing** their summary as JSON
  (`agent_provider_output_invalid`). **Never trust run status — verify on disk**
  (validate/test/build + file checks). The work is virtually always complete.
- Delegate input files live in `.trailstep/inputs/`; parallel fan-out via
  `trailstep project/delegateParallel`. Give disjoint file ownership per branch.
- Keep files small, one concern each (see `src/lib/`, `src/components/`,
  `src/hooks/`). No verse invention, ever.

## Open next steps (priority order)
1. Verify/relaunch centered-descent columns.
2. Merge reviewed spans from `span-research.json` → `graph.json`.
3. Wave C data (pre-kings/kings) following the Wave B pattern.
4. `motif` recurring-node design (Babel) if themes-as-recurrence proves thin.
