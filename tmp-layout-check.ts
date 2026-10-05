// TEMP verification script (deleted after run) — layout-rules acceptance checks.
import fs from "node:fs";
import { computeLayout, type LayoutEdge, type LayoutNode } from "./src/lib/layout";

const raw = JSON.parse(fs.readFileSync("src/data/graph.json", "utf8"));
const nodes: LayoutNode[] = raw.nodes.map((n: any) => ({
  id: n.id,
  kind: n.kind,
  era: n.era,
  lineage: n.lineage,
}));
const edges: LayoutEdge[] = raw.edges.map((e: any) => ({ from: e.from, to: e.to, type: e.type }));

// Synthetic Isaac/Jacob/Esau line (only if data task hasn't added them yet).
const injected: string[] = [];
if (!nodes.some((n) => n.id === "isaac")) {
  nodes.push(
    { id: "isaac", kind: "person", era: "patriarchs", lineage: true },
    { id: "rebekah", kind: "person", era: "patriarchs", lineage: true },
    { id: "jacob", kind: "person", era: "patriarchs", lineage: true },
    { id: "esau", kind: "person", era: "patriarchs", lineage: false }
  );
  edges.push(
    { from: "sarah", to: "isaac", type: "parent" },
    { from: "isaac", to: "rebekah", type: "spouse" },
    { from: "rebekah", to: "jacob", type: "parent" },
    { from: "rebekah", to: "esau", type: "parent" }
  );
  injected.push("isaac", "rebekah", "jacob", "esau");
}

const layout = await computeLayout(nodes, edges);
const PW = 180, PH = 96, RG = 120;
const rankOf = (id: string) => Math.round((layout.get(id)?.y ?? -1) / (PH + RG));
const centerOf = (id: string) => {
  const p = layout.get(id)!;
  return p.x + PW / 2;
};

console.log("== rank table ==");
const rows: string[] = [];
for (const n of nodes) {
  if (n.kind !== "person") continue;
  const p = layout.get(n.id)!;
  rows.push(`${n.id.padEnd(15)} era=${String(n.era).padEnd(18)} rank=${rankOf(n.id)} x=${p.x.toFixed(1)} center=${centerOf(n.id).toFixed(1)}`);
}
console.log(rows.join("\n"));

const patriMax = Math.max(...nodes.filter((n) => n.era === "patriarchs" && n.kind === "person").map((n) => rankOf(n.id)));
const primMax = Math.max(...nodes.filter((n) => n.era === "primordial" && n.kind === "person").map((n) => rankOf(n.id)));
console.log(`\nprimordial max rank = ${primMax}, patriarchs max rank = ${patriMax}`);
console.log("\n== Wave B rank deltas vs patriarchs max ==");
for (const n of nodes) {
  if (n.era !== "exodus_wilderness" || n.kind !== "person") continue;
  console.log(`${n.id.padEnd(15)} rank=${rankOf(n.id)} delta=+${rankOf(n.id) - patriMax} ${rankOf(n.id) > patriMax ? "OK(>patriarchs max)" : "FAIL"}`);
}

// Vertical checks: child centered under parent UNIT (mean of member centers).
const unitMembers = new Map<string, string[]>();
// spouse comps
const adj = new Map<string, string[]>();
for (const e of edges) {
  if (e.type !== "spouse") continue;
  if (!adj.has(e.from)) adj.set(e.from, []);
  if (!adj.has(e.to)) adj.set(e.to, []);
  adj.get(e.from)!.push(e.to);
  adj.get(e.to)!.push(e.from);
}
const seen = new Set<string>();
for (const n of nodes) {
  if (seen.has(n.id)) continue;
  const members: string[] = [];
  const q = [n.id];
  seen.add(n.id);
  while (q.length) {
    const id = q.shift()!;
    members.push(id);
    for (const nb of adj.get(id) ?? []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  }
  for (const m of members) unitMembers.set(m, members);
}
const unitCenter = (id: string) => {
  const members = unitMembers.get(id) ?? [id];
  return members.reduce((s, m) => s + centerOf(m), 0) / members.length;
};

console.log("\n== vertical checks ==");
const check = (child: string, parent: string) => {
  const du = unitCenter(child) - unitCenter(parent); // unit-to-unit
  const dc = centerOf(child) - centerOf(parent); // card-to-card
  console.log(`${child} under ${parent}: unit-center delta=${du.toFixed(2)} (exact=${Math.abs(du) < 1e-6}), card-center delta=${dc.toFixed(2)}`);
};
if (injected.length || nodes.some((n) => n.id === "isaac")) {
  check("isaac", "abraham");
  check("jacob", "isaac");
  check("esau", "isaac"); // esau should NOT be centered: offshoot peeled right
}
check("ishmael", "abraham");
check("moses", "jochebed");
check("noah", "lamech_seth");
console.log(`\ninjected synthetic nodes: ${injected.join(", ") || "(none — real data)"}`);
