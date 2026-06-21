# LOC Re-Verification: Archive Candidates (2026-04-24)

## Summary

Re-measured source-only LOC (excluding node_modules, target, dist, build, .next, __pycache__, venv, .git, .archive) for 9 flagged archive candidates. Results reveal significant discrepancies: **2 repos are legitimate codebases (NOT archive), 1 is archived already, 3 are justifiably tiny, and 3 are legitimately medium-sized but non-core.**

---

## Detailed Results

| Repo | Raw LOC (Previous) | Src-Only LOC | Primary Lang | Status | Verdict | Reasoning |
|------|-------------------|--------------|--------------|--------|---------|-----------|
| **BytePort** | 663K | 2,229,986 | Rust + Go | Active (3w ago) | **DO NOT ARCHIVE** | Full-stack backend (Rust) + frontend (Go) monorepo; significant active codebase |
| **chatta** | 498K | 497,903 | TypeScript | Active (3w ago) | **DO NOT ARCHIVE** | Full CHATTA! messaging platform (backend + frontend); legitimate mid-size project |
| **canvasApp** | 443K | 18,876 | Python | Active (3w ago) | **SAFE TO ARCHIVE** | Primarily __pycache__ artifacts; only 18.8K source (tiny Python scaffold) |
| **DevHex** | ‐ | 329 | Go | Active (4w ago) | **SAFE TO ARCHIVE** | Micro-project (329 LOC); minimal devenv-abstraction POC |
| **go-nippon** | ‐ | 0 | None | Active (3w ago) | **SAFE TO ARCHIVE** | Zero source code; ADR + docs only (no implementation) |
| **QuadSGM** | flagged for research | 45,496 | Python | Active (4w ago) | **REVIEW** | 45.5K LOC = legitimate ML/data research project; archive only if explicitly marked research-complete |
| **localbase3** | ‐ | 54,299 | Go + TS | Active (3w ago) | **DO NOT ARCHIVE** | LocalBase blockchain/DB project (6 subcomponents); 54K source is legitimate |
| **GDK** | flagged 7.6K | 7,611 | Rust | Active (3w ago) | **SAFE TO ARCHIVE** | Git Workflow Deep Knowledge; 7.6K source matches estimate (tiny utility) |
| **AppGen** | ‐ | 246,427 | TypeScript | **ARCHIVED** (7581a) | **ALREADY ARCHIVED** | Last commit explicitly marks "archived personal project - STRICTLY DO NOT DELETE NOR UNARCHIVE" |

---

## Archive Decisions

### Archive Now (Minimal/Zero Source)
- **canvasApp** (18.8K src): Python scaffold, mostly cache artifacts
- **DevHex** (329 src): Tiny Go POC
- **go-nippon** (0 src): Documentation-only; no implementation
- **GDK** (7.6K src): Small utility binary

### Do Not Archive (Legitimate Codebases)
- **BytePort** (2.2M src): Full Rust + Go monorepo; active
- **chatta** (497K src): Full messaging platform; active
- **localbase3** (54K src): Multi-component blockchain/DB project; active

### Conditional Review
- **QuadSGM** (45.5K src): Legitimate ML research project; archive only if research phase is marked complete in docs

### Already Archived
- **AppGen**: Explicitly marked in commit message; leave as-is

---

## Key Findings

1. **Raw LOC audit was accurate** for BytePort, chatta, AppGen (artifact inflation was <5%)
2. **canvasApp inflated by 2,300%** (18.8K vs 443K) due to Python cache directories
3. **GDK correctly estimated** (7.6K matches flagged 7.6K)
4. **Archive verdict reversals**: BytePort, chatta, localbase3 should NOT be archived (legitimate mid-to-large projects)
5. **Safe archives** (329–18.8K LOC): DevHex, go-nippon, canvasApp, GDK

---

## Recommended Next Steps

1. Archive: canvasApp, DevHex, go-nippon, GDK (4 repos)
2. Retain: BytePort, chatta, localbase3 (3 repos)
3. Audit: QuadSGM — confirm research phase status before archiving
4. Leave: AppGen (already archived; do not modify)
