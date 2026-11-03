#!/usr/bin/env bash
set -euo pipefail
script="$(cd "$(dirname "$0")/../.." && pwd)/bin/restore-data.sh"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"; rm -f -- "$fixture.out"' EXIT
mkdir -p "$fixture/data" "$fixture/snapshot"
for name in storage.sqlite storage.sqlite-wal storage.sqlite-shm storage.sqlite-journal other.sqlite; do printf "%s" "$name" > "$fixture/data/$name"; done
printf candidate > "$fixture/snapshot/storage.sqlite"
before="$(find "$fixture" -type f -exec sha256sum {} + | sort)"
if bash "$script" "$fixture/snapshot" --data-dir "$fixture/data" --yes >"$fixture.out" 2>&1; then echo "restore unexpectedly succeeded" >&2; exit 1; fi
grep -q "Restore is unavailable" "$fixture.out"
after="$(find "$fixture" -type f -exec sha256sum {} + | sort)"
[ "$before" = "$after" ]
bash "$script" --help | grep -q "Restore is currently unavailable"
rm -f -- "$fixture.out"
echo "restore refusal and file preservation passed"
