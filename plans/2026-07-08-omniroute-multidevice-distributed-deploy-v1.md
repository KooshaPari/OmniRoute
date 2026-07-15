# OmniRoute Multi-Device Distributed Deployment &amp; Elastic Scaling

**Date**: 2026-07-08  
**Version**: v1.0  
**Scope**: `diegosouzapw/OmniRoute` + `kooshapari/argis-extensions` (bifrost-extensions)  
**Status**: Research Complete — Plan Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Vision: OmniRoute Distributed Mesh](#3-architecture-vision)
4. [Elastic Load Balancing Strategy](#4-elastic-load-balancing-strategy)
5. [Multi-Device Deployment Topology](#5-multi-device-deployment-topology)
6. [Unified Management Plane](#6-unified-management-plane)
7. [Compute-Aware Scheduling &amp; System Load Factoring](#7-compute-aware-scheduling--system-load-factoring)
8. [Implementation Phases](#8-implementation-phases)
9. [SOTA Patterns to Adopt](#9-sota-patterns-to-adopt)
10. [Risk Assessment &amp; Mitigation](#10-risk-assessment--mitigation)
11. [Metrics &amp; Success Criteria](#11-metrics--success-criteria)

---

## 1. Executive Summary

OmniRoute is an AI proxy/router with **231 provider entries**, **15 routing strategies**, **87 MCP tools**, and a **3-layer resilience stack**. It currently runs as a single-node deployment (Docker Compose or 2-replica K8s) with rate limiting as its only backpressure mechanism. The companion `argis-extensions` repo provides a Go-side extension layer for the Bifrost Tier-1 router with advanced plugin-based intelligent routing, cost management, and multi-platform deployment.

### The Gap

Neither repo provides:

- **Native multi-device orchestration** — horizontal scaling across physical/virtual machines
- **Elastic auto-scaling** — predictive or event-driven scaling based on system load + process performance
- **Node health factoring** — routing decisions that account for CPU/memory/IO/GPU utilization of downstream nodes
- **Unified management plane** — a single interface (GUI/CLI/API) for distributed deployment configuration, monitoring, and control
- **Geo-distributed active-active** — cross-region deployment with latency-aware steering

### The Vision

A **3-tier distributed mesh** where:

```
                    ┌──────────────────────────────────────┐
                    │          MANAGEMENT PLANE             │
                    │  (GUI Dashboard + CLI + REST/gRPC)   │
                    │  Fleet topology, scaling policies,    │
                    │  config push, health monitoring,      │
                    │  alert management, deployment wizards │
                    └──────┬─────────────┬─────────────────┘
                           │             │
              ┌────────────▼──┐   ┌──────▼────────────┐
              │  TIER 1:      │   │  TIER 1:          │
              │  Bifrost (Go) │   │  Bifrost (Go)     │
              │  Region us    │   │  Region eu        │
              │  Provider rtr │   │  Provider rtr     │
              │  Semantic cache│  │  Semantic cache   │
              │  Virtual keys │   │  Virtual keys     │
              └──────┬────────┘   └──────┬────────────┘
                     │                   │
              ┌──────▼────────┐   ┌──────▼────────────┐
              │  TIER 2:      │   │  TIER 2:          │
              │  OmniRoute TS │   │  OmniRoute TS     │
              │  Control plane│   │  Control plane    │
              │  A2A/MCP/SSE  │   │  A2A/MCP/SSE     │
              │  Compression  │   │  Compression      │
              │  Reasoning rp │   │  Reasoning rp     │
              └──────┬────────┘   └──────┬────────────┘
                     │                   │
              ┌──────▼────────┐   ┌──────▼────────────┐
              │  TIER 3:      │   │  TIER 3:          │
              │  argis-ext    │   │  argis-ext        │
              │  Plugins/SLM  │   │  Plugins/SLM      │
              │  Intelligent  │   │  Intelligent      │
              │  Router/Cost  │   │  Router/Cost      │
              └───────────────┘   └───────────────────┘
```

### Key Outcomes

| Outcome                  | Metric         | Target                      |
| ------------------------ | -------------- | --------------------------- |
| Horizontal scaling       | Nodes in fleet | 3→50+ per region            |
| Auto-scaling convergence | Time to scale  | Manual→90s                  |
| p50 latency reduction    | Response time  | 800ms→400ms                 |
| Fleet availability       | Uptime         | 99.9%→99.99%                |
| Config propagation       | Global sync    | N/A→5s                      |
| Cost efficiency          | $/request      | -15% via predictive scaling |

---

## 2. Current State Analysis

### 2.1 OmniRoute (`diegosouzapw/OmniRoute`) — Deep Summary

**Codebase**: v3.8.31, Next.js 16 + TypeScript + Rust data plane + Electron desktop

| Component        | Lines (approx)      | Deploy Model             | Scaling Model  |
| ---------------- | ------------------- | ------------------------ | -------------- |
| Next.js App (TS) | 50K+                | Single container         | Manual replica |
| Open-SSE Engine  | 115 service modules | Bundled with app         | N/A            |
| Rust Data Plane  | 3 crates            | Separate container (UDS) | Manual replica |
| MCP Server       | 87 tools            | Bundled                  | N/A            |
| A2A Server       | 8 skills            | Bundled                  | N/A            |
| Electron Desktop | N/A                 | Standalone               | N/A            |

**Existing Load Balancing** (`src/shared/constants/routingStrategies.ts:1-17`):

| Strategy            | SOTA Alignment            | Gap                           |
| ------------------- | ------------------------- | ----------------------------- |
| `priority`          | Static ordered            | No EWMA                       |
| `weighted`          | Weighted random           | No per-node system load       |
| `round-robin`       | Rotary                    | No connection count awareness |
| `p2c`               | **Power of Two Choices**  | Missing EWMA smoothing        |
| `least-used`        | Usage-aware               | Missing node health factor    |
| `cost-optimized`    | Cost-aware                | No cross-region cost          |
| `auto`              | 9-factor scoring + bandit | Missing system load factor    |
| `lkgp`              | Session affinity          | No consistent hashing         |
| `context-optimized` | Session-aware             | No ring-based stickiness      |

**Existing Resilience** (`docs/architecture/RESILIENCE_GUIDE.md`):

- 3-layer: provider CB → connection cooldown → model lockout
- Shadow routing (`shadowRouting.ts:1-178`)
- Hedged requests (`combo.ts:1842-1868`)
- Bifrost kill switch (`open-sse/services/bifrostKillSwitch.ts:401`)

**Existing Deployment**:

- Docker Compose: Profiles (base/web/cli/host/cliproxyapi) + sidecars (Redis, OTEL, Rust)
- K8s: 2-replica deployment + metrics service
- Fly.io: Single-region, auto-stop/start, 1GB machine
- npm: `npm install -g omniroute`

### 2.2 argis-extensions / bifrost-extensions — Deep Summary

**Codebase**: Go 1.26, ~20K LOC, `github.com/kooshapari/bifrost-extensions`

| Component              | Lines (approx)  | Capability                                                  |
| ---------------------- | --------------- | ----------------------------------------------------------- |
| **CLI** (9 commands)   | 500+            | Server, Deploy, Config, Plugin, Migrate, Dataset            |
| **API Server**         | 3 surfaces      | REST (OpenAI), Connect/gRPC, GraphQL                        |
| **Plugins** (9)        | 7 packages      | Intelligent Router, Smart Fallback, Context Folding, Voyage |
| **Intelligent Router** | 7-step pipeline | Semantic + ArchRouter + RouteLLM + MIRT + 3-Pillar + Pareto |
| **Cost Engine**        | 3 files         | 6 billing models, 6 limit types, quota enforcement          |
| **Config**             | 5 files         | Viper-based, hot-reload, Vault + AES-GCM, versioning        |
| **Infra**              | 6 modules       | Redis, NATS, Neo4j, Upstash, Hatchet, Circuit Breaker       |
| **Deploy Targets**     | 5 platforms     | Fly.io, Vercel, Railway, Render, Homebox                    |

**Key Architectural Pattern**: Clean extension layer — consumes `maximhq/bifrost` as Go module without modification. Plugin interface (`bifrost/core/schemas/schemas.go:290-296`) enables injection at TransportInterceptor/PreHook/PostHook points.

---

## 3. Architecture Vision: OmniRoute Distributed Mesh

### 3.1 Three-Tier Architecture (Detailed)

```
                     ┌──────────────────────────────────────────┐
                     │          GLOBAL LOAD BALANCER            │
                     │  Cloudflare Anycast / AWS Global Accel   │
                     │  Route53 Latency-Based / BGP Anycast     │
                     │  Health-check weighted target groups     │
                     └──────────────────┬───────────────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            │                           │                           │
     ┌──────▼──────┐            ┌───────▼──────┐           ┌───────▼──────┐
     │ REGION: us  │            │ REGION: eu   │           │ REGION: ap   │
     │ ┌─────────┐ │            │ ┌──────────┐ │           │ ┌──────────┐ │
     │ │CLUSTER  │ │            │ │CLUSTER   │ │           │ │CLUSTER   │ │
     │ │us-east1 │ │            │ │eu-west1  │ │           │ │ap-south1 │ │
     │ └───┬─────┘ │            │ └───┬──────┘ │           │ └───┬──────┘ │
     │     │       │            │     │        │           │     │        │
     │ ┌───▼─────┐ │            │ ┌───▼──────┐ │           │ ┌───▼──────┐ │
     │ │ Node 1  │ │            │ │ Node 1   │ │           │ │ Node 1   │ │
     │ │ Node 2  │ │            │ │ Node 2   │ │           │ │ Node 2   │ │
     │ │ Node N  │ │            │ │ Node N   │ │           │ │ Node N   │ │
     │ └─────────┘ │            │ └──────────┘ │           │ └──────────┘ │
     └─────────────┘            └──────────────┘           └──────────────┘
            │                           │                           │
            └───────────┬───────────────┴───────────────┬───────────┘
                        │                               │
             ┌──────────▼──────────┐         ┌──────────▼──────────┐
             │  GLOBAL MANAGEMENT  │         │  GLOBAL OBSERVABILITY│
             │  PLANE (SSOT)       │         │  Mimir / Tempo /     │
             │  Config, Policies,  │         │  Grafana / AlertMgr  │
             │  Secrets, Alerts    │         │  OTLP ingest         │
             └─────────────────────┘         └──────────────────────┘
```

### 3.2 Per-Node Stack

Each node runs a **container group**:

```
┌───────────────────────────────────────────────────────┐
│                      NODE                              │
│                                                        │
│  Port 20128 ────► ┌──────────────────────────────┐    │
│                   │  OMNIROUTE (Tier-2)           │    │
│                   │  • Dashboard, API, MCP, A2A   │    │
│                   │  • Combo routing engine       │    │
│                   │  • Compression, cache         │    │
│                   └──────────┬───────────────────┘    │
│                              │ UDS/localhost          │
│  Port 8080  ────► ┌──────────▼───────────────────┐    │
│                   │  BIFROST (Tier-1)             │    │
│                   │  • Provider routing           │    │
│                   │  • Semantic cache             │    │
│                   │  • Virtual keys, budget       │    │
│                   └──────────────────────────────┘    │
│                                                        │
│  Port 9099 ────► ┌──────────────────────────────┐    │
│                   │  MANAGEMENT AGENT (Sidecar)   │    │
│                   │  • System metrics collection  │    │
│                   │  • Health endpoint           │    │
│                   │  • Control endpoint (drain)  │    │
│                   │  • Config sync               │    │
│                   │  • gRPC stream to mgmt plane │    │
│                   └──────────────────────────────┘    │
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │  REDIS (Sidecar — optional)                  │     │
│  │  • Local rate limiter state                  │     │
│  │  • Session cache                             │     │
│  └──────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────┘
```

### 3.3 Cross-Node Communication Matrix

| Channel           | Protocol      | TLS           | Transport            | Purpose                   |
| ----------------- | ------------- | ------------- | -------------------- | ------------------------- |
| Global LB → Node  | HTTP/2        | mTLS optional | Internet             | Request distribution      |
| Node ↔ Node       | Connect/gRPC  | mTLS          | Mesh (Istio/LinkerD) | State sync, handoff       |
| Node → Mgmt Plane | gRPC stream   | mTLS          | Dedicated/NATS       | Telemetry, health         |
| Mgmt Plane → Node | REST/SSE      | mTLS          | NATS/Direct          | Config push, kill-switch  |
| Node ↔ Redis      | RESP          | TLS           | Cluster              | Distributed rate limiting |
| Node ↔ PostgreSQL | pgx (TCP)     | TLS           | Pool                 | Persistent state          |
| Node ↔ NATS       | NATS protocol | TLS           | Cluster              | Async jobs                |

---

## 4. Elastic Load Balancing Strategy

### 4.1 Multi-Layer Architecture

```
                LAYER 1: GLOBAL (Anycast / DNS)
                ─────────────────────────────────
                Cloudflare Anycast (primary)
                Route53 Latency (fallback)
                Health: TCP + HTTP /healthz
                ─────────────────────────────────
                           │
                ┌──────────▼──────────┐
                │   Edge POP (Worker) │
                │   Lite model cache  │
                │   Rate limit check  │
                │   ┌─▶ Region: us   │
                │   │   Region: eu   │
                │   └──▶ Region: ap  │
                └─────────────────────┘
                           │
                LAYER 2: REGIONAL (Cluster Ingress)
                ─────────────────────────────────
                P2C + EWMA (node selection)
                × System Load Factor (health weight)
                × Consistent Hashing (session stickiness)
                ─────────────────────────────────
                           │
                LAYER 3: APPLICATION (Provider Pod)
                ─────────────────────────────────
                15 strategies × SystemLoadWeight
                Intent classification
                Cost optimization
                ─────────────────────────────────
```

### 4.2 EWMA + P2C Enhancement

**Current** (`targetSorters.ts:143-173`): P2C uses raw `avgLatencyMs` from metrics.

**Enhanced implementation** (`open-sse/ewmaTracker.ts`):

```typescript
interface EwmaConfig {
  alpha: number; // Smoothing factor (default 0.3)
  beta: number; // Peak decay (default 0.5)
  halfLife: number; // Time-weight decay in ms (default 30_000)
}

interface EwmaState {
  value: number; // E[T] — exponentially weighted moving average
  peak: number; // P[T] — peak EWMA (decays slower)
  variance: number; // V[T] — exponentially weighted variance
  lastUpdate: number; // Timestamp for time-decay correction
}

function updateEwma(state: EwmaState, observation: number, config: EwmaConfig): void {
  const now = Date.now();
  const elapsed = now - state.lastUpdate;

  // Time-decay factor: halve weight every halfLife
  const decay = Math.pow(0.5, elapsed / config.halfLife);

  // Update EWMA
  state.value = config.alpha * observation + (1 - config.alpha) * state.value * decay;

  // Update EWMA variance
  const delta = observation - state.value;
  state.variance = (1 - config.alpha) * (state.variance + config.alpha * delta * delta);

  // Update peak EWMA (decays slower: beta < alpha usually)
  state.peak = Math.max(state.value, state.peak * decay);

  state.lastUpdate = now;
}
```

**Integration into P2C scoring**:

```typescript
function getP2CTargetScore(
  target: ResolvedComboTarget,
  metrics: ComboMetrics,
  ewma: Map<string, EwmaState>,
  nodeHealth: NodeHealthReport | null
): number {
  const breakerState = getCircuitBreaker(target.provider)?.getStatus()?.state;
  if (breakerState === "OPEN") return -Infinity;

  // Use EWMA latency instead of raw avgLatencyMs
  const ewmaState = ewma.get(target.id);
  const latencyScore = ewmaState ? 1 / Math.log10(ewmaState.value + 10) : 0.25;

  const successScore = (metrics?.byModel?.[target.modelStr]?.successRate ?? 50) / 100;
  const breakerPenalty = breakerState === "HALF_OPEN" ? 0.25 : 0;

  // System load multiplier
  const healthMultiplier = nodeHealth ? 0.3 + 0.7 * nodeHealth.compositeScore : 1.0;

  return (successScore + latencyScore - breakerPenalty) * healthMultiplier;
}
```

### 4.3 Consistent Hashing Strategy

New routing strategy for session-stickiness without centralized state:

```typescript
// Jump consistent hash (Google, 2014): O(log n), minimal redistribution
function jumpConsistentHash(key: string, numTargets: number): number {
  const hash = hashString(key); // xxhash or similar
  let b = -1n;
  let j = 0n;
  while (j < BigInt(numTargets)) {
    b = j;
    const r = BigInt(hash) + BigInt(0x9e3779b97f4a7c15n) * (b + 1n);
    j = BigInt(
      Math.floor(Number(BigInt(1n << 31n) / (r & BigInt(0xffffffffn))) * Math.log2(Number(b + 2n)))
    );
  }
  return Number(b);
}
```

**Scenarios enabled**:

1. **Session stickiness**: `session_id → node` — same session always hits same node (KV/prompt cache)
2. **Prefix-based routing**: `prompt_hash % N → node` — repeated system prompts land on warm nodes
3. **Provider-affinity**: `provider+model_hash % N → node` — model-specific load distribution

### 4.4 Predictive Auto-Scaling Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PREDICTIVE SCALER                              │
│                                                                     │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────┐              │
│  │ Historical │   │ Feature       │   │ Prophet      │              │
│  │ Data Store │──►│ Engineering   │──►│ Model        │──► Forecast │
│  │ (14-30d)   │   │ • Hourly agg  │   │ • Seasonality│              │
│  └────────────┘   │ • Diurnal dec │   │ • Trend      │              │
│                   │ • Event flags │   │ • Holidays   │              │
│                   │ • Error rate  │   │ • Changepoint│              │
│                   └──────────────┘   └──────┬───────┘              │
│                                             │                       │
│  ┌──────────────────────────────────────────▼──────────────────┐   │
│  │  Decision Logic                                              │   │
│  │  desiredReplicas = max(                                      │   │
│  │    reactiveHPA(immediate_metric),                            │   │
│  │    predictiveHPA(forecast[t+15min])                          │   │
│  │  )                                                           │   │
│  │  + buffer(0.2 × max — headroom for forecast error)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

Metrics for scaling decisions:

| Metric                      | Reactive HPA Threshold | Predictive Horizon | Data Window |
| --------------------------- | ---------------------- | ------------------ | ----------- |
| Queue depth (in-flight req) | >100 avg over 30s      | 15min              | 7 days      |
| Token throughput            | >100K tok/s            | 30min              | 14 days     |
| Error rate                  | >3% over 5min          | N/A                | N/A         |
| p95 latency                 | >3s over 5min          | 15min              | 7 days      |
| CPU utilization             | >70% over 2min         | 30min              | 14 days     |
| Memory utilization          | >80% over 2min         | 30min              | 14 days     |

---

## 5. Multi-Device Deployment Topology

### 5.1 Topology Options by Scale

| Topology            | Nodes                     | Bifrost       | Redis    | DB          | Use Case      | Est. Cost/mo |
| ------------------- | ------------------------- | ------------- | -------- | ----------- | ------------- | ------------ |
| **Single Node**     | 1 OmniRoute + 1 Bifrost   | Embedded      | SQLite   | SQLite      | Dev, personal | $0-10        |
| **Small HA**        | 3 OmniRoute + 2 Bifrost   | Per node      | Sentinel | pg bouncer  | Team, staging | $100-300     |
| **Regional Active** | 10+ OmniRoute + 3 Bifrost | Per node      | Cluster  | pg replicas | Production    | $500-3K      |
| **Global Mesh**     | 50+/region × 3            | 5+/region × 3 | Global   | CockroachDB | Enterprise    | $5K-20K      |

### 5.2 K8s Production Manifest (Recommended)

**Deployment** (`deploy/k8s/fleet/omniroute-deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: omniroute
  namespace: omniroute
spec:
  replicas: 3 # HPA will override
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0 # Zero-downtime
      maxSurge: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: omniroute
  template:
    metadata:
      labels:
        app.kubernetes.io/name: omniroute
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9099"
        # Spot instance handling
        cluster-autoscaler.kubernetes.io/safe-to-evict: "true"
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: omniroute
          image: ghcr.io/kooshapari/omniroute:latest
          ports:
            - containerPort: 20128 # Dashboard + API
            - containerPort: 9099 # Management agent
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
            - name: FLEET_MODE
              value: "enabled"
            - name: FLEET_MANAGEMENT_PLANE_URL
              value: "grpc://management-plane:9090"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2048Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 9099
          readinessProbe:
            httpGet:
              path: /readyz
              port: 9099
        - name: bifrost
          image: ghcr.io/kooshapari/bifrost:latest
          ports:
            - containerPort: 8080
          env:
            - name: BIFROST_MODE
              value: "fleet"
            - name: BIFROST_UPSTREAM_PROXY
              value: "http://localhost:20128"
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
```

**HPA with KEDA** (`deploy/k8s/fleet/scaled-object.yaml`):

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: omniroute-scaled-object
  namespace: omniroute
spec:
  scaleTargetRef:
    name: omniroute
  pollingInterval: 15
  cooldownPeriod: 60
  minReplicaCount: 2
  maxReplicaCount: 20
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 300
          policies:
            - type: Percent
              value: 50
              periodSeconds: 60
        scaleUp:
          stabilizationWindowSeconds: 60
          policies:
            - type: Pods
              value: 4
              periodSeconds: 15
            - type: Percent
              value: 100
              periodSeconds: 15
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.monitoring:9090
        metricName: omniroute_queue_depth
        query: |
          sum(rate(omniroute_requests_inflight_total[30s]))
        threshold: "100"
        activationThreshold: "10"
    - type: cpu
      metadata:
        type: Utilization
        value: "70"
    - type: memory
      metadata:
        type: Utilization
        value: "80"
```

### 5.3 Spot/Preemptible Integration

```yaml
# Node group configuration
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: omniroute
spec:
  disruption:
    consolidateAfter: 30s
    consolidationPolicy: WhenEmptyOrUnderutilized
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values:
            - on-demand
            - spot
        - key: kubernetes.io/arch
          operator: In
          values:
            - amd64
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m6i.large
            - m6i.xlarge
            - c6i.large
            - c6i.xlarge
---
# PodDisruptionBudget ensures quorum during spot interruptions
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: omniroute-pdb
  namespace: omniroute
spec:
  minAvailable: "50%"
  selector:
    matchLabels:
      app.kubernetes.io/name: omniroute
```

---

## 6. Unified Management Plane

### 6.1 Three-Surface Architecture

```
                    ┌─────────────────────────────┐
                    │     MANAGEMENT PLANE         │
                    │     ───────────────────      │
                    │     Single Source of Truth   │
                    │     PostgreSQL + NATS KV     │
                    └────┬────────────┬───────────┘
                         │            │
              ┌──────────▼──┐  ┌─────▼──────────┐
              │   API       │  │   EVENTS        │
              │   REST/gRPC │  │   NATS Stream   │
              │   GraphQL   │  │   OTLP Metrics  │
              └─────────────┘  └─────────────────┘
                    │                  │
     ┌──────────────┼──────────────────┼──────────────┐
     │              │                  │              │
┌────▼───┐   ┌─────▼─────┐   ┌────────▼───┐   ┌─────▼─────┐
│ GUI    │   │ CLI       │   │ MCP Tools  │   │ Webhooks  │
│ Next.js│   │ omniroute │   │ 87→92 tools│   │ 7 events  │
│ Svelte │   │ bifrost   │   │ +fleet ops │   │ +fleet    │
└────────┘   └───────────┘   └────────────┘   └───────────┘
```

### 6.2 GUI Dashboard: New Fleet Pages

All pages under `/dashboard/fleet/`:

| Page                 | Route              | Key Components                                                                   | Real-Time  |
| -------------------- | ------------------ | -------------------------------------------------------------------------------- | ---------- |
| **Fleet Topology**   | `/fleet/topology`  | Force-directed graph, cluster rings, node health badges                          | SSE stream |
| **Node List**        | `/fleet/nodes`     | DataTable (hostname, region, health, load, uptime)                               | Poll 5s    |
| **Node Detail**      | `/fleet/nodes/:id` | Health gauges, system metrics sparklines, process metrics, active requests, logs | WS stream  |
| **Config Editor**    | `/fleet/config`    | YAML/JSON editor with Monaco, diff view, validation, apply/rollback              | On save    |
| **Deploy Manager**   | `/fleet/deploy`    | Deployments timeline, rollout progress per node, canary config                   | SSE        |
| **Scaling Policies** | `/fleet/scaling`   | Policy list, metric selector, threshold sliders, scaling history chart           | Poll 10s   |
| **Alert Rules**      | `/fleet/alerts`    | Alert rules CRUD, firing alerts, silences, alert history                         | WS stream  |
| **Fleet Actions**    | `/fleet/actions`   | Drain, restart, config refresh, kill-switch per node or cluster                  | Immediate  |

### 6.3 CLI Commands

**OmniRoute CLI** extensions (`bin/omniroute.mjs`):

```
omniroute fleet
  ├── nodes                    # List all nodes (fleet status)
  ├── node <id>                # Show node detail
  │   ├── metrics              # Show node system metrics
  │   └── logs [--tail]        # Stream node logs
  ├── config
  │   ├── show                 # Show fleet config
  │   ├── diff <file>          # Diff config against file
  │   ├── validate <file>      # Validate config
  │   └── apply <file>         # Apply config (push to all nodes)
  ├── deploy
  │   ├── status               # Deploy status
  │   ├── rollout <version>    # Rolling update
  │   ├── rollback [version]   # Rollback to version
  │   └── canary <version>     # Canary (% traffic)
  ├── scale
  │   ├── up <n>               # Manual scale
  │   ├── down <n>             # Manual scale
  │   ├── pause                # Pause autoscaler
  │   └── resume               # Resume autoscaler
  ├── drain <node>             # Graceful drain
  ├── health                   # Fleet health summary
  ├── alerts
  │   ├── list                 # Alert rules
  │   ├── fire                 # Manually fire alert
  │   └── silence <id>         # Silence alert
  └── sync                     # Force config sync

# Examples
omniroute fleet nodes --region us-east-1
omniroute fleet node node-uuid --metrics
omniroute fleet config apply ./fleet-prod.yaml
omniroute fleet deploy canary v3.9.0 --percentage 5
omniroute fleet drain node-uuid --reason "Kernel upgrade"
```

**Bifrost CLI** extensions (`cmd/bifrost/cli/fleet.go`):

```
bifrost fleet
  ├── join <token>             # Join fleet (returns node UUID)
  ├── leave                    # Gracefully leave fleet
  ├── status                   # Health + sync status
  ├── sync                     # Force config sync
  └── logs                     # Stream fleet logs
```

### 6.4 Management API

**REST** (`/api/v2/fleet/`):

```
# Nodes
GET    /api/v2/fleet/nodes                     → Node[]
GET    /api/v2/fleet/nodes/:id                 → Node
GET    /api/v2/fleet/nodes/:id/metrics          → MetricsSnapshot
POST   /api/v2/fleet/nodes/:id/drain            → { ok }
POST   /api/v2/fleet/nodes/:id/config           → { ok, version }
DELETE /api/v2/fleet/nodes/:id                  → { ok } (decommission)

# Config
GET    /api/v2/fleet/config                    → FleetConfig
PUT    /api/v2/fleet/config                    → { version, applied }
GET    /api/v2/fleet/config/history            → ConfigVersion[]

# Deploy
POST   /api/v2/fleet/deploy                    → { deployId }
GET    /api/v2/fleet/deploy/:id                → DeployStatus
POST   /api/v2/fleet/deploy/:id/rollback       → { deployId }

# Scaling
GET    /api/v2/fleet/scaling/policies          → ScalingPolicy[]
POST   /api/v2/fleet/scaling/policies          → ScalingPolicy
PUT    /api/v2/fleet/scaling/policies/:id      → ScalingPolicy
DELETE /api/v2/fleet/scaling/policies/:id      → { ok }

# Health
GET    /api/v2/fleet/health                    → FleetHealth (aggregated)
GET    /api/v2/fleet/health/events             → FleetHealthEvent[] (SSE stream)

# Alerts
GET    /api/v2/fleet/alerts/rules              → AlertRule[]
POST   /api/v2/fleet/alerts/rules              → AlertRule
GET    /api/v2/fleet/alerts/firing             → AlertInstance[]
POST   /api/v2/fleet/alerts/silence            → { silenceId }
```

**gRPC** proto (`omniroute.fleet.v1`):

```protobuf
service FleetService {
  // Node operations
  rpc ListNodes(ListNodesRequest) returns (ListNodesResponse);
  rpc GetNode(GetNodeRequest) returns (Node);
  rpc WatchNodeEvents(WatchNodeEventsRequest) returns (stream NodeEvent);

  // Node control
  rpc DrainNode(DrainNodeRequest) returns (DrainNodeResponse);
  rpc PushNodeConfig(PushNodeConfigRequest) returns (PushNodeConfigResponse);

  // Fleet config
  rpc GetFleetConfig(Empty) returns (FleetConfig);
  rpc UpdateFleetConfig(UpdateFleetConfigRequest) returns (FleetConfig);
  rpc WatchConfigStream(Empty) returns (stream ConfigChangeEvent);

  // Deployments
  rpc TriggerDeploy(DeployRequest) returns (DeployStatus);
  rpc GetDeployStatus(GetDeployStatusRequest) returns (DeployStatus);
  rpc RollbackDeploy(RollbackDeployRequest) returns (DeployStatus);
  rpc WatchDeployProgress(GetDeployStatusRequest) returns (stream DeployProgressEvent);

  // Scaling policies
  rpc CreateScalingPolicy(ScalingPolicy) returns (ScalingPolicy);
  rpc UpdateScalingPolicy(ScalingPolicy) returns (ScalingPolicy);
  rpc DeleteScalingPolicy(DeleteScalingPolicyRequest) returns (Empty);
  rpc ListScalingPolicies(Empty) returns (ScalingPolicies);

  // Health
  rpc GetFleetHealth(Empty) returns (FleetHealth);
  rpc WatchFleetHealth(Empty) returns (stream FleetHealthEvent);

  // Alerts
  rpc ListAlertRules(Empty) returns (AlertRules);
  rpc CreateAlertRule(AlertRule) returns (AlertRule);
  rpc ListFiringAlerts(Empty) returns (Alerts);
  rpc SilenceAlert(SilenceAlertRequest) returns (SilenceAlertResponse);
}
```

### 6.5 MCP Tools for Fleet Management

Five new MCP tools in `open-sse/mcp-server/server.ts`:

| Tool                    | Description                      | Input Schema                            | Auth Scope   |
| ----------------------- | -------------------------------- | --------------------------------------- | ------------ |
| `fleet_list_nodes`      | List all fleet nodes with status | `{ region?: string, status?: string }`  | fleet:read   |
| `fleet_get_node`        | Get detailed node info           | `{ node_id: string }`                   | fleet:read   |
| `fleet_drain_node`      | Gracefully drain node            | `{ node_id: string, reason?: string }`  | fleet:write  |
| `fleet_push_config`     | Push config to nodes             | `{ config: object, nodes?: string[] }`  | fleet:admin  |
| `fleet_get_health`      | Fleet health summary             | `{}`                                    | fleet:read   |
| `fleet_create_policy`   | Create scaling policy            | `{ name, metric, threshold, min, max }` | fleet:admin  |
| `fleet_trigger_rollout` | Trigger fleet rollout            | `{ version, strategy: "rolling"         | "canary" }`  | fleet:deploy |
| `fleet_rollback`        | Rollback deployment              | `{ deploy_id: string }`                 | fleet:deploy |

---

## 7. Compute-Aware Scheduling &amp; System Load Factoring

### 7.1 Management Agent Design

A lightweight sidecar (`crates/omniroute-agent/` in Rust, <5MB binary):

```rust
// System metrics collector (Rust)
pub struct SystemMetrics {
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub io: IoMetrics,
    pub network: NetworkMetrics,
    pub gpu: Option<GpuMetrics>,    // Optional — NVIDIA only
    pub process: ProcessMetrics,    // Own process
}

pub struct CpuMetrics {
    pub utilization_pct: f64,       // 0.0 - 100.0
    pub load_avg_1m: f64,           // /proc/loadavg
    pub load_avg_5m: f64,
    pub load_avg_15m: f64,
    pub context_switches: u64,      // /proc/stat
    pub procs_running: u64,         // Runnable processes
    pub procs_blocked: u64,         // Uninterruptible sleep
}

pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
    pub cached_bytes: u64,
    pub buffers_bytes: u64,
}

pub struct IoMetrics {
    pub read_bytes_per_sec: f64,    // /proc/diskstats
    pub write_bytes_per_sec: f64,
    pub iops_read: f64,
    pub iops_write: f64,
    pub io_wait_pct: f64,           // /proc/stat (procs_blocked / procs_total)
    pub avg_queue_depth: f64,
}

pub struct NetworkMetrics {
    pub rx_bytes_per_sec: f64,      // /proc/net/dev
    pub tx_bytes_per_sec: f64,
    pub rx_packets_per_sec: f64,
    pub tx_packets_per_sec: f64,
    pub rx_dropped_per_sec: f64,
    pub tx_dropped_per_sec: f64,
    pub tcp_connections_established: u64,  // /proc/net/snmp
}

pub struct GpuMetrics {
    pub utilization_pct: f64,       // nvidia-smi GPU-Util
    pub memory_used_mib: u64,
    pub memory_total_mib: u64,
    pub temperature_c: f64,         // Degrees Celsius
    pub power_draw_watts: f64,
    pub pcie_bandwidth_util: f64,   // PCIe gen utilization
}

pub struct ProcessMetrics {
    pub memory_rss_bytes: u64,      // Own process RSS
    pub cpu_percent: f64,           // Own process CPU
    pub open_fds: u64,              // /proc/self/fd count
    pub thread_count: u64,
}

pub struct CompositeHealthScore {
    pub score: f64,                 // 0.0 (dead) - 1.0 (perfect)
    pub components: HealthComponents,
}

pub struct HealthComponents {
    pub cpu: f64,           // 1 - (cpu_util / 100)
    pub memory: f64,        // 1 - (mem_used / mem_total)
    pub io: f64,            // 1 - min(io_wait / 50, 1)  (50% = 0)
    pub network: f64,       // 1 - min(drop_rate / 0.05, 1) (5% drop = 0)
    pub gpu: f64,           // 1 - (gpu_util / 100) or 1.0 if no GPU
    pub requests: f64,      // 1 - (active_req / max_concurrent)
}
```

**Agent API** (port 9099):

```
GET  /healthz          → 200 OK (liveness)
GET  /readyz           → 200 OK when accepting traffic (readiness)
GET  /system-load      → JSON SystemMetrics (for routing)
GET  /metrics          → Prometheus text format
GET  /health-score     → { score: 0.87, components: {...} }
POST /drain            → { ok, deadline: "2026-07-08T12:00:00Z" }
POST /config           → { ok, version: "abc123" }
POST /kill-switch      → { ok, reason: "operator request" }
```

### 7.2 Routing Integration

**At the Regional LB** (service mesh level):

```yaml
# Istio DestinationRule for locality + load-aware routing
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: omniroute-locality-lb
  namespace: omniroute
spec:
  host: omniroute.omniroute.svc.cluster.local
  trafficPolicy:
    connectionPool:
      http:
        http1MaxPendingRequests: 1024
        http2MaxRequests: 1024
        maxRequestsPerConnection: 100
    loadBalancer:
      localityLbSetting:
        enabled: true
        failover:
          - from: us-east-1
            to: us-east-2
          - from: us-east-2
            to: us-west-2
      consistentHash:
        httpHeaderName: x-omniroute-session-id
        minimumRingSize: 512
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

**At the Application level** (combo routing):

```typescript
// open-sse/services/combo/systemLoadAdapter.ts
class SystemLoadAdapter {
  private agentClient: AgentClient;
  private cache: Map<string, { score: number; timestamp: number }>;
  private cacheTTL = 2000; // 2s

  async getNodeHealthScore(): Promise<number> {
    // Local agent is always accessible at localhost:9099
    const cached = this.cache.get("local");
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.score;
    }
    const metrics = await this.agentClient.getSystemLoad();
    const score = this.computeScore(metrics);
    this.cache.set("local", { score, timestamp: Date.now() });
    return score;
  }

  async getRemoteNodeHealth(nodeIds: string[]): Promise<Map<string, number>> {
    // Fetch remote node health via gRPC or NATS
    const results = new Map<string, number>();
    const uncached = nodeIds.filter(id => {
      const cached = this.cache.get(id);
      return !cached || Date.now() - cached.timestamp >= this.cacheTTL;
    });
    // Batch fetch from management plane
    const healthMap = await this.fleetClient.batchGetHealth(uncached);
    for (const [id, score] of healthMap) {
      this.cache.set(id, { score, timestamp: Date.now() });
      results.set(id, score);
    }
    return results;
  }

  private computeScore(m: SystemMetrics): number {
    const cpu = 1 - Math.min(m.cpu.utilization_pct / 100, 1);
    const mem = m.memory.available_bytes / m.memory.total_bytes;
    const io = 1 - Math.min(m.io.io_wait_pct / 50, 1);
    const net = 1 - Math.min(m.network.rx_dropped_per_sec /
      Math.max(m.network.rx_packets_per_sec, 1), 1);
    const gpu = m.gpu
      ? 1 - Math.min(m.gpu.utilization_pct / 100, 1)
      : 1.0;
    const reqScore = ...;  // from combo metrics

    return 0.25 * cpu + 0.20 * mem + 0.10 * io + 0.10 * net +
           0.15 * gpu + 0.20 * reqScore;
  }
}
```

### 7.3 GPU &amp; Accelerator Integration

For nodes running SLM inference (vLLM, MLX, llama.cpp):

```
GPU Metrics Flow:
  nvidia-smi / nvml
       │
       ▼
  Management Agent (port 9099)
  ┌─ /system-load includes GPU metrics
  │  - utilization_pct, memory_used/total, temperature, power
  │  - memory_bandwidth_util_pct (NVML)
  └─ Agent re-exports via Prometheus
       │
       ▼
  Routing Decision:
  ┌─ If GPU mem > 85%: deprioritize GPU-dependent providers
  ├─ If GPU temp > 85°C: reduce weight by 50%
  └─ If GPU mem < 50%: prefer for batch/summarization tasks
```

---

## 8. Implementation Phases

### Phase 0: Foundation (Weeks 1-3) — 12 items

| #    | Task                                | File(s)                                             | Deliverable                                        | Owner |
| ---- | ----------------------------------- | --------------------------------------------------- | -------------------------------------------------- | ----- |
| 0.1  | Node health agent (Rust)            | `crates/omniroute-agent/`                           | Binary <5MB, system metrics, health endpoints      | Rust  |
| 0.2  | EWMA tracker implementation         | `open-sse/services/combo/ewmaTracker.ts`            | EwmaState, updateEwma(), integrated into P2C       | TS    |
| 0.3  | System load adapter                 | `open-sse/services/combo/systemLoadAdapter.ts`      | SystemLoadAdapter class, health score compute      | TS    |
| 0.4  | Consistent hashing strategy         | `open-sse/services/combo/consistentHashStrategy.ts` | New strategy, jump hash, session affinity          | TS    |
| 0.5  | Fleet DB schema + migrations        | `src/lib/db/migrations/101-105_*.sql`               | fleet_nodes, fleet_config, scaling_policies tables | TS    |
| 0.6  | Fleet node CRUD                     | `src/lib/db/fleetNodes.ts`, `fleetConfig.ts`        | Data access layer for fleet state                  | TS    |
| 0.7  | Prometheus metric export (agent)    | `crates/omniroute-agent/src/metrics.rs`             | /metrics endpoint, 10 metric families              | Rust  |
| 0.8  | KEDA ScaledObject manifest          | `deploy/k8s/fleet/scaled-object.yaml`               | KEDA Prometheus scaler config                      | Ops   |
| 0.9  | VPA manifest                        | `deploy/k8s/fleet/vpa.yaml`                         | VPA recommendation profile                         | Ops   |
| 0.10 | Spot node PDB                       | `deploy/k8s/fleet/pdb.yaml`                         | PodDisruptionBudget 50% min                        | Ops   |
| 0.11 | Fleet health check types (protobuf) | `src/lib/fleet/proto/`                              | Shared types for REST/gRPC/MCP                     | TS    |
| 0.12 | Testing: EWMA + P2C benchmark       | `tests/unit/fleet/ewma-benchmark.test.ts`           | Validates EWMA reduces tail latency                | TS    |

**Validation Gate**: Agent reports metrics; EWMA + P2C beats vanilla P2C in p99 by 10%; consistent hashing routes session IDs to stable targets.

### Phase 1: Management Plane (Weeks 4-7) — 14 items

| #    | Task                        | File(s)                                             | Deliverable                         |
| ---- | --------------------------- | --------------------------------------------------- | ----------------------------------- |
| 1.1  | Fleet REST API v2           | `src/app/api/v2/fleet/*/route.ts`                   | Full CRUD, SSE stream               |
| 1.2  | Fleet gRPC service          | `src/lib/fleet/grpc/server.ts`                      | Connect/gRPC server                 |
| 1.3  | gRPC client SDK             | `src/lib/fleet/grpc/client.ts`                      | Client library for nodes            |
| 1.4  | NATS config sync            | `src/lib/fleet/configSync.ts`                       | Config push/subscribe via JetStream |
| 1.5  | CLI: fleet commands         | `bin/fleet.mjs` (or extend omniroute.mjs)           | 10+ subcommands                     |
| 1.6  | GUI: fleet topology page    | `src/app/dashboard/fleet/topology/page.tsx`         | Force-directed graph, health badges |
| 1.7  | GUI: node list page         | `src/app/dashboard/fleet/nodes/page.tsx`            | DataTable, filters, search          |
| 1.8  | GUI: node detail page       | `src/app/dashboard/fleet/nodes/[id]/page.tsx`       | Gauges, sparklines, logs            |
| 1.9  | GUI: config editor page     | `src/app/dashboard/fleet/config/page.tsx`           | Monaco editor, diff, validation     |
| 1.10 | GUI: deploy manager page    | `src/app/dashboard/fleet/deploy/page.tsx`           | Timeline, rollout progress          |
| 1.11 | GUI: scaling policies page  | `src/app/dashboard/fleet/scaling/page.tsx`          | Policy CRUD, chart                  |
| 1.12 | GUI: alerts page            | `src/app/dashboard/fleet/alerts/page.tsx`           | Rules, firing, silences             |
| 1.13 | MCP: fleet tools            | `open-sse/mcp-server/tools/fleet.ts`                | 8 new MCP tools                     |
| 1.14 | argis-ext: fleet CLI + gRPC | `cmd/bifrost/cli/fleet.go`, `api/fleet_handlers.go` | bifrost fleet join/leave/status     |

**Validation Gate**: Can list nodes, view health, push config, edit policies from all 3 surfaces (CLI/GUI/API).

### Phase 2: Elastic Scaling (Weeks 8-10) — 10 items

| #    | Task                              | File(s)                                   | Deliverable                          |
| ---- | --------------------------------- | ----------------------------------------- | ------------------------------------ |
| 2.1  | KEDA ScaledObject per cluster     | `deploy/k8s/fleet/keda/*.yaml`            | Canary + production profiles         |
| 2.2  | Custom metric export (TS)         | `open-sse/services/metrics/export.ts`     | Queue depth, throughput, error rate  |
| 2.3  | HPA with custom metrics           | `deploy/k8s/fleet/hpa.yaml`               | HPA manifest referencing Prometheus  |
| 2.4  | Reactive scaler controller        | `src/lib/scaling/reactiveScaler.ts`       | Desired replicas from current metric |
| 2.5  | Scaling policy evaluation engine  | `src/lib/scaling/policyEngine.ts`         | Evaluate all policies → actions      |
| 2.6  | Predictive scaler (stub)          | `src/lib/scaling/predictiveScaler.ts`     | Interface + Prophet connector        |
| 2.7  | Spot instance drain handler       | `crates/omniroute-agent/src/control.rs`   | Pre-drain hook, connection drain     |
| 2.8  | Kill switch integration           | `open-sse/services/bifrostKillSwitch.ts`  | Auto-reset on scale-up               |
| 2.9  | argis-ext: scaling cost optimizer | `costengine/scaling.go`                   | Cost-aware scale recommendations     |
| 2.10 | Testing: scaling convergence      | `tests/fleet/scaling-convergence.test.ts` | Validates scale-up/scale-down timing |

**Validation Gate**: KEDA scales pods on queue depth spike (2x in 3min); spot interruption triggers graceful drain; predictive stub returns forecast.

### Phase 3: Multi-Cluster Federation (Weeks 11-14) — 11 items

| #    | Task                         | File(s)                                   | Deliverable                          |
| ---- | ---------------------------- | ----------------------------------------- | ------------------------------------ |
| 3.1  | Cross-cluster state sync     | `src/lib/fleet/stateSync.ts`              | NATS JetStream replicated state      |
| 3.2  | Region-aware routing         | `src/lib/fleet/regionRouter.ts`           | Latency steering by region           |
| 3.3  | Global LB config (Terraform) | `deploy/terraform/global-lb/`             | Cloudflare + Route53 + health checks |
| 3.4  | Edge POP lite routing        | Cloudflare Worker or Fly.io               | Model cache, rate limit, redirect    |
| 3.5  | Canary deploy engine         | `src/lib/fleet/deployManager.ts`          | Weighted DNS, traffic splitting      |
| 3.6  | Rollback automation          | `src/lib/fleet/deployManager.ts` (extend) | Auto-rollback on error rate spike    |
| 3.7  | argis-ext: deploy automation | `cmd/bifrost/cli/deploy/`                 | Fleet-aware deploy commands          |
| 3.8  | Fleet-wide shadow routing    | `shadowRouting.ts` (extend)               | Per-fleet shadow config              |
| 3.9  | Geo-distributed testing      | `tests/fleet/cross-region.test.ts`        | Active-active failover test          |
| 3.10 | Multi-region cost analysis   | `costengine/distributed.go`               | Cross-region cost comparison         |
| 3.11 | Chaos testing setup          | `tests/fleet/chaos/`                      | Chaos Mesh experiments               |

**Validation Gate**: Can deploy to 3 regions; region failover <60s; canary deployment routes 5% traffic.

### Phase 4: Advanced Optimization (Weeks 15-18) — 10 items

| #    | Task                               | File(s)                                | Deliverable                             |
| ---- | ---------------------------------- | -------------------------------------- | --------------------------------------- |
| 4.1  | GPU-aware routing                  | `gpuAwareAdapter.ts`, `nvidia-metrics` | GPU mem/temp → routing weight           |
| 4.2  | NUMA-aware dispatch                | `crates/omniroute-agent/src/numa.rs`   | NUMA topology discovery, thread binding |
| 4.3  | Predictive scaling (full)          | `predictiveScaler.ts`                  | Prophet model training + inference      |
| 4.4  | Cost-optimized distributed routing | `costengine/distributed.go`            | Cross-region cost optimization          |
| 4.5  | Hybrid cloud-edge GA               | Cloudflare Worker                      | Production edge POP routing             |
| 4.6  | Fleet-wide chaos GA                | Chaos Mesh                             | Automated fault injection               |
| 4.7  | Thermal-aware scheduling           | `crates/omniroute-agent`               | Thermal throttle detection              |
| 4.8  | TCP BBR congestion control         | sysctl config                          | Network optimization                    |
| 4.9  | Fleet analytics dashboard          | `src/app/dashboard/fleet/analytics/`   | Cost trends, capacity planning          |
| 4.10 | Final SOTA audit + report          | `docs/fleet/SOTA-AUDIT.md`             | Gap analysis vs research                |

**Validation Gate**: Predictive scaling MAE <20%; cost optimization saves 15%; GPU-aware routing prevents OOM.

---

## 9. SOTA Patterns to Adopt

### 9.1 From Academic Research

| Paper                                                               | Year | Key Insight                              | Integration                      | Phase |
| ------------------------------------------------------------------- | ---- | ---------------------------------------- | -------------------------------- | ----- |
| "Power of Two Choices" (Mitzenmacher)                               | 2001 | O(log log n) with 2 samples              | EWMA + P2C enhancement           | 0     |
| "The Tail at Scale" (Dean &amp; Barroso)                            | 2013 | Hedged requests 10x tail reduction       | True hedge (fire-all-take-first) | 2     |
| "Maglev" (Eisenbud et al.)                                          | 2016 | Consistent hashing, bounded load         | Jump consistent hash strategy    | 0     |
| "Large-Scale Cluster Management at Google with Borg" (Verma et al.) | 2015 | Resource estimation, priority preemption | System load factoring            | 0     |
| "Autopilot" (Rzadca et al.)                                         | 2020 | ML-based resource prediction             | Predictive scaling               | 4     |
| "Omega: flexible, scalable schedulers" (Schwarzkopf et al.)         | 2013 | Parallel scheduling, shared state        | Parallel scaling decisions       | 2     |
| "Shard Manager" (Wu et al.)                                         | 2019 | FSM-driven shard management              | Fleet node state machine         | 1     |

### 9.2 From Production Systems

| System                 | Pattern                                        | Adoption                            | Phase |
| ---------------------- | ---------------------------------------------- | ----------------------------------- | ----- |
| **Google Borg**        | Resource estimation + oversubscription         | Health agent + system load factors  | 0     |
| **Netflix/Zuul**       | Dynamic routing rules, pressure-based weights  | EwmaTracker + PeakEwma              | 0     |
| **Lyft/Envoy**         | P2C + EWMA, outlier detection, panic threshold | KEDA + HPA, outlier ejection        | 0/2   |
| **AWS ALB**            | Least outstanding requests, slow start         | Connection pool depth metric        | 0     |
| **Kubernetes HPA/VPA** | Custom metrics, stabilization windows          | KEDA ScaledObject, scaling policies | 2     |
| **KEDA**               | Event-driven scaling, formula composability    | Prometheus scaler, queue depth      | 2     |
| **Cloudflare**         | Anycast global LB, edge workers                | Edge POP lite routing               | 3     |

### 9.3 Novel Contributions from This Plan

| Novel Element                          | Description                           | SOTA Basis                            |
| -------------------------------------- | ------------------------------------- | ------------------------------------- |
| **System-Load-Weighted P2C**           | P2C scoring × composite system health | Extension of Mitzenmacher + Borg      |
| **AI-Specific Composite Health**       | CPU+mem+IO+net+GPU+request-depth      | Custom for LLM proxy workload         |
| **Cost-Optimized Distributed Routing** | Cross-region $/request optimization   | Extension of OmniRoute cost strategy  |
| **Fleet Management MCP Tools**         | Fleet ops via AI agent tools          | Novel — no AI proxy offers this       |
| **Edge POP Lite Routing**              | Cloudflare Workers + full region      | Custom hybrid cloud-edge architecture |
| **Adaptive Predictive Scaling**        | Prophet + reactive hybrid             | Autopilot-inspired for LLM traffic    |

---

## 10. Risk Assessment &amp; Mitigation

| Risk                                | Probability | Impact | Mitigation                                                                      | Phase |
| ----------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------- | ----- |
| **EWMA tuning incorrect**           | Medium      | Medium | Auto-tune α/β via bandit over 7 days; default α=0.3, β=0.5                      | 0     |
| **Distributed state inconsistency** | Medium      | High   | NATS JetStream ordered delivery; leader-based config; drift detection every 60s | 1     |
| **Agent overhead on host**          | Low         | Low    | Rust binary <5MB, 1s poll interval, no syscalls on hot path                     | 0     |
| **Cross-region latency**            | High        | Medium | Edge POP lite routing + cloud region; DNS latency steering                      | 3     |
| **Spot interruption**               | Medium      | Medium | Pre-drain hook, 2-min window, kill-switch auto-fallback                         | 2     |
| **Config explosion**                | Low         | High   | Versioned SHA-256; drift detection; auto-rollback on validation failure         | 1     |
| **Scaling oscillation**             | Medium      | Medium | HPA stabilization windows (scale-up 60s, scale-down 300s); KEDA cooldown 60s    | 2     |
| **gRPC backpressure**               | Low         | Medium | Per-node flow control; NATS buffering for offline nodes                         | 1     |
| **GPU memory fragmentation**        | Low         | Medium | Route by GPU mem %; defragmentation on low-util window                          | 4     |
| **Predictive model drift**          | Medium      | Medium | Weekly retraining; fallback to reactive on MAE > 20%                            | 4     |
| **MCP tool security**               | Low         | High   | Fleet scopes: fleet:read/write/admin/deploy; separate from provider scopes      | 1     |
| **Operator error (bad config)**     | Medium      | High   | Dry-run validation, config diff preview, auto-rollback on error spike           | 1     |

---

## 11. Metrics &amp; Success Criteria

### 11.1 Key Performance Indicators

| KPI                          | Baseline  | Phase 1   | Phase 2   | Phase 4    |
| ---------------------------- | --------- | --------- | --------- | ---------- |
| **p50 latency**              | 800ms     | 700ms     | 550ms     | 400ms      |
| **p99 latency**              | 5s        | 4s        | 2.5s      | 1.5s       |
| **Error rate**               | 3%        | 2%        | 1%        | 0.5%       |
| **Throughput/node**          | 100 req/s | 200 req/s | 500 req/s | 2000 req/s |
| **Nodes per cluster**        | 1-2       | 3-10      | 10-50     | 50-200     |
| **Config propagation**       | N/A       | 10s       | 5s global | 2s global  |
| **Scale-up time**            | Manual    | 5min      | 90s       | 60s        |
| **Fleet availability**       | 99.9%     | 99.95%    | 99.99%    | 99.995%    |
| **Node utilization balance** | N/A       | ±30%      | ±15%      | ±10%       |

### 11.2 Validation Gates

| Gate                          | Phase | Criteria                                             | Measurement                |
| ----------------------------- | ----- | ---------------------------------------------------- | -------------------------- |
| **G0: Agent works**           | 0     | System metrics within 2% of `top`/`free`             | Compare readings, N=100    |
| **G1: EWMA beats P2C**        | 0     | p99 -10% vs vanilla P2C over 7 days                  | A/B test, 50% traffic each |
| **G2: Consistent hashing**    | 0     | 90%+ session stickiness rate                         | Same session → same node   |
| **G3: Fleet API**             | 1     | 100% CRUD coverage at 200 req/s                      | Load test                  |
| **G4: Config push**           | 1     | 5 nodes synced in <10s                               | Timestamp comparison       |
| **G5: KEDA scaling**          | 2     | Pods double in 3min of queue depth spike             | Load generation            |
| **G6: Spot drain**            | 2     | 0 dropped requests during drain                      | Load + spot simulation     |
| **G7: Cross-region failover** | 3     | <60s to full recovery, <5% errors                    | Region kill test           |
| **G8: Canary deploy**         | 3     | 5% traffic to canary, auto-rollback on 3% error rate | Deploy experiment          |
| **G9: Predictive scaling**    | 4     | MAE <20% vs actual                                   | 14-day history replay      |
| **G10: GPU routing**          | 4     | 0 OOM events from GPU over-allocation                | 7-day stress test          |

### 11.3 Success Criteria

The project is considered successful when:

1. **Fleet operates at 3+ regions** with active-active traffic distribution
2. **Auto-scaling converges within 90s** of load changes (up or down)
3. **System load factoring improves cluster-wide p50 by 15%** vs load-unaware routing
4. **Unified management plane** provides full fleet control from any of GUI/CLI/API/MCP
5. **Zero-downtime deployments** achieved via rolling update + canary + rollback
6. **Cost savings of 15%+** realized through predictive scaling + distributed cost optimization
7. **All SOTA patterns** documented and auditable against academic and production references

---

## Appendices

### A. File Inventory: New Files

**OmniRoute** (`diegosouzapw/OmniRoute`):

```
src/
├── app/api/v2/fleet/
│   ├── nodes/route.ts
│   ├── nodes/[id]/route.ts
│   ├── nodes/[id]/metrics/route.ts
│   ├── nodes/[id]/drain/route.ts
│   ├── config/route.ts
│   ├── config/history/route.ts
│   ├── deploy/route.ts
│   ├── deploy/[id]/route.ts
│   ├── deploy/[id]/rollback/route.ts
│   ├── scaling/policies/route.ts
│   ├── scaling/policies/[id]/route.ts
│   ├── health/route.ts
│   ├── health/events/route.ts
│   └── alerts/
│       ├── rules/route.ts
│       ├── rules/[id]/route.ts
│       ├── firing/route.ts
│       └── silence/route.ts
├── app/dashboard/fleet/
│   ├── topology/page.tsx
│   ├── nodes/page.tsx
│   ├── nodes/[id]/page.tsx
│   ├── config/page.tsx
│   ├── deploy/page.tsx
│   ├── scaling/page.tsx
│   ├── alerts/page.tsx
│   └── analytics/page.tsx
├── lib/
│   ├── db/fleetNodes.ts
│   ├── db/fleetConfig.ts
│   ├── db/scalingPolicies.ts
│   ├── fleet/
│   │   ├── types.ts
│   │   ├── nodeHealth.ts
│   │   ├── configSync.ts
│   │   ├── stateMachine.ts
│   │   ├── regionRouter.ts
│   │   ├── deployManager.ts
│   │   ├── stateSync.ts
│   │   └── proto/
│   │       ├── fleet.proto
│   │       └── generated/
│   ├── fleet/grpc/
│   │   ├── server.ts
│   │   └── client.ts
│   └── scaling/
│       ├── types.ts
│       ├── metricsCollector.ts
│       ├── reactiveScaler.ts
│       ├── predictiveScaler.ts
│       ├── policyEngine.ts
│       └── proto/
│           └── scaling.proto
├── bin/fleet.mjs
├── open-sse/
│   ├── services/combo/
│   │   ├── ewmaTracker.ts
│   │   ├── systemLoadAdapter.ts
│   │   └── consistentHashStrategy.ts
│   ├── services/metrics/
│   │   └── export.ts
│   ├── executors/gpuAwareAdapter.ts (Phase 4)
│   └── mcp-server/tools/
│       └── fleet.ts
└── crates/omniroute-agent/
    ├── Cargo.toml
    └── src/
        ├── main.rs
        ├── metrics.rs
        ├── health.rs
        ├── control.rs
        ├── numa.rs (Phase 4)
        └── tests/

deploy/
├── k8s/fleet/
│   ├── namespace.yaml
│   ├── service-account.yaml
│   ├── omniroute-deployment.yaml
│   ├── bifrost-deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── vpa.yaml
│   ├── scaled-object.yaml
│   ├── configmap.yaml
│   └── monitoring/
│       ├── service-monitor.yaml
│       └── prometheus-rule.yaml
├── terraform/
│   ├── global-lb/
│   │   ├── cloudflare.tf
│   │   ├── route53.tf
│   │   └── variables.tf
│   └── regions/
│       ├── us-east-1.tf
│       ├── eu-west-1.tf
│       └── ap-south-1.tf

tests/
└── fleet/
    ├── ewma-benchmark.test.ts
    ├── consistent-hash.test.ts
    ├── fleet-api.test.ts
    ├── scaling-convergence.test.ts
    ├── cross-region.test.ts
    └── chaos/
        ├── network-delay.yaml
        ├── pod-kill.yaml
        └── region-failover.yaml
```

**argis-extensions** (`kooshapari/argis-extensions`):

```
cmd/bifrost/cli/fleet.go
api/fleet_handlers.go
api/fleet.proto
costengine/
├── distributed.go
└── scaling.go
infra/nats/config_sync.go
```

### B. Dependencies

| Package                      | Version                 | For                                | Phase |
| ---------------------------- | ----------------------- | ---------------------------------- | ----- |
| `@nats-io/nats.js`           | ^2.x                    | NATS JetStream                     | 0     |
| `@opentelemetry/sdk-metrics` | ^2.x                    | Custom metrics                     | 0     |
| `xxhash-wasm`                | ^1.x                    | Consistent hashing (already a dep) | 0     |
| `sysinfo` (Rust)             | ^0.x                    | System metrics                     | 0     |
| `tokio` (Rust)               | ^1.x                    | Async agent runtime                | 0     |
| `axum` (Rust)                | ^0.x                    | Agent HTTP server                  | 0     |
| `prophet-rs` (Rust)          | ^0.x (or Python thrift) | Predictive scaling                 | 4     |

---

_End of Plan — v1.0 — 2026-07-08_
