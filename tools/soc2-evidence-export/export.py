"""SOC2 evidence export tool — fleet-wide compliance package generator.

Pillar L54 (SOC2 evidence export automation) — cycle-16 P1 T2.
Reads evidence collected by scripts/soc2-evidence-collector.py and emits
an audit-ready bundle (JSON + CSV + Markdown) suitable for upload to
Vanta, Drata, Tugboat Logic, or Secureframe.

Outputs a single .zip containing:
- evidence.json — raw fleet evidence (controls × repos matrix)
- evidence.csv — flattened to (repo, control, satisfied, artifact, sha256)
- summary.md — Markdown table for human auditors
- audit-trail.txt — provenance: collector run, git ref, timestamp
- missing-controls.csv — repos × controls that need remediation

Usage:
    python3 tools/soc2-evidence-export/export.py \
        --input evidence/2026-06-23-fleet.json \
        --output-dir exports/$(date +%F)
    python3 tools/soc2-evidence-export/export.py --help
"""
from __future__ import annotations

import argparse
import csv
import datetime as _dt
import hashlib
import io
import json
import os
import sys
import zipfile
from pathlib import Path
from typing import Any

SOC2_FRAMEWORK = "SOC2-Type-II-2017"
SCHEMA_VERSION = "1.0"

CONTROL_FAMILIES = {
    "CC1": "Control Environment",
    "CC2": "Information and Communication",
    "CC3": "Risk Assessment",
    "CC5": "Control Activities",
    "CC6": "Logical and Physical Access",
    "CC7": "System Operations",
    "CC8": "Change Management",
    "CC9": "Risk Mitigation",
}

REMEDIATION_PRIORITY = {
    "CC6": "P0",  # Access controls — highest
    "CC7": "P0",  # System ops — high
    "CC8": "P1",  # Change mgmt — medium
    "CC5": "P1",
    "CC3": "P2",
    "CC2": "P2",
    "CC1": "P3",
    "CC9": "P2",
}


def _family(control_id: str) -> str:
    return control_id.split(".")[0] if "." in control_id else control_id


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def _sha256_file(p: Path) -> str:
    if not p.exists() or not p.is_file():
        return ""
    h = hashlib.sha256()
    h.update(p.read_bytes())
    return h.hexdigest()


def load_evidence(input_path: Path) -> dict:
    """Load evidence JSON. Accepts either the standard collector output or a
    raw dict with a 'fleet' key."""
    raw = json.loads(input_path.read_text())
    if "fleet" not in raw:
        raise ValueError(f"input {input_path} missing 'fleet' key")
    return raw


def emit_csv(evidence: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "repo", "control_id", "control_name", "family",
        "satisfied", "artifact", "artifact_sha256_12",
        "git_head", "git_branch", "collected_at",
    ])
    for entry in evidence["fleet"]:
        repo = entry["repo"]
        for c in entry["controls"]:
            writer.writerow([
                repo,
                c["control_id"],
                c.get("control_name", ""),
                _family(c["control_id"]),
                "Y" if c.get("satisfied") else "N",
                c.get("artifact") or "",
                c.get("artifact_sha256_12") or "",
                c.get("git_head") or "",
                c.get("git_branch") or "",
                c.get("collected_at") or "",
            ])
    return buf.getvalue()


def emit_summary_md(evidence: dict) -> str:
    lines: list[str] = [
        f"# SOC2 Evidence Summary — {evidence.get('generated_at', _now())}",
        "",
        f"**Framework:** {evidence.get('framework', SOC2_FRAMEWORK)}  ",
        f"**Repos:** {len(evidence['fleet'])}  ",
        f"**Controls:** {len(evidence.get('controls', []))}",
        "",
        "## Coverage Matrix",
        "",
        "| Repo | " + " | ".join(c["id"] for c in evidence.get("controls", [])) + " |",
        "|---" + "|---" * len(evidence.get("controls", [])),
    ]
    for entry in evidence["fleet"]:
        cells = []
        for c in entry["controls"]:
            cells.append("Y" if c.get("satisfied") else ".")
        lines.append(f"| {entry['repo']} | " + " | ".join(cells) + " |")
    satisfied = sum(
        1 for e in evidence["fleet"]
        for c in e["controls"]
        if c.get("satisfied")
    )
    total = sum(len(e["controls"]) for e in evidence["fleet"])
    pct = 100.0 * satisfied / total if total else 0.0
    lines.append("")
    lines.append(f"## Fleet Coverage: {satisfied}/{total} ({pct:.1f}%)")
    lines.append("")

    lines.append("## Coverage by Family")
    family_totals: dict[str, list[int]] = {}
    for e in evidence["fleet"]:
        for c in e["controls"]:
            fam = _family(c["control_id"])
            family_totals.setdefault(fam, [0, 0])
            family_totals[fam][1] += 1
            if c.get("satisfied"):
                family_totals[fam][0] += 1
    lines.append("")
    lines.append("| Family | Description | Coverage | Priority |")
    lines.append("|---|---|---|---|")
    for fam in sorted(family_totals):
        sat, tot = family_totals[fam]
        f_pct = 100.0 * sat / tot if tot else 0.0
        prio = REMEDIATION_PRIORITY.get(fam, "P3")
        lines.append(
            f"| {fam} | {CONTROL_FAMILIES.get(fam, '?')} | "
            f"{sat}/{tot} ({f_pct:.0f}%) | {prio} |"
        )
    return "\n".join(lines) + "\n"


