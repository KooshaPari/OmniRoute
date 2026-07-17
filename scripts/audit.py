#!/usr/bin/env python3
"""audit.py - measure pillar scores from actual repo state (v2 with broader signal coverage)."""
import json
import re
import subprocess
import sys
from pathlib import Path

EXCLUDE = {".git", "node_modules", "target", "dist", "build", "third_party", "vendor", ".next", "fuzzworkdir", "fuzz", "out", "coverage", ".claude", "internal/adapters", "internal/api", "internal/ports", "pkg/validate", "pkg/tier", "pkg/runtime", "internal/listen", "internal/token", "cmd/agentctl", "cmd/nanovms", "cmd/nvms"}

def should_skip(p: Path) -> bool:
    return any(part in EXCLUDE for part in p.parts)

def rglob_filter(root: Path, pattern: str):
    if not root.exists(): return
    for p in root.rglob(pattern):
        if not should_skip(p):
            yield p

def has_file(root: Path, *paths: str) -> bool:
    return any((root / p).exists() for p in paths)

def read_text_safe(p: Path) -> str:
    try: return p.read_text()
    except: return ""

def count_files(root: Path, pattern: str) -> int:
    return sum(1 for _ in rglob_filter(root, pattern))

def has_doc_with_section(root: Path, *doc_paths: str, required_section: str = "") -> int:
    """Return 25 points per doc_path that exists and mentions required_section."""
    score = 0
    for p in doc_paths:
        path = root / p
        if path.exists():
            score += 25
            if required_section and required_section.lower() in read_text_safe(path).lower():
                score += 5  # bonus for the specific section
    return min(100, score)

def has_dashboards(root: Path, name: str, min_count: int) -> int:
    path = root / "docs" / "dashboards"
    if not path.exists(): return 0
    n = len(list(path.glob("*.json")))
    if n >= min_count: return 50
    elif n >= 1: return 25
    return 0

def has_alerts(root: Path, min_count: int) -> int:
    path = root / "docs" / "alerting"
    if not path.exists(): return 0
    n = len(list(path.glob("*.yaml")))
    if n >= min_count: return 30
    elif n >= 1: return 15
    return 0

def has_runbook(root: Path) -> int:
    return 30 if (root / "docs" / "runbooks" / "monitoring.md").exists() else 0

def max_loc(root: Path, ext: str) -> int:
    m = 0
    for f in rglob_filter(root, f"*.{ext}"):
        try:
            n = sum(1 for _ in f.open())
            if n > m: m = n
        except: pass
    return m

def count_test_files(root: Path, ext: str) -> int:
    if ext == "rs":
        return count_files(root, "*_test.rs")
    if ext == "go":
        # count go test files
        return count_files(root, "*_test.go")
    return 0

def has_workspace_lints(root: Path) -> int:
    cargo = root / "Cargo.toml"
    if not cargo.exists(): return 0
    text = read_text_safe(cargo)
    if "[workspace.lints" in text: return 60
    if "[lints" in text: return 30
    return 0

def has_golangci_linters(root: Path, min_count: int) -> int:
    p = root / ".github" / "golangci.yml"
    if not p.exists(): return 0
    text = read_text_safe(p)
    linters_match = re.search(r"enable:\s*\n((?:\s*-\s*\w+.*\n)+)", text)
    if not linters_match: return 0
    n = len(re.findall(r"-\s*\w+", linters_match.group(1)))
    if n >= min_count: return 60
    elif n >= 5: return 30
    return 0

def has_deny_toml(root: Path) -> int:
    return 40 if (root / "deny.toml").exists() else 0

def has_dependabot(root: Path) -> int:
    return 30 if (root / ".github" / "dependabot.yml").exists() else 0

def has_license(root: Path) -> int:
    return 50 if has_file(root, "LICENSE", "LICENSE.md", "LICENSE-MIT", "LICENSE-APACHE") else 0

def has_terraform(root: Path) -> int:
    score = 0
    if (root / "terraform" / "main.tf").exists(): score += 50
    elif (root / "docker-compose.yml").exists() or (root / "docker-compose.yaml").exists(): score += 30
    if (root / "docs" / "infrastructure.md").exists(): score += 30
    if list(rglob_filter(root, "k8s/*.yaml")) or list(rglob_filter(root, "kubernetes/*.yaml")): score += 30
    if (root / "Dockerfile").exists(): score += 20
    return min(100, score)

