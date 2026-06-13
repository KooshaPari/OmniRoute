/**
 * Test Factories
 * 
 * Factory functions for creating test data objects with realistic defaults
 * and easy customization through partial overrides.
 */

import { vi } from "vitest";
import type { Thread } from "../../src/interfaces";
import type { GuildForumTag } from "discord.js";

// Thread factory
export const createMockThread = (overrides: Partial<Thread> = {}): Thread => ({
  id: "thread_123456",
  title: "Test Thread Title",
  body: "This is a test thread body description.",
  number: 1,
  jiraKey: undefined,
  url: "https://discord.com/channels/test_guild/test_channel/thread_123456",
  appliedTags: [],
  comments: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  authorId: "user_123456",
  channelId: "channel_123456",
  guildId: "guild_123456",
  archived: false,
  locked: false,
  messageCount: 0,
  memberCount: 1,
  ...overrides,
});

// Create multiple threads
export const createMockThreads = (count: number, overrides: Partial<Thread> = {}): Thread[] => {
  return Array.from({ length: count }, (_, index) => 
    createMockThread({
      id: `thread_${123456 + index}`,
      title: `Test Thread ${index + 1}`,
      number: index + 1,
      ...overrides,
    })
  );
};

// Forum tag factory
export const createMockGuildForumTag = (overrides: Partial<GuildForumTag> = {}): GuildForumTag => ({
  id: "tag_123456",
  name: "Bug",
  moderated: false,
  emoji: { name: "🐛", id: null, animated: false },
  ...overrides,
} as GuildForumTag);

// Create multiple forum tags
export const createMockGuildForumTags = (tags: Array<{ name: string; emoji?: string }> = []): GuildForumTag[] => {
  const defaultTags = [
    { name: "Bug", emoji: "🐛" },
    { name: "Feature Request", emoji: "✨" },
    { name: "Enhancement", emoji: "🚀" },
    { name: "Question", emoji: "❓" },
    { name: "Documentation", emoji: "📚" },
  ];

  const tagsToCreate = tags.length > 0 ? tags : defaultTags;
  
  return tagsToCreate.map((tag, index) => 
    createMockGuildForumTag({
      id: `tag_${123456 + index}`,
      name: tag.name,
      emoji: tag.emoji ? { name: tag.emoji, id: null, animated: false } : null,
    })
  );
};

