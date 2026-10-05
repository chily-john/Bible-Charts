/**
 * Bible reference parsing, ordering, overlap, display formatting, and
 * schema-facing validation helpers.
 *
 * Owned by the CANON + REF PARSER task. The canon table lives in `books.ts`.
 */

import { findBook, getBook, type Book } from "./books";

/** A parsed reference point. `verse` is null for chapter-only references. */
export interface Ref {
  /** Canonical book name, e.g. `Genesis`. */
  book: string;
  chapter: number;
  /** Verse number, or null when the input was chapter-only. */
  verse: number | null;
}

/**
 * A parsed range. For chapter-only endpoints the concrete verse bounds are
 * verse 1 (start) and verse 999 (end) — see `refStartPoint` / `refEndPoint`.
 */
export interface RefRange {
  start: Ref;
  end: Ref;
}

/** A reference point with a concrete (non-null) verse. */
export interface RefPoint {
  book: string;
  chapter: number;
  verse: number;
}

export type RefIssueCode =
  | "invalid_format"
  | "unknown_book"
  | "chapter_out_of_range"
  | "start_after_end";

export interface RefIssue {
  code: RefIssueCode;
  message: string;
}

/**
 * `Gen 12:1`, `Gen 12:1` style. Book must end in a letter/period so the
 * trailing digits bind to chapter/verse, never to the book name.
 */
const REF_RE = /^(.*?[A-Za-z.])\s*(\d+)(?:\s*[:.]\s*(\d+))?$/;
const CHAPTER_VERSE_RE = /^(\d+)\s*[:.]\s*(\d+)$/;
const BARE_NUMBER_RE = /^(\d+)$/;
/** Range separators: hyphen, en dash, em dash, or the word `to`. */
const RANGE_SEP_RE = /^(.*?)(?:\s*(?:–|—|-)\s*|\s+to\s+)(.*)$/i;

type ParseRefResult =
  | { ok: true; ref: Ref }
  | { ok: false; code: "invalid_format" | "unknown_book"; message: string };

function parseRefInternal(raw: string): ParseRefResult {
  const text = raw.trim();
  const m = REF_RE.exec(text);
  if (!m) {
    return { ok: false, code: "invalid_format", message: `cannot parse reference "${raw}"` };
  }
  const bookInfo: Book | null = findBook(m[1]);
  if (!bookInfo) {
    return { ok: false, code: "unknown_book", message: `unknown book "${m[1].trim()}"` };
  }
  return {
    ok: true,
    ref: {
      book: bookInfo.name,
      chapter: Number(m[2]),
      verse: m[3] ? Number(m[3]) : null,
    },
  };
}

function chapterIssues(ref: Ref): RefIssue[] {
  const info = getBook(ref.book);
  if (!info) {
    return [{ code: "unknown_book", message: `unknown book "${ref.book}"` }];
  }
  if (ref.chapter < 1 || ref.chapter > info.chapters) {
    return [
      {
        code: "chapter_out_of_range",
        message: `${ref.book} has ${info.chapters} chapters (got ${ref.chapter})`,
      },
    ];
  }
  return [];
}

/**
 * Parse a single reference like `Gen 12:1` or `Gen 12`.
 * Chapter-only input yields `verse: null`; use `refStartPoint` / `refEndPoint`
 * to get concrete bounds (verse 1 start / verse 999 end).
 * Returns null for unknown books or unparseable input.
 */
export function parseRef(raw: string): Ref | null {
  const result = parseRefInternal(raw);
  return result.ok ? result.ref : null;
}

function parseEndSide(left: Ref, raw: string): ParseRefResult {
  const text = raw.trim();
  const full = parseRefInternal(text);
  if (full.ok) return full;
  if (full.code === "unknown_book") return full;

  const cv = CHAPTER_VERSE_RE.exec(text);
  if (cv) {
    return { ok: true, ref: { book: left.book, chapter: Number(cv[1]), verse: Number(cv[2]) } };
  }
  const bare = BARE_NUMBER_RE.exec(text);
  if (bare) {
    const n = Number(bare[1]);
    // `Gen 22:1-19` -> verse range; `Exod 3-4` -> chapter range.
    return left.verse != null
      ? { ok: true, ref: { book: left.book, chapter: left.chapter, verse: n } }
      : { ok: true, ref: { book: left.book, chapter: n, verse: null } };
  }
  return { ok: false, code: "invalid_format", message: `cannot parse reference "${raw}"` };
}

type ParseRangeResult =
  | { ok: true; range: RefRange; issues: RefIssue[] }
  | { ok: false; issues: RefIssue[] };

