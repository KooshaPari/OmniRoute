# Product Requirements Document - Portalis

**Project:** Portalis API Gateway  
**Version:** 1.0.0  
**Date:** 2026-04-04  
**Status:** In Development

---

## 1. Overview

### 1.1 Purpose

Portalis is a high-performance, Rust-based API gateway that serves as the unified entry point for the Phenotype ecosystem's APIs. It provides essential platform capabilities including intelligent routing, robust authentication, configurable rate limiting, and comprehensive observability.

### 1.2 Product Vision

Portalis empowers development teams to expose, secure, and monitor their APIs without duplicating infrastructure concerns across services. By centralizing cross-cutting concerns, Portalis enables:

- **Velocity**: Teams deploy new services without building auth, rate limiting, or observability from scratch
- **Security**: Consistent security posture across all APIs with centralized policy enforcement
- **Reliability**: Built-in circuit breakers, health checks, and automatic failover
- **Visibility**: Unified metrics, traces, and audit logs for all API traffic

### 1.3 Target Users

#### Primary Users

| User Persona | Role | Goals | Pain Points |
|-------------|------|-------|-------------|
| **Alex** | Platform Engineer | Deploy and manage API infrastructure | Manual config, lack of visibility, tool sprawl |
| **Sam** | Backend Developer | Expose microservice APIs securely | Writing auth code repeatedly, inconsistent security |
| **Jordan** | Security Engineer | Enforce API security policies | Shadow APIs, no centralized audit trail |
| **Riley** | DevOps Engineer | Monitor and scale API infrastructure | Fragmented metrics, debugging across services |
| **Casey** | External Partner | Integrate with Phenotype APIs | Complex auth setup, rate limit confusion |

#### User Journey Examples

**Journey 1: API Publication**
1. Developer creates microservice
2. Developer adds Portalis annotations to OpenAPI spec
3. Portalis generates routing, auth, and rate limiting config
4. API is live with zero additional code

**Journey 2: Security Audit**
1. Security engineer reviews centralized audit logs
2. Discovers anomalous access pattern
3. Blocks specific API key or IP range
4. All APIs immediately protected

**Journey 3: Rate Limit Debug**
1. External partner reports rate limit errors
2. DevOps checks partner's usage metrics
3. Partner exceeded quota; adjusts tier or temporarily raises limit
4. Partner continues integration without service restart

---

## 2. Market Context

### 2.1 Problem Statement

Modern architectures split functionality across multiple microservices, but each service traditionally implements:

- Authentication and authorization
- Rate limiting and quotas
- Request logging and metrics
- Protocol translation (HTTP → gRPC)
- API versioning

This leads to:

| Problem | Impact | Frequency |
|---------|--------|----------|
| Duplicated effort | 40% of dev time on infra concerns | Every team |
| Inconsistent security | Data breaches from misconfigured auth | Monthly |
| Tool fragmentation | 5-10 tools to manage one API surface | Every org |
| Debug difficulty | Hours tracing requests across services | Weekly |
| Scaling complexity | Stateless services still share state | Every scale event |

### 2.2 Market Opportunity

The API gateway market is valued at $4.5B in 2026, growing 15% annually. Key trends:

| Trend | Implication |
|-------|-------------|
| Microservices adoption | Every team needs API gateway capabilities |
| API-first development | APIs are products requiring proper management |
| Security regulations | GDPR, SOC 2 require audit trails and access control |
| Multi-cloud deployments | Gateway must work across cloud providers |
| Edge computing | Gateway functionality needed at edge locations |

### 2.3 Competitive Landscape

