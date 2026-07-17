# Portalis

API Gateway for the Phenotype ecosystem. Provides routing, rate limiting, authentication, and observability for internal and external APIs.

## Quick Start

```bash
# Install
brew install phenotype/tap/portalis

# Validate configuration
portalis validate --config gateway.yaml

# Start gateway
portalis serve --config gateway.yaml
```

## Features

- **Dynamic Routing**: Path-based routing with wildcard and regex support
- **Authentication**: JWT, OAuth 2.0, API Keys, RBAC
- **Rate Limiting**: Token bucket, sliding window, per-consumer quotas
- **Observability**: Structured logging, Prometheus metrics, OpenTelemetry traces
- **High Performance**: Rust async runtime, <5ms P99 latency

## Documentation

| Guide | Description |
|-------|-------------|
| [Journeys](./docs/journeys/) | Step-by-step tutorials |
| [CLAUDE.md](./CLAUDE.md) | AI agent context |
| [PRD.md](./PRD.md) | Product requirements |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design |
| [SECURITY.md](./SECURITY.md) | Security architecture |
| [ADR.md](./ADR.md) | Architecture decisions |

## Journeys

| Journey | Duration |
|---------|----------|
| [First API Gateway Setup](./docs/journeys/first-api-gateway-setup.md) | 15 min |
| [Implementing Rate Limiting](./docs/journeys/implementing-rate-limiting.md) | 20 min |
| [API Authentication & Authorization](./docs/journeys/api-authentication-authorization.md) | 25 min |

## Configuration

```yaml
gateway:
  name: my-gateway
  listen: 0.0.0.0:8080

upstreams:
  - name: api-service
    url: http://localhost:3000

routes:
  - name: api-route
    path: /api/*
    upstream: api-service
```

## CLI Commands

```bash
portalis serve          # Start gateway
portalis validate      # Validate config
portalis routes list   # List routes
portalis auth validate # Validate auth config
portalis rate-limits   # View rate limits
```

## Development

```bash
# Validate governance
python3 validate_governance.py

# Run tests
cargo test
```

## License

Apache 2.0
