---
work_package_id: WP07
title: Git Adapter
lane: "done"
dependencies: [WP05]
base_branch: 001-spec-driven-development-engine-WP05
base_commit: 5caddd188f117c68c177b4198250fa4251c931de
created_at: '2026-02-28T09:38:28.070833+00:00'
subtasks:
- T038
- T039
- T040
- T041
- T042
- T043
phase: Phase 2 - Adapters
assignee: ''
agent: "claude-wp07"
shell_pid: "57564"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP07: Git Adapter

## Implementation Command

```bash
spec-kitty implement WP07 --base WP05
```

## Objectives

Implement the git adapter in `crates/agileplus-git/` that fulfills the `VcsPort` trait from WP05. This adapter uses `git2` (libgit2 Rust bindings) for all git operations -- no shelling out to the `git` CLI. It provides worktree management, branch operations, artifact read/write, and git history scanning for `rebuild_from_git` support.

### Success Criteria

1. `GitVcsAdapter` implements every method of `VcsPort`.
2. Worktree operations create/list/cleanup worktrees at `.worktrees/<feature-slug>-<WP-id>/`.
3. Branch operations create, checkout, merge, and detect conflicts using git2.
4. Artifact operations read/write files in `kitty-specs/<feature>/` paths.
5. Integration tests pass using temporary git repositories (not the real repo).
6. All git2 errors are mapped to `DomainError` variants.
7. No use of `std::process::Command("git", ...)` -- pure git2.

## Context & Constraints

- **Library**: `git2` crate (libgit2 bindings). See `research.md` R2 for decision rationale. git2 is used by cargo itself.
- **Worktree convention**: `.worktrees/<feature-slug>-<WP-id>/` relative to repo root. See `plan.md` section 3.
- **Artifact layout**: All spec artifacts live in `kitty-specs/<feature>/` as defined in `data-model.md` "Git Artifact Layout".
- **Platform**: Must work on macOS (primary) and Linux (CI). Be aware of case-insensitive filesystems on macOS.
- **No CLI shelling**: All operations via git2 API. This ensures type safety, proper error handling, and testability.
- **Thread safety**: git2 `Repository` is not `Send`. Use `parking_lot::Mutex` or open a fresh `Repository` handle per operation.

## Subtask Guidance

---

### T038: Implement `GitVcsAdapter` struct implementing `VcsPort`

**Purpose**: Create the adapter struct that wraps a git2 Repository and implements VcsPort.