| Competitor | Strengths | Weaknesses | Portalis Differentiation |
|------------|-----------|------------|------------------------|
| Kong | Rich plugin ecosystem, mature | Heavy resource usage, complex config | Lightweight, Rust-based performance |
| AWS API Gateway | Deep AWS integration | Vendor lock-in, expensive at scale | Cloud-agnostic, cost-effective |
| Envoy | Feature-rich, service mesh ready | Complex configuration, steep learning curve | Simple config, focused on API use case |
| Tyk | Good UI, developer portal | Go performance ceiling | Rust performance, lower TCO |
| KrakenD | Fast, simple config | Limited plugin extensibility | Extensible without complexity |

---

## 3. User Requirements

### 3.1 Core User Stories

#### Authentication & Authorization

| ID | Story | As a... | I want... | So that... |
|----|-------|---------|----------|------------|
| US-001 | API Key Access | External Partner | Use API keys to authenticate | I can integrate without OAuth complexity |
| US-002 | OAuth Integration | Mobile App Developer | Authenticate via OAuth 2.0 | Users can log in with existing accounts |
| US-003 | JWT Validation | Web App Developer | Validate JWT tokens | I can trust authenticated user identity |
| US-004 | Role-Based Access | Admin | Define roles and permissions | Partners only access their permitted endpoints |
| US-005 | Mutual TLS | Enterprise Customer | Use client certificates | Only verified clients can access my APIs |

#### Rate Limiting & Quotas

| ID | Story | As a... | I want... | So that... |
|----|-------|---------|----------|------------|
| US-010 | Basic Rate Limiting | API Provider | Limit requests per second | I protect my services from overload |
| US-011 | Consumer Quotas | Billing Admin | Set monthly API quotas | I can implement tiered pricing |
| US-012 | Burst Allowance | Integration Partner | Handle traffic spikes | My batch jobs complete faster |
| US-013 | Distributed Limits | Platform Team | Rate limit across instances | Limits work in clustered deployments |
| US-014 | Custom Rate Keys | Marketing | Rate limit by API version | Newer versions get more capacity |

#### Routing & Proxying

| ID | Story | As a... | I want... | So that... |
|----|-------|---------|----------|------------|
| US-020 | Path Routing | Backend Developer | Route by URL path | Different services handle different resources |
| US-021 | Header Routing | API Designer | Route by headers | I can implement A/B testing |
| US-022 | Service Versioning | Platform Team | Route to different versions | I can migrate APIs without downtime |
| US-023 | Load Balancing | DevOps | Distribute traffic across instances | My service handles more requests |
| US-024 | Health-Based Routing | SRE | Skip unhealthy instances | Users don't see errors during deploys |

#### Observability

| ID | Story | As a... | I want... | So that... |
|----|-------|---------|----------|------------|
| US-030 | Request Logging | Security Engineer | Log all API requests | I can investigate security incidents |
| US-031 | Performance Metrics | SRE | View P50/P95/P99 latency | I know actual user experience |
| US-032 | Distributed Tracing | Developer | Trace requests across services | I can debug latency issues |
| US-033 | Alerting | SRE | Get notified on error spikes | I can respond to outages quickly |
| US-034 | Audit Trail | Compliance Officer | Review who accessed what | I can demonstrate regulatory compliance |

### 3.2 Feature Priority Matrix

| Feature | User Value | Technical Effort | Priority |
|---------|-----------|------------------|----------|
| JWT Authentication | High | Medium | P0 |
| API Key Auth | High | Low | P0 |
| Path Routing | High | Low | P0 |
| Rate Limiting | High | Medium | P0 |
| Prometheus Metrics | Medium | Low | P0 |
| Health Checks | Medium | Low | P0 |
| OAuth 2.0 | High | High | P1 |
| gRPC Routing | Medium | Medium | P1 |
| Sliding Window Rate Limit | Medium | Medium | P1 |
| OpenTelemetry Tracing | Medium | Medium | P1 |
| RBAC | High | Medium | P1 |
| Circuit Breaker | Medium | Medium | P1 |
| Hot Config Reload | Medium | Medium | P1 |
| WebSocket Support | Medium | High | P2 |
| Request Transformation | Medium | High | P2 |
| LDAP Auth | Medium | High | P2 |

