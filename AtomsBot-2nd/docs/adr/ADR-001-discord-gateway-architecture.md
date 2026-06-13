# ADR-001: Discord Bot Gateway Architecture with Event-Driven Synchronization

**Date**: 2026-04-04  
**Status**: Accepted  
**Deciders**: KooshaPari  

## Context

AtomsBot requires real-time bidirectional synchronization between Discord forum threads and external issue tracking systems (GitHub, Jira, Linear). The architecture must handle high-frequency events from multiple sources while maintaining consistency and low latency.

### Problem Statement

We need to select the optimal architecture pattern for:
1. Discord event handling (Gateway vs REST polling)
2. Event distribution (direct handlers vs message bus)
3. Synchronization strategy (synchronous vs asynchronous)
4. State management (in-memory vs persistent)

### Decision Drivers

| Driver | Weight | Description |
|--------|--------|-------------|
| Real-time Performance | Critical | <2s end-to-end latency for user actions |
| Reliability | Critical | 99.9% sync success rate, no data loss |
| Scalability | High | Support 10K+ concurrent threads |
| Maintainability | High | Clear separation of concerns |
| Cost | Medium | Reasonable infrastructure costs |
| Complexity | Medium | Manageable for small team |

## Options Considered

### Option A: Gateway + Event Bus + Queue (Selected)

**Architecture**:
```
Discord Gateway ──▶ Event Normalizer ──▶ NATS ──▶ Queue Workers ──▶ API Clients
     │                                                    │
     └───────────▶ In-Memory Cache ◀───────────────────────┘
```

**Pros**:
- **Real-time**: Gateway provides instant event delivery (<100ms)
- **Reliable**: Queue-based processing with retry and persistence
- **Scalable**: Horizontal scaling via consumer groups
- **Observable**: Clear event flow for debugging
- **Decoupled**: Services can be updated independently

**Cons**:
- **Complexity**: More moving parts (NATS, Redis, workers)
- **Cost**: Additional infrastructure (Redis, message bus)
- **Operational**: Requires monitoring multiple services

**Implementation**:
```typescript
// Gateway event handler
client.on(Events.ThreadCreate, async (thread) => {
  await eventPublisher.publish('discord.thread.created', {
    threadId: thread.id,
    guildId: thread.guildId,
    payload: normalizeThread(thread),
  });
});

// Queue consumer
queue.process('sync', async (job) => {
  const { source, target, action, payload } = job.data;
  
  try {
    await syncEngine.execute(source, target, action, payload);
    metrics.recordSyncSuccess(source, target);
  } catch (error) {
    await handleSyncError(job, error);
    throw error; // Trigger retry
  }
});
```

### Option B: REST Polling + Direct Handlers

**Architecture**:
```
Cron ──▶ Discord REST API ──▶ Direct Handlers ──▶ GitHub API
```

**Pros**:
- **Simplicity**: No Gateway connection management
- **Cost**: Lower infrastructure requirements
- **Debugging**: Easier to trace request/response

**Cons**:
- **Latency**: 30-60 second poll intervals
- **Rate Limits**: Polling consumes API quota
- **Missed Events**: Brief disconnections lose events
- **Scale**: Doesn't handle burst traffic well

**Verdict**: Rejected due to unacceptable latency for real-time collaboration.

### Option C: Gateway + Synchronous Handlers

**Architecture**:
```
Discord Gateway ──▶ Direct Handler ──▶ GitHub API (blocking)
```

**Pros**:
- **Simplicity**: No message bus or queue
- **Latency**: Minimal overhead

**Cons**:
- **Fragility**: Handler failure crashes event processing
- **No Retry**: Failed operations require manual intervention
- **Coupling**: Discord handler directly calls GitHub API
- **Blocking**: Slow API calls block Gateway event loop

**Verdict**: Rejected due to reliability concerns and tight coupling.

### Option D: Webhook-Only (No Gateway)

**Architecture**:
```
Discord Webhooks ──▶ HTTP Server ──▶ GitHub API
```

**Pros**:
- **Simplicity**: No persistent Gateway connection
- **Serverless**: Easy deployment to Vercel/Netlify
- **Cost**: Pay-per-invocation

**Cons**:
- **Limited Events**: Only specific events support webhooks
- **No Initiation**: Cannot initiate actions from Discord
- **Stateless**: No persistent connection for real-time features

**Verdict**: Rejected due to insufficient event coverage and inability to support slash commands.

## Decision

**Adopt Option A: Gateway + Event Bus + Queue Architecture**

### Rationale

1. **Real-time Requirements**: Gateway is essential for:
   - Instant slash command responses
   - Real-time forum thread events
   - Typing indicators and presence
   - Message content parsing for auto-linking

2. **Reliability**: Queue-based processing provides:
   - Automatic retry with exponential backoff
   - Dead letter queue for failed operations
   - Persistence across restarts
   - Observability via job metrics

3. **Scalability**: Event-driven architecture enables:
   - Horizontal scaling of workers
   - Consumer groups for parallel processing
   - Backpressure handling during peak load
   - Independent service scaling

4. **Maintainability**: Clear separation:
   - Discord layer: Gateway events only
   - Sync layer: Queue consumers
   - API layer: Provider adapters
   - Each layer testable in isolation

## Implementation Details

### Technology Stack

