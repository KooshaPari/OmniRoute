import { test } from "node:test";
import assert from "node:assert/strict";
import { changedLeaves, parseReviewResponse } from "../../scripts/i18n/review-locale.mjs";

test("changedLeaves lists new and rewritten leaves only", () => {
  const before = { "a.x": "Save", "a.y": "Salvar", "a.z": "Old" };
  const after = { "a.x": "Salvar", "a.y": "Salvar", "a.z": "Novo", "a.w": "Novo também" };
  assert.deepEqual(changedLeaves(before, after), {
    "a.x": "Salvar",
    "a.z": "Novo",
    "a.w": "Novo também",
  });
});

test("parseReviewResponse keeps only real corrections for known ids", () => {
  const text = 'Here you go:\n{"a.x": "OK", "a.z": "Novo (corrigido)", "ghost": "x", "a.w": ""}';
  assert.deepEqual(parseReviewResponse(text, ["a.x", "a.z", "a.w"]), {
    "a.z": "Novo (corrigido)",
  });
});

test("parseReviewResponse tolerates a fenced JSON block", () => {
  assert.deepEqual(parseReviewResponse('```json\n{"k":"v"}\n```', ["k"]), { k: "v" });
});
