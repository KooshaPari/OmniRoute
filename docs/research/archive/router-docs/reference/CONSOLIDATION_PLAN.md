# Consolidation & Implementation Plan

## vibeproxy (multi-platform) + bifrost-extensions (zero-fork backend)

**Date**: 2025-11-30
**Status**: Ready for Implementation

---

## Executive Summary

This plan consolidates **ALL** previous work into a cohesive two-component architecture:

1. **vibeproxy** - Multi-platform native app (Swift/macOS, WinUI3/Windows, TBD/Linux)
2. **bifrost-extensions** - Go backend that wraps/extends Bifrost, agentapi, CLIProxyAPI via zero-fork architecture

The system provides intelligent LLM routing, local model management, role-based routing, 3-pillar optimization (Speed↑ Quality↑ Cost↓), tiered episodic learning, and comprehensive observability.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VIBEPROXY (FRONTEND)                             │
│                                                                          │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐    │
│  │   macOS (Swift)  │   │ Windows (WinUI3) │   │  Linux (TBD)     │    │
│  │  - SwiftUI       │   │  - WinUI 3       │   │  - Qt/Avalonia?  │    │
│  │  - Native menus  │   │  - Fluent Design │   │  - Cross-platform│    │
│  │  - Tray app      │   │  - System tray   │   │  - Desktop env   │    │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘    │
│                                  │                                       │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │
                         gRPC/HTTP │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    BIFROST-EXTENSIONS (BACKEND)                         │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    PLUGIN ARCHITECTURE                            │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │  │
│  │  │ IntelligentRtr │  │ Learning Plugin│  │ Smart Fallback │      │  │
│  │  │ - Arch-Router  │  │ - 3-Pillar Opt │  │ - Health Check │      │  │
│  │  │ - RouteLLM     │  │ - Tiered Learn │  │ - Auto Fallback│      │  │
│  │  │ - MIRT-BERT    │  │ - Profile Mgmt │  │ - Cost Backoff │      │  │
│  │  │ - Byzantine    │  │ - Voyage Emb   │  │                │      │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                  │                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    UPSTREAM WRAPPERS (Zero-Fork)                  │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │  │
│  │  │ Bifrost Core   │  │ agentapi       │  │ CLIProxyAPI    │      │  │
│  │  │ (go.mod)       │  │ (go.mod)       │  │ (go.mod)       │      │  │
│  │  │ - Semantic     │  │ - Agent State  │  │ - OAuth PKCE   │      │  │
│  │  │ - MCP Client   │  │ - SSE Events   │  │ - Token Mgmt   │      │  │
│  │  │ - Providers    │  │ - CLI Protocol │  │ - Proxy Auth   │      │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                  │                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    INFRASTRUCTURE LAYER                           │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │  │
│  │  │ PostgreSQL     │  │ Neo4j Aura     │  │ NATS/Redis     │      │  │
│  │  │ + pgvector     │  │ Multi-tenant   │  │ Upstash/Local  │      │  │
│  │  │ + pg_trgm      │  │ Graph Policies │  │ Async Jobs     │      │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘      │  │
│  │  ┌────────────────┐  ┌────────────────┐                          │  │
│  │  │ Upstash Wrkflw │  │ Hatchet        │                          │  │
│  │  │ Simple Durable │  │ Complex Orchst │                          │  │
│  │  └────────────────┘  └────────────────┘                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                          LLM PROVIDERS & SLMs
```

---

## Component 1: vibeproxy (Multi-Platform Frontend)

### Current State (macOS Only)

- ✅ SwiftUI menu bar app
- ✅ Service management (Bifrost, SLM servers, etc.)
- ✅ Role-based local model management (ModelRole enum)
- ✅ Server/Client mode switching
- ✅ Remote SLM server connection
- ✅ Cloudflare Tunnel integration

### Target: Multi-Platform Support

#### macOS (Current - Swift/SwiftUI)

**Status**: ✅ Implemented
**Maintain**:

- Native menu bar experience
- SwiftUI for settings/configuration
- macOS-specific service management
- System tray integration

#### Windows (New - WinUI3/C#)

**Status**: ❌ Not Started
**Implementation**:

```
vibeproxy/windows/
├── VibeProxy.sln                    # Visual Studio solution
├── VibeProxy/
│   ├── App.xaml                     # WinUI 3 app definition
│   ├── MainWindow.xaml              # Main settings window
│   ├── TrayIcon.cs                  # System tray implementation
│   ├── Services/
│   │   ├── ServerManager.cs         # Port from Swift
│   │   ├── LocalModelManager.cs     # Port from Swift
│   │   └── RemoteProfileManager.cs  # Port from Swift
│   └── ViewModels/
│       ├── SettingsViewModel.cs
│       └── ModelManagementVM.cs
└── Common/
    └── SharedModels.cs              # Shared data models
