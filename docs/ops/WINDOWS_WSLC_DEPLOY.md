# Windows Desktop / WSLC Native OCI

OmniRoute production deploys to the Windows desktop should use Tailscale plus
OpenSSH to reach the host, and `wslc.exe` as the native OCI runtime.

This avoids depending on Apple preview `container build` as the critical
production build path for large images.

## Prerequisites on the Windows host

```powershell
wsl --update --pre-release
wslc --help
```

The Windows host must be reachable over OpenSSH, ideally through the Tailscale
host alias you already use for the desktop, for example `desk`.

## Deploy from the Mac

```bash
scripts/windows-wslc-deploy.sh
```

Defaults:

```text
host:      desk
root:      C:/Users/koosh/omniroute-wsl
runtime:   wslc.exe
image:     omniroute:wsl
container: omniroute-wsl
health:    http://127.0.0.1:20128/v1/models
```

Override any of them with environment variables:

```bash
OMNIROUTE_WINDOWS_HOST=desk \
OMNIROUTE_WINDOWS_USER=koosh \
OMNIROUTE_WINDOWS_ROOT='C:/Users/koosh/omniroute-wsl' \
OMNIROUTE_WINDOWS_IMAGE='omniroute:wsl' \
OMNIROUTE_WINDOWS_CONTAINER='omniroute-wsl' \
OMNIROUTE_WINDOWS_PORT=20128 \
scripts/windows-wslc-deploy.sh
```

## Transfer model

No SFTP-specific workflow is required at this stage. The deploy script uses
plain `scp` over OpenSSH to ship a bounded source archive, then runs `wslc
build` and `wslc run` on the Windows side.

## Why this is the canonical Windows path

- Local Apple native OCI remains useful for runtime proof.
- Large image builds are currently less stable on the Apple preview builder.
- The Windows desktop is the intended production surface, so building and
  running there via `wslc.exe` is the more robust long-term path.
