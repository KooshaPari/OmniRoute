import { vi } from 'vitest';

/**
 * Shared test setup and utilities for GitHub tests
 * This file provides common mocks, fixtures, and helper functions
 */

// Mock console methods to reduce noise during tests
export const mockConsole = () => {
  const originalConsole = global.console;
  
  global.console = {
    ...originalConsole,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  return {
    restore: () => {
      global.console = originalConsole;
    },
  };
};

// Mock process.env for tests
export const mockProcessEnv = (env: Record<string, string> = {}) => {
  const originalEnv = process.env;
  
  process.env = {
    ...originalEnv,
    GITHUB_ACCESS_TOKEN: 'test-github-token',
    GITHUB_USERNAME: 'test-owner',
    GITHUB_REPOSITORY: 'test-repo',
    DISCORD_TOKEN: 'test-discord-token',
    DISCORD_CLIENT_ID: 'test-client-id',
    DISCORD_CHANNEL_ID: 'test-channel-id',
    PORT: '3000',
    ...env,
  };

  return {
    restore: () => {
      process.env = originalEnv;
    },
  };
};

// Helper to create mock request objects
export const createMockRequest = (body: any = {}) => ({
  body,
  headers: {
    'content-type': 'application/json',
  },
  method: 'POST',
  url: '/',
});

// Helper to create mock response objects
export const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return res;
};

// Helper to wait for async operations
export const waitFor = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Helper to create mock GitHub API responses
export const createGitHubApiResponse = (data: any, status: number = 200) => ({
  data,
  status,
  headers: {},
  url: 'https://api.github.com/test',
});

// Helper to create mock Discord message
export const createMockDiscordMessage = (overrides: any = {}) => ({
  id: 'test-message-id',
  content: 'Test message content',
  author: {
    id: 'test-user-id',
    globalName: 'TestUser',
    avatar: 'test-avatar-hash',
  },
  guildId: 'test-guild-id',
  channelId: 'test-channel-id',
  attachments: new Map(),
  ...overrides,
});

// Helper to create mock thread
export const createMockThread = (overrides: any = {}) => ({
  id: 'test-thread-id',
  title: 'Test Thread',
  appliedTags: ['tag1'],
  number: 123,
  body: 'Test thread body',
  node_id: 'test-node-id',
  comments: [],
  archived: false,
  locked: false,
  repoOwner: 'test-owner',
  repoName: 'test-repo',
  ...overrides,
});

// Common error scenarios for testing
export const commonErrors = {
  networkError: new Error('Network request failed'),
  authError: new Error('Authentication failed'),
  notFoundError: new Error('Resource not found'),
  ratelimitError: new Error('Rate limit exceeded'),
  validationError: new Error('Validation failed'),
  timeoutError: new Error('Request timeout'),
};