```

**Features to Port**:

- System tray with status indicator
- Service start/stop/status monitoring
- Local model configuration (role-based)
- Remote SLM profile management
- Settings persistence (local storage)

**Tech Stack**:

- WinUI 3 (Windows App SDK)
- C# / .NET 8+
- Windows Presentation Foundation (backup)
- gRPC client for backend communication

#### Linux (Future - TBD)

**Status**: 🤔 Research Phase
**Options**:

1. **Avalonia UI** (C# cross-platform)
   - Reuse WinUI3 logic
   - Cross-platform XAML
   - Good desktop integration

2. **Qt/C++**
   - Native performance
   - Excellent Linux DE integration
   - More complex

3. **Tauri + Svelte**
   - Web tech (Rust backend)
   - Lightweight
   - Modern UI

**Decision Criteria**:

- Code reuse with Windows (prefer Avalonia)
- Desktop environment integration quality
- System tray support across DEs
- Community support

### Shared Functionality (All Platforms)

1. **Service Management**
   - Start/stop/restart services
   - Status monitoring
   - Log viewing
   - Auto-restart on crash

2. **Local Model Management**
   - Role-based configuration
   - Backend selection (MLX, vLLM, Ollama, llamaCpp, ExLLaMAv2)
   - Resource allocation (VRAM, threads)
   - Model download/update

3. **Remote SLM Profiles**
   - Connection to remote SLM servers
   - Authentication (if needed)
   - Status monitoring
   - Failover configuration

4. **Settings Sync**
   - Cloud sync option (via backend API)
   - Local-first architecture
   - Conflict resolution

### Communication Protocol

**Backend ↔ Frontend**:

```protobuf
service VibeProxyService {
  // Service Management
  rpc StartService(ServiceRequest) returns (ServiceResponse);
  rpc StopService(ServiceRequest) returns (ServiceResponse);
  rpc GetServiceStatus(ServiceRequest) returns (ServiceStatus);

  // Local Model Management
  rpc ListModels(Empty) returns (ModelList);
  rpc ConfigureModel(ModelConfig) returns (ModelResponse);
  rpc GetModelStatus(ModelRequest) returns (ModelStatus);

  // Remote Profiles
  rpc ListProfiles(Empty) returns (ProfileList);
  rpc ConnectProfile(ProfileRequest) returns (ProfileResponse);
  rpc TestConnection(ProfileRequest) returns (ConnectionStatus);

  // Settings
  rpc GetSettings(Empty) returns (Settings);
  rpc UpdateSettings(Settings) returns (SettingsResponse);
}
```

---

## Component 2: bifrost-extensions (Go Backend)

### Zero-Fork Architecture

**Core Principle**: Import upstream projects via Go modules, extend via plugins, never fork.

```go
// go.mod
module github.com/kooshapari/bifrost-extensions

require (
    github.com/maximhq/bifrost/core v1.2.30
    // via replace directive → ../bifrost/core
)