def has_plugin_rust(root: Path) -> int:
    score = 0
    if (root / "crates" / "plugin-api").exists(): score += 50
    if (root / "crates" / "plugin-sample").exists(): score += 20
    if (root / "docs" / "extensibility.md").exists(): score += 30
    return min(100, score)

def has_plugin_go(root: Path) -> int:
    score = 0
    if (root / "internal" / "plugin").exists(): score += 50
    if (root / "docs" / "extensibility.md").exists(): score += 30
    if (root / "internal" / "plugin" / "sample").exists(): score += 20
    return min(100, score)

def has_security_md(root: Path) -> int:
    return 50 if (root / "SECURITY.md").exists() else 0

def has_sbmd_slsa(root: Path) -> int:
    score = 0
    if (root / "docs" / "sbom.md").exists(): score += 35
    if (root / "docs" / "slsa.md").exists(): score += 35
    return min(70, score)

def has_release_config(kind: str, root: Path) -> int:
    if kind == "rust":
        if (root / "release-plz.toml").exists(): return 50
    if kind == "go":
        if (root / ".goreleaser.yml").exists(): return 50
    return 0

def has_fuzz_rust(root: Path) -> int:
    score = 0
    if (root / "fuzz").exists(): score += 70
    if (root / "docs" / "fuzzing.md").exists(): score += 30
    cargo = root / "Cargo.toml"
    if cargo.exists() and "cargo-fuzz" in read_text_safe(cargo): score += 60
    return min(100, score)

def has_fuzz_go(root: Path) -> int:
    score = 0
    if any(rglob_filter(root, "*fuzz*test*")): score += 70
    if (root / "docs" / "fuzzing.md").exists(): score += 30
    return min(100, score)

def has_bench_rust(root: Path) -> int:
    score = 0
    if (root / "benches").exists(): score += 50
    if count_files(root / "crates", "benches") > 0: score += 20
    if (root / "docs" / "performance.md").exists(): score += 20
    return min(100, score)

def has_bench_go(root: Path) -> int:
    score = 0
    n = 0
    for f in rglob_filter(root, "*.go"):
        if "func Benchmark" in read_text_safe(f): n += 1
    if n > 0: score += 50
    if (root / "docs" / "performance.md").exists(): score += 30
    return min(100, score)

def has_devcontainer(root: Path) -> int:
    return 25 if (root / ".devcontainer" / "devcontainer.json").exists() else 0

def has_mise(root: Path) -> int:
    return 25 if (root / "mise.toml").exists() else 0

def has_dev_loop_md(root: Path) -> int:
    return 30 if (root / "docs" / "dev-loop.md").exists() else 0

def has_agent_loop_rust(root: Path) -> int:
    score = 0
    if (root / "crates" / "agentctl").exists(): score += 50
    if (root / "docs" / "agent-loop.md").exists(): score += 30
    if (root / "Cargo.toml").exists() and "serde_json" in read_text_safe(root / "Cargo.toml"): score += 20
    return min(100, score)

def has_agent_loop_go(root: Path) -> int:
    score = 0
    if (root / "cmd" / "agentctl").exists(): score += 50
    if (root / "docs" / "agent-loop.md").exists(): score += 30
    return min(100, score)

def has_agent_loop_orphaned(root: Path) -> int:
    # Check for stale .claude/agentctl binary in root
    if (root / "agentctl").exists() and (root / "agentctl").stat().st_size > 1000000:
        return -100  # penalty for orphaned binary
    return 0

def has_frontend_rust(root: Path) -> int:
    score = 0
    if (root / "crates" / "agentctl").exists(): score += 20
    if (root / "docs" / "frontend.md").exists(): score += 60
    return min(100, score)

def has_frontend_go(root: Path) -> int:
    score = 0
    if (root / "cmd" / "agentctl").exists(): score += 50
    if (root / "docs" / "frontend.md").exists(): score += 30
    return min(100, score)

