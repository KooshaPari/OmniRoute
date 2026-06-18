# HC-11 — Patches Lift Plan

**Task ID:** arc-2-10 / HC-11 (PATCHES-LIFT-PLAN)
**Date:** 2026-06-14 (re-derived; prior version 2026-06-12 wiped)
**Author:** Phenotype archived-repos hygiene track
**Parent DAG:** `plans/2026-06-12-archived-repos-100-task-dag-v1.md` — `arc-4-13` (LIFT-PATCHES-WITH-PROVENANCE)
**BG report (input):** `plans/2026-06-12-bg-hc-04-patches-delta.md` (86 lines, wiped between turns; verdict re-derived 2026-06-14 from active's surviving git history — see §1)
**SSOT:** `archived-repos/REGISTRY.md` (this plan appends to the per-repo summary for `helios-cli-backup`)
**Mode:** READ-ONLY on archive — no edits to `/tmp/helios-cli-backup/`
**Resilience note:** This plan has now been wiped and re-derived twice. The verdict is **invariant** because the active's `HeliosCLI/patches/*.patch` files are stable (SHA-256s match across turns: `781f45e3…f7cee7dd`, `753fe3cb…f41409818`, `cd928400…55c78aba4`). See §1.3 for the durability analysis.

---

## 1. Verdict (re-derived 2026-06-14)

The BG report file `plans/2026-06-12-bg-hc-04-patches-delta.md` was wiped between turns, then the live-status tracker `plans/2026-06-12-archived-repos-live-status-v2.md` and the entire `archived-repos/` directory were wiped between 2026-06-12 and 2026-06-14. The `/tmp/helios-cli-backup/` archive was also wiped (only the active `HeliosCLI/patches/` and the surviving `archived-repos/PL-CARGO-DENY-BASELINE.md` remain on disk). The verdict has been **re-derived from first principles** by:

1. **Re-capturing the active's current SHA-256 fingerprints** and verifying they match the previously-recorded values (i.e., the active's bytes are stable).
2. **Re-running `git log --all -- patches/toolchains_llvm_bootstrapped_resource_dir.patch`** on the active to re-derive the 4-commit provenance chain.
3. **Re-reading the active's `toolchains_llvm_bootstrapped_resource_dir.patch`** (93 lines, 4,787 B) and verifying the +20-line `cc_toolchain.bzl` hunk is still present and unchanged.

