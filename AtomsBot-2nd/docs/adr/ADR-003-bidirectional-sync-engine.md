# ADR-003: Bidirectional Synchronization Engine with Conflict Resolution

**Date**: 2026-04-04  
**Status**: Accepted  
**Deciders**: KooshaPari  

## Context

AtomsBot maintains bidirectional synchronization between Discord forum threads and external issue tracking systems. When an action occurs in one system, it must be reflected in the other. This creates inherent complexity around conflict resolution, event ordering, and data consistency.

### Problem Statement

We need to design a synchronization engine that:
1. Propagates changes bidirectionally (Discord ↔ GitHub/Jira/Linear)
2. Handles conflicts when concurrent modifications occur
3. Maintains ordering guarantees for dependent operations
4. Provides at-least-once delivery semantics
5. Operates efficiently without excessive API calls

### Decision Drivers

| Driver | Weight | Description |
|--------|--------|-------------|
| Data Consistency | Critical | No lost updates, eventual consistency |
| Conflict Handling | Critical | Clear resolution rules |
| Ordering | High | Comments must stay in order |
| Performance | High | <2s sync latency |
| Reliability | High | 99.9% delivery guarantee |
| Efficiency | Medium | Minimize API calls |

## Options Considered

### Option A: Queue-Based Sync with Timestamp Resolution (Selected)

**Architecture**:
```
Event Source ──▶ Queue ──▶ Worker ──▶ Target API
                    │
                    ▼
              Conflict Resolver
              (Last-Write-Wins)
```

**Implementation**:
```typescript
interface SyncJob {
  id: string;
  source: 'discord' | 'github' | 'jira' | 'linear';
  target: 'discord' | 'github' | 'jira' | 'linear';
  entity: 'issue' | 'comment' | 'status' | 'assignee';
  action: 'create' | 'update' | 'delete';
  payload: unknown;
  timestamp: number;
  sourceVersion: number;
  retryCount: number;
  correlationId: string;
}

class SyncEngine {
  private queue: Queue<SyncJob>;
  private conflictResolver: ConflictResolver;
  
  async enqueue(job: Omit<SyncJob, 'id' | 'retryCount'>): Promise<void> {
    const fullJob: SyncJob = {
      ...job,
      id: generateId(),
      retryCount: 0,
    };
    
    // Check for conflicts before enqueuing
    const conflict = await this.conflictResolver.detect(fullJob);
    if (conflict) {
      const resolution = await this.conflictResolver.resolve(conflict, fullJob);
      if (resolution.skip) {
        logger.info(`Skipping sync job ${fullJob.id}: ${resolution.reason}`);
        return;
      }
      if (resolution.transform) {
        fullJob.payload = resolution.transform(fullJob.payload);
      }
    }
    
    await this.queue.add(fullJob, {
      priority: this.calculatePriority(fullJob),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
  
  private async processJob(job: SyncJob): Promise<void> {
    const processor = this.getProcessor(job.entity, job.action);
    
    try {
      // Pre-sync: Check target state
      const targetState = await this.getTargetState(job);
      
      // Resolve any new conflicts
      if (await this.isConflict(job, targetState)) {
        const winner = this.resolveConflict(job, targetState);
        if (winner === 'target') {
          logger.info(`Target state is newer, skipping sync`);
          return;
        }
      }
      
      // Execute sync
      await processor.execute(job);
      
      // Post-sync: Update version tracking
      await this.updateVersion(job);
      
      metrics.recordSyncSuccess(job.source, job.target, job.entity);
    } catch (error) {
      metrics.recordSyncFailure(job.source, job.target, job.entity, error);
      throw error; // Trigger retry
    }
  }
}
```

**Conflict Resolution**:
```typescript
class TimestampConflictResolver implements ConflictResolver {
  async detect(job: SyncJob): Promise<Conflict | null> {
    const currentVersion = await this.getCurrentVersion(
      job.entity,
      this.getEntityId(job)
    );
    
    if (!currentVersion) return null;
    
    // Detect conflict: job is based on outdated version
    if (job.sourceVersion < currentVersion.version) {
      return {
        type: 'concurrent_modification',
        current: currentVersion,
        incoming: job,
      };
    }
    
    return null;
  }
  
  resolve(conflict: Conflict, incoming: SyncJob): Resolution {
    // Last-Write-Wins strategy
    if (incoming.timestamp > conflict.current.timestamp) {
      return {
        action: 'proceed',
        reason: 'Incoming change is newer',
      };
    }
    
    return {
      action: 'skip',
      reason: 'Target state is newer',
    };
  }
}
```

