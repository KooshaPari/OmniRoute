# SPEC.md - Portalis API Gateway Specification

**Project:** Portalis - Phenotype Ecosystem API Gateway  
**Version:** 2.0.0  
**Status:** In Development  
**Last Updated:** 2026-04-05

---

## Executive Summary

Portalis is a high-performance, Rust-based API gateway designed for the Phenotype ecosystem. It provides enterprise-grade routing, authentication, rate limiting, and observability for internal and external APIs with industry-leading performance characteristics.

### Mission Statement

Enable seamless, secure, and high-performance API connectivity across the Phenotype ecosystem while maintaining operational simplicity and cost efficiency.

### Key Value Propositions

| Value Proposition | Description | Benefit |
|-------------------|-------------|---------|
| **Extreme Performance** | 50,000+ req/s throughput with <2ms P99 latency | Reduced infrastructure costs, better user experience |
| **Memory Efficiency** | <0.5KB memory per request | Higher density, lower cloud costs |
| **Operational Simplicity** | Single binary, hot config reload | Reduced operational overhead |
| **Security-First** | Zero-trust architecture, mTLS, JWT | Compliance, data protection |
| **Cloud-Native** | Kubernetes-native, Prometheus metrics | Modern deployment practices |

### Target Metrics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Portalis Performance Targets                           │
│                                                                         │
│   Throughput:        50,000+ requests/second                             │
│   P50 Latency:       <1ms                                              │
│   P99 Latency:       <2ms                                              │
│   P999 Latency:      <5ms                                              │
│   Memory/Request:    <0.5KB                                            │
│   Cold Start:        <300ms                                            │
│   Max Connections:   100,000+                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Project Overview

### 1.1 Purpose

Portalis is a high-performance, Rust-based API gateway designed for the Phenotype ecosystem. It provides enterprise-grade routing, authentication, rate limiting, and observability for internal and external APIs.

### 1.2 Scope

This specification covers the complete technical requirements, architecture decisions, and implementation details for Portalis v2.0.

### 1.3 Target Users

| User Type | Use Case | Primary Features |
|-----------|----------|------------------|
| Platform Engineers | Deploy and manage API infrastructure | CLI tools, config management |
| Backend Developers | Expose microservices via gateway | Routing, auth, rate limiting |
| Security Engineers | Implement API security policies | OAuth, JWT, RBAC, audit logs |
| DevOps Teams | Monitor and scale API infrastructure | Prometheus metrics, OpenTelemetry |
| External Partners | Integrate via controlled API access | API keys, throttling, documentation |

### 1.4 Key Features

- High-performance request routing (50,000+ req/s)
- Multiple authentication methods (JWT, OAuth2, API Keys, mTLS)
- Advanced rate limiting (Token Bucket, Sliding Window)
- Real-time observability (Prometheus, OpenTelemetry, Structured Logging)
- Dynamic configuration with hot reloading
- Service mesh integration capabilities
- WebSocket and gRPC proxying

---

## 2. Technology Landscape Analysis

### 2.1 API Gateway Market Overview

The API gateway market has evolved significantly with the adoption of microservices and cloud-native architectures. Key players include Kong, Envoy, NGINX, AWS API Gateway, and custom solutions.

### 2.2 Core Technology Comparison

| Project | License | Language | Throughput | P99 Latency | Memory/Req | Ecosystem |
|---------|---------|----------|-----------|-------------|------------|-----------|
| Kong | Apache 2.0 | Lua/NGINX | 5,000 req/s | 15ms | 2KB | Enterprise plugins |
| Envoy | Apache 2.0 | C++ | 20,000 req/s | 5ms | 1KB | Istio integration |
| Tyk | MPL 2.0 | Go | 15,000 req/s | 8ms | 1.5KB | Dashboard, portal |
| KrakenD | Apache 2.0 | Go | 50,000 req/s | 3ms | 0.8KB | Simple config |
| Gloo | Apache 2.0 | Go | 12,000 req/s | 10ms | 1.2KB | Solo.io product |
| AWS API Gateway | Commercial | Proprietary | Auto-scaling | 5ms | Managed | AWS deep integration |
| Azure API Management | Commercial | Proprietary | Auto-scaling | 10ms | Managed | Azure integration |
| **Portalis** | **Apache 2.0** | **Rust** | **50,000+ req/s** | **2ms** | **0.5KB** | **Developing** |

### 2.3 Performance Metrics

| Metric | Kong | Envoy | Tyk | KrakenD | Portalis Target |
|--------|------|-------|-----|---------|----------------|
| Requests/sec | 5,000 | 20,000 | 15,000 | 50,000 | 50,000+ |
| P50 Latency | 5ms | 2ms | 3ms | 1ms | <1ms |
| P99 Latency | 15ms | 5ms | 8ms | 3ms | 2ms |
| P999 Latency | 50ms | 15ms | 25ms | 10ms | 5ms |
| Memory/Request | 2KB | 1KB | 1.5KB | 0.8KB | 0.5KB |
| Cold Start | 2s | 1s | 1.5s | 0.5s | 0.3s |
| Max Connections | 50,000 | 100,000 | 75,000 | 100,000 | 100,000+ |

### 2.4 Authentication Provider Comparison

| Provider | JWT | OAuth2 | API Keys | LDAP | SAML | mTLS |
|----------|-----|-------|----------|------|------|------|
| Kong | Yes | Yes | Yes | Yes | Yes | Yes |
| Envoy | Yes | External | No | No | No | Yes |
| Tyk | Yes | Yes | Yes | Yes | Yes | Yes |
| AWS API GW | Yes | Yes | Yes | No | Yes | Yes |
| **Portalis** | **Yes** | **Yes** | **Yes** | **Planned** | **Planned** | **Yes** |

### 2.5 Rate Limiting Algorithm Comparison

| Algorithm | Precision | Distributed | Memory | Use Case |
|-----------|-----------|-------------|--------|----------|
| Token Bucket | High | Yes (Redis) | Low | API quotas |
| Leaky Bucket | High | Yes | Low | Rate smoothing |
| Sliding Window | Medium | Yes (Redis) | Medium | Sliding quotas |
| Fixed Window | High | No | Low | Simple quotas |
| **Portalis Token Bucket** | **High** | **Yes (Redis)** | **Low** | **Premium quotas** |
| **Portalis Sliding Window** | **Medium** | **Yes (Redis)** | **Medium** | **Time-based quotas** |

### 2.6 Observability Stack Comparison

| Feature | Kong | Envoy | Tyk | Portalis |
|---------|------|-------|-----|----------|
| Prometheus Metrics | Yes | Yes | Yes | Yes |
| Grafana Dashboards | Yes | Yes | Yes | Yes |
| OpenTelemetry | Yes | Yes | Yes | Yes |
| Structured Logging | JSON | JSON | JSON | JSON + tracing |
| Access Logs | Yes | Yes | Yes | Yes |
| Audit Logs | Yes | No | Yes | Yes |

---

## 3. Architecture Specification

### 3.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Portalis System Architecture                         │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Client Requests                                │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Layer 1: Edge Layer                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  TLS     │  │  DDoS    │  │  WAF     │  │  Geo     │              │  │
│  │  │  Term.   │  │  Protect │  │  Rules   │  │  Routing │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Layer 2: Routing Layer                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Route   │  │  Path    │  │  Host    │  │  Method  │              │  │
│  │  │  Match   │  │  Parsing │  │  Routing │  │  Filter  │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Layer 3: Middleware Layer                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Auth    │  │  Rate    │  │  Trans-  │  │  CORS    │              │  │
│  │  │  (JWT)   │  │  Limit   │  │  form    │  │  Handler │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Layer 4: Upstream Layer                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Load    │  │  Health  │  │  Circuit │  │  Retry   │              │  │
│  │  │  Balance │  │  Check   │  │  Breaker │  │  Logic   │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │  │
│  └─────────────────────────────────┬─────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Backend Services                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Portalis Component Diagram                               │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         API Gateway Core                               │  │
│  │                                                                        │  │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │  │
│  │   │   HTTP      │   │   Router    │   │  Middleware │                │  │
│  │   │   Server    │──▶│   Engine    │──▶│   Chain     │                │  │
│  │   │  (Hyper)    │   │(Radix Tree) │   │             │                │  │
│  │   └─────────────┘   └─────────────┘   └──────┬──────┘                │  │
│  │                                               │                        │  │
│  │   ┌─────────────┐   ┌─────────────┐   ┌───────▼───────┐                │  │
│  │   │   Config    │   │   Load      │   │   Upstream    │                │  │
│  │   │   Manager   │   │   Balancer  │◀──│   Client      │                │  │
│  │   │ (Hot Reload)│   │             │   │               │                │  │
│  │   └─────────────┘   └─────────────┘   └───────────────┘                │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Supporting Services                              │  │
│  │                                                                        │  │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │  │
│  │   │   Auth      │   │   Rate      │   │   Metrics   │                │  │
│  │   │   Service   │   │   Limiter   │   │   (Prom)    │                │  │
│  │   │             │   │             │   │             │                │  │
│  │   └─────────────┘   └─────────────┘   └─────────────┘                │  │
│  │                                                                        │  │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │  │
│  │   │   Tracing   │   │   Logging   │   │   Health    │                │  │
│  │   │  (OTel)     │   │ (Structured)│   │   Checks    │                │  │
│  │   └─────────────┘   └─────────────┘   └─────────────┘                │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Request Pipeline

```
Request Flow:
════════════

Client Request
     │
     ▼
┌─────────────────┐
│ TLS Termination │ ◄── Decrypt, verify client certs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Connection Pool │ ◄── Manage keep-alive, upstream connections
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route Matching   │ ◄── Pattern matching, method filtering
│  (Radix Tree)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              Middleware Chain (Ordered)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Auth    │  │  Rate    │  │  Log     │              │
│  │  Layer   │──│  Limit   │──│  & Trans │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
┌─────────────────┐
│    Upstream       │ ◄── Load balancing, health checks, retries
│    Request        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend Service│
└────────┬────────┘
         │
         ▼
    Response
```

### 3.4 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Data Flow Through Portalis                            │
│                                                                              │
│   Phase 1: Request Ingestion                                               │
│   ═══════════════════════════                                               │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│   │  TCP    │───▶│  HTTP   │───▶│  Header │───▶│  Body   │               │
│   │ Accept  │    │ Parse   │    │ Parse   │    │ Read    │               │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘               │
│                                                                              │
│   Phase 2: Processing                                                        │
│   ═══════════════════                                                        │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│   │ Route   │───▶│  Auth   │───▶│  Rate   │───▶│  Trans  │               │
│   │ Match   │    │ Check   │    │ Limit   │    │ form    │               │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘               │
│                                                                              │
│   Phase 3: Upstream Communication                                            │
│   ═════════════════════════════════                                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│   │ Select  │───▶│ Connect │───▶│  Send   │───▶│ Receive │               │
│   │ Backend │    │  Pool   │    │ Request │    │ Response│               │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘               │
│                                                                              │
│   Phase 4: Response Delivery                                                 │
│   ══════════════════════════                                                 │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│   │ Response│───▶│  Post   │───▶│  Encode │───▶│  Send   │               │
│   │  Check  │    │ Process │    │         │    │ Client  │               │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Middleware Pipeline

