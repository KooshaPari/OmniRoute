# sharecli

A process supervisor CLI for managing long-running services with declarative
configuration, hot-reload, and rich observability.

`sharecli` watches a single TOML config, supervises the processes declared in
it, exposes a small HTTP API for health and metrics, and ships with first-class
desktop and webhook notifications, shell completions, `proc-compose`
integration, Prometheus metrics, and an executable plugin registry.

## Features

- **Config hot-reload** — uses `notify` to watch the config file and apply
  changes to the running supervisor in place (no restart required).
- **Health-check scheduler** — runs periodic HTTP/TCP/exec probes against
  each managed process and tracks pass/fail history.
- **Schema validation** — every config is validated against a strict JSON
  Schema before reload, so a typo never crashes the running supervisor.
- **Desktop + webhook notifications** — surface state transitions
  (`started`, `crashed`, `unhealthy`, `recovered`) to the OS notification
  daemon and to arbitrary HTTP webhooks with HMAC-SHA256 signatures.
- **Shell completions** — generates `bash`, `zsh`, `fish`, and `powershell`
  completions from the live CLI definition.
- **`proc-compose` integration** — discovers and supervises the services
  declared in a `proc-compose.toml` alongside the main config.
- **Prometheus metrics** — exposes counters, gauges, and histograms for
  process state, restarts, health checks, and request latency at
  `/metrics/prometheus`.
- **Plugin registry** — discover, install, and run executable plugins
  that extend `sharecli` with new subcommands (see
  `sharecli plugin`).

## Install

### From source (recommended)

```bash
cargo install sharecli
```

This installs the `sharecli` binary into `~/.cargo/bin`.

### From a pre-built release

Download a release archive from the
[releases page](https://github.com/KooshaPari/sharecli/releases) and
extract the binary somewhere on your `PATH`:

```bash
tar -xzf sharecli-<version>-<target>.tar.gz
sudo install -m 0755 sharecli /usr/local/bin/sharecli
```

### Build from a git checkout

```bash
git clone https://github.com/KooshaPari/sharecli.git
cd sharecli
cargo build --release
./target/release/sharecli --version
```

## Quick Start

1. Drop a config file at `./sharecli.toml`:

   ```toml
   [server]
   bind = "127.0.0.1:9090"

   [[process]]
   name = "echo"
   command = ["sh", "-c", "while true; do echo tick; sleep 5; done"]

   [process.healthcheck]
   kind = "tcp"
   port = 0
   interval = "10s"
   ```

2. Start the supervisor:

   ```bash
   sharecli serve
   ```

3. Inspect managed processes from the CLI:

   ```bash
   sharecli proc-compose status
   ```

4. Generate shell completions (example for `zsh`):

   ```bash
   sharecli completions zsh > "${fpath[1]}/_sharecli"
   # restart your shell, or: autoload -U compinit && compinit
   ```

Other shells: `sharecli completions bash`, `sharecli completions fish`,
`sharecli completions powershell`.

## Configuration

The full config schema is documented at
`docs/configuration.md`; the minimal shape is:

```toml
# sharecli.toml

[server]
bind          = "127.0.0.1:9090"
log_level     = "info"        # trace | debug | info | warn | error
config_path   = "./sharecli.toml"

[notifications]
desktop       = true
webhook_url   = "https://example.com/sharecli-hook"
webhook_secret = "env:SHARECLI_WEBHOOK_SECRET"  # HMAC-SHA256 signing key

[healthcheck]
default_interval = "10s"
default_timeout   = "2s"

[[process]]
name     = "api"
command  = ["./bin/api", "--port", "8080"]
cwd      = "./"
env      = { RUST_LOG = "info" }
restart  = "on-failure"        # no | always | on-failure
backoff  = { initial = "1s", max = "30s", multiplier = 2.0 }

[process.healthcheck]
kind     = "http"
url      = "http://127.0.0.1:8080/healthz"
interval = "5s"
timeout  = "1s"
```

Secrets prefixed with `env:` are resolved from the process environment at
start time and never written to disk.

## API

`sharecli serve` exposes the following endpoints on the configured bind
address (default `127.0.0.1:9090`). All endpoints respond with JSON unless
noted; non-`200` responses include a `{"error": "..."}` body.

| Method | Path                   | Description                                                    |
| ------ | ---------------------- | -------------------------------------------------------------- |
| GET    | `/health`              | Liveness probe for the supervisor itself. Always `200` if up.  |
| GET    | `/health/processes`    | Per-process status (state, PID, uptime, last health check).   |
| GET    | `/config`              | Effective config (secrets redacted) currently in effect.       |
| GET    | `/metrics/prometheus`  | Prometheus exposition format (text/plain; `version=0.0.4`).   |

A request that targets an unknown process can append
`?name=<process-name>` to `/health/processes`.

## License

Dual-licensed under MIT or Apache 2.0, at your option.
See [LICENSE](LICENSE) and [LICENSE-APACHE](LICENSE-APACHE).
