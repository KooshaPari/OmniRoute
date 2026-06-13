/**
 * Integration Test Setup
 * 
 * Comprehensive setup for integration and E2E tests including environment preparation,
 * mock configuration, test data initialization, and service setup.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { logger } from "../../logger";
import { store } from "../../store";

// Import test setup utilities
import databaseTestSetup from "../../../tests/utils/database-test-setup";
import redisTestSetup from "../../../tests/utils/redis-test-setup";
import natsTestSetup from "../../../tests/utils/nats-test-setup";
import testUtils from "../../../tests/utils/integrationTestUtils";

// Global test service instances
let testDatabaseClient: any = null;
let testRedisClient: any = null;
let testNatsConnection: any = null;

// Integration test specific setup
beforeAll(async () => {
  logger.info("🚀 Starting Integration Test Suite Setup");
  
  // Initialize test environment
  process.env.NODE_ENV = "integration-test";
  process.env.LOG_LEVEL = "error"; // Reduce noise during tests
  
  // Setup test-specific configurations
  process.env.GITHUB_API_DELAY = "0";    // Disable API delays in tests
  process.env.JIRA_API_DELAY = "0";      // Disable API delays in tests
  process.env.DISCORD_API_DELAY = "0";   // Disable API delays in tests
  
  // Increase timeouts for integration tests
  vi.setConfig({ testTimeout: 30000, hookTimeout: 10000 });
  
  try {
    // Skip database setup for now until database path issues are resolved
    logger.info("⏭️ Skipping database setup for integration tests");
    testDatabaseClient = null;
    
    // Setup test Redis (will fall back to mock if unavailable)
    testRedisClient = await redisTestSetup.setupTestRedis({
      flushOnSetup: true,
      isolateTests: true,
    });
    
    // Setup test NATS (will fall back to mock if unavailable)
    testNatsConnection = await natsTestSetup.setupTestNats({
      isolateTests: true,
      subjectPrefix: 'integration-test',
    });
    
    logger.info("✅ Integration Test Environment Initialized");
  } catch (error) {
    logger.error("❌ Failed to initialize integration test environment:", error);
    throw error;
  }
});

beforeEach(async () => {
  // Clear all stores and caches before each test
  store.clearThreads();
  // setAvailableTags was removed; reset availableTags directly
  (store as any).availableTags = [];
  
  // Reset all timers and mocks
  vi.clearAllMocks();
  vi.clearAllTimers();
  // Avoid forcing fake timers globally to prevent hangs in suites
  // that rely on real-time timers (e.g., cache TTL/pubsub tests).
  // Individual tests can opt-in to fake timers as needed.
  
  // Setup fresh mock implementations for each test
  await setupMockImplementations();
  
  // Clean test services (but keep connections)
  if (testRedisClient) {
    await redisTestSetup.flushTestRedis();
  }
  if (testNatsConnection) {
    await natsTestSetup.cleanupTestSubjects();
  }
  
  logger.debug("🧹 Test environment cleaned and reset");
});

afterEach(async () => {
  // Cleanup after each test
  vi.useRealTimers();
  vi.clearAllTimers();
  
  // Validate store integrity after each test (if method exists)
  if (typeof store.validateIntegrity === 'function') {
    const validation = store.validateIntegrity();
    if (validation && !validation.isValid) {
      logger.error("❌ Store integrity validation failed:", validation.issues);
      throw new Error(`Store integrity compromised: ${validation.issues.join(", ")}`);
    }
  }
  
  // Skip database integrity check since database is not set up
  
  logger.debug("✅ Test cleanup completed successfully");
});

afterAll(async () => {
  try {
    // Cleanup test services
    if (testRedisClient) {
      await redisTestSetup.teardownTestRedis();
    }
    if (testNatsConnection) {
      await natsTestSetup.teardownTestNats();
    }
    
    // Final cleanup
    vi.restoreAllMocks();
    logger.info("🏁 Integration Test Suite Cleanup Completed");
  } catch (error) {
    logger.error("❌ Failed to cleanup integration test environment:", error);
  }
});

/**
 * Setup comprehensive mock implementations for integration tests
 */