def has_data_layer_rust(root: Path) -> int:
    score = 0
    if (root / "docs" / "data-layer.md").exists(): score += 50
    elif (root / "docs" / "migrations").exists(): score += 40
    elif (root / "migrations").exists(): score += 40
    cargo = root / "Cargo.toml"
    if cargo.exists():
        text = read_text_safe(cargo)
        if re.search(r'^\s*(sqlx|diesel|sea-orm)\s*=', text, re.M): score += 50
        elif "rusqlite" in text: score += 30
    return min(100, score)

def has_data_layer_go(root: Path) -> int:
    score = 0
    if (root / "docs" / "data-layer.md").exists(): score += 50
    found = False
    for f in rglob_filter(root, "*.go"):
        if "sqlx" in read_text_safe(f) or "sql.DB" in read_text_safe(f): found = True; break
    if found: score += 50
    return min(100, score)

def has_error_handling_rust(root: Path) -> int:
    score = 0
    if (root / "docs" / "error-handling.md").exists(): score += 50
    if (root / "Cargo.toml").exists() and ("thiserror" in read_text_safe(root / "Cargo.toml") or "anyhow" in read_text_safe(root / "Cargo.toml")): score += 30
    return min(100, score)

def has_error_handling_go(root: Path) -> int:
    score = 0
    if (root / "docs" / "error-handling.md").exists(): score += 50
    found = False
    for f in rglob_filter(root, "*.go"):
        if "errors.New" in read_text_safe(f) or "fmt.Errorf" in read_text_safe(f) or "errors.Is" in read_text_safe(f): found = True; break
    if found: score += 30
    return min(100, score)

def has_logging_rust(root: Path) -> int:
    score = 0
    if (root / "docs" / "logging.md").exists(): score += 60
    cargo = root / "Cargo.toml"
    if cargo.exists():
        text = read_text_safe(cargo)
        if re.search(r'^\s*tracing(-subscriber|-core)?\s*=', text, re.M): score += 40
        elif "tracing" in text: score += 30
    if score == 0 and (root / "docs" / "observability.md").exists(): score += 50
    return min(100, score)

def has_logging_go(root: Path) -> int:
    score = 0
    if (root / "docs" / "logging.md").exists(): score += 60
    found = False
    for f in rglob_filter(root, "*.go"):
        if "slog" in read_text_safe(f): found = True; break
    if found: score += 40
    return min(100, score)

def has_api_openapi(root: Path) -> int:
    score = 0
    if (root / "docs" / "api").exists():
        n = count_files(root / "docs" / "api", "*.yaml")
        if n >= 1: score += 70
    return min(100, score)

def has_i18n_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "i18n-a11y.md").exists(): score += 100
    elif (root / "i18n").exists(): score += 80
    elif (root / "locales").exists(): score += 60
    elif any(rglob_filter(root, "*.po")): score += 50
    return min(100, score)

def has_concurrency_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "concurrency.md").exists(): score += 100
    elif (root / "docs" / "event-driven.md").exists(): score += 60
    cargo = root / "Cargo.toml"
    if cargo.exists():
        text = read_text_safe(cargo)
        if re.search(r'tokio\s*=.*features.*=.*\["full"', text): score += 80
        elif re.search(r'^\s*tokio\s*=', text, re.M): score += 40
        if "rayon" in text: score += 20
    return min(100, score)

def has_event_driven_md(root: Path) -> int:
    return 100 if (root / "docs" / "event-driven.md").exists() else 0

def has_config_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "config.md").exists(): score += 100
    elif (root / "config").exists(): score += 60
    elif (root / "config.yaml").exists() or (root / "config.yml").exists(): score += 60
    elif (root / "config.toml").exists(): score += 60
    elif (root / "Cargo.toml").exists() and re.search(r'\[features\]', read_text_safe(root / "Cargo.toml")): score += 40
    return min(100, score)

def has_testing_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "testing.md").exists(): score += 50
    return min(100, score)

def has_memory_mentioned(root: Path) -> int:
    score = 0
    for p in [root / "docs" / "performance.md", root / "docs" / "observability.md", root / "docs" / "monitoring.md"]:
        if p.exists():
            text = read_text_safe(p).lower()
            if "rss" in text or "memory" in text or "heap" in text or "allocator" in text: score += 50; break
    cargo = root / "Cargo.toml"
    if cargo.exists():
        text = read_text_safe(cargo)
        if re.search(r'^\s*(jemalloc|mimalloc|sized-chunks)\s*=', text, re.M): score += 30
        if "bytes" in text and "Buf" in text: score += 20
    return min(100, score)

