# deny.toml divergence audit - 2026-06-10

Scope: shallow top-level focus repositories under `/Users/kooshapari/CodeProjects/Phenotype/repos`.

Commands used for evidence collection:

```bash
find . -maxdepth 1 -type d -print
cat AuthKit/deny.toml FocalPoint/deny.toml
diff -u AuthKit/deny.toml FocalPoint/deny.toml
```

## Baseline

`AuthKit/deny.toml` is the conservative baseline found in the auth-focused repos. No top-level `Authvault/deny.toml` was present in the shallow focus-repo scan.

Baseline allowed licenses:

```text
MIT
Apache-2.0
Apache-2.0 WITH LLVM-exception
BSD-2-Clause
BSD-3-Clause
ISC
Zlib
MPL-2.0
0BSD
CC0-1.0
Unicode-DFS-2016
Unicode-3.0
```

## Primary divergence: FocalPoint / Authvault-style additions

`FocalPoint/deny.toml` diverges from `AuthKit/deny.toml` and contains the specifically flagged additions:

- ADDED: `GPL-3.0-only`
- ADDED: `CC-BY-SA-4.0`
- ADDED: `BSD-3-Clause-Clear`
- ADDED: `BlueOak-1.0.0`
- ADDED: `CDLA-Permissive-2.0`
- ADDED: `Unlicense`
- ADDED: `WTFPL`
- REMOVED: `confidence-threshold = 0.8`
- REMOVED: `db-urls = ["https://github.com/rustsec/advisory-db"]`
- REMOVED: `yanked = "warn"`
- CHANGED: `wildcards = "warn"` -> `wildcards = "deny"`
- CHANGED: `unknown-git = "warn"` -> `unknown-git = "deny"`
- ADDED: four advisory ignores: `RUSTSEC-2024-0388`, `RUSTSEC-2024-0436`, `RUSTSEC-2025-0057`, `RUSTSEC-2025-0141`

Exact diff:

```diff
--- AuthKit/deny.toml
+++ FocalPoint/deny.toml
@@ -1,35 +1,41 @@
-# cargo-deny configuration
-# Conservative defaults: warn on most, deny only known-bad.
-# CI integration is intentionally NOT enabled in this commit.
-
 [advisories]
 db-path = "$CARGO_HOME/advisory-db"
-db-urls = ["https://github.com/rustsec/advisory-db"]
-yanked = "warn"
+ignore = [
+    { id = "RUSTSEC-2024-0388", reason = "unmaintained - no safe upgrade" },
+    { id = "RUSTSEC-2024-0436", reason = "unmaintained - no safe upgrade" },
+    { id = "RUSTSEC-2025-0057", reason = "unmaintained - no safe upgrade" },
+    { id = "RUSTSEC-2025-0141", reason = "unmaintained - no safe upgrade" },
+]
 
 [licenses]
+version = 2
 allow = [
-    "MIT",
     "Apache-2.0",
     "Apache-2.0 WITH LLVM-exception",
     "BSD-2-Clause",
     "BSD-3-Clause",
+    "BSD-3-Clause-Clear",
+    "CC0-1.0",
+    "CC-BY-SA-4.0",
+    "GPL-3.0-only",
     "ISC",
-    "Zlib",
+    "MIT",
     "MPL-2.0",
-    "0BSD",
-    "CC0-1.0",
-    "Unicode-DFS-2016",
     "Unicode-3.0",
+    "Unicode-DFS-2016",
+    "Zlib",
+    "0BSD",
+    "BlueOak-1.0.0",
+    "CDLA-Permissive-2.0",
+    "Unlicense",
+    "WTFPL"
 ]
-confidence-threshold = 0.8
 
 [bans]
 multiple-versions = "warn"
-wildcards = "warn"
-highlight = "all"
+wildcards = "deny"
 
 [sources]
+unknown-git = "deny"
 unknown-registry = "warn"
-unknown-git = "warn"
 allow-registry = ["https://github.com/rust-lang/crates.io-index"]
```

## Repos with flagged license additions

These top-level focus repos have at least one of `GPL-3.0-only`, `CC-BY-SA-4.0`, or `BSD-3-Clause-Clear` in `deny.toml`.

| Repo | deny.toml present | Flagged additions |
|---|---:|---|
| AgilePlus | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| AgilePlus-2nd | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Apisync | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| BytePort | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| FocalPoint | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| forgecode | yes | GPL-3.0-only; also GPL-3.0-or-later |
| HeliosCLI | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| helioscope | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| HeliosLab | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| HeliosLab-3rd | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| HeliosLab-4th | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| HeliosLab-5th | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| HeliosLab-hygiene2 | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| HexaKit | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| hwLedger | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| hwLedger-2nd | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| hwLedger-3rd | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| kmobile | yes | GPL-3.0-only, BSD-3-Clause-Clear; also AGPL-3.0-only, GPL-2.0-only, LGPL variants |
| ObservabilityKit | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| pheno | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| phenoAI | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| PhenoDevOps | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| PhenoPlugins | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| PhenoPlugins-1st | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| phenoShared | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| phenotype-infra | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| phenotype-journeys-3rd | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| phenotype-voxel | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| phenoUtils | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Pyron | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Sidekick | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Sidekick-4th | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Sidekick-5th | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Sidekick-6th | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Sidekick-7th | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Tasken | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Tasken-3rd | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Tasken-5th | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |
| Tokn | yes | GPL-3.0-only, CC-BY-SA-4.0, BSD-3-Clause-Clear |

## Per focus-repo divergence notes

- `AuthKit/deny.toml`: baseline; no flagged GPL/CC/BSD-Clear additions.
- `FocalPoint/deny.toml`: diverged; exact diff above. This is the concrete file matching the requested Authvault-style focus.
- `AgilePlus`, `AgilePlus-2nd`, `Apisync`, `BytePort`, `HeliosCLI`, `helioscope`, `HeliosLab*`, `HexaKit`, `hwLedger*`, `ObservabilityKit`, `pheno`, `phenoAI`, `PhenoDevOps`, `PhenoPlugins*`, `phenoShared`, `phenotype-infra`, `phenotype-journeys-3rd`, `phenotype-voxel`, `phenoUtils`, `Pyron`, `Sidekick*`, `Tasken*`, and `Tokn`: diverged from the AuthKit baseline by adding the flagged broad-license set. Their full-file diffs are not byte-identical to `FocalPoint/deny.toml`, but the license-risk additions are the same.
- `forgecode/deny.toml`: diverged; includes `GPL-3.0-only` and `GPL-3.0-or-later`, but not the same full flagged triple as `FocalPoint`.
- `kmobile/deny.toml`: diverged most broadly; includes `GPL-3.0-only` and `BSD-3-Clause-Clear` plus additional strong-copyleft/copyleft-family licenses: `AGPL-3.0-only`, `GPL-2.0-only`, `LGPL-2.1`, `LGPL-2.1-only`, and `LGPL-3.0-only`.

## Audit conclusion

The compliance-significant divergence is the addition of `GPL-3.0-only`, `CC-BY-SA-4.0`, and `BSD-3-Clause-Clear` to multiple focus-repo `deny.toml` files, with `FocalPoint/deny.toml` as the exact inspected instance. If these were intended to match the conservative `AuthKit` baseline, the flagged additions should be removed rather than normalized across the fleet.