### 3.3 User Experience Requirements

#### Ease of Use

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Time to first API | <15 minutes | Journey completion time |
| Config file size | <50 lines for basic setup | Line count |
| Error messages | Actionable within 10 seconds | User testing |
| Learning curve | <2 hours for basic ops | User feedback |

#### Performance Expectations

| Metric | Target | Context |
|--------|--------|---------|
| Gateway latency overhead | <1ms P99 | 1KB payloads |
| Throughput | 50,000 req/s | Single instance |
| Cold start | <3 seconds | New instance launch |
| Config reload | <100ms | Hot reload time |

#### Reliability Expectations

| Metric | Target | Context |
|--------|--------|---------|
| Uptime | 99.99% | Per month |
| Error rate | <0.01% | Of all requests |
| Data loss | Zero | Audit logs |

---

## 4. Functional Requirements

### 4.1 Authentication System

#### FR-001: JWT Token Validation

**Description:** Validate JWT tokens from any OIDC-compliant provider

**Requirements:**
- Support RS256, RS384, RS512 algorithms
- Validate issuer and audience claims
- Fetch and cache JWKS from provider
- Reject expired tokens
- Extract claims for downstream services

**Acceptance Criteria:**
- [ ] Valid JWT grants access to protected routes
- [ ] Expired JWT returns 401 with clear error
- [ ] Invalid signature returns 401
- [ ] Missing issuer returns 401
- [ ] Claims are forwarded as headers to upstream

#### FR-002: OAuth 2.0 Integration

**Description:** Support OAuth 2.0 authorization code flow

**Requirements:**
- Integrate with WorkOS, Auth0, Okta, generic OIDC
- Exchange codes for tokens
- Support token refresh
- Cache tokens appropriately

**Acceptance Criteria:**
- [ ] Authorization redirect works for configured provider
- [ ] Token exchange succeeds
- [ ] Refresh flow maintains session
- [ ] Logout invalidates session

#### FR-003: API Key Authentication

**Description:** Validate API keys from request headers

**Requirements:**
- Support configurable header names
- Store keys securely (bcrypt hashed)
- Support key scopes
- Allow key rotation without downtime

**Acceptance Criteria:**
- [ ] Valid API key grants access
- [ ] Invalid key returns 401
- [ ] Key with insufficient scope returns 403
- [ ] Key rotation doesn't drop requests

#### FR-004: Role-Based Access Control (RBAC)

**Description:** Enforce role-based permissions on routes

**Requirements:**
- Define roles with permissions
- Map consumers to roles
- Check permissions before routing
- Support wildcard permissions

**Acceptance Criteria:**
- [ ] Consumer with correct role accesses route
- [ ] Consumer without role gets 403
- [ ] Roles can be updated without restart

### 4.2 Rate Limiting System

#### FR-010: Token Bucket Rate Limiting

**Description:** Implement token bucket algorithm for rate limiting

**Requirements:**
- Configurable bucket capacity
- Configurable refill rate
- Per-route and per-consumer limits
- Support burst allowance

**Acceptance Criteria:**
- [ ] Requests within limit succeed
- [ ] Requests exceeding limit get 429
- [ ] Bucket refills over time
- [ ] Burst allows temporary overage

#### FR-011: Sliding Window Rate Limiting

**Description:** Implement sliding window algorithm for smoother limits

**Requirements:**
- Configurable window size
- Per-consumer windows
- Redis-backed for distributed deployments
- Consistent window boundaries

**Acceptance Criteria:**
- [ ] Limits enforce over sliding window
- [ ] Distributed instances share state
- [ ] Window boundary transitions smoothly

#### FR-012: Consumer Quotas

**Description:** Implement periodic quotas for billing

**Requirements:**
- Support hourly, daily, monthly periods
- Track usage per consumer
- Reset at period boundary
- Support grace periods

