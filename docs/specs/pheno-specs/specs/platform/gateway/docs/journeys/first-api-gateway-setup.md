# First API Gateway Setup

<UserJourney
    :steps="[
        { title: 'Install', desc: 'Install and verify Portalis' },
        { title: 'Configure', desc: 'Create basic gateway configuration' },
        { title: 'Define Upstream', desc: 'Configure backend service target' },
        { title: 'Create Routes', desc: 'Set up routing rules' },
        { title: 'Test', desc: 'Verify end-to-end routing' }
    ]"
    :duration="15"
/>

## Step 1: Installation

Install Portalis using your preferred package manager:

```bash
# macOS via Homebrew
brew install phenotype/tap/portalis

# via Cargo (cross-platform)
cargo install portalis

# Verify installation
portalis --version
```

**Expected Output:**
```
Portalis v0.1.0
 Commit: a1b2c3d4
 Target: aarch64-apple-darwin
```

## Step 2: Basic Configuration

Create your gateway configuration file:

```bash
mkdir -p ~/.config/portalis
cat > ~/.config/portalis/gateway.yaml << 'EOF'
gateway:
  name: my-first-gateway
  listen: 0.0.0.0:8080
  log_level: info

upstreams:
  - name: backend-service
    url: http://localhost:3000
    health_check:
      enabled: true
      path: /health
      interval: 10s

routes:
  - path: /api/v1/*
    upstream: backend-service
    strip_prefix: /api/v1
EOF
```

Validate the configuration:

```bash
portalis validate --config ~/.config/portalis/gateway.yaml
```

**Expected Output:**
```
[✓] Configuration valid
[✓] Gateway name: my-first-gateway
[✓] Listen address: 0.0.0.0:8080
[✓] Upstreams: 1 (backend-service)
[✓] Routes: 1
```

## Step 3: Define Upstream

Add a mock upstream service to test routing. Start a simple HTTP server:

```bash
# In terminal 1: Start mock upstream
python3 -m http.server 3000 --directory /tmp
```

Verify the upstream is reachable:

```bash
curl -v http://localhost:3000/
```

**Expected Output:**
```
* Connected to localhost:3000
< HTTP/1.0 200 OK
```

## Step 4: Create Routes

Extend your configuration with multiple routes:

```bash
cat > ~/.config/portalis/gateway.yaml << 'EOF'
gateway:
  name: production-gateway
  listen: 0.0.0.0:8080
  log_level: info

upstreams:
  - name: user-service
    url: http://localhost:3000
    health_check:
      enabled: true
      path: /health
  - name: order-service
    url: http://localhost:4000
    health_check:
      enabled: true
      path: /health

routes:
  - name: users-route
    path: /api/users/*
    upstream: user-service
    strip_prefix: /api/users
    methods: [GET, POST, PUT, DELETE]
    
  - name: orders-route
    path: /api/orders/*
    upstream: order-service
    strip_prefix: /api/orders
    methods: [GET, POST]
    
  - name: health-route
    path: /health
    upstream: user-service
    strip_prefix: ""
    methods: [GET]
EOF
```

List configured routes:

```bash
portalis routes list --config ~/.config/portalis/gateway.yaml
```

**Expected Output:**
```
Routes:
┌────────────────┬──────────────────┬─────────────────┬─────────────┐
│ Name           │ Path             │ Upstream        │ Methods     │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ users-route    │ /api/users/*     │ user-service    │ GET,POST... │
│ orders-route   │ /api/orders/*    │ order-service   │ GET,POST    │
│ health-route   │ /health          │ user-service    │ GET         │
└────────────────┴──────────────────┴─────────────────┴─────────────┘
```

## Step 5: Test End-to-End

Start the gateway:

```bash
portalis serve --config ~/.config/portalis/gateway.yaml
```

In another terminal, test the routes:

```bash
# Test user route
curl -i http://localhost:8080/api/users/123

# Test order route (will fail since port 4000 isn't running)
curl -i http://localhost:8080/api/orders/456

# Test health route
curl http://localhost:8080/health
```

**Expected Output:**
```
# GET /api/users/123
HTTP/1.1 200 OK
Content-Type: text/html
...

# GET /api/orders/456  
HTTP/1.1 502 Bad Gateway
x-gateway-error: upstream-connection-failed

# GET /health
HTTP/1.1 200 OK
x-gateway-upstream: user-service
```

## Verification

Run the built-in diagnostics:

```bash
portalis diag --config ~/.config/portalis/gateway.yaml
```

**Expected Output:**
```
[✓] Gateway running on 0.0.0.0:8080
[✓] Upstream user-service: healthy
[!] Upstream order-service: unhealthy (connection refused)
[✓] Routes: 3 active, 0 inactive
[✓] Configuration: valid
```

## Next Steps

- [Implement Rate Limiting](./implementing-rate-limiting.md) - Add quota enforcement
- [API Authentication](./api-authentication-authorization.md) - Secure your endpoints
