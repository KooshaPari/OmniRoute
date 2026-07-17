# PhenoSDK Scripts Consolidation Plan

**Objective:** Consolidate `scripts/categories/` into `tools/` and formalize as CLI commands.

**Source:** `/Users/kooshapari/CodeProjects/Phenotype/repos/phenoSDK/scripts/categories/` (51 files)
**Target:** `/Users/kooshapari/CodeProjects/Phenotype/repos/phenoSDK/tools/` (existing + merged)

---

## Executive Summary

| Category | Files | Action | Destination |
|----------|-------|--------|-------------|
| **utilities** | 4 | MERGE | tools/utilities/ |
| **testing** | 11 | MERGE | tools/testing/ |
| **analysis** | 12 | MERGE | tools/analysis/ |
| **monitoring** | 4 | EXTRACT | ObservabilityKit |
| **deployment** | 4 | EXTRACT | ResilienceKit |
| **security** | 2 | MERGE | tools/testing/ + tools/quality/ |
| **quality** | 5 | MERGE | tools/quality/ |
| **performance** | 1 | MERGE | tools/quality/tools/ |
| **refactoring** | 1 | EXTRACT | PhenoKit |
| **schema** | 2 | EXTRACT | PhenoKit |
| **vendor** | 3 | EXTRACT | PhenoKit |

---

## Detailed File Analysis

### 1. UTILITIES (4 files) → tools/utilities/

| File | scripts/categories | tools/ | Status | Action |
|------|-------------------|--------|--------|--------|
| count_loc.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| profile_memory.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| ingest_benchmarks.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| export_metrics.py | ✅ | ❌ | Unique | MOVE to tools/utilities/ |

**CLI Commands to Add:**
- `pheno loc [--threshold 8500] [--json]` → count_loc.py
- `pheno memory profile [--module] [--report] [--pheno]` → profile_memory.py
- `pheno benchmark register|list` → ingest_benchmarks.py
- `pheno metrics export [--output]` → export_metrics.py

---

### 2. TESTING (11 files) → tools/testing/

| File | scripts/categories | tools/testing/ | Status | Action |
|------|-------------------|----------------|--------|--------|
| test_automation_suite.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| test_duration_tracker.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| test_documentation.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| test_packages.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| run_comprehensive_tests.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| performance_testing_framework.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| enhance_testing_infrastructure.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| enhance_test_data_scenarios.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| optimize_test_parallelization.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| advanced_security_testing.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| advanced_performance_testing.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |

**Note:** All 11 files are EXACT DUPLICATES already present in tools/testing/

**CLI Commands to Add:**
- `pheno test run [--parallel] [--categories] [--tests]` → test_automation_suite.py
- `pheno test track [--duration]` → test_duration_tracker.py
- `pheno test docs [--validate]` → test_documentation.py
- `pheno test packages [--check]` → test_packages.py
- `pheno test comprehensive [--report]` → run_comprehensive_tests.py
- `pheno test performance [--benchmark]` → performance_testing_framework.py
- `pheno test enhance [--infrastructure|--data|--parallelization]` → consolidation
- `pheno test security [--advanced]` → advanced_security_testing.py

---

### 3. ANALYSIS (12 files) → tools/analysis/

| File | scripts/categories | tools/analysis/ | Status | Action |
|------|-------------------|-----------------|--------|--------|
| analyze_dependencies.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| analyze_complexity.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| analyze_churn.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| analyze_duplication.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| analyze_quality_coverage.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| analyze_response_times.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| analyze_test_coverage.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| coverage_analysis.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| code_smell_detector.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| architectural_pattern_validator.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| detect_dead_code.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| advanced_pattern_detector.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |

**Note:** All 12 files are EXACT DUPLICATES already present in tools/analysis/