// Discord interaction factory
export const createMockDiscordInteraction = (type: 'command' | 'button' | 'modal' | 'select' = 'command', overrides: any = {}) => {
  const baseInteraction = {
    id: overrides.id || "interaction_123456",
    applicationId: "app_123456",
    type: type === 'command' ? 2 : type === 'button' ? 3 : type === 'modal' ? 5 : 3,
    data: overrides.data || {},
    guildId: overrides.guildId || "guild_123456",
    channelId: overrides.channelId || "channel_123456",
    user: overrides.user || {
      id: "user_123456",
      username: "testuser",
      discriminator: "0001",
      avatar: null,
      bot: false,
      tag: "testuser#0001",
    },
    member: overrides.member || {
      user: overrides.user,
      nick: null,
      avatar: null,
      roles: ["role_123456"],
      joinedAt: new Date().toISOString(),
      premiumSince: null,
      permissions: "8", // Administrator
      displayName: "Test User",
    },
    token: "interaction_token_123456",
    version: 1,
    customId: overrides.customId,
    values: overrides.values,
    components: overrides.components,
    commandName: overrides.commandName || "test",
    replied: false,
    deferred: false,
    ephemeral: false,
    locale: "en-US",
    guildLocale: "en-US",
    createdTimestamp: Date.now(),
    
    // Type checking methods
    isCommand: vi.fn().mockReturnValue(type === 'command'),
    isChatInputCommand: vi.fn().mockReturnValue(type === 'command'),
    isButton: vi.fn().mockReturnValue(type === 'button'),
    isStringSelectMenu: vi.fn().mockReturnValue(type === 'select'),
    isModalSubmit: vi.fn().mockReturnValue(type === 'modal'),
    isContextMenuCommand: vi.fn().mockReturnValue(false),
    isAutocomplete: vi.fn().mockReturnValue(false),
    isMessageComponent: vi.fn().mockReturnValue(type === 'button' || type === 'select'),
    isSelectMenu: vi.fn().mockReturnValue(type === 'select'),
    
    // Response methods
    reply: vi.fn().mockImplementation(function(this: any, options) {
      this.replied = true;
      this.ephemeral = options?.ephemeral || false;
      return Promise.resolve({ id: "message_123456" });
    }),
    followUp: vi.fn().mockResolvedValue({ id: "message_123457" }),
    update: vi.fn().mockResolvedValue({ id: "message_123456" }),
    deferReply: vi.fn().mockImplementation(function(this: any, options) {
      this.deferred = true;
      this.ephemeral = options?.ephemeral || false;
      return Promise.resolve();
    }),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue({ id: "message_123456" }),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    fetchReply: vi.fn().mockResolvedValue({ id: "message_123456" }),
    showModal: vi.fn().mockResolvedValue(undefined),
    
    // Context methods
    inGuild: vi.fn().mockReturnValue(true),
    inCachedGuild: vi.fn().mockReturnValue(true),
    inRawGuild: vi.fn().mockReturnValue(false),
    
    // Guild and channel context
    guild: overrides.guild || {
      id: "guild_123456",
      name: "Test Guild",
      ownerId: "owner_123456",
      memberCount: 100,
      channels: { cache: new Map() },
    },
    
    channel: overrides.channel || {
      id: "channel_123456",
      name: "test-channel",
      type: 0, // GuildText
      send: vi.fn().mockResolvedValue({ id: "message_123456" }),
      parent: {
        id: "category_123456",
        name: "Test Category",
      },
    },
    
    // Options for command interactions
    options: type === 'command' ? {
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
      data: [],
      resolved: {},
      ...overrides.options
    } : undefined,
    
    // Fields for modal interactions
    fields: type === 'modal' ? {
      getTextInputValue: vi.fn().mockImplementation((customId: string) => {
        return overrides.fields?.[customId] || `test_value_${customId}`;
      }),
    } : undefined,
    
    // Webhook
    webhook: {
      id: "webhook_123456",
      token: "webhook_token_123456",
      send: vi.fn().mockResolvedValue({ id: "message_123456" }),
      editMessage: vi.fn().mockResolvedValue({ id: "message_123456" }),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    },
    
    ...overrides,
  };
  
  // Special handling for fields in modal interactions to preserve the function
  if (type === 'modal' && overrides.fields) {
    baseInteraction.fields = {
      getTextInputValue: vi.fn().mockImplementation((customId: string) => {
        return overrides.fields[customId] || `test_value_${customId}`;
      }),
    };
  }
  
  return baseInteraction;
};

// GitHub webhook payload factory
export const createMockGitHubWebhook = (action: string = "opened", overrides: any = {}) => ({
  action,
  issue: {
    id: 123456789,
    number: 1,
    title: "Test GitHub Issue",
    body: "This is a test GitHub issue body.",
    html_url: "https://github.com/testuser/testrepo/issues/1",
    state: "open",
    locked: false,
    node_id: "I_test123456",
    user: {
      login: "testuser",
      id: 12345,
      avatar_url: "https://avatars.githubusercontent.com/u/12345",
      type: "User",
    },
    assignees: [],
    labels: [
      {
        id: 1,
        node_id: "L_test123",
        name: "bug",
        color: "d73a49",
        default: true,
        description: "Something isn't working",
      },
    ],
    milestone: null,
    comments: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: null,
    author_association: "OWNER",
    draft: false,
    ...overrides.issue
  },
  repository: {
    id: 123456789,
    name: "testrepo",
    full_name: "testuser/testrepo",
    owner: {
      login: "testuser",
      id: 12345,
      avatar_url: "https://avatars.githubusercontent.com/u/12345",
      type: "User",
    },
    private: false,
    html_url: "https://github.com/testuser/testrepo",
    description: "A test repository",
    ...overrides.repository
  },
  sender: {
    login: "testuser",
    id: 12345,
    type: "User",
    site_admin: false,
    ...overrides.sender
  },
  ...overrides
});

