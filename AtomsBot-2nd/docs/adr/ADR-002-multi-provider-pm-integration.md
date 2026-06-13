# ADR-002: Multi-Provider Project Management Integration

**Date**: 2026-04-04  
**Status**: Accepted  
**Deciders**: KooshaPari  

## Context

AtomsBot must support multiple project management backends to accommodate different team workflows. GitHub Issues serves as the primary source of truth, but teams may also use Jira, Linear, or GitHub Projects for advanced project management features.

### Problem Statement

We need to design an architecture that:
1. Supports multiple PM providers (Jira, Linear, GitHub Projects)
2. Maintains data consistency across providers
3. Provides unified interface for Discord commands
4. Handles provider-specific features gracefully
5. Enables provider switching without code changes

### Decision Drivers

| Driver | Weight | Description |
|--------|--------|-------------|
| Flexibility | Critical | Support multiple providers simultaneously |
| Consistency | Critical | Data sync across providers |
| Simplicity | High | Unified API for Discord layer |
| Performance | High | <2s response for all providers |
| Extensibility | Medium | Easy to add new providers |

## Options Considered

### Option A: Abstracted Service Interface (Selected)

**Architecture**:
```
Discord Commands ──▶ PMService ──▶ Provider Adapter ──▶ External API
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │  Jira  │  │ Linear │  │  GitHub│
         │Adapter │  │Adapter │  │Projects│
         │        │  │        │  │Adapter │
         └────────┘  └────────┘  └────────┘
```

**Interface Design**:
```typescript
// Unified PM service interface
interface PMService {
  // Issue CRUD
  createIssue(input: CreateIssueInput): Promise<CreateIssueResult>;
  getIssue(id: string): Promise<Issue | null>;
  updateIssue(id: string, input: UpdateIssueInput): Promise<Issue>;
  deleteIssue(id: string): Promise<void>;
  
  // Comments
  addComment(issueId: string, content: string): Promise<Comment>;
  getComments(issueId: string): Promise<Comment[]>;
  
  // Assignment
  assign(issueId: string, userId: string): Promise<void>;
  unassign(issueId: string, userId?: string): Promise<void>;
  
  // Status/Workflow
  transition(issueId: string, state: string): Promise<void>;
  getAvailableTransitions(issueId: string): Promise<Transition[]>;
  
  // Provider metadata
  getProvider(): PMProvider;
  isConfigured(): boolean;
}

// Provider-specific inputs normalized
type CreateIssueInput = {
  title: string;
  description?: string;
  priority?: Priority;
  assignee?: string;
  labels?: string[];
  // Provider-specific in metadata
  metadata?: {
    jiraIssueType?: string;
    linearTeamId?: string;
    projectColumn?: string;
  };
};
```

**Pros**:
- **Unified API**: Single interface for all Discord commands
- **Testability**: Easy to mock for testing
- **Extensibility**: New providers implement interface
- **Type Safety**: Full TypeScript coverage
- **Flexibility**: Runtime provider selection

**Cons**:
- **Complexity**: Adapter layer adds abstraction
- **Feature Loss**: Common denominator limits provider features
- **Maintenance**: Multiple adapters to maintain

### Option B: Direct API Calls

**Architecture**:
```
Discord Commands ──▶ Direct GitHub/Jira/Linear API calls
```

**Pros**:
- **Simplicity**: No abstraction layer
- **Full Features**: Access all provider capabilities
- **Performance**: No adapter overhead

**Cons**:
- **Duplication**: Same logic repeated for each provider
- **Inconsistency**: Commands behave differently per provider
- **Testing**: Hard to test without real APIs
- **Coupling**: Discord commands tied to specific APIs

**Verdict**: Rejected due to code duplication and maintenance burden.

### Option C: GraphQL Federation

**Architecture**:
```
Discord Commands ──▶ Gateway ──▶ Federated GraphQL ──▶ Provider APIs
```

**Pros**:
- **Unified Schema**: Single GraphQL interface
- **Flexibility**: Clients request specific fields
- **Modern**: GraphQL best practices

**Cons**:
- **Complexity**: Federation adds significant overhead
- **Performance**: Multiple round-trips for mutations
- **Learning Curve**: Team must learn GraphQL patterns
- **Overkill**: Too complex for current needs

**Verdict**: Rejected as premature optimization; may reconsider at scale.

### Option D: Provider-Specific Bots

**Architecture**:
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  GitHubBot  │  │   JiraBot   │  │  LinearBot  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
               ┌─────────────┐
               │  Discord    │
               │  (multiple) │
               └─────────────┘
