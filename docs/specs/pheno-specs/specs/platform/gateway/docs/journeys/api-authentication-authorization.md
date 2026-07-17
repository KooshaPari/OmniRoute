# API Authentication & Authorization

<UserJourney
    :steps="[
        { title: 'Configure Auth', desc: 'Set up authentication providers' },
        { title: 'JWT Validation', desc: 'Configure JWT token validation' },
        { title: 'OAuth Integration', desc: 'Add OAuth 2.0/OIDC support' },
        { title: 'API Keys', desc: 'Implement API key management' },
        { title: 'Test', desc: 'Verify auth flow end-to-end' }
    ]"
    :duration="25"
/>

## Overview

Portalis provides comprehensive authentication and authorization:
- JWT validation (RS256, HS256)
- OAuth 2.0 / OIDC integration
- API Key management
- Role-Based Access Control (RBAC)
- Plugin authentication support

## Step 1: Configure Authentication

Create the authentication configuration:

```bash
cat > ~/.config/portalis/auth.yaml << 'EOF'
authentication:
  enabled: true
  mode: multi  # jwt | oauth | api_key | multi
  
providers:
  jwt:
    enabled: true
    issuer: https://auth.example.com
    jwks_url: https://auth.example.com/.well-known/jwks.json
    algorithms: [RS256]
    audience: portalis-api
    claims:
      - sub
      - email
      - roles
      - permissions
      
  oauth:
    enabled: true
    provider: workos
    client_id: oauth_client_abc123
    authorization_url: https://auth.workos.com/authorize
    token_url: https://auth.workos.com/oauth/token
    scopes: [openid, profile, email]
    callback_url: http://localhost:8080/auth/callback
    
  api_key:
    enabled: true
    header: X-API-Key
    storage: config  # config | redis
EOF
```

Validate auth configuration:

```bash
portalis auth validate --config ~/.config/portalis/auth.yaml
```

**Expected Output:**
```
[✓] Authentication enabled
[✓] JWT provider configured (issuer: https://auth.example.com)
[✓] OAuth provider configured (provider: workos)
[✓] API Key auth enabled
[✓] No conflicts detected
```

## Step 2: Configure JWT Validation

Set up JWT validation with role extraction:

```bash
cat > ~/.config/portalis/jwt-config.yaml << 'EOF'
jwt:
  validation:
    verify_signature: true
    verify_exp: true
    verify_iat: true
    verify_iss: true
    verify_aud: true
    
  claims_mapping:
    sub: user_id
    email: user_email
    roles: user_roles
    permissions: user_permissions
    
  role_extraction:
    enabled: true
    source: jwt_claims
    claim: user_roles
    
authorization:
  rbac:
    enabled: true
    anonymous_role: guest
    default_role: viewer
    
roles:
  guest:
    permissions: []
    
  viewer:
    permissions:
      - routes:read
      
  developer:
    inherits: [viewer]
    permissions:
      - routes:read
      - routes:write
      - upstreams:read
      
  admin:
    inherits: [developer]
    permissions:
      - "*"  # all permissions
EOF
```

Test JWT validation:

```bash
# Generate a test JWT (for testing purposes)
TEST_TOKEN=$(python3 -c "
import jwt
import time
payload = {
    'sub': 'user_123',
    'email': 'test@example.com',
    'roles': ['developer'],
    'permissions': ['routes:read', 'routes:write'],
    'iat': int(time.time()),
    'exp': int(time.time()) + 3600,
    'iss': 'https://auth.example.com',
    'aud': 'portalis-api'
}
# Note: In production, use real keys
print(jwt.encode(payload, 'secret', algorithm='HS256'))
")

# Validate the token
portalis auth validate-jwt \
  --config ~/.config/portalis/jwt-config.yaml \
  --token "$TEST_TOKEN"
```

**Expected Output:**
```
JWT Validation Results:
[✓] Signature: valid
[✓] Expiration: valid (expires in 3600s)
[✓] Issuer: valid
[✓] Audience: valid
[✓] Claims extracted:
    - user_id: user_123
    - user_email: test@example.com
    - user_roles: [developer]
    - user_permissions: [routes:read, routes:write]
[✓] Role: developer
[✓] Permissions: routes:read, routes:write
```

## Step 3: OAuth Integration

Configure OAuth 2.0/OIDC support:

```bash
cat > ~/.config/portalis/oauth-config.yaml << 'EOF'
oauth:
  flows:
    authorization_code:
      enabled: true
      pkce: true
      scopes: [openid, profile, email]
      
    device_code:
      enabled: true
      scopes: [openid, profile, email]
      
  token_exchange:
    access_token_ttl: 900    # 15 minutes
    refresh_token_ttl: 604800  # 7 days
    
  user_info:
    endpoint: https://auth.workos.com/oauth/userinfo
    map:
      sub: user_id
      email: user_email
      name: user_name
      picture: user_avatar
EOF
```

Test OAuth device code flow:

```bash
# Initiate device authorization
portalis auth device-code \
  --config ~/.config/portalis/oauth-config.yaml \
  --client-id oauth_client_abc123
```

**Expected Output:**
```
Device Authorization Flow:
[1] Open the following URL:
    https://auth.workos.com/device/authorize?client_id=oauth_client_abc123&scope=openid+profile+email

[2] Enter the user code: ABCD-EFGH-1234

[3] Waiting for authorization...
    (Press Ctrl+C to cancel)

Status: Waiting for user authorization...
```

## Step 4: API Key Management

Configure API key authentication:

