# AtomsBot — SPEC.md

## Overview

AtomsBot is a Discord-to-GitHub integration bot that bridges Discord forum channels with GitHub repository issues. It enables bidirectional synchronization of issues, comments, labels, and status updates, with support for multiple PM providers (Jira, Linear, GitHub Projects).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AtomsBot                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Discord Interface                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │  │
│  │  │   Gateway   │  │  Commands   │  │  Event Handlers  │ │  │
│  │  │   (WS)      │  │  (Slash)    │  │                  │ │  │
│  │  │             │  │ • /bug      │  │ • Post create    │ │  │
│  │  │             │  │ • /feature  │  │ • Comment add    │ │  │
│  │  │             │  │ • /assign   │  │ • Tag change     │ │  │
│  │  │             │  │ • /status   │  │ • Lock/unlock    │ │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴──────────────────────────────┐  │
│  │                   Core Services                           │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │  │
│  │  │  Sync      │ │  Thread   │ │  Smart     │           │  │
│  │  │  Engine    │ │  Manager  │ │  Embeds    │           │  │
│  │  │            │ │            │ │            │           │  │
│  │  │ • Queue    │ │ • Forum   │ │ • Auto     │           │  │
│  │  │ • Retry    │ │ • Mapping │ │ • refresh  │           │  │
│  │  │ • Batch    │ │ • State   │ │ • Dynamic  │           │  │
│  │  └────────────┘ └────────────┘ └────────────┘           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴──────────────────────────────┐  │
│  │              Provider Adapters (PM Layer)                 │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐ │  │
│  │  │   GitHub   │ │    Jira    │ │      Linear        │ │  │
│  │  │   REST     │ │    REST    │ │     GraphQL        │ │  │
│  │  │  GraphQL   │ │            │ │                    │ │  │
│  │  └────────────┘ └────────────┘ └────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴──────────────────────────────┐  │
│  │                  Data & Infrastructure                    │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │  │
│  │  │  Prisma/   │ │   Redis    │ │   NATS     │           │  │
│  │  │  SQLite    │ │   (Cache)  │ │   (Events) │           │  │
│  │  └────────────┘ └────────────┘ └────────────┘           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### Discord Layer

| Component | Responsibility | Key Features |
|-----------|----------------|--------------|
| `BotClient` | Gateway connection | Intents: GUILDS, GUILD_MESSAGES |
| `CommandRegistry` | Slash command routing | Dynamic command deployment |
| `ForumWatcher` | Forum channel monitoring | Post lifecycle events |
| `ModalHandler` | Form interactions | Bug report, feature modals |

### Sync Engine

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| `SyncQueue` | Ordered processing | Bull-like queue with retry |
| `ConflictResolver` | Bidirectional sync | Last-write-wins with merge |
| `WebhookHandler` | GitHub webhooks | HMAC validation, event routing |

### Smart Embeds

| Feature | Description |
|---------|-------------|
| Auto-refresh | Periodic update of dynamic fields |
| Status badges | Real-time GitHub/Jira status |
| Action buttons | Quick actions (close, assign) |
| Rich metadata | Labels, milestones, assignees |

---

## Data Models

### Forum Mapping

```typescript
interface ForumMapping {
  id: string;
  forumId: string;          // Discord channel ID
  forumIdLogical: string;   // User-defined (e.g., "backend-ai-features")
  guildId: string;
  provider: 'github' | 'jira' | 'linear' | 'github_projects';
  teamConfig: TeamConfig;
  createdAt: Date;
}

interface TeamConfig {
  teamId: string;
  teamName: string;
  githubRepo?: string;
  jiraProject?: string;
  linearTeam?: string;
  githubProjectId?: string;
}
```

### Issue Sync State

```typescript
interface IssueSync {
  id: string;
  discordThreadId: string;
  discordPostId: string;
  externalIssueId: string;    // GitHub/Jira/Linear ID
  provider: string;
  status: 'open' | 'closed' | 'locked';
  lastSyncedAt: Date;
  syncVersion: number;
}

interface CommentSync {
  id: string;
  issueSyncId: string;
  discordMessageId: string;
  externalCommentId: string;
  author: {
    discordUserId?: string;
    externalUsername: string;
  };
  createdAt: Date;
}
```

