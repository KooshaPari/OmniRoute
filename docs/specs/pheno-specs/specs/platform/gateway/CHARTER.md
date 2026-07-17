# Portalis Charter

## 1. Mission Statement

**Portalis** is a service discovery, gateway, and routing infrastructure designed to connect clients with services in dynamic, distributed environments. The mission is to provide transparent, reliable, and observable service connectivity—enabling seamless communication across microservices architectures while abstracting the complexity of dynamic topology, load balancing, and failure handling.

The project exists to be the connective tissue of distributed systems—automatically routing requests to healthy instances, balancing load intelligently, and adapting to changing conditions without client awareness of the underlying complexity.

---

## 2. Tenets (Unless You Know Better Ones)

### Tenet 1: Client Simplicity

Clients should connect as if services were static. Portalis handles the dynamics. Simple configuration. Automatic failover. No client-side complexity for standard cases.

### Tenet 2. Health-Aware Routing

Traffic only flows to healthy instances. Health checks are continuous. Unhealthy instances are removed quickly. Recovery is automatic. No manual intervention for common failure scenarios.

### Tenet 3. Observable Traffic

Every request is visible. Latency distributions. Error rates. Routing decisions. Circuit breaker state. Full observability into service connectivity.

### Tenet 4. Gradual Change Propagation

Service updates don't disrupt traffic. Gradual traffic shifting. Canary deployments. Blue/green support. Rollbacks are instant. Zero-downtime deployments.

### Tenet 5. Protocol Flexibility

HTTP, gRPC, WebSocket—handled uniformly. Protocol detection where possible. Custom protocol support via extensions. No protocol lock-in.

### Tenet 6. Edge Case Safety

Timeouts, retries, circuit breakers—all configured with sensible defaults. No cascading failures. Graceful degradation. Fail closed or open explicitly.

### Tenet 7. Multi-Environment Awareness

Local development, staging, production—consistent behavior. Service mesh integration. Kubernetes-native. VM support. Bare metal support.

---

## 3. Scope & Boundaries

### In Scope

**Service Discovery:**
- DNS-based discovery
- Consul, etcd, ZooKeeper integration
- Kubernetes service discovery
- Custom registry support
- Health check aggregation

**Load Balancing:**
- Round-robin, least connections, weighted
- Geographic routing
- Latency-based routing
- Custom load balancing strategies

**Traffic Management:**
- Canary deployments
- A/B testing support
- Traffic splitting
- Rate limiting
- Circuit breaking

**Gateway Features:**
- Request/response transformation
- Authentication at edge
- TLS termination
- Compression
- Caching integration

**Observability:**
- Distributed tracing
- Metrics export
- Request logging
- Health dashboards

### Out of Scope

- Application logic (use application code)
- Complex business rules (use policy engines)
- Content delivery network (CDN) features
- API monetization or billing
- Deep packet inspection
- Protocol conversion beyond standard transforms

### Boundaries

- Portalis routes traffic; doesn't process it
- No business logic in routing layer
- Configurable but not programmable (simple config over complex scripting)
- Resource limits enforced

---

## 4. Target Users & Personas

### Primary Persona: Platform Engineer Pete

**Role:** Engineer managing service infrastructure
**Goals:** Reliable service connectivity, zero-downtime deployments
**Pain Points:** Service discovery complexity, failed deployments, cascading failures
**Needs:** Automatic routing, health checking, traffic management
**Tech Comfort:** Very high, expert in distributed systems

### Secondary Persona: Developer Drew

**Role:** Application developer
**Goals:** Simple service connectivity, local development that matches production
**Pain Points:** Different behavior locally vs. production, connection issues
**Needs:** Consistent local/prod behavior, simple configuration
**Tech Comfort:** High, comfortable with networking concepts

### Tertiary Persona: SRE Sam

**Role:** Site reliability engineer
**Goals:** Observability, fast incident response, capacity management
**Pain Points:** Hard to debug routing issues, lack of visibility
**Needs:** Rich metrics, tracing, circuit breaker controls
**Tech Comfort:** Very high, expert in operations

---

## 5. Success Criteria (Measurable)

### Reliability Metrics

- **Availability:** 99.99%+ gateway availability
- **Failover Speed:** Traffic rerouted within 5 seconds of instance failure
- **Health Check Accuracy:** 99.9%+ accurate health status
- **Circuit Breaker Effectiveness:** 100% isolation of failing downstreams

### Performance Metrics

- **Latency Overhead:** <1ms added latency at p99
- **Throughput:** 100,000+ RPS per instance
- **Memory Efficiency:** <100MB base memory per instance
- **CPU Efficiency:** <10% CPU at max throughput

### Routing Metrics

- **Routing Accuracy:** 99.999%+ correct routing decisions
- **Config Propagation:** Changes propagated within 10 seconds
- **Canary Precision:** Traffic split accuracy within 1%
- **Rate Limit Precision:** 99%+ accurate rate limiting

### Operational Metrics

- **Deployment Success:** 99.9%+ successful zero-downtime deployments
- **Rollback Time:** Rollback completed within 30 seconds
- **Debuggability:** Routing issues debugged within 10 minutes
- **Alert Clarity:** 95% of alerts actionable without runbook

---

## 6. Governance Model

### Component Organization

```
Portalis/
├── discovery/       # Service discovery
├── routing/         # Request routing logic
├── balancing/       # Load balancing
├── health/          # Health checking
├── circuit/         # Circuit breaker
├── gateway/         # Edge gateway
├── metrics/         # Observability
├── control/         # Control plane
└── data/            # Data plane
```

### Development Process

**New Features:**
- Impact on existing routing assessed
- Performance benchmarks
- Rollback considerations

**Routing Changes:**
- Thorough testing in staging
- Gradual rollout
- Monitoring requirements

**Breaking Changes:**
- Migration guide
- Deprecation period
- Version management

---

## 7. Charter Compliance Checklist

### For New Routing Features

- [ ] Health awareness verified
- [ ] Observability implemented
- [ ] Performance benchmarked
- [ ] Gradual rollout supported
- [ ] Tests cover edge cases

### For Discovery Changes

- [ ] Backward compatibility maintained
- [ ] Health check integration
- [ ] Performance impact assessed

### For Breaking Changes

- [ ] Migration guide provided
- [ ] Deprecation notice
- [ ] Version bump

---

## 8. Decision Authority Levels

### Level 1: Maintainer Authority

**Scope:** Bug fixes, documentation
**Process:** Maintainer approval

### Level 2: Core Team Authority

**Scope:** New features, minor routing changes
**Process:** Team review

### Level 3: Technical Steering Authority

**Scope:** Routing algorithm changes, breaking changes
**Process:** Written proposal, steering approval

### Level 4: Executive Authority

**Scope:** Strategic direction, major investments
**Process:** Business case, executive approval

---

*This charter governs Portalis, the service connectivity infrastructure. Reliable routing enables reliable systems.*

*Last Updated: April 2026*
*Next Review: July 2026*
