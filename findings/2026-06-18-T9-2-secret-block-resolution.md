# T9.2 secret-block resolution

**Status:** RESOLVED 2026-06-19
**Branch:** chore/w5-adrs-sota-2026-06-15-v2
**Resolution commit:** db801bb7ef

## Options considered
1. Unblock URL via ADR-027 Tier 2 (lfs.allowincompletepush=true + --recurse-submodules=no + --no-verify)
2. Submodule rewrite to non-default-key SHA (selected)
3. Re-bump submodule pointer + amend (selected, combined with #2)
4. Skip — preserve locally only

## Selected path
Options 2 + 3 combined: submodule rewrite + amend. The branch was BLOCKED by GitHub
secret scanning false positive on phenotype-python-sdk default-key derivation example.
Resolution: bump submodule to clean SHA in same repo without trigger pattern.
Verified via git show --stat db801bb7ef.
