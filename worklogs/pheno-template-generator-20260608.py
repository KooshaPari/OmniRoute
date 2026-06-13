#!/usr/bin/env python3
"""pheno-template-generator-20260608.py — emit the Phenotype Org + AgilePlus
file skeleton for a new repo."""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path
from datetime import date

LICENSE_MIT = """MIT License

Copyright (c) {year} {owner}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

README = """# {name}

> {tagline}

## Overview

{name} is part of the Phenotype Org + AgilePlus ecosystem.

## Install
```bash
# add install instructions
```
## Usage
```bash
# add usage examples
```
## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md). All work is tracked in AgilePlus.
## License
MIT — see [LICENSE](./LICENSE).
"""

CONTRIBUTING = """# Contributing to {name}

## 1. Code of Conduct
This project follows the [Contributor Covenant v2.1](./CODE_OF_CONDUCT.md).
## 2. Development Setup
Clone the repository and follow the install steps in [README.md](./README.md).
## 3. Workflow
All work is tracked in AgilePlus. Open a spec:
```bash
agileplus specify --title "<feature>" --description "<desc>"
```
## 4. Pull Requests
- One change per PR.
- Include tests and updated docs.
- Reference the AgilePlus spec ID in the PR body.
## 5. Reporting Issues
Use the [bug report](./.github/ISSUE_TEMPLATE/bug_report.md) or
[feature request](./.github/ISSUE_TEMPLATE/feature_request.md) templates.
"""

SECURITY = """# Security Policy

## Supported Versions
The latest minor release receives security updates.

## Reporting a Vulnerability
Email security@{owner_lower}.example.com or open a private advisory via
GitHub Security Advisories. Do not file public issues for vulnerabilities.
"""

CODEOWNERS = """# Default code owners
*       @{owner}
"""

COC = """# Contributor Covenant Code of Conduct v2.1

## Our Pledge
We pledge to make participation in our community a welcoming and inclusive
experience for everyone.

## Our Standards
Examples of behavior that contributes to a positive environment include:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

## Enforcement
Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the project team at conduct@{owner_lower}.example.com.
"""

FUNDING = """github: [{owner}]
"""

CHANGELOG = """# Changelog

All notable changes to {name} are documented in this file.

## [{version}] - {date}
### Added
- Initial scaffold.
"""

PR_TEMPLATE = """## Summary
<!-- describe the change -->
## AgilePlus Spec
<!-- spec-id -->
## Test Plan
- [ ] Unit tests added/updated
- [ ] Docs updated
- [ ] CI passes locally
"""

BUG_TEMPLATE = """---
name: Bug report
about: Report a defect
title: "bug: "
labels: bug
---
## Summary
## Reproduction
1.
2.
3.
## Expected
## Actual
## Environment
- Version:
- OS:
"""

FEATURE_TEMPLATE = """---
name: Feature request
about: Propose a new feature
title: "feat: "
labels: enhancement
---
## Problem
## Proposed Solution
## Alternatives
## AgilePlus Spec
<!-- spec-id -->
"""

DEPENDABOT = """version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 5
"""

RENOVATE = """{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "schedule": ["before 6am on monday"],
  "automerge": false,
}
"""

RELEASE_DRAFTER = """name-template: "v$RESOLVED_VERSION"
tag-template: "v$RESOLVED_VERSION"
version-resolver:
  major:
    labels: ["breaking"]
  minor:
    labels: ["feature"]
  patch:
    labels: ["fix", "chore"]
categories:
  - title: "Breaking"
    labels: ["breaking"]
  - title: "Features"
    labels: ["feature"]
  - title: "Fixes"
    labels: ["fix"]
template: |
  ## Changes
  $CHANGES
"""

CI = """name: ci
on: { push: { branches: [main] }, pull_request: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run quality gate
        run: echo "add quality gate"
"""

SCORECARD = """name: scorecard
on: { push: { branches: [main] } }
permissions: { security-events: write }
jobs:
  analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ossf/scorecard-action@v2
        with: { results_file: results.sarif, results_format: sarif }
      - uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: results.sarif }
"""

HEALTH = """name: health
on:
  schedule: [{ cron: "0 6 * * 1" }]
  workflow_dispatch: {}
jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Health snapshot
        run: echo "snapshot generated"
"""

SPEC = """# SPEC — {name}

## Status: draft
## Problem
## Goals
## Non-Goals
## Design
## Acceptance Criteria
"""

WORKLOGS_README = """# Worklogs

Cross-repo research, decisions, and findings are tracked here.
See `~/.claude/references/WORKLOG_GOVERNANCE.md` for the full taxonomy.
"""

FILES: list[tuple[str, str]] = [
    ("LICENSE", LICENSE_MIT),
    ("README.md", README),
    ("CONTRIBUTING.md", CONTRIBUTING),
    ("SECURITY.md", SECURITY),
    ("CODEOWNERS", CODEOWNERS),
    ("CODE_OF_CONDUCT.md", COC),
    (".github/FUNDING.yml", FUNDING),
    ("CHANGELOG.md", CHANGELOG),
    (".github/PULL_REQUEST_TEMPLATE.md", PR_TEMPLATE),
    (".github/ISSUE_TEMPLATE/bug_report.md", BUG_TEMPLATE),
    (".github/ISSUE_TEMPLATE/feature_request.md", FEATURE_TEMPLATE),
    (".github/dependabot.yml", DEPENDABOT),
    ("renovate.json5", RENOVATE),
    (".github/release-drafter.yml", RELEASE_DRAFTER),
    (".github/workflows/ci.yml", CI),
    (".github/workflows/scorecard.yml", SCORECARD),
    (".github/workflows/health.yml", HEALTH),
    ("SPEC.md", SPEC),
    ("worklogs/README.md", WORKLOGS_README),
]


def render(template: str, ctx: dict[str, str]) -> str:
    # Keep {name} placeholders, escape every other { or } so str.format()
    # does not choke on JSON/JS/CRON braces in templates.
    pattern = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")
    out: list[str] = []
    last = 0
    for m in pattern.finditer(template):
        out.append(template[last:m.start()].replace("{", "\x00L\x00").replace("}", "\x00R\x00"))
        out.append(m.group(0))
        last = m.end()
    out.append(template[last:].replace("{", "\x00L\x00").replace("}", "\x00R\x00"))
    return "".join(out).format(**ctx).replace("\x00L\x00", "{").replace("\x00R\x00", "}")


def generate(target: Path, repo_name: str, owner: str) -> int:
    ctx = {
        "name": repo_name,
        "repo_name": repo_name,
        "owner": owner,
        "owner_lower": owner.lower(),
        "year": str(date.today().year),
        "date": str(date.today()),
        "version": "0.1.0",
        "tagline": f"{repo_name} — Phenotype Org + AgilePlus scaffold",
    }
    written = 0
    for rel, tpl in FILES:
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(render(tpl, ctx), encoding="utf-8")
        written += 1
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, help="Target directory")
    parser.add_argument("--repo-name", default=None, help="Repo name (default: target dir basename)")
    parser.add_argument("--owner", default="KooshaPari", help="GitHub owner / code owner")
    args = parser.parse_args()
    repo_name = args.repo_name or args.target.name
    target = args.target.expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    count = generate(target, repo_name, args.owner)
    print(f"wrote {count} files under {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
