# audit-tool Boundary (absorbed)

## Status

**Absorbed 2026-07-17** into `phenotype-registry/scripts/audit.py`.
Source repo `KooshaPari/audit-tool` archived.

## Boundary

The audit-tool provides:

1. **30-pillar repo-quality scorecard** (L1-L30):
   - L1 Architecture, L2 Dev Loop, L3 Agent Loop
   - L4 Observability, L5 Security, L6 Performance
   - L7 Extensibility, L8 Compliance, L9 Complexity
   - L10 Type Safety, L11 Dependencies, L12 Error Handling
   - L13 Logging, L14 Data Layer, L15 API Surface
   - L16 Frontend, L17 I18n/A11y, L18 Concurrency
   - L19 Memory, L20 Config, L21 Testing Depth
   - L22 Fuzzing, L23 Release, L24 Migration
   - L25 Vendor Lockin, L26 Event Driven, L27 Infrastructure
   - L28 Cost Efficiency, L29 Monitoring, L30 Onboarding

2. **Real-measurement** approach: each pillar scores the actual repo
   state (file presence, structure, content) — not self-reported
   metadata

3. **Kind-aware** (rust vs go, with extensions for python/shell)

## Output schema

```json
{
  "repo": "string",
  "kind": "rust | go | ...",
  "overall": "float (mean of 30 pillars)",
  "grade": "A+ | A | B+ | B | C+ | C | D | F",
  "scores": { "L1 Architecture": int, ..., "L30 Onboarding": int },
  "_meta": {
    "last_updated": "ISO 8601 UTC",
    "method": "real measurement (v2 with broader signal coverage)",
    "audit_script": "audit.py v2"
  }
}
```

## Replacement

| Old | New |
|-----|-----|
| `KooshaPari/audit-tool` | (archived) |
| Standalone audit.py | `phenotype-registry/scripts/audit.py` |

## Consumer pattern

```bash
# Audit any local repo
python3 phenotype-registry/scripts/audit.py /path/to/repo [kind]

# Pipeline: feed into registry dashboard
python3 audit.py /path/to/repo | jq '.overall, .grade'
```