# ADR-002: xxHash-Based Incremental Caching with Local and Remote Tiers

**Status**: Accepted  
**Date**: 2026-04-04  
**Author**: phenoForge Core Team  
**Reviewers**: Performance Team, Architecture Review Board  

---

## Context

phenoForge must support incremental builds—only rebuilding what changed. This requires:

1. **Change Detection**: Determine if a task needs to run
2. **Cache Storage**: Store and retrieve previous task outputs
3. **Cache Distribution**: Share across team/CI

We evaluated multiple hashing algorithms and cache architectures.

## Decision

We will use xxHash3-128 for content hashing with a tiered cache architecture:

1. **L1**: In-memory (process-local)
2. **L2**: Local filesystem (~/.cache/pheno-forge/)
3. **L3**: Remote cache (S3-compatible, optional)

### Task Signature

A task's cache key is computed from:

```rust
struct TaskSignature {
    task_name: String,           // Task identifier
    command_hash: u64,            // Hash of the command/closure
    input_hashes: Vec<u64>,      // Hashes of declared inputs
    env_hash: u64,              // Hash of relevant environment variables
    platform_hash: u64,          // Target platform identifier
}
```

## Rationale

### Why xxHash

| Algorithm | Speed | Collision Resistance | Use Case |
|-----------|-------|---------------------|----------|
| MD5 | 1x | Broken | Legacy only |
| SHA-256 | 0.3x | Very High | Cryptographic |
| SHA-1 | 0.5x | Broken | Legacy only |
| xxHash32 | 10x | Low | Non-critical |
| **xxHash3-128** | **8x** | **High** | **Build caching** |
| Blake3 | 2x | Very High | General purpose |

xxHash3-128 provides:
- **Speed**: ~8x faster than SHA-256
- **Low collision probability**: 2^-128 for random inputs
- **Streamable**: Process large files incrementally
- **Proven**: Used by LZ4, Redis, Bazel (optional)

### Why Not SHA-256

SHA-256 is cryptographically secure but:
- 3x slower than xxHash
- Unnecessary for non-adversarial build caching
- Bazel's default but with optional xxHash support

### Why Not Timestamps

Make-style timestamp comparison:
- Faster than hashing (<1ms vs 10ms)
- But fails with:
  - Clock skew across machines
  - Git operations (preserves timestamps)
  - Docker layers (timestamps reset)
  - Network filesystems (stale timestamps)

### Cache Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     phenoForge                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   L1 Cache  │  │   L2 Cache  │  │    L3 Cache     │ │
│  │   (Memory)  │◀─│  (Local FS) │◀─│  (Remote S3)   │ │
│  │             │  │             │  │                 │ │
│  │ ~10ns       │  │ ~1ms        │  │ ~50-200ms      │ │
│  │ Process     │  │ ~/.cache/   │  │ S3/MinIO/      │ │
│  │ local       │  │ pheno-forge/│  │ GCS/R2         │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Why Tiered Caching

| Tier | When Used | Latency | Persistence |
|------|-----------|---------|-------------|
| L1 | Current process | 10-100ns | None |
| L2 | Local reuse | 1-10ms | Session |
| L3 | Team sharing | 50-200ms | Permanent |

Benefits:
1. **Fast local iteration**: L1/L2 for solo development
2. **CI acceleration**: L3 shared across builds
3. **Offline support**: L2 works without network
4. **Cost optimization**: L3 only for cache misses

## Consequences

### Positive

1. **Performance**:
   - xxHash: ~10ms for 1GB file
   - L1 cache: Sub-microsecond lookup
   - L2 cache: <10ms with SSD

2. **Correctness**:
   - Content-based, not timestamp
   - Detects any change, not just modification time
   - Cross-machine consistency

3. **Scalability**:
   - Streaming hash for large files
   - Parallel hash computation
   - O(changed) not O(total)

4. **Flexibility**:
   - Pluggable storage backends
   - Optional remote tier
   - Configurable TTL/eviction

### Negative

1. **CPU Usage**: Hashing consumes CPU
   - Mitigation: xxHash is extremely fast
   - Mitigation: Parallel hashing
   - Mitigation: Skip hashing for small files (<1KB)

2. **Storage Overhead**: Duplicate artifacts in L2/L3
   - Mitigation: Content-addressable (deduplication)
   - Mitigation: Compression (zstd)
   - Mitigation: LRU eviction

3. **Network Dependency**: L3 requires connectivity
   - Mitigation: Graceful fallback to L2
   - Mitigation: Background prefetch
   - Mitigation: Configurable timeout

4. **Security**: xxHash not cryptographically secure
   - Mitigation: Not a concern for build caching
   - Mitigation: Optional SHA-256 for compliance

### Neutral

1. **Complexity**: More complex than timestamp approach
   - But correctness is worth it
   - Encapsulated in cache module

## Implementation Details

### xxHash Integration