```

**Pros**:
- **Isolation**: Each bot optimized for provider
- **Simplicity**: No cross-provider complexity

**Cons**:
- **Fragmentation**: Users interact with multiple bots
- **Duplication**: Common code across bots
- **Confusion**: Which bot for which command?

**Verdict**: Rejected due to poor user experience.

## Decision

**Adopt Option A: Abstracted Service Interface with Provider Adapters**

### Rationale

1. **Unified Experience**: Single bot handles all providers seamlessly
2. **Code Reuse**: Common logic (caching, retry, logging) in base adapter
3. **Testability**: Interface enables comprehensive mocking
4. **Extensibility**: New providers implement interface, no Discord changes
5. **Type Safety**: Full TypeScript coverage prevents runtime errors

### Provider Configuration

```typescript
// Provider configuration via environment
interface PMConfig {
  provider: 'jira' | 'linear' | 'github_projects' | 'multi';
  syncTargets: {
    jira: boolean;
    linear: boolean;
    githubProjects: boolean;
  };
  // Provider-specific settings
  jira?: {
    host: string;
    email: string;
    token: string;
    projectKey: string;
  };
  linear?: {
    apiKey: string;
    teamId?: string;
  };
  githubProjects?: {
    org: string;
    projectNumber: number;
  };
}

// Runtime provider selection
class PMServiceFactory {
  create(config: PMConfig): PMService {
    switch (config.provider) {
      case 'jira':
        return new JiraService(config.jira!);
      case 'linear':
        return new LinearService(config.linear!);
      case 'github_projects':
        return new GitHubProjectsService(config.githubProjects!);
      case 'multi':
        return new MultiProviderService(config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
```

## Implementation Details

### Adapter Pattern

```typescript
// Base adapter with common functionality
abstract class BasePMAdapter implements PMService {
  protected cache: CacheManager;
  protected logger: Logger;
  protected metrics: MetricsCollector;
  
  constructor(config: AdapterConfig) {
    this.cache = new CacheManager(config.cacheTtl);
    this.logger = config.logger;
    this.metrics = config.metrics;
  }
  
  // Common retry logic
  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const start = Date.now();
        const result = await operation();
        this.metrics.recordLatency(context, Date.now() - start);
        return result;
      } catch (error) {
        this.logger.warn(`${context} failed (attempt ${attempt})`, error);
        if (attempt === 3) throw error;
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    }
    throw new Error('Unreachable');
  }
  
  // Common caching
  protected async getCached<T>(
    key: string,
    fetch: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached) return cached;
    
    const value = await fetch();
    await this.cache.set(key, value, ttl);
    return value;
  }
  
  // Abstract methods implemented by providers
  abstract createIssue(input: CreateIssueInput): Promise<CreateIssueResult>;
  abstract getIssue(id: string): Promise<Issue | null>;
  abstract updateIssue(id: string, input: UpdateIssueInput): Promise<Issue>;
  abstract assign(issueId: string, userId: string): Promise<void>;
  abstract transition(issueId: string, state: string): Promise<void>;
  abstract getProvider(): PMProvider;
  abstract isConfigured(): boolean;
}
```

### Jira Adapter

```typescript
class JiraAdapter extends BasePMAdapter {
  private client: JiraClient;
  private projectKey: string;
  
  constructor(config: JiraConfig) {
    super(config);
    this.client = new JiraClient(config);
    this.projectKey = config.projectKey;
  }
  
  async createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    return this.withRetry(async () => {
      const jiraIssue = await this.client.createIssue({
        project: { key: this.projectKey },
        summary: input.title,
        description: this.toAtlassianDoc(input.description),
        issuetype: { name: input.metadata?.jiraIssueType || 'Task' },
        priority: input.priority ? { name: this.mapPriority(input.priority) } : undefined,
        assignee: input.assignee ? { accountId: input.assignee } : undefined,
        labels: input.labels,
      });
      
      return {
        id: jiraIssue.id,
        key: jiraIssue.key,
        url: `https://${this.client.host}/browse/${jiraIssue.key}`,
        provider: 'jira',
      };
    }, 'jira.createIssue');
  }
  
  async transition(issueId: string, state: string): Promise<void> {
    return this.withRetry(async () => {
      const transitions = await this.client.getTransitions(issueId);
      const transition = transitions.find(t => 
        t.name.toLowerCase() === state.toLowerCase()
      );
      
      if (!transition) {
        throw new Error(`Invalid transition: ${state}`);
      }
      
      await this.client.transitionIssue(issueId, transition.id);
    }, 'jira.transition');
  }
  
  private toAtlassianDoc(markdown: string): object {
    // Convert markdown to Atlassian Document Format
    return {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: markdown }],
      }],
    };
  }
  
  getProvider(): PMProvider { return 'jira'; }
  isConfigured(): boolean { return !!this.client; }
}
```

### Linear Adapter

```typescript
class LinearAdapter extends BasePMAdapter {
  private client: LinearClient;
  private teamId: string;
  
  constructor(config: LinearConfig) {
    super(config);
    this.client = new LinearClient(config.apiKey);
    this.teamId = config.teamId || '';
  }
  
