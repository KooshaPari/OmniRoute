#!/usr/bin/env bash
set -euo pipefail
# v35 3e-Embed T3: Embed .lfs-audit config in every fleet repo.
REPO_ROOT="${1:-.}"
for dir in "$REPO_ROOT"/*/; do
  if [ -d "$dir/.github" ]; then
    cfg="$dir/.lfs-audit.yaml"
    if [ ! -f "$cfg" ]; then
      echo "EMBED LFS-audit: $dir"
      cat > "$cfg" <<+CONF+
max_file_size: "1MB"
extensions:
  - ".mp4"
  - ".mov"
  - ".zip"
  - ".tar.gz"
tracked_in_lfs: true
+CONF+
    fi
  fi
done
echo "T3 LFS-audit embed: complete"