replace github.com/maximhq/bifrost/core => ../bifrost/core
```

**Benefits**:

- ✅ Upstream updates without merge conflicts
- ✅ Clean separation of concerns
- ✅ Contribution-friendly
- ✅ Modular architecture

### Current Implementation Status

#### ✅ Implemented Components

1. **Plugins**
   - `intelligentrouter/` - Multi-router ensemble
   - `learning/` - 3-pillar optimization + tiered learning
   - `smartfallback/` - Intelligent fallback chains
   - `voyage/` - VoyageAI embeddings integration

2. **Wrappers**
   - `agentapi/` - Agent state/events wrapping
   - `cliproxy/` - OAuth PKCE + token management

3. **Infrastructure**
   - `neo4j/` - Multi-tenant graph client
   - `nats/` - Async job queue
   - `redis/` - Hot cache
   - `upstash/` - Workflow + Redis serverless
   - `hatchet/` - Complex orchestration

4. **SLM Integration**
   - `slm/` - Local model clients
   - `slm-server/` - vLLM server management

5. **Database**
   - `db/migrations/` - PostgreSQL schema
   - `db/queries/` - sqlc-generated queries
   - pgvector, pg_trgm, advanced extensions

#### ❌ Missing/Incomplete Components

##### 1. **Router Ensemble Consolidation**

**Current**: Partial implementations
**Needed**:

```go
// plugins/intelligentrouter/ensemble.go
type ByzantineEnsemble struct {
    voters []Router  // Arch-Router, RouteLLM, MIRT-BERT, DeBERTa, Cost-Opt, MIRT-Psychometric
    weights map[string]float64
    minConsensus int  // min 4/6
}

func (e *ByzantineEnsemble) Vote(req *RouteRequest) (*RouteDecision, error) {
    votes := make(map[string]*RouteDecision)
    for _, voter := range e.voters {
        vote, err := voter.Route(req)
        if err != nil {
            // Byzantine tolerance: skip faulty voter
            continue
        }
        votes[voter.Name()] = vote
    }
    return e.WeightedConsensus(votes)
}
```

##### 2. **3-Pillar Optimization System**

**Current**: Stub implementation
**Needed**: Complete implementation from `AI_ML_ARCHITECTURE.md`

- Speed profile (P50/P95/P99 latencies)
- Quality profile (task-specific scores)
- Cost profile (input/output pricing)
- Pareto frontier analysis
- Weighted composite scoring

##### 3. **Tiered Episodic Learning**

**Current**: Partial
**Needed**: Full hierarchy

- Request → PromptChain → Session → Project → User → Global
- Embedding-based similarity search
- Preference aggregation
- Contextual learning

##### 4. **Content Safety Plugin**

**Status**: Deferred (user said "not necessarily a concern")
**Future**: Detoxify + GoEmotions for emotion routing

##### 5. **Upstash Workflow Integration**

**Status**: Scaffolding only
**Needed**:

```go
// infra/upstash/workflows.go
type SimpleWorkflow struct {
    steps []WorkflowStep
}

