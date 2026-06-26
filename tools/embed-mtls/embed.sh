#!/usr/bin/env bash
set -euo pipefail
# v35 3e-Embed T2: Embed mTLS config.toml in every fleet repo.
REPO_ROOT="${1:-.}"
for dir in "$REPO_ROOT"/*/; do
  if [ -d "$dir/.github" ]; then
    cfg="$dir/mtls-fleet.toml"
    if [ ! -f "$cfg" ]; then
      echo "EMBED mTLS: $dir"
      cat > "$cfg" <<+CONF+
[fleet]
name = "${dir%/}"
mtls_enabled = true
cert_rotation_days = 90
ca_cert_path = "certs/ca.pem"
+CONF+
    fi
  fi
done
echo "T2 mTLS embed: complete"