function parseRangeInternal(raw: string): ParseRangeResult {
  const sep = RANGE_SEP_RE.exec(raw.trim());
  const leftRaw = sep ? sep[1] : raw;
  const rightRaw = sep ? sep[2] : null;

  const start = parseRefInternal(leftRaw);
  if (!start.ok) return { ok: false, issues: [{ code: start.code, message: start.message }] };

  const issues: RefIssue[] = [...chapterIssues(start.ref)];
  let end: Ref = start.ref;
  if (rightRaw != null) {
    const parsedEnd = parseEndSide(start.ref, rightRaw);
    if (!parsedEnd.ok) {
      return { ok: false, issues: [...issues, { code: parsedEnd.code, message: parsedEnd.message }] };
    }
    end = parsedEnd.ref;
    issues.push(...chapterIssues(end));
  }

  if (rangeStartKey({ start: start.ref, end }) > rangeEndKey({ start: start.ref, end })) {
    issues.push({ code: "start_after_end", message: `"${raw}" starts after it ends` });
  }
  return { ok: true, range: { start: start.ref, end }, issues };
}

/**
 * Parse a reference or range: `Gen 22:1-19`, `Exod 3-4`, `Gen 37 - Exod 2`,
 * `Gen 22:1–23:20` (en dash), `Gen 37 to Exod 2`. A single reference becomes a
 * degenerate range (start === end). Returns null when unparseable.
 */
export function parseRange(raw: string): RefRange | null {
  const result = parseRangeInternal(raw);
  return result.ok ? result.range : null;
}

/** Concrete start of a ref: chapter-only becomes verse 1. */
export function refStartPoint(ref: Ref): RefPoint {
  return { book: ref.book, chapter: ref.chapter, verse: ref.verse ?? 1 };
}

/** Concrete end of a ref: chapter-only becomes verse 999. */
export function refEndPoint(ref: Ref): RefPoint {
  return { book: ref.book, chapter: ref.chapter, verse: ref.verse ?? 999 };
}

/** Concrete start of a range (verse 1 when the start is chapter-only). */
export function rangeStartPoint(range: RefRange): RefPoint {
  return refStartPoint(range.start);
}

/** Concrete end of a range (verse 999 when the end is chapter-only). */
export function rangeEndPoint(range: RefRange): RefPoint {
  return refEndPoint(range.end);
}

/**
 * Canonical ordering key: `bookIndex * 1e6 + chapter * 1e3 + verse`.
 * Throws for unknown books.
 */
export function sortKey(point: RefPoint | Ref): number {
  const info = getBook(point.book);
  if (!info) throw new Error(`sortKey: unknown book "${point.book}"`);
  const verse = point.verse ?? 1;
  return info.index * 1e6 + point.chapter * 1e3 + verse;
}

/** Sort key of the range's concrete start (verse 1 for chapter-only starts). */
export function rangeStartKey(range: RefRange): number {
  return sortKey(rangeStartPoint(range));
}

/** Sort key of the range's concrete end (verse 999 for chapter-only ends). */
export function rangeEndKey(range: RefRange): number {
  return sortKey(rangeEndPoint(range));
}

/** True when ranges `a` and `b` share at least one verse (touching counts). */
export function overlap(a: RefRange, b: RefRange): boolean {
  return rangeStartKey(a) <= rangeEndKey(b) && rangeEndKey(a) >= rangeStartKey(b);
}

function shortName(bookName: string): string {
  return getBook(bookName)?.short ?? bookName;
}

function pointText(ref: Ref): string {
  return ref.verse == null ? String(ref.chapter) : `${ref.chapter}:${ref.verse}`;
}

/**
 * Display formatter collapsing repeated books:
 * `Gen 22:1-19`, `Gen 12:1-25:10`, `Gen 12-25`, `Gen 37 - Exod 2`.
 */
export function formatRange(range: RefRange): string {
  const { start, end } = range;
  const s = shortName(start.book);

  if (start.book !== end.book) {
    return `${s} ${pointText(start)} - ${shortName(end.book)} ${pointText(end)}`;
  }
  if (start.chapter === end.chapter) {
    if (start.verse == null && end.verse == null) return `${s} ${start.chapter}`;
    if (start.verse != null && end.verse != null) {
      return start.verse === end.verse
        ? `${s} ${start.chapter}:${start.verse}`
        : `${s} ${start.chapter}:${start.verse}-${end.verse}`;
    }
    return `${s} ${pointText(start)}-${pointText(end)}`;
  }
  return `${s} ${pointText(start)}-${pointText(end)}`;
}

/** Display formatter for a single reference, e.g. `Gen 22:1` or `Gen 22`. */
export function formatRef(ref: Ref): string {
  return formatRange({ start: ref, end: ref });
}

/**
 * Validate one reference string (single ref or range) for the schema:
 * unknown book, malformed input, chapter beyond the book, and reversed
 * ranges are errors. Verse numbers are NOT validated.
 */
export function validateRefString(raw: string): RefIssue[] {
  return parseRangeInternal(raw).issues;
}

/** Validate a schema span (`{ start, end }`). Verse numbers are NOT validated. */
export function validateSpan(span: { start: string; end: string }): RefIssue[] {
  const start = parseRangeInternal(span.start);
  const end = parseRangeInternal(span.end);
  const issues: RefIssue[] = [...start.issues, ...end.issues];
  if (start.ok && end.ok && rangeStartKey(start.range) > rangeEndKey(end.range)) {
    issues.push({
      code: "start_after_end",
      message: `span start "${span.start}" is after span end "${span.end}"`,
    });
  }
  return issues;
}