// Mock GitHub webhook payloads
export const githubWebhookPayloads = {
  issueOpened: {
    action: 'opened',
    issue: {
      id: 1,
      node_id: 'test-node-id',
      number: 123,
      title: 'Test Issue',
      body: 'Test issue body',
      user: {
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
      },
      labels: [
        { id: 1, name: 'bug', color: 'd73a4a' },
        { id: 2, name: 'enhancement', color: 'a2eeef' },
      ],
      state: 'open',
      locked: false,
      assignee: null,
      assignees: [],
      milestone: null,
      comments: 0,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      closed_at: null,
      author_association: 'OWNER',
      active_lock_reason: null,
      draft: false,
      pull_request: null,
      body_html: '<p>Test issue body</p>',
      body_text: 'Test issue body',
      timeline_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/timeline',
      repository_url: 'https://api.github.com/repos/test-owner/test-repo',
      labels_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/labels{/name}',
      comments_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/comments',
      events_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/events',
      html_url: 'https://github.com/test-owner/test-repo/issues/123',
      url: 'https://api.github.com/repos/test-owner/test-repo/issues/123',
    },
    repository: {
      id: 1,
      node_id: 'test-repo-node-id',
      name: 'test-repo',
      full_name: 'test-owner/test-repo',
      private: false,
      owner: {
        login: 'test-owner',
        id: 67890,
        node_id: 'test-owner-node-id',
        avatar_url: 'https://avatars.githubusercontent.com/u/67890?v=4',
        gravatar_id: '',
        url: 'https://api.github.com/users/test-owner',
        html_url: 'https://github.com/test-owner',
        type: 'User',
        site_admin: false,
      },
      html_url: 'https://github.com/test-owner/test-repo',
      description: 'Test repository',
      fork: false,
      url: 'https://api.github.com/repos/test-owner/test-repo',
    },
    sender: {
      login: 'testuser',
      id: 12345,
      node_id: 'test-sender-node-id',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
      gravatar_id: '',
      url: 'https://api.github.com/users/testuser',
      html_url: 'https://github.com/testuser',
      type: 'User',
      site_admin: false,
    },
  },

  issueClosed: {
    action: 'closed',
    issue: {
      id: 1,
      node_id: 'test-node-id',
      number: 123,
      title: 'Test Issue',
      body: 'Test issue body',
      user: {
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
      },
      labels: [],
      state: 'closed',
      locked: false,
      assignee: null,
      assignees: [],
      milestone: null,
      comments: 0,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T01:00:00Z',
      closed_at: '2023-01-01T01:00:00Z',
      author_association: 'OWNER',
      active_lock_reason: null,
      draft: false,
      pull_request: null,
      body_html: '<p>Test issue body</p>',
      body_text: 'Test issue body',
      timeline_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/timeline',
      repository_url: 'https://api.github.com/repos/test-owner/test-repo',
      labels_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/labels{/name}',
      comments_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/comments',
      events_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/events',
      html_url: 'https://github.com/test-owner/test-repo/issues/123',
      url: 'https://api.github.com/repos/test-owner/test-repo/issues/123',
    },
  },

  commentCreated: {
    action: 'created',
    comment: {
      id: 456,
      node_id: 'test-comment-node-id',
      url: 'https://api.github.com/repos/test-owner/test-repo/issues/comments/456',
      html_url: 'https://github.com/test-owner/test-repo/issues/123#issuecomment-456',
      body: 'This is a test comment',
      user: {
        login: 'commenter',
        id: 78910,
        node_id: 'test-commenter-node-id',
        avatar_url: 'https://avatars.githubusercontent.com/u/78910?v=4',
        gravatar_id: '',
        url: 'https://api.github.com/users/commenter',
        html_url: 'https://github.com/commenter',
        type: 'User',
        site_admin: false,
      },
      created_at: '2023-01-01T02:00:00Z',
      updated_at: '2023-01-01T02:00:00Z',
      issue_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123',
      author_association: 'NONE',
    },
    issue: {
      id: 1,
      node_id: 'test-node-id',
      number: 123,
      title: 'Test Issue',
      user: {
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
      },
      labels: [],
      state: 'open',
      locked: false,
      assignee: null,
      assignees: [],
      milestone: null,
      comments: 1,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T02:00:00Z',
      closed_at: null,
      body: 'Test issue body',
    },
  },
};

