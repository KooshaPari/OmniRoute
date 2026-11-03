import { createHash } from "node:crypto";

const HISTORICAL_DELETION_COMMIT = "e959da98875b202c3b660ae07741d3cffd789e94";
const DELETED_PATH =
  "src/app/(dashboard)/dashboard/playground/components/reasoningControls.ts";
const RETAINED_PATH =
  "src/app/(dashboard)/dashboard/playground/components/reasoningControlUtils.ts";

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

function rawParents(git, commit) {
  return git("cat-file", "commit", commit)
    .split("\n")
    .filter((line) => line.startsWith("parent "))
    .map((line) => line.slice("parent ".length));
}

const MAX_RAW_ANCESTRY_COMMITS = 10000;

function isAncestorInRawHistory(git, target, descendant) {
  const pending = [descendant];
  const visited = new Set();
  while (pending.length > 0) {
    const commit = pending.pop();
    if (commit === target) return true;
    if (visited.has(commit)) continue;
    visited.add(commit);
    if (visited.size > MAX_RAW_ANCESTRY_COMMITS) throw new Error("raw ancestry proof exceeded limit");
    pending.push(...rawParents(git, commit));
  }
  return false;
}

/** Prove the shared historical bytes and continuous retained-path history. */
export function hasVerifiedHistoricalContinuity(
  git,
  deletedPath,
  retainedPath,
  deletionCommit,
  deletedHash
) {
  try {
    const parent = git("rev-parse", `${deletionCommit}^`).trim();
    if (!parent) return false;

    const deletedContent = git("show", `${parent}:${deletedPath}`);
    const retainedContent = git("show", `${parent}:${retainedPath}`);
    if (
      hashContent(deletedContent) !== deletedHash ||
      hashContent(retainedContent) !== deletedHash
    ) {
      return false;
    }

    const deletedAtCommit = git(
      "ls-tree",
      "-r",
      "--name-only",
      deletionCommit,
      "--",
      deletedPath
    );
    if (deletedAtCommit.split("\n").includes(deletedPath)) return false;

    if (git("merge-base", deletionCommit, "HEAD").trim() !== deletionCommit) return false;

    // `rev-list` observes shallow boundaries. Raw commit headers below verify
    // every omitted parent is genuinely excluded by the deletion parent's
    // ancestry, not hidden by a shallow boundary or incomplete object store.
    const snapshots = git("rev-list", "--parents", "HEAD", `^${parent}`)
      .split("\n")
      .filter(Boolean);
    if (snapshots.length === 0) return false;

    const interval = new Set(snapshots.map((line) => line.split(" ")[0]));
    if (!interval.has(deletionCommit)) return false;

    for (const commit of interval) {
      git("cat-file", "-e", `${commit}:${retainedPath}`);
      for (const ancestor of rawParents(git, commit)) {
        if (interval.has(ancestor)) continue;
        if (!isAncestorInRawHistory(git, ancestor, parent)) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Suppress only the known tracked-history collision; uncertainty remains a match. */
export function shouldSuppressHistoricalMatch(
  git,
  deletedPath,
  newPath,
  deletionCommit,
  deletedHash,
  currentHash
) {
  if (
    deletedPath !== DELETED_PATH ||
    newPath !== RETAINED_PATH ||
    deletionCommit !== HISTORICAL_DELETION_COMMIT ||
    deletedHash !== currentHash
  ) {
    return false;
  }

  return hasVerifiedHistoricalContinuity(
    git,
    deletedPath,
    newPath,
    deletionCommit,
    deletedHash
  );
}