**CLI Commands to Add:**
- `pheno analyze dependencies [--json] [--report]` → analyze_dependencies.py
- `pheno analyze complexity [--threshold]` → analyze_complexity.py
- `pheno analyze churn [--days]` → analyze_churn.py
- `pheno analyze duplication [--fix]` → analyze_duplication.py
- `pheno analyze coverage [--test|--quality]` → coverage_analysis.py
- `pheno analyze smells [--severity] [--type]` → code_smell_detector.py
- `pheno analyze architecture [--pattern]` → architectural_pattern_validator.py
- `pheno analyze dead-code [--delete]` → detect_dead_code.py
- `pheno analyze patterns [--advanced]` → advanced_pattern_detector.py

---

### 4. MONITORING (4 files) → Extract to ObservabilityKit

| File | scripts/categories | tools/monitoring/ | Status | Action |
|------|-------------------|-------------------|--------|--------|
| observability_dashboard.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| monitoring_orchestrator.py | ✅ | ❌ | Unique | MOVE to ObservabilityKit |
| ci_cd_monitoring.py | ✅ | ❌ | Unique | MOVE to ObservabilityKit |
| advanced_analytics_dashboard.py | ✅ | ❌ | Unique | MOVE to ObservabilityKit |

**CLI Commands to Add:**
- `pheno dashboard run [--duration]` → observability_dashboard.py
- `pheno monitor orchestrate [--config]` → monitoring_orchestrator.py
- `pheno monitor ci-cd [--pipeline]` → ci_cd_monitoring.py
- `pheno monitor analytics [--realtime]` → advanced_analytics_dashboard.py

---

### 5. DEPLOYMENT (4 files) → Extract to ResilienceKit

| File | scripts/categories | tools/deployment/ | Status | Action |
|------|-------------------|------------------|--------|--------|
| release_automation.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| check_schema_drift.py | ✅ | ❌ | Unique | MOVE to ResilienceKit |
| check_deployment.py | ✅ | ❌ | Unique | MOVE to ResilienceKit |
| build_and_release.py | ✅ | ❌ | Unique | MOVE to ResilienceKit |

**CLI Commands to Add:**
- `pheno release [--auto|--manual]` → release_automation.py
- `pheno deploy check [--environment]` → check_deployment.py
- `pheno deploy schema-drift [--fix]` → check_schema_drift.py
- `pheno build release [--version]` → build_and_release.py

---

### 6. SECURITY (2 files) → tools/testing/ + tools/quality/

| File | scripts/categories | tools/quality/ | Status | Action |
|------|-------------------|----------------|--------|--------|
| security_pattern_scanner.py | ✅ | Partial (security_scanner.py) | Similar functionality | CONSOLIDATE into tools/quality/security_scanner.py |
| security_policy_enforcer.py | ✅ | ❌ | Unique | MOVE to tools/quality/ |

**Analysis:** 
- `security_pattern_scanner.py` (962 lines) is a comprehensive standalone scanner
- `tools/quality/security_scanner.py` (416 lines) is plugin-based with QualityIssue integration
- Both detect SQL injection, XSS, insecure deserialization, auth bypass

**Recommendation:** Merge comprehensive OWASP patterns from security_pattern_scanner.py into tools/quality/security_scanner.py

**CLI Commands to Add:**
- `pheno security scan [--severity] [--owasp]` → security_scanner.py
- `pheno security enforce [--policy]` → security_policy_enforcer.py

---

### 7. QUALITY (5 files) → tools/quality/

| File | scripts/categories | tools/quality/ | Status | Action |
|------|-------------------|----------------|--------|--------|
| validate_quality_gates.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| setup_quality_framework.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| quality_metrics_collector.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| quality_score_calculator.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| comprehensive_quality_analyzer.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |
| integration_quality_gates.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |

**Note:** All 6 files are EXACT DUPLICATES already present in tools/quality/

**CLI Commands to Add:**
- `pheno quality validate [--gate]` → validate_quality_gates.py
- `pheno quality setup [--framework]` → setup_quality_framework.py
- `pheno quality metrics [--collect]` → quality_metrics_collector.py
- `pheno quality score [--calculate]` → quality_score_calculator.py
- `pheno quality analyze [--comprehensive]` → comprehensive_quality_analyzer.py
- `pheno quality integration [--gates]` → integration_quality_gates.py

