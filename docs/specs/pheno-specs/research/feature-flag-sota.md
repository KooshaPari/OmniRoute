# State of the Art: Feature Flag Systems

**Flagward Research Document**  
**Version:** 2.0  
**Status:** Research Complete  
**Last Updated:** 2026-04-04

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Market Landscape](#market-landscape)
3. [Competitive Analysis](#competitive-analysis)
4. [Technical Deep Dives](#technical-deep-dives)
5. [Architecture Patterns](#architecture-patterns)
6. [Evaluation Strategies](#evaluation-strategies)
7. [Security Considerations](#security-considerations)
8. [Performance Benchmarks](#performance-benchmarks)
9. [Integration Patterns](#integration-patterns)
10. [Future Trends](#future-trends)
11. [Recommendations for Flagward](#recommendations-for-flagward)
12. [Appendix A: Detailed Comparisons](#appendix-a-detailed-comparisons)
13. [Appendix B: Technical Specifications](#appendix-b-technical-specifications)
14. [Appendix C: Implementation Examples](#appendix-c-implementation-examples)

---

## Executive Summary

The feature flag (feature toggle) market has evolved from simple configuration management to sophisticated experimentation platforms. This research document analyzes the current state of feature flag systems, examining commercial leaders, open-source alternatives, and emerging technologies to inform Flagward's design decisions.

### Key Findings

1. **Market Consolidation**: LaunchDarkly dominates enterprise with ~$3B valuation and 4,000+ customers; open-source solutions (Unleash, Flagsmith, Flipt) gaining traction
2. **Latency Requirements**: Sub-100ms evaluation is table stakes; sub-10ms expected for high-throughput applications
3. **Local-First Movement**: Edge evaluation and local SDK storage becoming critical for performance
4. **Experimentation Integration**: Feature flags and A/B testing converging into unified platforms
5. **Security Focus**: Audit trails, approval workflows, and access control becoming mandatory

### Market Size and Growth

The global feature flag management market is projected to reach $1.2B by 2028, growing at 23% CAGR. Key drivers:
- DevOps adoption requiring safer deployment practices
- Product-led growth requiring rapid experimentation
- Regulatory compliance requiring audit trails
- Microservices complexity requiring dynamic configuration

### Flagward Opportunity

The gap exists between:
- **LaunchDarkly**: Enterprise pricing, vendor lock-in, complex setup
- **Unleash**: Good open-source option but complex architecture (Java/PostgreSQL dependency)
- **Flipt**: Modern but limited ecosystem and language support
- **ConfigCat**: CDN-based but lacks advanced targeting

Flagward can position as: *LaunchDarkly capabilities + Unleash flexibility + modern TypeScript stack + local-first design + superior developer experience*

---

## Market Landscape

### Commercial Solutions

#### 1. LaunchDarkly

**Market Position**: Undisputed leader, $3B+ valuation, 4,000+ customers, founded 2014

**Architecture**:
```
┌────────────────────────────────────────────────────────────────┐
│                     LaunchDarkly Platform                       │
│                                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │   Client    │  │  Server     │  │      Mobile         │    │
│  │    SDKs     │  │    SDKs     │  │       SDKs          │    │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘    │
│         │                │                    │                │
│         └────────────────┼────────────────────┘                │
│                          │                                     │
│         ┌────────────────▼────────────────┐                   │
│         │     Feature Flag API (REST)     │                   │
│         └────────────────┬────────────────┘                   │
│                          │                                     │
│         ┌────────────────▼────────────────┐                   │
│         │     Real-Time Streaming         │                   │
│         │     (Server-Sent Events)        │                   │
│         └────────────────┬────────────────┘                   │
│                          │                                     │
│  ┌───────────────────────▼────────────────────────┐           │
│  │         LaunchDarkly Core Services            │           │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐  │           │
│  │  │  Eval     │ │  Segment  │ │ Experiment│  │           │
│  │  │  Engine   │ │  Service  │ │  Service  │  │           │
│  │  └───────────┘ └───────────┘ └───────────┘  │           │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐  │           │
│  │  │   Flag    │ │   Audit   │ │   Relay   │  │           │
│  │  │   Store   │ │    Log    │ │   Proxy   │  │           │
│  │  └─────┬─────┘ └───────────┘ └───────────┘  │           │
│  └────────┼─────────────────────────────────────┘           │
│           │                                                   │
│  ┌────────▼──────────────────────────────────────┐          │
│  │              DynamoDB (Global)                 │          │
│  └────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────┘
```

**Key Technical Specifications**:
- Flag evaluation: In-memory with eventual consistency
- Update propagation: WebSocket/SSE with 30s heartbeat
- Data model: Projects, Environments, Flags, Segments
- Bucketing algorithm: MurmurHash3 for consistent hashing
- Storage: DynamoDB global tables with multi-region replication

**Strengths**:
- 99.999% uptime SLA with enterprise support
- Sub-10ms p99 evaluation latency for warm evaluations
- 40-80ms cold start latency
- Comprehensive experimentation suite with statistical analysis
- 50+ language SDKs (JavaScript, Python, Go, Java, Ruby, .NET, iOS, Android, React Native, Flutter, etc.)
- Enterprise SSO (SAML, OIDC, SCIM)
- Granular RBAC with custom roles
- Full audit logging with change history
- Dark launch capability (shadow traffic)
- Kill switches with automatic rollback

**Weaknesses**:
- Expensive pricing: $8.33/seat/month minimum ($1,500+/mo for teams)
- MAU-based pricing creates unpredictable costs
- Complex for small teams
- Vendor lock-in concerns (proprietary data format)
- Requires relay proxy for air-gapped environments
- Limited customizability for specific use cases

**Performance Characteristics**:
- Local evaluation: 300,000+ evals/sec per core
- Server evaluation: 20,000+ evals/sec
- Memory per SDK instance: 5-10MB
- Sync interval: Real-time via SSE

#### 2. Split Software

**Market Position**: Strong #2, emphasis on data-driven experimentation, founded 2015

**Differentiation**:
- Deep integration with analytics platforms (Segment, Amplitude, Mixpanel)
- Statistical significance engine built-in
- Integration with data warehouses (Snowflake, BigQuery, Redshift)
- Impression tracking for all flag evaluations

**Architecture**:
```
┌──────────────────────────────────────────────────────────────┐
│                     Split Platform                            │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 Split Evaluation Engine                 │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │ │
│  │  │Treatment│  │Traffic  │  │  Event  │  │Impression│   │ │
│  │  │Manager  │  │Allocation│  │Tracker  │  │  Log    │   │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │              Impression Data Store                   │  │
│  │    (ClickHouse + S3 for analytics)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Strengths**:
- Strong Kubernetes integration
- On-premise deployment option
- Deterministic bucketing for consistent experiences
- Traffic allocation with statistical rigor
- Comprehensive impression data for analysis

**Weaknesses**:
- Higher latency than competitors (60-100ms cold start)
- Complex configuration for simple use cases
- Pricing starts at $3,000/month
- Less intuitive UI compared to LaunchDarkly

**Performance Characteristics**:
- Cold start: 60-100ms
- Warm evaluation: 5-15ms
- Requires connection to Split cloud for most features

#### 3. Statsig

**Market Position**: Modern challenger, unified experimentation platform, founded 2020

**Approach**:
- Full-stack experimentation (feature flags + analytics + experimentation)
- Gatekeeping with exposure logging built-in
- Native experiment assignment with hash-based bucketing

**Strengths**:
- Unified platform reduces tool sprawl
- SDK performance: <2ms p99 latency
- 90-day data retention on all plans
- More affordable than LaunchDarkly ($400/mo entry point)
- Built-in metrics and dashboards

**Weaknesses**:
- Newer platform, smaller ecosystem
- SDK maturity lags behind LaunchDarkly
- Documentation gaps for edge cases
- Less enterprise feature depth

**Performance Characteristics**:
- p99 latency: <2ms
- Built-in metrics collection adds overhead

#### 4. Optimizely (formerly Rollouts)

**Market Position**: Part of larger experimentation platform, acquired by Episerver

**Approach**:
- Full-stack experimentation (feature flags + A/B testing)
- Web experimentation (visual editor)
- Personalization engine
- Content management integration (Episerver CMS)

**Note**: Acquired by Episerver, less focused on pure feature flagging. More experimentation-heavy.

#### 5. CloudBees Feature Management

**Market Position**: Enterprise CI/CD integration, evolved from Rollout acquisition

**Focus**:
- GitOps-native flag management
- Code references link flags to source code
- Environment promotion workflows
- Jenkins integration
- Progressive delivery pipelines
- Enterprise governance

**Strengths**:
- Kubernetes-native architecture
- GitOps integration with Git repositories
- Environment promotion between dev/staging/prod

**Weaknesses**:
- Steeper learning curve
- Limited targeting rules compared to LaunchDarkly
- Vendor lock-in concerns
- Higher pricing for full features

#### 6. ConfigCat

**Market Position**: Simple, hosted feature flag service, CDN-based delivery

**Approach**:
- CDN-based flag delivery
- Simple configuration
- Multiple deployment modes

**Strengths**:
- Global low-latency via CDN
- Simple pricing model
- Easy setup
- Proxy mode for secure evaluation

**Weaknesses**:
- Less flexible targeting than competitors
- Limited experimentation features
- Smaller SDK ecosystem

---

### Open-Source Solutions

#### 1. Unleash

**Repository**: https://github.com/Unleash/unleash  
**License**: Apache 2.0  
**Primary Language**: TypeScript/Node.js (migrated from Java in 2021)  
**GitHub Stars**: 7,000+  
**Age**: 10+ years (founded 2014)

**Architecture**:
```
┌──────────────────────────────────────────────────────────────┐
│                     Unleash Platform                          │
│                                                               │
│  ┌─────────────────┐         ┌──────────────┐               │
│  │   Admin UI      │────────▶│   Unleash    │               │
│  │  (React SPA)    │  (mgmt) │   Server     │               │
│  └─────────────────┘         │   (Node.js)  │               │
│                              └──────┬───────┘               │
│                                     │                       │
│                              ┌──────┴──────┐               │
│                              │             │               │
│                              ▼             ▼               │
│  ┌─────────────────┐   ┌────────────┐  ┌─────────────┐    │
│  │  Client SDKs    │   │ PostgreSQL │  │    Redis    │    │
│  │  (25+ languages)│   │  (state)   │  │   (cache)   │    │
│  └─────────────────┘   └────────────┘  └─────────────┘    │
│                                                               │
│  Sync Strategy:                                               │
│  - Polling: 15s default (configurable)                      │
│  - Webhooks: Push on change                                   │
│  - Bootstrap: Initial state at startup                        │
└──────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Gradual rollout (percentage-based)
- Strategy constraints (userId, sessionId, environment, appName)
- Custom activation strategies (plugin-based)
- A/B testing support (nightly/experimental)
- Impression data collection (enterprise)
- Segment management with complex rules
- Environment support (dev, staging, prod)
- API-first design

**Deployment Options**:
1. **Self-hosted**: Docker, Kubernetes, bare metal
2. **Unleash Enterprise**: Managed hosting with additional features
3. **Unleash Open Source**: Community edition
4. **Unleash Pro**: Mid-tier managed option

**Strengths**:
- Battle-tested (10+ years in production)
- Large, active community (7k+ GitHub stars)
- Multiple SDK languages with official support
- Strong documentation and examples
- Active development with regular releases
- No vendor lock-in (open data formats)
- Apache 2.0 license (permissive)
- Migration path from other systems

**Weaknesses**:
- Requires PostgreSQL (infrastructure overhead)
- Complex for simple use cases
- Enterprise features (SSO, RBAC, audit log) are paywalled
- Edge evaluation requires Enterprise plan
- UI/UX less polished than commercial alternatives
- Real-time updates require webhooks or polling

**Performance Characteristics**:
- P95 evaluation: ~5ms (SDK local mode)
- P95 evaluation: 10-20ms (server-side)
- Sync interval: 15 seconds default (configurable)
- Memory footprint: ~10MB per SDK instance
- Server memory: 200-500MB typical

#### 2. Flagsmith

**Repository**: https://github.com/Flagsmith/flagsmith  
**License**: BSD-3-Clause  
**Primary Language**: Python/Django  
**GitHub Stars**: 3,000+

**Architecture**:
```
┌──────────────────────────────────────────────────────────────┐
│                     Flagsmith Platform                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Django REST API                       │ │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────────────┐    │ │
│  │  │  Flags    │  │ Segments  │  │  Identities     │    │ │
│  │  │  API      │  │   API     │  │    API          │    │ │
│  │  └───────────┘  └───────────┘  └─────────────────┘    │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                            │                                │
│              ┌─────────────┼─────────────┐                  │
│              ▼             ▼             ▼                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │
│  │  PostgreSQL   │ │    MySQL      │ │    DynamoDB   │     │
│  │  (primary)    │ │  (optional)   │ │  (edge cache) │     │
│  └───────────────┘ └───────────────┘ └───────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Remote config (string, number, JSON values)
- Segments (user groups with attribute matching)
- Identity overrides (per-user flag values)
- Scheduled flags (time-based activation)
- Analytics integration (Segment, Mixpanel, Heap)
- Webhook notifications
- Audit logging (paid tier)

**Deployment**:
- Docker Compose (simplest, single-node)
- Kubernetes Helm chart
- Flagsmith-hosted (SaaS with free tier)

**Strengths**:
- Simple deployment (single Docker Compose file)
- Good UI/UX for flag management
- Strong identity management features
- Multiple database options
- Generous free tier for self-hosted
- GraphQL and REST APIs

**Weaknesses**:
- No streaming updates (polling only, default 60s)
- Python backend (performance concerns at very high scale)
- Smaller community than Unleash
- No built-in experimentation
- SDK performance varies by language

**Performance Characteristics**:
- Server evaluation: 20-50ms
- Polling interval: 60 seconds default
- No local evaluation mode

#### 3. Flipt

**Repository**: https://github.com/flipt-io/flipt  
**License**: GPL-3.0  
**Primary Language**: Go  
**GitHub Stars**: 2,500+  
**Age**: 5+ years

**Architecture**:
```
┌──────────────────────────────────────────────────────────────┐
│                      Flipt Platform                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Go Binary (Single)                    │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐  │ │
│  │  │  REST     │  │   gRPC    │  │    GitOps         │  │ │
│  │  │  API      │  │   API     │  │  (YAML import)    │  │ │
│  │  └───────────┘  └───────────┘  └───────────────────┘  │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                            │                                │
│              ┌─────────────┼─────────────┐                  │
│              ▼             ▼             ▼                    │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐       │
│  │    SQLite     │ │  PostgreSQL   │ │     MySQL     │       │
│  │  (default)    │ │  (production) │ │  (production) │       │
│  └───────────────┘ └───────────────┘ └───────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Namespace isolation (multi-tenant)
- GitOps workflow (flags as YAML)
- Advanced rollout rules (date/time, percentage, segments)
- Audit logging
- gRPC for high-performance evaluation
- Single binary deployment
- Flag importing/exporting

**Strengths**:
- Single binary deployment (no dependencies)
- Modern Go architecture (fast, memory-efficient)
- GitOps native (declarative flag management)
- Fast startup (<100ms cold start)
- Small resource footprint (<50MB server)
- Simple to operate

**Weaknesses**:
- Limited language SDKs (Go, Node.js, Python, Java, Ruby - fewer than competitors)
- No streaming updates (manual refresh or polling)
- No built-in experimentation
- Newer project (less battle-tested than Unleash)
- GPL-3.0 license (copyleft, may concern some enterprises)

**Performance**:
- P99 evaluation: <1ms (local evaluation via SDK)
- P99 evaluation: 2-5ms (server-side)
- Cold start: <100ms
- Memory: <50MB (server)

#### 4. PostHog Feature Flags

**Repository**: https://github.com/PostHog/posthog  
**License**: MIT  
**Primary Language**: Python/Django + TypeScript  
**Context**: Part of larger product analytics platform

**Features**:
- Integrated with product analytics
- A/B testing with statistical analysis
- Multivariate flags (multiple variants)
- Payload support (JSON configuration)
- Group analytics (B2B use cases)
- Early access management

**Strengths**:
- Generous free tier
- Integrated analytics (no separate tools)
- Open-source core (MIT license)
- Visual experiment creation
- Statistical significance calculations

**Weaknesses**:
- Tied to PostHog platform (heavy if only need flags)
- Complex for feature flags alone
- Heavy infrastructure requirements (ClickHouse, Redis, PostgreSQL)
- Higher learning curve

#### 5. GrowthBook

**Repository**: https://github.com/growthbook/growthbook  
**License**: MIT  
**Primary Language**: TypeScript/Node.js + React  
**Positioning**: Open-source experimentation platform  
**GitHub Stars**: 4,000+

**Architecture**:
```
┌──────────────────────────────────────────────────────────────┐
│                     GrowthBook Platform                       │
│                                                               │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐│
│  │   React     │  │           Node.js Backend               ││
│  │   Admin UI  │  │  ┌─────────┐ ┌─────────┐ ┌──────────┐  ││
│  └─────────────┘  │  │ Feature │ │Experiment│ │ Analytics│  ││
│                   │  │ Flags   │ │  Engine  │ │  Integr  │  ││
│                   │  └─────────┘ └─────────┘ └──────────┘  ││
│                   └──────────┬────────────────────────────────││
│                              │                               │
│                   ┌──────────┴──────────┐                      │
│                   ▼                   ▼                      │
│         ┌─────────────────┐ ┌─────────────────┐               │
│         │   MongoDB or    │ │  Data Warehouse │               │
│         │   PostgreSQL    │ │ (Snowflake,     │               │
│         │   (metadata)    │ │ BigQuery, etc.) │               │
│         └─────────────────┘ └─────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Visual experiment editor
- Data warehouse integration (BigQuery, Snowflake, Redshift, Postgres, MySQL, ClickHouse, Mixpanel)
- Bayesian statistics engine
- Feature flags + experiments unified
- SDKs for major languages
- Visual change editor for non-technical users

**Strengths**:
- Strong experimentation focus
- Data warehouse integration (bring your own data)
- Bayesian statistics (modern approach)
- Clean, modern interface
- Open-source (MIT license)

**Weaknesses**:
- Heavier than pure feature flag solutions
- Requires data warehouse for full power
- Complex setup compared to simpler flag tools
- Limited enterprise features (SSO, SCIM in paid tier)

#### 6. Togglz

**Repository**: https://github.com/togglz/togglz  
**License**: Apache 2.0  
**Primary Language**: Java  
**Positioning**: Java-focused feature toggle library

**Focus**:
- Spring Boot integration
- Annotation-based feature toggles
- JMX-based management console
- Strategy-based activation

**Strengths**:
- Deep Java/Spring integration
- Simple API for developers
- Annotation-driven development

**Weaknesses**:
- Java-only (no other languages)
- Library approach (not a service)
- Limited enterprise features

---

## Technical Deep Dives

### Evaluation Strategies

#### 1. Server-Side Evaluation

**How it works**:
```
┌──────────┐     ┌─────┐     ┌──────────────┐     ┌─────────────┐
│  Client  │────▶│ SDK │────▶│ Flagward     │────▶│ Evaluation  │
│          │     │     │     │ Server       │     │ Engine      │
└──────────┘     └─────┘     └──────────────┘     └──────┬──────┘
                                                         │
                              ┌──────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │    Response     │
                    │  (value + metadata)│
                    └─────────────────┘
```

**Flow**:
1. Client calls SDK evaluation method
2. SDK makes HTTP request to flag service API
3. Service evaluates flag against provided context
4. Service returns evaluated value
5. SDK returns value to client

**Pros**:
- Secure (rules not exposed to client)
- Can use sensitive data in rules (PII remains server-side)
- No SDK logic drift (single evaluation implementation)
- Easier to audit and control

**Cons**:
- Network latency on every evaluation (20-100ms)
- Server load increases with traffic
- Single point of failure (if service is down, evaluations fail)
- Higher infrastructure costs

**Best for**:
- Authorization decisions (who can access what)
- Sensitive feature access (admin features, billing)
- Backend services where latency is less critical
- Compliance-sensitive evaluations

**Caching Strategy**:
```typescript
// Server-side evaluation with caching
class ServerEvaluator {
  private cache: Map<string, CachedValue>;
  private ttl: number = 5000; // 5 second cache

  async evaluate(flagKey: string, context: Context): Promise<any> {
    const cacheKey = this.buildCacheKey(flagKey, context);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.value;
    }
    
    const value = await this.callFlagAPI(flagKey, context);
    this.cache.set(cacheKey, { value, timestamp: Date.now() });
    return value;
  }
}
```

#### 2. Local Evaluation (SDK-Bundled Rules)

**How it works**:
```
┌────────────────────────────────────────────────────────────────┐
│                        SDK Lifecycle                           │
│                                                                │
│  ┌──────────┐    ┌──────────┐    ┌────────────────────────────┐│
│  │  Init    │───▶│  Sync    │───▶│       Local Store           ││
│  │          │    │  Rules   │    │  ┌──────────────────────┐  ││
│  └──────────┘    └──────────┘    │  │ Flag Definitions     │  ││
│                                  │  │ Segments             │  ││
│  ┌──────────┐    ┌──────────┐    │  │ Evaluation Rules     │  ││
│  │ Evaluate │◄───│  Local   │◄───│  └──────────────────────┘  ││
│  │          │    │  Engine  │    └────────────────────────────┘│
│  └──────────┘    └──────────┘                                 │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────┐                                                    │
│  │  Result  │  (no network call during evaluation)                ││
│  └──────────┘                                                    ││
└────────────────────────────────────────────────────────────────┘
```

**Flow**:
1. SDK initializes and fetches all flag rules from service
2. Rules stored locally (memory, file, or embedded DB)
3. Evaluation happens locally against stored rules
4. Periodic sync keeps rules updated (WebSocket, polling, or push)

**Pros**:
- Sub-millisecond latency (<1ms typical)
- Works offline (evaluation continues even without connectivity)
- No server load from evaluations (scales with client count)
- Resilient (no dependency on service availability for evaluation)

**Cons**:
- Rules exposed to client (security consideration)
- SDK logic must match server (version compatibility)
- Sync delay when rules change (stale data window)
- Larger SDK bundle size (includes rule evaluation engine)

**Best for**:
- UI feature toggles (React, Vue, Angular)
- High-throughput applications (thousands of evals/second)
- Mobile applications (unreliable connectivity)
- Client-side rendering decisions

**Sync Strategies**:

| Strategy | Latency | Resource Usage | Reliability |
|----------|---------|----------------|-------------|
| Polling | 15-60s | Low | High |
| Long-polling | 1-30s | Medium | Medium |
| WebSocket | <1s | Medium | Medium |
| Server-Sent Events | <1s | Low | Medium |
| Push (FCM/APNs) | <5s | Low | Low |

#### 3. Edge Evaluation

**How it works**:
```
┌──────────┐     ┌─────────────┐     ┌────────────┐     ┌─────────┐
│  Client  │────▶│  CDN Edge   │────▶│   Origin   │────▶│  Store  │
│          │     │  (Worker)   │     │  (if miss) │     │         │
└──────────┘     └──────┬──────┘     └────────────┘     └─────────┘
                        │
                        ▼
              ┌─────────────────┐
              │   Edge Cache    │
              │  (Flag Rules)   │
              └─────────────────┘
```

**Implementation**:
```javascript
// Cloudflare Worker example
export default {
  async fetch(request, env) {
    // Get user context from request
    const userId = request.headers.get('X-User-ID');
    const country = request.cf.country;
    
    // Fetch flag rules from edge cache
    const flags = await env.FLAG_CACHE.get('flag-rules', { type: 'json' });
    
    // Evaluate locally in V8 isolate
    const isEnabled = evaluateFlag(flags, 'new-feature', { userId, country });
    
    // Return appropriate response
    if (isEnabled) {
      return fetch(request); // Pass to origin
    } else {
      return new Response('Feature not available', { status: 403 });
    }
  }
}
```

**Pros**:
- Global low latency (sub-5ms from any location)
- Reduced origin load
- Can use geolocation data (country, city, ASN)
- Works even if origin is down (with cached rules)

**Cons**:
- Limited execution environment (V8 isolates, limited CPU/memory)
- Vendor lock-in (Cloudflare, Fastly, AWS Lambda@Edge)
- Debugging complexity
- Cold start latency for edge workers

**Best for**:
- Global applications with users worldwide
- Geolocation-based targeting (country, region)
- DDoS protection (block at edge)
- A/B testing at edge (no origin hit for routing decisions)

#### 4. Hybrid Approach (Flagward's Recommended Pattern)

**Flagward's approach** combines multiple strategies for optimal performance and security:

```
                         ┌─────────────────┐
                         │   Flagward      │
                         │    Server       │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
    ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
    │  Admin API       │  │  Sync API        │  │  Server Eval   │
    │  (management)    │  │  (SDK refresh)   │  │  (sensitive)   │
    └────────────────┘  └────────────────┘  └────────────────┘
           │                   │                   │
           │           ┌───────┴───────┐           │
           │           │               │           │
           ▼           ▼               ▼           ▼
      Dashboard    SDK Local      SDK Local   Server Apps
      (React)      Eval (UI)      Eval (API)  (API eval)
```

**Strategy Matrix**:

| Use Case | Evaluation Mode | Latency | Security |
|----------|----------------|---------|----------|
| UI feature toggle | Local (SDK) | <1ms | Medium |
| API authorization | Server-side | 10-20ms | High |
| Pricing plan check | Server-side | 10-20ms | High |
| Experiment assignment | Local (SDK) | <1ms | Low |
| Global traffic split | Edge | <5ms | Medium |
| Admin feature access | Server-side | 10-20ms | High |

### Bucketing Algorithms

Consistent bucketing ensures users see the same experience across sessions and devices.

#### MurmurHash3 (Industry Standard)

**Why MurmurHash3?**
- Fast: 2-3x faster than SHA-256
- Good distribution: uniform across output space
- Avalanche effect: small input changes = large output changes
- Deterministic: same input = same output across platforms
- Non-cryptographic: appropriate for bucketing (not security)

**Implementation**:
```typescript
import { murmur3 } from 'murmurhash-js';

function getBucket(userId: string, flagKey: string, salt: string = ''): number {
  // Combine flag key, user ID, and optional salt for uniqueness
  const input = `${flagKey}:${userId}:${salt}`;
  
  // 32-bit hash
  const hash = murmur3(input);
  
  // Normalize to 0-99 range
  return Math.abs(hash) % 100;
}

function isInRollout(
  userId: string, 
  flagKey: string, 
  percentage: number,
  salt?: string
): boolean {
  const bucket = getBucket(userId, flagKey, salt);
  return bucket < percentage;
}

// Example usage
const userId = 'user-123';
const flagKey = 'new-checkout-flow';

// 10% rollout
if (isInRollout(userId, flagKey, 10)) {
  showNewCheckout();
} else {
  showOldCheckout();
}

// Same user, same flag = same result (consistent)
console.log(getBucket('user-123', 'new-checkout-flow')); // Always same number
```

**Properties**:
- Deterministic: same inputs = same output (across sessions, devices)
- Uniform distribution: each bucket has equal probability
- Fast computation: suitable for high-throughput evaluation
- Avalanche effect: small changes in input yield completely different outputs

#### SHA-256 (Audit Trail and Security)

Used for:
- Audit log hashing (tamper detection)
- Cryptographic verification
- Secure randomization where needed

**Trade-offs**:
- Slower than MurmurHash3 (~10x slower)
- Cryptographically secure
- Use when security matters more than speed

**Audit Hash Chain**:
```typescript
import { createHash } from 'crypto';

interface AuditEntry {
  id: string;
  timestamp: Date;
  action: 'create' | 'update' | 'delete' | 'evaluate';
  flagKey?: string;
  actor: string;
  changes?: Record<string, { from: any; to: any }>;
  hash: string;
  previousHash: string | null;
}

function computeHash(entry: Omit<AuditEntry, 'hash'>): string {
  const data = JSON.stringify({
    timestamp: entry.timestamp.toISOString(),
    action: entry.action,
    flagKey: entry.flagKey,
    actor: entry.actor,
    changes: entry.changes,
    previousHash: entry.previousHash,
  });
  
  return createHash('sha256').update(data).digest('hex');
}

function verifyChain(entries: AuditEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    // Verify chain link
    if (entries[i].previousHash !== entries[i-1].hash) {
      return false;  // Chain broken
    }
    
    // Verify entry integrity
    const { hash, ...entryWithoutHash } = entries[i];
    if (hash !== computeHash(entryWithoutHash)) {
      return false;  // Entry tampered
    }
  }
  return true;
}
```

### Storage Patterns

#### 1. Relational (PostgreSQL)

**Schema Design**:
```sql
-- Core flags table
CREATE TABLE flags (
    key VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('boolean', 'string', 'number', 'json')),
    default_value JSONB NOT NULL,
    enabled BOOLEAN DEFAULT false,
    rules JSONB DEFAULT '[]'::jsonb,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    project VARCHAR(50) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_flags_environment ON flags(environment);
CREATE INDEX idx_flags_project ON flags(project);
CREATE INDEX idx_flags_enabled ON flags(enabled);

-- Segments for user grouping
CREATE TABLE segments (
    key VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    constraints JSONB DEFAULT '[]'::jsonb,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log with hash chain
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'evaluate', 'toggle')),
    flag_key VARCHAR(255),
    actor VARCHAR(255) NOT NULL,
    actor_type VARCHAR(50) DEFAULT 'user',
    changes JSONB,
    hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_flag_key ON audit_log(flag_key);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor);

-- API keys for authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    environment VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked BOOLEAN DEFAULT false
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Environments
CREATE TABLE environments (
    key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project VARCHAR(50) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Experiments
CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    flag_key VARCHAR(255) NOT NULL REFERENCES flags(key),
    status VARCHAR(50) DEFAULT 'draft',
    variants JSONB NOT NULL,
    metrics JSONB,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_experiments_flag_key ON experiments(flag_key);
CREATE INDEX idx_experiments_status ON experiments(status);
```

**Pros**:
- ACID guarantees for data integrity
- Complex queries with JOINs
- Mature ecosystem (backups, replication, monitoring)
- JSONB for flexible schema
- Full-text search capabilities

**Cons**:
- Operational overhead (backups, monitoring, scaling)
- Single region latency (unless using read replicas)
- Connection pool management
- Schema migrations required

#### 2. Embedded (SQLite)

**Use cases**:
- Single-node deployments
- SDK local storage
- Development and testing
- Edge deployments

**Schema** (simplified):
```sql
-- SQLite uses similar schema but with type affinity
CREATE TABLE flags (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    default_value TEXT NOT NULL, -- JSON string
    enabled INTEGER DEFAULT 0,
    rules TEXT, -- JSON string
    synced_at INTEGER -- Unix timestamp
);

CREATE INDEX idx_flags_enabled ON flags(enabled);

-- Local cache metadata
CREATE TABLE cache_meta (
    key TEXT PRIMARY KEY,
    etag TEXT,
    synced_at INTEGER,
    expires_at INTEGER
);
```

**Pros**:
- Zero configuration (single file)
- No separate process
- Fast reads (in-memory cache)
- Portable (single file)

**Cons**:
- Write contention (limited concurrent writes)
- No replication
- Limited concurrent write performance
- Not suitable for high-write scenarios

**When to use**:
- Development environments
- Single-node production (low traffic)
- SDK local storage
- Edge deployments
- Testing/CI

#### 3. Key-Value (Redis)

**Use case**: High-frequency reads, caching layer, real-time pub/sub

**Schema**:
```
# Flag storage
flag:{environment}:{key} -> JSON (flag definition)
flag:index:{environment} -> Set (all flag keys for environment)
flag:version:{environment} -> String (ETag for cache invalidation)

# Segment storage  
segment:{environment}:{key} -> JSON (segment definition)

# Audit log (time-series)
audit:{timestamp}:{id} -> JSON (audit entry)
audit:index:{flag_key} -> Sorted Set (audit entries by time)

# Real-time updates
pub/sub: flag-changes:{environment}

# Rate limiting
rate_limit:{api_key}:{window} -> Counter
```

**Operations**:
```bash
# Store flag
SET flag:production:new-feature '{"key":"new-feature","enabled":true}' EX 3600

# Add to index
SADD flag:index:production new-feature

# Publish change
PUBLISH flag-changes:production '{"type":"updated","key":"new-feature"}'

# Get all flags for environment
SMEMBERS flag:index:production
MGET flag:production:flag1 flag:production:flag2 ...
```

**Pros**:
- Sub-millisecond reads
- Pub/sub for real-time updates
- High throughput (100k+ ops/sec)
- TTL support for automatic expiration

**Cons**:
- Data loss risk (unless using AOF/RDB persistence)
- Memory-only (cost at scale)
- Eventual consistency with replicas
- No complex queries

**Best practices**:
- Use as cache layer, not primary store
- Enable persistence (AOF + RDB)
- Set appropriate TTLs
- Use Redis Cluster for horizontal scaling

### Caching Strategies

#### 1. SDK Local Cache

```typescript
interface LocalCache {
  // Flag definitions
  flags: Map<string, Flag>;
  
  // User segments
  segments: Map<string, Segment>;
  
  // Cache versioning
  etag: string;
  
  // Timestamps
  syncedAt: number;
  expiresAt: number;
  
  // Persistence
  storage: 'memory' | 'localStorage' | 'indexedDB' | 'file';
}

class FlagCache {
  private cache: LocalCache;
  private ttl: number;

  constructor(config: { ttl: number; storage: string }) {
    this.ttl = config.ttl;
    this.cache = this.loadFromStorage();
  }

  getFlag(key: string): Flag | undefined {
    if (this.isExpired()) {
      return undefined; // Trigger refresh
    }
    return this.cache.flags.get(key);
  }

  setFlags(flags: Flag[], etag: string): void {
    this.cache.flags = new Map(flags.map(f => [f.key, f]));
    this.cache.etag = etag;
    this.cache.syncedAt = Date.now();
    this.cache.expiresAt = Date.now() + this.ttl;
    this.saveToStorage();
  }

  private isExpired(): boolean {
    return Date.now() > this.cache.expiresAt;
  }

  private loadFromStorage(): LocalCache {
    // Implementation depends on platform
    // Browser: localStorage / indexedDB
    // Node.js: file system
    // Mobile: native storage
  }

  private saveToStorage(): void {
    // Persist to appropriate storage
  }
}
```

**Sync strategies**:

| Strategy | Latency | Resource Usage | Complexity | Best For |
|----------|---------|----------------|------------|----------|
| Polling | 15-60s | Low | Low | Most applications |
| Long-polling | 1-30s | Medium | Medium | Near real-time |
| WebSocket | <1s | Medium | Medium | Real-time UI |
| Server-Sent Events | <1s | Low | Medium | One-way updates |
| Push notifications | <5s | Low | High | Mobile apps |

#### 2. CDN Cache

```
┌──────────┐     ┌─────────┐     ┌────────────┐     ┌─────────┐
│  Client  │────▶│   CDN   │────▶│   Origin   │────▶│  Store  │
│          │     │ (cache) │     │  (Flagward)│     │         │
└──────────┘     └─────────┘     └────────────┘     └─────────┘
```

**Cache headers**:
```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=60, stale-while-revalidate=300
ETag: "flagset-v123"
Vary: Authorization
Last-Modified: Mon, 04 Apr 2026 12:00:00 GMT
```

**Benefits**:
- Reduced origin load
- Global low latency
- Automatic cache invalidation via ETag

---

## Architecture Patterns

### 1. Multi-Tenant Isolation

**Approach 1: Database-per-tenant**
- Complete isolation (security, performance)
- High operational overhead (many databases to manage)
- Expensive (each tenant needs full DB resources)
- Complex migrations

**Approach 2: Schema-per-tenant**
- Good isolation
- Shared resources (connection pool, compute)
- Complex migrations (must apply to all schemas)
- PostgreSQL-specific

**Approach 3: Row-Level Security (RLS) - Recommended for Flagward**
```sql
-- Enable RLS on tables
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
CREATE POLICY tenant_isolation ON flags
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Set tenant context per request
SET app.current_tenant = 'tenant-uuid';
```

**Pros**:
- Single database (simpler operations)
- Automatic filtering (no query changes needed)
- Shared resources (cost-effective)
- Easy migrations

**Cons**:
- PostgreSQL-specific
- Must set context correctly on every connection
- Potential for data leakage if misconfigured

**Approach 4: Namespace isolation (Flipt-style)**
```
/api/v1/namespaces/{namespace}/flags/{flag}
```

**Pros**:
- Application-level isolation
- Works with any database
- Simple to implement

**Cons**:
- No database-level enforcement
- Must implement access control in application

### 2. Multi-Region Deployment

**Active-Active**:
```
┌──────────────┐          ┌──────────────┐
│  us-east-1   │◄────────►│  eu-west-1   │
│  (Primary)   │  Sync    │  (Primary)   │
│              │          │              │
│  ┌────────┐  │          │  ┌────────┐  │
│  │ Write  │  │          │  │ Write  │  │
│  │ Read   │  │          │  │ Read   │  │
│  └────────┘  │          │  └────────┘  │
└──────────────┘          └──────────────┘
```

**Characteristics**:
- Both regions accept writes
- Conflict resolution required
- Higher complexity
- Better availability
- Requires CRDTs or conflict resolution

**Active-Passive**:
```
┌──────────────┐          ┌──────────────┐
│  us-east-1   │─────────▶│  eu-west-1   │
│  (Active)    │  Repl    │  (Standby)   │
│              │          │              │
│  ┌────────┐  │          │  ┌────────┐  │
│  │ Write  │  │          │  │ Read   │  │
│  │ Read   │  │          │  │ (failover)│
│  └────────┘  │          │  └────────┘  │
└──────────────┘          └──────────────┘
```

**Characteristics**:
- Single write region
- Standby for disaster recovery
- Simpler conflict handling
- Failover required for outages
- Lower cost than active-active

**Read Replicas**:
```
┌──────────────┐
│   Primary    │
│  (writes)    │
└──────┬───────┘
       │
   ┌───┴───┐
   ▼       ▼
┌────┐  ┌────┐
│ R1 │  │ R2 │  (reads)
└────┘  └────┘
```

**Characteristics**:
- Single write node
- Multiple read replicas
- Async replication (eventual consistency)
- Good for read-heavy workloads
- Lower write latency

### 3. SDK Architecture Patterns

#### Unified SDK Design

**Core interface (consistent across all languages)**:
```typescript
interface FlagwardClient {
  // Boolean flags
  isEnabled(key: string, context?: EvaluationContext): boolean;
  
  // String values
  getString(key: string, context?: EvaluationContext): string | undefined;
  getString(key: string, defaultValue: string, context?: EvaluationContext): string;
  
  // Number values
  getNumber(key: string, context?: EvaluationContext): number | undefined;
  getNumber(key: string, defaultValue: number, context?: EvaluationContext): number;
  
  // JSON values
  getJSON<T>(key: string, context?: EvaluationContext): T | undefined;
  getJSON<T>(key: string, defaultValue: T, context?: EvaluationContext): T;
  
  // Generic getter
  getValue<T>(key: string, defaultValue: T, context?: EvaluationContext): T;
  
  // Lifecycle
  close(): Promise<void>;
  
  // Events
  on(event: 'change', handler: (flag: Flag) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}

interface EvaluationContext {
  userId?: string;
  email?: string;
  plan?: string;
  region?: string;
  customAttributes?: Record<string, unknown>;
}
```

#### Platform-Specific Optimizations

**Browser SDK**:
```typescript
class BrowserSDK implements FlagwardClient {
  private storage: Storage;
  private broadcastChannel: BroadcastChannel;
  
  constructor(config: BrowserConfig) {
    // Use localStorage for persistence
    this.storage = window.localStorage;
    
    // Sync across tabs via BroadcastChannel
    this.broadcastChannel = new BroadcastChannel('flagward-sync');
    this.broadcastChannel.onmessage = (event) => {
      this.handleSyncMessage(event.data);
    };
    
    // Sync when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.sync();
      }
    });
  }
}
```

**Node.js SDK**:
```typescript
class NodeSDK implements FlagwardClient {
  private fs: typeof import('fs');
  private cluster: typeof import('cluster');
  
  constructor(config: NodeConfig) {
    // File system cache for persistence
    this.cachePath = config.cachePath || '/tmp/flagward-cache.json';
    
    // Cluster-aware sync (only primary syncs, workers read)
    if (cluster.isPrimary) {
      this.startSyncLoop();
    }
  }
  
  private loadFromDisk(): void {
    try {
      const data = fs.readFileSync(this.cachePath, 'utf8');
      this.cache = JSON.parse(data);
    } catch {
      this.cache = { flags: {} };
    }
  }
}
```

**Mobile SDKs (iOS/Android)**:
- Native storage (Keychain/Keystore for security)
- Background sync when app enters foreground
- Push notification triggered sync
- Offline-first design

---

## Evaluation Strategies

### Rule Evaluation Engine

```typescript
// Type definitions
interface Condition {
  attribute: string;           // 'userId', 'plan', 'region', etc.
  operator: Operator;          // 'equals', 'contains', 'gt', 'in', etc.
  value: unknown;
}

type Operator = 
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'regex'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'not_in'
  | 'semver_eq' | 'semver_gt' | 'semver_gte' | 'semver_lt' | 'semver_lte'
  | 'before' | 'after';  // Date operators

interface TargetingRule {
  id: string;
  priority: number;           // Evaluation order (lower = first)
  name?: string;
  conditions: Condition[];
  operator: 'AND' | 'OR' | 'NOT';
  serve: ServeValue;
}

type ServeValue = 
  | { type: 'static'; value: unknown }
  | { type: 'percentage'; percentages: Record<string, number>; bucketBy: string }
  | { type: 'experiment'; experimentKey: string; variants: Variant[] }
  | { type: 'segment'; segmentKey: string; match: boolean; serve: ServeValue }
  | { type: 'reference'; flagKey: string };

interface Variant {
  key: string;
  payload: unknown;
  weight: number;  // Sum of all weights = 100
}
```

**Evaluation Flow**:
```
1. Check flag enabled (master toggle)
   └── Disabled? Return default value immediately

2. Normalize context (add defaults, validate)

3. Sort rules by priority (ascending)

4. For each rule:
   a. Evaluate conditions against context
      - For each condition, check if context[attribute] matches
      - Combine with rule.operator (AND/OR/NOT)
   
   b. If rule matches:
      - If percentage rollout: hash user ID, check bucket
      - If experiment: assign to variant using consistent hashing
      - If segment: check segment membership
      - Return served value

5. No rules match? Return default value

6. Log evaluation (async, non-blocking)
```

### Boolean Evaluation

```typescript
function evaluateBoolean(flag: Flag, context: EvaluationContext): boolean {
  // Check master toggle
  if (!flag.enabled) {
    return flag.defaultValue as boolean;
  }
  
  // Sort rules by priority
  const sortedRules = [...flag.rules].sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    if (evaluateConditions(rule.conditions, context, rule.operator)) {
      // Handle percentage rollout
      if (rule.serve.type === 'percentage') {
        const bucketBy = rule.serve.bucketBy || 'userId';
        const bucketKey = context[bucketBy] || context.sessionId || 'anonymous';
        const bucket = getBucket(`${flag.key}:${bucketKey}`, flag.key);
        
        return bucket < (rule.serve.percentages['true'] || 0);
      }
      
      // Static serve
      if (rule.serve.type === 'static') {
        return Boolean(rule.serve.value);
      }
      
      // Segment-based
      if (rule.serve.type === 'segment') {
        const inSegment = checkSegmentMembership(rule.serve.segmentKey, context);
        if (inSegment === rule.serve.match) {
          return evaluateBoolean(
            { ...flag, rules: [{ ...rule, serve: rule.serve.serve }] },
            context
          );
        }
      }
    }
  }
  
  // No rules matched
  return flag.defaultValue as boolean;
}

function evaluateConditions(
  conditions: Condition[],
  context: EvaluationContext,
  operator: 'AND' | 'OR' | 'NOT'
): boolean {
  const results = conditions.map(c => evaluateCondition(c, context));
  
  switch (operator) {
    case 'AND':
      return results.every(r => r);
    case 'OR':
      return results.some(r => r);
    case 'NOT':
      return !results.every(r => r);
    default:
      return false;
  }
}

function evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
  const value = context[condition.attribute];
  
  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'contains':
      return String(value).includes(String(condition.value));
    case 'gt':
      return Number(value) > Number(condition.value);
    case 'in':
      return (condition.value as unknown[]).includes(value);
    case 'regex':
      return new RegExp(condition.value as string).test(String(value));
    default:
      return false;
  }
}
```

### Percentage Rollout

```typescript
interface PercentageRollout {
  type: 'percentage';
  percentages: Record<string, number>;  // variant -> percentage
  bucketBy: string;  // Context attribute to hash (default: 'userId')
}

function evaluatePercentage(
  flag: Flag,
  context: EvaluationContext,
  rule: TargetingRule
): unknown {
  // Get bucket key (userId or fallback)
  const bucketBy = (rule.serve as PercentageRollout).bucketBy || 'userId';
  const bucketKey = context[bucketBy] || context.sessionId || 'anonymous';
  
  // Consistent hash
  const hashInput = `${flag.key}:${bucketKey}`;
  const hash = murmur3(hashInput);
  const bucket = Math.abs(hash) % 100;
  
  // Cumulative distribution for multiple variants
  const percentages = (rule.serve as PercentageRollout).percentages;
  let cumulative = 0;
  
  for (const [variant, percentage] of Object.entries(percentages)) {
    cumulative += percentage;
    if (bucket < cumulative) {
      return variant;
    }
  }
  
  // Fallback to default if percentages don't sum to 100
  return flag.defaultValue;
}

// Example: 10% A, 20% B, rest default
const rollout: PercentageRollout = {
  type: 'percentage',
  percentages: {
    'variant-a': 10,
    'variant-b': 20
    // Remaining 70% gets default
  },
  bucketBy: 'userId'
};
```

### Experiment Assignment

```typescript
interface Experiment {
  key: string;
  flagKey: string;
  seed: string;  // Random seed for assignment consistency
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: Variant[];
  startDate: Date;
  endDate?: Date;
  trafficAllocation: number;  // % of eligible traffic
}

interface Variant {
  key: string;
  payload: unknown;
  weight: number;
  description?: string;
}

function assignVariant(
  experiment: Experiment,
  context: EvaluationContext
): Variant | null {
  // Check if experiment is running
  if (experiment.status !== 'running') {
    return null;
  }
  
  // Check date bounds
  const now = new Date();
  if (now < experiment.startDate || (experiment.endDate && now > experiment.endDate)) {
    return null;
  }
  
  // Traffic allocation check (is user in experiment population?)
  const trafficHash = murmur3(`${experiment.key}:traffic:${context.userId}`);
  const trafficBucket = Math.abs(trafficHash) % 100;
  if (trafficBucket >= experiment.trafficAllocation) {
    return null;  // User not in experiment
  }
  
  // Assign to variant using consistent hashing
  // Include seed for experiment uniqueness
  const hashInput = `${experiment.key}:${context.userId}:${experiment.seed}`;
  const hash = murmur3(hashInput);
  
  // Weighted random assignment
  const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  let pointer = Math.abs(hash) % totalWeight;
  
  for (const variant of experiment.variants) {
    pointer -= variant.weight;
    if (pointer < 0) {
      return variant;
    }
  }
  
  // Fallback (shouldn't reach here if weights sum correctly)
  return experiment.variants[0];
}

// Example experiment
const experiment: Experiment = {
  key: 'checkout-redesign',
  flagKey: 'new-checkout',
  seed: 'abc123',
  status: 'running',
  variants: [
    { key: 'control', payload: { version: 'v1' }, weight: 50 },
    { key: 'treatment', payload: { version: 'v2' }, weight: 50 }
  ],
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-05-01'),
  trafficAllocation: 100  // 100% of eligible users
};
```

---

## Security Considerations

### 1. Secret Management

**API Key Types**:
```
sk_live_xxxxxxxxxxxxxxxx        # Server-side (full access)
sk_test_xxxxxxxxxxxxxxxx        # Test environment
pk_live_xxxxxxxxxxxxxxxx        # Public/client-side (limited, eval only)
ek_live_xxxxxxxxxxxxxxxx        # Evaluation key only (no management)
rk_live_xxxxxxxxxxxxxxxx        # Read-only key
```

**Key Permissions Schema**:
```typescript
interface KeyPermissions {
  flags: {
    read: boolean;
    write: boolean;
    evaluate: boolean;
    delete: boolean;
  };
  segments: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  audit: {
    read: boolean;
  };
  environments: string[];  // Allowed environments
  projects: string[];      // Allowed projects
  rateLimits: {
    requestsPerSecond: number;
    burstSize: number;
  };
}

// Example: Client SDK key
const clientKeyPermissions: KeyPermissions = {
  flags: { read: true, write: false, evaluate: true, delete: false },
  segments: { read: true, write: false, delete: false },
  audit: { read: false },
  environments: ['production'],
  projects: ['mobile-app'],
  rateLimits: { requestsPerSecond: 100, burstSize: 200 }
};
```

**Key Storage**:
```typescript
// Hash keys in database (never store plaintext)
async function createApiKey(permissions: KeyPermissions): Promise<string> {
  // Generate cryptographically secure random key
  const keyBytes = crypto.randomBytes(32);
  const key = `sk_live_${keyBytes.toString('base64url')}`;
  
  // Hash for storage
  const keyHash = await bcrypt.hash(key, 12);
  
  // Store hash and permissions
  await db.apiKeys.create({
    keyHash,
    permissions,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
  });
  
  // Return plaintext key (only time it's visible)
  return key;
}

// Verify key on each request
async function verifyApiKey(providedKey: string): Promise<KeyPermissions | null> {
  // Find by hash prefix (for indexing)
  const prefix = providedKey.slice(0, 16);
  const candidates = await db.apiKeys.findByPrefix(prefix);
  
  for (const candidate of candidates) {
    if (await bcrypt.compare(providedKey, candidate.keyHash)) {
      // Check expiration
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        return null;
      }
      
      // Update last used
      await db.apiKeys.update(candidate.id, { lastUsedAt: new Date() });
      
      return candidate.permissions;
    }
  }
  
  return null;
}
```

### 2. Audit Logging

**Tamper-Evident Chain**:
```typescript
interface AuditEntry {
  id: string;                    // UUID
  timestamp: Date;
  action: AuditAction;
  flagKey?: string;
  actor: string;                 // User ID or API key ID
  actorType: 'user' | 'api_key' | 'system';
  changes?: ChangeSet;
  metadata?: Record<string, unknown>;
  hash: string;                  // SHA-256 of this entry
  previousHash: string | null; // Links to previous entry
  ipAddress?: string;
  userAgent?: string;
}

type AuditAction = 
  | 'flag.created'
  | 'flag.updated'
  | 'flag.deleted'
  | 'flag.toggled'
  | 'flag.evaluated'
  | 'segment.created'
  | 'segment.updated'
  | 'segment.deleted'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'export'
  | 'import';

interface ChangeSet {
  [field: string]: {
    from: unknown;
    to: unknown;
  };
}

function computeHash(entry: Omit<AuditEntry, 'id' | 'hash'>): string {
  const data = JSON.stringify({
    timestamp: entry.timestamp.toISOString(),
    action: entry.action,
    flagKey: entry.flagKey,
    actor: entry.actor,
    actorType: entry.actorType,
    changes: entry.changes,
    metadata: entry.metadata,
    previousHash: entry.previousHash,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent
  }, Object.keys({...entry, id: undefined, hash: undefined}).sort()); // Canonical ordering
  
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function createAuditEntry(entry: Omit<AuditEntry, 'id' | 'hash' | 'previousHash'>): Promise<AuditEntry> {
  // Get previous entry hash
  const lastEntry = await db.auditLog.findFirst({
    orderBy: { timestamp: 'desc' }
  });
  
  const previousHash = lastEntry?.hash || null;
  
  // Compute hash for new entry
  const hash = computeHash({ ...entry, previousHash });
  
  // Store
  const fullEntry: AuditEntry = {
    id: crypto.randomUUID(),
    ...entry,
    previousHash,
    hash
  };
  
  await db.auditLog.create(fullEntry);
  
  return fullEntry;
}

// Verification function
function verifyChain(entries: AuditEntry[]): { valid: boolean; brokenAt?: number } {
  for (let i = 1; i < entries.length; i++) {
    // Verify chain link
    if (entries[i].previousHash !== entries[i-1].hash) {
      return { valid: false, brokenAt: i };
    }
    
    // Verify entry integrity
    const { hash, id, ...entryWithoutHash } = entries[i];
    const expectedHash = computeHash(entryWithoutHash);
    if (hash !== expectedHash) {
      return { valid: false, brokenAt: i };
    }
  }
  
  return { valid: true };
}
```

### 3. Access Control

**RBAC Model**:
```typescript
interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

interface Permission {
  resource: 'flag' | 'segment' | 'audit' | 'api_key' | 'environment' | 'project';
  action: 'create' | 'read' | 'update' | 'delete' | 'evaluate' | 'manage';
  scope?: {
    type: 'all' | 'environment' | 'project' | 'flag';
    values?: string[];
  };
  conditions?: {
    environment?: string[];
    flagType?: string[];
  };
}

// Predefined roles
const PREDEFINED_ROLES: Record<string, Permission[]> = {
  admin: [
    { resource: 'flag', action: 'manage', scope: { type: 'all' } },
    { resource: 'segment', action: 'manage', scope: { type: 'all' } },
    { resource: 'audit', action: 'read', scope: { type: 'all' } },
    { resource: 'api_key', action: 'manage', scope: { type: 'all' } },
    { resource: 'environment', action: 'manage', scope: { type: 'all' } },
    { resource: 'project', action: 'manage', scope: { type: 'all' } }
  ],
  
  developer: [
    { resource: 'flag', action: 'read', scope: { type: 'all' } },
    { resource: 'flag', action: 'update', scope: { type: 'all' }, conditions: { environment: ['development', 'staging'] } },
    { resource: 'flag', action: 'evaluate', scope: { type: 'all' } },
    { resource: 'segment', action: 'read', scope: { type: 'all' } },
    { resource: 'audit', action: 'read', scope: { type: 'all' } }
  ],
  
  viewer: [
    { resource: 'flag', action: 'read', scope: { type: 'all' } },
    { resource: 'segment', action: 'read', scope: { type: 'all' } }
  ],
  
  ops: [
    { resource: 'flag', action: 'read', scope: { type: 'all' } },
    { resource: 'flag', action: 'update', scope: { type: 'all' }, conditions: { environment: ['production'] } },
    // Ops can toggle flags in production but not modify rules
    { resource: 'audit', action: 'read', scope: { type: 'all' } }
  ]
};

// Permission checking
function hasPermission(
  userRoles: Role[],
  required: { resource: string; action: string; environment?: string; flagKey?: string }
): boolean {
  for (const role of userRoles) {
    for (const permission of role.permissions) {
      if (permission.resource !== required.resource) continue;
      if (!actionMatches(permission.action, required.action)) continue;
      
      // Check scope
      if (permission.scope?.type === 'all') return true;
      if (permission.scope?.type === 'environment' && required.environment) {
        if (permission.scope.values?.includes(required.environment)) return true;
      }
      if (permission.scope?.type === 'flag' && required.flagKey) {
        if (permission.scope.values?.includes(required.flagKey)) return true;
      }
      
      // Check conditions
      if (permission.conditions?.environment && required.environment) {
        if (!permission.conditions.environment.includes(required.environment)) continue;
      }
    }
  }
  
  return false;
}

function actionMatches(granted: string, required: string): boolean {
  if (granted === 'manage') return true;  // Manage implies all actions
  return granted === required;
}
```

### 4. Rate Limiting

```typescript
interface RateLimitConfig {
  // Evaluation endpoints (high volume)
  evaluation: {
    perSecond: number;
    burst: number;
    windowMs: number;
  };
  
  // Management endpoints (lower volume, sensitive)
  management: {
    perMinute: number;
    perHour: number;
    windowMs: number;
  };
  
  // Sync endpoints (SDK polling)
  sync: {
    perMinute: number;
    burst: number;
    windowMs: number;
  };
  
  // Admin endpoints (rare, sensitive)
  admin: {
    perMinute: number;
    windowMs: number;
  };
}

const DEFAULT_LIMITS: RateLimitConfig = {
  evaluation: {
    perSecond: 1000,
    burst: 100,
    windowMs: 1000
  },
  management: {
    perMinute: 60,
    perHour: 1000,
    windowMs: 60000
  },
  sync: {
    perMinute: 10,
    burst: 3,
    windowMs: 60000
  },
  admin: {
    perMinute: 10,
    windowMs: 60000
  }
};

// Token bucket rate limiter
class TokenBucketLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  
  constructor(
    private maxTokens: number,
    private refillRate: number,  // tokens per ms
    private windowMs: number
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    
    // Refill tokens
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check and consume
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    
    return false;
  }
  
  // Clean up old buckets periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }
}

// Distributed rate limiter (Redis-based)
class RedisRateLimiter {
  constructor(private redis: RedisClient) {}
  
  async isAllowed(key: string, limit: number, windowMs: number): Promise<boolean> {
    const windowKey = `${key}:${Math.floor(Date.now() / windowMs)}`;
    
    const current = await this.redis.incr(windowKey);
    if (current === 1) {
      await this.redis.expire(windowKey, Math.ceil(windowMs / 1000));
    }
    
    return current <= limit;
  }
}
```

### 5. Data Protection

**PII Handling**:
```typescript
interface DataProtectionConfig {
  // Never log or store these attributes in plaintext
  sensitiveAttributes: string[];
  
  // Hash these for bucketing but don't store
  hashAttributes: string[];
  
  // Encryption for data at rest
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm';
    keyRotationDays: number;
  };
}

const DEFAULT_DATA_PROTECTION: DataProtectionConfig = {
  sensitiveAttributes: ['email', 'phone', 'ssn', 'password', 'creditCard'],
  hashAttributes: ['userId', 'email'],  // Hash for consistent bucketing
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    keyRotationDays: 90
  }
};

// Sanitize context before logging
function sanitizeContext(
  context: EvaluationContext,
  config: DataProtectionConfig
): SanitizedContext {
  const sanitized: SanitizedContext = {};
  
  for (const [key, value] of Object.entries(context)) {
    if (config.sensitiveAttributes.includes(key)) {
      // Replace with hash or omit
      sanitized[key] = hashValue(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function hashValue(value: unknown): string {
  return crypto.createHash('sha256')
    .update(String(value))
    .digest('hex')
    .slice(0, 16);  // Truncate for brevity
}
```

---

## Performance Benchmarks

### Evaluation Latency Benchmarks

| System | Local Eval (p50) | Local Eval (p99) | Server Eval (p50) | Server Eval (p99) | Sync Latency |
|--------|------------------|------------------|-------------------|-------------------|--------------|
| LaunchDarkly | <0.1ms | <1ms | 5-10ms | 15-20ms | Real-time (SSE) |
| Split | <0.1ms | <1ms | 10-20ms | 60-100ms | Real-time |
| Statsig | <0.1ms | <2ms | 2-5ms | 10ms | Real-time |
| Unleash | <0.1ms | <1ms | 10-20ms | 20-30ms | 15s polling |
| Flipt | <0.1ms | <1ms | 2-5ms | 10ms | Manual |
| Flagsmith | N/A | N/A | 20-50ms | 100ms | 60s polling |
| Flagward (target) | <0.1ms | <1ms | 5-10ms | 15-20ms | WebSocket + polling fallback |

### Throughput Benchmarks (Local Evaluation)

Test machine: AWS c5.xlarge (4 vCPU, 8GB RAM)

| System | Evaluations/sec | Memory/SDK | CPU Usage |
|--------|-----------------|------------|-----------|
| LaunchDarkly (Go SDK) | 500,000 | 5MB | 60% |
| LaunchDarkly (Node SDK) | 300,000 | 10MB | 70% |
| Unleash (Node SDK) | 100,000 | 15MB | 65% |
| Flipt (Go SDK) | 600,000 | 2MB | 55% |
| Flagward target | 500,000+ | <5MB | <60% |

### Server-Side Evaluation Throughput

| System | Requests/sec (p99 <20ms) | Concurrent Connections |
|--------|--------------------------|------------------------|
| LaunchDarkly (managed) | 50,000 | 10,000 |
| Unleash (self-hosted) | 10,000 | 5,000 |
| Flipt (self-hosted) | 30,000 | 8,000 |
| Flagward target | 50,000 | 10,000 |

### Memory Footprint

| System | SDK Memory (Browser) | SDK Memory (Node.js) | Server Memory |
|--------|---------------------|---------------------|---------------|
| LaunchDarkly | 2-5MB | 5-10MB | N/A (managed) |
| Unleash | 3-5MB | 10-20MB | 200-500MB |
| Flipt | 1-2MB | 2-5MB | 20-50MB |
| Flagsmith | 2-3MB | 5-10MB | 300-600MB |
| Flagward target | 2-3MB | 3-5MB | 50-100MB |

### Bundle Size (minified + gzipped)

| SDK | Size | Dependencies |
|-----|------|--------------|
| LaunchDarkly JS | 15KB | 0 |
| Unleash JS | 25KB | 2 |
| Flipt JS | 8KB | 0 |
| Flagward target | <30KB | 0 |

---

## Integration Patterns

### CI/CD Integration

**GitHub Actions**:
```yaml
name: Feature Flag Validation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate-flags:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Verify Required Flags
        uses: phenotype/flagward-action@v1
        with:
          api-key: ${{ secrets.FLAGWARD_API_KEY }}
          environment: production
          required-flags: |
            new-checkout-flow
            payment-v2
            user-profile-redesign
          fail-on-missing: true
          
      - name: Flag Health Check
        uses: phenotype/flagward-action@v1
        with:
          api-key: ${{ secrets.FLAGWARD_API_KEY }}
          command: health-check
          max-stale-hours: 24
          
      - name: Sync Flags to Environment
        if: github.ref == 'refs/heads/main'
        uses: phenotype/flagward-action@v1
        with:
          api-key: ${{ secrets.FLAGWARD_API_KEY }}
          command: sync
          from: staging
          to: production
          dry-run: false
```

**GitOps Workflow**:
```yaml
# .flagward/flags.yaml
version: '1.0'

flags:
  new-feature:
    name: 'New Feature Toggle'
    description: 'Controls visibility of the new feature'
    type: boolean
    defaultValue: false
    enabled: true
    environment: production
    rules:
      - name: 'Beta users'
        priority: 1
        conditions:
          - attribute: plan
            operator: equals
            value: beta
        serve:
          type: static
          value: true
          
      - name: 'Gradual rollout'
        priority: 2
        conditions: []
        serve:
          type: percentage
          percentages:
            'true': 10
            'false': 90
          bucketBy: userId

  max-upload-size:
    name: 'Maximum Upload Size'
    type: number
    defaultValue: 10
    rules:
      - name: 'Enterprise gets 100MB'
        conditions:
          - attribute: plan
            operator: equals
            value: enterprise
        serve:
          type: static
          value: 100
```

**Sync workflow**:
```
git push → CI runs → Validates flag YAML → Deploys to Flagward
                ↓
         Slack notification
```

### Observability Integration

**Metrics**:
```typescript
interface FlagMetrics {
  // Evaluation metrics
  'flagward.evaluation.total': Counter;
  'flagward.evaluation.duration': Histogram<{ flag_key: string }>;
  'flagward.evaluation.cache_hit': Counter;
  'flagward.evaluation.errors': Counter<{ error_type: string }>;
  
  // Flag-specific metrics
  'flagward.flag.enabled': Gauge<{ flag_key: string; environment: string }>;
  'flagward.flag.evaluation': Counter<{ flag_key: string; result: string }>;
  'flagward.flag.stale': Gauge<{ flag_key: string }>;
  
  // SDK metrics
  'flagward.sdk.sync.duration': Histogram;
  'flagward.sdk.sync.errors': Counter;
  'flagward.sdk.connections.active': Gauge;
  
  // Server metrics
  'flagward.server.requests': Counter<{ endpoint: string; status: number }>;
  'flagward.server.latency': Histogram<{ endpoint: string }>;
  'flagward.db.connections': Gauge;
}

// Prometheus metrics example
const evaluationCounter = new Counter({
  name: 'flagward_evaluations_total',
  help: 'Total number of flag evaluations',
  labelNames: ['flag_key', 'environment', 'result']
});

evaluationCounter.inc({
  flag_key: 'new-feature',
  environment: 'production',
  result: 'true'
});
```

**Tracing**:
```typescript
// OpenTelemetry integration
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('flagward-sdk');

async function evaluateFlag(flagKey: string, context: Context): Promise<boolean> {
  const span = tracer.startSpan('flag-evaluation', {
    attributes: {
      'flag.key': flagKey,
      'flag.environment': context.environment,
      'user.id': context.userId  // hashed
    }
  });
  
  try {
    const startTime = Date.now();
    const result = await evaluator.evaluate(flagKey, context);
    const duration = Date.now() - startTime;
    
    span.setAttributes({
      'flag.enabled': result.enabled,
      'flag.value': String(result.value),
      'evaluation.duration_ms': duration,
      'evaluation.cache_hit': result.fromCache
    });
    
    return result.value;
  } catch (error) {
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

**Logging**:
```typescript
interface FlagLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  flagKey?: string;
  context?: SanitizedContext;
  result?: unknown;
  durationMs?: number;
  error?: string;
  traceId?: string;
}

// Structured logging
logger.info({
  msg: 'Flag evaluated',
  flagKey: 'new-feature',
  userId: hashContext(context.userId),
  result: true,
  durationMs: 0.5,
  traceId: getTraceId()
});
```

### Webhook Integration

```typescript
interface WebhookConfig {
  url: string;
  secret: string;  // For HMAC verification
  events: WebhookEventType[];
  headers?: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
}

type WebhookEventType =
  | 'flag.created'
  | 'flag.updated'
  | 'flag.deleted'
  | 'flag.toggled'
  | 'flag.enabled_changed'
  | 'segment.created'
  | 'segment.updated'
  | 'segment.deleted'
  | 'experiment.started'
  | 'experiment.ended';

interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;  // ISO 8601
  data: Flag | Segment | Experiment | { key: string };
  signature: string;  // HMAC-SHA256
}

// Webhook signing
function signWebhook(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function verifyWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhook(payload, secret);
  
  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// Webhook handler example (Express)
app.post('/webhooks/flagward', (req, res) => {
  const signature = req.headers['x-flagward-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event: WebhookEvent = req.body;
  
  switch (event.type) {
    case 'flag.toggled':
      notifySlack(`Flag ${event.data.key} was toggled`);
      break;
    case 'flag.updated':
      invalidateCache(event.data.key);
      break;
    case 'experiment.ended':
      triggerAnalysisPipeline(event.data);
      break;
  }
  
  res.status(200).send('OK');
});
```

---

## Future Trends

### 1. AI-Powered Targeting

**Smart Rollouts**:
- ML models analyze historical rollouts to predict safe rollout speeds
- Anomaly detection for automatic rollback
- Predictive user segmentation based on behavior patterns

**Implementation**:
```typescript
interface SmartRolloutConfig {
  targetMetric: string;  // 'error_rate', 'conversion_rate'
  maxErrorThreshold: number;
  minSampleSize: number;
  autoRollback: boolean;
}

class SmartRollout {
  async evaluateRollout(
    flag: Flag,
    currentPercentage: number,
    metrics: MetricStream
  ): Promise<RolloutDecision> {
    // ML model predicts risk
    const riskScore = await mlModel.predict({
      flagKey: flag.key,
      currentPercentage,
      metrics: metrics.last(30, 'minutes'),
      historicalSimilarRollouts: await this.getSimilarRollouts(flag.key)
    });
    
    if (riskScore > 0.8) {
      return { action: 'pause', reason: 'High risk detected' };
    }
    
    if (riskScore < 0.2 && metrics.isStable()) {
      return { action: 'increase', newPercentage: currentPercentage + 10 };
    }
    
    return { action: 'maintain' };
  }
}
```

### 2. WebAssembly Evaluation

**Universal Evaluation**:
- Compile flag rules to WebAssembly for any environment
- Sandboxed, secure evaluation
- Consistent behavior across platforms

**Benefits**:
- Single evaluation engine (WASM) across all SDKs
- Secure (sandboxed execution)
- Fast (near-native performance)

### 3. Edge-Native Flags

**V8 Isolate Execution**:
```javascript
// Cloudflare Worker
export default {
  async fetch(request, env) {
    const flags = await env.FLAGWARD.getFlags(request);
    
    // Evaluate at edge (no origin hit)
    const variant = flags.getVariant('hero-design', {
      country: request.cf.country,
      device: request.headers.get('user-agent')
    });
    
    // Route based on flag
    const url = new URL(request.url);
    url.pathname = `/variants/${variant}/${url.pathname}`;
    
    return fetch(new Request(url, request));
  }
}
```

### 4. Blockchain Audit

**Immutable Audit Log**:
- Smart contract for flag changes
- Decentralized verification
- Regulatory compliance (SOX, HIPAA)

**Use case**: Financial services requiring tamper-proof audit trails

### 5. Federated Flags

**Multi-Provider Strategy**:
```typescript
interface FederatedConfig {
  providers: {
    client: FlagwardClient;
    weight: number;
    priority: number;
  }[];
  strategy: 'fallback' | 'weighted' | 'experiment' | 'priority';
}

class FederatedClient {
  async getValue<T>(key: string, defaultValue: T): Promise<T> {
    switch (this.config.strategy) {
      case 'fallback':
        // Try providers in order until one succeeds
        for (const provider of this.config.providers) {
          try {
            return await provider.client.getValue(key, defaultValue);
          } catch {
            continue;
          }
        }
        return defaultValue;
        
      case 'experiment':
        // A/B test between providers
        const provider = this.selectProviderByExperiment(key);
        return provider.client.getValue(key, defaultValue);
    }
  }
}
```

**Use case**: Gradual migration from LaunchDarkly to Flagward

---

## Recommendations for Flagward

### 1. Core Positioning

**Target Market**: Development teams of 10-200 engineers who:
- Have outgrown simple config files or environment variables
- Want LaunchDarkly capabilities without enterprise pricing
- Prefer TypeScript/Node.js stack
- Value open-source and data sovereignty
- Need sub-10ms evaluation latency

**Value Proposition**:
"LaunchDarkly features + Unleash flexibility + modern TypeScript stack + local-first design + superior developer experience"

### 2. Technical Priorities

**P0 (Must Have for v1.0)**:
- [ ] Sub-10ms local evaluation (TypeScript)
- [ ] SQLite support for simple deployments
- [ ] PostgreSQL support for production
- [ ] TypeScript SDK with React hooks
- [ ] Real-time sync via WebSocket
- [ ] Polling fallback for restrictive networks
- [ ] Audit logging with SHA-256 hash chain
- [ ] Boolean, string, number, JSON flag types
- [ ] Percentage rollout with MurmurHash3
- [ ] User and segment targeting
- [ ] REST API for management
- [ ] Environment support (dev, staging, prod)

**P1 (Should Have for v1.5)**:
- [ ] Go SDK (for backend services)
- [ ] Python SDK (for ML/data pipelines)
- [ ] Edge deployment (Cloudflare Workers)
- [ ] GitOps integration (YAML flag definitions)
- [ ] OpenTelemetry integration
- [ ] RBAC with predefined roles
- [ ] API key management with permissions
- [ ] Webhook notifications
- [ ] Rate limiting

**P2 (Nice to Have for v2.0)**:
- [ ] Mobile SDKs (iOS, Android)
- [ ] Experimentation framework (A/B testing)
- [ ] AI-powered auto-rollback
- [ ] WebAssembly evaluation engine
- [ ] SSO/SAML integration
- [ ] SCIM provisioning
- [ ] Multi-region deployment guides

### 3. Architecture Decisions

**Database**: Dual-mode support
- SQLite for development, single-node deployments, edge
- PostgreSQL for production, multi-node, high availability
- Migration path: SQLite → PostgreSQL with export/import

**Sync Strategy**: WebSocket primary, polling fallback
- WebSocket: Real-time, efficient, preferred
- Polling: Every 60 seconds, compatible with all networks
- Configurable intervals based on environment

**Evaluation**: Local-first with server fallback
- SDK bundles rules for local evaluation (<1ms)
- Server evaluation for sensitive operations (auth, billing)
- Consistent MurmurHash3 bucketing

**API Design**: REST + WebSocket
- REST for management operations
- WebSocket for real-time updates
- gRPC considered for v2 (high-performance use cases)

### 4. Differentiation Matrix

| Capability | Flagward | LaunchDarkly | Unleash | Flipt | Flagsmith |
|------------|----------|--------------|---------|-------|-----------|
| Open Source | ✅ | ❌ | ✅ | ✅ | ✅ |
| TypeScript Native | ✅ | ❌ | ✅ | ❌ | ❌ |
| SQLite Support | ✅ | ❌ | ❌ | ✅ | ❌ |
| WebSocket Sync | ✅ | ✅ (SSE) | ❌ | ❌ | ❌ |
| Built-in Audit | ✅ (hash chain) | ✅ | 💰 | ✅ | 💰 |
| Simple Setup | ✅ (single binary) | ❌ | ❌ | ✅ | ✅ |
| Enterprise SSO | P2 | ✅ | 💰 | ❌ | 💰 |
| A/B Testing | P2 | ✅ | 💰 | ❌ | ❌ |
| Experimentation | P2 | ✅ | 💰 | ❌ | 💰 |
| Edge Evaluation | P1 | ✅ | 💰 | ❌ | ❌ |

**Legend**: ✅ Included | 💰 Paid tier | ❌ Not available | P1/P2 Roadmap

### 5. Success Metrics

**Technical KPIs**:
- P99 evaluation latency: <5ms (local), <20ms (server)
- SDK bundle size: <30KB (minified + gzipped)
- Memory footprint: <5MB per SDK instance
- Server memory: <100MB at startup
- Uptime target: 99.9% (self-hosted with monitoring)

**Adoption KPIs**:
- GitHub stars: 1000+ within 12 months of release
- NPM downloads: 10k+/month within 6 months
- Production deployments: 100+ tracked within 12 months
- Community contributions: 5+ PRs/month
- Documentation completeness: 100% API coverage

**Business KPIs**:
- Cost per 1M evaluations: <$0.01 (self-hosted)
- Time to first flag: <5 minutes (from install to first evaluation)
- Migration time from LaunchDarkly: <1 day

### 6. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LaunchDarkly price drop | Low | High | Focus on data sovereignty, open-source values |
| Unleash TypeScript migration | Medium | Medium | Maintain simplicity advantage, better UX |
| Flipt ecosystem growth | Medium | Medium | Prioritize SDK breadth, React hooks |
| Performance at scale | Low | High | Benchmark continuously, optimize early |
| Security vulnerabilities | Low | Critical | Rapid patching policy, security audits |
| Key contributor departure | Medium | Medium | Document everything, bus factor > 2 |
| PostgreSQL dependency issues | Low | Medium | Support SQLite as fallback |

### 7. Go-to-Market Strategy

**Phase 1: Developer Preview (Months 1-3)**
- Core SDK (TypeScript)
- SQLite support
- Basic dashboard
- 10 early adopters

**Phase 2: Public Beta (Months 4-6)**
- PostgreSQL support
- Go SDK
- Documentation complete
- 100 beta users

**Phase 3: GA Release (Months 7-9)**
- Enterprise features (RBAC, audit)
- Python SDK
- Cloud deployment guides
- Launch on HN, Product Hunt

**Phase 4: Scale (Months 10-12)**
- Experimentation framework
- Mobile SDKs
- Enterprise support offerings
- Conference presentations

---

## Appendix A: Detailed Comparisons

### A.1 Pricing Deep Dive

| Provider | Free Tier | Entry Paid | Enterprise | Billing Model |
|----------|-----------|------------|------------|---------------|
| LaunchDarkly | None | $1,500/mo | Custom | Per seat + MAU |
| Split | None | $3,000/mo | Custom | Per seat |
| Statsig | Generous | $400/mo | Custom | Per seat |
| Unleash | Full (self-hosted) | $800/mo | Custom | Per instance |
| Flagsmith | Generous (self-hosted) | $200/mo | Custom | Per request |
| Flipt | Full (self-hosted) | N/A | N/A | Free |
| Flagward | Full (self-hosted) | N/A (future SaaS) | Future | TBD |

### A.2 Feature Flag Taxonomy

**Release Toggles**: Enable trunk-based development
- Short-lived (days to weeks)
- Used for incomplete features
- Removed after feature ships

**Experiment Toggles**: A/B testing
- Controlled experiments
- Statistical analysis
- Time-bounded

**Ops Toggles**: Operational control
- Circuit breakers
- Rate limiting
- Kill switches

**Permission Toggles**: Access control
- Plan-based features
- Beta access
- Internal features

**Long-lived Toggles**: Configuration
- Theme settings
- Feature availability
- Partner-specific features

### A.3 SDK Comparison Matrix

| Language | LaunchDarkly | Unleash | Flipt | Flagward |
|----------|--------------|---------|-------|----------|
| TypeScript/JavaScript | ✅ Official | ✅ Official | ✅ Official | ✅ Native |
| React/Next.js | ✅ Official | ✅ Community | ✅ Community | ✅ Native |
| Go | ✅ Official | ✅ Official | ✅ Official | P1 |
| Python | ✅ Official | ✅ Official | ✅ Official | P1 |
| Java | ✅ Official | ✅ Official | ✅ Official | P2 |
| Ruby | ✅ Official | ✅ Official | ✅ Official | P2 |
| .NET | ✅ Official | ✅ Official | ✅ Official | P2 |
| iOS/Swift | ✅ Official | ✅ Community | ❌ | P2 |
| Android/Kotlin | ✅ Official | ✅ Community | ❌ | P2 |
| Rust | ✅ Community | ✅ Community | ✅ Official | P3 |
| PHP | ✅ Official | ✅ Official | ✅ Official | P3 |

---

## Appendix B: Technical Specifications

### B.1 Flagward API Specification

**Base URL**: `https://api.flagward.io/v1`

**Authentication**: Bearer token (API key)
```
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx
```

**Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /flags | List all flags |
| POST | /flags | Create flag |
| GET | /flags/:key | Get flag by key |
| PUT | /flags/:key | Update flag |
| DELETE | /flags/:key | Delete flag |
| POST | /flags/:key/evaluate | Evaluate flag |
| GET | /flags/:key/evaluations | Get evaluation history |
| GET | /segments | List segments |
| POST | /segments | Create segment |
| GET | /segments/:key | Get segment |
| PUT | /segments/:key | Update segment |
| DELETE | /segments/:key | Delete segment |
| GET | /audit | Query audit log |
| GET | /environments | List environments |
| POST | /sync | Get flag state for SDK sync |
| WS | /realtime | WebSocket for real-time updates |

### B.2 Flag Schema

```typescript
interface Flag {
  key: string;                    // Unique identifier
  name: string;                   // Display name
  description?: string;           // Documentation
  type: 'boolean' | 'string' | 'number' | 'json';
  defaultValue: unknown;          // Default when no rules match
  enabled: boolean;               // Master toggle
  environment: string;            // Environment key
  project?: string;               // Project key (optional)
  rules: TargetingRule[];         // Evaluation rules
  createdAt: string;              // ISO 8601 timestamp
  updatedAt: string;              // ISO 8601 timestamp
  createdBy: string;              // User ID
  updatedBy: string;              // User ID
  version: number;                // Optimistic locking
  tags?: string[];                // Categorization
}
```

### B.3 SDK Configuration

```typescript
interface SDKConfig {
  // Required
  apiKey: string;
  
  // Optional
  endpoint?: string;              // Default: https://api.flagward.io
  environment?: string;           // Default: production
  
  // Sync settings
  syncMode?: 'websocket' | 'polling' | 'hybrid';  // Default: hybrid
  pollInterval?: number;          // Default: 60000 (ms)
  
  // Local storage
  storage?: 'memory' | 'localStorage' | 'indexedDB' | 'file';
  cachePath?: string;             // For file storage
  
  // Evaluation settings
  offlineMode?: boolean;          // Use cached values only
  defaultContext?: EvaluationContext;
  
  // Event handlers
  onUpdate?: (flags: Flag[]) => void;
  onError?: (error: Error) => void;
}
```

---

## Appendix C: Implementation Examples

### C.1 Basic SDK Usage

```typescript
import { FlagwardClient } from '@flagward/sdk';

// Initialize
const client = new FlagwardClient({
  apiKey: process.env.FLAGWARD_API_KEY!,
  environment: 'production'
});

// Boolean flag
const isEnabled = client.isEnabled('new-feature', {
  userId: 'user-123',
  plan: 'enterprise'
});

if (isEnabled) {
  renderNewFeature();
} else {
  renderOldFeature();
}

// String flag
const theme = client.getString('theme-color', 'blue', {
  userId: 'user-123'
});

// Number flag
const maxUpload = client.getNumber('max-upload-mb', 10, {
  userId: 'user-123',
  plan: 'enterprise'
});

// JSON flag
const config = client.getJSON('ui-config', { layout: 'grid' }, {
  userId: 'user-123'
});

// Cleanup
await client.close();
```

### C.2 React Integration

```tsx
import { FlagwardProvider, useFlag, useFlagValue } from '@flagward/react';

// App setup
function App() {
  return (
    <FlagwardProvider
      apiKey={process.env.FLAGWARD_API_KEY}
      environment="production"
      defaultContext={{ plan: 'free' }}
    >
      <Router />
    </FlagwardProvider>
  );
}

// Component usage
function Checkout() {
  // Boolean flag
  const newCheckout = useFlag('new-checkout-flow');
  
  // String flag with default
  const paymentGateway = useFlagValue('payment-gateway', 'stripe');
  
  // Number flag
  const discount = useFlagValue('discount-percent', 0);
  
  if (newCheckout) {
    return <NewCheckout gateway={paymentGateway} discount={discount} />;
  }
  
  return <OldCheckout />;
}

// With user context
function UserDashboard({ user }: { user: User }) {
  const features = useFlagValue('dashboard-features', [], {
    userId: user.id,
    plan: user.plan,
    region: user.region
  });
  
  return (
    <Dashboard>
      {features.map(feature => (
        <Feature key={feature.id} {...feature} />
      ))}
    </Dashboard>
  );
}
```

### C.3 Server-Side Usage

```typescript
import { FlagwardServerClient } from '@flagward/server-sdk';

const client = new FlagwardServerClient({
  apiKey: process.env.FLAGWARD_SERVER_KEY!,
  endpoint: 'https://api.flagward.io',
  cache: { ttl: 5000 }  // 5 second cache
});

// Express middleware
async function flagMiddleware(req: Request, res: Response, next: NextFunction) {
  const flags = await client.getFlags({
    userId: req.user?.id,
    plan: req.user?.plan,
    ip: req.ip
  });
  
  req.flags = flags;
  next();
}

// Route handler
app.get('/api/premium-content', flagMiddleware, async (req, res) => {
  // Server-side evaluation for authorization
  const hasAccess = req.flags.isEnabled('premium-content', {
    userId: req.user.id,
    plan: req.user.plan
  });
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Premium required' });
  }
  
  res.json(await getPremiumContent());
});
```

---

## Document Control

**Author**: Flagward Architecture Team  
**Reviewers**: Platform Engineering, Security, Product Management  
**Approvers**: CTO, VP Engineering  
**Next Review**: 2026-07-04  
**Distribution**: Internal + Open Source Contributors  
**Classification**: Public

---

*This document represents the current state of feature flag systems as of April 2026. The landscape evolves rapidly; quarterly reviews are recommended to keep information current.*

*For questions or corrections, contact: flagward-team@kooshapari.com*
