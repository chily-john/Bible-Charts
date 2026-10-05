import { describe, expect, it } from "vitest";
import { BOOKS, findBook, getBook, normalizeBookToken } from "./books";
import {
  formatRange,
  overlap,
  parseRange,
  parseRef,
  rangeEndPoint,
  rangeStartPoint,
  sortKey,
  validateRefString,
  validateSpan,
} from "./refs";

describe("canon table", () => {
  it("has 66 books in canonical order with chapter counts", () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.map((b) => b.index)).toEqual(BOOKS.map((_, i) => i + 1));
    expect(getBook("Genesis")?.chapters).toBe(50);
    expect(getBook("Psalms")?.chapters).toBe(150);
    expect(getBook("Revelation")?.index).toBe(66);
  });

  it("normalizes case, periods, and spaces", () => {
    expect(normalizeBookToken("1. Sam.")).toBe("1sam");
    expect(normalizeBookToken("Song of Songs")).toBe("songofsongs");
  });

  it("resolves aliases case-insensitively, ignoring periods/spaces", () => {
    expect(findBook("Gen")?.name).toBe("Genesis");
    expect(findBook("GENESIS")?.name).toBe("Genesis");
    expect(findBook("gEn.")?.name).toBe("Genesis");
    expect(findBook("1 Sam")?.name).toBe("1 Samuel");
    expect(findBook("1Sam")?.name).toBe("1 Samuel");
    expect(findBook("1.Sam.")?.name).toBe("1 Samuel");
    expect(findBook("I Sam")?.name).toBe("1 Samuel");
    expect(findBook("First Samuel")?.name).toBe("1 Samuel");
    expect(findBook("2 Samuel")?.name).toBe("2 Samuel");
    expect(findBook("Ps")?.name).toBe("Psalms");
    expect(findBook("Psalm")?.name).toBe("Psalms");
    expect(findBook("Psalms")?.name).toBe("Psalms");
    expect(findBook("Psa.")?.name).toBe("Psalms");
    expect(findBook("Song")?.name).toBe("Song of Songs");
    expect(findBook("Song of Solomon")?.name).toBe("Song of Songs");
    expect(findBook("SongOfSongs")?.name).toBe("Song of Songs");
    expect(findBook("SOS")?.name).toBe("Song of Songs");
    expect(findBook("Canticles")?.name).toBe("Song of Songs");
    expect(findBook("nObOOk")).toBeNull();
  });
});

describe("parseRef", () => {
  it("parses book/chapter/verse", () => {
    expect(parseRef("Gen 12:1")).toEqual({ book: "Genesis", chapter: 12, verse: 1 });
    expect(parseRef("  1 Sam 3:1  ")).toEqual({ book: "1 Samuel", chapter: 3, verse: 1 });
  });

  it("parses chapter-only refs as verse null (start 1 / end 999)", () => {
    const ref = parseRef("Gen 12");
    expect(ref).toEqual({ book: "Genesis", chapter: 12, verse: null });
    expect(rangeStartPoint({ start: ref!, end: ref! })).toEqual({
      book: "Genesis",
      chapter: 12,
      verse: 1,
    });
    expect(rangeEndPoint({ start: ref!, end: ref! })).toEqual({
      book: "Genesis",
      chapter: 12,
      verse: 999,
    });
  });

  it("returns null for unknown books and malformed input", () => {
    expect(parseRef("Foo 1:1")).toBeNull();
    expect(parseRef("Gen")).toBeNull();
    expect(parseRef("12:1")).toBeNull();
  });
});

describe("parseRange", () => {
  it("parses verse ranges within a chapter", () => {
    const r = parseRange("Gen 22:1-19")!;
    expect(r.start).toEqual({ book: "Genesis", chapter: 22, verse: 1 });
    expect(r.end).toEqual({ book: "Genesis", chapter: 22, verse: 19 });
  });

  it("parses chapter ranges", () => {
    const r = parseRange("Exod 3-4")!;
    expect(r.start).toEqual({ book: "Exodus", chapter: 3, verse: null });
    expect(r.end).toEqual({ book: "Exodus", chapter: 4, verse: null });
    expect(rangeStartPoint(r).verse).toBe(1);
    expect(rangeEndPoint(r).verse).toBe(999);
  });

  it("parses cross-chapter ranges", () => {
    const r = parseRange("Gen 12:1-25:10")!;
    expect(r.start).toEqual({ book: "Genesis", chapter: 12, verse: 1 });
    expect(r.end).toEqual({ book: "Genesis", chapter: 25, verse: 10 });
  });

  it("parses cross-book ranges (hyphen, en dash, and 'to')", () => {
    for (const s of ["Gen 37 - Exod 2", "Gen 37 – Exod 2", "Gen 37 — Exod 2", "Gen 37 to Exod 2"]) {
      const r = parseRange(s)!;
      expect(r.start).toEqual({ book: "Genesis", chapter: 37, verse: null });
      expect(r.end).toEqual({ book: "Exodus", chapter: 2, verse: null });
    }
    const dash = parseRange("Gen 22:1–19")!;
    expect(dash.end).toEqual({ book: "Genesis", chapter: 22, verse: 19 });
  });

  it("treats a single ref as a degenerate range", () => {
    const r = parseRange("John 3:16")!;
    expect(r.start).toEqual(r.end);
    const c = parseRange("John 3")!;
    expect(rangeStartPoint(c)).toEqual({ book: "John", chapter: 3, verse: 1 });
    expect(rangeEndPoint(c)).toEqual({ book: "John", chapter: 3, verse: 999 });
  });

  it("returns null for unparseable input", () => {
    expect(parseRange("ch 1")).toBeNull();
  });
});