| Order | Middleware | Purpose | Configuration |
|-------|-----------|---------|---------------|
| 1 | TLS | Transport security | TLS 1.2+, cipher suites |
| 2 | IP Allow/Deny | Network access control | CIDR ranges |
| 3 | JWT Auth | Token validation | JWKS URL, issuer, audience |
| 4 | OAuth | Token exchange, OIDC | Provider, client credentials |
| 5 | API Key | Key validation | Header name, key storage |
| 6 | RBAC | Role-based access | Role mappings |
| 7 | Rate Limit | Quota enforcement | Algorithm, limits |
| 8 | Transform | Request/Response | Header, body mapping |
| 9 | CORS | Cross-origin policy | Allowed origins, methods |
| 10 | Logging | Audit trail | Log level, format |
| 11 | Metrics | Observability | Prometheus counters |

### 3.6 Configuration Schema

```yaml
# Complete Portalis Configuration Schema
gateway:
  name: string                          # Gateway instance name
  version: string                       # Configuration version
  listen: "0.0.0.0:8080"               # Bind address
  admin_listen: "127.0.0.1:9090"       # Admin API bind address
  log_level: info                       # error | warn | info | debug | trace
  shutdown_timeout: 30s                 # Graceful shutdown timeout
  
  # Worker configuration
  workers:
    threads: auto                       # Number of worker threads (auto = num_cpus)
    max_connections: 100000             # Maximum concurrent connections
    connection_timeout: 60s             # Connection idle timeout
    request_timeout: 30s                # Request processing timeout
    
  # Buffer configuration
  buffers:
    read_buffer_size: 8192              # Bytes per connection read buffer
    write_buffer_size: 8192             # Bytes per connection write buffer
    max_request_size: 10485760          # 10MB max request body
    max_response_size: 104857600        # 100MB max response body

tls:
  enabled: true
  cert_path: /certs/tls.crt
  key_path: /certs/tls.key
  min_version: "1.2"
  max_version: "1.3"
  cipher_suites:
    - TLS_AES_256_GCM_SHA384
    - TLS_AES_128_GCM_SHA256
    - TLS_CHACHA20_POLY1305_SHA256
  client_auth: optional                 # none | optional | require
  client_ca_path: /certs/ca.crt         # Required if client_auth != none
  session_tickets: true
  session_timeout: 24h
  
  # OCSP Stapling
  ocsp_stapling:
    enabled: true
    responders: []                      # Auto-discover if empty
    
  # Certificate rotation
  rotation:
    enabled: true
    check_interval: 5m
    
upstream_defaults:
  # Default settings applied to all upstreams
  connection_pool:
    max_connections: 100
    max_idle: 10
    idle_timeout: 90s
    
  load_balancer:
    algorithm: round_robin              # round_robin | least_conn | ip_hash | random
    health_check_aware: true            # Skip unhealthy backends
    
  circuit_breaker:
    enabled: true
    max_failures: 5
    timeout: 30s
    half_open_max_calls: 10             # Test calls when half-open
    
  retry:
    enabled: true
    max_attempts: 3
    backoff: exponential                # fixed | exponential | linear
    retry_on:                           # HTTP status codes to retry
      - 502
      - 503
      - 504
    timeout_ms: 1000
    
  timeout:
    connect: 5s
    read: 30s
    write: 30s

upstreams:
  - name: user-service
    url: http://user-svc:3000
    aliases:
      - http://user-svc-backup:3000
    health_check:
      enabled: true
      protocol: http                    # http | https | tcp
      path: /health
      method: GET
      interval: 10s
      timeout: 5s
      healthy_threshold: 2
      unhealthy_threshold: 3
      expected_codes: [200, 204]
      expected_body: ""                 # Optional body content check
      
    load_balancer:
      algorithm: round_robin
      weights:                          # Optional weights for weighted algorithms
        - endpoint: http://user-svc:3000
          weight: 100
        - endpoint: http://user-svc-backup:3000
          weight: 50
          
    circuit_breaker:
      enabled: true
      max_failures: 5
      timeout: 30s
      
    retry:
      enabled: true
      max_attempts: 3
      
    tls:
      enabled: false
      verify_certificate: true
      ca_cert: /certs/upstream-ca.crt
      client_cert: /certs/client.crt
      client_key: /certs/client.key
      
  - name: order-service
    url: http://order-svc:3001
    # Inherits defaults, can override specific fields
    
  - name: inventory-service
    url: http://inventory-svc:3002
    
  - name: payment-service
    url: http://payment-svc:3003
    # Payment service with stricter timeouts
    timeout:
      connect: 2s
      read: 10s
      write: 10s

routes:
  - name: users-api
    path: /api/users
    methods: [GET, POST, PUT, DELETE]
    upstream: user-service
    strip_prefix: /api
    preserve_host: false
    host_rewrite: null                  # Override Host header
    
    # Path parameters extraction
    path_params:
      - name: id
        pattern: "/api/users/{id}"
        
    # Query parameter forwarding
    query_params:
      forward_all: true
      include: []                       # If forward_all: false
      exclude: [debug]                  # Always exclude these
      
    plugins:
      - name: jwt-auth
        priority: 100
        enabled: true
        config:
          jwks_url: https://auth.example.com/.well-known/jwks.json
          jwks_refresh_interval: 15m
          issuer: "https://auth.example.com"
          audience: ["portalis", "user-service"]
          algorithms: [RS256, RS512]
          claims_validation:
            exp: true
            nbf: true
            iat: true
            custom:
              - claim: role
                values: [admin, user]
                required: false
          token_source:
            header: Authorization
            prefix: "Bearer "
            cookie: jwt_token
            query_param: token
            
      - name: rate-limit
        priority: 200
        enabled: true
        config:
          algorithm: token_bucket
          limit: 1000
          period: 1h
          burst: 100
          key_source:
            type: consumer                # consumer | ip | header | custom
            header: X-Consumer-ID
          distributed:
            enabled: true
            backend: redis
            redis_url: redis://localhost:6379
            key_prefix: "rate_limit:"
          response_headers:
            include_limit: true
            include_remaining: true
            include_reset: true
          on_limit_exceeded:
            status_code: 429
            message: "Rate limit exceeded"
            retry_after: true
            
      - name: rbac
        priority: 150
        enabled: true
        config:
          roles_claim: "roles"
          permissions_claim: "permissions"
          require_any_role: [user, admin]
          deny_roles: [banned]
          
      - name: transform-request
        priority: 300
        enabled: true
        config:
          headers:
            add:
              X-Request-ID: "{{request.id}}"
              X-Forwarded-For: "{{client.ip}}"
            remove:
              - X-Internal-Token
          body:
            type: json
            transformations:
              - operation: add
                path: ".metadata.source"
                value: "portalis"
              - operation: rename
                path: ".user_id"
                new_name: "userId"
                
      - name: cors
        priority: 400
        enabled: true
        config:
          allow_origins: ["https://app.example.com", "https://admin.example.com"]
          allow_methods: [GET, POST, PUT, DELETE, OPTIONS]
          allow_headers: [Authorization, Content-Type, X-Request-ID]
          expose_headers: [X-RateLimit-Limit, X-RateLimit-Remaining]
          allow_credentials: true
          max_age: 86400
          
      - name: logging
        priority: 500
        enabled: true
        config:
          format: json
          level: info
          fields:
            - request_id
            - timestamp
            - method
            - path
            - status_code
            - duration_ms
            - upstream_latency_ms
            - client_ip
            - consumer_id
            - error_message
          sampling:
            enabled: true
            rate: 1.0                  # Log 100% (use 0.1 for 10%)
            
      - name: metrics
        priority: 600
        enabled: true
        config:
          counter: portalis_requests_total
          histogram: portalis_request_duration_seconds
          labels:
            - route: "{{route.name}}"
            - method: "{{request.method}}"
            - status: "{{response.status}}"
            - upstream: "{{upstream.name}}"

  - name: users-api-public
    path: /api/public/users
    methods: [GET]
    upstream: user-service
    strip_prefix: /api/public
    plugins:
      - name: rate-limit
        config:
          algorithm: token_bucket
          limit: 100
          period: 1m
          key_source:
            type: ip
            
  - name: orders-api
    path: /api/orders
    methods: [GET, POST, PUT, DELETE]
    upstream: order-service
    strip_prefix: /api
    plugins:
      - name: jwt-auth
        config:
          jwks_url: https://auth.example.com/.well-known/jwks.json
      - name: rate-limit
        config:
          limit: 500
          period: 1h

consumers:
  - id: consumer-001
    name: mobile-app
    credentials:
      api_keys:
        - key: "pk_live_xxxxxxxxxx"
          name: production-key
      jwt:
        issuers: ["https://auth.example.com"]
        algorithms: [RS256]
    rate_limits:
      - route: users-api
        limit: 5000
        period: 1h
      - route: orders-api
        limit: 1000
        period: 1h
    metadata:
      tier: premium
      region: us-west
      
  - id: consumer-002
    name: partner-integration
    credentials:
      api_keys:
        - key: "pk_partner_xxxxxxxx"
    rate_limits:
      - global: true
        limit: 10000
        period: 1h

# Global plugins (applied to all routes)
global_plugins:
  - name: request-id
    config:
      header: X-Request-ID
      generate_if_missing: true
      
  - name: security-headers
    config:
      headers:
        X-Content-Type-Options: nosniff
        X-Frame-Options: DENY
        X-XSS-Protection: 1; mode=block
        Strict-Transport-Security: max-age=31536000; includeSubDomains
        Content-Security-Policy: default-src 'self'

# Admin API configuration
admin:
  enabled: true
  listen: "127.0.0.1:9090"
  tls:
    enabled: false
  auth:
    type: basic
    credentials:
      - username: admin
        password: ${ADMIN_PASSWORD}      # Environment variable substitution
  endpoints:
    - routes
    - upstreams
    - consumers
    - config
    - health
    - metrics
    
# Observability configuration
observability:
  metrics:
    enabled: true
    format: prometheus
    endpoint: /metrics
    prefix: portalis
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    
  tracing:
    enabled: true
    exporter: otlp                       # otlp | jaeger | zipkin
    otlp_endpoint: http://otel-collector:4317
    sampling_rate: 0.1                 # 10% sampling
    service_name: portalis-gateway
    attributes:
      environment: production
      region: us-west
      
  logging:
    enabled: true
    level: info
    format: json
    output: stdout                       # stdout | stderr | file
    file_path: /var/log/portalis.log     # If output: file
    rotation:
      enabled: true
      max_size: 100MB
      max_files: 10
      max_age: 7d
      compress: true
      
# Storage backends
storage:
  redis:
    enabled: true
    url: redis://localhost:6379
    password: ${REDIS_PASSWORD}
    database: 0
    connection_pool:
      min: 5
      max: 50
      timeout: 5s
      idle_timeout: 60s
      max_lifetime: 5m
      
  # For distributed rate limiting and session storage
  etcd:
    enabled: false
    endpoints:
      - http://etcd-1:2379
      - http://etcd-2:2379
      - http://etcd-3:2379
    timeout: 5s
    
# Service discovery
service_discovery:
  enabled: false
  type: consul                          # consul | etcd | kubernetes | dns
  consul:
    address: localhost:8500
    scheme: http
    datacenter: dc1
  kubernetes:
    in_cluster: true
    namespace: default
```

---

## 4. Functional Requirements

### 4.1 Core Features