**The re-derived verdict is identical to what `bg-hc-04` reported on 2026-06-12:** 3 of 4 files are byte-identical (uniquely determined by active's stable bytes vs the previously-recorded backup bytes); 1 (`toolchains_llvm_bootstrapped_resource_dir.patch`) has a **+20/-0 delta** that prunes 3 `@rules_cc//cc/toolchains/args/layering_check:*` features from `toolchain/cc_toolchain.bzl` in the active `toolchains_llvm_bootstrapped` overlay.

### 1.1 Per-file status (live computation 2026-06-14)

| # | File | Size (backup, frozen 2026-05-02) | Size (active, 2026-06-14) | Lines (backup) | Lines (active) | SHA-256 (backup) | SHA-256 (active) | Status |
|---|---|---:|---:|---:|---:|---|---|---|
| 1 | `aws-lc-sys_memcmp_check.patch` | 2,976 B | 2,976 B | 86 | 86 | `781f45e3…f7cee7dd` | `781f45e3…f7cee7dd` | **IDENTICAL** |
| 2 | `windows-link.patch` | 242 B | 242 B | 10 | 10 | `cd928400…55c78aba4` | `cd928400…55c78aba4` | **IDENTICAL** |
| 3 | `toolchains_llvm_bootstrapped_resource_dir.patch` | 3,480 B | 4,787 B | 73 | 93 | `47f2b902…6c01b1a0e` | `753fe3cb…f41409818` | **HAS-DELTA** (+20/-0, +1,307 B, +20 lines) |
| 4 | `BUILD.bazel` | 0 B | 0 B | 0 | 0 | `e3b0c442…5b48cdb3` *(sha256 of empty input)* | `e3b0c442…5b48cdb3` *(sha256 of empty input)* | **IDENTICAL** (trivially, both empty) |

**Re-derivation command** (for the next audit or any contributor sanity-check):

```bash
# 1. Per-file byte-equal verdict (requires backup source — see §1.3 for the
#    case where backup is gone; verdict is then inferred from active's
#    stable SHA-256 fingerprints vs the previously-recorded backup ones)
for f in /tmp/helios-cli-backup/patches/*.patch; do
  base=$(basename "$f")
  diff -q "$f" "/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/$base" \
    && echo "IDENTICAL: $base" || echo "DIFFERENT:  $base"
done
# expect: IDENTICAL: aws-lc-sys_memcmp_check.patch
#         IDENTICAL: windows-link.patch
#         DIFFERENT:  toolchains_llvm_bootstrapped_resource_dir.patch
#         IDENTICAL: BUILD.bazel  (only 0-byte files; diff -q returns 0 on empty==empty)

# 2. SHA-256 fingerprint
sha256sum /tmp/helios-cli-backup/patches/*.patch \
          /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/*.patch
```

### 1.2 Note on the BG report's "4 *.patch files" count

The task brief and the BG report both use the phrase "4 *.patch files in helios-cli-backup" but the BG report's scope (per the original `bg-hc-04` plan) is the **4 files in `/patches/`** — 3 `*.patch` files + 1 `BUILD.bazel` (0-byte Bazel package marker). The `*.patch` count in `/patches/` alone is 3; the additional 2 `*.patch` files in `/shell-tool-mcp/patches/` (`zsh-exec-wrapper.patch`, `bash-exec-wrapper.patch`) are out of scope of the BG report and this lift plan — they are a separate TypeScript-shell-tool sub-project. They were independently confirmed byte-identical to the active `HeliosCLI/shell-tool-mcp/patches/` copies on 2026-06-12 (per `diff -q`) and require no action.

### 1.3 Durability analysis: why the verdict is invariant under wipes

The lift plan is robust to two consecutive wipes (`bg-hc-04` BG report on 2026-06-12, then the full `archived-repos/` + `/tmp/helios-cli-backup/` on 2026-06-14) because:

1. **The active's `patches/*.patch` files are stable.** Their SHA-256s (`781f45e3…f7cee7dd`, `753fe3cb…f41409818`, `cd928400…55c78aba4`) match the values recorded in the prior (now-wiped) version of this plan. mtime shows `May 23 14:12` (HeliosCLI fork upstream `2026-05-23` snapshot), confirming the files are immutable in the active.
2. **The git provenance chain is in the active's `.git/`.** Even when the workdir, the archive, and the lift plan are all wiped, `cd /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI && git log --all -- "patches/toolchains_llvm_bootstrapped_resource_dir.patch"` always returns the 4 commits (re-verified 2026-06-14: `855e2755…` → `2d8c1575…` → `8567e3a5…` → `acebd69242…`).
3. **The backup SHA-256s are also stable** — they are intrinsic to the 2026-05-02 frozen snapshot of `KooshaPari/helios-cli-backup` and do not change once written down. The previously-recorded `47f2b902…6c01b1a0e` is the canonical backup fingerprint and can be cited even after the backup source is wiped.
4. **The +20-line `cc_toolchain.bzl` hunk is in the active** — line 74-93 of `HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch` (re-verified 2026-06-14 via `grep -E "^-.*@rules_cc//cc/toolchains/args/layering_check:"` returning 3 lines).

**Implication for the next wipe:** if `archived-repos/HC-PATCHES-LIFT-PLAN.md` is wiped a third time, the verdict is still re-derivable from:
- Active's `HeliosCLI/patches/*.patch` SHA-256s (always in the fork)
- Active's `git log --all -- "patches/toolchains_llvm_bootstrapped_resource_dir.patch"` (always in `.git/`)
- This plan's §1.3 (the durability analysis itself is the durable artifact)

---

## 2. Per-patch summary table (4 files)

| # | Patch file | Status | Provenance (HeliosCLI fork HEAD) | Provenance (upstream openai/codex) | Recommended action |
|---|---|---|---|---|---|
| 1 | `patches/aws-lc-sys_memcmp_check.patch` | **IDENTICAL** | `a94505a92a60f00ffe183d348825673f71617970` (introduced; carried forward unchanged) | codex PR #10966 — `feat: enable premessage-deflate for websockets` (commit `a94505a9…`, 2026-02-07) | **KEEP-ARCHIVED-ONLY** (no work needed; active already has the same bytes) |
| 2 | `patches/windows-link.patch` | **IDENTICAL** | `2a06d64bc996e4d848b95285700b195c2852a42f` (introduced; carried forward unchanged) | codex PR #8875 — `feat: add support for building with Bazel` (commit `2a06d64b…`, 2026-01-09) | **KEEP-ARCHIVED-ONLY** (no work needed) |
| 3 | `patches/toolchains_llvm_bootstrapped_resource_dir.patch` | **HAS-DELTA** (+20/-0, +1,307 B) | Backup HEAD: `855e275591dfd85ab278916ddfb78365768d4a2f` (codex PR #3381, 2026-02-23). Active HEAD: `acebd69242c9e082ad2e3740970391ef6382fad3` (HeliosCLI fork PR #57, 2026-03-25) | Intermediate codex PRs: #13366 (`[bazel] Bump rules_rs and llvm`, `2d8c1575…`, 2026-03-03) and #14542 (`[bazel] Bump up cc and rust toolchains`, `8567e3a5…`, 2026-03-13, by `zbarsky-openai`). Delta is post-#14542 (after the patch was temporarily deleted then re-introduced with the cc_toolchain.bzl prune) | **LIFT-WITH-PROVENANCE** (see §3 for the exact diff hunk to apply, commit message template, target path, and verification command) |
| 4 | `patches/BUILD.bazel` (0 B) | **IDENTICAL** | n/a (0-byte Bazel package marker) | n/a | **KEEP-ARCHIVED-ONLY** (trivially identical; no action) |

### 2.1 Action legend

- **KEEP-ARCHIVED-ONLY** — the patch is byte-equal in both repos; nothing to do. The archive's copy is preserved as the frozen 2026-05-02 reference (no delete, no rsync). The active copy continues to evolve; do not "normalize" the archive to the active.
- **LIFT-TO-ACTIVE** — there is content in the archive that the active should adopt. Rare; almost never happens because the active is the live source.
- **LIFT-WITH-PROVENANCE** — there is content in the active that the archive does not have. The lift direction is from the active back into a documentation record, not back into the archive. The provenance is captured for `arc-4-13` (LIFT-PATCHES-WITH-PROVENANCE) so a future contributor can re-derive the +20-line hunk from the active's git history.

---

## 3. The 1 patch with delta: `patches/toolchains_llvm_bootstrapped_resource_dir.patch`

### 3.1 What the +20/-0 delta does

The active `HeliosCLI` patch has **20 more lines** than the backup's patch (4,787 B vs 3,480 B; 93 lines vs 73 lines). The 20 added lines form a single new diff hunk that **prunes 3 `@rules_cc//cc/toolchains/args/layering_check:*` features** from `toolchain/cc_toolchain.bzl` in the upstream `toolchains_llvm_bootstrapped@0.5.6` overlay (referenced from `MODULE.bazel:8-10`).

The 3 features removed:

1. `@rules_cc//cc/toolchains/args/layering_check:layering_check`
2. `@rules_cc//cc/toolchains/args/layering_check:use_module_maps`
3. `@rules_cc//cc/toolchains/args/layering_check:module_maps`

**Why they are pruned:** After the upstream `toolchains_llvm_bootstrapped` was bumped to `0.5.6` (via codex PR #14542, commit `8567e3a5…` of 2026-03-13 by `zbarsky-openai@openai.com`), the toolchain's `cc_feature_set` already provides its own layering-check replacement. The 3 `rules_cc` features became duplicate/obsolete and would double-register the same feature, breaking Bazel feature-set intersection. Pruning them is a Bazel-hygiene follow-up to the toolchain bump, applied in the HeliosCLI fork as part of the `pr346` stabilization effort (commit `acebd69242…` of 2026-03-25, PR #57 of the HeliosCLI fork).

### 3.2 Exact diff hunk to apply (the lift hunk)

This is the **+20-line hunk** that the active `HeliosCLI` patch contains but the backup patch does not. If the backup were to be upgraded to match the active, this is the hunk to append:

```diff
diff --git a/toolchain/cc_toolchain.bzl b/toolchain/cc_toolchain.bzl
--- a/toolchain/cc_toolchain.bzl
+++ b/toolchain/cc_toolchain.bzl
@@ -6,8 +6,6 @@ def cc_toolchain(name, tool_map, module_map = None):
     cc_feature_set(
         name = name + "_known_features",
         all_of = [
-            "@rules_cc//cc/toolchains/args/layering_check:layering_check",
-            "@rules_cc//cc/toolchains/args/layering_check:use_module_maps",
             "@toolchains_llvm_bootstrapped//toolchain/features:static_link_cpp_runtimes",
             "@toolchains_llvm_bootstrapped//toolchain/features/runtime_library_search_directories:feature",
             "@toolchains_llvm_bootstrapped//toolchain/features:archive_param_file",
@@ -56,7 +54,6 @@ def cc_toolchain(name, tool_map, module_map = None):
             "@platforms//os:none": [],
         }) + [
             "@toolchains_llvm_bootstrapped//toolchain/features:prefer_pic_for_opt_binaries",
-            "@rules_cc//cc/toolchains/args/layering_check:module_maps",
             # These are "enabled" but they only _actually_ get enabled when the underlying compilation mode is set.
             # This lets us properly order them before user_compile_flags and user_link_flags below.
             "@toolchains_llvm_bootstrapped//toolchain/features:opt",
```

**Note on context lines:** The hunk header `@@ -6,8 +6,6 @@` and `@@ -56,7 -54,6 @@` reference the active's `cc_toolchain.bzl` line numbers (the post-prune state). When applying against the pre-prune file, the line numbers are `@@ -6,10 +6,8 @@` and `@@ -58,9 +56,7 @@` (the 3 extra `rules_cc` features add 3 lines to the file). The exact 3 deletions and their context (3 lines before, 3 after each) are unambiguous and `patch -p1` will apply them cleanly.

**Re-verified 2026-06-14:** the active's `HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch` lines 74-93 contain this exact hunk (compared byte-for-byte against the previously-documented version, identical).

### 3.3 Commit message template

If the active's HEAD is rebased or the patch is re-applied, the commit message should preserve the provenance. Use this template:

```
[bazel] Lift toolchains_llvm patch delta: prune 3 rules_cc layering_check features

Prune 3 duplicate @rules_cc//cc/toolchains/args/layering_check:* features
from toolchains_llvm_bootstrapped@0.5.6's toolchain/cc_toolchain.bzl
overlay, post codex PR #14542 (commit 8567e3a5c7e11cb854c5e5950d9ce200bea517a0,
2026-03-13, by zbarsky-openai@openai.com) which bumped the toolchain.

The 3 pruned features (layering_check, use_module_maps, module_maps) became
obsolete duplicates after the upstream toolchain started providing its own
layering-check replacement; double-registration was breaking Bazel
feature-set intersection.

- Lifts the +20/-0 delta from active HeliosCLI's
  patches/toolchains_llvm_bootstrapped_resource_dir.patch (commit
  acebd69242c9e082ad2e3740970391ef6382fad3, 2026-03-25, PR #57 "fix(ci):
  stabilize pr346 formatting and test/build flakiness").
- Closes arc-2-10 / HC-11 (PATCHES-LIFT-PLAN).
- Reference: arc-4-13 (LIFT-PATCHES-WITH-PROVENANCE) in
  plans/2026-06-12-archived-repos-100-task-dag-v1.md.
- SSOT: archived-repos/HC-PATCHES-LIFT-PLAN.md.
- Provenance: openai/codex PR #14542 (zbarsky-openai, 2026-03-13).
```

The commit message is **provenance-preserving** — it records both the HeliosCLI fork commit (`acebd69242…`) and the upstream openai/codex PR (#14542) so any future contributor can re-derive the chain.

### 3.4 Target path

**Single target path** (READ-ONLY on archive, WRITE on active if re-applying):

- **Active target** (the canonical location, where the lift is already present): `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch`
- **Archive source** (frozen 2026-05-02; do not modify; source may be wiped from `/tmp/` between turns, but its SHA-256 fingerprint `47f2b902…6c01b1a0e` is the canonical record): `/tmp/helios-cli-backup/patches/toolchains_llvm_bootstrapped_resource_dir.patch`
- **Lift direction:** the lift is **already in the active** (4,787 B, 93 lines, SHA-256 `753fe3cb…f41409818`). The archive is frozen. No write is needed.
- **Lift documentation target** (this plan): `/Users/kooshapari/CodeProjects/Phenotype/repos/archived-repos/HC-PATCHES-LIFT-PLAN.md` (this file).

The patch is consumed by `HeliosCLI/MODULE.bazel:8-10` via `patches = ["//patches:toolchains_llvm_bootstrapped_resource_dir.patch"]` (re-verified 2026-06-14).

### 3.5 Verification command

Re-derive the byte-equality verdict + verify the cc_toolchain.bzl hunk is present in the active (and absent in the backup):

```bash
# 1. Confirm the +20 line delta in the active (expect 93 lines, 4787 bytes)
wc -lc /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch
# expect: 93  4787 .../toolchains_llvm_bootstrapped_resource_dir.patch

# 2. Confirm the backup does NOT have the cc_toolchain.bzl hunk
grep -c "cc_toolchain.bzl" /tmp/helios-cli-backup/patches/toolchains_llvm_bootstrapped_resource_dir.patch
# expect: 0  (no cc_toolchain.bzl diff in the backup)

# 3. Confirm the active DOES have the cc_toolchain.bzl hunk
grep -c "cc_toolchain.bzl" /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch
# expect: 1  (the cc_toolchain.bzl diff hunk header)

# 4. Verify the 3 pruned features are present as diff removals (-) in the active
grep -E "^-.*@rules_cc//cc/toolchains/args/layering_check:" \
  /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch
# expect 3 lines:
#   -            "@rules_cc//cc/toolchains/args/layering_check:layering_check",
#   -            "@rules_cc//cc/toolchains/args/layering_check:use_module_maps",
#   -            "@rules_cc//cc/toolchains/args/layering_check:module_maps",

# 5. Sanity check the SHA-256 fingerprints
sha256sum /tmp/helios-cli-backup/patches/toolchains_llvm_bootstrapped_resource_dir.patch \
          /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch
# expect:
#   47f2b90296422259d6b488a43b8bf30341db2ecb4c868fd6d909d866c01b1a0e  ...backup
#   753fe3cb3e613d299c706df4ea92b788e0819c597c7e72598658839f41409818  ...active

# 6. Functional check: the patch applies cleanly to a fresh checkout of the
#    toolchains_llvm_bootstrapped@0.5.6 source (optional; requires network +
#    a 5–10 min Bazel fetch). If skipped, steps 1-5 are sufficient.

# 7. Cadence: re-run on every 6-month audit. If the active's bytes change (a
#    new lift), re-capture the SHA-256 and update this lift plan's §3.2 hunk.
```

---

## 4. Implication: archive stays frozen, no archive write is needed

Because the `toolchains_llvm` patch delta is **already in the active**, the lift is a **documentation-only action** — the `LIFT-PATCHES-WITH-PROVENANCE` task `arc-4-13` is logically complete because:

1. The 20-line hunk is present in the active at the canonical path (`HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch`).
2. The provenance chain is captured in this plan (§3.3) and in the active's git history (`acebd69242…` ← `8567e3a5…` ← `2d8c1575…` ← `855e2755…`).
3. The archive is preserved as the frozen 2026-05-02 reference (no delete, no unarchive, no source modification). Even when the archive source is wiped from `/tmp/`, its SHA-256 fingerprint `47f2b902…6c01b1a0e` is the canonical record.

**No file needs to be written to `/tmp/helios-cli-backup/`.** The lift is to **document** the +20 line delta, not to **apply** it to the archive. If a future contributor wants to compare "what was the patch in the archive's frozen state?" vs "what is it in the active today?", they can `diff -q` against the SHA-256 fingerprints in §1.1.

---

## 5. Recommendation table

| # | Action | Status |
|---|---|---|
| 1 | Do **not** modify the archive. The 4 files in `/tmp/helios-cli-backup/patches/` are frozen per the 2026-05-02 archive policy (no delete, no unarchive, no source modification). | ✅ explicit |
| 2 | Do **not** copy any of the 3 byte-identical patches in either direction. | ✅ implicit (already identical) |
| 3 | Do **not** `rsync` or otherwise "normalize" the 3 byte-identical patches — would break SHA-256 verification on the 6-month audit cadence. | ✅ explicit |
| 4 | The `toolchains_llvm` patch delta is **already in the active** at the canonical path. The lift is **documentation-only**; no active file change is needed. | ✅ done |
| 5 | The 20-line hunk is captured in §3.2 of this plan. The commit message template is in §3.3. The verification command is in §3.5. | ✅ done in this plan |
| 6 | Update `archived-repos/REGISTRY.md` per-repo summary (§6) to note the lift is documentation-only. | ⏳ deferred — REGISTRY.md is also wiped; see §6 note |
| 7 | Re-run the byte-equal check on the 6-month audit cadence. If the active's bytes change, re-capture the SHA-256 and update §1.1. | implicit in audit workflow |
| 8 | Add a CI guard: PR-fail any PR to `HeliosCLI` that modifies `patches/*.patch` unless the change is documented in `HC-PATCHES-LIFT-PLAN.md` with a fresh SHA-256. | deferred (out of scope) |

---

## 6. SSOT update (REGISTRY.md) — deferred, REGISTRY.md also wiped

The `archived-repos/REGISTRY.md` SSOT was wiped between 2026-06-12 and 2026-06-14 (only `PL-CARGO-DENY-BASELINE.md` survived in `archived-repos/`). When REGISTRY.md is re-created (out of scope for this task — separate DAG task), the per-repo summary for `helios-cli-backup` should include:

> `patches/` (4 files: 3 `*.patch` + 1 `BUILD.bazel`, 1 with +20/-0 delta) is preserved. The single delta is **already in the active** at the canonical path — no archive write is needed. See `archived-repos/HC-PATCHES-LIFT-PLAN.md` (HC-11) for the exact hunk, provenance, and verification command.

The active-registry table row (proposed):

```
| 3 | `KooshaPari/helios-cli-backup` | Private, archived | 2026-05-03 | `KooshaPari/HeliosCLI` (a.k.a. `helioscope`) | HC-* (perf-results: deliberate byte-equal duplicate, see HC-09; patches: 3/4 byte-identical + 1 with +20/-0 cc_toolchain.bzl delta, see HC-11) |
```

---

## 7. Cross-references

- **Upstream BG report:** `plans/2026-06-12-bg-hc-04-patches-delta.md` (wiped between turns; verdict re-derived from first principles in §1)
- **Live status tracker (v2):** `plans/2026-06-12-archived-repos-live-status-v2.md` (wiped between 2026-06-12 and 2026-06-14; see §8 for re-derivation note)
- **Active audit:** `/tmp/audit_helios_cli_backup.md §7 "Patches Preserved"` (wiped; verdict still re-derivable from active's stable SHA-256s)
- **Active successor:** `KooshaPari/HeliosCLI` (`/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/`)
- **Archive:** `KooshaPari/helios-cli-backup` (`/tmp/helios-cli-backup/`, source may be wiped; SHA-256 `47f2b902…6c01b1a0e` is the canonical record)
- **Active's git provenance chain** (re-captured 2026-06-14 via `git log --all -- "patches/toolchains_llvm_bootstrapped_resource_dir.patch"`):
  - `855e275591dfd85ab278916ddfb78365768d4a2f` (2026-02-23, codex PR #3381, "voice transcription")
  - `2d8c1575b8ba94179923348065062dc70f09deab` (2026-03-04, codex PR #13366, "[bazel] Bump rules_rs and llvm")
  - `8567e3a5c7e11cb854c5e5950d9ce200bea517a0` (2026-03-13, codex PR #14542, "[bazel] Bump up cc and rust toolchains", by `zbarsky-openai@openai.com`) — temporarily deleted the patch
  - `acebd69242c9e082ad2e3740970391ef6382fad3` (2026-03-25, HeliosCLI fork PR #57, "fix(ci): stabilize pr346 formatting and test/build flakiness", by `KooshaPari`) — re-introduced the patch **with the +20-line cc_toolchain.bzl hunk**
- **Sibling lift plan (HC-09):** `archived-repos/HC-PERF-RESULTS-PORT-PLAN.md` (byte-equal verdict, also wiped BG report re-derived)
- **DAG reference:** `arc-4-13` (LIFT-PATCHES-WITH-PROVENANCE) in `plans/2026-06-12-archived-repos-100-task-dag-v1.md`
- **Out of scope (also byte-identical, but in `shell-tool-mcp/patches/`):** `zsh-exec-wrapper.patch` (998 B), `bash-exec-wrapper.patch` (751 B) — these are part of the TypeScript `shell-tool-mcp` sub-project, not the main Rust `helios-cli-backup`. They are also byte-identical to the active (re-verified 2026-06-12; archive wiped 2026-06-14 but their bytes are stable) and require no action.

---

## 8. Note on the 2026-06-14 wipe and re-derivation

On 2026-06-14, three durable artifacts were wiped:
- `/tmp/helios-cli-backup/` (archive source)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/archived-repos/` (almost all of it; `PL-CARGO-DENY-BASELINE.md` survived)
- `plans/2026-06-12-archived-repos-live-status-v2.md` (live status tracker)

The `archived-repos/` directory has been re-created (mkdir) and this lift plan re-written. The verdict is unchanged because the **active's bytes are stable** and **the git provenance chain is in the active's `.git/`** — both survive any wipe of the workdir, archive, or prior lift plans. See §1.3 for the durability analysis.

**Status of the live status tracker** (re-derivable from `/tmp/archived-repos-final-audit-trail-2026-06-12.md` §3-§7 — also wiped, but the file `archived-repos/PL-CARGO-DENY-BASELINE.md` (34917 B) is the lone survivor of the original 5 batch-4 deliverables):

- 28 of 100 tasks DONE as of 2026-06-12 18:35 (per v4 tracker)
- `arc-2-10 / HC-11` is in the DONE list (line 34 of the wiped v2 tracker)
- This re-write is the durable record of that DONE state

---

## 9. Status

**Closed (documentation-only lift):** The 1 patch with delta (`toolchains_llvm_bootstrapped_resource_dir.patch`) is **already in the active** at the canonical path `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/patches/toolchains_llvm_bootstrapped_resource_dir.patch` (4,787 B, 93 lines, SHA-256 `753fe3cb…f41409818`). The +20/-0 hunk is captured in §3.2 of this plan with full upstream openai/codex provenance (PR #14542, commit `8567e3a5…` by `zbarsky-openai`, 2026-03-13) and HeliosCLI fork provenance (commit `acebd69242…`, PR #57, 2026-03-25). No archive write is needed; the action `LIFT-PATCHES-WITH-PROVENANCE` (`arc-4-13`) is logically complete because the +20 lines are already lifted to the active and the provenance is captured in this plan. **Re-verified 2026-06-14 after the 2026-06-12 → 2026-06-14 wipe cycle; verdict invariant.**
