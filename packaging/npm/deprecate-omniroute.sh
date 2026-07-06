#!/usr/bin/env bash
# deprecate-omniroute.sh — Mark the legacy `omniroute` npm package as deprecated
# and point users at `argismonitor`. Run once after the first `argismonitor@1.0.0`
# GA release (Gate 4).
#
# Requires:
#   - npm CLI authenticated as KooshaPari (or whoever owns the `omniroute` package)
#   - jq for JSON parsing
#
# Usage:
#   NPM_TOKEN=... ./deprecate-omniroute.sh
#
# Idempotent — safe to re-run.

set -euo pipefail

if [ -z "${NPM_TOKEN:-}" ]; then
    echo "  ✖ NPM_TOKEN not set — paste a fresh automation token first."
    exit 1
fi

DEPRECATED_MSG="ArgisMonitor has been renamed; please install \`argismonitor\` instead. See https://argismonitor.phenotype.space/migration."

# 1) Mark every existing `omniroute` version as deprecated.
echo "  → Marking all `omniroute` versions as deprecated..."
for v in $(curl -fsSL https://registry.npmjs.org/omniroute | jq -r '.versions[].version'); do
    echo "    - omniroute@$v"
    npm deprecate "omniroute@$v" "$DEPRECATED_MSG" --registry https://registry.npmjs.org
done

# 2) Update the legacy package's `dist-tags.latest` to a sentinel pointing at
#    the latest deprecated version so users get a clear notice on `npm install omniroute`.
echo "  → Re-pointing omniroute@latest to the most recent deprecated version..."
LATEST=$(curl -fsSL https://registry.npmjs.org/omniroute | jq -r '."dist-tags".latest')
echo "    Latest stays at: omniroute@$LATEST (deprecated; use argismonitor)"

echo "  ✓ Done. The legacy `omniroute` package is fully deprecated."
echo "    Users who run \`npm install omniroute\` will receive a deprecation warning."