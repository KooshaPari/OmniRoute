# ADR-001: Portalis API Gateway Architecture

## Status

**Accepted** - Implementation in progress for Portalis v1.0

## Context

Portalis is the Phenotype ecosystem's API gateway, providing routing, rate limiting, authentication, and observability for internal and external APIs. The gateway must support:

1. **Multi-tenancy**: Multiple teams/services sharing infrastructure with isolation
2. **Dynamic Routing**: Route configuration changes without restart
3. **Authentication**: JWT, OAuth 2.0, API keys, and plugin-based auth
4. **Rate Limiting**: Global and per-consumer quotas with configurable algorithms
5. **Observability**: Metrics, logging, and distributed tracing
6. **High Performance**: Handle thousands of requests per second with minimal latency
7. **Configuration**: YAML-based declarative configuration with validation

We evaluated several API gateway approaches before deciding on the architecture.

## Decision

We will implement Portalis as a **lightweight, Rust-based API gateway** with the following architecture:

- **Core**: Custom Rust async runtime (Tokio-based)
- **Routing**: Pattern-matching with prefix/suffix/regex support
- **Plugins**: Middleware chain for auth, rate limiting, logging
- **Configuration**: Declarative YAML with hot reload
- **Transport**: HTTP/1.1 and HTTP/2 support
- **Upstream**: Keep-alive connection pooling with health checks

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Portalis Gateway Architecture                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│   │   Client 1   │     │   Client 2   │     │   Client N   │             │
│   │   (JWT)      │     │   (API Key)  │     │   (OAuth)    │             │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘             │
│          │                    │                    │                       │
│          └────────────────────┼────────────────────┘                       │
│                               │                                             │
│                               ▼                                             │
│                    ┌──────────────────────┐                                │
│                    │    Request Router    │                                │
│                    │  ┌────────────────┐  │                                │
│                    │  │ Host/Router    │  │                                │
│                    │  │ Path Matching   │  │                                │
│                    │  │ Method Filter  │  │                                │
│                    │  └────────────────┘  │                                │
│                    └──────────┬───────────┘                                │
│                               │                                             │
│          ┌────────────────────┼────────────────────┐                       │
│          │                    │                    │                        │
│          ▼                    ▼                    ▼                        │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                │
│   │ Auth Plugin │     │ Rate Limit  │     │ Logging     │                │
│   │  ┌───────┐  │     │  ┌───────┐  │     │  ┌───────┐  │                │
│   │  │  JWT  │  │     │  │Token  │  │     │  │Metrics│  │                │
│   │  │  OIDC │  │     │  │Bucket │  │     │  │ Traces│  │                │
│   │  │API Key│  │     │  │ Slid. │  │     │  │ Audit │  │                │
│   │  └───────┘  │     │  │Window │  │     │  └───────┘  │                │
│   │  ┌───────┐  │     │  └───────┘  │     │             │                │
│   │  │RBAC   │  │     │             │     │             │                │
│   │  └───────┘  │     │             │     │             │                │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                │
│          │                    │                    │                       │
│          └────────────────────┼────────────────────┘                       │
│                               │                                             │
│                               ▼                                             │
│                    ┌──────────────────────┐                                │
│                    │   Upstream Router    │                                │
│                    │  ┌────────────────┐  │                                │
│                    │  │ Load Balancer │  │                                │
│                    │  │ Health Check  │  │                                │
│                    │  │ Retry Logic   │  │                                │
│                    │  └────────────────┘  │                                │
│                    └──────────┬───────────┘                                │
│                               │                                             │
│          ┌────────────────────┼────────────────────┐                       │
│          │                    │                    │                        │
│          ▼                    ▼                    ▼                        │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                │
│   │  Upstream  │     │  Upstream  │     │  Upstream  │                │
│   │    A       │     │    B       │     │    C       │                │
│   │  (user-svc)│     │ (order-svc)│     │ (product)  │                │
│   └─────────────┘     └─────────────┘     └─────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Request Router

