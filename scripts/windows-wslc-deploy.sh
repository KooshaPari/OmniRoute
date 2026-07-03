#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

host="${OMNIROUTE_WINDOWS_HOST:-desk}"
remote_user="${OMNIROUTE_WINDOWS_USER:-koosh}"
remote_root="${OMNIROUTE_WINDOWS_ROOT:-C:/Users/${remote_user}/omniroute-wsl}"
image_name="${OMNIROUTE_WINDOWS_IMAGE:-omniroute:wsl}"
container_name="${OMNIROUTE_WINDOWS_CONTAINER:-omniroute-wsl}"
host_port="${OMNIROUTE_WINDOWS_PORT:-20128}"
archive_path="/tmp/omniroute-wsl-runtime-context.tgz"
remote_archive="${remote_root}/runtime-context.tgz"
remote_script="${remote_root}/deploy.ps1"

rm -f "${archive_path}"
tar -C "${repo_root}" -czf "${archive_path}" \
  --exclude=.git \
  --exclude=.github \
  --exclude=.next \
  --exclude=.build \
  --exclude=node_modules \
  --exclude=coverage \
  --exclude=dist \
  --exclude=tmp \
  --exclude=temp \
  --exclude='*.log' \
  --exclude='data/*' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='docker-compose*.override.yml' \
  .

ssh -o BatchMode=yes "${host}" \
  "powershell -NoProfile -Command \"New-Item -ItemType Directory -Force '${remote_root}' | Out-Null\""

scp -o BatchMode=yes "${archive_path}" "${host}:${remote_archive}"

deploy_script="$(mktemp)"
cat >"${deploy_script}" <<PS1
\$ErrorActionPreference = 'Stop'
\$RemoteRoot = '${remote_root}'
\$ImageName = '${image_name}'
\$ContainerName = '${container_name}'
\$HostPort = '${host_port}'
\$Archive = '${remote_archive}'
\$ContextDir = Join-Path \$RemoteRoot 'repo'

Remove-Item -Recurse -Force \$ContextDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force \$ContextDir | Out-Null
tar -xzf \$Archive -C \$ContextDir

Set-Location \$ContextDir

\$ErrorActionPreference = 'Continue'
wslc stop \$ContainerName 2>\$null | Out-Null
wslc rm \$ContainerName 2>\$null | Out-Null
\$ErrorActionPreference = 'Stop'

wslc build -t \$ImageName .
wslc run -d --name \$ContainerName -p "127.0.0.1:\${HostPort}:20128" \$ImageName | Out-Null

Start-Sleep -Seconds 5
\$health = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:\${HostPort}/v1/models"
Write-Output \$health.StatusCode
wslc list
PS1

scp -o BatchMode=yes "${deploy_script}" "${host}:${remote_script}"
rm -f "${deploy_script}"

ssh -o BatchMode=yes "${host}" \
  "powershell -NoProfile -ExecutionPolicy Bypass -File '${remote_script}'"

