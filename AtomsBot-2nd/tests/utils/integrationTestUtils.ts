/**
 * Integration Test Utilities
 * 
 * Comprehensive utilities for integration testing including mocks, test data factories,
 * and helper functions for cross-service testing scenarios.
 */

import { vi } from 'vitest';
import crypto from 'crypto';
import { Thread } from '../../src/interfaces';

/**
 * Test data factories for creating realistic test data
 */
export const testFactories = {
  /**
   * Create a realistic Discord interaction mock
   */
  mockDiscordInteraction: (type: 'command' | 'button' | 'modal' | 'select' | string = 'command', options: any = {}) => {
    // Handle legacy string-based calls
    const interactionType = typeof type === 'string' && !['command', 'button', 'modal', 'select'].includes(type) 
      ? 'command' 
      : type as 'command' | 'button' | 'modal' | 'select';
    
    const customId = typeof type === 'string' && !['command', 'button', 'modal', 'select'].includes(type) 
      ? type 
      : options.customId || 'test_interaction';

    return {
      customId,
      user: {
        id: options.userId || 'test_user_123',
        username: options.username || 'testuser',
        discriminator: '0000',
        bot: false,
      },
      guild: {
        id: options.guildId || 'test_guild_123',
      },
      channel: {
        id: options.channelId || 'test_channel_123',
        name: options.channelName || 'test-forum',
        type: 15, // Forum channel
      },
      isModalSubmit: vi.fn().mockReturnValue(interactionType === 'modal'),
      isButton: vi.fn().mockReturnValue(interactionType === 'button'),
      isSelectMenu: vi.fn().mockReturnValue(interactionType === 'select'),
      isChatInputCommand: vi.fn().mockReturnValue(interactionType === 'command'),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
      fields: {
        getTextInputValue: vi.fn(),
      },
      options: {
        getString: vi.fn().mockReturnValue(null),
        getInteger: vi.fn().mockReturnValue(null),
        getBoolean: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getMember: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(null),
        getChannel: vi.fn().mockReturnValue(null),
        getMentionable: vi.fn().mockReturnValue(null),
        getNumber: vi.fn().mockReturnValue(null),
        getSubcommand: vi.fn().mockReturnValue(null),
        getSubcommandGroup: vi.fn().mockReturnValue(null),
        get: vi.fn().mockReturnValue(null),
        ...options.options,
      },
      ...options,
    };
  },

  /**
   * Create a realistic GitHub webhook request
   */
  mockGitHubRequest: (payload: any = {}, options: any = {}) => {
    const defaultPayload = {
      action: payload.action || 'opened',
      issue: {
        id: 123456,
        number: 1,
        title: 'Test Issue',
        body: 'Test issue body',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/1',
        node_id: 'I_kwDOABC123_456',
        user: { login: 'test_user', id: 12345 },
        assignees: [],
        labels: [],
        milestone: null,
        comments: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closed_at: null,
        ...payload.issue,
      },
      repository: {
        name: 'test_repo',
        full_name: 'test_user/test_repo',
        owner: { login: 'test_user', id: 12345 },
        html_url: 'https://github.com/test_user/test_repo',
        ...payload.repository,
      },
      sender: {
        login: 'test_user',
        id: 12345,
        type: 'User',
        ...payload.sender,
      },
      ...payload,
    };

    // Generate realistic webhook signature
    const secret = options.webhookSecret || 'test_webhook_secret';
    const body = JSON.stringify(defaultPayload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return {
      body: defaultPayload,
      headers: {
        'content-type': 'application/json',
        'x-github-event': options.eventType || 'issues',
        'x-github-delivery': options.deliveryId || crypto.randomUUID(),
        'x-hub-signature-256': `sha256=${signature}`,
        'user-agent': 'GitHub-Hookshot/test',
        ...options.headers,
      },
    };
  },

  /**
   * Create a realistic Jira webhook request
   */
  mockJiraRequest: (payload: any = {}, options: any = {}) => {
    const defaultPayload = {
      webhookEvent: payload.webhookEvent || 'jira:issue_updated',
      issue: {
        id: '10001',
        key: 'TEST-1',
        fields: {
          summary: 'Test Jira Issue',
          description: 'Test Jira issue description',
          status: { name: 'To Do', id: '1' },
          priority: { name: 'Medium', id: '3' },
          assignee: null,
          reporter: { displayName: 'Test User' },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          labels: [],
          components: [],
          issuetype: { name: 'Bug', id: '10004' },
          ...payload.issue?.fields,
        },
        ...payload.issue,
      },
      changelog: payload.changelog || undefined,
      user: {
        displayName: 'Test User',
        emailAddress: 'test@example.com',
        ...payload.user,
      },
      ...payload,
    };

    return {
      body: defaultPayload,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Atlassian-Webhook/test',
        ...options.headers,
      },
    };
  },

  /**
   * Create a test thread with realistic data
   */
  createTestThread: (overrides: Partial<Thread> = {}): Thread => {
    const id = overrides.id || `thread_${crypto.randomBytes(4).toString('hex')}`;
    return {
      id,
      title: 'Test Thread',
      appliedTags: ['bug'],
      archived: false,
      locked: false,
      comments: [],
      body: 'Test thread body content',
      // createdAt/updatedAt are optional in Thread; avoid extra props in strict tests
      ...overrides,
    };
  },

  /**
   * Create test GitHub issue data
   */
  createTestGitHubIssue: (overrides: any = {}) => ({
    id: Math.floor(Math.random() * 1000000),
    number: Math.floor(Math.random() * 1000) + 1,
    title: 'Test Issue',
    body: 'Test issue description',
    state: 'open',
    html_url: 'https://github.com/test/repo/issues/1',
    node_id: `I_kwDO${Math.random().toString(36).substr(2, 9)}`,
    user: { login: 'test_user', id: 12345 },
    labels: [],
    assignees: [],
    milestone: null,
    comments: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: null,
    ...overrides,
  }),

  /**
   * Create test Jira issue data
   */
  createTestJiraIssue: (overrides: any = {}) => {
    const keyNum = Math.floor(Math.random() * 1000) + 1;
    return {
      id: `${keyNum}001`,
      key: `TEST-${keyNum}`,
      self: `https://test.atlassian.net/rest/api/3/issue/${keyNum}001`,
      fields: {
        summary: 'Test Jira Issue',
        description: 'Test Jira description',
        status: { name: 'To Do', id: '1' },
        priority: { name: 'Medium', id: '3' },
        assignee: null,
        reporter: { displayName: 'Test User' },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        labels: [],
        components: [],
        issuetype: { name: 'Bug', id: '10004' },
        ...overrides.fields,
      },
      ...overrides,
    };
  },
};