def has_cost_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "cost-efficiency.md").exists(): score += 100
    elif (root / "docs" / "cost.md").exists(): score += 100
    elif (root / "COST.md").exists(): score += 80
    elif (root / "docs" / "PERF_BUDGETS.md").exists() or (root / "PERF_BUDGETS.md").exists(): score += 50
    return min(100, score)

def has_migration_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "migration.md").exists(): score += 100
    elif (root / "docs" / "migrations").exists(): score += 70
    elif (root / "migrations").exists(): score += 60
    elif (root / "docs" / "MIGRATION.md").exists(): score += 100
    elif (root / "MIGRATION.md").exists(): score += 100
    return min(100, score)

def has_monitoring_dashboards(root: Path) -> int:
    score = 0
    score += has_dashboards(root, "*", 2)
    score += has_alerts(root, 1)
    score += has_runbook(root)
    score += (30 if (root / "docs" / "monitoring.md").exists() else 0)
    return min(100, score)

def has_architecture_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "architecture.md").exists(): score += 30
    elif (root / "docs" / "architecture").exists(): score += 25
    elif (root / "ARCHITECTURE.md").exists(): score += 30
    if count_files(root / "docs" / "adr", "*.md") >= 3: score += 50
    if (root / "docs" / "adr" / "0001-record-architecture-decisions.md").exists(): score += 20
    return min(100, score)

def has_observability_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "monitoring.md").exists(): score += 100
    elif (root / "docs" / "observability.md").exists(): score += 100
    elif (root / "docs" / "dashboards").exists(): score += 50
    return min(100, score)

def has_onboarding_md(root: Path) -> int:
    score = 0
    if (root / "docs" / "onboarding.md").exists(): score += 50
    if (root / "scripts" / "dev-bootstrap.sh").exists(): score += 30
    if (root / "README.md").exists(): score += 20
    return min(100, score)

def has_test_count_rust(root: Path) -> int:
    n = count_test_files(root, "rs")
    if n >= 5: return 30
    if n >= 1: return 15
    return 0

def has_test_count_go(root: Path) -> int:
    n = count_test_files(root, "go")
    if n >= 10: return 30
    if n >= 1: return 15
    return 0

def has_complexity_under_target(root: Path, ext: str) -> int:
    m = max_loc(root, ext)
    if m == 0: return 0
    if m <= 200: return 100
    if m <= 350: return 80
    if m <= 500: return 50
    return 0

PILLARS = [
    "L1 Architecture", "L2 Dev Loop", "L3 Agent Loop", "L4 Observability",
    "L5 Security", "L6 Performance", "L7 Extensibility", "L8 Compliance",
    "L9 Complexity", "L10 Type Safety", "L11 Dependencies", "L12 Error Handling",
    "L13 Logging", "L14 Data Layer", "L15 API Surface", "L16 Frontend",
    "L17 I18n/A11y", "L18 Concurrency", "L19 Memory", "L20 Config",
    "L21 Testing Depth", "L22 Fuzzing", "L23 Release", "L24 Migration",
    "L25 Vendor Lockin", "L26 Event Driven", "L27 Infrastructure",
    "L28 Cost Efficiency", "L29 Monitoring", "L30 Onboarding",
]

