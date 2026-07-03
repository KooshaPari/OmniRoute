# Cross-Device Deployment

sharecli's `fleet` subcommand coordinates agent workloads across multiple
machines. Each device registers into a shared registry over
[NATS](https://nats.io), advertising its hostname, OS, and free execution
slots so a coordinator can place work where capacity (and thermal headroom)
exists.

This guide covers installing sharecli on each device, registering it into the
fleet, and reading fleet status. The NATS transport for `fleet register` /
`fleet status` is under active development; the commands are wired end-to-end
but publish against a stub backend until the runtime wiring lands.

## What the fleet does

- **Device registry** — each device publishes a `DeviceRecord`
  (`device_id`, `hostname`, `os`, `available_slots`) to the NATS subject
  `sharecli.fleet.devices.{device_id}`.
- **Thermal governor** — before accepting new work, a device consults its
  thermal governor so an overheating machine is not scheduled into the red.
- **Coordinator** — a NATS broker any device can reach; it is the rendezvous
  point for registration and (later) work placement.

## Prerequisites

1. **A reachable NATS server** — one broker that every device can connect to.
   Install locally with:

   ```bash
   # macOS
   brew install nats-server
   # Linux (or download a release binary from nats.io)
   go install github.com/nats-io/nats-server/v2@latest
   ```

   Start it (defaults to `0.0.0.0:4222`):

   ```bash
   nats-server
   ```

   For a multi-machine fleet, run the broker on a host every device can route
   to and use `nats://<host>:4222` as the coordinator address below.

2. **sharecli installed on every device** (see next section).

3. **Network reachability** — TCP `4222` open from each device to the broker.

## Install sharecli on each device

Build from source (Rust toolchain required — https://rustup.rs):

```bash
git clone https://github.com/KooshaPari/sharecli
cd sharecli
cargo build --release
# binary at target/release/sharecli — copy onto PATH, e.g.:
install -m 0755 target/release/sharecli ~/.local/bin/sharecli
```

Verify:

```bash
sharecli --version
sharecli fleet --help
```

## Register a device

Run this once per device. `--name` defaults to `local`; `--coordinator`
defaults to `nats://localhost:4222`.

```bash
# local broker
sharecli fleet register

# named device against a remote coordinator
sharecli fleet register --name worker-mini --coordinator nats://10.0.0.5:4222
```

Expected output:

```text
Registering device 'worker-mini' with coordinator 'nats://10.0.0.5:4222'
(Fleet NATS wiring pending — stub)
```

## Check fleet status

```bash
sharecli fleet status
```

Expected output:

```text
Thermal governor: ready (polling pending backend wiring)
Fleet registry: not connected (run `sharecli fleet register` first)
```

`fleet status` reports the local thermal governor state and whether this
device is attached to a registry.

## Thermal governor behavior

The thermal governor gates new work by machine temperature so a hot device is
not pushed further into throttling. It reports one of three levels:

| Level  | Meaning                          | Scheduling effect                        |
| ------ | -------------------------------- | ---------------------------------------- |
| Green  | Normal temperature/headroom      | Accept new work                          |
| Yellow | Elevated — approaching limits    | Slow down; prefer cooler devices         |
| Red    | Hot — at or over thermal limit   | Refuse new work until it cools           |

Platform sourcing:

- **macOS** — reads OS thermal-pressure signals
  (`kern.memorystatus`/thermal-pressure APIs) rather than raw temperatures.
  Note: low swap-free alone is *not* a thermal signal on macOS; pressure level
  is the correct metric.
- **Linux** — reads thermal zones under `/sys/class/thermal/thermal_zone*`.

Thermal polling is stubbed in the current release; `fleet status` confirms the
governor is wired and will surface live levels once backend polling lands.

## Troubleshooting

- **`sharecli: command not found`** — the release binary is not on `PATH`.
  Re-run the `install` step or add `~/.local/bin` to `PATH`.
- **Cannot reach the coordinator** — confirm the broker is running
  (`nats-server`) and TCP `4222` is open from the device to the broker host.
  Test with `nc -vz <host> 4222`.
- **Device does not appear in the registry** — registration currently publishes
  against a stub backend; live registry listing lands with the NATS runtime
  wiring. Until then, `fleet status` shows `not connected`.
- **Wrong device name** — `--name` is free-form; re-run `fleet register` with
  the corrected `--name`.
- **Thermal level always shows pending** — expected in this release; live
  polling is not yet enabled.

## See also

- Registry internals: `crates/sharecli-fleet/src/registry.rs`
- Thermal governor: `crates/sharecli-fleet/src/thermal.rs`