**Acceptance Criteria:**
- [ ] Quota enforced over billing period
- [ ] Usage visible in metrics
- [ ] Period rollover works correctly

### 4.3 Routing System

#### FR-020: Dynamic Routing

**Description:** Route requests based on path, method, headers

**Requirements:**
- Support path parameters (`/users/{id}`)
- Support wildcards (`/api/**`)
- Support regex patterns
- Priority-based route selection

**Acceptance Criteria:**
- [ ] Path parameters extracted and forwarded
- [ ] Wildcards match correctly
- [ ] Regex routes work
- [ ] Higher priority routes match first

#### FR-021: Load Balancing

**Description:** Distribute traffic across upstream instances

**Requirements:**
- Round robin algorithm
- Least connections algorithm
- IP hash algorithm
- Health-aware routing

**Acceptance Criteria:**
- [ ] Traffic distributed evenly (round robin)
- [ ] Unhealthy instances excluded
- [ ] Session affinity works (IP hash)

#### FR-022: Health Checks

**Description:** Monitor upstream health

**Requirements:**
- HTTP health check endpoint
- Configurable interval and timeout
- Passive health checks on failures
- Automatic recovery

**Acceptance Criteria:**
- [ ] Unhealthy upstream marked
- [ ] Traffic routes to healthy instances
- [ ] Recovery detected and instances restored

### 4.4 Observability System

#### FR-030: Prometheus Metrics

**Description:** Export metrics in Prometheus format

**Requirements:**
- Request counters by route, status
- Latency histograms
- Upstream health metrics
- Rate limit metrics

**Acceptance Criteria:**
- [ ] /metrics endpoint returns Prometheus format
- [ ] All required metrics present
- [ ] Labels enable flexible querying

#### FR-031: Structured Logging

**Description:** JSON-formatted logs with correlation

**Requirements:**
- Request ID in every log
- Structured fields (JSON)
- Configurable log levels
- Audit events for security

**Acceptance Criteria:**
- [ ] All requests logged with ID
- [ ] Logs parseable as JSON
- [ ] Security events logged separately

#### FR-032: OpenTelemetry Tracing

**Description:** Distributed tracing support

**Requirements:**
- Trace context propagation
- Span creation per request
- Sampling configuration
- Export to OTLP-compatible backends

**Acceptance Criteria:**
- [ ] Traceparent header propagated
- [ ] Spans show gateway processing
- [ ] Upstream traces linked

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| Requirement | Target | Verification Method |
|-------------|--------|---------------------|
| Throughput | 50,000 req/s | Load test with 1KB payloads |
| P50 Latency | <1ms | 1M request sample |
| P99 Latency | <5ms | 1M request sample |
| P999 Latency | <10ms | 1M request sample |
| Memory/request | <1KB | Measured under sustained load |
| Connection capacity | 100,000 | Connection saturation test |

### 5.2 Reliability Requirements

| Requirement | Target | Verification Method |
|-------------|--------|---------------------|
| Uptime | 99.99% | Monthly SLA monitoring |
| Error rate | <0.01% | Production monitoring |
| MTTR | <5 minutes | Incident post-mortems |
| Data durability | 99.999% | Audit log integrity |

### 5.3 Security Requirements

| Requirement | Standard |
|-------------|----------|
| TLS | 1.2 minimum, 1.3 preferred |
| JWT validation | RFC 8725 |
| API key storage | bcrypt with cost factor ≥12 |
| Audit log integrity | Immutable, tamper-evident |
| Vulnerability disclosure | 90-day window |

### 5.4 Compatibility Requirements

| Standard | Compliance |
|----------|------------|
| HTTP/1.1 | RFC 7230-7235 |
| HTTP/2 | RFC 7540 |
| gRPC | grpc.io v1.0 |
| WebSocket | RFC 6455 |
| TLS | RFC 5246 (1.2), RFC 8446 (1.3) |
| JWT | RFC 8725 |
| OAuth 2.0 | RFC 6749 |
| OIDC | OpenID Connect Core 1.0 |
| Prometheus | OpenMetrics 1.0 |
| OpenTelemetry | OTLP 0.16+ |