**Pros**:
- **Reliable**: Queue provides persistence and retry
- **Ordered**: FIFO per entity ensures correct ordering
- **Observable**: Full job lifecycle visibility
- **Scalable**: Horizontal worker scaling
- **Conflict Resolution**: Clear rules prevent data loss

**Cons**:
- **Complexity**: Queue infrastructure required
- **Latency**: Queue overhead adds ~50-100ms
- **Ordering Limits**: Global ordering requires coordination

### Option B: Direct Synchronous Sync

**Architecture**:
```
Discord Event ──▶ Handler ──▶ GitHub API (blocking)
```

**Pros**:
- **Simplicity**: No queue infrastructure
- **Low Latency**: Immediate execution
- **Ordering**: Natural event ordering

**Cons**:
- **Fragility**: API failure loses event
- **Blocking**: Slow API calls freeze handler
- **No Retry**: Manual recovery required
- **Coupling**: Handler directly depends on API

**Verdict**: Rejected due to reliability concerns.

### Option C: Event Sourcing with CQRS

**Architecture**:
```
Discord Event ──▶ Event Store ──▶ Projections ──▶ GitHub API
```

**Pros**:
- **Complete History**: All events preserved
- **Temporal Queries**: State at any point in time
- **Audit Trail**: Built-in compliance

**Cons**:
- **Complexity**: Significant infrastructure
- **Overkill**: Too heavy for current needs
- **Performance**: Projection overhead
- **Learning Curve**: Team must understand patterns

**Verdict**: Rejected as premature optimization.

### Option D: Cron-Based Polling

**Architecture**:
```
Cron ──▶ Check Changes ──▶ Update Target
```

**Pros**:
- **Simplicity**: No event handling
- **Reliable**: Missed events caught next cycle
- **Batching**: Efficient bulk operations

**Cons**:
- **Latency**: 30-60 second minimum delay
- **API Waste**: Polling consumes quota
- **Missed Events**: Brief changes never seen

**Verdict**: Rejected due to unacceptable latency.

## Decision

**Adopt Option A: Queue-Based Sync with Timestamp-Based Conflict Resolution**

### Rationale

1. **Reliability**: Queue persistence ensures no lost events
2. **Conflict Resolution**: Clear rules prevent update conflicts
3. **Ordering**: FIFO per entity maintains consistency
4. **Scalability**: Workers scale horizontally
5. **Observability**: Full visibility into sync state

### Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Bidirectional Sync Flow                                   │
│                                                                              │
│  ┌──────────────┐                      ┌──────────────┐                     │
│  │   Discord    │                      │    GitHub    │                     │
│  │   Forum      │◀────────────────────▶│   Issues     │                     │
│  └──────┬───────┘                      └──────┬───────┘                     │
│         │                                     │                              │
│         │ 1. User creates post                │                              │
│         │    with #123 reference              │                              │
│         │                                     │                              │
│         ▼                                     │                              │
│  ┌──────────────┐                              │                              │
│  │   Auto-      │                              │                              │
│  │   Linker     │                              │                              │
│  └──────┬───────┘                              │                              │
│         │ 2. Validates issue #123               │                              │
│         │    exists                           │                              │
│         ▼                                     │                              │
│  ┌──────────────┐                              │                              │
│  │    Queue     │                              │                              │
│  │  ┌────────┐  │                              │                              │
│  │  │ Job:   │  │  3. Enqueue link job        │                              │
│  │  │ Link   │  │                             │                              │
│  │  │ Thread │  │                             │                              │
│  │  │ to #123│  │                             │                              │
│  │  └────────┘  │                             │                              │
│  └──────┬───────┘                             │                              │
│         │                                     │                              │
│         │ 4. Worker processes                   │                              │
│         ▼                                     │                              │
│  ┌──────────────┐    5. Update thread         │                              │
│  │   Update     │    metadata                │                              │
│  │   Thread     │◀────────────────────────────│                              │
│  │   Embed      │                             │                              │
│  └──────────────┘                             │                              │
│                                               │                              │
│  ════════════════════════════════════════════│════════════════════════════ │
│                                               │                              │
│  ┌──────────────┐                             │                              │
│  │   GitHub     │  6. Issue #123              │                              │
│  │   Webhook    │    closed                  │                              │
│  └──────┬───────┘                             │                              │
│         │                                     │                              │
│         ▼                                     │                              │
│  ┌──────────────┐                             │                              │
│  │    Queue     │  7. Enqueue close job       │                              │
│  │  ┌────────┐  │                             │                              │
│  │  │ Job:   │  │                             │                              │
│  │  │ Close  │  │                             │                              │
│  │  │ Thread │  │                             │                              │
│  │  └────────┘  │                             │                              │
│  └──────┬───────┘                             │                              │
│         │                                     │                              │
│         │ 8. Worker processes                 │                              │
│         │    (check for conflict)             │                              │
│         ▼                                     │                              │
│  ┌──────────────┐                             │                              │
│  │  Conflict    │  9. No conflict             │                              │
│  │  Resolver    │    (webhook timestamp       │                              │
│  │              │     > last sync)            │                              │
│  └──────┬───────┘                             │                              │
│         │                                     │                              │
│         │ 10. Archive Discord thread          │                              │
│         ▼                                     │                              │
│  ┌──────────────┐                             │                              │
│  │   Archive    │                             │                              │
│  │   Thread     │                             │                              │
│  └──────────────┘                             │                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Version Tracking

