import assert from "node:assert/strict";
import test from "node:test";

import {
  evidenceBindingFailures,
  isAttestedTrackedPath,
  sourceTreeDigestFromLsTree,
  trackedInputPathsFromLsFiles,
} from "./local-first-ci-attestation.mjs";

test("source-tree digest is stable across ls-tree ordering and line endings", () => {
  const a = "100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tpackage.json\n100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tlefthook.yml\n";
  const b = "100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tlefthook.yml\r\n100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tpackage.json\r\n";

  assert.equal(sourceTreeDigestFromLsTree(a), sourceTreeDigestFromLsTree(b));
});

test("source-tree digest changes when an attested blob changes", () => {
  const before = "100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tpackage.json\n";
  const after = "100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tpackage.json\n";

  assert.notEqual(sourceTreeDigestFromLsTree(before), sourceTreeDigestFromLsTree(after));
});

test("the complete tracked repository is attested and only generated .ci evidence is excluded", () => {
  const listed = [
    "open-sse/src/index.ts",
    "apps/web/vite.config.ts",
    "docs/README.md",
    ".ci/local-first-ci-manifest.json",
    ".ci/local-first-ci-gates/typecheck-core.proof.json",
  ].join("\0");

  assert.deepEqual(trackedInputPathsFromLsFiles(`${listed}\0`), [
    "apps/web/vite.config.ts",
    "docs/README.md",
    "open-sse/src/index.ts",
  ]);
  assert.equal(isAttestedTrackedPath("open-sse/src/index.ts"), true);
  assert.equal(isAttestedTrackedPath("node_modules/committed-fixture.txt"), true);
  assert.equal(isAttestedTrackedPath("dist/committed-fixture.txt"), true);
  assert.equal(isAttestedTrackedPath(".ci/evidence.json"), false);
});

test("source-tree digest detects product/config additions, deletion, and rename", () => {
  const base = [
    "100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\topen-sse/src/index.ts",
    "100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tapps/web/vite.config.ts",
  ].join("\0");
  const added = `${base}\0${"100644 blob cccccccccccccccccccccccccccccccccccccccc\topen-sse/src/new.ts"}`;
  const deleted = "100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tapps/web/vite.config.ts";
  const renamed = [
    "100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\topen-sse/src/renamed.ts",
    "100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tapps/web/vite.config.ts",
  ].join("\0");

  assert.notEqual(sourceTreeDigestFromLsTree(base), sourceTreeDigestFromLsTree(added));
  assert.notEqual(sourceTreeDigestFromLsTree(base), sourceTreeDigestFromLsTree(deleted));
  assert.notEqual(sourceTreeDigestFromLsTree(base), sourceTreeDigestFromLsTree(renamed));
});

test("generated .ci evidence cannot make the source-tree digest self-referential", () => {
  const source = "100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\topen-sse/src/index.ts";
  const withEvidence = `${source}\0${"100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\t.ci/local-first-ci-manifest.json"}`;
  assert.equal(sourceTreeDigestFromLsTree(source), sourceTreeDigestFromLsTree(withEvidence));
});

test("stale source, proof, and log tamper are rejected", () => {
  const proof = {
    input: { hash: "a".repeat(64), sourceTreeSha256: "b".repeat(64) },
    log: { sha256: "c".repeat(64) },
  };
  assert.deepEqual(
    evidenceBindingFailures({
      proof,
      actualLogHash: "d".repeat(64),
      expectedInputHash: "e".repeat(64),
      expectedSourceTreeHash: "f".repeat(64),
      manifestProofHash: "1".repeat(64),
      actualProofHash: "2".repeat(64),
    }),
    ["log hash mismatch", "input hash mismatch", "source-tree hash mismatch", "proof hash mismatch"],
  );
  assert.deepEqual(
    evidenceBindingFailures({
      proof,
      actualLogHash: proof.log.sha256,
      expectedInputHash: proof.input.hash,
      expectedSourceTreeHash: proof.input.sourceTreeSha256,
      manifestProofHash: "3".repeat(64),
      actualProofHash: "3".repeat(64),
    }),
    [],
  );
});