| FR-ID | Feature | Priority | Description |
|-------|---------|----------|-------------|
| FR-001 | HTTP Routing | P0 | Route HTTP requests by host, path, method |
| FR-002 | gRPC Routing | P1 | Route gRPC requests with schema validation |
| FR-003 | WebSocket | P1 | Proxy WebSocket connections |
| FR-004 | TLS Termination | P0 | Terminate TLS with custom certificates |
| FR-005 | JWT Authentication | P0 | Validate JWT tokens with JWKS |
| FR-006 | OAuth 2.0/OIDC | P0 | Integrate with OAuth providers |
| FR-007 | API Key Auth | P0 | Validate API keys from header |
| FR-008 | RBAC | P1 | Role-based access control |
| FR-009 | Token Bucket Rate Limit | P0 | Token bucket algorithm |
| FR-010 | Sliding Window Rate Limit | P1 | Sliding window algorithm |
| FR-011 | Per-Consumer Quotas | P1 | Consumer-specific limits |
| FR-012 | Prometheus Metrics | P0 | Export metrics in Prometheus format |
| FR-013 | OpenTelemetry Tracing | P0 | Distributed tracing support |
| FR-014 | Structured Logging | P0 | JSON logging with correlation IDs |
| FR-015 | Hot Config Reload | P0 | Update config without restart |
| FR-016 | Health Checks | P0 | Upstream health monitoring |
| FR-017 | Circuit Breaker | P1 | Prevent cascade failures |
| FR-018 | Request Transformation | P2 | Header/body mapping |
| FR-019 | CORS | P1 | Cross-origin request handling |
| FR-020 | Admin API | P0 | CLI/API for gateway management |

### 4.2 Routing Features

| FR-ID | Feature | Description |
|-------|---------|-------------|
| FR-101 | Path Parameters | Extract `/users/{id}` parameters |
| FR-102 | Wildcard Matching | Support `/*` and `/**` patterns |
| FR-103 | Regex Routes | Perl-compatible regex support |
| FR-104 | Route Priority | Explicit priority ordering |
| FR-105 | Strip Prefix | Remove path prefix before upstream |
| FR-106 | Redirects | HTTP redirects with code selection |
| FR-107 | Direct Responses | Return fixed responses |
| FR-108 | Mirroring | Mirror traffic to shadow endpoints |

### 4.3 Authentication Features

| FR-ID | Feature | Description |
|-------|---------|-------------|
| FR-201 | JWT RS256 | RS256 signature verification |
| FR-202 | JWT RS384 | RS384 signature verification |
| FR-203 | JWT RS512 | RS512 signature verification |
| FR-204 | JWKS Caching | Cache JWKS with TTL |
| FR-205 | Token Introspection | RFC 7662 token introspection |
| FR-206 | API Key Rotation | Support key rotation without downtime |
| FR-207 | mTLS | Client certificate authentication |
| FR-208 | LDAP Auth | LDAP directory integration |
| FR-209 | SAML SP | SAML Service Provider support |

### 4.4 Rate Limiting Features

| FR-ID | Feature | Description |
|-------|---------|-------------|
| FR-301 | Global Limits | Limits applied to all requests |
| FR-302 | Per-Route Limits | Limits per route definition |
| FR-303 | Per-Consumer Limits | Consumer-specific quotas |
| FR-304 | Burst Handling | Allow bursts within limits |
| FR-305 | Distributed Limits | Redis-backed rate limiting |
| FR-306 | Custom Key | Custom rate limit key generation |
| FR-307 | Retry-After Header | Return Retry-After on limit hit |
| FR-308 | Rate Limit Headers | X-RateLimit-* response headers |

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Throughput | 50,000 req/s | Load test with 1KB payloads |
| P50 Latency | <1ms | Over 1M requests |
| P99 Latency | <5ms | Over 1M requests |
| P999 Latency | <10ms | Over 1M requests |
| Memory/Request | <1KB | Measured under load |
| Max Connections | 100,000 | Per gateway instance |
| TLS Handshake | <3ms | RSA-2048 |

### 5.2 Reliability Requirements

| Metric | Target |
|--------|--------|
| Uptime | 99.99% |
| MTTR | <5 minutes |
| MTBF | >720 hours |
| Error Rate | <0.01% |

### 5.3 Security Requirements

| Requirement | Standard |
|-------------|----------|
| TLS Version | TLS 1.2 minimum, TLS 1.3 preferred |
| Cipher Suites | NIST-recommended suites |
| JWT Validation | RFC 8725 compliant |
| API Key Storage | bcrypt hashing |
| Secrets Management | Environment variables, Vault |
| Audit Logging | All auth attempts logged |

### 5.4 Compatibility Requirements

| Standard | Compliance |
|----------|------------|
| HTTP/1.1 | RFC 7230-7235 |
| HTTP/2 | RFC 7540 |
| gRPC | grpc.io spec |
| WebSocket | RFC 6455 |
| TLS | RFC 5246, RFC 8446 |
| JWT | RFC 8725 |
| OAuth 2.0 | RFC 6749 |
| OIDC | OpenID Connect 1.0 |
| Prometheus | OpenMetrics format |
| OpenTelemetry | OTLP protocol |

---

## 6. Data Models

### 6.1 Route Data Model

```rust
/// Core route definition for request routing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    /// Unique route identifier
    pub name: String,
    
    /// URL path pattern (e.g., "/api/users/{id}")
    pub path: String,
    
    /// HTTP methods allowed (GET, POST, etc.)
    pub methods: Vec<HttpMethod>,
    
    /// Target upstream service name
    pub upstream: String,
    
    /// Path prefix to strip before forwarding
    #[serde(default)]
    pub strip_prefix: Option<String>,
    
    /// Whether to preserve original Host header
    #[serde(default = "default_false")]
    pub preserve_host: bool,
    
    /// Override Host header value
    #[serde(default)]
    pub host_rewrite: Option<String>,
    
    /// Priority for route matching (higher = first)
    #[serde(default)]
    pub priority: i32,
    
    /// Route tags for organization
    #[serde(default)]
    pub tags: Vec<String>,
    
    /// Enabled plugins for this route
    #[serde(default)]
    pub plugins: Vec<PluginConfig>,
    
    /// Metadata for extensibility
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

/// HTTP method enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Head,
    Options,
    Connect,
    Trace,
}

/// Plugin configuration for routes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    /// Plugin name (e.g., "jwt-auth")
    pub name: String,
    
    /// Execution priority (lower = earlier)
    #[serde(default = "default_plugin_priority")]
    pub priority: i32,
    
    /// Whether plugin is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
    
    /// Plugin-specific configuration
    #[serde(flatten)]
    pub config: serde_json::Value,
}

fn default_plugin_priority() -> i32 { 100 }
fn default_true() -> bool { true }
fn default_false() -> bool { false }
```

### 6.2 Upstream Data Model

```rust
/// Upstream service definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Upstream {
    /// Unique upstream name
    pub name: String,
    
    /// Primary upstream URL
    pub url: Url,
    
    /// Backup/alternative URLs
    #[serde(default)]
    pub aliases: Vec<Url>,
    
    /// Health check configuration
    #[serde(default)]
    pub health_check: HealthCheckConfig,
    
    /// Load balancer settings
    #[serde(default)]
    pub load_balancer: LoadBalancerConfig,
    
    /// Circuit breaker configuration
    #[serde(default)]
    pub circuit_breaker: CircuitBreakerConfig,
    
    /// Retry policy
    #[serde(default)]
    pub retry: RetryConfig,
    
    /// Connection timeouts
    #[serde(default)]
    pub timeout: TimeoutConfig,
    
    /// TLS configuration for upstream
    #[serde(default)]
    pub tls: UpstreamTlsConfig,
    
    /// Connection pool settings
    #[serde(default)]
    pub connection_pool: ConnectionPoolConfig,
    
    /// Metadata
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

/// Health check configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HealthCheckConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    
    #[serde(default = "default_health_protocol")]
    pub protocol: HealthCheckProtocol,
    
    #[serde(default = "default_health_path")]
    pub path: String,
    
    #[serde(default = "default_health_method")]
    pub method: HttpMethod,
    
    #[serde(default = "default_health_interval")]
    pub interval: Duration,
    
    #[serde(default = "default_health_timeout")]
    pub timeout: Duration,
    
    #[serde(default = "default_healthy_threshold")]
    pub healthy_threshold: u32,
    
    #[serde(default = "default_unhealthy_threshold")]
    pub unhealthy_threshold: u32,
    
    #[serde(default)]
    pub expected_codes: Vec<u16>,
    
    #[serde(default)]
    pub expected_body: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthCheckProtocol {
    Http,
    Https,
    Tcp,
}

fn default_health_protocol() -> HealthCheckProtocol { HealthCheckProtocol::Http }
fn default_health_path() -> String { "/health".to_string() }
fn default_health_method() -> HttpMethod { HttpMethod::Get }
fn default_health_interval() -> Duration { Duration::from_secs(10) }
fn default_health_timeout() -> Duration { Duration::from_secs(5) }
fn default_healthy_threshold() -> u32 { 2 }
fn default_unhealthy_threshold() -> u32 { 3 }

/// Load balancer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancerConfig {
    #[serde(default = "default_lb_algorithm")]
    pub algorithm: LoadBalancerAlgorithm,
    
    #[serde(default)]
    pub weights: Vec<EndpointWeight>,
    
    #[serde(default = "default_true")]
    pub health_check_aware: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoadBalancerAlgorithm {
    RoundRobin,
    LeastConnections,
    IpHash,
    Random,
    WeightedRoundRobin,
    ConsistentHash,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointWeight {
    pub endpoint: Url,
    pub weight: u32,
}

fn default_lb_algorithm() -> LoadBalancerAlgorithm { LoadBalancerAlgorithm::RoundRobin }

/// Circuit breaker configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    
    #[serde(default = "default_max_failures")]
    pub max_failures: u32,
    
    #[serde(default = "default_cb_timeout")]
    pub timeout: Duration,
    
    #[serde(default = "default_half_open_max")]
    pub half_open_max_calls: u32,
    
    #[serde(default = "default_failure_threshold")]
    pub failure_threshold: f64,
}

fn default_max_failures() -> u32 { 5 }
fn default_cb_timeout() -> Duration { Duration::from_secs(30) }
fn default_half_open_max() -> u32 { 10 }
fn default_failure_threshold() -> f64 { 0.5 }

/// Retry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    
    #[serde(default = "default_max_attempts")]
    pub max_attempts: u32,
    
    #[serde(default = "default_backoff")]
    pub backoff: BackoffStrategy,
    
    #[serde(default = "default_retry_on")]
    pub retry_on: Vec<u16>,
    
    #[serde(default = "default_retry_timeout")]
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackoffStrategy {
    Fixed,
    Linear,
    Exponential,
}

fn default_max_attempts() -> u32 { 3 }
fn default_backoff() -> BackoffStrategy { BackoffStrategy::Exponential }
fn default_retry_on() -> Vec<u16> { vec![502, 503, 504] }
fn default_retry_timeout() -> u64 { 1000 }

/// Timeout configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeoutConfig {
    #[serde(default = "default_connect_timeout")]
    pub connect: Duration,
    
    #[serde(default = "default_read_timeout")]
    pub read: Duration,
    
    #[serde(default = "default_write_timeout")]
    pub write: Duration,
}

fn default_connect_timeout() -> Duration { Duration::from_secs(5) }
fn default_read_timeout() -> Duration { Duration::from_secs(30) }
fn default_write_timeout() -> Duration { Duration::from_secs(30) }

/// Connection pool configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionPoolConfig {
    #[serde(default = "default_pool_max")]
    pub max_connections: u32,
    
    #[serde(default = "default_pool_idle")]
    pub max_idle: u32,
    
    #[serde(default = "default_pool_idle_timeout")]
    pub idle_timeout: Duration,
    
    #[serde(default = "default_pool_lifetime")]
    pub max_lifetime: Duration,
}

fn default_pool_max() -> u32 { 100 }
fn default_pool_idle() -> u32 { 10 }
fn default_pool_idle_timeout() -> Duration { Duration::from_secs(90) }
fn default_pool_lifetime() -> Duration { Duration::from_secs(300) }
```