  async createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    return this.withRetry(async () => {
      const { data } = await this.client.issueCreate({
        title: input.title,
        description: input.description,
        priority: this.mapPriority(input.priority),
        assigneeId: input.assignee,
        teamId: this.teamId,
        labelIds: input.labels,
      });
      
      return {
        id: data.issueCreate.issue.id,
        key: data.issueCreate.issue.identifier,
        url: data.issueCreate.issue.url,
        provider: 'linear',
      };
    }, 'linear.createIssue');
  }
  
  async transition(issueId: string, state: string): Promise<void> {
    return this.withRetry(async () => {
      // Linear uses state IDs, need to lookup
      const states = await this.client.workflowStates({
        filter: { team: { id: { eq: this.teamId } } },
      });
      
      const targetState = states.nodes.find(s => 
        s.name.toLowerCase() === state.toLowerCase()
      );
      
      if (!targetState) {
        throw new Error(`Invalid state: ${state}`);
      }
      
      await this.client.issueUpdate(issueId, {
        stateId: targetState.id,
      });
    }, 'linear.transition');
  }
  
  getProvider(): PMProvider { return 'linear'; }
  isConfigured(): boolean { return !!this.client; }
}
```

### GitHub Projects Adapter

```typescript
class GitHubProjectsAdapter extends BasePMAdapter {
  private octokit: Octokit;
  private projectId: string;
  private statusFieldId: string;
  private statusOptions: Map<string, string>;
  
  constructor(config: GitHubProjectsConfig) {
    super(config);
    this.octokit = new Octokit({ auth: config.token });
    this.projectId = config.projectId;
    this.statusFieldId = config.statusFieldId;
    this.statusOptions = new Map(config.statusOptions);
  }
  
  async createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    return this.withRetry(async () => {
      // Create GitHub issue first
      const { data: issue } = await this.octokit.rest.issues.create({
        owner: input.metadata!.owner,
        repo: input.metadata!.repo,
        title: input.title,
        body: input.description,
        labels: input.labels,
        assignees: input.assignee ? [input.assignee] : undefined,
      });
      
      // Add to project
      await this.addIssueToProject(issue.node_id);
      
      return {
        id: issue.node_id,
        key: `#${issue.number}`,
        url: issue.html_url,
        provider: 'github_projects',
      };
    }, 'github_projects.createIssue');
  }
  
  async transition(issueId: string, state: string): Promise<void> {
    return this.withRetry(async () => {
      const optionId = this.statusOptions.get(state.toLowerCase());
      if (!optionId) {
        throw new Error(`Invalid status: ${state}`);
      }
      
      await this.octokit.graphql(UPDATE_PROJECT_ITEM_STATUS, {
        projectId: this.projectId,
        itemId: issueId,
        fieldId: this.statusFieldId,
        optionId,
      });
    }, 'github_projects.transition');
  }
  
  private async addIssueToProject(issueNodeId: string): Promise<void> {
    await this.octokit.graphql(ADD_PROJECT_ITEM, {
      projectId: this.projectId,
      contentId: issueNodeId,
    });
  }
  
  getProvider(): PMProvider { return 'github_projects'; }
  isConfigured(): boolean { return !!this.octokit; }
}
```

## Consequences

### Positive

1. **Unified Interface**: Single API for all Discord commands
2. **Type Safety**: Full TypeScript coverage
3. **Testability**: Easy to mock and test
4. **Extensibility**: New providers implement interface
5. **Maintainability**: Common logic in base adapter

### Negative

1. **Feature Limitations**: Lowest common denominator
2. **Mapping Complexity**: State/priority mapping between providers
3. **Configuration**: Complex provider-specific configs
4. **Debugging**: Abstracted layer complicates tracing

### Mitigations

| Concern | Mitigation |
|---------|------------|
| Feature limits | Provider-specific metadata in inputs |
| Mapping complexity | Explicit mapping tables with validation |
| Configuration | Zod schemas with detailed error messages |
| Debugging | Structured logging with provider context |

## Provider Mapping

### Priority Mapping

| Priority | GitHub | Jira | Linear | GitHub Projects |
|----------|--------|------|--------|-----------------|
| Critical | critical | Critical | 1 (Urgent) | Custom field |
| High | high | High | 2 | Custom field |
| Medium | medium | Medium | 3 | Custom field |
| Low | low | Low | 4 | Custom field |

### Status Mapping

| Status | GitHub | Jira | Linear | GitHub Projects |
|--------|--------|------|--------|-----------------|
| Open | open | To Do | Backlog | Todo |
| In Progress | (label) | In Progress | In Progress | In Progress |
| Review | (label) | In Review | In Review | Review |
| Done | closed | Done | Done | Done |

## Migration Path

| Phase | Timeline | Actions |
|-------|----------|---------|
| Phase 1 | Week 1 | Implement base adapter + GitHub adapter |
| Phase 2 | Week 2 | Add Jira adapter with full features |
| Phase 3 | Week 3 | Add Linear adapter |
| Phase 4 | Week 4 | Add GitHub Projects + multi-provider mode |

## Related Decisions

- ADR-001: Discord Gateway Architecture
- ADR-003: Bidirectional Sync Engine
- SOTA-RESEARCH.md: PM Provider Ecosystem section

## References

1. [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
2. [Linear GraphQL API](https://developers.linear.com/docs/graphql/)
3. [GitHub Projects GraphQL](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project-with-the-graphql-api)
4. [Adapter Pattern - Martin Fowler](https://martinfowler.com/bliki/Adapter.html)

---

*This ADR establishes the multi-provider architecture enabling AtomsBot to support diverse team workflows across Jira, Linear, and GitHub Projects.*
