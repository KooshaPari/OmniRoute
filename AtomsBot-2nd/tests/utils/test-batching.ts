/**
 * Test Batching and Grouping Utilities
 * 
 * This module provides utilities for grouping related tests together to minimize
 * setup/teardown overhead and improve overall test execution performance.
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

interface TestGroupConfig {
  name: string;
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
  beforeEach?: () => Promise<void> | void;
  afterEach?: () => Promise<void> | void;
  timeout?: number;
  concurrent?: boolean;
}

interface BatchedTestSuite {
  name: string;
  tests: Array<() => void>;
  config: TestGroupConfig;
}

/**
 * Creates a batched test suite that shares setup/teardown across multiple tests
 */
export function createBatchedSuite(config: TestGroupConfig, tests: Array<() => void>) {
  describe(config.name, () => {
    let setupComplete = false;
    let setupError: Error | null = null;

    // Shared setup - runs once for the entire batch
    beforeAll(async () => {
      try {
        if (config.setup) {
          await config.setup();
        }
        setupComplete = true;
      } catch (error) {
        setupError = error as Error;
        throw error;
      }
    }, config.timeout);

    // Shared teardown - runs once after all tests in batch
    afterAll(async () => {
      if (setupComplete && config.teardown) {
        try {
          await config.teardown();
        } catch (error) {
          console.warn("Teardown error:", error);
        }
      }
    }, config.timeout);

    // Per-test setup if needed
    if (config.beforeEach) {
      beforeEach(async () => {
        if (setupError) throw setupError;
        await config.beforeEach!();
      });
    }

    // Per-test teardown if needed
    if (config.afterEach) {
      afterEach(async () => {
        if (config.afterEach) {
          await config.afterEach();
        }
      });
    }

    // Run all tests in the batch
    tests.forEach(test => test());
  });
}

/**
 * Discord-specific test batching utilities
 */
export class DiscordTestBatch {
  private static mockClient: any = null;
  private static mockGuild: any = null;
  private static mockChannel: any = null;

  static async setup() {
    // Create shared Discord mocks that persist across tests
    this.mockClient = {
      user: { id: "test_bot_id", username: "TestBot" },
      guilds: { 
        cache: new Map([["test_guild_id", { id: "test_guild_id", name: "Test Guild" }]]),
        fetch: vi.fn().mockResolvedValue({ id: "test_guild_id", name: "Test Guild" })
      },
      channels: { 
        cache: new Map([["test_channel_id", { 
          id: "test_channel_id", 
          name: "test-channel",
          url: "https://discord.com/channels/test/test_channel_id" 
        }]]),
        fetch: vi.fn().mockResolvedValue({})
      },
      users: { cache: new Map(), fetch: vi.fn().mockResolvedValue({}) },
      isReady: vi.fn().mockReturnValue(true),
      readyTimestamp: Date.now(),
    };

    this.mockGuild = this.mockClient.guilds.cache.get("test_guild_id");
    this.mockChannel = this.mockClient.channels.cache.get("test_channel_id");
  }

  static async teardown() {
    // Clean up shared mocks
    this.mockClient = null;
    this.mockGuild = null;
    this.mockChannel = null;
  }

  static getClient() {
    return this.mockClient;
  }

  static getGuild() {
    return this.mockGuild;
  }

  static getChannel() {
    return this.mockChannel;
  }
}

/**
 * GitHub API test batching utilities
 */
export class GitHubTestBatch {
  private static mockOctokit: any = null;
  private static mockGraphQL: any = null;

  static async setup() {
    const { MockOctokit } = await import("../mocks/github");
    const { graphql } = await import("../mocks/github");
    
    this.mockOctokit = new MockOctokit();
    this.mockGraphQL = graphql;
  }

  static async teardown() {
    this.mockOctokit = null;
    this.mockGraphQL = null;
  }

  static getOctokit() {
    return this.mockOctokit;
  }

  static getGraphQL() {
    return this.mockGraphQL;
  }
}

/**
 * Database test batching utilities with transaction rollback
 */
export class DatabaseTestBatch {
  private static mockDatabase: any = null;
  private static transactions: any[] = [];