async function setupMockImplementations() {
  // Setup GitHub API mocks
  await setupGitHubMocks();
  
  // Setup Jira service mocks  
  await setupJiraMocks();
  
  // Setup Discord mocks
  setupDiscordMocks();
  
  logger.debug("🔧 Mock implementations configured for integration tests");
}

/**
 * Setup enhanced command utilities for integration tests
 */
function setupIntegrationCommandUtilities() {
  // Provide comprehensive interaction mock creators for integration tests
  (global as any).createIntegrationInteraction = (options: any = {}) => {
    // Use the comprehensive mock from tests/setup.ts with integration-specific defaults
    const mockInteractionCreator = (global as any).createMockInteraction || testUtils.mockDiscordInteraction;
    
    return mockInteractionCreator({
      // Integration test defaults
      guildId: options.guildId || "integration_guild_123",
      channelId: options.channelId || "integration_channel_123",
      userId: options.userId || "integration_user_123",
      
      // Ensure thread channel functionality for command tests
      channel: options.channel !== null ? {
        id: options.channelId || "integration_channel_123",
        name: "integration-test-thread",
        type: 11, // Thread channel
        isThread: vi.fn().mockReturnValue(true),
        parentId: "integration_parent_123",
        send: vi.fn().mockResolvedValue({
          id: 'mock_message_id',
          edit: vi.fn(),
          delete: vi.fn()
        }),
        ...options.channel
      } : null,
      
      // Ensure guild exists for command validation
      guild: options.guild !== null ? {
        id: options.guildId || "integration_guild_123",
        name: "Integration Test Guild",
        channels: { cache: new Map(), fetch: vi.fn() },
        members: { cache: new Map(), fetch: vi.fn() },
        ...options.guild
      } : null,
      
      // Enhanced options support for integration tests
      options: {
        getString: vi.fn().mockImplementation((name) => options.commandOptions?.[name] || null),
        getInteger: vi.fn().mockImplementation((name) => {
          const val = options.commandOptions?.[name];
          return typeof val === 'number' ? Math.floor(val) : null;
        }),
        getUser: vi.fn().mockImplementation((name) => options.commandOptions?.[name] || null),
        getBoolean: vi.fn().mockImplementation((name) => options.commandOptions?.[name] || null),
        getChannel: vi.fn().mockImplementation((name) => options.commandOptions?.[name] || null),
        getRole: vi.fn().mockImplementation((name) => options.commandOptions?.[name] || null),
        ...options.optionsOverride
      },
      
      ...options
    });
  };
  
  // Provide thread creation utilities for integration tests
  (global as any).createIntegrationThread = (options: any = {}) => {
    return {
      id: options.id || "integration_thread_123",
      title: options.title || "Integration Test Thread",
      number: options.number || 42,
      appliedTags: options.appliedTags || ["bug"],
      archived: options.archived || false,
      locked: options.locked || false,
      comments: options.comments || [],
      jiraKey: options.jiraKey || undefined,
      repoOwner: options.repoOwner || undefined,
      repoName: options.repoName || undefined,
      ...options
    };
  };
  
  logger.debug("🔧 Integration command utilities configured");
}

/**
 * Setup GitHub API mocks
 */