### PM Provider Config

```typescript
interface ProviderConfig {
  provider: 'jira' | 'linear' | 'github_projects' | 'multi';
  syncTargets: {
    jira: boolean;
    coda: boolean;
    atoms: boolean;
    linear: boolean;
    githubProjects: boolean;
  };
  // GitHub Projects specific
  ghProjectsProjectId?: string;
  ghProjectsStatusFieldId?: string;
  ghProjectsStatusOptionsJson?: Record<string, string>;
}
```

---

## Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js + TypeScript | Bot execution |
| Discord SDK | discord.js v14 | Gateway + REST |
| Database | Prisma + SQLite | Persistent state |
| Cache | Redis / ioredis | Session + rate limit |
| Events | NATS | Internal messaging |
| Testing | Vitest | Unit + integration |
| Hosting | Vercel | Serverless functions |

---

## API Integrations

### GitHub

| Feature | API | Notes |
|---------|-----|-------|
| Issues | REST v3 | CRUD operations |
| Comments | REST v3 | Threaded discussions |
| Labels | REST v3 | Color + name sync |
| Projects | GraphQL v4 | v2 Projects support |
| Webhooks | REST | Repo-level hooks |

### Jira

| Feature | API | Notes |
|---------|-----|-------|
| Issues | REST v3 | Create, update, transition |
| Comments | REST v3 | Issue comments |
| Groups | REST v3 | Assignee lookup |
| Sprints | REST v3 | Agile board integration |

### Linear

| Feature | API | Notes |
|---------|-----|-------|
| Issues | GraphQL | Create, update |
| Cycles | GraphQL | Sprint equivalent |
| Teams | GraphQL | Organization structure |

---

## Commands

### Slash Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `/bug-report` | Title, description, priority | Create detailed bug report |
| `/feature-request` | Title, description, priority | Submit feature request |
| `/assign` | @user | Assign issue to user |
| `/priority` | Critical/High/Medium/Low | Set issue priority |
| `/status` | Open/Closed/Lock/Unlock | Update issue status |
| `/label` | add/remove + name | Manage labels |
| `/setup` | Subcommands | Configure forums/secrets |
| `/deployments` | start [env] | Trigger deployment workflow |

### Setup Subcommands

| Subcommand | Purpose |
|------------|---------|
| `forums set` | Map logical forum IDs to channels |
| `secrets set` | Configure GitHub/Jira credentials |
| `team add` | Create/link teams with roles |
| `provider set` | Select PM provider |
| `vercel set` | Configure Vercel integration |

---

## Performance

| Metric | Target | Strategy |
|--------|--------|----------|
| Command latency | <2s | Async processing with ACK |
| Webhook processing | <500ms | Queue-based handling |
| Embed refresh | 30-300s configurable | Background job |
| Sync reliability | 99.9% | Retry with backoff |

---

## Security

| Layer | Implementation |
|-------|----------------|
| Discord | Token in env, no hardcode |
| GitHub | Fine-grained PAT |
| Jira | API token + email |
| Webhooks | HMAC signature verify |
| Database | Encrypted at rest |

---

## Project Structure

```
AtomsBot/
├── src/
│   ├── discord/              # Discord.js integration
│   │   ├── client.ts         # Bot client setup
│   │   ├── commands/         # Slash command handlers
│   │   ├── events/           # Gateway event handlers
│   │   ├── modals/           # Modal form handlers
│   │   └── components/       # Button/select handlers
│   ├── core/                 # Business logic
│   │   ├── sync/             # Sync engine
│   │   ├── providers/        # PM provider adapters
│   │   ├── forum/            # Forum management
│   │   └── embeds/           # Smart embed system
│   ├── infrastructure/       # External services
│   │   ├── database/         # Prisma client
│   │   ├── redis/            # Redis connection
│   │   └── nats/             # NATS messaging
│   └── utils/                # Utilities
├── api/                      # Vercel serverless handlers
├── prisma/                   # Database schema
├── tests/                    # Vitest tests
└── scripts/                  # Admin scripts
```

---

## References

- [discord.js Guide](https://discordjs.guide)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3)
- [Linear GraphQL API](https://developers.linear.com/docs/graphql)