```
Gateway:     discord.js v14 with @discordjs/ws
Event Bus:   NATS (self-hosted or managed)
Queue:       Bull with Redis
Cache:       Redis (ioredis)
Database:    SQLite with Prisma ORM
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AtomsBot Architecture                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Discord Gateway Layer                             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │   │
│  │  │   Client   │  │   Event    │  │  Command   │  │   Modal    │   │   │
│  │  │  Manager   │  │  Handlers  │  │  Handlers  │  │  Handlers  │   │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘   │   │
│  └────────┼───────────────┼───────────────┼───────────────┼──────────┘   │
│           │               │               │               │               │
│           └───────────────┴───────┬───────┴───────────────┘               │
│                                   ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Event Normalization Layer                         │   │
│  │                                                                      │   │
│  │  • Discord ThreadCreate ──▶ CreateIssueEvent                      │   │
│  │  • Discord MessageCreate ──▶ AddCommentEvent                      │   │
│  │  • GitHub Issue Opened ──▶   CreateIssueEvent                     │   │
│  │  • Jira Issue Created ──▶    CreateIssueEvent                     │   │
│  │                                                                      │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                           │
│                                ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         NATS Event Bus                               │   │
│  │                                                                      │   │
│  │  Subjects:                                                           │   │
│  │  • atomsbot.discord.*                                                │   │
│  │  • atomsbot.github.*                                                 │   │
│  │  • atomsbot.jira.*                                                   │   │
│  │  • atomsbot.sync.*                                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                           │
│              ┌─────────────────┼─────────────────┐                          │
│              ▼                 ▼                 ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │ Sync Worker  │    │ Embed Worker │    │Audit Worker  │                │
│  │              │    │              │    │              │                │
│  │ • GitHub     │    │ • Refresh    │    │ • Log        │                │
│  │ • Jira       │    │ • Update     │    │ • Metrics    │                │
│  │ • Linear     │    │ • Notify     │    │              │                │
│  └──────────────┘    └──────────────┘    └──────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gateway Configuration

```typescript
// Discord.js v14 with optimized intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,  // Required for auto-linker
    GatewayIntentBits.GuildMembers,     // For user mapping
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.ThreadMember,
  ],
  presence: {
    status: 'online',
    activities: [{ name: '/help', type: ActivityType.Listening }],
  },
  // Sharding for scale
  shards: process.env.SHARD_COUNT || 'auto',
  shardCount: parseInt(process.env.SHARD_COUNT || '1'),
});
```

### Event Normalization

```typescript
// Unified event types
interface DomainEvent {
  id: string;
  type: string;
  source: 'discord' | 'github' | 'jira' | 'linear';
  timestamp: number;
  correlationId: string;
  payload: unknown;
}

// Event normalizer
class EventNormalizer {
  fromDiscordThreadCreate(thread: ThreadChannel): DomainEvent {
    return {
      id: generateId(),
      type: 'issue.create',
      source: 'discord',
      timestamp: Date.now(),
      correlationId: thread.id,
      payload: {
        discordThreadId: thread.id,
        guildId: thread.guildId,
        channelId: thread.parentId,
        title: thread.name,
        content: thread.lastMessage?.content || '',
        authorId: thread.ownerId,
        tags: thread.appliedTags,
      },
    };
  }
  
  fromGitHubIssue(issue: GitHubIssue): DomainEvent {
    return {
      id: generateId(),
      type: 'issue.create',
      source: 'github',
      timestamp: Date.now(),
      correlationId: `github-${issue.node_id}`,
      payload: {
        githubIssueId: issue.node_id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        assignees: issue.assignees.map(a => a.login),
      },
    };
  }
}
```

## Consequences

### Positive

1. **Performance**: <500ms end-to-end latency for user actions
2. **Reliability**: 99.9% sync success rate with automatic retry
3. **Scalability**: Horizontal scaling via additional workers
4. **Observability**: Full event tracing via correlation IDs
5. **Flexibility**: Easy to add new providers (Asana, Monday, etc.)

### Negative

1. **Complexity**: More infrastructure components to manage
2. **Cost**: Redis + NATS add ~$20-50/month for small deployments
3. **Debugging**: Distributed tracing required for complex issues
4. **Learning Curve**: Team must understand event-driven patterns

### Mitigations

| Concern | Mitigation |
|---------|------------|
| Complexity | Comprehensive documentation + runbooks |
| Cost | SQLite + single-node Redis for small deployments |
| Debugging | Structured logging with correlation IDs |
| Learning | ADRs + code examples + pair programming |

## Performance Baselines

| Metric | Target | Measurement |
|--------|--------|-------------|
| Gateway latency | <50ms | WebSocket ping |
| Event publish | <10ms | NATS latency |
| Queue process | <2s | Job completion |
| End-to-end | <3s | User action to sync |
| Sync reliability | 99.9% | Job success rate |

## Migration Path

| Phase | Timeline | Actions |
|-------|----------|---------|
| Phase 1 | Week 1 | Implement Gateway + basic handlers |
| Phase 2 | Week 2 | Add NATS event bus |
| Phase 3 | Week 3 | Migrate to queue-based sync |
| Phase 4 | Week 4 | Performance testing + optimization |

## Related Decisions

- ADR-002: Multi-Provider PM Integration
- ADR-003: Bidirectional Sync Engine
- SOTA-RESEARCH.md: Discord Gateway Architecture section

## References

1. [Discord.js Gateway Documentation](https://discordjs.guide/popular-topics/intents.html)
2. [NATS Documentation](https://docs.nats.io/)
3. [Bull Queue Patterns](https://github.com/OptimalBits/bull/blob/master/PATTERNS.md)
4. [Event-Driven Architecture - Martin Fowler](https://martinfowler.com/articles/201701-event-driven.html)

---

*This ADR establishes the foundational architecture for AtomsBot's real-time synchronization capabilities.*