---

### 8. PERFORMANCE (1 file) → tools/quality/tools/

| File | scripts/categories | tools/quality/tools/ | Status | Action |
|------|-------------------|----------------------|--------|--------|
| performance_anti_pattern_detector.py | ✅ | ✅ | **EXACT DUPLICATE** | DELETE from scripts |

**CLI Commands to Add:**
- `pheno quality performance-detect [--fix]` → performance_detector.py

---

### 9. REFACTORING (1 file) → Extract to PhenoKit

| File | scripts/categories | tools/ | Status | Action |
|------|-------------------|--------|--------|--------|
| refactor_large_files.py | ✅ | ❌ | Unique | MOVE to PhenoKit |

**CLI Commands to Add:**
- `pheno refactor files [--threshold-lines] [--strategy]` → refactor_large_files.py

---

### 10. SCHEMA (2 files) → Extract to PhenoKit

| File | scripts/categories | tools/ | Status | Action |
|------|-------------------|--------|--------|--------|
| manage_schema.py | ✅ | ❌ | Unique | MOVE to PhenoKit |
| migrate_schema.py | ✅ | ❌ | Unique | MOVE to PhenoKit |

**CLI Commands to Add:**
- `pheno schema manage [--validate]` → manage_schema.py
- `pheno schema migrate [--version]` → migrate_schema.py

---

### 11. VENDOR (3 files) → Extract to PhenoKit

| File | scripts/categories | tools/ | Status | Action |
|------|-------------------|--------|--------|--------|
| vendor_setup.py | ✅ | ❌ | Unique | MOVE to PhenoKit |
| version_management.py | ✅ | ❌ | Unique | MOVE to PhenoKit |
| vendor_manager.py | ✅ | ❌ | Unique | MOVE to PhenoKit |

**CLI Commands to Add:**
- `pheno vendor setup [--vendor]` → vendor_setup.py
- `pheno vendor versions [--check]` → version_management.py
- `pheno vendor manage [--list|--update]` → vendor_manager.py

---

## Consolidation Summary

### Files to DELETE (Exact Duplicates): 43 files
```
utilities/: count_loc.py, profile_memory.py, ingest_benchmarks.py
testing/: test_automation_suite.py, test_duration_tracker.py, test_documentation.py,
         test_packages.py, run_comprehensive_tests.py, performance_testing_framework.py,
         enhance_testing_infrastructure.py, enhance_test_data_scenarios.py,
         optimize_test_parallelization.py, advanced_security_testing.py,
         advanced_performance_testing.py
analysis/: analyze_dependencies.py, analyze_complexity.py, analyze_churn.py,
          analyze_duplication.py, analyze_quality_coverage.py, analyze_response_times.py,
          analyze_test_coverage.py, coverage_analysis.py, code_smell_detector.py,
          architectural_pattern_validator.py, detect_dead_code.py, advanced_pattern_detector.py
monitoring/: observability_dashboard.py
quality/: validate_quality_gates.py, setup_quality_framework.py,
           quality_metrics_collector.py, quality_score_calculator.py,
           comprehensive_quality_analyzer.py, integration_quality_gates.py
performance/: performance_anti_pattern_detector.py
deployment/: release_automation.py
```

### Files to MOVE (Unique): 11 files
```
tools/utilities/: export_metrics.py
ObservabilityKit/: monitoring_orchestrator.py, ci_cd_monitoring.py, advanced_analytics_dashboard.py
ResilienceKit/: check_schema_drift.py, check_deployment.py, build_and_release.py
tools/quality/: security_policy_enforcer.py
PhenoKit/: refactor_large_files.py, manage_schema.py, migrate_schema.py,
          vendor_setup.py, version_management.py, vendor_manager.py
```

### Files to MERGE (Similar): 1 file
```
tools/quality/security_scanner.py ← merge patterns from security_pattern_scanner.py
```