### 5.5 Scalability Requirements

| Dimension | Strategy | Limit |
|-----------|----------|-------|
| Throughput | Horizontal scaling | 1M+ req/s (cluster) |
| Routes | In-memory | 10,000 routes |
| Connections | Connection pooling | 100,000 per instance |
| State | Redis | 1B+ rate limit entries |

---

## 6. Technical Constraints

### 6.1 Technology Constraints

| Constraint | Rationale |
|------------|----------|
| Rust | Performance, memory safety |
| Tokio async runtime | Proven, scalable |
| YAML configuration | Developer-friendly |
| No external database | Simplicity, operational burden |

### 6.2 Operational Constraints

| Constraint | Rationale |
|------------|----------|
| Single binary deployment | Simplifies ops |
| Environment variable secrets | Security best practice |
| Local config file | No central config server needed |
| Stateless operation | Horizontal scaling |

### 6.3 Compliance Constraints

| Constraint | Standard |
|------------|----------|
| Data retention | Configurable, 90 days default |
| PII handling | No PII in logs by default |
| Encryption | TLS 1.2+ for all traffic |
| Audit trail | Immutable access logs |

---

## 7. Milestones

### 7.1 Release Schedule

| Milestone | Target | Scope |
|-----------|--------|-------|
| v0.1.0 | 2026-04-04 | Initial development setup |
| v0.2.0 | 2026-04-18 | Core routing, health checks |
| v0.3.0 | 2026-05-02 | JWT and API key auth |
| v0.4.0 | 2026-05-16 | Rate limiting, quotas |
| v0.5.0 | 2026-05-30 | Metrics and logging |
| v1.0.0-rc1 | 2026-06-13 | First release candidate |
| v1.0.0 | 2026-06-27 | Stable release |

### 7.2 Feature Completeness

| Version | Features |
|---------|----------|
| v0.2.0 | HTTP routing, upstream forwarding, health checks, hot reload |
| v0.3.0 | JWT validation, API key auth, mTLS |
| v0.4.0 | Token bucket, sliding window, consumer quotas |
| v0.5.0 | Prometheus metrics, structured logs, OpenTelemetry |
| v1.0.0 | All P0/P1 features, gRPC routing, circuit breaker |

---

## 8. Success Metrics

### 8.1 Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Gateway Adoption | 80% of Phenotype services | Internal audit |
| Time to First Route | <15 minutes | User journey completion |
| Config Error Rate | <1% | Validation statistics |
| Support Tickets | <5/week | Support queue |

### 8.2 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| P99 Latency | <5ms | Production monitoring |
| Throughput | 50,000 req/s | Load testing |
| Uptime | 99.99% | Availability monitoring |
| Error Rate | <0.01% | Production monitoring |

### 8.3 User Satisfaction

| Metric | Target | Measurement |
|--------|--------|-------------|
| NPS Score | >40 | User surveys |
| Documentation Rating | >4/5 | Documentation feedback |
| Support Response | <1 hour | Support SLA |

---

## 9. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| gRPC support timeline | Team | Open | v1.0 target |
| LDAP integration | Security | Open | v2.0 candidate |
| GraphQL support | Platform | Open | Future roadmap |
| Multi-region deployment | DevOps | Open | Architecture decision |
| Legacy API migration | Platform | Open | Migration tooling |

---

## 10. References

- [SPEC.md](./SPEC.md) - Technical specification
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [SECURITY.md](./SECURITY.md) - Security policy
- [ADR.md](./ADR.md) - Architecture decisions

---

**Document Owner:** Portalis Team  
**Contact:** portalis@phenotype.io  
**Last Updated:** 2026-04-04