```typescript
// Entity version tracking for conflict detection
interface EntityVersion {
  entityId: string;
  entityType: 'issue' | 'comment' | 'status' | 'assignee';
  version: number;
  timestamp: number;
  source: string;
  syncVersion: number;
}

class VersionTracker {
  private db: PrismaClient;
  
  async getCurrentVersion(
    entityType: string,
    entityId: string
  ): Promise<EntityVersion | null> {
    return this.db.syncVersion.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
    });
  }
  
  async updateVersion(version: EntityVersion): Promise<void> {
    await this.db.syncVersion.upsert({
      where: {
        entityType_entityId: {
          entityType: version.entityType,
          entityId: version.entityId,
        },
      },
      update: {
        version: version.version,
        timestamp: version.timestamp,
        source: version.source,
        syncVersion: { increment: 1 },
      },
      create: version,
    });
  }
  
  async incrementVersion(
    entityType: string,
    entityId: string,
    source: string
  ): Promise<number> {
    const result = await this.db.syncVersion.update({
      where: {
        entityType_entityId: { entityType, entityId },
      },
      data: {
        version: { increment: 1 },
        timestamp: Date.now(),
        source,
        syncVersion: { increment: 1 },
      },
    });
    return result.version;
  }
}
```

### Conflict Resolution Strategies

```typescript
// Strategy interface
type ConflictStrategy = 'lww' | 'merge' | 'custom' | 'manual';

interface ConflictResolutionStrategy {
  type: ConflictStrategy;
  resolve(conflict: Conflict, incoming: SyncJob): Resolution;
}

// Last-Write-Wins (default for most fields)
class LastWriteWinsStrategy implements ConflictResolutionStrategy {
  type = 'lww' as const;
  
  resolve(conflict: Conflict, incoming: SyncJob): Resolution {
    if (incoming.timestamp > conflict.current.timestamp) {
      return {
        action: 'proceed',
        reason: `Incoming (${incoming.timestamp}) > Current (${conflict.current.timestamp})`,
      };
    }
    return {
      action: 'skip',
      reason: `Current (${conflict.current.timestamp}) >= Incoming (${incoming.timestamp})`,
    };
  }
}

// Merge strategy (for comments, labels)
class MergeStrategy implements ConflictResolutionStrategy {
  type = 'merge' as const;
  
  resolve(conflict: Conflict, incoming: SyncJob): Resolution {
    // For comments: append both
    // For labels: union of both sets
    return {
      action: 'transform',
      transform: (payload) => this.mergePayloads(
        conflict.current.payload,
        incoming.payload
      ),
    };
  }
  
  private mergePayloads(current: unknown, incoming: unknown): unknown {
    // Implementation depends on entity type
    if (this.isCommentPayload(current) && this.isCommentPayload(incoming)) {
      return {
        ...incoming,
        content: `${current.content}\n\n---\n\n${incoming.content}`,
      };
    }
    return incoming;
  }
}

// Custom strategy (for assignees - prioritize certain sources)
class AssigneeStrategy implements ConflictResolutionStrategy {
  type = 'custom' as const;
  
  private priority = {
    discord: 3,  // User action highest priority
    github: 2,
    jira: 2,
    linear: 2,
    system: 1,
  };
  
  resolve(conflict: Conflict, incoming: SyncJob): Resolution {
    const currentPriority = this.priority[conflict.current.source] || 0;
    const incomingPriority = this.priority[incoming.source] || 0;
    
    if (incomingPriority > currentPriority) {
      return { action: 'proceed', reason: 'Higher priority source' };
    }
    if (incomingPriority < currentPriority) {
      return { action: 'skip', reason: 'Lower priority source' };
    }
    // Equal priority: use timestamp
    return new LastWriteWinsStrategy().resolve(conflict, incoming);
  }
}
```