// Jira webhook payload factory
export const createMockJiraWebhook = (eventType: string = "jira:issue_created", overrides: any = {}) => ({
  timestamp: Date.now(),
  webhookEvent: eventType,
  user: {
    accountId: "user_12345",
    displayName: "Test User",
    emailAddress: "test@example.com",
    active: true,
    timeZone: "America/New_York",
    locale: "en_US",
    ...overrides.user
  },
  issue: {
    id: "10001",
    key: "TEST-1",
    self: "https://test.atlassian.net/rest/api/3/issue/10001",
    fields: {
      summary: "Test Jira Issue",
      description: "This is a test Jira issue description.",
      status: {
        id: "1",
        name: "To Do",
        statusCategory: {
          id: 2,
          key: "new",
          colorName: "blue-gray",
          name: "To Do",
        },
      },
      priority: {
        id: "3",
        name: "Medium",
        iconUrl: "https://test.atlassian.net/images/icons/priorities/medium.svg",
      },
      assignee: null,
      reporter: {
        accountId: "user_12345",
        displayName: "Test User",
        emailAddress: "test@example.com",
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      labels: [],
      components: [],
      issueType: {
        id: "10001",
        name: "Bug",
        iconUrl: "https://test.atlassian.net/images/icons/issuetypes/bug.png",
        subtask: false,
      },
      project: {
        id: "10000",
        key: "TEST",
        name: "Test Project",
      },
      ...overrides.issue?.fields
    },
    ...overrides.issue
  },
  changelog: eventType.includes("updated") ? {
    id: "10001",
    items: [
      {
        field: "status",
        fieldtype: "jira",
        fieldId: "status",
        from: "1",
        fromString: "To Do",
        to: "3",
        toString: "In Progress",
      },
    ],
    ...overrides.changelog
  } : undefined,
  ...overrides
});

// Error factory for testing error scenarios
export const createMockError = (message: string = "Test error", overrides: Partial<Error> = {}): Error => {
  const error = new Error(message);
  error.name = overrides.name || "TestError";
  error.stack = overrides.stack || `TestError: ${message}\n    at test (test.js:1:1)`;
  return Object.assign(error, overrides);
};

// Database/API response factory
export const createMockApiResponse = <T>(data: T, overrides: any = {}) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {
    "content-type": "application/json",
    ...overrides.headers
  },
  config: {
    method: "GET",
    url: "https://api.example.com/test",
    ...overrides.config
  },
  request: {},
  ...overrides
});

// Paginated response factory
export const createMockPaginatedResponse = <T>(items: T[], overrides: any = {}) => ({
  data: {
    items,
    total: items.length,
    page: 1,
    per_page: items.length,
    has_next: false,
    has_prev: false,
    ...overrides.data
  },
  status: 200,
  statusText: "OK",
  headers: {
    "content-type": "application/json",
    ...overrides.headers
  },
  ...overrides
});

// Environment variable factory for testing different configurations
export const createMockEnvironment = (overrides: Record<string, string> = {}) => ({
  NODE_ENV: "test",
  DISCORD_TOKEN: "test_discord_token",
  DISCORD_CLIENT_ID: "test_client_id",
  GITHUB_ACCESS_TOKEN: "test_github_token",
  GITHUB_USERNAME: "testuser",
  GITHUB_REPOSITORY: "testrepo",
  DISCORD_CHANNEL_ID: "channel_123456",
  JIRA_HOST: "https://test.atlassian.net",
  JIRA_EMAIL: "test@example.com",
  JIRA_API_TOKEN: "test_jira_token",
  JIRA_PROJECT_KEY: "TEST",
  DISCORD_DEV_GUILD_ID: "guild_123456",
  ...overrides
});

// Test timeout helper
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
};

// Wait for condition helper
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> => {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`waitFor condition was not met within ${timeout}ms`);
};

// Async test wrapper with error handling
export const asyncTestWrapper = <T extends any[]>(
  fn: (...args: T) => Promise<void>
) => {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (error) {
      // Ensure error is properly formatted for test output
      if (error instanceof Error) {
        error.message = `Async test failed: ${error.message}`;
      }
      throw error;
    }
  };
};

// Mock date helper for consistent timestamps in tests
export const createMockDate = (dateString?: string) => {
  const mockDate = dateString ? new Date(dateString) : new Date('2024-01-01T00:00:00.000Z');
  const originalDate = global.Date;
  
  return {
    mock: () => {
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            return mockDate;
          }
          return new originalDate(...args);
        }
        
        static now() {
          return mockDate.getTime();
        }
      } as any;
    },
    restore: () => {
      global.Date = originalDate;
    },
    date: mockDate
  };
};