```rust
pub struct Router {
    routes: Vec<Route>,
    middlewares: Vec<Box<dyn Middleware>>,
}

impl Router {
    pub fn route(&self, req: &Request) -> Option<RouteMatch> {
        for route in &self.routes {
            if route.matches(req) {
                return Some(RouteMatch::new(route, req));
            }
        }
        None
    }
}

pub struct Route {
    pub name: String,
    pub path: PathPattern,
    pub methods: Vec<Method>,
    pub upstream: UpstreamId,
    pub middlewares: Vec<Box<dyn Middleware>>,
    pub strip_prefix: Option<String>,
}
```

#### 2. Plugin System

```rust
pub trait Middleware: Send + Sync {
    fn name(&self) -> &str;
    async fn handle(&self, ctx: &mut Context) -> Result<Response, GatewayError>;
}

pub struct MiddlewareChain {
    middlewares: Vec<Box<dyn Middleware>>,
}

impl MiddlewareChain {
    pub async fn execute(&self, ctx: &mut Context) -> Result<Response, GatewayError> {
        for mw in &self.middlewares {
            ctx = await mw.handle(ctx)?;
        }
        Ok(ctx.response)
    }
}
```

#### 3. Rate Limiter

```rust
pub trait RateLimiter: Send + Sync {
    fn check(&self, key: &RateLimitKey) -> RateLimitResult;
}

pub struct TokenBucketLimiter {
    capacity: u64,
    refill_rate: f64,
    tokens: RwLock<f64>,
}

pub struct SlidingWindowLimiter {
    window_size: Duration,
    max_requests: u64,
    redis: Option<RedisClient>,
}
```

#### 4. Authentication Providers

```rust
pub trait AuthProvider: Send + Sync {
    fn name(&self) -> &str;
    async fn authenticate(&self, req: &Request) -> AuthResult;
}

pub struct JwtAuthProvider {
    jwks_url: Url,
    issuer: String,
    audience: String,
}

pub struct ApiKeyAuthProvider {
    keys: Arc<HashMap<String, ApiKeyInfo>>,
}

pub struct OAuthProvider {
    client_id: String,
    authorization_url: Url,
    token_url: Url,
}
```

### Configuration Schema

```yaml
gateway:
  name: String
  listen: SocketAddr
  log_level: Level
  tls:
    enabled: bool
    cert_path: Path
    key_path: Path

upstreams:
  - name: UpstreamId
    url: Url
    health_check:
      enabled: bool
      path: String
      interval: Duration
      timeout: Duration
    load_balancer: round_robin | least_conn | ip_hash

routes:
  - name: String
    path: String  # supports *, **, {param}
    methods: [GET, POST, ...]
    upstream: UpstreamId
    strip_prefix: Option<String>
    auth:
      provider: jwt | oauth | api_key | none
      required_roles: [String]
    rate_limit:
      requests: u64
      period: Duration

rate_limits:
  global:
    requests: u64
    period: Duration
    burst: u64

quotas:
  - name: String
    requests: u64
    period: Duration  # hour | day | month
    upstream: UpstreamId

authentication:
  enabled: bool
  jwt:
    jwks_url: Url
    issuer: String
    audience: String
  oauth:
    provider: workos | auth0 | custom
    client_id: String
  api_keys:
    header: String
```

## Consequences

### Positive

1. **Performance**: Rust's zero-cost abstractions and async I/O provide high throughput
2. **Memory Safety**: No GC pauses, deterministic memory usage
3. **Configuration**: Declarative YAML is familiar and easy to version control
4. **Extensibility**: Plugin system allows custom auth, logging, transformations
5. **Hot Reload**: Configuration changes without restart
6. **Observability**: Structured logging, metrics, and tracing integration
7. **Multi-tenancy**: Consumer-based quotas and rate limits

### Negative

1. **Learning Curve**: Rust async patterns differ from Go/Node.js
2. **Compilation Time**: Rust compile times can be slow
3. **Ecosystem**: Smaller HTTP middleware ecosystem vs Express/Koa
4. **Plugin API**: Internal stability required for plugin compatibility

### Neutral