  static async setup() {
    // Set up a mock database that can handle transactions
    this.mockDatabase = {
      transaction: vi.fn().mockImplementation((fn) => {
        const mockTransaction = {
          prepare: vi.fn().mockReturnValue({
            run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
            get: vi.fn().mockReturnValue(null),
            all: vi.fn().mockReturnValue([]),
          }),
          exec: vi.fn().mockReturnValue(undefined),
          rollback: vi.fn().mockReturnValue(undefined),
          commit: vi.fn().mockReturnValue(undefined),
        };
        this.transactions.push(mockTransaction);
        return fn(mockTransaction);
      }),
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
        get: vi.fn().mockReturnValue(null),
        all: vi.fn().mockReturnValue([]),
      }),
      close: vi.fn().mockReturnValue(undefined),
    };
  }

  static async teardown() {
    // Rollback all transactions
    this.transactions.forEach(tx => {
      try {
        tx.rollback();
      } catch {
        // Ignore rollback errors
      }
    });
    this.transactions = [];
    this.mockDatabase = null;
  }

  static getDatabase() {
    return this.mockDatabase;
  }
}

/**
 * Memory-optimized test grouping for large test suites
 */
export class MemoryOptimizedBatch {
  private static memoryBaseline: NodeJS.MemoryUsage | null = null;
  private static maxHeapSize = 0;

  static async setup() {
    // Force garbage collection before starting
    if (global.gc) {
      global.gc();
    }
    this.memoryBaseline = process.memoryUsage();
    this.maxHeapSize = this.memoryBaseline.heapUsed * 2; // Allow 2x growth
  }

  static async beforeEach() {
    const currentMemory = process.memoryUsage();
    if (currentMemory.heapUsed > this.maxHeapSize) {
      // Force garbage collection if memory usage is too high
      if (global.gc) {
        global.gc();
      }
    }
  }

  static async afterEach() {
    // Clean up any potential memory leaks
    if (globalThis.performanceUtils) {
      globalThis.performanceUtils.cleanupTimers();
    }
  }

  static async teardown() {
    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    if (this.memoryBaseline) {
      const memoryIncrease = finalMemory.heapUsed - this.memoryBaseline.heapUsed;
      if (memoryIncrease > 10 * 1024 * 1024 && process.env.VITEST_DEBUG_MEMORY) {
        console.warn(`Memory increase detected: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      }
    }
    
    this.memoryBaseline = null;
    this.maxHeapSize = 0;
  }
}

/**
 * High-performance test suite factory
 */
export function createHighPerformanceTestSuite(
  name: string,
  tests: Array<() => void>,
  options: {
    useDiscordMocks?: boolean;
    useGitHubMocks?: boolean;
    useDatabaseMocks?: boolean;
    memoryOptimized?: boolean;
    concurrent?: boolean;
    timeout?: number;
  } = {}
) {
  const config: TestGroupConfig = {
    name,
    concurrent: options.concurrent ?? true,
    timeout: options.timeout ?? 10000,
    setup: async () => {
      if (options.useDiscordMocks) {
        await DiscordTestBatch.setup();
      }
      if (options.useGitHubMocks) {
        await GitHubTestBatch.setup();
      }
      if (options.useDatabaseMocks) {
        await DatabaseTestBatch.setup();
      }
      if (options.memoryOptimized) {
        await MemoryOptimizedBatch.setup();
      }
    },
    teardown: async () => {
      if (options.useDiscordMocks) {
        await DiscordTestBatch.teardown();
      }
      if (options.useGitHubMocks) {
        await GitHubTestBatch.teardown();
      }
      if (options.useDatabaseMocks) {
        await DatabaseTestBatch.teardown();
      }
      if (options.memoryOptimized) {
        await MemoryOptimizedBatch.teardown();
      }
    },
    beforeEach: options.memoryOptimized ? MemoryOptimizedBatch.beforeEach : undefined,
    afterEach: options.memoryOptimized ? MemoryOptimizedBatch.afterEach : undefined,
  };

  return createBatchedSuite(config, tests);
}

/**
 * Smart test grouping based on test patterns
 */
export function groupTestsByPattern(testFiles: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    unit: [],
    integration: [],
    discord: [],
    github: [],
    jira: [],
    framework: [],
    commands: [],
    components: [],
  };

  testFiles.forEach(file => {
    if (file.includes("integration")) {
      groups.integration.push(file);
    } else if (file.includes("discord")) {
      groups.discord.push(file);
    } else if (file.includes("github")) {
      groups.github.push(file);
    } else if (file.includes("jira")) {
      groups.jira.push(file);
    } else if (file.includes("framework")) {
      groups.framework.push(file);
    } else if (file.includes("commands")) {
      groups.commands.push(file);
    } else if (file.includes("components")) {
      groups.components.push(file);
    } else {
      groups.unit.push(file);
    }
  });

  return groups;
}

// Re-export vitest functions for convenience
import { vi } from "vitest";
export { vi, describe, beforeAll, afterAll, beforeEach, afterEach };