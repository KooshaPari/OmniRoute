# CI Workflow Convergence Report

**Date:** 2026-09-13
**Fork:** 79 workflows | **Upstream:** 26 workflows | **Fork-only:** 53

## Classification

### Shared with Upstream (26)
These match upstream workflows (may have fork-specific modifications):

| Workflow | Purpose |
|----------|---------|
| ci.yml | Main CI pipeline |
| quality.yml | Code quality checks |
| codeql.yml | Code security analysis |
| semgrep.yml | SAST scanning |
| scorecard.yml | OpenSSF scorecard |
| docker-publish.yml | Docker image build |
| electron-release.yml | Electron desktop release |
| npm-publish.yml | NPM package publish |
| deploy-vps.yml | VPS deployment |
| claude.yml | Claude AI integration |
| dast-smoke.yml | DAST smoke tests |
| lock-released-branch.yml | Branch protection |
| mutation-redundancy.yml | Mutation testing |
| nightly-compat.yml | Nightly compatibility |
| nightly-llm-security.yml | LLM security checks |
| nightly-mutation.yml | Nightly mutation |
| nightly-property.yml | Property-based testing |
| nightly-release-green.yml | Release health |
| nightly-resilience.yml | Resilience testing |
| nightly-schemathesis.yml | API schema testing |
| opencode-plugin-ci.yml | Plugin CI |
| opencode-provider-ci.yml | Provider CI |
| wiki-sync.yml | Wiki sync |

### Fork-Only: Build & Release (5)
| Workflow | Purpose | Keep? |
|----------|---------|-------|
| build-fork.yml | Fork-specific build | Yes (fork-specific) |
| build-rinseaid-image.yml | RinseAID image build | Yes (fork-specific) |
| auto-release.yml | Auto-release automation | Review |
| release.yml | Release pipeline | Review |
| release-channels.yml | Multi-channel release | Review |

### Fork-Only: Security & Compliance (8)
| Workflow | Purpose | Keep? |
|----------|---------|-------|
| audit.yml | Dependency audit | Yes |
| audit-ratchet.yml | Audit ratchet gate | Yes |
| security-scan.yml | Security scanning | Review (overlap with semgrep/codeql) |
| gitleaks-fleet.yml | Secret scanning fleet | Yes |
| infisical.yml | Infisical secrets | Yes |
| cyclonedx.yml | SBOM generation | Yes |
| cyclonedx-weekly.yml | Weekly SBOM | Review (redundant with cyclonedx.yml) |
| sbom.yml | SBOM publish | Yes |
| sbom-gen.yaml | SBOM generation | Review (overlap with cyclonedx) |
| sbom-weekly.yml | Weekly SBOM | Review (redundant) |
| dependency-review.yml | Dep review | Yes |
| mtls-weekly.yml | mTLS checks | Yes |
| cosign-ci.yml | Container signing | Yes |

### Fork-Only: Quality Gates (6)
| Workflow | Purpose | Keep? |
|----------|---------|-------|
| apps-quality.yml | Apps quality | Yes |
| trunk-check.yml | Trunk linting | Yes |
| adr-quality-lint.yml | ADR linting | Yes |
| pillar-checks.yml | Pillar checks | Yes |
| qgate.yml | Quality gate | Yes |
| v4-strict-types.yml | Strict types | Yes |

### Fork-Only: Performance & Latency (5)
| Workflow | Purpose | Keep? |
|----------|---------|-------|
| k6-load-test.yml | Load testing | Yes |
| latency-budget.yml | Latency budget | Yes |
| perf-weekly.yml | Weekly perf | Review |
| flamegraph.yml | Flamegraph generation | Review (manual trigger) |
| l45-p99-regression.yml | P99 regression | Review |

### Fork-Only: Nightly & Scheduled (6)
| Workflow | Purpose | Keep? |
|----------|---------|-------|
| nightly.yml | Main nightly | Yes |
| nightly-dispatch-bench.yml | Dispatch benchmark | Review |
| chaos-weekly.yml | Chaos testing | Yes |
| contract-weekly.yml | Contract tests | Review (overlap with contract_tests.yaml) |
| lfs-weekly.yml | LFS checks | Review |
| ssot-drift-cron.yaml | SSOT drift | Yes |

### Fork-Only: One-Time/Legacy (7)
| Workflow | Purpose | Keep? |
|----------|---------|-------|
| l21-bom-diff.yml | BOM diff audit | DELETE (one-time) |
| l27-pest-conflict.yml | Pest conflict check | DELETE (one-time) |
| l48-lsa-graph.yml | LSA graph | DELETE (one-time) |
| l52-sbom-audit.yml | SBOM audit | DELETE (one-time) |
| l53-helioscope-vm.yml | Helioscope VM | DELETE (one-time) |
| l69-sla-deck.yml | SLA deck | DELETE (one-time) |
| journey-evidence.yml | Journey evidence | DELETE (one-time) |

### Fork-Only: Other (8)
| Workflow | Purpose | Keep? |
|----------|---------|-------|
| claude.yml | Claude AI | Yes |
| contract_tests.yaml | Contract tests | Yes |
| cross-platform.yml | Cross-platform build | Yes |
| desktop-electrobun.yml | Electrobun desktop | Review |
| docs-deploy.yml | Docs deployment | Yes |
| oidc-ci.yml | OIDC CI | Yes |
| omniroute-rs.yml | Rust components | Yes |
| opencode-plugin-ci.yml | Plugin CI | Yes |
| radar-export.yml | Radar export | Review |
| slo-burnrate.yml | SLO burn rate | Yes |
| terraform-pr.yml | Terraform PR | Yes |

## Recommendations

### DELETE (7 one-time workflows)
These were one-time audit workflows with no recurring value:
- l21-bom-diff.yml, l27-pest-conflict.yml, l48-lsa-graph.yml
- l52-sbom-audit.yml, l53-helioscope-vm.yml, l69-sla-deck.yml
- journey-evidence.yml

### CONSOLIDATE (4 redundant pairs)
- cyclonedx.yml + cyclonedx-weekly.yml → keep weekly only
- sbom.yml + sbom-gen.yaml → consolidate to one
- contract_tests.yaml + contract-weekly.yml → keep one
- security-scan.yml + semgrep.yml → review overlap

### REVIEW (6 low-priority)
- flamegraph.yml (manual trigger, consider removing from CI)
- l45-p99-regression.yml (consider merging into perf-weekly.yml)
- nightly-dispatch-bench.yml (consider merging into nightly.yml)
- desktop-electrobun.yml (if not actively used)
- radar-export.yml (if not actively used)
- auto-release.yml (if release.yml covers this)

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Keep as-is | 42 | No change |
| DELETE | 7 | Remove one-time workflows |
| CONSOLIDATE | 4 | Merge redundant pairs |
| REVIEW | 6 | Evaluate necessity |
| **Net after cleanup** | **~62** | Down from 79 |