**Steps**:
1. Create `crates/agileplus-git/src/lib.rs` with the adapter struct.
2. Define `GitVcsAdapter`:
   ```rust
   pub struct GitVcsAdapter {
       repo_path: PathBuf,
   }
   ```
   Note: Do NOT store `git2::Repository` in the struct (it's not `Send`). Instead, open a fresh handle in each method:
   ```rust
   fn open_repo(&self) -> Result<Repository, DomainError> {
       Repository::open(&self.repo_path).map_err(|e| DomainError::Vcs(e.to_string()))
   }
   ```

3. Implement constructor:
   - `pub fn new(repo_path: PathBuf) -> Result<Self, DomainError>` -- verify path is a valid git repo.
   - `pub fn from_current_dir() -> Result<Self, DomainError>` -- discover repo from CWD using `Repository::discover`.

4. Define a `DomainError` mapping from `git2::Error`:
   - `NotFound` -> `DomainError::NotFound`
   - `Exists` -> `DomainError::AlreadyExists`
   - Other -> `DomainError::Vcs(message)`

5. Implement `VcsPort` for `GitVcsAdapter` (method bodies in T039-T042).

**Files**: `crates/agileplus-git/src/lib.rs`

**Validation**:
- `GitVcsAdapter::new` succeeds on a valid git repo and fails on a non-repo directory.
- `open_repo()` returns a usable `Repository` handle.
- The adapter is `Send + Sync` (required for trait object in AppContext).

---

### T039: Implement worktree operations

**Purpose**: Manage isolated worktrees for parallel WP implementation. Each WP gets its own worktree so agents don't conflict.

**Steps**:
1. Create `crates/agileplus-git/src/worktree.rs` (or implement in lib.rs).

2. **create_worktree**:
   ```rust
   async fn create_worktree(&self, feature_slug: &str, wp_id: &str) -> Result<PathBuf, DomainError>
   ```
   - Compute worktree path: `<repo_root>/.worktrees/<feature_slug>-<wp_id>/`
   - Create the directory if it doesn't exist.
   - Create a branch: `<feature_slug>-<wp_id>` based on current HEAD (or a specified base).
   - Use `repo.worktree(name, path, opts)` to create the git worktree.
   - git2 API: `Repository::worktree()` creates a worktree. Use `WorktreeAddOptions` to set the branch.
   - Return the absolute path to the worktree.

3. **list_worktrees**:
   ```rust
   async fn list_worktrees(&self) -> Result<Vec<WorktreeInfo>, DomainError>
   ```
   - Use `repo.worktrees()` to get worktree names.
   - For each, use `repo.find_worktree(name)` to get details.
   - Parse feature_slug and wp_id from the worktree name (split on last `-`).
   - Return `WorktreeInfo` with path, branch, feature_slug, wp_id.

4. **cleanup_worktree**:
   ```rust
   async fn cleanup_worktree(&self, worktree_path: &Path) -> Result<(), DomainError>
   ```
   - Validate the path is under `.worktrees/`.
   - Use `repo.find_worktree(name)` then `worktree.prune(opts)` with force option.
   - Delete the worktree directory from filesystem.
   - Optionally delete the associated branch.

5. Ensure `.worktrees/` is in `.gitignore`.

**Files**: `crates/agileplus-git/src/worktree.rs`

**Validation**:
- Create a worktree, verify directory exists and contains a valid git checkout.
- List worktrees, verify the created worktree appears.
- Cleanup worktree, verify directory removed and `git worktree list` no longer shows it.
- Worktree name follows convention: `<feature_slug>-<wp_id>`.

---

### T040: Implement branch operations

**Purpose**: Create branches, checkout, merge, and detect conflicts -- all building blocks for the implement/ship workflow.

**Steps**:
1. Create `crates/agileplus-git/src/branch.rs`.

2. **create_branch**:
   ```rust
   async fn create_branch(&self, branch_name: &str, base: &str) -> Result<(), DomainError>
   ```
   - Resolve `base` to a commit: `repo.revparse_single(base)?.peel_to_commit()?`
   - Create branch: `repo.branch(branch_name, &commit, false)?`
   - `false` = don't force (error if branch exists).

3. **checkout_branch**:
   ```rust
   async fn checkout_branch(&self, branch_name: &str) -> Result<(), DomainError>
   ```
   - Resolve branch to reference: `repo.find_branch(branch_name, BranchType::Local)?`
   - Set HEAD: `repo.set_head(refname)?`
   - Checkout HEAD: `repo.checkout_head(Some(CheckoutBuilder::new().force()))?`

4. **merge_to_target**:
   ```rust
   async fn merge_to_target(&self, source: &str, target: &str) -> Result<MergeResult, DomainError>
   ```
   - Checkout target branch.
   - Get annotated commit for source: `repo.find_annotated_commit(oid)?`
   - Perform merge analysis: `repo.merge_analysis(&[&annotated])?`
   - If fast-forward possible: `reference.set_target(oid, "fast-forward merge")?`
   - If normal merge needed: `repo.merge(&[&annotated], None, None)?`
     - Check for conflicts via `repo.index()?.has_conflicts()`.
     - If conflicts: return `MergeResult { success: false, conflicts: [...] }`.
     - If clean: create merge commit, return `MergeResult { success: true, merged_commit: Some(oid) }`.

5. **detect_conflicts**:
   ```rust
   async fn detect_conflicts(&self, source: &str, target: &str) -> Result<Vec<ConflictInfo>, DomainError>
   ```
   - Perform a dry-run merge analysis without committing.
   - Use `repo.merge_trees()` on the two branch trees with the merge base.
   - Iterate `index.conflicts()` to collect conflicting paths.
   - Return `ConflictInfo` for each conflicting file.

**Files**: `crates/agileplus-git/src/branch.rs`

**Validation**:
- Create branch from HEAD, verify branch exists.
- Checkout branch, verify HEAD points to it.
- Merge non-conflicting branches, verify fast-forward or merge commit created.
- Merge conflicting branches, verify `MergeResult.success == false` and conflicts listed.
- detect_conflicts returns empty vec for non-conflicting branches.

---

### T041: Implement artifact operations

**Purpose**: Read and write spec/plan/audit artifacts in the `kitty-specs/<feature>/` directory structure.

**Steps**:
1. Create `crates/agileplus-git/src/artifact.rs`.

2. **read_artifact**:
   ```rust
   async fn read_artifact(&self, feature_slug: &str, relative_path: &str) -> Result<String, DomainError>
   ```
   - Compute full path: `<repo_root>/kitty-specs/<feature_slug>/<relative_path>`
   - Read file contents via `std::fs::read_to_string()`.
   - Return `DomainError::NotFound` if file doesn't exist.
   - Note: This reads from the working directory, not from git objects. This is intentional -- artifacts are always read from the current working tree state.

3. **write_artifact**:
   ```rust
   async fn write_artifact(&self, feature_slug: &str, relative_path: &str, content: &str) -> Result<(), DomainError>
   ```
   - Compute full path, create parent directories if needed.
   - Write content via `std::fs::write()`.
   - Stage the file: `repo.index()?.add_path(relative)?; repo.index()?.write()?`
   - Do NOT commit -- the caller decides when to commit (batch multiple writes).

4. **artifact_exists**:
   ```rust
   async fn artifact_exists(&self, feature_slug: &str, relative_path: &str) -> Result<bool, DomainError>
   ```
   - Check `Path::exists()` for the computed path.

5. **scan_feature_artifacts**:
   ```rust
   async fn scan_feature_artifacts(&self, feature_slug: &str) -> Result<FeatureArtifacts, DomainError>
   ```
   - Base path: `<repo_root>/kitty-specs/<feature_slug>/`
   - Read `meta.json` if present.
   - Read `audit/chain.jsonl` if present.
   - Glob `evidence/**/*` for evidence file paths.
   - Return `FeatureArtifacts` struct.

**Files**: `crates/agileplus-git/src/artifact.rs`

**Validation**:
- Write an artifact, read it back, verify content matches.
- Write stages the file in git index.
- Read non-existent artifact returns NotFound.
- scan_feature_artifacts finds meta.json, chain.jsonl, and evidence files.

---

### T042: Implement git history scanning for `rebuild_from_git()` support

**Purpose**: Scan the git repository for all feature artifact directories to support the SQLite rebuild operation (FR-017).

**Steps**:
1. Add to `crates/agileplus-git/src/artifact.rs` or a new `crates/agileplus-git/src/scanner.rs`.

2. Implement a scanning function:
   ```rust
   pub fn scan_all_features(&self) -> Result<Vec<String>, DomainError>
   ```
   - List directories under `kitty-specs/` in the working tree.
   - Filter to directories containing `meta.json`.
   - Return feature slugs.

3. Implement commit history extraction:
   ```rust
   pub fn get_feature_history(&self, feature_slug: &str) -> Result<Vec<CommitInfo>, DomainError>
   ```
   - Walk the commit log filtered to paths under `kitty-specs/<feature_slug>/`.
   - Use `repo.revwalk()` with path filtering.
   - Return `CommitInfo { oid: String, message: String, author: String, timestamp: DateTime<Utc> }`.

4. This supports `rebuild_from_git` in WP06: the SQLite adapter calls `scan_all_features()` to discover features, then `scan_feature_artifacts()` for each to extract data.

**Files**: `crates/agileplus-git/src/scanner.rs` or `crates/agileplus-git/src/artifact.rs`

**Validation**:
- In a test repo with 2 feature dirs, `scan_all_features` returns both slugs.
- `get_feature_history` returns commits touching the specified feature dir.
- Directories without `meta.json` are excluded from scan results.

---

### T043: Write integration tests using temp git repos

**Purpose**: Comprehensive integration tests that exercise all VcsPort methods against real (temporary) git repositories.

**Steps**:
1. Create `crates/agileplus-git/tests/integration.rs`.

2. Test harness setup:
   ```rust
   fn setup_test_repo() -> (TempDir, GitVcsAdapter) {
       let dir = tempdir().unwrap();
       // git2::Repository::init(dir.path())
       // Create initial commit (empty tree)
       // Return adapter pointing at temp repo
   }
   ```

3. Write test cases grouped by operation:

   **Worktree tests**:
   - `test_create_and_list_worktree`: Create worktree, list, verify it appears.
   - `test_cleanup_worktree`: Create then cleanup, verify removed.
   - `test_create_duplicate_worktree_fails`: Attempt duplicate, verify error.

   **Branch tests**:
   - `test_create_branch`: Create branch, verify it exists.
   - `test_checkout_branch`: Create and checkout, verify HEAD.
   - `test_merge_fast_forward`: Create branch, add commit, merge back, verify fast-forward.
   - `test_merge_with_conflict`: Create divergent branches editing same file, merge, verify conflict reported.
   - `test_detect_conflicts`: Verify dry-run conflict detection without mutating state.

   **Artifact tests**:
   - `test_write_and_read_artifact`: Write spec.md, read it back.
   - `test_artifact_exists`: Check existence before and after write.
   - `test_read_missing_artifact`: Verify NotFound error.
   - `test_scan_feature_artifacts`: Write meta.json + chain.jsonl + evidence, scan, verify all found.

   **Scanner tests**:
   - `test_scan_all_features`: Create 2 feature dirs with meta.json, scan, verify both found.
   - `test_scan_excludes_dirs_without_meta`: Create dir without meta.json, verify excluded.

4. Each test creates a fresh temp repo and tears it down automatically via `TempDir` drop.
5. Use `git2::Repository::init()` for test repos, NOT the real project repo.

**Files**: `crates/agileplus-git/tests/integration.rs`

**Validation**:
- All tests pass on macOS and Linux.
- Tests are isolated (temp dirs, no shared state).
- Each VcsPort method has at least one test.
- Conflict scenarios are realistic (divergent edits to same file/line).

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| git2 worktree API quirks | Medium -- API may differ from git CLI behavior | Test extensively on both macOS and Linux. Check git2 version compatibility. |
| Case-insensitive filesystems (macOS) | Low -- path comparisons may fail | Use canonical paths via `std::fs::canonicalize()`. Normalize slugs to lowercase. |
| git2 Repository not Send | Medium -- can't share across async tasks | Open fresh Repository handle per operation. Store only `repo_path` in struct. |
| Merge conflict detection accuracy | Medium -- git2 merge analysis may not match git CLI | Compare merge results against `git merge --no-commit` for known conflict scenarios. |
| Large repo performance | Low -- scanning all features may be slow | Use directory listing (not git log walking) for feature discovery. Reserve history scanning for explicit requests. |
| Worktree cleanup leaving state | Low -- orphaned worktree references | Use `prune` with force flag. Add a `prune_all_orphaned` maintenance method. |

## Review Guidance

1. **No CLI shelling**: Verify zero uses of `std::process::Command` for git operations.
2. **Error mapping**: All `git2::Error` instances mapped to `DomainError` variants with context.
3. **Path safety**: All paths computed relative to repo root. No path traversal vulnerabilities.
4. **Thread safety**: Verify `GitVcsAdapter` is `Send + Sync`. No stored `Repository` references.
5. **Test isolation**: Every test uses a fresh temp repo. No test depends on another test's state.
6. **Worktree convention**: Paths match `.worktrees/<feature-slug>-<wp-id>/` exactly.
7. **Artifact staging**: `write_artifact` stages but does not commit.

## Activity Log

| Timestamp | Action | Agent | Details |
|-----------|--------|-------|---------|
| 2026-02-27T00:00:00Z | Prompt generated | system | WP07 prompt created via /spec-kitty.tasks |
- 2026-02-28T09:38:28Z – claude-wp07 – shell_pid=57564 – lane=doing – Assigned agent via workflow command
- 2026-02-28T09:48:22Z – claude-wp07 – shell_pid=57564 – lane=for_review – Ready for review: GitVcsAdapter with 19 passing tests
- 2026-02-28T09:51:01Z – claude-wp07 – shell_pid=57564 – lane=done – Review passed: path traversal fix applied, all 19 tests pass