1. **Cold Starts**: Minimal vs Node.js, higher than some compiled languages
2. **Memory Usage**: Lower than JVM-based gateways, higher than Go

## Alternatives Considered

### Alternative 1: Kong Gateway (NGINX/Lua)

**Approach**: Use Kong as the API gateway with Lua plugins.

**Rejected Because**:
- Heavy resource usage (NGINX + Lua VM)
- Database dependency (PostgreSQL/Cassandra) for config
- Complex plugin development in Lua
- Horizontal scaling requires shared state
- Higher latency per request

**Comparison:**
| Metric | Kong | Portalis |
|--------|------|----------|
| Requests/sec | 5,000 | 50,000+ |
| P99 Latency | 15ms | 2ms |
| Memory/request | 2KB | 0.5KB |
| Config reload | Restart | Hot |

### Alternative 2: Envoy Proxy

**Approach**: Use Envoy as the data plane with custom control plane.

**Rejected Because**:
- Complex configuration (xDS protocol)
- Heavy for simple use cases
- Lua/WASM for custom logic
- Java/Golang control plane complexity
- Over-engineered for our needs

### Alternative 3: Go-based Gateway (echo/gorilla)

**Approach**: Build custom gateway using Go frameworks.

**Considered But**:
- Runtime GC pauses affect latency consistency
- Larger binary size than Rust
- Less compile-time safety
- Good alternative if Rust expertise unavailable

### Alternative 4: Node.js Gateway (Fastify)

**Approach**: Build gateway with Node.js/Fastify.

**Rejected Because**:
- GC pauses at high request rates
- Lower throughput than compiled languages
- Callback complexity without async/await clarity
- Not suitable for high-performance scenarios

## Implementation Phases

### Phase 1: Core Gateway
- HTTP server with routing
- Basic upstream forwarding
- Health checks
- Configuration loading

### Phase 2: Authentication
- JWT validation
- API key authentication
- OAuth 2.0/OIDC integration
- RBAC middleware

### Phase 3: Rate Limiting
- Token bucket algorithm
- Sliding window algorithm
- Per-consumer quotas
- Redis integration for distributed limiting

### Phase 4: Observability
- Structured logging (tracing)
- Prometheus metrics
- OpenTelemetry traces
- Audit logging

### Phase 5: Advanced Features
- gRPC proxying
- WebSocket support
- Request/response transformation
- Circuit breaker

## Security Considerations

### Authentication Security
- JWT signatures verified against JWKS
- API keys stored with bcrypt hashing
- OAuth tokens never logged
- Rate limiting on auth endpoints

### Transport Security
- TLS 1.2+ required
- Strong cipher suites
- Certificate rotation support

### Configuration Security
- Secrets in environment variables
- No plaintext passwords in config
- Config validation before apply

## Related Decisions

- [ADR-001: Technology Stack Selection](./ADR-001-tech-stack.md)
- [ADR-002: Authentication Patterns](./ADR-002-auth-patterns.md)
- [Central ADR Index](../AgilePlus/ADR/)

## References

1. [Tokio Runtime](https://tokio.rs/)
2. [Hyper HTTP Library](https://hyper.rs/)
3. [API Gateway Patterns](https://microservices.io/patterns/apigateway.html)
4. [Rate Limiting Algorithms](https://redis.io/docs/manual送的/)送的
5. [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

## Notes

### Performance Targets

| Metric | Target |
|--------|--------|
| Throughput | 50,000+ req/s |
| P50 Latency | < 1ms |
| P99 Latency | < 5ms |
| P999 Latency | < 10ms |
| Memory/request | < 1KB |
| Connection capacity | 100,000+ |

### Future Considerations

1. **GraphQL Support**: Add GraphQL-specific routing and query analysis
2. **Multi-region**: Geographic routing and replication
3. **Service Mesh**: Integration with Linkerd/Istio
4. **Edge Computing**: Lightweight gateway for edge deployments

---

**Author**: Portalis Team  
**Date**: 2026-04-04  
**Status**: Accepted and In Progress
