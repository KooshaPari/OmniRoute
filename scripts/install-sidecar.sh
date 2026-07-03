#!/usr/bin/env bash
# Install sharecli as a background sidecar service.
# Usage: ./scripts/install-sidecar.sh [--uninstall]
set -euo pipefail

BINARY="sharecli"
SERVICE_NAME="com.phenotype.sharecli"

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      echo "unsupported" ;;
  esac
}

install_macos() {
  local bin_path
  bin_path="$(which "$BINARY" 2>/dev/null || echo "")"
  if [[ -z "$bin_path" ]]; then
    echo "Error: '$BINARY' not found in PATH. Run 'cargo install --path .' first." >&2
    exit 1
  fi

  local plist_path="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
  cat > "$plist_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bin_path}</string>
    <string>fleet</string>
    <string>status</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${HOME}/.sharecli/sidecar.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/.sharecli/sidecar.err</string>
</dict>
</plist>
EOF
  launchctl load "$plist_path"
  echo "Installed and loaded: $plist_path"
}

uninstall_macos() {
  local plist_path="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
  launchctl unload "$plist_path" 2>/dev/null || true
  rm -f "$plist_path"
  echo "Uninstalled: $plist_path"
}

install_linux() {
  local bin_path
  bin_path="$(which "$BINARY" 2>/dev/null || echo "")"
  if [[ -z "$bin_path" ]]; then
    echo "Error: '$BINARY' not found in PATH. Run 'cargo install --path .' first." >&2
    exit 1
  fi

  local service_file="$HOME/.config/systemd/user/${SERVICE_NAME}.service"
  mkdir -p "$(dirname "$service_file")"
  cat > "$service_file" <<EOF
[Unit]
Description=sharecli fleet sidecar

[Service]
ExecStart=${bin_path} fleet status
Restart=no

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_NAME"
  echo "Installed: $service_file"
}

uninstall_linux() {
  systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "$HOME/.config/systemd/user/${SERVICE_NAME}.service"
  systemctl --user daemon-reload 2>/dev/null || true
  echo "Uninstalled: ${SERVICE_NAME}.service"
}

main() {
  local uninstall=false
  for arg in "$@"; do
    [[ "$arg" == "--uninstall" ]] && uninstall=true
  done

  local os
  os="$(detect_os)"
  case "$os" in
    macos)
      $uninstall && uninstall_macos || install_macos ;;
    linux)
      $uninstall && uninstall_linux || install_linux ;;
    *)
      echo "Error: unsupported OS '$(uname -s)'" >&2; exit 1 ;;
  esac
}

main "$@"