### Queue Configuration

```typescript
// Bull queue with optimal settings for sync
const syncQueue = new Queue<SyncJob>('sync', redisUrl, {
  defaultJobOptions: {
    // Retry configuration
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    
    // Job lifecycle
    removeOnComplete: {
      age: 24 * 3600,  // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,  // Keep failed jobs for 7 days
      count: 500,
    },
    
    // Timeout
    timeout: 30000,  // 30 second timeout
    
    // Idempotency (via jobId)
    jobId: (job) => `${job.entity}-${job.action}-${job.timestamp}`,
  },
  
  // Rate limiting per target
  limiter: {
    max: 100,
    duration: 1000,
    bounceBack: false,
  },
  
  // Settings
  settings: {
    lockDuration: 30000,
    stalledInterval: 30000,
    maxStalledCount: 1,
    guardInterval: 5000,
    retryProcessDelay: 5000,
  },
});

// Worker with concurrency control
const worker = new Worker<SyncJob>('sync', processor, {
  connection: redisUrl,
  concurrency: 5,  // Process 5 jobs concurrently
  limiter: {
    max: 100,
    duration: 1000,
  },
});
```

## Consequences

### Positive

1. **Data Consistency**: Version tracking prevents lost updates
2. **Reliability**: Queue persistence + retry ensures delivery
3. **Scalability**: Workers scale independently
4. **Observability**: Full sync lifecycle visibility
5. **Flexibility**: Pluggable conflict resolution strategies

### Negative

1. **Complexity**: Queue infrastructure and versioning adds complexity
2. **Latency**: Queue + conflict check adds ~100-200ms
3. **Storage**: Job history consumes Redis memory
4. **Operational**: Requires monitoring and alerting

### Mitigations

| Concern | Mitigation |
|---------|------------|
| Complexity | Comprehensive ADRs + runbooks |
| Latency | Priority queues for user actions |
| Storage | Automatic job cleanup policies |
| Operational | Health checks + metrics dashboards |

## Performance Baselines

| Metric | Target | Measurement |
|--------|--------|-------------|
| Enqueue latency | <10ms | Queue add time |
| Job processing | <2s | End-to-end sync |
| Conflict resolution | <50ms | Version check + resolution |
| Retry success rate | >95% | Second attempt success |
| Queue depth | <100 | Pending jobs |
| Failed job rate | <0.1% | Jobs entering failed state |

## Migration Path

| Phase | Timeline | Actions |
|-------|----------|---------|
| Phase 1 | Week 1 | Implement version tracking |
| Phase 2 | Week 2 | Add queue infrastructure |
| Phase 3 | Week 3 | Implement conflict resolver |
| Phase 4 | Week 4 | Migrate handlers to queue-based |

## Related Decisions

- ADR-001: Discord Gateway Architecture
- ADR-002: Multi-Provider PM Integration
- SOTA-RESEARCH.md: Real-Time Synchronization Strategies section

## References

1. [Bull Queue Documentation](https://github.com/OptimalBits/bull/blob/master/PATTERNS.md)
2. [Eventual Consistency - Werner Vogels](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html)
3. [Conflict Resolution Strategies](https://www.microsoft.com/en-us/research/publication/conflict-resolution-in-collaborative-systems/)
4. [Idempotency Keys - Stripe](https://stripe.com/docs/api/idempotent_requests)

---

*This ADR establishes the bidirectional synchronization engine that ensures data consistency across Discord and external issue tracking systems.*
