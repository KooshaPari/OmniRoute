#!/usr/bin/env python3
"""
soc2-evidence.py — SOC2 Type II evidence collector (AICPA TSC CC1-CC9).

Scans the local monorepo for auditable evidence aligned to AICPA Trust
Services Criteria 2017 (rev. 2022). Emits a structured JSON bundle plus a
human-readable Markdown summary under ``--out-dir``.

Per-control collectors run independently so partial evidence is still
useful (e.g. network unavailable for ``gh`` queries). Each control emits
one of: PASS / PARTIAL / FAIL / SKIPPED.

Usage:
    python3 scripts/soc2-evidence.py                 # full run
    python3 scripts/soc2-evidence.py --dry-run       # parse-only
    python3 scripts/soc2-evidence.py --out-dir DIR   # custom out
    python3 scripts/soc2-evidence.py --repo OWNER/NAME
    python3 scripts/soc2-evidence.py --since 90d

Exit codes: 0 = all PASS/PARTIAL, 1 = any FAIL, 2 = collector error.
See runbooks/soc2-evidence-collection.md for operator guidance.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# AICPA Trust Services Criteria — Common Criteria 1..9. Each maps to the
# engineering-control surface this monorepo exposes. The mapping is the
# single source of truth for which artifact answers which control.
SOC2_CONTROLS: dict[str, dict[str, str]] = {
    "CC1": {"title": "Control Environment",
            "evidence": "CHARTER.md, CODEOWNERS, CONTRIBUTING.md"},
    "CC2": {"title": "Communication and Information",
            "evidence": "AGENTS.md, README.md, STATUS.md, SSOT.md"},
    "CC3": {"title": "Risk Assessment",
            "evidence": "docs/adr/**/*.md, SECURITY.md, findings/"},
    "CC4": {"title": "Monitoring Activities",
            "evidence": "WORKLOG.md, findings/71-pillar-*.md, worklogs/*.json"},
    "CC5": {"title": "Control Activities",
            "evidence": ".github/workflows/, .githooks/, deny.toml, lefthook.yml"},
    "CC6": {"title": "Logical and Physical Access",
            "evidence": "gh api branch protection + signed git log"},
    "CC7": {"title": "System Operations",
            "evidence": "OTel-instrumented workflows, dashboards/"},
    "CC8": {"title": "Change Management",
            "evidence": "signed commits, Cargo.lock/go.sum/package-lock.json"},
    "CC9": {"title": "Risk Mitigation",
            "evidence": "trufflehog.yml, security workflows, SBOM/attestation"},
}


@dataclass
class Evidence:
    control: str
    title: str
    status: str  # PASS | PARTIAL | FAIL | SKIPPED
    summary: str
    artifacts: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    remediation: str = ""


# ---------- helpers --------------------------------------------------------


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run(cmd: list[str], cwd: Path | None = None, timeout: int = 30) -> tuple[int, str, str]:
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                           timeout=timeout, check=False)
        return r.returncode, r.stdout, r.stderr
    except FileNotFoundError as e:
        return 127, "", f"not found: {e}"
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def f_exists(p: Path) -> bool:
    try:
        return p.is_file()
    except OSError:
        return False


def count(root: Path, pat: str) -> int:
    return sum(1 for _ in root.glob(pat)) if root.exists() else 0


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


# ---------- collectors -----------------------------------------------------


def cc1(root: Path) -> Evidence:
    arts = [r for r in ("CHARTER.md", "CODEOWNERS", "CONTRIBUTING.md")
            if f_exists(root / r)]
    co_filled = f_exists(root / "CODEOWNERS") and (root / "CODEOWNERS").stat().st_size > 0
    status = "PASS" if (len(arts) >= 2 and co_filled) else "PARTIAL"
    if not arts:
        status = "FAIL"
    return Evidence("CC1", SOC2_CONTROLS["CC1"]["title"], status,
                    f"governance artifacts: {len(arts)}/3, CODEOWNERS populated: {co_filled}",
                    artifacts=arts,
                    remediation="" if status == "PASS" else
                    "add CHARTER.md + populate CODEOWNERS with at least one team rule")


def cc2(root: Path) -> Evidence:
    arts = [r for r in ("AGENTS.md", "README.md", "STATUS.md", "SSOT.md")
            if f_exists(root / r)]
    status = "PASS" if len(arts) >= 3 else "PARTIAL"
    return Evidence("CC2", SOC2_CONTROLS["CC2"]["title"], status,
                    f"communication artifacts: {len(arts)}/4 present",
                    artifacts=arts,
                    metrics={"sizes_bytes": {a: (root/a).stat().st_size for a in arts}},
                    remediation="" if status == "PASS" else
                    "add AGENTS.md + STATUS.md as minimum operational communication")


def cc3(root: Path) -> Evidence:
    adr_n = count(root / "docs" / "adr", "**/*.md")
    sec = f_exists(root / "SECURITY.md")
    find_n = count(root / "findings", "*.md")
    status = "PASS" if adr_n >= 20 and sec else "PARTIAL"
    if adr_n < 5 or not sec:
        status = "FAIL"
    return Evidence("CC3", SOC2_CONTROLS["CC3"]["title"], status,
                    f"ADRs: {adr_n}, findings: {find_n}, SECURITY.md: {sec}",
                    metrics={"adr_count": adr_n, "findings_count": find_n},
                    remediation="" if status == "PASS" else
                    "ensure ≥5 ADRs covering security/governance + SECURITY.md disclosure")


def cc4(root: Path) -> Evidence:
    wl = f_exists(root / "WORKLOG.md")
    wdir = root / "worklogs"
    recent = sorted((p for p in wdir.glob("*.json") if p.is_file()),
                    key=lambda p: p.stat().st_mtime, reverse=True)[:5] if wdir.is_dir() else []
    pillar = count(root / "findings", "71-pillar-*.md")
    status = "PASS" if (wl and recent and pillar >= 1) else "PARTIAL"
    return Evidence("CC4", SOC2_CONTROLS["CC4"]["title"], status,
                    f"WORKLOG.md: {wl}, recent worklogs: {len(recent)}, pillar audits: {pillar}",
                    metrics={"pillar_files": pillar},
                    artifacts=[p.name for p in recent],
                    remediation="" if status == "PASS" else
                    "weekly WORKLOG.md updates + ≥1 71-pillar audit in findings/")


def cc5(root: Path) -> Evidence:
    wf = root / ".github" / "workflows"
    wf_n = count(wf, "*.y*ml")
    hooks = (root / ".githooks").is_dir()
    deny = f_exists(root / "deny.toml")
    lh = f_exists(root / "lefthook.yml")
    score = sum([wf_n >= 1, hooks, deny, lh])
    status = "PASS" if score >= 3 else ("PARTIAL" if score >= 2 else "FAIL")
    return Evidence("CC5", SOC2_CONTROLS["CC5"]["title"], status,
                    f"workflows: {wf_n}, hooks: {hooks}, deny: {deny}, lefthook: {lh}",
                    metrics={"workflow_count": wf_n},
                    remediation="" if status == "PASS" else
                    "add ≥3 of: workflows, .githooks, deny.toml, lefthook.yml")


def cc6(root: Path, repo: str | None, dry: bool) -> Evidence:
    rc, out, _ = run(["git", "log", "--since=90 days ago",
                      "--pretty=%H|%G?", "-n", "200"], cwd=root)
    signed, total = 0, 0
    if rc == 0 and out:
        for line in out.strip().splitlines():
            parts = line.split("|", 1)
            if len(parts) == 2:
                total += 1
                if parts[1] in ("G", "U", "X", "Y", "R"):
                    signed += 1
    pct = (signed / total * 100.0) if total else 0.0
    bp_status, bp_detail = "UNKNOWN", "gh CLI unavailable / repo not specified"
    if repo and shutil.which("gh") and not dry:
        rc, out, _ = run(["gh", "api", f"/repos/{repo}/branches/main/protection"],
                         cwd=root, timeout=15)
        if rc == 0 and out.strip().startswith("{"):
            p = json.loads(out)
            bp_status = "PASS" if p.get("required_pull_request_reviews") else "PARTIAL"
            bp_detail = f"PR reviews required: {bool(p.get('required_pull_request_reviews'))}"
        elif rc in (403, 404):
            bp_status = "SKIPPED"
            bp_detail = f"gh api returned {rc} (scope/repo)"
    elif not repo:
        bp_status, bp_detail = "SKIPPED", "pass --repo OWNER/NAME for branch-protection check"
    if total and pct < 50.0:
        overall = "FAIL"
    elif pct >= 80.0 and bp_status in ("PASS", "UNKNOWN", "SKIPPED"):
        overall = "PASS"
    else:
        overall = "PARTIAL"
    return Evidence("CC6", SOC2_CONTROLS["CC6"]["title"], overall,
                    f"signed commits: {signed}/{total} ({pct:.1f}%) over 90d; "
                    f"branch protection: {bp_status}",
                    metrics={"signed": signed, "total": total, "signed_pct": pct},
                    artifacts=[bp_detail],
                    remediation="" if overall == "PASS" else
                    "require signed commits on default branch via branch protection")


def cc7(root: Path) -> Evidence:
    wf = root / ".github" / "workflows"
    otel_n = 0
    if wf.is_dir():
        for yml in wf.glob("*.y*ml"):
            t = read_text(yml).lower()
            if "otel" in t or "opentelemetry" in t:
                otel_n += 1
    has_dash = (root / "dashboards").is_dir()
    status = "PASS" if otel_n >= 1 and has_dash else "PARTIAL"
    if otel_n == 0:
        status = "FAIL"
    return Evidence("CC7", SOC2_CONTROLS["CC7"]["title"], status,
                    f"OTel workflows: {otel_n}, dashboards/: {has_dash}",
                    metrics={"otel_workflows": otel_n},
                    remediation="" if status == "PASS" else
                    "add ≥1 OTel-instrumented workflow + dashboards/ directory")


def cc8(root: Path, since: str) -> Evidence:
    locks = {n: f_exists(root / n) for n in
             ("Cargo.lock", "go.sum", "package-lock.json", "poetry.lock", "Pipfile.lock")}
    pinned = sum(locks.values())
    rc, out, _ = run(["git", "log", f"--since={since}",
                      "--pretty=%s", "-n", "200"], cwd=root)
    conv_n, total = 0, 0
    cre = re.compile(
        r"^(feat|fix|chore|docs|refactor|test|build|ci|perf|style|revert)"
        r"(\([^)]+\))?!?:")
    if rc == 0 and out:
        for line in out.strip().splitlines():
            total += 1
            if cre.match(line.strip()):
                conv_n += 1
    pct = (conv_n / total * 100.0) if total else 0.0
    status = "PARTIAL"
    if pinned >= 2 and pct >= 70.0:
        status = "PASS"
    elif pinned == 0 or pct < 30.0:
        status = "FAIL"
    return Evidence("CC8", SOC2_CONTROLS["CC8"]["title"], status,
                    f"lockfiles: {pinned}/{len(locks)}, conventional commits: "
                    f"{conv_n}/{total} ({pct:.1f}%) since {since}",
                    metrics={"pinned": pinned, "conventional_pct": pct},
                    artifacts=[k for k, v in locks.items() if v],
                    remediation="" if status == "PASS" else
                    "commit lockfiles + adopt Conventional Commits in PR titles")


def cc9(root: Path) -> Evidence:
    truff = f_exists(root / "trufflehog.yml")
    sec_wf = False
    wf = root / ".github" / "workflows"
    if wf.is_dir():
        for yml in wf.glob("*.y*ml"):
            if "audit" in read_text(yml).lower():
                sec_wf = True
                break
    sbom = any(f_exists(root / p) for p in
               ("sbom/sbom.spdx.json", "sbom/sbom.cdx.json", ".slsa/attestation.json"))
    score = sum([truff, sec_wf, sbom])
    status = "PASS" if score >= 2 else ("PARTIAL" if score >= 1 else "FAIL")
    return Evidence("CC9", SOC2_CONTROLS["CC9"]["title"], status,
                    f"trufflehog: {truff}, security wf: {sec_wf}, SBOM/attestation: {sbom}",
                    metrics={"score": score},
                    remediation="" if status == "PASS" else
                    "add trufflehog.yml + ≥1 security-audit workflow + commit SBOM/attestation")


# ---------- report ---------------------------------------------------------


def render_markdown(b: dict[str, Any]) -> str:
    s = b["summary"]
    head = [
        f"# SOC2 Evidence Bundle — {b['generated_at']}",
        "",
        f"Repo: `{b['repo']}`  |  Scope: `{b['since']}`",
        "",
        f"**Posture:** {s['pass']} PASS · {s['partial']} PARTIAL · "
        f"{s['fail']} FAIL · {s['skipped']} SKIPPED (total {s['total']})",
        "",
        "| Control | Title | Status | Summary |",
        "|---|---|---|---|",
    ]
    for ev in b["evidence"]:
        head.append(f"| {ev['control']} | {ev['title']} | {ev['status']} | "
                    f"{ev['summary'].replace('|', '\\|')} |")
    head += ["", "## Per-control detail"]
    body: list[str] = []
    for ev in b["evidence"]:
        body += ["", f"### {ev['control']} — {ev['title']}  *({ev['status']})*",
                 "", f"- **Summary:** {ev['summary']}"]
        if ev["artifacts"]:
            body.append("- **Artifacts / evidence:**")
            for a in ev["artifacts"]:
                body.append(f"  - `{a}`")
        if ev["metrics"]:
            body.append(f"- **Metrics:** `{json.dumps(ev['metrics'], sort_keys=True)}`")
        if ev["remediation"]:
            body.append(f"- **Remediation:** {ev['remediation']}")
    body.append("")
    return "\n".join(head + body)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="SOC2 Type II evidence collector (CC1-CC9).")
    p.add_argument("--root", default=".", help="repo root (default: cwd)")
    p.add_argument("--out-dir", default="findings/soc2", help="output dir")
    p.add_argument("--repo", default=None,
                   help="GitHub OWNER/NAME for branch-protection")
    p.add_argument("--since", default="90 days ago", help="git log window")
    p.add_argument("--dry-run", action="store_true", help="parse-only mode")
    a = p.parse_args(argv)

    root = Path(a.root).resolve()
    if not (root / ".git").exists():
        print(f"error: {root} is not a git repo", file=sys.stderr)
        return 2
    if a.dry_run:
        print(f"[dry-run] would collect CC1-CC9 evidence from {root}")
        for cid, meta in SOC2_CONTROLS.items():
            print(f"[dry-run]   {cid}: {meta['title']}")
        return 0

    evs = [cc1(root), cc2(root), cc3(root), cc4(root), cc5(root),
           cc6(root, a.repo, a.dry_run), cc7(root), cc8(root, a.since), cc9(root)]
    counts = {"pass": 0, "partial": 0, "fail": 0, "skipped": 0, "total": len(evs)}
    for ev in evs:
        counts[ev.status.lower()] = counts.get(ev.status.lower(), 0) + 1

    bundle = {
        "generated_at": now_iso(),
        "repo": a.repo or "(local-only)",
        "since": a.since,
        "summary": counts,
        "evidence": [asdict(e) for e in evs],
    }
    out = root / a.out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / "evidence.json").write_text(
        json.dumps(bundle, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (out / "evidence.md").write_text(render_markdown(bundle), encoding="utf-8")

    print(f"wrote {out/'evidence.json'}")
    print(f"wrote {out/'evidence.md'}")
    print(f"posture: {counts['pass']} PASS · {counts['partial']} PARTIAL · "
          f"{counts['fail']} FAIL · {counts['skipped']} SKIPPED")
    return 1 if counts["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
