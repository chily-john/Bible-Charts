import { describe, expect, it } from "vitest";
import {
  computeHiddenIds,
  computeSideCharacterIds,
} from "./graph";
import { computeLineageIds } from "../hooks/useFocus";
import graph from "../data/graph.json";
import type { EdgeDraft, GraphFile, NodeDraft } from "./schema";

const data = graph as unknown as GraphFile;
const nodes: readonly NodeDraft[] = data.nodes;
const edges: readonly EdgeDraft[] = data.edges;

describe("computeSideCharacterIds", () => {
  it("flags off-lineage floaters (Lot, Jethro, Pharaoh) and nobody else", () => {
    const side = computeSideCharacterIds(nodes, edges);
    expect([...side]).toEqual(["lot", "jethro", "pharaoh_exodus"]);
  });
});

describe("computeHiddenIds (collapse + toggles)", () => {
  it("hides nothing when everything is expanded and shown", () => {
    expect(computeHiddenIds(nodes, edges).size).toBe(0);
  });

  it("collapsing Noah hides his sons and their whole lines, not Noah himself", () => {
    const hidden = computeHiddenIds(nodes, edges, { collapsed: new Set(["noah"]) });
    // Sons + descendants (incl. wives who married in: sarah/hagar) ...
    for (const id of [
      "shem",
      "ham",
      "japheth",
      "canaan",
      "nimrod",
      "eber",
      "peleg",
      "terah",
      "abraham",
      "sarah",
      "hagar",
      "ishmael",
    ]) {
      expect(hidden.has(id), id).toBe(true);
    }
    // ... including their attached events and side floaters.
    expect(hidden.has("babel")).toBe(true); // attached to Nimrod
    expect(hidden.has("lot")).toBe(true); // attached to Abraham
    // The collapsed card, his ancestors, and their floating event stay.
    for (const id of ["noah", "adam", "eve", "seth", "the_fall"]) {
      expect(hidden.has(id), id).toBe(false);
    }
    // The Flood floats on Noah (still visible), not on a hidden descendant.
    expect(hidden.has("the_flood")).toBe(false);
  });

  it("'Show events' hides every event; 'Show side characters' hides Lot", () => {
    const hidden = computeHiddenIds(nodes, edges, {
      showEvents: false,
      showSideCharacters: false,
    });
    expect(hidden.has("the_fall")).toBe(true);
    expect(hidden.has("the_flood")).toBe(true);
    expect(hidden.has("babel")).toBe(true);
    expect(hidden.has("lot")).toBe(true);
    expect(hidden.has("noah")).toBe(false);
    expect(hidden.has("abraham")).toBe(false);
  });

  it("is state-derived: expanding again restores the exact node set", () => {
    const collapsed = new Set(["terah"]);
    const first = computeHiddenIds(nodes, edges, { collapsed });
    expect(first.has("abraham")).toBe(true);
    const second = computeHiddenIds(nodes, edges, { collapsed: new Set() });
    expect(second.size).toBe(0);
  });
});

describe("computeLineageIds (focus lineage)", () => {
  it("focus on Abraham shows his line only (spouse-aware both directions)", () => {
    const line = computeLineageIds(nodes, edges, "abraham");
    // Ancestors all the way back (spouse-aware parentsOf), spouses, descendants.
    for (const id of [
      "terah",
      "peleg",
      "eber",
      "shem",
      "noah",
      "seth",
      "adam",
      "eve",
      "sarah",
      "hagar",
      "ishmael",
    ]) {
      expect(line.has(id), id).toBe(true);
    }
    // Not his line: other branches, unattached floaters, unrelated events.
    for (const id of ["ham", "canaan", "nimrod", "cain", "abel", "lot", "babel"]) {
      expect(line.has(id), id).toBe(false);
    }
    // The Fall floats on Adam/Eve — ancestors of Abraham — so it rides the line.
    expect(line.has("the_fall")).toBe(true);
  });

  it("includes the events floating on the line, and excludes others", () => {
    // Noah's line runs Noah -> ... -> Nimrod, so Babel (Nimrod's event) and
    // The Flood (Noah's event) both ride the line.
    const line = computeLineageIds(nodes, edges, "noah");
    expect(line.has("the_flood")).toBe(true);
    expect(line.has("babel")).toBe(true);
    // Cain's line touches none of them.
    const cain = computeLineageIds(nodes, edges, "cain");
    expect(cain.has("the_flood")).toBe(false);
    expect(cain.has("babel")).toBe(false);
    expect(cain.has("the_fall")).toBe(true); // Adam/Eve's event rides Cain's line
  });
});