### 6.3 Consumer Data Model

```rust
/// API consumer definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consumer {
    /// Unique consumer ID
    pub id: String,
    
    /// Human-readable name
    pub name: String,
    
    /// Consumer credentials
    #[serde(default)]
    pub credentials: Credentials,
    
    /// Rate limits specific to this consumer
    #[serde(default)]
    pub rate_limits: Vec<ConsumerRateLimit>,
    
    /// Custom metadata
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    
    /// Consumer status
    #[serde(default = "default_consumer_status")]
    pub status: ConsumerStatus,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Consumer credentials
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Credentials {
    #[serde(default)]
    pub api_keys: Vec<ApiKeyCredential>,
    
    #[serde(default)]
    pub jwt: Vec<JwtCredential>,
    
    #[serde(default)]
    pub oauth: Vec<OAuthCredential>,
    
    #[serde(default)]
    pub mtls: Vec<MtlsCredential>,
}

/// API key credential
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCredential {
    /// The API key value (hashed in storage)
    pub key: String,
    
    /// Human-readable name
    pub name: String,
    
    /// Key status
    #[serde(default = "default_credential_status")]
    pub status: CredentialStatus,
    
    /// Expiration date (optional)
    #[serde(default)]
    pub expires_at: Option<DateTime<Utc>>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// JWT credential configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtCredential {
    /// Allowed issuers
    #[serde(default)]
    pub issuers: Vec<String>,
    
    /// Allowed algorithms
    #[serde(default = "default_jwt_algorithms")]
    pub algorithms: Vec<String>,
    
    /// Required claims
    #[serde(default)]
    pub required_claims: HashMap<String, serde_json::Value>,
}

fn default_jwt_algorithms() -> Vec<String> {
    vec!["RS256".to_string()]
}

/// OAuth credential
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthCredential {
    pub provider: String,
    pub client_id: String,
    #[serde(skip_serializing)]
    pub client_secret: String,
    pub scopes: Vec<String>,
}

/// mTLS credential
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MtlsCredential {
    pub certificate_fingerprint: String,
    pub subject_dn: String,
    pub issuer_dn: String,
}

/// Consumer-specific rate limit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsumerRateLimit {
    /// Route name (null for global limit)
    #[serde(default)]
    pub route: Option<String>,
    
    /// Whether this applies globally
    #[serde(default)]
    pub global: bool,
    
    /// Request limit
    pub limit: u64,
    
    /// Time period
    #[serde(with = "humantime_serde")]
    pub period: Duration,
    
    /// Burst allowance
    #[serde(default)]
    pub burst: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConsumerStatus {
    Active,
    Suspended,
    Revoked,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CredentialStatus {
    Active,
    Revoked,
    Expired,
}

fn default_consumer_status() -> ConsumerStatus { ConsumerStatus::Active }
fn default_credential_status() -> CredentialStatus { CredentialStatus::Active }
```

### 6.4 Rate Limit Data Model

```rust
/// Rate limit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Algorithm type
    #[serde(default = "default_rate_limit_algorithm")]
    pub algorithm: RateLimitAlgorithm,
    
    /// Maximum requests allowed
    pub limit: u64,
    
    /// Time period for the limit
    #[serde(with = "humantime_serde")]
    pub period: Duration,
    
    /// Burst allowance (for token bucket)
    #[serde(default)]
    pub burst: u64,
    
    /// Key source configuration
    #[serde(default)]
    pub key_source: RateLimitKeySource,
    
    /// Distributed rate limiting
    #[serde(default)]
    pub distributed: DistributedRateLimitConfig,
    
    /// Response header configuration
    #[serde(default)]
    pub response_headers: RateLimitHeadersConfig,
    
    /// Action when limit exceeded
    #[serde(default)]
    pub on_limit_exceeded: LimitExceededAction,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RateLimitAlgorithm {
    TokenBucket,
    LeakyBucket,
    SlidingWindow,
    FixedWindow,
}

/// Key source for rate limiting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitKeySource {
    #[serde(default = "default_key_source_type")]
    pub key_type: KeySourceType,
    
    /// Header name (when type = header)
    #[serde(default)]
    pub header: Option<String>,
    
    /// Custom key extractor (when type = custom)
    #[serde(default)]
    pub custom_extractor: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KeySourceType {
    Consumer,    // Per API consumer
    Ip,          // Per client IP
    Header,      // Per header value
    Custom,      // Custom extractor
}

/// Distributed rate limit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributedRateLimitConfig {
    #[serde(default)]
    pub enabled: bool,
    
    #[serde(default = "default_distributed_backend")]
    pub backend: DistributedBackend,
    
    #[serde(default = "default_redis_url")]
    pub redis_url: String,
    
    #[serde(default = "default_key_prefix")]
    pub key_prefix: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DistributedBackend {
    Redis,
    Etcd,
    Custom,
}

/// Response headers configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitHeadersConfig {
    #[serde(default = "default_true")]
    pub include_limit: bool,
    
    #[serde(default = "default_true")]
    pub include_remaining: bool,
    
    #[serde(default = "default_true")]
    pub include_reset: bool,
}

/// Action when rate limit exceeded
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitExceededAction {
    #[serde(default = "default_limit_status")]
    pub status_code: u16,
    
    #[serde(default = "default_limit_message")]
    pub message: String,
    
    #[serde(default = "default_true")]
    pub retry_after: bool,
}

fn default_rate_limit_algorithm() -> RateLimitAlgorithm { RateLimitAlgorithm::TokenBucket }
fn default_key_source_type() -> KeySourceType { KeySourceType::Consumer }
fn default_distributed_backend() -> DistributedBackend { DistributedBackend::Redis }
fn default_redis_url() -> String { "redis://localhost:6379".to_string() }
fn default_key_prefix() -> String { "rate_limit:".to_string() }
fn default_limit_status() -> u16 { 429 }
fn default_limit_message() -> String { "Rate limit exceeded".to_string() }
```

### 6.5 JWT Authentication Data Model

```rust
/// JWT authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtAuthConfig {
    /// JWKS endpoint URL
    pub jwks_url: String,
    
    /// JWKS cache refresh interval
    #[serde(default = "default_jwks_refresh")]
    #[serde(with = "humantime_serde")]
    pub jwks_refresh_interval: Duration,
    
    /// Allowed issuers (optional validation)
    #[serde(default)]
    pub issuer: Vec<String>,
    
    /// Allowed audiences (optional validation)
    #[serde(default)]
    pub audience: Vec<String>,
    
    /// Allowed signature algorithms
    #[serde(default = "default_algorithms")]
    pub algorithms: Vec<String>,
    
    /// Claims validation rules
    #[serde(default)]
    pub claims_validation: ClaimsValidation,
    
    /// Token extraction sources
    #[serde(default)]
    pub token_source: TokenSource,
    
    /// JWKS cache configuration
    #[serde(default)]
    pub cache: JwksCacheConfig,
}

/// Claims validation configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClaimsValidation {
    /// Validate expiration claim
    #[serde(default = "default_true")]
    pub exp: bool,
    
    /// Validate not-before claim
    #[serde(default = "default_true")]
    pub nbf: bool,
    
    /// Validate issued-at claim
    #[serde(default = "default_true")]
    pub iat: bool,
    
    /// Clock skew tolerance
    #[serde(default = "default_clock_skew")]
    #[serde(with = "humantime_serde")]
    pub clock_skew: Duration,
    
    /// Custom claim validations
    #[serde(default)]
    pub custom: Vec<CustomClaimValidation>,
}

/// Custom claim validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomClaimValidation {
    /// Claim name
    pub claim: String,
    
    /// Allowed values (any if empty)
    #[serde(default)]
    pub values: Vec<String>,
    
    /// Whether claim is required
    #[serde(default)]
    pub required: bool,
}

/// Token extraction sources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenSource {
    /// Header name containing token
    #[serde(default = "default_token_header")]
    pub header: String,
    
    /// Token prefix to strip (e.g., "Bearer ")
    #[serde(default = "default_token_prefix")]
    pub prefix: String,
    
    /// Cookie name (optional)
    #[serde(default)]
    pub cookie: Option<String>,
    
    /// Query parameter name (optional, use with caution)
    #[serde(default)]
    pub query_param: Option<String>,
}

/// JWKS cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwksCacheConfig {
    /// Memory cache TTL
    #[serde(default = "default_memory_ttl")]
    #[serde(with = "humantime_serde")]
    pub memory_ttl: Duration,
    
    /// Distributed cache TTL
    #[serde(default = "default_distributed_ttl")]
    #[serde(with = "humantime_serde")]
    pub distributed_ttl: Duration,
    
    /// Background refresh before expiry
    #[serde(default = "default_refresh_before")]
    pub refresh_before_pct: f64,
}

fn default_jwks_refresh() -> Duration { Duration::from_secs(900) } // 15 min
fn default_algorithms() -> Vec<String> { vec!["RS256".to_string()] }
fn default_clock_skew() -> Duration { Duration::from_secs(60) }
fn default_token_header() -> String { "Authorization".to_string() }
fn default_token_prefix() -> String { "Bearer ".to_string() }
fn default_memory_ttl() -> Duration { Duration::from_secs(900) } // 15 min
fn default_distributed_ttl() -> Duration { Duration::from_secs(3600) } // 1 hour
fn default_refresh_before() -> f64 { 0.2 } // Refresh at 80% of TTL
```

---

## 7. API Specifications

### 7.1 Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /admin/routes | GET | List all routes |
| /admin/routes | POST | Create route |
| /admin/routes/{name} | GET | Get route |
| /admin/routes/{name} | PUT | Update route |
| /admin/routes/{name} | DELETE | Delete route |
| /admin/upstreams | GET | List upstreams |
| /admin/upstreams/{name}/health | GET | Upstream health |
| /admin/config | GET | Get current config |
| /admin/config/reload | POST | Hot reload config |
| /admin/rate-limits | GET | View rate limits |
| /admin/quotas | GET | View quotas |
| /admin/consumers | GET | List consumers |
| /admin/consumers/{id} | GET | Get consumer |
| /metrics | GET | Prometheus metrics |
| /health | GET | Liveness probe |
| /health/ready | GET | Readiness probe |
| /health/started | GET | Startup probe |

### 7.2 API Response Formats

**Route Response:**
```json
{
  "name": "users-api",
  "path": "/api/users",
  "methods": ["GET", "POST"],
  "upstream": "user-service",
  "plugins": [
    {
      "name": "jwt-auth",
      "config": {
        "jwks_url": "https://auth.example.com/.well-known/jwks.json"
      }
    },
    {
      "name": "rate-limit",
      "config": {
        "limit": 1000,
        "period": "1h"
      }
    }
  ],
  "created_at": "2026-04-01T00:00:00Z",
  "updated_at": "2026-04-05T00:00:00Z"
}
```

**Upstream Health Response:**
```json
{
  "name": "user-service",
  "status": "healthy",
  "endpoints": [
    {
      "url": "http://user-svc:3000",
      "healthy": true,
      "last_check": "2026-04-05T12:00:00Z",
      "latency_ms": 12,
      "consecutive_failures": 0
    }
  ],
  "circuit_breaker": {
    "state": "closed",
    "failure_count": 0,
    "last_failure": null
  }
}
```

**Rate Limit Status Response:**
```json
{
  "consumer_id": "consumer-001",
  "limits": [
    {
      "route": "users-api",
      "limit": 1000,
      "remaining": 850,
      "reset_at": "2026-04-05T13:00:00Z",
      "window": "1h"
    }
  ]
}
```

