#!/bin/bash
# Wrapper to run ADR quality lint in CI
set -euo pipefail
python3 .githooks/adr-quality-lint.py
