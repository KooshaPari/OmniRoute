# DAG WBS — Ecosystem Gap Port Retro

## Completed lanes

| Lane | Work | Status |
|------|------|--------|
| Compare | PhenoProc vs Agentora crate dirs | ✅ |
| Clone | phenotype-tooling, phenokits-commons | ✅ |
| Port | Agentora wave 6 bulk | ✅ pushed #79 |
| Split | router-monitor → tooling #155 | ✅ |
| Split | governance → phenokits #3 | ✅ |
| Fix | bifrost-routing / forgecode-core deps | ✅ |
| Docs | registry rationalization + ADRs | ✅ this commit |

## Next lanes (from ECOSYSTEM_DAG.md)

| Lane | Work | Tag |
|------|------|-----|
| A | Merge registry #76 | `[G]` |
| B–E | Merge #157, #3, #155, #79 | `[P]` |
| F | Consumer manifest scan | `[G]` |
| H–J | AgilePlus repatriation | `[P]` — H/I satisfied (canonical in AgilePlus); J Agentora PR open |
| G | Archive PhenoProc/Metron/PhenoKits | ✅ 2026-06-17 |
| Cmdra workspace | Agentora refactor | `[NB]` |
| HexaKit dep repoint | Agentora phenotype-* | `[NB]` |

## Dependencies

- Lanes B–E depend on A (SSOT on main)
- Lane F depends on B–E
- Lane J depends on H–I (agileplus-domain/events)
