# 0105 — BMC Redfish Telemetry Integration

> Status: **Accepted**
> Date: 2026-06-25
> Deciders: Phenotype platform team + L5 infrastructure team
> Driver: `v28-T2` (L5 thermal/capacity signals)
> Supersedes: None (additive)

## Summary

Integrate Baseboard Management Controller (BMC) hardware telemetry into the L5
observability pipeline via the **Redfish REST API** (DMTF standard, BMC-side).
A dedicated sidecar poller fetches sensor readings (temperature, power, fan RPM)
every 60 seconds and pushes them as OpenTelemetry (OTEL) metrics into the existing
platform metrics pipeline — enabling power-capping decisions, fan-failure
prediction, and thermal-throttling alerts without OS-level agent installation.

## Context

L5 nodes carry bare-metal servers whose BMCs expose rich hardware telemetry:

| Signal | Source | Use case |
|---|---|---|
| CPU / DIMM / inlet temperature | Redfish `Chassis/Thermal` | Thermal throttling detection |
| Fan RPM / status | Redfish `Chassis/Thermal` | Fan-failure prediction |
| Power consumption (instant + avg) | Redfish `Chassis/Power` | Power-capping enforcement |
| Voltage rail telemetry | Redfish `Chassis/Power` | PSU health monitoring |
| Drive slot temperature | Redfish `Drives/{id}` | SMART temperature correlation |

Currently this data is only accessible via the BMC web UI or `ipmitool` on the
host OS — neither path feeds the platform OTEL pipeline. As L5's rack density
grows (48+ nodes per rack), manual BMC inspection becomes unscalable and
reactive. We need programmatic, time-series data flowing into the same metrics
store that powers L5 dashboards, alerting, and capacity planning.

## Decision

**Option 2 selected: Redfish sidecar poller** — a standalone Rust binary deployed
alongside the BMC network (`bmc0` / dedicated management VLAN) that polls the
Redfish API every 60 seconds and pushes OTEL metrics to the existing platform
OpenTelemetry collector endpoint.

The poller is **not** embedded in OmniRoute. It is a separate process (sidecar)
with a single responsibility: read Redfish → emit OTEL. This keeps the poller
testable, deployable independent of OmniRoute release cycles, and auditable
without touching the LLM-routing hot path.

## Considered Options

### Option 1: OS-internal sensors via IPMI — REJECTED

Runs `ipmitool` or reads `/sys/class/hwmon/` on the host OS to collect sensor
data, then pushes to OTEL via a local agent (e.g., `prometheus-node-exporter`
with an IPMI exporter).

- **Pros**: No separate network dependency; data available even if BMC is
  unresponsive; well-trodden path (many existing IPMI exporters exist).
- **Cons**: **Requires OS-level agent** on every node — contradicts the
  fleet's immutable-infrastructure policy (no SSH/agent install on L5
  compute nodes). Host OS sensor resolution is coarser (hwmon often misses
  inlet temp, DIMM temp, fan RPM). IPMI LAN is synchronous and slow (~1s
  per `sdr` query). No standardised schema mapping to DMTF Redfish.
- **Risk**: Policy violation (immutable infra). Rejected.

### Option 2: Redfish sidecar poller — SELECTED

Standalone Rust binary, deployed on **management VLAN** (separate from
production data-plane), that polls each node's BMC Redfish endpoint every 60s.

- **Pros**: No OS agent required (BMC is reachable out-of-band). Redfish is a
  DMTF standard (schema stability). Multi-node coverage from a single poller
  instance. Standardised JSON schema with OTEL semantic-convention mapping
  (`hw.temperature`, `hw.fan_rpm`, `hw.power_watts`). 60s interval is sufficient
  for thermal/capacity decisions (thermal time-constants are O(minutes)).
- **Cons**: Adds a new subsystem to operate. BMC credentials must be managed
  securely. BMC firmware bugs can return malformed responses.
- **Risk**: Low — pure-play poller on isolated VLAN; no data-plane impact.

### Option 3: BMC SNMP trap receiver — REJECTED

Configure BMCs to emit SNMP traps on thermal events (e.g., `fan-failure`,
`temp-critical`), collected by a central SNMP trap receiver that translates to
OTEL events.

- **Pros**: Event-driven (low overhead). Many BMCs support SNMP v3 natively.
- **Cons**: **No historical baseline** — SNMP traps are event-only, not
  time-series, so we cannot detect slow drift (e.g., +2°C/quarter fan
  degradation). Redfish provides both instantaneous and historical
  ("average power over 1min") readings that SNMP does not. SNMP MIBs vary
  wildly between BMC vendors (Supermicro, ASRock Rack, HPE iLO, Dell iDRAC
  all expose different OIDs). Trap delivery is UDP (lossy).
