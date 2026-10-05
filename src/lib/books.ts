/**
 * 66-book Protestant canon: lookup tables and alias handling.
 *
 * Owned by the CANON + REF PARSER task. Reference parsing lives in `refs.ts`.
 */

export interface Book {
  /** 1-based position in the Protestant canon (Genesis = 1, Revelation = 66). */
  index: number;
  /** Canonical English name, e.g. `Genesis`, `1 Samuel`, `Song of Songs`. */
  name: string;
  /** Short display name used by the formatter, e.g. `Gen`, `1 Sam`, `Ps`. */
  short: string;
  /** Number of chapters in the book. */
  chapters: number;
  /** Accepted spellings; matched case-insensitively with periods/spaces ignored. */
  aliases: string[];
}

function book(
  index: number,
  name: string,
  short: string,
  chapters: number,
  aliases: string[] = [],
): Book {
  return { index, name, short, chapters, aliases };
}

/** The 66 books of the Protestant canon, in canonical order. */
export const BOOKS: Book[] = [
  book(1, "Genesis", "Gen", 50, ["Ge", "Gn"]),
  book(2, "Exodus", "Exod", 40, ["Exo", "Ex"]),
  book(3, "Leviticus", "Lev", 27, ["Le", "Lv"]),
  book(4, "Numbers", "Num", 36, ["Nu", "Nm", "Nb"]),
  book(5, "Deuteronomy", "Deut", 34, ["De", "Dt", "Deu"]),
  book(6, "Joshua", "Josh", 24, ["Jos", "Jsh"]),
  book(7, "Judges", "Judg", 21, ["Jdg", "Jdgs", "Jg"]),
  book(8, "Ruth", "Ruth", 4, ["Rth", "Ru"]),
  book(9, "1 Samuel", "1 Sam", 31, ["1Sam", "1Samuel", "1 Sa", "1Sm", "1 S", "I Samuel", "I Sam", "First Samuel", "1st Samuel"]),
  book(10, "2 Samuel", "2 Sam", 24, ["2Sam", "2Samuel", "2 Sa", "2Sm", "2 S", "II Samuel", "II Sam", "Second Samuel", "2nd Samuel"]),
  book(11, "1 Kings", "1 Kgs", 22, ["1Kgs", "1Kings", "1 Ki", "1Kg", "1 K", "I Kings", "I Kgs", "First Kings", "1st Kings"]),
  book(12, "2 Kings", "2 Kgs", 25, ["2Kgs", "2Kings", "2 Ki", "2Kg", "2 K", "II Kings", "II Kgs", "Second Kings", "2nd Kings"]),
  book(13, "1 Chronicles", "1 Chr", 29, ["1Chr", "1Chronicles", "1 Ch", "1Ch", "I Chronicles", "I Chr", "First Chronicles", "1st Chronicles"]),
  book(14, "2 Chronicles", "2 Chr", 36, ["2Chr", "2Chronicles", "2 Ch", "2Ch", "II Chronicles", "II Chr", "Second Chronicles", "2nd Chronicles"]),
  book(15, "Ezra", "Ezra", 10, ["Ezr"]),
  book(16, "Nehemiah", "Neh", 13, ["Ne", "Nehm"]),
  book(17, "Esther", "Esth", 10, ["Est", "Es", "Estr"]),
  book(18, "Job", "Job", 42, ["Jb"]),
  book(19, "Psalms", "Ps", 150, ["Psalm", "Psa", "Pss", "Ps"]),
  book(20, "Proverbs", "Prov", 31, ["Pro", "Pr", "Prv"]),
  book(21, "Ecclesiastes", "Eccl", 12, ["Ecc", "Eccles", "Ec", "Qoheleth", "Qoh"]),
  book(22, "Song of Songs", "Song", 8, ["SongOfSongs", "SongOfSolomon", "Song of Solomon", "SOS", "SoS", "Canticles", "Cant", "Sg", "So"]),
  book(23, "Isaiah", "Isa", 66, ["Is"]),
  book(24, "Jeremiah", "Jer", 52, ["Je", "Jr"]),
  book(25, "Lamentations", "Lam", 5, ["La", "Lam"]),
  book(26, "Ezekiel", "Ezek", 48, ["Eze", "Ezk"]),
  book(27, "Daniel", "Dan", 12, ["Da", "Dn"]),
  book(28, "Hosea", "Hos", 14, ["Ho", "Hs"]),
  book(29, "Joel", "Joel", 3, ["Jl", "Jol"]),
  book(30, "Amos", "Amos", 9, ["Am", "Ams"]),
  book(31, "Obadiah", "Obad", 1, ["Ob", "Oba", "Obd"]),
  book(32, "Jonah", "Jonah", 4, ["Jon", "Jnh"]),
  book(33, "Micah", "Micah", 7, ["Mic", "Mc", "Mch"]),
  book(34, "Nahum", "Nah", 3, ["Na", "Nhm"]),
  book(35, "Habakkuk", "Hab", 3, ["Hb", "Habacuc", "Habk"]),
  book(36, "Zephaniah", "Zeph", 3, ["Zep", "Zp", "Zph"]),
  book(37, "Haggai", "Hag", 2, ["Hg", "Hagg"]),
  book(38, "Zechariah", "Zech", 14, ["Zec", "Zc", "Zch"]),
  book(39, "Malachi", "Mal", 4, ["Ml", "Mal"]),
  book(40, "Matthew", "Matt", 28, ["Mat", "Mt"]),
  book(41, "Mark", "Mark", 16, ["Mar", "Mk", "Mr"]),
  book(42, "Luke", "Luke", 24, ["Luk", "Lk"]),
  book(43, "John", "John", 21, ["Jn", "Jhn"]),
  book(44, "Acts", "Acts", 28, ["Act", "Ac"]),
  book(45, "Romans", "Rom", 16, ["Ro", "Rm", "Rmn"]),
  book(46, "1 Corinthians", "1 Cor", 16, ["1Cor", "1Corinthians", "1 Co", "1Co", "1 C", "I Corinthians", "I Cor", "First Corinthians", "1st Corinthians"]),
  book(47, "2 Corinthians", "2 Cor", 13, ["2Cor", "2Corinthians", "2 Co", "2Co", "2 C", "II Corinthians", "II Cor", "Second Corinthians", "2nd Corinthians"]),
  book(48, "Galatians", "Gal", 6, ["Ga", "Gl"]),
  book(49, "Ephesians", "Eph", 6, ["Ep", "Ephes"]),
  book(50, "Philippians", "Phil", 4, ["Php", "Pp", "Philipp"]),
  book(51, "Colossians", "Col", 4, ["Co", "Colo", "Coll"]),
  book(52, "1 Thessalonians", "1 Thess", 5, ["1Thess", "1Thessalonians", "1 Thes", "1 Th", "1Th", "I Thessalonians", "I Thess", "First Thessalonians", "1st Thessalonians"]),
  book(53, "2 Thessalonians", "2 Thess", 3, ["2Thess", "2Thessalonians", "2 Thes", "2 Th", "2Th", "II Thessalonians", "II Thess", "Second Thessalonians", "2nd Thessalonians"]),
  book(54, "1 Timothy", "1 Tim", 6, ["1Tim", "1Timothy", "1 Ti", "1Ti", "1 T", "I Timothy", "I Tim", "First Timothy", "1st Timothy"]),
  book(55, "2 Timothy", "2 Tim", 4, ["2Tim", "2Timothy", "2 Ti", "2Ti", "2 T", "II Timothy", "II Tim", "Second Timothy", "2nd Timothy"]),
  book(56, "Titus", "Titus", 3, ["Tit", "Ti"]),
  book(57, "Philemon", "Phlm", 1, ["Philem", "Phm", "Pm", "Phlm"]),
  book(58, "Hebrews", "Heb", 13, ["He", "Hbr"]),
  book(59, "James", "Jas", 5, ["Jm", "Jas", "Ja"]),
  book(60, "1 Peter", "1 Pet", 5, ["1Pet", "1Peter", "1 Pe", "1Pe", "1 P", "I Peter", "I Pet", "First Peter", "1st Peter"]),
  book(61, "2 Peter", "2 Pet", 3, ["2Pet", "2Peter", "2 Pe", "2Pe", "2 P", "II Peter", "II Pet", "Second Peter", "2nd Peter"]),
  book(62, "1 John", "1 John", 5, ["1John", "1 Jn", "1Jn", "1 J", "I John", "First John", "1st John"]),
  book(63, "2 John", "2 John", 1, ["2John", "2 Jn", "2Jn", "2 J", "II John", "Second John", "2nd John"]),
  book(64, "3 John", "3 John", 1, ["3John", "3 Jn", "3Jn", "3 J", "III John", "Third John", "3rd John"]),
  book(65, "Jude", "Jude", 1, ["Jud", "Jd", "Jud"]),
  book(66, "Revelation", "Rev", 22, ["Re", "Rv", "Apocalypse", "Apoc", "Rev"]),
];