/**
 * Mock service implementations for integration tests
 */
export const mockServices = {
  /**
   * Create comprehensive Discord client mock
   */
  createDiscordClientMock: () => ({
    user: { 
      id: 'bot_test_id', 
      username: 'TestBot', 
      tag: 'TestBot#0000',
      discriminator: '0000',
    },
    guilds: { 
      cache: new Map([
        ['guild_123', { 
          id: 'guild_123', 
          name: 'Test Guild',
          channels: {
            cache: new Map(),
          },
        }]
      ]),
      fetch: vi.fn().mockResolvedValue({ 
        id: 'guild_123', 
        name: 'Test Guild',
        channels: {
          cache: new Map(),
        },
      }),
    },
    channels: { 
      cache: new Map(),
      fetch: vi.fn().mockImplementation(async (channelId) => {
        if (channelId.includes('forum')) {
          return {
            id: channelId,
            name: 'test-forum',
            type: 15, // Forum channel
            availableTags: [
              { id: 'bug_tag', name: 'bug', emoji: { name: '🐛' } },
              { id: 'feature_tag', name: 'feature-request', emoji: { name: '✨' } },
              { id: 'priority_high', name: 'priority:high', emoji: { name: '🔴' } },
            ],
            threads: {
              create: vi.fn().mockResolvedValue({
                id: `thread_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Test Thread',
                send: vi.fn().mockResolvedValue({ 
                  id: 'msg_123',
                  edit: vi.fn(),
                  delete: vi.fn(),
                }),
                setAppliedTags: vi.fn(),
                setArchived: vi.fn(),
                setLocked: vi.fn(),
                setName: vi.fn(),
              }),
            },
          };
        } else {
          return {
            id: channelId,
            name: 'test-thread',
            type: 11, // Thread channel
            isThread: () => true,
            setArchived: vi.fn(),
            setLocked: vi.fn(),
            setName: vi.fn(),
            send: vi.fn().mockResolvedValue({ 
              id: 'msg_123',
              edit: vi.fn(),
              delete: vi.fn(),
            }),
            messages: {
              fetch: vi.fn().mockResolvedValue(new Map()),
            },
          };
        }
      }),
    },
    users: { 
      cache: new Map(),
      fetch: vi.fn().mockResolvedValue({ 
        id: 'user_123', 
        username: 'testuser',
        discriminator: '0000',
      }),
    },
    login: vi.fn().mockResolvedValue('mock_token'),
    destroy: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
  }),

  /**
   * Create GitHub service mock
   */
  createGitHubServiceMock: () => ({
    octokit: {
      rest: {
        issues: {
          create: vi.fn(),
          get: vi.fn(),
          update: vi.fn(),
          addLabels: vi.fn(),
          removeLabel: vi.fn(),
          listLabelsOnIssue: vi.fn(),
          createComment: vi.fn(),
          listComments: vi.fn(),
        },
        repos: {
          get: vi.fn(),
          listLabels: vi.fn(),
        },
        pulls: {
          create: vi.fn(),
          get: vi.fn(),
          update: vi.fn(),
        },
      },
    },
  }),

  /**
   * Create Jira service mock
   */
  createJiraServiceMock: () => ({
    isConfigured: vi.fn().mockReturnValue(true),
    createIssue: vi.fn(),
    getIssue: vi.fn(),
    updateIssue: vi.fn(),
    transitionIssue: vi.fn(),
    addComment: vi.fn(),
    updateIssuePriority: vi.fn(),
    assignIssue: vi.fn(),
    getTransitions: vi.fn(),
    searchIssues: vi.fn(),
  }),
};

/**
 * Test environment utilities
 */
export const testUtils = {
  ...testFactories,
  ...mockServices,

  /**
   * Wait for asynchronous operations with optional timeout
   */
  async waitForAsync(ms: number = 50): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
    if (vi.isFakeTimers()) {
      await vi.runAllTimersAsync();
    }
  },

  /**
   * Generate random test data
   */
  randomId: () => crypto.randomBytes(8).toString('hex'),
  randomEmail: () => `test${Math.random().toString(36).substr(2, 5)}@example.com`,
  randomUsername: () => `user${Math.random().toString(36).substr(2, 5)}`,
  
  /**
   * Simulate network delays for realistic testing
   */
  async simulateNetworkDelay(min: number = 10, max: number = 100): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  },

  /**
   * Create test database connection string
   */
  getTestDatabaseUrl: (testName?: string) => {
    const dbName = testName ? testName.replace(/[^a-zA-Z0-9]/g, '_') : 'test';
    return `file:./test-data/${dbName}.db`;
  },

  /**
   * Create test Redis connection configuration
   */
  getTestRedisConfig: () => ({
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6380'), // Different port for tests
    db: parseInt(process.env.TEST_REDIS_DB || '15'), // Use DB 15 for tests
    keyPrefix: 'atomsbot:test:',
  }),

  /**
   * Create test NATS connection configuration
   */
  getTestNatsConfig: () => ({
    servers: [process.env.TEST_NATS_URL || 'nats://localhost:4223'], // Different port for tests
    maxReconnectAttempts: 3,
    reconnectTimeWait: 100,
    timeout: 1000,
  }),

  /**
   * Verify integration test results
   */
  async verifyIntegrationState(expectations: {
    threadCount?: number;
    githubCalls?: number;
    jiraCalls?: number;
    discordCalls?: number;
  }): Promise<void> {
    // This would be implemented with actual store and service call verification
    // For now, it's a placeholder that integration tests can use
    console.log('Verifying integration state:', expectations);
  },

  /**
   * Clean up test environment
   */
  async cleanupTestEnvironment(): Promise<void> {
    // Clear all timers
    if (vi.isFakeTimers()) {
      vi.useRealTimers();
    }
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset modules
    vi.resetModules();
  },
};

// Make testUtils available globally for integration tests
(global as any).testUtils = testUtils;

export default testUtils;