// Mock Octokit responses
export const octokitResponses = {
  createIssue: {
    data: {
      id: 1,
      node_id: 'new-issue-node-id',
      number: 124,
      title: 'New Test Issue',
      body: 'New issue body',
      user: {
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
      },
      labels: [],
      state: 'open' as const,
      locked: false,
      assignee: null,
      assignees: [],
      milestone: null,
      comments: 0,
      created_at: '2023-01-01T03:00:00Z',
      updated_at: '2023-01-01T03:00:00Z',
      closed_at: null,
      author_association: 'OWNER',
      active_lock_reason: null,
      draft: false,
      pull_request: null,
      body_html: '<p>New issue body</p>',
      body_text: 'New issue body',
      html_url: 'https://github.com/test-owner/test-repo/issues/124',
      url: 'https://api.github.com/repos/test-owner/test-repo/issues/124',
    },
    status: 201,
    headers: {},
    url: 'https://api.github.com/repos/test-owner/test-repo/issues',
  },

  createComment: {
    data: {
      id: 789,
      node_id: 'new-comment-node-id',
      url: 'https://api.github.com/repos/test-owner/test-repo/issues/comments/789',
      html_url: 'https://github.com/test-owner/test-repo/issues/123#issuecomment-789',
      body: 'New test comment',
      user: {
        login: 'testuser',
        id: 12345,
        node_id: 'test-user-node-id',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
      },
      created_at: '2023-01-01T04:00:00Z',
      updated_at: '2023-01-01T04:00:00Z',
      issue_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123',
      author_association: 'OWNER',
    },
    status: 201,
    headers: {},
    url: 'https://api.github.com/repos/test-owner/test-repo/issues/123/comments',
  },

  listIssues: {
    data: [
      {
        id: 1,
        node_id: 'issue-1-node-id',
        number: 1,
        title: 'First Issue',
        body: 'First issue with Discord link https://discord.com/channels/123/456/msg1',
        user: {
          login: 'user1',
          id: 11111,
          avatar_url: 'https://avatars.githubusercontent.com/u/11111?v=4',
        },
        labels: [],
        state: 'open' as const,
        locked: false,
        assignee: null,
        assignees: [],
        milestone: null,
        comments: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/1',
        url: 'https://api.github.com/repos/test-owner/test-repo/issues/1',
      },
      {
        id: 2,
        node_id: 'issue-2-node-id',
        number: 2,
        title: 'Second Issue',
        body: 'Second issue with Discord link https://discord.com/channels/123/456/msg2',
        user: {
          login: 'user2',
          id: 22222,
          avatar_url: 'https://avatars.githubusercontent.com/u/22222?v=4',
        },
        labels: [],
        state: 'closed' as const,
        locked: true,
        assignee: null,
        assignees: [],
        milestone: null,
        comments: 1,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T01:00:00Z',
        closed_at: '2023-01-01T01:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/2',
        url: 'https://api.github.com/repos/test-owner/test-repo/issues/2',
      },
    ],
    status: 200,
    headers: {},
    url: 'https://api.github.com/repos/test-owner/test-repo/issues?state=all',
  },

  listComments: {
    data: [
      {
        id: 100,
        node_id: 'comment-100-node-id',
        url: 'https://api.github.com/repos/test-owner/test-repo/issues/comments/100',
        html_url: 'https://github.com/test-owner/test-repo/issues/1#issuecomment-100',
        body: 'Comment with Discord link https://discord.com/channels/123/456/msg3',
        user: {
          login: 'commenter1',
          id: 33333,
          avatar_url: 'https://avatars.githubusercontent.com/u/33333?v=4',
        },
        created_at: '2023-01-01T02:00:00Z',
        updated_at: '2023-01-01T02:00:00Z',
        issue_url: 'https://api.github.com/repos/test-owner/test-repo/issues/1',
        author_association: 'NONE',
      },
      {
        id: 101,
        node_id: 'comment-101-node-id',
        url: 'https://api.github.com/repos/test-owner/test-repo/issues/comments/101',
        html_url: 'https://github.com/test-owner/test-repo/issues/2#issuecomment-101',
        body: 'Regular comment without Discord link',
        user: {
          login: 'commenter2',
          id: 44444,
          avatar_url: 'https://avatars.githubusercontent.com/u/44444?v=4',
        },
        created_at: '2023-01-01T03:00:00Z',
        updated_at: '2023-01-01T03:00:00Z',
        issue_url: 'https://api.github.com/repos/test-owner/test-repo/issues/2',
        author_association: 'CONTRIBUTOR',
      },
    ],
    status: 200,
    headers: {},
    url: 'https://api.github.com/repos/test-owner/test-repo/issues/comments',
  },
};

// GraphQL mock responses
export const graphqlResponses = {
  deleteIssue: {
    deleteIssue: {
      clientMutationId: 'test-mutation-id',
    },
  },

  getIssueRepo: {
    node: {
      repository: {
        owner: { login: 'resolved-owner' },
        name: 'resolved-repo',
      },
    },
  },
};

// Test utilities for assertions
export const testUtils = {
  expectToHaveBeenCalledWithPartial: (spy: any, expectedCall: any) => {
    const calls = spy.mock.calls;
    const matchingCall = calls.find((call: any[]) => {
      const [actualArg] = call;
      return Object.keys(expectedCall).every(key => 
        JSON.stringify(actualArg[key]) === JSON.stringify(expectedCall[key])
      );
    });
    
    (globalThis as any).expect(matchingCall).toBeDefined();
  },

  expectConsoleToHaveBeenCalledWithContaining: (consoleSpy: any, message: string) => {
    const calls = consoleSpy.mock.calls.flat();
    const matchingCall = calls.find((call: string) => 
      typeof call === 'string' && call.includes(message)
    );
    (globalThis as any).expect(matchingCall).toBeDefined();
  },
};

// Performance testing helpers
export const performanceUtils = {
  measureAsyncOperation: async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  },

  expectOperationToBeFast: (duration: number, maxMs: number = 100) => {
    (globalThis as any).expect(duration).toBeLessThan(maxMs);
  },
};