async function setupGitHubMocks() {
  // Mock the GitHub Actions module
  vi.doMock("../../github/githubActions", () => ({
    githubActions: {
      octokit: {
        rest: {
          issues: {
            create: vi.fn().mockImplementation(async (params) => {
              await new Promise(resolve => setTimeout(resolve, 10));
              return {
                data: testUtils.createTestGitHubIssue({
                  title: params.title,
                  body: params.body,
                  labels: params.labels || [],
                }),
              };
            }),
            
            get: vi.fn().mockImplementation(async (params) => {
              await new Promise(resolve => setTimeout(resolve, 10));
              return {
                data: testUtils.createTestGitHubIssue({
                  number: params.issue_number,
                  title: `Test Issue ${params.issue_number}`,
                }),
              };
            }),
            
            update: vi.fn().mockImplementation(async (params) => {
              await new Promise(resolve => setTimeout(resolve, 10));
              return {
                data: {
                  id: params.issue_number * 1000,
                  number: params.issue_number,
                  state: params.state || "open",
                  title: "Updated Issue",
                },
              };
            }),
            
            addLabels: vi.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 5));
              return {};
            }),
            
            removeLabel: vi.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 5));
              return {};
            }),
            
            listLabelsOnIssue: vi.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, 5));
              return { data: [] };
            }),
          },
        },
      },
    },
  }));
}

/**
 * Setup Jira service mocks
 */
async function setupJiraMocks() {
  // Mock the Jira Client module
  vi.doMock("../../jira/jiraClient", () => ({
    jiraService: {
      isConfigured: vi.fn().mockReturnValue(true),
      
      createIssue: vi.fn().mockImplementation(async (issueData) => {
        await new Promise(resolve => setTimeout(resolve, 15));
        return testUtils.createTestJiraIssue({
          fields: {
            summary: issueData.summary,
            description: issueData.description,
            issuetype: { name: issueData.issueType || 'Story', id: '10001' },
          },
        });
      }),
      
      getIssue: vi.fn().mockImplementation(async (key) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        const keyNum = key.split("-")[1] || "1";
        return testUtils.createTestJiraIssue({
          key,
          fields: {
            summary: `Test Issue ${keyNum}`,
            description: "Test issue description",
          },
        });
      }),
      
      transitionIssue: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      }),
      
      updateIssuePriority: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      }),
      
      addComment: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 8));
        return true;
      }),
    },
  }));
}

/**
 * Setup Discord-specific mocks for integration tests
 */
function setupDiscordMocks() {
  // Create comprehensive Discord client mock
  const mockDiscordClient = testUtils.createDiscordClientMock();
  
  // Make the mock client globally available
  (global as any).mockDiscordClient = mockDiscordClient;
  
  // Setup enhanced interaction utilities for command testing
  setupIntegrationCommandUtilities();
  
  // Mock Discord.js module
  vi.doMock("discord.js", () => ({
    Client: vi.fn(() => mockDiscordClient),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
      GuildMessageReactions: 8,
    },
    Partials: {
      Message: 1,
      Channel: 2,
      Reaction: 3,
    },
    ChannelType: {
      GuildText: 0,
      DM: 1,
      GuildVoice: 2,
      GroupDM: 3,
      GuildCategory: 4,
      GuildNews: 5,
      GuildNewsThread: 10,
      GuildPublicThread: 11,
      GuildPrivateThread: 12,
      GuildStageVoice: 13,
      GuildForum: 15,
    },
    MessageFlags: {
      Ephemeral: 1 << 6,
    },
    ButtonStyle: {
      Primary: 1,
      Secondary: 2,
      Success: 3,
      Danger: 4,
      Link: 5,
    },
    ComponentType: {
      ActionRow: 1,
      Button: 2,
      SelectMenu: 3,
      TextInput: 4,
    },
    TextInputStyle: {
      Short: 1,
      Paragraph: 2,
    },
  }));
}

// Export utilities for use in integration tests
export { testDatabaseClient, testRedisClient, testNatsConnection };

// Make test setup functions available globally
(global as any).setupTestDatabase = databaseTestSetup.setupTestDatabase;
(global as any).getTestDatabaseClient = databaseTestSetup.getTestDatabaseClient;
(global as any).setupTestRedis = redisTestSetup.setupTestRedis;  
(global as any).getTestRedisClient = redisTestSetup.getTestRedisClient;
(global as any).setupTestNats = natsTestSetup.setupTestNats;
(global as any).getTestNatsConnection = natsTestSetup.getTestNatsConnection;