// Example: Embedding job
func EmbeddingWorkflow(text string) *SimpleWorkflow {
    return &SimpleWorkflow{
        steps: []WorkflowStep{
            {Name: "preprocess", Handler: preprocessText},
            {Name: "embed", Handler: callVoyageAI},
            {Name: "store", Handler: storeToPG},
        },
    }
}
```

##### 6. **Hatchet Complex Orchestration**

**Status**: Scaffolding only
**Needed**:

- DAG workflow definitions
- Ensemble voting workflow
- Multi-agent debate workflow
- Research validation pipeline

##### 7. **VoyageAI Reranker Integration**

**Status**: Embeddings only
**Needed**: Add `rerank-2.5` for result reranking

##### 8. **Full Tool Router**

**Status**: Basic structure
**Needed**: Neo4j-based tool capability graph

##### 9. **Context Folding Plugin**

**Status**: Not implemented
**Needed**: Multi-resolution context packing

##### 10. **Knowledge Graph Policies**

**Status**: Schema only
**Needed**: Policy engine implementation

---

## Database Schema Consolidation

### PostgreSQL Schema (Current)

**Tables Implemented**:

- ✅ `models` - Model registry
- ✅ `model_abilities` - IRT ability vectors
- ✅ `model_metrics` - Benchmark scores
- ✅ `model_semantic_profiles` - Traits, aspects, embeddings
- ✅ `routing_events` - Request logs
- ✅ `bandit_state` - Exploration/exploitation state
- ✅ `tools` - Tool registry
- ✅ `tool_metrics` - Tool performance
- ✅ `embedding_prices` - Voyage AI pricing

**Tables Needed**:

- ❌ `tiered_learning_events` - Hierarchical learning records
- ❌ `prompt_chains` - Multi-turn prompt sequences
- ❌ `sessions` - Conversation sessions
- ❌ `projects` - User projects
- ❌ `user_preferences` - User-level prefs
- ❌ `global_priors` - Global learning priors

### Neo4j Multi-Tenant Schema

**Namespaces** (via label prefixes):

- `bifrost_` - Main routing graph
- `vibeproxy_` - Desktop app graph
- `trace_` - Separate tracing project
- `jarvis_` - Another project

**Nodes Implemented**:

- ✅ `Model` - LLM models
- ✅ `Tool` - MCP tools
- ✅ `Role` - Task roles
- ✅ `Trait` - Semantic traits
- ✅ `Policy` - Routing policies

**Edges Implemented**:

- ✅ `HAS_TRAIT` - Model/Tool → Trait
- ✅ `PERFORMS_ON` - Model → Role
- ✅ `SUITABLE_FOR` - Tool → Role

**Missing**:

- ❌ Knowledge graph for RAG
- ❌ Conversation context graph
- ❌ User preference graph

---

## Implementation Roadmap

### Phase 0: Foundation (Week 1-2)

**Goal**: Stabilize existing code, fill critical gaps

**Tasks**:

1. ✅ Audit all planning docs (DONE - this document)
2. ✅ Map existing code to planned features
3. Complete database migrations
   - Add tiered learning tables
   - Add preference tables
   - Add session/project tables
4. Wire up existing plugins to Bifrost
   - Test PreHook/PostHook chains
   - Verify plugin ordering
   - Add integration tests
5. Document zero-fork architecture
   - Update CLAUDE.md
   - Create CONTRIBUTING.md
   - Add upstream update guide

### Phase 1: Router Consolidation (Week 3-4)

**Goal**: Complete Byzantine ensemble router

**Tasks**:

1. Implement ensemble voting logic
   - Weighted consensus (min 4/6)
   - Byzantine fault tolerance
   - Disagreement logging
2. Integrate all 6 routers
   - Arch-Router (already integrated)
   - RouteLLM (add MF router)
   - MIRT-BERT (complete implementation)
   - DeBERTa classifier (add)
   - Cost-optimizer (implement)
   - MIRT-Psychometric (25-latent variant)
3. Add performance benchmarking
   - Routing accuracy tests
   - Latency benchmarks
   - Cost tracking
4. Wire to cost engine
   - Go/no-go decisions
   - Quota enforcement
   - Fallback triggering

### Phase 2: Learning Systems (Week 5-6)

**Goal**: Complete 3-pillar optimization + tiered learning

**Tasks**:

1. Implement 3-pillar profiles
   - Speed: P50/P95/P99 tracking
   - Quality: Task-specific scores
   - Cost: Real-time pricing
2. Build Pareto frontier analysis
   - Multi-objective optimization
   - Trade-off visualization
   - Adaptive weights
3. Complete tiered learning
   - Request-level caching
   - PromptChain similarity
   - Session context
   - Project patterns
   - User preferences
   - Global priors
4. Integrate VoyageAI embeddings
   - voyage-3.5 for embeddings
   - rerank-2.5 for reranking
   - Caching layer

### Phase 3: Tool & Context Routing (Week 7-8)

**Goal**: Intelligent tool selection + context folding

**Tasks**:

1. Complete tool router
   - Neo4j capability graph
   - Tool-role suitability scoring
   - Dynamic allow-listing
2. Implement context folding
   - Multi-resolution summaries
   - Token budget management
   - Referential tools
   - Summary quality scoring
3. Add summarizer SLM
   - Integrate Qwen2.5-7B or similar
   - Streaming summarization
   - Importance scoring
4. Build context cache
   - pgvector-based similarity
   - Multi-level summaries
   - Expiry policies

### Phase 4: Workflow Orchestration (Week 9-10)

**Goal**: Upstash Workflow + Hatchet integration

**Tasks**:

1. Implement Upstash Workflows
   - Simple job chains
   - Webhook delivery
   - Retry logic
2. Build Hatchet workflows
   - DAG definitions
   - Ensemble voting workflow
   - Multi-agent debate
   - Research validation
3. Integrate with NATS
   - Job dispatch
   - Event streaming
   - Worker pools
4. Add workflow UI (vibeproxy)
   - Workflow status
   - Manual triggers
   - Result viewing

### Phase 5: vibeproxy Multi-Platform (Week 11-14)

**Goal**: Windows support, Linux planning

**Tasks**:

1. Windows Implementation (WinUI3)
   - Project setup
   - Port service manager
   - Port model manager
   - System tray integration
   - Settings UI
2. Shared Backend API
   - gRPC service definition
   - REST fallback
   - Authentication
   - Settings sync
3. Linux Research
   - Evaluate Avalonia vs Qt vs Tauri
   - Prototype chosen framework
   - Test desktop environment integration
4. Cross-Platform Installer
   - macOS: DMG
   - Windows: MSI/MSIX
   - Linux: AppImage/Flatpak/Snap

### Phase 6: Polish & Production (Week 15-16)

**Goal**: Production-ready release

**Tasks**:

1. Performance optimization
   - Router latency <100ms p99
   - Cache hit rate >60%
   - Database query optimization
2. Observability
   - Metrics dashboard
   - Tracing integration
   - Alert rules
3. Documentation
   - User guide
   - API documentation
   - Deployment guide
   - Troubleshooting
4. Testing
   - Integration test suite
   - Load testing
   - Chaos engineering
   - Security audit

---

## Technical Decisions Log

### 1. Why Zero-Fork Architecture?

**Problem**: Forking upstream projects creates merge hell and divergence.

**Solution**: Import via Go modules with `replace` directives.

**Benefit**:

- Upstream updates: `git pull` + `go get -u`
- Clean contribution path
- Modular extensions

### 2. Why Multi-Platform vibeproxy?

**Problem**: Users on different OSes need access.

**Solution**: Native apps per platform, shared backend.

**Benefit**:

- Native UX per platform
- Code reuse in backend
- Unified feature set

### 3. Why Byzantine Ensemble Router?

**Problem**: Single router can fail or be gamed.

**Solution**: 6 diverse routers, weighted voting, min 4/6 consensus.

**Benefit**:

- Fault tolerance (2 Byzantine failures)
- Diverse strategies (learned + heuristic)
- Explainable decisions

### 4. Why Tiered Learning?

**Problem**: One-size-fits-all learning doesn't capture context.

**Solution**: Hierarchical scopes (Request → Global).

**Benefit**:

- Context-aware routing
- User personalization
- Global knowledge accumulation

### 5. Why Upstash + Hatchet?

**Problem**: Simple jobs (Upstash) vs complex workflows (Hatchet).

**Solution**: Use both for different use cases.

**Benefit**:

- Right tool for job complexity
- Cost efficiency (Upstash free tier)
- No redundancy (NATS for pub/sub, not workflows)

---

## Gap Analysis Summary

### Fully Implemented ✅

- PostgreSQL schema (core tables)
- Neo4j multi-tenant client
- NATS async jobs
- Plugin architecture
- agentapi/CLIProxyAPI wrappers
- VoyageAI embeddings plugin
- Cost engine (basic)
- vibeproxy (macOS only)

### Partially Implemented 🟡

- Router ensemble (Arch-Router only)
- 3-pillar optimization (stub)
- Tiered learning (partial)
- Tool router (basic)

### Not Implemented ❌

- Byzantine voting logic
- Complete 3-pillar profiles
- Full tiered learning hierarchy
- Context folding plugin
- Upstash Workflow integration
- Hatchet workflow definitions
- VoyageAI reranker
- vibeproxy Windows/Linux
- Knowledge graph RAG
- Content safety (deferred)

---

## Success Metrics

### Performance

- Router latency: p50 <50ms, p95 <100ms, p99 <200ms
- Semantic cache hit rate: >60%
- 3-pillar optimization: 2x cost reduction vs naive routing
- Byzantine ensemble: <5% disagreement rate

### Quality

- Routing accuracy: >90% vs ground truth
- User satisfaction: >4.5/5 (post-route feedback)
- Model utilization: >80% of quota used efficiently

### Reliability

- Uptime: >99.9%
- Byzantine fault tolerance: 2 failed routers tolerated
- Automatic fallback: <1s to backup model

### Adoption

- vibeproxy installs: 100+ (internal)
- Multi-platform: macOS + Windows + Linux
- API usage: 10K+ routes/day

---

## Next Steps

1. **Immediate** (This Week):
   - Complete gap analysis validation
   - Prioritize Phase 0 tasks
   - Set up project board

2. **Short-term** (Next 2 Weeks):
   - Complete Phase 0: Foundation
   - Begin Phase 1: Router consolidation

3. **Medium-term** (Next Month):
   - Complete Phases 1-2: Routing + Learning
   - Begin Phase 3: Tools + Context

4. **Long-term** (Next Quarter):
   - Complete Phases 3-6: Full production system
   - Multi-platform vibeproxy launch

---

## Appendices

### A. Upstream Projects

| Project     | Version | Update Frequency | Integration |
| ----------- | ------- | ---------------- | ----------- |
| Bifrost     | v1.2.30 | Weekly           | Go modules  |
| agentapi    | Latest  | As needed        | Go modules  |
| CLIProxyAPI | Latest  | As needed        | Go modules  |

### B. External Services

| Service          | Free Tier     | Usage               | Cost (Paid)     |
| ---------------- | ------------- | ------------------- | --------------- |
| Supabase         | 500MB DB      | Postgres + pgvector | $25/mo          |
| Neo4j Aura       | 200K nodes    | Multi-tenant graph  | $65/mo          |
| Upstash Redis    | 256MB         | Hot cache           | $0.20/100K      |
| Upstash Workflow | 500K steps/mo | Simple jobs         | Free            |
| NATS (Synadia)   | 1GB/mo        | Pub/sub             | $0              |
| Hatchet          | 10K runs/mo   | Complex workflows   | Free            |
| VoyageAI         | Free tier     | Embeddings + rerank | $0.10/1M tokens |

### C. Local Model Recommendations

| Role            | Model                  | Size | Hardware   |
| --------------- | ---------------------- | ---- | ---------- |
| Model Router    | Arch-Router-1.5B       | 1.5B | CPU/GPU    |
| Tool Router     | Arch-Router-1.5B       | 1.5B | CPU/GPU    |
| Task Classifier | DeBERTa-v3-base        | 86M  | CPU        |
| Summarizer      | Qwen2.5-7B-4bit        | 7B   | 8GB+ VRAM  |
| Code Assistant  | Qwen2.5-Coder-32B-4bit | 32B  | 24GB+ VRAM |
| Reasoner        | DeepSeek-R1-32B-4bit   | 32B  | 24GB+ VRAM |
| Embedder        | nomic-embed-v1.5       | 137M | CPU        |

---

**Document Version**: 1.0
**Last Updated**: 2025-11-30
**Next Review**: After Phase 0 completion