def score_pillar(repo_dir: Path, kind: str, name: str) -> int:
    if name == "L1 Architecture": return has_architecture_md(repo_dir)
    if name == "L2 Dev Loop": return has_devcontainer(repo_dir) + has_mise(repo_dir) + has_dev_loop_md(repo_dir) + (20 if (repo_dir / "scripts").exists() else 0)
    if name == "L3 Agent Loop":
        if kind == "rust": return has_agent_loop_rust(repo_dir) + has_agent_loop_orphaned(repo_dir)
        return has_agent_loop_go(repo_dir) + has_agent_loop_orphaned(repo_dir)
    if name == "L4 Observability": return has_observability_md(repo_dir)
    if name == "L5 Security": return has_security_md(repo_dir)
    if name == "L6 Performance":
        if kind == "rust": return has_bench_rust(repo_dir)
        return has_bench_go(repo_dir)
    if name == "L7 Extensibility":
        if kind == "rust": return has_plugin_rust(repo_dir)
        return has_plugin_go(repo_dir)
    if name == "L8 Compliance": return min(100, has_sbmd_slsa(repo_dir) + has_security_md(repo_dir))
    if name == "L9 Complexity":
        if kind == "rust": return has_complexity_under_target(repo_dir, "rs")
        return has_complexity_under_target(repo_dir, "go")
    if name == "L10 Type Safety":
        if kind == "rust": return has_workspace_lints(repo_dir) + (20 if has_deny_toml(repo_dir) else 0)
        return has_golangci_linters(repo_dir, 15) + (20 if has_deny_toml(repo_dir) else 0)
    if name == "L11 Dependencies": return has_deny_toml(repo_dir) + has_dependabot(repo_dir) + (20 if has_workspace_lints(repo_dir) or has_golangci_linters(repo_dir, 5) else 0)
    if name == "L12 Error Handling":
        if kind == "rust": return has_error_handling_rust(repo_dir)
        return has_error_handling_go(repo_dir)
    if name == "L13 Logging":
        if kind == "rust": return has_logging_rust(repo_dir)
        return has_logging_go(repo_dir)
    if name == "L14 Data Layer":
        if kind == "rust": return has_data_layer_rust(repo_dir)
        return has_data_layer_go(repo_dir)
    if name == "L15 API Surface": return has_api_openapi(repo_dir)
    if name == "L16 Frontend":
        if kind == "rust": return has_frontend_rust(repo_dir)
        return has_frontend_go(repo_dir)
    if name == "L17 I18n/A11y": return has_i18n_md(repo_dir)
    if name == "L18 Concurrency": return has_concurrency_md(repo_dir)
    if name == "L19 Memory": return has_memory_mentioned(repo_dir)
    if name == "L20 Config": return has_config_md(repo_dir)
    if name == "L21 Testing Depth":
        if kind == "rust": return has_testing_md(repo_dir) + has_test_count_rust(repo_dir) + (20 if has_bench_rust(repo_dir) else 0)
        return has_testing_md(repo_dir) + has_test_count_go(repo_dir) + (20 if has_bench_go(repo_dir) else 0)
    if name == "L22 Fuzzing":
        if kind == "rust": return has_fuzz_rust(repo_dir)
        return has_fuzz_go(repo_dir)
    if name == "L23 Release": return has_release_config(kind, repo_dir) + (40 if (repo_dir / "docs" / "release.md").exists() else 0)
    if name == "L24 Migration": return has_migration_md(repo_dir)
    if name == "L25 Vendor Lockin": return has_license(repo_dir)
    if name == "L26 Event Driven": return has_event_driven_md(repo_dir)
    if name == "L27 Infrastructure": return has_terraform(repo_dir)
    if name == "L28 Cost Efficiency": return has_cost_md(repo_dir)
    if name == "L29 Monitoring": return has_monitoring_dashboards(repo_dir)
    if name == "L30 Onboarding": return has_onboarding_md(repo_dir)
    return 0

def main():
    if len(sys.argv) < 2:
        print("usage: audit.py <repo_dir> [kind]", file=sys.stderr)
        sys.exit(1)
    repo_dir = Path(sys.argv[1]).resolve()
    if not repo_dir.exists():
        print(f"error: {repo_dir} does not exist", file=sys.stderr); sys.exit(1)
    kind = sys.argv[2] if len(sys.argv) > 2 else ("rust" if (repo_dir / "Cargo.toml").exists() else "go")

    scores = {p: score_pillar(repo_dir, kind, p) for p in PILLARS}
    mean = sum(scores.values()) / len(scores)
    if mean >= 95: grade = "A+"
    elif mean >= 90: grade = "A"
    elif mean >= 85: grade = "B+"
    elif mean >= 80: grade = "B"
    elif mean >= 75: grade = "C+"
    elif mean >= 70: grade = "C"
    elif mean >= 60: grade = "D"
    else: grade = "F"

    out = {
        "repo": repo_dir.name,
        "kind": kind,
        "overall": round(mean, 1),
        "grade": grade,
        "scores": scores,
        "_meta": {
            "last_updated": subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True).stdout.strip(),
            "method": "real measurement (v2 with broader signal coverage)",
            "audit_script": "audit.py v2",
        }
    }
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()
