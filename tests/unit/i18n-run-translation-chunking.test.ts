import test from "node:test";
import assert from "node:assert/strict";
import { chunkMarkdown } from "../../scripts/i18n/run-translation.mjs";

// The docs translator splits a page into chunks so one upstream call stays
// short. It used to break only on `## ` headings, so a single long section
// (README.md carries a 16 KB one, USER_GUIDE.md a 20 KB one) became one
// oversized request that the slow fallback model could not answer inside the
// backend's 10-minute fetch timeout — the three biggest docs of every locale
// then failed with "fetch failed" on every retry.

const para = (label: string, n = 12) =>
  Array.from({ length: n }, (_, i) => `${label} sentence ${i + 1} with some filler text.`).join(
    " "
  );

test("a section longer than maxChars is split on sub-headings and paragraphs", () => {
  const body = [
    "## Big",
    para("a"),
    "",
    "### Part one",
    para("b"),
    "",
    para("c"),
    "",
    "### Part two",
    para("d"),
  ].join("\n");
  const chunks = chunkMarkdown(body, 700);
  assert.ok(chunks.length > 1, "must split an oversized section");
  for (const chunk of chunks) assert.ok(chunk.length <= 700, `chunk too big: ${chunk.length}`);
  // Nothing lost: re-joining with blank lines reproduces every line of the source.
  const lines = (s: string) => s.split("\n").filter((l) => l.trim() !== "");
  assert.deepEqual(lines(chunks.join("\n\n")), lines(body));
});

test("never splits inside a fenced code block", () => {
  const code = [
    "```ts",
    ...Array.from({ length: 30 }, (_, i) => `const v${i} = ${i};`),
    "```",
  ].join("\n");
  const body = ["## Code", para("x"), "", code, "", para("y")].join("\n");
  const chunks = chunkMarkdown(body, 500);
  const withFence = chunks.filter((c) => c.includes("```"));
  for (const chunk of withFence) {
    assert.equal(
      (chunk.match(/```/g) ?? []).length % 2,
      0,
      "fence must open and close in the same chunk"
    );
  }
});

test("keeps the old behaviour for short pages and for normal ## sections", () => {
  assert.deepEqual(chunkMarkdown("# Title\n\nshort", 6000), ["# Title\n\nshort"]);
  const body = ["## A", para("a", 4), "", "## B", para("b", 4), "", "## C", para("c", 4)].join(
    "\n"
  );
  const chunks = chunkMarkdown(body, 400);
  assert.ok(chunks.every((c) => c.length <= 400));
  assert.ok(chunks.length > 1);
  for (const chunk of chunks.slice(1)) assert.match(chunk, /^## /, "cuts land on ## boundaries");
});