```rust
use xxhash_rust::xxh3::xxh3_128;
use std::hash::Hasher;

pub struct XxHash3Hasher;

impl XxHash3Hasher {
    pub fn hash_file(path: &Path) -> Result<u128> {
        let mut file = File::open(path)?;
        let mut hasher = Xxh3::new();
        
        let mut buffer = [0u8; 8192];
        loop {
            let n = file.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        
        Ok(hasher.digest128())
    }
    
    pub fn hash_bytes(data: &[u8]) -> u128 {
        xxh3_128(data)
    }
}
```

### Cache Entry Format

```rust
#[derive(Serialize, Deserialize)]
struct CacheEntry {
    version: u32,                 // Cache format version
    signature: u128,              // Task signature hash
    task_name: String,            // Human-readable identifier
    created_at: SystemTime,       // For TTL management
    output_paths: Vec<PathBuf>,   // Cached artifact paths
    metadata: HashMap<String, String>, // Custom metadata
}

// On-disk structure:
// ~/.cache/pheno-forge/v1/
//   ├── <signature_prefix>/
//   │   ├── <signature_full>/
//   │   │   ├── meta.json        # CacheEntry
//   │   │   ├── outputs/
//   │   │   │   ├── artifact1
//   │   │   │   └── artifact2
//   │   │   └── logs/
//   │   │       └── stdout.log
```

### Cache Lookup Flow

```rust
async fn lookup_cache(&self, signature: u128) -> Option<CacheHit> {
    // L1: Memory cache
    if let Some(hit) = self.l1.get(&signature) {
        return Some(hit);
    }
    
    // L2: Local filesystem
    if let Some(hit) = self.l2.lookup(signature).await {
        // Promote to L1
        self.l1.insert(signature, hit.clone());
        return Some(hit);
    }
    
    // L3: Remote cache (if enabled)
    if self.l3_enabled {
        if let Some(hit) = self.l3.lookup(signature).await {
            // Store in L2 for future
            self.l2.store(signature, &hit).await.ok()?;
            self.l1.insert(signature, hit.clone());
            return Some(hit);
        }
    }
    
    None
}
```

### Remote Cache Protocol

```rust
// S3-compatible remote cache
trait RemoteCache {
    async fn get(&self, key: u128) -> Result<Option<Bytes>>;
    async fn put(&self, key: u128, data: Bytes, ttl: Duration) -> Result<()>;
    async fn exists(&self, key: u128) -> Result<bool>;
}

// Implementation for S3, GCS, Azure Blob, MinIO
struct S3RemoteCache {
    client: S3Client,
    bucket: String,
    prefix: String,
}

impl RemoteCache for S3RemoteCache {
    async fn get(&self, key: u128) -> Result<Option<Bytes>> {
        let key = format!("{}/{:032x}", self.prefix, key);
        
        match self.client.get_object(&self.bucket, &key).await {
            Ok(response) => Ok(Some(response.body)),
            Err(S3Error::NotFound) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
    
    async fn put(&self, key: u128, data: Bytes, _ttl: Duration) -> Result<()> {
        let key = format!("{}/{:032x}", self.prefix, key);
        self.client.put_object(&self.bucket, &key, data).await?;
        Ok(())
    }
}
```

## Configuration

```toml
# .forge/config.toml
[cache]
enabled = true
local_dir = "~/.cache/pheno-forge"
max_local_size = "10GB"
compression = "zstd"  # none, zstd, gzip

[cache.remote]
enabled = true
endpoint = "s3://my-bucket/pheno-forge-cache"
region = "us-east-1"
access_key = "$AWS_ACCESS_KEY_ID"
secret_key = "$AWS_SECRET_ACCESS_KEY"
timeout = "30s"
concurrent_uploads = 4
```

## Comparison with Industry

| System | Hash Algorithm | Remote Cache | Notes |
|--------|---------------|--------------|-------|
| Bazel | SHA-256 (default) | Yes | Optional xxHash |
| Buck2 | SHA-256 | Yes | Configurable |
| Nx | SHA-256 | Yes | Nx Cloud |
| Turborepo | SHA-256 | Yes | Vercel Remote Cache |
| Gradle | SHA-256 | Yes | Build Cache |
| phenoForge | xxHash3-128 | Yes | Tiered L1/L2/L3 |

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Hash 1GB file | <10ms | xxHash benchmark |
| L1 lookup | <100ns | Memory access |
| L2 lookup | <5ms | SSD read |
| L3 lookup | <200ms | Network RTT |
| Cache hit rate | >80% | CI metrics |
| False positive | <0.0001% | Collision probability |

## References

- xxHash: https://github.com/Cyan4973/xxHash
- xxHash Rust: https://github.com/DoumanAsh/xxhash-rust
- Bazel Remote Cache: https://bazel.build/remote/caching
- Content-Defined Chunking: https://en.wikipedia.org/wiki/Rolling_hash
- S3 Performance: https://docs.aws.amazon.com/whitepapers/latest/s3-optimizing-performance-best-practices/welcome.html

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-04 | phenoForge Team | Initial decision |
