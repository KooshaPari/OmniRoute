# Journey Index

## User Journeys

| Journey | Description | Duration |
|---------|-------------|----------|
| [First API Gateway Setup](./first-api-gateway-setup.md) | Configure your first gateway with routing and upstream services | 15 min |
| [Implementing Rate Limiting](./implementing-rate-limiting.md) | Set up rate limits, quotas, and enforcement policies | 20 min |
| [API Authentication & Authorization](./api-authentication-authorization.md) | Implement JWT validation, OAuth flows, and API key management | 25 min |

## Prerequisites

Before starting any journey:

1. Portalis installed (`brew install phenotype/tap/portalis` or `cargo install portalis`)
2. Access to a running upstream service (or use the included mock server)
3. Basic understanding of HTTP routing concepts

## Common Commands

```bash
# Verify installation
portalis --version

# Start the gateway
portalis serve

# Validate configuration
portalis validate

# View routes
portalis routes list
```