- **Risk**: Medium — gaps in baseline data and vendor MIB drift make this
  operationally expensive to maintain.

## Decision Matrix

| Criterion | Option 1 (IPMI) | Option 2 (Redfish) | Option 3 (SNMP) |
|---|---|---|---|
| Immutable infra compatible | ❌ (OS agent) | ✅ (out-of-band) | ⚠️ (trap config on BMC) |
| Time-series baseline | ✅ | ✅ | ❌ (event-only) |
| Standardised schema | ❌ (vendor SDR) | ✅ (DMTF Redfish) | ❌ (vendor MIB) |
| Multi-node from one collector | ❌ (per-node) | ✅ | ✅ |
| Schema stability | ❌ | ✅ (DMTF standard) | ❌ |
| Operational overhead | Low | Medium (cred mgmt) | Medium (MIB drift) |

## Consequences

### Positive

1. **No OS agent on L5 compute nodes** — preserves immutable-infrastructure
   policy. The poller runs on a separate management host/VLAN, never touching
   the production data-plane.

2. **Standardised DMTF schema** — Redfish is a widely-adopted standard
   (Supermicro, ASRock Rack, HPE, Dell, Lenovo). The poller's sensor mapping
   works across hardware generations without per-vendor exceptions.

3. **Historical time-series baseline** — 60s-interval push into OTEL provides
   the trend data needed for fan-failure prediction (weeks-to-months drift),
   power-capping planning (hourly load curves), and thermal-throttling alerts
   (minute-level temperature spikes).

4. **Decoupled lifecycle** — the sidecar poller is an independent binary and
   systemd unit. It can be updated, rolled back, or scaled independently of
   OmniRoute and L5 compute-node images.

### Negative / Risks

1. **BMC credential management** — BMC admin credentials must be stored in a
   secrets store (Vault) and rotated regularly. **Mitigation**: poller
   authenticates via Vault agent sidecar; credential refresh on every poll
   cycle (no long-lived secrets in config files).

2. **BMC firmware variability** — Some BMCs return nonstandard or incomplete
   Redfish payloads (e.g., missing `Reading` units, empty `Temperatures[]`
   array). **Mitigation**: poller treats missing keys as `None` (not panic);
   a `redfish_parse_error` counter metric tracks per-node anomaly rate for
   dashboard alerting.

3. **Management VLAN isolation failure** — If the management VLAN is
   misconfigured, the poller could be cut off from BMCs or, worse, expose
   BMC endpoints to the data-plane. **Mitigation**: poller binds to a
   configured management interface; health check verifies VLAN-isolated
   connectivity before emitting metrics.

## Implementation Plan

| Step | Description | Owner | Status |
|---|---|---|---|
| **1 — Crate scaffold** | `cargo init` in `pheno/telemetry/poller-redfish/` with dependencies: `reqwest`, `serde`, `opentelemetry`, `opentelemetry-otlp`, `tokio`, `tracing`. Define `RedfishSensorReading` / `RedfishChassisThermal` / `RedfishChassisPower` types. | pheno-ops | ☐ |
| **2 — Poller loop** | `tokio::interval(60s)` loop: `GET /redfish/v1/Chassis/{id}/Thermal`, `GET /redfish/v1/Chassis/{id}/Power`, parse JSON, collect readings. Support multiple BMC targets from a config file. | pheno-ops | ☐ |
| **3 — OTEL metric bridge** | Map Redfish readings to OTel instruments: `hw.temperature` (gauge, °C), `hw.fan_rpm` (gauge, RPM), `hw.power_watts` (gauge, W). Export via `opentelemetry-otlp` (grpc) to the configured collector endpoint. | pheno-ops | ☐ |
| **4 — CI probe** | `docker-compose` test with a mock Redfish server (`/redfish/v1/Chassis/1/Thermal` returns canned JSON). Assert metrics emitted to an OTel test collector. Gate on parse-error count == 0. | pheno-ops | ☐ |
| **5 — Operations docs** | `docs/operations/redfish-poller.md`: deployment topology, Vault credential setup, dashboards (fan-failure prediction, power-capping cap threshold, thermal throttling last-24h). | pheno-ops | ☐ |

## Cross-References

- `docs/adr/INDEX.md` — ADR index.
- `docs/observability/METRICS_PIPELINE.md` — Platform OTel pipeline docs.
- `docs/operations/REDFISH_POLLER.md` — deployment playbook (post-implementation).
- DMTF Redfish Specification v2024.2 ([DSP0266](https://www.dmtf.org/sites/default/files/standards/documents/DSP0266_2024.2.pdf)).
- `pheno/telemetry/poller-redfish/` — crate root (post-scaffold).