/**
 * Normalize a book token for alias lookup: case-insensitive, ignoring
 * periods and whitespace. `1.Sam.` -> `1sam`, `Song of Songs` -> `songofsongs`.
 */
export function normalizeBookToken(raw: string): string {
  return raw.toLowerCase().replace(/[.\s]/g, "");
}

const ALIAS_MAP: Map<string, Book> = (() => {
  const map = new Map<string, Book>();
  for (const b of BOOKS) {
    for (const alias of [b.name, b.short, ...b.aliases]) {
      const key = normalizeBookToken(alias);
      const existing = map.get(key);
      if (existing && existing.index !== b.index) {
        throw new Error(
          `books.ts: alias "${alias}" collides between ${existing.name} and ${b.name}`,
        );
      }
      map.set(key, b);
    }
  }
  return map;
})();

const BY_NAME: Map<string, Book> = new Map(BOOKS.map((b) => [b.name, b]));

/** Look up a book by any accepted alias (or canonical name). Returns null when unknown. */
export function findBook(raw: string): Book | null {
  return ALIAS_MAP.get(normalizeBookToken(raw)) ?? null;
}

/** Look up a book by canonical name, e.g. `Genesis`. */
export function getBook(name: string): Book | undefined {
  return BY_NAME.get(name);
}