describe("sortKey", () => {
  it("orders by book, then chapter, then verse", () => {
    const g = sortKey({ book: "Genesis", chapter: 50, verse: 17 });
    const e = sortKey({ book: "Exodus", chapter: 1, verse: 1 });
    const m = sortKey({ book: "Matthew", chapter: 1, verse: 1 });
    const r = sortKey({ book: "Revelation", chapter: 22, verse: 21 });
    expect(g).toBeLessThan(e);
    expect(e).toBeLessThan(m);
    expect(m).toBeLessThan(r);
    expect(g).toBe(1 * 1e6 + 50 * 1e3 + 17);
  });

  it("sorts refs across books", () => {
    const input = ["Rev 1:1", "Gen 1:1", "Matt 2:1", "Exod 40:34"];
    const sorted = [...input]
      .map((s) => parseRange(s)!)
      .sort((a, b) => sortKey(rangeStartPoint(a)) - sortKey(rangeStartPoint(b)))
      .map(formatRange);
    expect(sorted).toEqual(["Gen 1:1", "Exod 40:34", "Matt 2:1", "Rev 1:1"]);
  });
});

describe("overlap", () => {
  const gen22 = parseRange("Gen 22:1-19")!;

  it("detects overlap and containment", () => {
    expect(overlap(gen22, parseRange("Gen 22:10-23:2")!)).toBe(true);
    expect(overlap(gen22, parseRange("Gen 22:5-6")!)).toBe(true);
    expect(overlap(gen22, gen22)).toBe(true);
    expect(overlap(parseRange("Gen 22:5-6")!, gen22)).toBe(true);
  });

  it("treats touching ranges as overlapping", () => {
    expect(overlap(gen22, parseRange("Gen 22:19-30")!)).toBe(true);
  });

  it("separates disjoint ranges", () => {
    expect(overlap(gen22, parseRange("Gen 22:20-22")!)).toBe(false);
    expect(overlap(gen22, parseRange("Gen 23:1-10")!)).toBe(false);
  });

  it("spans chapter-only bounds with verse 1..999", () => {
    // `Gen 22` covers 22:1-22:999, so it overlaps a late-verse range.
    expect(overlap(parseRange("Gen 22")!, parseRange("Gen 22:900-910")!)).toBe(true);
    expect(overlap(parseRange("Gen 22")!, parseRange("Gen 23:1")!)).toBe(false);
  });

  it("keeps books disjoint across the book boundary", () => {
    expect(overlap(parseRange("Gen 50")!, parseRange("Exod 1")!)).toBe(false);
    expect(overlap(parseRange("Gen 50")!, parseRange("Gen 50 - Exod 1")!)).toBe(true);
  });
});

describe("formatRange", () => {
  it("collapses repeated books", () => {
    expect(formatRange(parseRange("Gen 22:1-19")!)).toBe("Gen 22:1-19");
    expect(formatRange(parseRange("Gen 12:1-25:10")!)).toBe("Gen 12:1-25:10");
    expect(formatRange(parseRange("Gen 12-25")!)).toBe("Gen 12-25");
    expect(formatRange(parseRange("Gen 12")!)).toBe("Gen 12");
    expect(formatRange(parseRange("Gen 22:1")!)).toBe("Gen 22:1");
  });

  it("names both books for cross-book ranges", () => {
    expect(formatRange(parseRange("Gen 37 - Exod 2")!)).toBe("Gen 37 - Exod 2");
    expect(formatRange(parseRange("Gen 37:1-Exod 2:22")!)).toBe("Gen 37:1 - Exod 2:22");
  });

  it("uses short names for numbered books", () => {
    expect(formatRange(parseRange("1 Sam 3:1-10")!)).toBe("1 Sam 3:1-10");
  });
});

describe("validation helpers", () => {
  it("flags unknown books and malformed input", () => {
    expect(validateRefString("Foo 1:1").map((i) => i.code)).toEqual(["unknown_book"]);
    expect(validateRefString("Gen").map((i) => i.code)).toEqual(["invalid_format"]);
  });

  it("flags chapters beyond the book", () => {
    expect(validateRefString("Gen 51:1").map((i) => i.code)).toEqual(["chapter_out_of_range"]);
    expect(validateRefString("Gen 0:1").map((i) => i.code)).toEqual(["chapter_out_of_range"]);
    expect(validateRefString("Ps 151:1").map((i) => i.code)).toEqual(["chapter_out_of_range"]);
    expect(validateRefString("Ps 150:1")).toEqual([]);
  });

  it("does NOT validate verse numbers", () => {
    expect(validateRefString("Gen 1:999")).toEqual([]);
    expect(validateRefString("Gen 22:5-99999")).toEqual([]);
  });

  it("flags reversed ranges and spans", () => {
    expect(validateRefString("Gen 22:19-1").map((i) => i.code)).toEqual(["start_after_end"]);
    expect(validateRefString("Exod 3 - Gen 2").map((i) => i.code)).toEqual(["start_after_end"]);
    expect(validateSpan({ start: "Gen 30", end: "Gen 20" }).map((i) => i.code)).toEqual([
      "start_after_end",
    ]);
    expect(validateSpan({ start: "Exod 2", end: "Gen 3" }).map((i) => i.code)).toEqual([
      "start_after_end",
    ]);
  });

  it("accepts valid spans", () => {
    expect(validateSpan({ start: "Gen 12:1", end: "Gen 25:10" })).toEqual([]);
    expect(validateSpan({ start: "Gen 12", end: "Gen 25" })).toEqual([]);
    expect(validateSpan({ start: "Gen 1:1", end: "Gen 1:1" })).toEqual([]);
  });
});
