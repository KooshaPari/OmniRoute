# Advanced Setup Journey

<UserJourney
    :steps="[
        { title: 'Remote Cache', desc: 'Configure distributed caching' },
        { title: 'Remote Execution', desc: 'Set up remote workers' },
        { title: 'CI Integration', desc: 'Connect to CI/CD pipelines' },
        { title: 'Monitoring', desc: 'Set up performance tracking' }
    ]"
    :duration="20"
    :gif-src="'/gifs/phenotype-forge-advanced.gif'"
/>

## Prerequisites

- Completed [Quick Start](./quick-start)
- Completed [Core Workflow](./core-workflow)
- Remote cache server (optional)
- CI/CD environment access

## Step-by-Step

### 1. Remote Cache Configuration

Set up distributed caching for faster CI builds:

```toml
# forge.toml
[cache]
backend = "remote"
remote_url = "https://cache.example.com"
remote_auth = "Bearer ${CACHE_TOKEN}"
compression = "lz4"

[cache.local]
enabled = true
max_size = "10GB"
ttl = "7d"
```

Environment variable setup:

```bash
# CI environment variables
export CACHE_TOKEN="your-cache-token"
export CACHE_URL="https://cache.example.com"
```

Cache key structure:

```bash
# Verify cache connectivity
forge cache status

# Force fresh build (bypass cache)
forge run --no-cache build
```

### 2. Remote Execution Setup

Configure remote workers for parallel execution:

```toml
# forge.toml
[execution]
mode = "remote"
remote_url = "grpcs://exec.example.com:9090"
max_concurrent = 16
timeout = "30m"

[execution.local]
fallback = true
workers = 4
```

Worker pool configuration:

```bash
# List available workers
forge exec workers

# Test remote execution
forge run --remote test

# Hybrid mode (local + remote)
forge run --hybrid build
```

### 3. CI/CD Integration

#### GitHub Actions

```yaml
# .github/workflows/build.yml
name: Build
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        
      - name: Install phenotype-forge
        run: cargo install phenotype-forge
        
      - name: Configure cache
        run: |
          echo "CACHE_TOKEN=${{ secrets.CACHE_TOKEN }}" >> $GITHUB_ENV
          echo "CACHE_URL=${{ vars.CACHE_URL }}" >> $GITHUB_ENV
      
      - name: Build
        run: forge run build
        
      - name: Test
        run: forge run test
```

#### GitLab CI

```yaml
# .gitlab-ci.yml
image: rust:latest

variables:
  CACHE_TOKEN: ${CACHE_TOKEN}
  CACHE_URL: ${CACHE_URL}

build:
  script:
    - cargo install phenotype-forge
    - forge run build
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - .forge/cache/

test:
  script:
    - forge run test
  dependencies:
    - build
```

#### Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        CACHE_TOKEN = credentials('cache-token')
        CACHE_URL = credentials('cache-url')
    }
    
    stages {
        stage('Build') {
            steps {
                sh 'cargo install phenotype-forge'
                sh 'forge run build'
            }
        }
        
        stage('Test') {
            steps {
                sh 'forge run test'
            }
        }
    }
}
```

### 4. Performance Monitoring

Configure metrics collection:

```toml
# forge.toml
[metrics]
enabled = true
 exporter = "prometheus"
 port = 9090
 path = "/metrics"

[metrics.tags]
service = "phenotype-forge"
env = "${ENVIRONMENT}"
```

Prometheus scrape config:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'phenotype-forge'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
```

Grafana dashboard query:

```promql
# Build duration percentiles
histogram_quantile(0.95, rate(forge_build_duration_seconds_bucket[5m]))

# Cache hit rate
rate(forge_cache_hits_total[5m]) / rate(forge_cache_lookups_total[5m])

# Task parallelism
rate(forge_tasks_completed_total[5m]) / rate(forge_wall_clock_seconds_total[5m])
```

### 5. Security Configuration

#### Authentication

```toml
# forge.toml
[auth]
type = "oauth2"
client_id = "${OAUTH_CLIENT_ID}"
client_secret = "${OAUTH_CLIENT_SECRET}"
token_url = "https://auth.example.com/token"

[auth.tokens]
cache = "read/write"
exec = "read/write/execute"
```

#### TLS Configuration

```toml
[tls]
enabled = true
cert_path = "/etc/forge/tls.crt"
key_path = "/etc/forge/tls.key"
min_version = "1.3"

[tls.mtls]
enabled = true
ca_path = "/etc/forge/ca.crt"
verify_client = true
```

### 6. Resource Limits

Configure resource constraints:

```toml
# forge.toml
[limits]
max_memory_mb = 4096
max_cpu_percent = 80
max_temp_files = 1000
max_watch_handles = 10000

[limits.tasks]
max_concurrent = 16
timeout_default = "10m"
timeout_max = "1h"
```

### 7. High Availability Setup

Multi-node configuration:

```toml
# forge.toml (node cluster)
[cluster]
enabled = true
nodes = [
    "node1.example.com:9091",
    "node2.example.com:9091",
    "node3.example.com:9091"
]
consensus = "raft"
```

## Verification

Validate advanced setup:

```bash
# Check all connections
forge doctor

# Test remote cache
forge cache test --remote

# Test remote execution
forge exec test --remote --dry-run

# Verify metrics endpoint
curl http://localhost:9090/metrics | head
```

## Performance Expectations

| Scenario | Without Remote | With Remote Cache | With Remote Exec |
|----------|---------------|------------------|-----------------|
| Cold build | 10 min | 5 min | 1 min |
| Incremental | 30s | 5s | 2s |
| CI checkout | 10 min | 30s | 30s |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cache auth failures | Verify token expiry and scopes |
| Remote exec timeout | Increase `timeout` in config |
| Metrics not exposed | Check `metrics.port` is accessible |
| MTLS handshake fails | Verify CA and cert compatibility |

## See Also

- [Architecture Metrics](../architecture/metrics) - SLO definitions
- [SOTA Research](../SOTA_RESEARCH) - Build system comparisons
- [ADR-002](../architecture/ADRs/ADR-002-xxhash-tiered-caching) - Caching design
