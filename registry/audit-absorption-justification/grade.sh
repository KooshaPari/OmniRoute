#!/usr/bin/env bash
# grade.sh — Grade a single absorption-justification audit against the schema.
#
# Usage: grade.sh <audit.md>
#
# Emits JSON to stdout with shape:
#   { "name", "path", "score", "max", "percentage", "grade", "pillars": [
#       { "id": 1, "name": "...", "status": "pass|fail", "score": N, "max": N,
#         "detail": "..." }, ... ] }
#
# Pillar weights and grading rubric are loaded from
# schema.json in the same directory as this script.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA="${HERE}/schema.json"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <audit.md>" >&2
  exit 2
fi

AUDIT_PATH="$1"
if [[ ! -f "${AUDIT_PATH}" ]]; then
  echo "{\"error\":\"file not found: ${AUDIT_PATH}\"}"
  exit 1
fi

ABS_PATH="$(cd "$(dirname "${AUDIT_PATH}")" && pwd)"
AUDIT_NAME="$(basename "${AUDIT_PATH}")"
REPO_ROOT="$(cd "${ABS_PATH}/../.." && pwd)"
PROJECT_NAME="${AUDIT_NAME%-2026-*}"

PYTHON_BIN="${PYTHON_BIN:-python3}"
"${PYTHON_BIN}" - "${SCHEMA}" "${AUDIT_PATH}" "${AUDIT_NAME}" "${REPO_ROOT}" "${PROJECT_NAME}" <<'PYEOF'
import json
import os
import re
import sys

schema_path, audit_path, audit_name, repo_root, project_name = sys.argv[1:6]

try:
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)
except Exception as e:
    print(json.dumps({"error": f"schema load failed: {e}"}))
    sys.exit(0)

with open(audit_path, "r", encoding="utf-8") as f:
    text = f.read()


def has_section(text, name):
    pattern = re.compile(
        r"^#{2,6}\s+[" + re.escape("#*_ ") + r"]*" + re.escape(name) + r"\b",
        re.IGNORECASE | re.MULTILINE,
    )
    return pattern.search(text) is not None


def has_any_section(text, names):
    return any(has_section(text, n) for n in names)


def count_matches(text, regex):
    return len(re.findall(regex, text, re.IGNORECASE | re.MULTILINE))


pillars_out = []
total_score = 0
total_max = 0

