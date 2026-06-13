# Database Migration Complete - Implementation Guide

## Overview

Your Discord bot has been successfully migrated from JSON file storage to a comprehensive database-driven architecture with optional Redis caching and NATS messaging. This document outlines what was implemented and how to use the new system.

## What Was Implemented

### 1. Database Layer (✅ Complete)
- **Prisma ORM** with SQLite (easily switchable to PostgreSQL)
- **Comprehensive schema** with proper relationships and indexes
- **Repository pattern** for clean data access
- **Migration scripts** for data transfer
- **Database service** with transaction support

### 2. Caching Layer (✅ Complete)
- **Redis integration** for performance optimization
- **Intelligent caching** of frequently accessed data
- **Rate limiting** capabilities
- **Session management** for user interactions
- **Webhook deduplication** to prevent duplicate processing

### 3. Messaging Layer (✅ Complete)
- **NATS integration** for event-driven architecture
- **Event publishing/subscribing** for real-time updates
- **Request-response patterns** for synchronous communication
- **Webhook processing** with guaranteed delivery

### 4. Enhanced Store (✅ Complete)
- **Database-backed store** (`src/store-db.ts`)
- **Backward compatibility** with existing interfaces
- **Automatic caching** and event publishing
- **Graceful fallbacks** when external services are unavailable

## Architecture Benefits

### Performance Improvements
- **Database queries** instead of file I/O operations
- **Redis caching** reduces API calls to GitHub/Jira
- **Connection pooling** for efficient database usage
- **Indexed queries** for fast data retrieval

### Scalability
- **Horizontal scaling** with Redis and NATS
- **Event-driven architecture** for loose coupling
- **Microservices ready** with proper service boundaries
- **Load balancing** support with shared state

### Reliability
- **ACID transactions** prevent data corruption
- **Automatic retries** and error handling
- **Health checks** for all services
- **Graceful degradation** when services are unavailable

### Developer Experience
- **Type-safe database operations** with Prisma
- **Repository pattern** for clean architecture
- **Comprehensive logging** and monitoring
- **Easy testing** with database transactions

## Usage Guide

### Environment Variables

Add these to your `.env` file:

```env
# Database
DATABASE_URL="file:./data/bot.db"

# Redis (Optional)
REDIS_ENABLED="true"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"
REDIS_KEY_PREFIX="atomsbot:"

# NATS (Optional)
NATS_ENABLED="true"
NATS_URL="nats://localhost:4222"
NATS_USER=""
NATS_PASS=""
```

### Database Commands

```bash
# Initialize database
npm run db:init

# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Open Prisma Studio
npm run db:studio

# Reset database (development only)
npm run db:reset

# Migrate from JSON files
npm run db:migrate
```

### Using the New Store

The new database store maintains the same interface as the old store:

```typescript
import { store } from './store-db';

// Find a thread (now cached and database-backed)
const thread = await store.findThread(threadId);

// Add Jira link (automatically cached and events published)
await store.addJiraLink(threadId, jiraKey);

// Get GitHub number (cached for performance)
const githubNumber = await store.getGitHubNumber(threadId);
```

### Redis Caching

Redis is automatically used when enabled:

```typescript
import { cacheService } from './cache/redis';

// Manual caching
await cacheService.set('key', data, 300); // 5 minutes TTL
const data = await cacheService.get('key');

// Rate limiting
const { allowed, remaining } = await cacheService.checkRateLimit(
  userId, 
  'api_call', 
  100, // limit
  3600 // window in seconds
);
```

### Event Publishing

NATS events are automatically published for major actions:

```typescript
import { eventPublisher } from './messaging/nats';

// Manual event publishing
await eventPublisher.publish('github.issue.opened', {
  issueId: 123,
  threadId: 'thread_123',
  owner: 'user',
  repo: 'repo',
  number: 123,
  title: 'Issue title',
  body: 'Issue body'
});
```

## Migration Path

### Phase 1: Database Setup (✅ Complete)
1. Install dependencies: `npm install`
2. Initialize database: `npm run db:init`
3. Verify setup: Check `data/bot.db` exists

### Phase 2: Data Migration (Optional)
If you have existing JSON data:
```bash
npm run db:migrate
```

### Phase 3: Enable Caching (Optional)
1. Install Redis: `docker run -d -p 6379:6379 redis:alpine`
2. Set `REDIS_ENABLED=true` in `.env`
3. Restart application

### Phase 4: Enable Messaging (Optional)
1. Install NATS: `docker run -d -p 4222:4222 nats:alpine`
2. Set `NATS_ENABLED=true` in `.env`
3. Restart application

## Monitoring and Maintenance

### Health Checks
```typescript
import { checkDatabaseHealth } from './database/config';
import { cacheService } from './cache/redis';
import { checkNatsHealth } from './messaging/nats';

const dbHealthy = await checkDatabaseHealth();
const redisHealthy = await cacheService.healthCheck();
const natsHealthy = await checkNatsHealth();
```

### Database Statistics
```typescript
import { getDatabaseStats } from './database/config';

const stats = await getDatabaseStats();
console.log(stats); // { threads: 100, messages: 500, ... }
```

### Cache Management
```typescript
import { cleanupExpiredSessions } from './database/config';

// Cleanup expired sessions
const cleaned = await cleanupExpiredSessions();
```

## Production Deployment

### Database
- **SQLite**: Good for single-instance deployments
- **PostgreSQL**: Recommended for production/multi-instance
- **Backup**: Regular database backups recommended

### Redis
- **Persistence**: Enable RDB snapshots
- **Memory**: Monitor memory usage
- **Clustering**: Use Redis Cluster for high availability

### NATS
- **Clustering**: Use NATS clustering for reliability
- **Persistence**: Enable JetStream for message persistence
- **Monitoring**: Use NATS monitoring endpoints

## Troubleshooting

### Database Issues
```bash
# Reset database
npm run db:reset

# Check database file
ls -la data/bot.db

# View database with Prisma Studio
npm run db:studio
```

### Redis Issues
```bash
# Test Redis connection
redis-cli ping

# Check Redis logs
docker logs <redis-container>
```

### NATS Issues
```bash
# Test NATS connection
nats-cli server check

# View NATS monitoring
curl http://localhost:8222/varz
```

## Next Steps

1. **Monitor Performance**: Watch database query performance
2. **Optimize Queries**: Add indexes for slow queries
3. **Scale Services**: Add Redis/NATS clustering as needed
4. **Add Metrics**: Implement Prometheus metrics
5. **Backup Strategy**: Set up automated database backups

## Support

- Database issues: Check Prisma documentation
- Redis issues: Check Redis documentation  
- NATS issues: Check NATS documentation
- Application issues: Check application logs

The migration is complete and your bot now has a robust, scalable architecture!