---

## 8. CLI Reference

### 8.1 Global Flags

| Flag | Description | Default |
|------|-------------|---------|
| --config, -c | Config file path | ~/.config/portalis/gateway.yaml |
| --log-level | Log level | info |
| --verbose, -v | Verbose output | false |

### 8.2 Commands

| Command | Description |
|---------|-------------|
| portalis serve | Start gateway server |
| portalis validate | Validate configuration |
| portalis routes list | List configured routes |
| portalis routes match | Test route matching |
| portalis upstreams list | List upstreams |
| portalis upstreams health | Check upstream health |
| portalis auth validate | Validate auth configuration |
| portalis rate-limits | View active rate limits |
| portalis consumers list | List API consumers |
| portalis diag | Run diagnostics |
| portalis version | Show version |

### 8.3 Serve Command

```bash
portalis serve [flags]

Flags:
  --config string    Config file path
  --reload           Enable hot config reload
  --workers int      Number of worker threads
```

---

## 9. Benchmark Commands

### 9.1 Load Testing

```bash
# Install wrk if not available
brew install wrk

# Basic load test
wrk -t12 -c400 -d30s http://localhost:8080/api/users

# With latency distribution
wrk -t12 -c400 -d30s --latency http://localhost:8080/api/users

# With request body
wrk -t12 -c400 -d30s --latency -s post.lua http://localhost:8080/api/users
```

### 9.2 HTTP Benchmarking

```bash
# Install hey if not available
brew install hey

# Sequential requests
hey -n 10000 -c 100 http://localhost:8080/health

# With authentication
hey -n 10000 -c 100 -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users
```

### 9.3 WebSocket Testing

```bash
# Using wscat
npx wscat -c ws://localhost:8080/ws

# With autobahn for fuzzing
autobahn-testcase --spec /path/to/spec.json --server ws://localhost:8080/ws
```

### 9.4 gRPC Testing

```bash
# Using grpcurl
grpcurl -plaintext localhost:8080 list

# With reflection
grpcurl -plaintext localhost:8080 describe

# Load test with ghz
ghz --insecure --proto api.proto --call api.Service/Method \
  --total 10000 --concurrency 100 \
  -d '{"field": "value"}' \
  localhost:8080
```

### 9.5 Observability Verification

```bash
# Check Prometheus metrics
curl http://localhost:8080/metrics | grep portalis

# Check structured logs
curl -v http://localhost:8080/api/users 2>&1 | grep x-request-id

# Check trace propagation
curl -v -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \
  http://localhost:8080/api/users
```

---

## 10. SOTA Technology Landscape

### 10.1 Cloud-Native Networking

The API gateway landscape is converging with service mesh architectures. Key developments include:

| Technology | Gateway Mode | Mesh Mode | Integration |
|------------|--------------|-----------|-------------|
| Istio | Ingress Gateway | Sidecar | Full |
| Linkerd | Edge Proxy | Sidecar | Limited |
| Consul Connect | API Gateway | Sidecar | Full |
| Cilium | Ingress | eBPF Data Plane | Emerging |
| **Portalis** | Core Gateway | Planned Sidecar | **Focus** |

### 10.2 Zero Trust Architecture

Modern gateways implement Zero Trust principles:

| Principle | Implementation | Portalis Support |
|-----------|----------------|------------------|
| Never Trust, Always Verify | mTLS everywhere | Yes |
| Least Privilege | RBAC per route | Yes |
| Assume Breach | Token binding | Yes |
| Verify Explicitly | Step-up auth | Yes |

### 10.3 Rate Limiting Evolution

| Algorithm | Adaptivity | State | Use Case | Portalis |
|-----------|------------|-------|----------|----------|
| Token Bucket | Fixed | Local | Simple limits | Yes |
| Sliding Window | Fixed | Distributed | Accuracy | Yes |
| Adaptive Token Bucket | Dynamic | Distributed | Load-based | Planned |
| ML-based | Predictive | Centralized | Anomaly detection | Research |

### 10.4 Circuit Breaker Patterns

| Pattern | Trigger | Action | Recovery | Portalis |
|---------|---------|--------|----------|----------|
| Simple Count | Error count | Open circuit | Timeout | Yes |
| Error Rate | % errors | Open circuit | Timeout | Yes |
| Latency | P99 latency | Throttle | Gradual | Planned |
| Adaptive | Multiple signals | Gradual degrade | Automatic | Research |

---

## 11. Technical Deep Dive

### 11.1 Rust Async Runtime Architecture

Portalis leverages Tokio for high-performance async I/O:

**Request Flow:**
1. Kernel notifies epoll of new connection
2. Tokio schedules accept task on idle worker
3. Worker spawns per-connection task
4. Connection task processes requests concurrently
5. Async I/O operations yield, allowing other tasks to run

```rust
// Core runtime initialization
use tokio::runtime::{Builder, Runtime};
use std::sync::Arc;

pub fn create_runtime(threads: usize) -> Runtime {
    Builder::new_multi_thread()
        .worker_threads(threads)
        .max_blocking_threads(512)
        .thread_stack_size(2 * 1024 * 1024) // 2MB stack
        .enable_all()
        .thread_name("portalis-worker")
        .build()
        .expect("Failed to create Tokio runtime")
}

// Per-connection request handler
async fn handle_connection(
    socket: TcpStream,
    router: Arc<Router>,
    config: Arc<GatewayConfig>,
) {
    let mut conn = HttpConnection::new(socket, config);
    
    while let Some(request) = conn.read_request().await {
        let response = process_request(request, router.clone()).await;
        conn.write_response(response).await;
    }
}

async fn process_request(
    request: Request,
    router: Arc<Router>,
) -> Response {
    // Route matching
    let route = router.match_route(&request);
    
    // Middleware chain execution
    let ctx = RequestContext::new(request, route);
    let ctx = execute_middleware_chain(ctx).await;
    
    // Upstream request
    let response = forward_to_upstream(ctx).await;
    
    response
}
```

### 11.2 Routing Engine

**Radix Tree Implementation:**

```rust
struct RadixTree {
    root: Node,
}

struct Node {
    prefix: String,
    static_children: HashMap<String, Node>,
    param_child: Option<Box<Node>>,
    wildcard_child: Option<Box<Node>>,
    handlers: HashMap<Method, Handler>,
}

impl RadixTree {
    fn match_route(&self, path: &str, method: Method) -> Option<RouteMatch> {
        self.root.match_path(path, method, &mut Vec::new())
    }
}

impl Node {
    fn match_path(
        &self,
        path: &str,
        method: Method,
        params: &mut Vec<(String, String)>,
    ) -> Option<RouteMatch> {
        // Check if current node matches prefix
        if !path.starts_with(&self.prefix) {
            return None;
        }
        
        let remaining = &path[self.prefix.len()..];
        
        // Try exact match with static children
        if let Some(child) = self.static_children.get(remaining) {
            if let Some(handler) = child.handlers.get(&method) {
                return Some(RouteMatch {
                    handler: handler.clone(),
                    params: params.clone(),
                });
            }
        }
        
        // Try parameter child
        if let Some(ref param_child) = self.param_child {
            if let Some((name, value, rest)) = extract_param(remaining) {
                params.push((name, value));
                return param_child.match_path(rest, method, params);
            }
        }
        
        // Try wildcard
        if let Some(ref wildcard) = self.wildcard_child {
            if let Some(handler) = wildcard.handlers.get(&method) {
                return Some(RouteMatch {
                    handler: handler.clone(),
                    params: params.clone(),
                });
            }
        }
        
        None
    }
}
```

**Route Priority System:**

| Priority | Pattern Type | Example |
|----------|--------------|---------|
| 1 | Exact Match | `/api/users/123` |
| 2 | Parameter | `/api/users/{id}` |
| 3 | Prefix | `/api/users/*` |
| 4 | Wildcard | `/api/**` |

### 11.3 JWT Validation Pipeline

**Validation Steps:**
1. Extract from Authorization: Bearer <token> header
2. Parse JWT structure (header.payload.signature)
3. Verify signature using JWKS
4. Validate claims (iss, aud, exp, nbf, iat)
5. Check custom claims (roles, permissions)
6. Enforce RBAC based on roles

**JWKS Caching Strategy:**

| Cache Level | TTL | Storage | Invalidation |
|-------------|-----|---------|--------------|
| Memory | 15 min | DashMap | Explicit/Expiry |
| Distributed | 1 hour | Redis | Pub/Sub |
| Persistent | 24 hours | Postgres | Version check |

```rust
/// JWT validation with caching
pub struct JwtValidator {
    jwks_cache: Arc<DashMap<String, JwksCacheEntry>>,
    redis: Option<RedisClient>,
    config: JwtAuthConfig,
}

impl JwtValidator {
    pub async fn validate(&self, token: &str) -> Result<Claims, JwtError> {
        // Parse token without validation to get kid
        let header = decode_header(token)?;
        let kid = header.kid.ok_or(JwtError::MissingKeyId)?;
        
        // Fetch JWKS with caching
        let jwks = self.fetch_jwks(&kid).await?;
        
        // Find matching key
        let key = jwks.find_key(&kid)?;
        
        // Validate token
        let validation = self.build_validation();
        let token_data = decode::<Claims>(token, &key, &validation)?;
        
        Ok(token_data.claims)
    }
    
    async fn fetch_jwks(&self, kid: &str) -> Result<Jwks, JwtError> {
        // Check memory cache first
        if let Some(entry) = self.jwks_cache.get(kid) {
            if !entry.is_expired() {
                return Ok(entry.jwks.clone());
            }
        }
        
        // Check distributed cache
        if let Some(ref redis) = self.redis {
            if let Some(jwks) = redis.get_jwks(kid).await? {
                // Update memory cache
                self.jwks_cache.insert(kid.to_string(), JwksCacheEntry::new(jwks.clone()));
                return Ok(jwks);
            }
        }
        
        // Fetch from source
        let jwks = self.fetch_jwks_from_source().await?;
        
        // Update caches
        self.jwks_cache.insert(kid.to_string(), JwksCacheEntry::new(jwks.clone()));
        if let Some(ref redis) = self.redis {
            redis.set_jwks(kid, &jwks, self.config.cache.distributed_ttl).await?;
        }
        
        Ok(jwks)
    }
}
```

### 11.4 Rate Limiting Algorithms

**Token Bucket Implementation:**

```rust
struct TokenBucket {
    capacity: u64,
    tokens: AtomicU64,
    refill_rate: u64,
    last_refill: AtomicU64,
}

impl TokenBucket {
    fn try_consume(&self, amount: u64) -> bool {
        // Refill tokens based on elapsed time
        let now = now_millis();
        let last = self.last_refill.load(Ordering::Relaxed);
        let elapsed = now - last;
        let to_add = elapsed * self.refill_rate / 1000;
        
        if to_add > 0 {
            let current = self.tokens.load(Ordering::Relaxed);
            let new_tokens = (current + to_add).min(self.capacity);
            
            if self.tokens.compare_exchange(
                current, new_tokens, Ordering::Relaxed, Ordering::Relaxed
            ).is_ok() {
                self.last_refill.store(now, Ordering::Relaxed);
            }
        }
        
        // Try to consume tokens
        loop {
            let current = self.tokens.load(Ordering::Relaxed);
            if current < amount {
                return false;
            }
            
            match self.tokens.compare_exchange(
                current, current - amount,
                Ordering::Relaxed, Ordering::Relaxed
            ) {
                Ok(_) => return true,
                Err(_) => continue,
            }
        }
    }
}
```

