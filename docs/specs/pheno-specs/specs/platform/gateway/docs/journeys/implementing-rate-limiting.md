# Implementing Rate Limiting

<UserJourney
    :steps="[
        { title: 'Configure Limits', desc: 'Set up global rate limits' },
        { title: 'Define Policies', desc: 'Create quota policies per consumer' },
        { title: 'Add Enforcement', desc: 'Configure response behavior on limit exceeded' },
        { title: 'Monitor', desc: 'View rate limit metrics and logs' }
    ]"
    :duration="20"
/>

## Overview

Rate limiting protects your APIs from abuse, ensures fair usage, and enables predictable scaling. Portalis supports:
- Global rate limits (requests per second/minute)
- Per-consumer quotas (daily/monthly limits)
- Sliding window and fixed window algorithms
- Automatic retry-after headers

## Step 1: Configure Global Rate Limits

Add rate limit configuration to your gateway:

```bash
cat > ~/.config/portalis/gateway.yaml << 'EOF'
gateway:
  name: rate-limited-gateway
  listen: 0.0.0.0:8080

rate_limits:
  global:
    requests: 1000
    period: 60  # per minute
    burst: 100

upstreams:
  - name: api-service
    url: http://localhost:3000

routes:
  - name: api-route
    path: /api/*
    upstream: api-service
EOF
```

Validate and view rate limit config:

```bash
portalis rate-limits show --config ~/.config/portalis/gateway.yaml
```

**Expected Output:**
```
Global Rate Limits:
┌──────────────────┬──────────────┬────────┬────────┐
│ Scope            │ Requests     │ Period │ Burst  │
├──────────────────┼──────────────┼────────┼────────┤
│ Global           │ 1000         │ 60s    │ 100    │
└──────────────────┴──────────────┴────────┴────────┘
```

## Step 2: Define Consumer Quotas

Create quota policies for different consumer tiers:

```bash
cat > ~/.config/portalis/quotas.yaml << 'EOF'
quotas:
  - name: free-tier
    requests: 100
    period: hour
    upstream: api-service
    
  - name: pro-tier
    requests: 10000
    period: hour
    upstream: api-service
    
  - name: enterprise-tier
    requests: 100000
    period: hour
    upstream: api-service
    burst: 1000

consumers:
  - id: consumer-alice
    key: "sk_live_alice_abc123"
    quota: free-tier
    
  - id: consumer-bob
    key: "sk_live_bob_xyz789"
    quota: pro-tier
    
  - id: consumer-corp
    key: "sk_live_corp_def456"
    quota: enterprise-tier
EOF
```

List configured quotas:

```bash
portalis quotas list --config ~/.config/portalis/quotas.yaml
```

**Expected Output:**
```
Consumer Quotas:
┌─────────────────┬──────────────┬────────────────┐
│ Consumer        │ Quota        │ Remaining      │
├─────────────────┼──────────────┼────────────────┤
│ consumer-alice  │ 100/hr       │ 100            │
│ consumer-bob    │ 10,000/hr    │ 10,000         │
│ consumer-corp   │ 100,000/hr   │ 100,000        │
└─────────────────┴──────────────┴────────────────┘
```

## Step 3: Configure Enforcement

Set up how rate limits are enforced:

```bash
cat > ~/.config/portalis/enforcement.yaml << 'EOF'
rate_limit:
  enforcement:
    mode: strict  # strict | lenient | disabled
    
  response:
    status_code: 429
    headers:
      X-RateLimit-Limit: true
      X-RateLimit-Remaining: true
      X-RateLimit-Reset: true
      Retry-After: true
      
  retry:
    enabled: true
    max_attempts: 3
    backoff: exponential
    initial_delay: 100ms
    max_delay: 10s
EOF
```

Test enforcement behavior:

```bash
# Start gateway with enforcement
portalis serve \
  --config ~/.config/portalis/gateway.yaml \
  --quotas ~/.config/portalis/quotas.yaml \
  --enforcement ~/.config/portalis/enforcement.yaml

# In another terminal: trigger rate limit
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-API-Key: sk_live_alice_abc123" \
    http://localhost:8080/api/resource
done
```

**Expected Output:**
```
# First 100 requests
HTTP/1.1 200 OK
X-RateLimit-Remaining: 99
...

# Request 101
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709593200
Retry-After: 3600
```

## Step 4: Monitor Rate Limits

View real-time rate limit metrics:

```bash
portalis rate-limits metrics --config ~/.config/portalis/gateway.yaml
```

**Expected Output:**
```
Rate Limit Metrics:
┌─────────────────┬────────────┬───────────┬────────────────┐
│ Consumer        │ Requests   │ Rejected  │ Current Period │
├─────────────────┼────────────┼───────────┼────────────────┤
│ consumer-alice  │ 100        │ 0         │ 14% used       │
│ consumer-bob    │ 2,450      │ 0         │ 24% used       │
│ consumer-corp   │ 15,200     │ 0         │ 15% used       │
└─────────────────┴────────────┴───────────┴────────────────┘
```

Check rate limit logs:

```bash
portalis logs --filter rate_limit --last 50
```

**Expected Output:**
```
[2026-04-04T23:30:15Z] INFO  consumer-alice: 100/100 requests used (99% consumed)
[2026-04-04T23:30:16Z] WARN  consumer-alice: Rate limit exceeded (quota=free-tier)
[2026-04-04T23:30:16Z] INFO  consumer-alice: Returned 429 to client
```

## Advanced Configuration

### Sliding Window Algorithm

```yaml
rate_limits:
  global:
    algorithm: sliding_window
    requests: 1000
    period: 60
```

### Distributed Rate Limiting (Redis)

```bash
portalis serve \
  --redis-url redis://localhost:6379 \
  --config ~/.config/portalis/gateway.yaml
```

## Verification

Run rate limit tests:

```bash
portalis test rate-limit \
  --config ~/.config/portalis/gateway.yaml \
  --consumer sk_live_alice_abc123 \
  --requests 150 \
  --expected-rejected 50
```

**Expected Output:**
```
Rate Limit Test Results:
[✓] Sent 150 requests
[✓] Received 100 200 OK responses
[✓] Received 50 429 Too Many Requests
[✓] All rejected requests had correct headers
```

## Next Steps

- [API Authentication & Authorization](./api-authentication-authorization.md) - Add JWT/OAuth security