---

## CLI Structure Proposal

```
pheno
├── test
│   ├── run [--parallel] [--categories] [--tests]
│   ├── track [--duration]
│   ├── docs [--validate]
│   ├── packages [--check]
│   ├── comprehensive [--report]
│   ├── performance [--benchmark]
│   ├── enhance [--infrastructure|--data|--parallelization]
│   └── security [--advanced]
├── analyze
│   ├── dependencies [--json] [--report]
│   ├── complexity [--threshold]
│   ├── churn [--days]
│   ├── duplication [--fix]
│   ├── coverage [--test|--quality]
│   ├── smells [--severity] [--type]
│   ├── architecture [--pattern]
│   ├── dead-code [--delete]
│   └── patterns [--advanced]
├── quality
│   ├── validate [--gate]
│   ├── setup [--framework]
│   ├── metrics [--collect]
│   ├── score [--calculate]
│   ├── analyze [--comprehensive]
│   ├── integration [--gates]
│   ├── performance-detect [--fix]
│   └── security-scan [--severity] [--owasp]
├── security
│   ├── scan [--severity] [--owasp]
│   └── enforce [--policy]
├── dashboard
│   └── run [--duration]
├── monitor
│   ├── orchestrate [--config]
│   ├── ci-cd [--pipeline]
│   └── analytics [--realtime]
├── release
│   └── [--auto|--manual]
├── deploy
│   ├── check [--environment]
│   └── schema-drift [--fix]
├── build
│   └── release [--version]
├── loc [--threshold] [--json]
├── memory
│   └── profile [--module] [--report] [--pheno]
├── benchmark
│   ├── register
│   └── list
├── metrics
│   └── export [--output]
├── refactor
│   └── files [--threshold-lines] [--strategy]
├── schema
│   ├── manage [--validate]
│   └── migrate [--version]
└── vendor
    ├── setup [--vendor]
    ├── versions [--check]
    └── manage [--list|--update]
```

---

## Implementation Phases

### Phase 1: Delete Exact Duplicates (Week 1)
1. Create backup of scripts/categories/
2. Delete 43 exact duplicate files
3. Verify tools/ versions work correctly
4. Update any documentation references

### Phase 2: Consolidate Security Tools (Week 1)
1. Merge security_pattern_scanner.py patterns into tools/quality/security_scanner.py
2. Move security_policy_enforcer.py to tools/quality/
3. Delete original security_pattern_scanner.py

### Phase 3: Move Unique Files (Week 2)
1. Create target directories if needed
2. Move 11 unique files to appropriate destinations:
   - tools/utilities/: export_metrics.py
   - ObservabilityKit/: 3 files
   - ResilienceKit/: 3 files
   - tools/quality/: security_policy_enforcer.py
   - PhenoKit/: 6 files
3. Update imports and paths

### Phase 4: Formalize CLI (Week 2-3)
1. Create unified CLI entry point
2. Implement command structure
3. Add CLI entry points to each tool
4. Create command routing/mapping
5. Add --help documentation

### Phase 5: Verification (Week 3)
1. Run all consolidated tools
2. Verify CLI commands work
3. Update documentation
4. Remove empty scripts/categories/ directory

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tools have subtle differences not detected | Medium | Compare file hashes and git history |
| External scripts reference scripts/categories/ | Medium | Search all files for references before deletion |
| Import path changes break tools | Low | Update imports when moving files |
| CLI conflicts with existing commands | Low | Use namespacing (pheno test run vs pheno run) |

---

## Verification Checklist

- [ ] All 43 duplicate files verified as exact matches
- [ ] No external references to scripts/categories/ files
- [ ] All CLI commands tested and working
- [ ] Documentation updated
- [ ] CI/CD pipelines still functional
- [ ] Empty scripts/categories/ directory removed

---

**Report Generated:** 2026-04-05
**Prepared by:** Claude AI Agent
**Status:** PLANNING - Ready for Implementation