```bash
cat > ~/.config/portalis/api-keys.yaml << 'EOF'
api_keys:
  header_name: X-API-Key
  
  key_types:
    - name: standard
      prefix: sk_live_
      length: 32
      rate_limit: 1000/hour
      
    - name: privileged
      prefix: pk_live_
      length: 48
      rate_limit: 10000/hour
      
  keys:
    - id: key-alice
      key: sk_live_alice_abc123def456
      type: standard
      name: Alice's API Key
      owner: alice@example.com
      created: 2026-04-01
      permissions:
        - routes:read
        - upstreams:read
        
    - id: key-bob
      key: pk_live_bob_xyz789uvw012
      type: privileged
      name: Bob's Privileged Key
      owner: bob@example.com
      created: 2026-04-02
      permissions:
        - "*"
EOF
```

List API keys (masked):

```bash
portalis api-keys list --config ~/.config/portalis/api-keys.yaml
```

**Expected Output:**
```
API Keys:
┌─────────────┬─────────────────────────┬──────────┬────────────────┐
│ ID          │ Key                     │ Type     │ Owner          │
├─────────────┼─────────────────────────┼──────────┼────────────────┤
│ key-alice   │ sk_live_a*************f │ standard │ alice@example   │
│ key-bob     │ pk_live_b*************w │ privileged│ bob@example.com │
└─────────────┴─────────────────────────┴──────────┴────────────────┘
```

Generate a new API key:

```bash
portalis api-keys create \
  --config ~/.config/portalis/api-keys.yaml \
  --name "New Service Key" \
  --type standard \
  --permissions routes:read
```

**Expected Output:**
```
[✓] API Key created
    ID: key-new-001
    Key: sk_live_newkey_abc123def456ghi789jkl012
    Type: standard
    Permissions: routes:read
    
[!] Store this key securely. It will not be shown again.
```

## Step 5: Test Auth Flow End-to-End

Combine all auth methods in gateway configuration:

```bash
cat > ~/.config/portalis/gateway-auth.yaml << 'EOF'
gateway:
  name: secure-gateway
  listen: 0.0.0.0:8080
  
authentication:
  enabled: true
  mode: multi
  
auth:
  config: ~/.config/portalis/auth.yaml
  jwt:
    config: ~/.config/portalis/jwt-config.yaml
  oauth:
    config: ~/.config/portalis/oauth-config.yaml
  api_keys:
    config: ~/.config/portalis/api-keys.yaml

upstreams:
  - name: api-service
    url: http://localhost:3000

routes:
  - name: public-route
    path: /api/public/*
    upstream: api-service
    auth: none  # No auth required
    
  - name: user-route
    path: /api/users/*
    upstream: api-service
    auth: jwt
    required_roles: [viewer, developer, admin]
    
  - name: admin-route
    path: /api/admin/*
    upstream: api-service
    auth: jwt
    required_roles: [admin]
    
  - name: service-route
    path: /api/service/*
    upstream: api-service
    auth: api_key
    required_permissions: ["*"]
EOF
```

Start the gateway:

```bash
portalis serve --config ~/.config/portalis/gateway-auth.yaml
```

Test various authentication scenarios:

```bash
# Test 1: Public route (no auth)
curl http://localhost:8080/api/public/info

# Test 2: JWT auth (valid)
curl -H "Authorization: Bearer $TEST_TOKEN" \
     http://localhost:8080/api/users/me

# Test 3: JWT auth (missing token)
curl http://localhost:8080/api/users/me

# Test 4: API key auth
curl -H "X-API-Key: sk_live_alice_abc123def456" \
     http://localhost:8080/api/service/status

# Test 5: Role violation (developer accessing admin route)
curl -H "Authorization: Bearer $TEST_TOKEN" \
     http://localhost:8080/api/admin/users
```

**Expected Output:**
```
# Test 1: Public route
HTTP/1.1 200 OK
{"status": "public", "data": "Accessible to all"}

# Test 2: Valid JWT
HTTP/1.1 200 OK
X-User-Id: user_123
X-User-Roles: [developer]
{"user": {"id": "user_123", "email": "test@example.com"}}

# Test 3: Missing token
HTTP/1.1 401 Unauthorized
{"error": "authentication_required", "message": "No authentication token provided"}

# Test 4: API Key
HTTP/1.1 200 OK
{"service": "operational", "key_owner": "alice@example.com"}

# Test 5: Role violation
HTTP/1.1 403 Forbidden
{"error": "insufficient_permissions", "required_role": "admin", "current_roles": ["developer"]}
```

## Verification

Run authentication tests:

```bash
portalis test auth \
  --config ~/.config/portalis/gateway-auth.yaml \
  --scenarios jwt-valid,jwt-expired,api-key-valid,api-key-invalid,role-check
```

**Expected Output:**
```
Auth Test Results:
[✓] jwt-valid: PASSED (200 OK, user_id extracted)
[✓] jwt-expired: PASSED (401 Unauthorized returned)
[✓] api-key-valid: PASSED (200 OK, permissions granted)
[✓] api-key-invalid: PASSED (401 Unauthorized returned)
[✓] role-check: PASSED (correct role enforcement)

Result: 5/5 tests passed
```

## Next Steps

You've completed all journey tutorials:
- [First API Gateway Setup](./first-api-gateway-setup.md)
- [Implementing Rate Limiting](./implementing-rate-limiting.md)
- API Authentication & Authorization

For production deployment, see the [Architecture documentation](../../ARCHITECTURE.md) and [Security documentation](../../SECURITY.md).
