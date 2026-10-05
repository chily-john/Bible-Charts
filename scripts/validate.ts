/**
 * `npm run validate` — runs the shared referential checks over the data files.
 * Exits non-zero when there are ERRORs; warnings are printed but never block.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateGraph, type ContentIndex, type Issue } from "../src/lib/validate";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function idsIn(dir: string): Set<string> {
  try {
    return new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.slice(0, -3))
    );
  } catch {
    return new Set();
  }
}

const content: ContentIndex = {
  people: idsIn(join("src", "content", "people")),
  events: idsIn(join("src", "content", "events")),
};

const result = validateGraph(
  readJson(join("src", "data", "graph.json")),
  readJson(join("src", "data", "eras.json")),
  readJson(join("src", "data", "themes.json")),
  content
);

function print(title: string, issues: Issue[]) {
  console.log(`\n${title} (${issues.length})`);
  for (const issue of issues) {
    console.log(`  ${issue.file} :: ${issue.id} :: ${issue.problem}`);
  }
}

print("ERRORS", result.errors);
print("WARNINGS", result.warnings);

if (result.errors.length > 0) {
  console.error(`\nvalidate: FAILED with ${result.errors.length} error(s)`);
  process.exit(1);
}
console.log(`\nvalidate: OK (0 errors, ${result.warnings.length} warning(s))`);