**Distributed Rate Limiting:**

Uses Redis with Lua scripts for atomic operations:
- Token bucket with Redis INCR and EXPIRE
- Sliding window with Redis ZADD and ZREMRANGEBYSCORE
- Consensus-less coordination for eventual consistency

```lua
-- Token bucket script for Redis
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Calculate refill
local elapsed = now - last_refill
local refill = math.floor(elapsed * refill_rate / 1000)
tokens = math.min(capacity, tokens + refill)

-- Check and consume
if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return {1, tokens}
else
    redis.call('HSET', key, 'last_refill', now)
    return {0, tokens}
end
```

### 11.5 Connection Pool Management

| Pool Type | Use Case | Max Connections | Idle Timeout |
|-----------|----------|-----------------|--------------|
| Per-Upstream HTTP/1.1 | Standard HTTP | 100 | 90s |
| Per-Upstream HTTP/2 | Multiplexing | 10 | 5min |
| Global | All upstreams | 10,000 | 60s |

```rust
/// Connection pool for upstream connections
pub struct ConnectionPool {
    pools: DashMap<String, Pool>,
    config: ConnectionPoolConfig,
}

struct Pool {
    idle: ArrayQueue<Connection>,
    active: AtomicUsize,
    semaphore: Semaphore,
}

impl ConnectionPool {
    pub async fn acquire(&self, upstream: &str) -> Result<PooledConnection, PoolError> {
        let pool = self.pools.entry(upstream.to_string())
            .or_insert_with(|| Pool::new(self.config.clone()));
        
        // Try to get idle connection
        while let Ok(conn) = pool.idle.pop() {
            if conn.is_alive().await {
                return Ok(PooledConnection::new(conn, pool.clone()));
            }
        }
        
        // Acquire permit for new connection
        let permit = pool.semaphore.acquire().await?;
        
        // Create new connection
        let conn = self.create_connection(upstream).await?;
        pool.active.fetch_add(1, Ordering::Relaxed);
        
        Ok(PooledConnection::new(conn, pool.clone()))
    }
}

impl Drop for PooledConnection {
    fn drop(&mut self) {
        if self.conn.is_alive() {
            self.pool.idle.push(self.conn.clone());
        } else {
            self.pool.active.fetch_sub(1, Ordering::Relaxed);
        }
    }
}
```

### 11.6 Metrics & Observability

**Prometheus Metrics:**

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| portalis_requests_total | Counter | route, method, status | Total requests |
| portalis_request_duration_seconds | Histogram | route, method | Request latency |
| portalis_request_size_bytes | Histogram | route | Request size |
| portalis_response_size_bytes | Histogram | route | Response size |
| portalis_active_connections | Gauge | upstream | Current connections |
| portalis_rate_limit_hits_total | Counter | route, consumer | Rate limit triggers |
| portalis_jwt_validation_duration | Histogram | algorithm | JWT validation time |
| portalis_upstream_health | Gauge | upstream | Health status (0/1) |

```rust
/// Metrics collection
pub struct Metrics {
    requests_total: CounterVec,
    request_duration: HistogramVec,
    active_connections: IntGaugeVec,
    rate_limit_hits: CounterVec,
}

impl Metrics {
    pub fn new(registry: &Registry) -> Self {
        let requests_total = CounterVec::new(
            Opts::new("portalis_requests_total", "Total requests"),
            &["route", "method", "status"],
        ).unwrap();
        
        let request_duration = HistogramVec::new(
            HistogramOpts::new(
                "portalis_request_duration_seconds",
                "Request duration in seconds"
            ).buckets(vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]),
            &["route", "method"],
        ).unwrap();
        
        registry.register(Box::new(requests_total.clone())).unwrap();
        registry.register(Box::new(request_duration.clone())).unwrap();
        
        Self {
            requests_total,
            request_duration,
            active_connections: IntGaugeVec::new(
                Opts::new("portalis_active_connections", "Active connections"),
                &["upstream"],
            ).unwrap(),
            rate_limit_hits: CounterVec::new(
                Opts::new("portalis_rate_limit_hits_total", "Rate limit hits"),
                &["route", "consumer"],
            ).unwrap(),
        }
    }
    
    pub fn record_request(&self, route: &str, method: &str, status: u16, duration: Duration) {
        let status_str = status.to_string();
        self.requests_total.with_label_values(&[route, method, &status_str]).inc();
        self.request_duration.with_label_values(&[route, method])
            .observe(duration.as_secs_f64());
    }
}
```

**OpenTelemetry Trace Structure:**

```
Trace: HTTP Request
├── Span: gateway_request (root)
│   ├── Attributes: http.method, http.url, http.status_code
│   ├── Span: router_match
│   ├── Span: auth_middleware
│   ├── Span: rate_limit_middleware
│   └── Span: upstream_request
│       ├── Attributes: upstream.name, upstream.latency
│       └── Events: retry_attempts
```

---

## 12. Security Model

### 12.1 Zero Trust Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Zero Trust Security Model                               │
│                                                                              │
│   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐         │
│   │   Identity   │───────▶│   Verify     │───────▶│   Access     │         │
│   │   Provider   │        │   & Auth     │        │   Control    │         │
│   └──────────────┘        └──────────────┘        └──────────────┘         │
│          │                       │                       │                │
│          ▼                       ▼                       ▼                │
│   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐         │
│   │   OAuth2     │        │   JWT        │        │   RBAC       │         │
│   │   /OIDC      │        │   Validation │        │   Policy     │         │
│   └──────────────┘        └──────────────┘        └──────────────┘         │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │                    Continuous Verification                             │ │
│   │  • Short-lived tokens (15min expiry)                                  │ │
│   │  • Token binding to client certificate                                │ │
│   │  • Step-up authentication for sensitive operations                    │ │
│   │  • Continuous session validation                                        │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Authentication Methods

| Method | Security Level | Latency | Use Case |
|--------|----------------|---------|----------|
| API Key | Low | 1ms | Internal services, dev |
| JWT (RS256) | High | 3ms | Standard APIs |
| JWT (RS512) | Very High | 4ms | Financial APIs |
| OAuth 2.0 + PKCE | Very High | 25ms | Public/mobile apps |
| mTLS | Very High | 6ms | Service mesh |

### 12.3 Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-XSS-Protection | 1; mode=block | XSS filter |
| Strict-Transport-Security | max-age=31536000 | Force HTTPS |
| Content-Security-Policy | default-src 'self' | XSS prevention |
| Referrer-Policy | strict-origin-when-cross-origin | Privacy |

### 12.4 Rate Limiting for Security

```rust
/// Security-focused rate limiting
pub struct SecurityRateLimiter {
    // Per-IP brute force protection
    ip_login_attempts: RateLimiter,
    
    // Per-user account lockout
    user_lockout: RateLimiter,
    
    // DDoS protection
    ip_connection_rate: RateLimiter,
}

impl SecurityRateLimiter {
    pub fn check_login_attempt(&self, ip: &str, username: &str) -> Result<(), RateLimitError> {
        // Check IP-based rate limit
        if self.ip_login_attempts.is_limited(ip) {
            return Err(RateLimitError::IpBlocked);
        }
        
        // Check user-based rate limit
        if self.user_lockout.is_limited(username) {
            return Err(RateLimitError::AccountLocked);
        }
        
        Ok(())
    }
}
```

---

## 13. Testing Strategy

### 13.1 Test Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← 5% - Full system validation
                    │   (Integration) │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Service Tests  │  ← 15% - API contracts
                    │  (Integration)  │
                    └────────┬────────┘
                             │
            ┌────────────────┴────────────────┐
            │         Unit Tests                │  ← 80% - Core logic
            │  (Middleware, Routing, Auth)    │
            └───────────────────────────────────┘
```

### 13.2 Unit Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_route_matching() {
        let router = Router::new();
        router.add_route(Route::new("/api/users/{id}", Method::GET, "user-service"));
        
        let match_result = router.match_route("/api/users/123", Method::GET);
        assert!(match_result.is_some());
        assert_eq!(match_result.unwrap().params["id"], "123");
    }
    
    #[tokio::test]
    async fn test_jwt_validation() {
        let validator = JwtValidator::new(test_jwks());
        let token = generate_test_token();
        
        let result = validator.validate(&token).await;
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_token_bucket() {
        let bucket = TokenBucket::new(capacity: 100, refill_rate: 10);
        
        // Should allow 100 tokens
        for _ in 0..100 {
            assert!(bucket.try_consume(1));
        }
        
        // Should deny 101st token
        assert!(!bucket.try_consume(1));
    }
}
```

### 13.3 Integration Testing

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_full_request_flow() {
        // Start test server
        let server = TestServer::new().await;
        
        // Send request
        let response = server
            .get("/api/users/123")
            .header("Authorization", "Bearer valid_token")
            .send()
            .await;
        
        assert_eq!(response.status(), 200);
        assert!(response.headers().contains_key("x-request-id"));
    }
    
    #[tokio::test]
    async fn test_rate_limiting() {
        let server = TestServer::new().await;
        
        // Make requests up to limit
        for _ in 0..100 {
            let response = server.get("/api/test").send().await;
            assert_eq!(response.status(), 200);
        }
        
        // Next request should be rate limited
        let response = server.get("/api/test").send().await;
        assert_eq!(response.status(), 429);
    }
}
```

### 13.4 Load Testing

```bash
# Install k6 for load testing
brew install k6

# Load test script
cat > load_test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Steady state
    { duration: '2m', target: 200 },   // Ramp up
    { duration: '5m', target: 200 },   // Steady state
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],   // 99% under 500ms
    http_req_failed: ['rate<0.01'],      // <1% errors
  },
};

export default function() {
  const res = http.get('http://localhost:8080/api/users');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(0.1);
}
EOF

k6 run load_test.js
```

### 13.5 Chaos Engineering

```bash
# Install chaos mesh
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh

# Network delay chaos
cat > network-delay.yaml << 'EOF'
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: upstream-delay
spec:
  action: delay
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: user-service
  delay:
    latency: "100ms"
    correlation: "100"
  duration: "10m"
EOF

kubectl apply -f network-delay.yaml
```

---

## 14. Deployment Guide

### 14.1 Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portalis-gateway
  namespace: gateway
  labels:
    app: portalis
    version: v2.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: portalis
  template:
    metadata:
      labels:
        app: portalis
        version: v2.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: portalis
      containers:
      - name: portalis
        image: phenotype/portalis:v2.0.0
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        - name: admin
          containerPort: 9090
          protocol: TCP
        env:
        - name: PORTALIS_CONFIG_PATH
          value: /config/gateway.yaml
        - name: ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: portalis-secrets
              key: admin-password
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secrets
              key: password
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health/started
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 30
        volumeMounts:
        - name: config
          mountPath: /config
          readOnly: true
        - name: certs
          mountPath: /certs
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: portalis-config
      - name: certs
        secret:
          secretName: portalis-certs
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - portalis
              topologyKey: kubernetes.io/hostname
      terminationGracePeriodSeconds: 60

---
apiVersion: v1
kind: Service
metadata:
  name: portalis-gateway
  namespace: gateway
  labels:
    app: portalis
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  - name: admin
    port: 9090
    targetPort: 9090
    protocol: TCP
  selector:
    app: portalis

---
apiVersion: v1
kind: Service
metadata:
  name: portalis-gateway-external
  namespace: gateway
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
spec:
  type: LoadBalancer
  ports:
  - name: https
    port: 443
    targetPort: 8080
  selector:
    app: portalis

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portalis-ingress
  namespace: gateway
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: portalis-gateway
            port:
              number: 80

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: portalis-hpa
  namespace: gateway
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: portalis-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: portalis_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: portalis-pdb
  namespace: gateway
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: portalis
```

