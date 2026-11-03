import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  hasVerifiedHistoricalContinuity,
  shouldSuppressHistoricalMatch,
} from "../../scripts/check/resurrection-historical-exceptions.mjs";

const deletedPath =
  "src/app/(dashboard)/dashboard/playground/components/reasoningControls.ts";
const retainedPath =
  "src/app/(dashboard)/dashboard/playground/components/reasoningControlUtils.ts";
const deletionCommit = "e959da98875b202c3b660ae07741d3cffd789e94";
const hash = createHash("sha256").update("identical fixture bytes\n").digest("hex");

function createHistoryFixture(t, branchScenario = "positive") {
  const root = mkdtempSync(path.join(os.tmpdir(), "resurrection-history-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (filepath, content) => {
    const fullPath = path.join(root, filepath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  };
  const commit = (message) => {
    run("add", "-A");
    run(
      "-c",
      "user.name=fixture",
      "-c",
      "user.email=fixture@example.test",
      "commit",
      "-m",
      message
    );
    return run("rev-parse", "HEAD");
  };

  run("init", "-q", "-b", "main");
  write("history-before-baseline.txt", "history before baseline\n");
  const beforeBaseline = commit("commit before baseline");
  write(deletedPath, "identical fixture bytes\n");
  write(retainedPath, "identical fixture bytes\n");
  const parent = commit("add identical files");
  rmSync(path.join(root, deletedPath));
  const deletion = commit("delete original file");
  let relevantShallowBoundary = null;

  if (branchScenario === "same-branch-readd") {
    rmSync(path.join(root, retainedPath));
    commit("delete retained path");
    write(retainedPath, "identical fixture bytes\n");
    commit("re-add retained path");
  } else if (["side-branch-readd", "shallow-truncated-side-ancestry"].includes(branchScenario)) {
    run("checkout", "-q", "-b", "resurrection-side");
    rmSync(path.join(root, retainedPath));
    commit("side branch deletes retained path");
    write(retainedPath, "identical fixture bytes\n");
    relevantShallowBoundary = commit("side branch re-adds retained path");
    run("checkout", "-q", "main");
    write("main-change.txt", "advance main\n");
    commit("advance main independently");
    run("merge", "--no-ff", "resurrection-side", "-m", "merge side branch");
  }

  if (branchScenario === "shallow-complete-interval") {
    const shallowFile = run("rev-parse", "--git-path", "shallow");
    writeFileSync(path.join(root, shallowFile), `${beforeBaseline}\n`);
  } else if (branchScenario === "shallow-truncated-side-ancestry") {
    const shallowFile = run("rev-parse", "--git-path", "shallow");
    writeFileSync(path.join(root, shallowFile), `${relevantShallowBoundary}\n`);
  }

  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  return { git, parent, deletion };
}

test("real Git history suppresses exact preexisting duplicate while retained path stays continuous", (t) => {
  const { git, deletion } = createHistoryFixture(t);
  assert.equal(
    hasVerifiedHistoricalContinuity(git, deletedPath, retainedPath, deletion, hash),
    true
  );
});

test("real Git same-branch delete and re-add remains reportable", (t) => {
  const { git, deletion } = createHistoryFixture(t, "same-branch-readd");
  assert.equal(
    hasVerifiedHistoricalContinuity(git, deletedPath, retainedPath, deletion, hash),
    false
  );
});

test("real Git merged side-branch delete and re-add remains reportable", (t) => {
  const { git, deletion } = createHistoryFixture(t, "side-branch-readd");
  assert.equal(
    hasVerifiedHistoricalContinuity(git, deletedPath, retainedPath, deletion, hash),
    false
  );
});

test("real shallow repo with complete relevant interval can be proven", (t) => {
  const { git, deletion } = createHistoryFixture(t, "shallow-complete-interval");
  assert.equal(git("rev-parse", "--is-shallow-repository").trim(), "true");
  assert.equal(
    hasVerifiedHistoricalContinuity(git, deletedPath, retainedPath, deletion, hash),
    true
  );
});

test("real shallow repo with truncated side ancestry fails closed", (t) => {
  const { git, deletion } = createHistoryFixture(t, "shallow-truncated-side-ancestry");
  assert.equal(git("rev-parse", "--is-shallow-repository").trim(), "true");
  assert.equal(
    hasVerifiedHistoricalContinuity(git, deletedPath, retainedPath, deletion, hash),
    false
  );
});

test("unrelated deletion pair and changed hashes are never suppressed", () => {
  let queried = false;
  const git = () => {
    queried = true;
    throw new Error("must not query for an unrelated pair");
  };
  assert.equal(
    shouldSuppressHistoricalMatch(git, "src/other/deleted.ts", "src/new/copied.ts", deletionCommit, hash, hash),
    false
  );
  assert.equal(queried, false);
  assert.equal(
    shouldSuppressHistoricalMatch(git, deletedPath, retainedPath, deletionCommit, hash, "different"),
    false
  );
});

test("unrelated HEAD, empty rev-list, or unavailable shallow ancestry fails closed", () => {
  for (const scenario of ["unrelated", "empty", "shallow"]) {
    const git = (...args) => {
      if (args[0] === "show") return "identical fixture bytes\n";
      if (args[0] === "ls-tree") return "";
      if (args[0] === "rev-parse") return "false\n";
      if (args[0] === "merge-base") {
        if (scenario === "shallow") throw new Error("shallow boundary");
        return scenario === "unrelated" ? "different-base\n" : `${deletionCommit}\n`;
      }
      if (args[0] === "rev-list") return "";
      throw new Error(`unexpected git call: ${args.join(" ")}`);
    };
    assert.equal(
      hasVerifiedHistoricalContinuity(git, deletedPath, retainedPath, deletionCommit, hash),
      false,
      scenario
    );
  }
});

test("missing historical blobs and ambiguous snapshots fail closed", () => {
  const missingBlob = (...args) => {
    if (args[0] === "show" && args[1].endsWith(`:${retainedPath}`)) {
      throw new Error("retained blob unavailable");
    }
    if (args[0] === "rev-parse") return "false\n";
    return "";
  };
  assert.equal(
    hasVerifiedHistoricalContinuity(missingBlob, deletedPath, retainedPath, deletionCommit, hash),
    false
  );

  const missingSnapshot = (...args) => {
    if (args[0] === "show") return "identical fixture bytes\n";
    if (args[0] === "ls-tree") return "";
    if (args[0] === "rev-parse") return "false\n";
    if (args[0] === "merge-base") return `${deletionCommit}\n`;
    if (args[0] === "rev-list") return `${deletionCommit}\nmissing-path-commit ${deletionCommit}\n`;
    if (args[0] === "cat-file") throw new Error("retained path absent in snapshot");
    return "";
  };
  assert.equal(
    hasVerifiedHistoricalContinuity(missingSnapshot, deletedPath, retainedPath, deletionCommit, hash),
    false
  );
});