def emit_missing_csv(evidence: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "control_id", "family", "priority",
        "repo", "git_branch", "collected_at",
    ])
    for entry in evidence["fleet"]:
        repo = entry["repo"]
        for c in entry["controls"]:
            if c.get("satisfied"):
                continue
            cid = c["control_id"]
            writer.writerow([
                cid,
                _family(cid),
                REMEDIATION_PRIORITY.get(_family(cid), "P3"),
                repo,
                c.get("git_branch") or "",
                c.get("collected_at") or "",
            ])
    return buf.getvalue()


def emit_audit_trail(input_path: Path, evidence: dict) -> str:
    input_sha = _sha256_file(input_path)
    lines = [
        "SOC2 Evidence Export — Audit Trail",
        "",
        f"Exported at: {_now()}",
        f"Input file: {input_path}",
        f"Input sha256: {input_sha}",
        f"Schema version: {SCHEMA_VERSION}",
        f"Framework: {evidence.get('framework', SOC2_FRAMEWORK)}",
        f"Repos in evidence: {len(evidence['fleet'])}",
        f"Controls in evidence: {len(evidence.get('controls', []))}",
        "",
        "Per-repo git head refs at time of evidence collection:",
        "",
    ]
    seen: set[str] = set()
    for e in evidence["fleet"]:
        head = e.get("controls", [{}])[0].get("git_head", "")
        if head and head not in seen:
            seen.add(head)
            lines.append(f"  - {head}")
    return "\n".join(lines) + "\n"


def build_bundle(
    evidence: dict,
    input_path: Path,
    output_dir: Path,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_text = emit_csv(evidence)
    md_text = emit_summary_md(evidence)
    miss_text = emit_missing_csv(evidence)
    trail_text = emit_audit_trail(input_path, evidence)
    raw_json = json.dumps(evidence, indent=2, sort_keys=True)
    zip_path = output_dir / "soc2-evidence-bundle.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("evidence.json", raw_json)
        z.writestr("evidence.csv", csv_text)
        z.writestr("summary.md", md_text)
        z.writestr("missing-controls.csv", miss_text)
        z.writestr("audit-trail.txt", trail_text)
        z.writestr("README.txt",
                   "SOC2 evidence bundle — see summary.md for overview, "
                   "evidence.csv for raw data, audit-trail.txt for "
                   "provenance. Upload to Vanta/Drata as custom connector.\n")
    return zip_path


def main() -> int:
    ap = argparse.ArgumentParser(description="SOC2 evidence export bundler")
    ap.add_argument("--input", "-i", required=True, type=Path,
                    help="Path to evidence JSON from soc2-evidence-collector.py")
    ap.add_argument("--output-dir", "-o", type=Path,
                    default=Path("exports") / _dt.date.today().isoformat(),
                    help="Output directory (default: exports/<date>)")
    ap.add_argument("--summary-only", action="store_true",
                    help="Print summary to stdout instead of writing bundle")
    args = ap.parse_args()
    if not args.input.exists():
        print(f"input not found: {args.input}", file=sys.stderr)
        return 2
    evidence = load_evidence(args.input)
    if args.summary_only:
        sys.stdout.write(emit_summary_md(evidence))
        return 0
    bundle = build_bundle(evidence, args.input, args.output_dir)
    print(f"wrote bundle: {bundle} ({bundle.stat().st_size} bytes)",
          file=sys.stderr)
    print(f"sha256: {_sha256_file(bundle)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())