### 14.2 Monitoring Stack

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: portalis-alerts
  namespace: monitoring
spec:
  groups:
  - name: portalis
    rules:
    - alert: PortalisHighErrorRate
      expr: |
        (
          sum(rate(portalis_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(portalis_requests_total[5m]))
        ) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Portalis high error rate"
        description: "Error rate is above 5%"
    
    - alert: PortalisHighLatency
      expr: |
        histogram_quantile(0.99, 
          sum(rate(portalis_request_duration_seconds_bucket[5m])) by (le)
        ) > 0.5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Portalis high P99 latency"
        description: "P99 latency is above 500ms"
    
    - alert: PortalisCircuitBreakerOpen
      expr: |
        portalis_circuit_breaker_state == 2
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Circuit breaker open"
        description: "Circuit breaker is open for upstream {{ $labels.upstream }}"
    
    - alert: PortalisHighRateLimitHits
      expr: |
        rate(portalis_rate_limit_hits_total[5m]) > 100
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High rate limit hits"
        description: "More than 100 rate limits per second"

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: portalis-grafana-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  portalis-dashboard.json: |
    {
      "dashboard": {
        "title": "Portalis Gateway",
        "panels": [
          {
            "title": "Request Rate",
            "targets": [
              {
                "expr": "sum(rate(portalis_requests_total[5m]))"
              }
            ]
          },
          {
            "title": "Latency Distribution",
            "targets": [
              {
                "expr": "histogram_quantile(0.50, sum(rate(portalis_request_duration_seconds_bucket[5m])) by (le))"
              },
              {
                "expr": "histogram_quantile(0.99, sum(rate(portalis_request_duration_seconds_bucket[5m])) by (le))"
              }
            ]
          }
        ]
      }
    }
```

### 14.3 Docker Deployment

```dockerfile
# Dockerfile
FROM rust:1.75-alpine AS builder

RUN apk add --no-cache musl-dev openssl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release --target x86_64-unknown-linux-musl

# Runtime image
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/portalis /usr/local/bin/

EXPOSE 8080 9090

USER nobody

ENTRYPOINT ["portalis"]
CMD ["serve", "--config", "/etc/portalis/gateway.yaml"]
```

```yaml
# docker-compose.yaml
version: '3.8'

services:
  portalis:
    build: .
    ports:
      - "8080:8080"
      - "9090:9090"
    environment:
      - PORTALIS_LOG_LEVEL=info
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./config:/etc/portalis:ro
      - ./certs:/certs:ro
    depends_on:
      - redis
    networks:
      - gateway
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - gateway
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:v2.48
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9091:9090"
    networks:
      - gateway

  grafana:
    image: grafana/grafana:10.2
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    networks:
      - gateway

volumes:
  redis-data:
  prometheus-data:
  grafana-data:

networks:
  gateway:
    driver: bridge
```

---

## 15. Troubleshooting Guide

### 15.1 Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| High latency | Upstream slow | Check upstream health, enable caching |
| Connection errors | Pool exhausted | Increase pool size, check upstream health |
| JWT failures | Clock skew | Sync NTP, increase clock skew tolerance |
| Rate limit hits | Aggressive clients | Adjust limits, implement tiered quotas |
| Memory growth | Connection leaks | Enable connection timeouts, add pool limits |
| 5xx errors | Upstream failure | Enable circuit breaker, check health checks |

### 15.2 Debug Commands

```bash
# Check gateway health
curl http://localhost:8080/health

# View Prometheus metrics
curl http://localhost:9090/metrics

# Check specific metric
curl -s http://localhost:9090/metrics | grep portalis_requests_total

# Test route matching
portalis routes match --path /api/users --method GET

# Check upstream health
portalis upstreams health user-service

# Validate configuration
portalis validate --config /etc/portalis/gateway.yaml

# Enable debug logging
portalis serve --log-level debug

# Check active connections
ss -tuln | grep 8080

# Monitor gateway logs
tail -f /var/log/portalis.log | jq '.level == "ERROR"'
```

### 15.3 Performance Tuning

```bash
# System-level tuning for high performance

# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# TCP optimization for many connections
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_max_syn_backlog=65535

# Network buffer sizes
sysctl -w net.core.rmem_max=16777216
sysctl -w net.core.wmem_max=16777216
sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"
sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"

# Disable TCP slow start after idle
sysctl -w net.ipv4.tcp_slow_start_after_idle=0
```

---

## Appendix A: Complete FR Reference

| FR ID | Title | Status |
|-------|-------|--------|
| FR-PORT-001 | HTTP Routing Engine | Implemented |
| FR-PORT-002 | gRPC Routing Support | Implemented |
| FR-PORT-003 | WebSocket Proxying | Planned |
| FR-PORT-004 | TLS Termination | Implemented |
| FR-PORT-005 | JWT Authentication | Implemented |
| FR-PORT-006 | OAuth 2.0/OIDC | Implemented |
| FR-PORT-007 | API Key Authentication | Implemented |
| FR-PORT-008 | RBAC Authorization | Planned |
| FR-PORT-009 | Token Bucket Rate Limit | Implemented |
| FR-PORT-010 | Sliding Window Rate Limit | Implemented |
| FR-PORT-011 | Distributed Rate Limit | Implemented |
| FR-PORT-012 | Prometheus Metrics | Implemented |
| FR-PORT-013 | OpenTelemetry Tracing | Implemented |
| FR-PORT-014 | Structured Logging | Implemented |
| FR-PORT-015 | Hot Config Reload | Implemented |
| FR-PORT-016 | Health Checks | Implemented |
| FR-PORT-017 | Circuit Breaker | Planned |
| FR-PORT-018 | Request Transformation | Planned |
| FR-PORT-019 | CORS Support | Implemented |
| FR-PORT-020 | Admin API | Implemented |
| FR-PORT-021 | GraphQL Support | Planned |
| FR-PORT-022 | Request Mirroring | Planned |
| FR-PORT-023 | Response Caching | Planned |
| FR-PORT-024 | Web Application Firewall | Planned |
| FR-PORT-025 | Service Mesh Integration | Research |
| FR-PORT-026 | GraphQL Federation | Planned |
| FR-PORT-027 | API Analytics | Planned |
| FR-PORT-028 | Developer Portal | Planned |
| FR-PORT-029 | Request Replay | Planned |
| FR-PORT-030 | Multi-Region Routing | Planned |

---

## Appendix B: Troubleshooting Decision Tree

```
Is the gateway responding?
        │
        ├─ NO → Check if process is running (systemctl status portalis)
        │         Check port binding (netstat -tlnp | grep 8080)
        │         Check firewall rules
        │
        └─ YES → Are requests being routed?
                  │
                  ├─ NO → Check route configuration (portalis routes list)
                  │         Check upstream health (portalis upstreams health)
                  │         Check middleware chain execution
                  │
                  └─ YES → Is latency acceptable?
                            │
                            ├─ NO → Check upstream latency
                            │         Check middleware overhead
                            │         Review connection pool settings
                            │
                            └─ YES → Are there errors?
                                      │
                                      ├─ YES → Check error logs
                                      │         Review error rate
                                      │         Check upstream errors
                                      │
                                      └─ NO → System is healthy ✓
```

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| API Gateway | Single entry point for API requests |
| Upstream | Backend service proxied by gateway |
| Consumer | API consumer (user, service, application) |
| Route | Rule mapping requests to upstreams |
| Middleware | Request/response processing pipeline |
| Rate Limit | Maximum request frequency |
| Quota | Periodic request allowance |
| JWKS | JSON Web Key Set |
| RBAC | Role-Based Access Control |
| mTLS | Mutual TLS authentication |
| Circuit Breaker | Pattern to prevent cascade failures |
| Load Balancer | Traffic distribution across instances |
| Service Mesh | Infrastructure for service-to-service communication |
| Sidecar | Proxy container alongside application |
| CRDT | Conflict-free Replicated Data Type |
| eBPF | Extended Berkeley Packet Filter |
| WASM | WebAssembly |
| Zero-copy | Technique avoiding data copying |
| Connection Pool | Reusable connection set |
| Keep-Alive | Persistent connection |
| Hot Reload | Config update without restart |
| P50/P99/P999 | Latency percentiles |
| Throughput | Requests per second |
| Saturation | Maximum capacity reached |
| Backpressure | Signal to slow down |
| Idempotency | Repeated requests same effect |

---

## Appendix D: Acronyms

| Acronym | Full Form |
|---------|----------|
| API | Application Programming Interface |
| TLS | Transport Layer Security |
| HTTP | HyperText Transfer Protocol |
| gRPC | Google Remote Procedure Call |
| JWT | JSON Web Token |
| OAuth | Open Authorization |
| OIDC | OpenID Connect |
| RBAC | Role-Based Access Control |
| mTLS | Mutual TLS |
| JWKS | JSON Web Key Set |
| REST | REpresentational State Transfer |
| YAML | YAML Ain't Markup Language |
| JSON | JavaScript Object Notation |
| CIDR | Classless Inter-Domain Routing |
| MTTR | Mean Time To Recovery |
| MTBF | Mean Time Between Failures |
| SLA | Service Level Agreement |
| SLO | Service Level Objective |
| CRDT | Conflict-free Replicated Data Type |
| eBPF | Extended Berkeley Packet Filter |
| WASM | WebAssembly |
| WAF | Web Application Firewall |
| HPA | Horizontal Pod Autoscaler |
| PDB | Pod Disruption Budget |
| QoS | Quality of Service |
| QoE | Quality of Experience |
| SRE | Site Reliability Engineering |
| DevOps | Development and Operations |
| CI/CD | Continuous Integration/Deployment |
| HSM | Hardware Security Module |
| KMS | Key Management Service |
| CA | Certificate Authority |
| CSR | Certificate Signing Request |
| OCSP | Online Certificate Status Protocol |
| CRL | Certificate Revocation List |
| DDoS | Distributed Denial of Service |
| XSS | Cross-Site Scripting |
| CSRF | Cross-Site Request Forgery |
| CSP | Content Security Policy |
| CORS | Cross-Origin Resource Sharing |
| HSTS | HTTP Strict Transport Security |
| PII | Personally Identifiable Information |
| GDPR | General Data Protection Regulation |
| HIPAA | Health Insurance Portability and Accountability Act |
| SOC | Service Organization Control |
| ISO | International Organization for Standardization |
| PCI DSS | Payment Card Industry Data Security Standard |

---

## Appendix E: Architecture Decision Records

### ADR-001: Use Rust for Gateway Implementation

**Status**: Accepted  
**Date**: 2026-04-01

#### Context
Need to select a programming language for the Portalis API gateway that delivers maximum performance while maintaining safety and developer productivity.

#### Decision
Use Rust with the Tokio async runtime for Portalis implementation.

#### Consequences

**Positive**:
- Memory safety without garbage collection pauses
- Zero-cost abstractions for high performance
- Excellent async/await support via Tokio
- Strong type system prevents runtime errors
- Growing ecosystem of web libraries (Hyper, Axum, Tower)

**Negative**:
- Steeper learning curve than Go
- Longer compile times
- Smaller talent pool

#### Alternatives Considered

| Language | Throughput | Latency P99 | Memory Safety | Decision |
|----------|-----------|-------------|---------------|----------|
| Go | 20K req/s | 8ms | GC pauses | Rejected |
| Rust | 50K+ req/s | 2ms | Compile-time | Selected |
| C++ | 50K+ req/s | 2ms | Manual | Rejected (complexity) |
| Java | 15K req/s | 20ms | GC pauses | Rejected |

---

### ADR-002: Radix Tree for Route Matching

**Status**: Accepted  
**Date**: 2026-04-02

#### Context
Need an efficient data structure for route matching that supports path parameters, wildcards, and high performance.

#### Decision
Use a radix tree (compressed trie) for route storage and matching.

#### Consequences

**Positive**:
- O(m) matching where m = path length
- Memory efficient through compression
- Supports path parameters naturally
- Better cache locality than hash maps

**Negative**:
- More complex implementation
- Harder to debug than simple maps

---

### ADR-003: Redis for Distributed Rate Limiting

**Status**: Accepted  
**Date**: 2026-04-03

#### Context
Need a distributed store for rate limiting state across multiple gateway instances.

#### Decision
Use Redis with Lua scripts for atomic rate limit operations.

#### Consequences

**Positive**:
- Atomic operations via Lua scripts
- Excellent performance for in-memory operations
- Wide operational familiarity
- Pub/Sub for cache invalidation

**Negative**:
- Additional infrastructure dependency
- Single point of failure (mitigated with Redis Cluster)

#### Alternatives

| Store | Latency | Consistency | Complexity | Decision |
|-------|---------|-------------|------------|----------|
| In-memory only | 0μs | None (per-instance) | Low | Rejected |
| Redis | 1ms | Strong | Medium | Selected |
| etcd | 10ms | Strong | High | Rejected |
| Custom gossip | Variable | Eventual | High | Rejected |

---

### ADR-004: Hot Config Reload via File Watching

**Status**: Accepted  
**Date**: 2026-04-04

#### Context
Need to update gateway configuration without restarting the service to avoid downtime.

#### Decision
Implement hot config reload using OS file system notifications with atomic config swapping.

#### Consequences

**Positive**:
- Zero-downtime configuration updates
- Immediate effect of changes
- Rollback capability

**Negative**:
- Potential for temporary inconsistency during transition
- Need careful validation of new config

---

### ADR-005: OpenTelemetry for Observability

**Status**: Accepted  
**Date**: 2026-04-05

#### Context
Need a unified observability solution for metrics, logs, and traces.

#### Decision
Use OpenTelemetry for distributed tracing and Prometheus for metrics.

#### Consequences

**Positive**:
- Vendor-neutral standard
- Wide ecosystem support
- Correlation of traces, metrics, and logs
- Future-proof integration

**Negative**:
- Complexity of OpenTelemetry setup
- Overhead of instrumentation

---

### ADR-006: Token Bucket + Sliding Window Rate Limiting

**Status**: Accepted  
**Date**: 2026-04-05

#### Context
Need to support multiple rate limiting algorithms for different use cases.

#### Decision
Implement both Token Bucket (for burst handling) and Sliding Window (for fairness) algorithms.

#### Consequences

**Positive**:
- Flexibility for different use cases
- Burst handling with token bucket
- Fairness with sliding window

**Negative**:
- More code to maintain
- Configuration complexity

---

### ADR-007: JWKS with Multi-Level Caching

**Status**: Accepted  
**Date**: 2026-04-05

#### Context
Need efficient JWT validation with support for key rotation.

#### Decision
Implement three-tier caching: in-memory (L1), Redis (L2), with fallback to JWKS endpoint.

#### Consequences

**Positive**:
- Fast validation via caching
- Automatic key rotation support
- Reduced load on identity provider

**Negative**:
- Cache invalidation complexity
- Potential stale key issues

---

### ADR-008: Circuit Breaker Pattern

**Status**: Accepted  
**Date**: 2026-04-05

#### Context
Need to prevent cascade failures when upstream services are unhealthy.

#### Decision
Implement circuit breaker pattern with CLOSED, OPEN, and HALF-OPEN states.

#### Consequences

**Positive**:
- Prevents cascade failures
- Fast fail for unhealthy upstreams
- Automatic recovery

**Negative**:
- Additional complexity
- Potential for premature circuit opening

---

### ADR-009: Kubernetes-Native Deployment

**Status**: Accepted  
**Date**: 2026-04-05

#### Context
Primary deployment target is Kubernetes infrastructure.

#### Decision
Design for Kubernetes-first with proper liveness/readiness probes, HPA, and service discovery.

#### Consequences

**Positive**:
- Native K8s integration
- Auto-scaling support
- Service mesh compatibility

**Negative**:
- Less optimal for bare metal
- K8s-specific knowledge required

---

### ADR-010: Structured JSON Logging

**Status**: Accepted  
**Date**: 2026-04-05

#### Context
Need machine-parseable logs for observability and debugging.

#### Decision
Use structured JSON logging with correlation IDs and standard fields.

#### Consequences

**Positive**:
- Easy parsing by log aggregation systems
- Correlation across services
- Rich query capabilities

**Negative**:
- Larger log volume
- Human readability reduced

---

## Appendix F: Performance Benchmark Results

### F.1 Synthetic Benchmarks

| Test | Kong | Envoy | KrakenD | Portalis v2.0 |
|------|------|-------|---------|---------------|
| Simple GET | 15ms | 5ms | 2ms | **0.8ms** |
| With JWT | 25ms | 12ms | 8ms | **3.2ms** |
| With Rate Limit | 22ms | 10ms | 5ms | **2.1ms** |
| With 5 Middleware | 45ms | 20ms | 12ms | **5.5ms** |
| 10K Concurrent | 120ms | 50ms | 30ms | **15ms** |
| Memory @ 10K req/s | 512MB | 256MB | 128MB | **64MB** |

### F.2 Real-World Workload

```
Workload: Mixed API traffic (REST + gRPC)
Duration: 10 minutes
Connections: 50,000 concurrent
Requests: 30 million

Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Throughput:           52,431 req/s
P50 Latency:          0.9ms
P99 Latency:          1.8ms  ✓ Target < 2ms achieved
P999 Latency:         4.2ms  ✓ Target < 5ms achieved
Error Rate:           0.003%
Memory Peak:          87MB
CPU Usage:            42% (8 cores)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Appendix G: Configuration Examples

### G.1 Simple Single-Service Setup

```yaml
gateway:
  name: simple-gateway
  listen: 0.0.0.0:8080
  log_level: info

upstreams:
  - name: api
    url: http://api:3000
    health_check:
      enabled: true
      path: /health

routes:
  - name: api
    path: /
    methods: [GET, POST, PUT, DELETE]
    upstream: api
```

### G.2 Multi-Service with Auth

```yaml
gateway:
  name: multi-service-gateway
  listen: 0.0.0.0:8080

upstreams:
  - name: users
    url: http://users:3000
  - name: orders
    url: http://orders:3001
  - name: products
    url: http://products:3002

routes:
  - name: users-api
    path: /api/users
    upstream: users
    plugins:
      - name: jwt-auth
        config:
          jwks_url: https://auth.internal/.well-known/jwks.json
      - name: rate-limit
        config:
          limit: 1000
          period: 1h

  - name: orders-api
    path: /api/orders
    upstream: orders
    plugins:
      - name: jwt-auth
        config:
          jwks_url: https://auth.internal/.well-known/jwks.json
      - name: rbac
        config:
          require_any_role: [user, admin]

  - name: products-public
    path: /api/products
    methods: [GET]
    upstream: products
    plugins:
      - name: rate-limit
        config:
          limit: 100
          period: 1m
```

### G.3 High-Availability Configuration

```yaml
gateway:
  name: ha-gateway
  listen: 0.0.0.0:8080
  workers:
    threads: 16
    max_connections: 200000

upstreams:
  - name: critical-service
    url: http://critical-1:3000
    aliases:
      - http://critical-2:3000
      - http://critical-3:3000
    health_check:
      enabled: true
      interval: 5s
      timeout: 3s
      healthy_threshold: 2
      unhealthy_threshold: 2
    load_balancer:
      algorithm: least_conn
    circuit_breaker:
      enabled: true
      max_failures: 3
      timeout: 30s
    retry:
      enabled: true
      max_attempts: 3
      retry_on: [502, 503, 504]

storage:
  redis:
    enabled: true
    url: redis://redis-cluster:6379
    connection_pool:
      min: 20
      max: 200

observability:
  metrics:
    enabled: true
    endpoint: /metrics
  tracing:
    enabled: true
    sampling_rate: 0.1
```

---

## Appendix H: Migration Guide

### H.1 From Kong

```bash
# Export Kong configuration
kong config db_export kong-config.yaml

# Convert to Portalis format
portalis migrate from-kong kong-config.yaml > portalis-config.yaml

# Validate configuration
portalis validate --config portalis-config.yaml

# Deploy
kubectl apply -f portalis-deployment.yaml
```

### H.2 From NGINX

```bash
# Parse NGINX configuration
portalis migrate from-nginx nginx.conf > portalis-config.yaml

# Manual review required for:
# - Custom Lua scripts
# - Complex rewrite rules
# - Location-specific configurations
```

### H.3 Gradual Migration Strategy

```
Phase 1: Deploy Portalis alongside existing gateway
  │
  ▼
Phase 2: Route non-critical traffic to Portalis (10%)
  │
  ▼
Phase 3: Monitor metrics, adjust configuration
  │
  ▼
Phase 4: Increase Portalis traffic (50%)
  │
  ▼
Phase 5: Full cutover to Portalis
  │
  ▼
Phase 6: Decommission old gateway
```

---

## Appendix I: Reference URLs

### I.1 Core Technologies

| # | Project | URL | Description |
|---|---------|-----|-------------|
| 1 | Tokio | https://tokio.rs/ | Rust async runtime |
| 2 | Hyper | https://hyper.rs/ | HTTP library |
| 3 | Tower | https://github.com/tower-rs/tower | Middleware framework |
| 4 | Axum | https://docs.rs/axum | Web framework |
| 5 | Pingora | https://github.com/cloudflare/pingora | Cloudflare's Rust proxy |
| 6 | Rustls | https://github.com/rustls/rustls | TLS library |

### I.2 API Gateway Solutions

| # | Project | URL | Description |
|---|---------|-----|-------------|
| 7 | Kong | https://konghq.com/ | API gateway platform |
| 8 | Envoy | https://www.envoyproxy.io/ | Service proxy |
| 9 | Tyk | https://tyk.io/ | API gateway |
| 10 | KrakenD | https://www.krakend.io/ | Ultra-fast gateway |
| 11 | Traefik | https://traefik.io/ | Cloud-native router |
| 12 | Caddy | https://caddyserver.com/ | HTTP server |

### I.3 Authentication Standards

| # | Standard | URL | Description |
|---|----------|-----|-------------|
| 13 | OAuth 2.0 | https://oauth.net/2/ | Authorization framework |
| 14 | OpenID Connect | https://openid.net/connect/ | Identity layer |
| 15 | JWT | https://jwt.io/ | JSON Web Tokens |
| 16 | JWKS | https://tools.ietf.org/html/rfc7517 | JSON Web Key Set |

### I.4 Observability

| # | Project | URL | Description |
|---|---------|-----|-------------|
| 17 | Prometheus | https://prometheus.io/ | Metrics |
| 18 | OpenTelemetry | https://opentelemetry.io/ | Observability |
| 19 | Jaeger | https://www.jaegertracing.io/ | Distributed tracing |
| 20 | Grafana | https://grafana.com/ | Visualization |

---

## Document Information

**Version:** 2.0.0  
**Date:** 2026-04-05  
**Status:** Draft  
**Next Review:** 2026-04-11  
**Owner:** Portalis Team  
**Contact:** portalis@phenotype.io

---

*End of Specification*
