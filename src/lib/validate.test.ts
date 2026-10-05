import { describe, expect, it } from "vitest";
import eras from "../data/eras.json";
import themes from "../data/themes.json";
import graph from "../data/graph.json";
import { themeColor, THEME_PALETTE } from "./themeColors";
import { parseRef, validateGraph, type ContentIndex } from "./validate";

const emptyContent: ContentIndex = { people: new Set(), events: new Set() };

describe("validate (placeholder + stub-data checks)", () => {
  it("accepts the stub graph with zero errors (warnings allowed)", () => {
    const result = validateGraph(graph, eras, themes, {
      people: new Set(["abraham"]),
      events: new Set(["the_flood"]),
    });
    expect(result.errors).toEqual([]);
  });

  it("reports an edge to a missing node as an error", () => {
    const broken = {
      nodes: graph.nodes,
      edges: [...graph.edges, { from: "adam", to: "nobody", type: "parent" }],
    };
    const result = validateGraph(broken, eras, themes, emptyContent);
    expect(result.errors.some((e) => e.problem.includes("missing node"))).toBe(true);
  });

  it("reports parent cycles as errors", () => {
    const broken = {
      nodes: graph.nodes,
      edges: [...graph.edges, { from: "shem", "to": "noah", type: "parent" }],
    };
    const result = validateGraph(broken, eras, themes, emptyContent);
    expect(result.errors.some((e) => e.problem === "parent cycle")).toBe(true);
  });

  it("warns (not errors) on missing span", () => {
    const result = validateGraph(graph, eras, themes, emptyContent);
    expect(result.warnings.some((w) => w.problem.includes("missing span"))).toBe(true);
  });
});

describe("refs", () => {
  it("parses Gen 12:1 and chapter-only forms", () => {
    expect(parseRef("Gen 12:1")).not.toBeNull();
    expect(parseRef("Gen 12")).not.toBeNull();
    expect(parseRef("nonsense")).toBeNull();
  });
});

describe("theme colors", () => {
  it("cycles the palette", () => {
    expect(themeColor(0)).toBe(THEME_PALETTE[0]);
    expect(themeColor(THEME_PALETTE.length)).toBe(THEME_PALETTE[0]);
  });
});