for p in schema["pillars"]:
    pid = p["id"]
    name = p["name"]
    weight = p["weight"]
    status = "fail"
    detail = ""

    if pid == 1:
        mand = p.get("mandatory_sections", [])
        missing = [m for m in mand if not has_section(text, m)]
        if not missing:
            status = "pass"
            detail = f"all {len(mand)} mandatory sections present"
        else:
            detail = f"missing sections: {missing}"

    elif pid == 2:
        if not has_section(text, "ABSORPTION_MATRIX"):
            detail = "no ABSORPTION_MATRIX section"
        else:
            m = re.search(
                r"^##\s+ABSORPTION_MATRIX\s*$(.*?)(?=^##\s+|\Z)",
                text,
                re.IGNORECASE | re.MULTILINE | re.DOTALL,
            )
            mat = m.group(1) if m else ""
            rows = [r for r in mat.splitlines() if r.strip().startswith("|") and not re.match(r"^\|\s*---", r)]
            rows = [r for r in rows if not re.match(r"^\|\s*Source Item", r, re.IGNORECASE)]
            cite_re = re.compile(
                r"(?:[a-f0-9]{7,40}|https?://\S+|\.md|\.rs|\.go|\.py|\.sh|\.json|\.yml|\.toml|"
                r"\bL\d+\b|`[^`]+`)"
            )
            cited = sum(1 for r in rows if cite_re.search(r))
            total_rows = len(rows)
            if total_rows == 0:
                detail = "no matrix rows"
            elif cited >= max(1, total_rows // 2):
                status = "pass"
                detail = f"{cited}/{total_rows} rows with citations"
            else:
                detail = f"only {cited}/{total_rows} rows with citations"

    elif pid == 3:
        if has_section(text, "ABSORPTION_MATRIX") and has_section(text, "Restore-Command"):
            if has_any_section(text, ["Branch Inventory Summary", "BRANCH_INVENTORY"]):
                status = "pass"
                detail = "ABSORPTION_MATRIX + Restore-Command + branch inventory present"
            else:
                status = "pass"
                detail = "ABSORPTION_MATRIX + Restore-Command present"
        else:
            detail = "missing ABSORPTION_MATRIX or Restore-Command"

    elif pid == 4:
        if not has_section(text, "Last-Resort-Exceptions"):
            detail = "no Last-Resort-Exceptions section"
        else:
            m = re.search(
                r"^##\s+Last-Resort-Exceptions\s*$(.*?)(?=^##\s+|\Z)",
                text,
                re.IGNORECASE | re.MULTILINE | re.DOTALL,
            )
            body = m.group(1).lower() if m else ""
            rebut = count_matches(body, r"rebutt")
            sub_q_hits = sum(
                1
                for kw in [
                    r"cannot absorb",
                    r"residual",
                    r"gap",
                    r"archiv",
                    r"bundle",
                    r"sha-?256",
                    r"re-?clone",
                ]
                if re.search(kw, body)
            )
            if rebut >= 1 and sub_q_hits >= 2:
                status = "pass"
                detail = f"{rebut} rebuttal markers, {sub_q_hits} sub-question coverage"
            else:
                detail = f"insufficient rebuttal: {rebut} markers, {sub_q_hits} sub-q hits"

    elif pid == 5:
        if not has_section(text, "Restore-Command"):
            detail = "no Restore-Command section"
        else:
            m = re.search(
                r"^##\s+Restore-Command\s*$(.*?)(?=^##\s+|\Z)",
                text,
                re.IGNORECASE | re.MULTILINE | re.DOTALL,
            )
            body = m.group(1) if m else ""
            has_mv = bool(re.search(r"\bmv\b.*\.archive", body, re.IGNORECASE))
            has_clone = bool(re.search(r"git\s+clone", body, re.IGNORECASE))
            has_sha = bool(re.search(r"sha-?256", body, re.IGNORECASE))
            if (has_mv or has_clone) and (has_sha or "sha-256" in body.lower()):
                status = "pass"
                detail = f"mv={has_mv} clone={has_clone} sha={has_sha}"
            elif has_clone:
                status = "pass"
                detail = "git clone + bundle path present (sha recorded at runtime)"
            elif has_mv:
                status = "pass"
                detail = "mv .archive/ local restore present"
            else:
                detail = "no verifiable restore mechanism"

    elif pid == 6:
        candidates = [
            os.path.join(repo_root, "projects", f"{project_name}.json"),
            os.path.join(repo_root, "registry", "projects", f"{project_name}.json"),
        ]
        found = None
        for c in candidates:
            if os.path.isfile(c):
                found = c
                break
        if not found:
            detail = f"no project card at {candidates[0]} or {candidates[1]}"
        else:
            try:
                with open(found, "r", encoding="utf-8") as cf:
                    card = json.load(cf)
                status_v = card.get("status", "")
                disp = card.get("disposition", "")
                absorbed = card.get("absorbed_into", "")
                ok_status = status_v in ("archived", "active")
                ok_disp = disp in ("AFFIRM", "ARCHIVE_ONLY")
                if (ok_status and (absorbed or ok_disp)) or ok_disp:
                    status = "pass"
                    detail = (
                        f"card={os.path.basename(found)} status={status_v} "
                        f"disposition={disp} absorbed_into={absorbed}"
                    )
                else:
                    detail = (
                        f"card found but incomplete: status={status_v} "
                        f"disposition={disp} absorbed_into={absorbed}"
                    )
            except Exception as e:
                detail = f"card parse error: {e}"

    elif pid == 7:
        has_sh = bool(re.search(r"repo-delete-gate\.sh", text))
        has_ps1 = bool(re.search(r"repo-delete-gate\.ps1", text))
        has_justification = bool(
            re.search(
                r"gate\s+(not\s+required|already\s+enforced|not\s+needed)",
                text,
                re.IGNORECASE,
            )
        ) or bool(
            re.search(
                r"explicitly\s+explains\s+why\s+the\s+gate\s+is\s+not\s+required",
                text,
                re.IGNORECASE,
            )
        )
        if has_sh or has_ps1:
            status = "pass"
            detail = f"references repo-delete-gate (sh={has_sh}, ps1={has_ps1})"
        elif has_justification:
            status = "pass"
            detail = "gate-not-required justification present"
        else:
            detail = "no repo-delete-gate reference or justification"

    pillar_score = weight if status == "pass" else 0
    total_score += pillar_score
    total_max += weight
    pillars_out.append(
        {
            "id": pid,
            "name": name,
            "status": status,
            "score": pillar_score,
            "max": weight,
            "detail": detail,
        }
    )

percentage = round(100.0 * total_score / total_max, 2) if total_max else 0.0
grade = "L0"
for gb in schema.get("grade_boundaries", []):
    if gb["min"] <= total_score <= gb["max"]:
        grade = gb["grade"]
        break

result = {
    "name": audit_name,
    "path": audit_path,
    "score": total_score,
    "max": total_max,
    "percentage": percentage,
    "grade": grade,
    "pillars": pillars_out,
}
print(json.dumps(result, indent=2))
PYEOF