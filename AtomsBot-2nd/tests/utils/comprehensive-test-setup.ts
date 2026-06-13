/**
 * Comprehensive Test Setup Utility
 * 
 * Provides integrated setup for database, cache, store, and messaging components
 * Ensures proper initialization, cleanup, and synchronization for complex test scenarios
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { 
  mockDatabaseService, 
  resetDatabaseMocks, 
  simulateDbError,
  DatabaseTestUtils,
  setConnectionFailureMode
} from '../mocks/database';
import { 
  mockCacheService, 
  resetCacheMocks, 
  simulateCacheError,
  CacheTestUtils,
  setSlowCacheMode
} from '../mocks/cache';
import { 
  testDbConnectionManager,
  setupDatabaseTest,
  cleanupAllConnections,
  waitForAllOperations
} from './database-connection-manager';

interface TestEnvironmentConfig {
  enableDatabase?: boolean;
  enableCache?: boolean;
  enableMessaging?: boolean;
  enableStore?: boolean;
  isolation?: 'none' | 'test' | 'suite';
  cleanup?: 'auto' | 'manual';
  timeouts?: {
    setup?: number;
    cleanup?: number;
    operations?: number;
  };
  debug?: boolean;
}

interface TestContext {
  dbConnection?: string;
  transactionId?: string;
  testId: string;
  startTime: number;
  operations: Array<{ type: string; timestamp: number; success: boolean }>;
  cleanup: Array<() => Promise<void>>;
}

export class ComprehensiveTestSetup {
  private config: Required<TestEnvironmentConfig>;
  private contexts: Map<string, TestContext> = new Map();
  private globalSetupDone = false;

  constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      enableDatabase: config.enableDatabase !== false,
      enableCache: config.enableCache !== false,
      enableMessaging: config.enableMessaging !== false,
      enableStore: config.enableStore !== false,
      isolation: config.isolation || 'test',
      cleanup: config.cleanup || 'auto',
      timeouts: {
        setup: 10000,
        cleanup: 5000,
        operations: 30000,
        ...config.timeouts,
      },
      debug: config.debug || process.env.DEBUG_TESTS === 'true',
    };
  }

  /**
   * Global setup - run once per test suite
   */
  async globalSetup(): Promise<void> {
    if (this.globalSetupDone) return;

    if (this.config.debug) {
      console.log('🔧 Starting comprehensive test setup...');
    }

    try {
      // Initialize database mocks
      if (this.config.enableDatabase) {
        await this.setupDatabaseMocks();
      }

      // Initialize cache mocks
      if (this.config.enableCache) {
        await this.setupCacheMocks();
      }

      // Initialize messaging mocks
      if (this.config.enableMessaging) {
        await this.setupMessagingMocks();
      }

      // Initialize store mocks
      if (this.config.enableStore) {
        await this.setupStoreMocks();
      }

      this.globalSetupDone = true;

      if (this.config.debug) {
        console.log('✅ Comprehensive test setup completed');
      }
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error);
      throw error;
    }
  }

  /**
   * Global cleanup - run once per test suite
   */
  async globalCleanup(): Promise<void> {
    if (!this.globalSetupDone) return;

    if (this.config.debug) {
      console.log('🧹 Starting comprehensive test cleanup...');
    }

    try {
      // Clean up all active contexts
      const cleanupPromises = Array.from(this.contexts.values()).map(ctx => 
        this.cleanupContext(ctx.testId)
      );
      await Promise.all(cleanupPromises);

      // Clean up global resources
      await Promise.all([
        this.config.enableDatabase ? cleanupAllConnections() : Promise.resolve(),
        this.config.enableCache ? this.cleanupCacheMocks() : Promise.resolve(),
        this.config.enableMessaging ? this.cleanupMessagingMocks() : Promise.resolve(),
        this.config.enableStore ? this.cleanupStoreMocks() : Promise.resolve(),
      ]);

      // Wait for all operations to complete
      await waitForAllOperations(this.config.timeouts.operations);

      this.contexts.clear();
      this.globalSetupDone = false;

      if (this.config.debug) {
        console.log('✅ Comprehensive test cleanup completed');
      }
    } catch (error) {
      console.error('❌ Failed to cleanup test environment:', error);
      throw error;
    }
  }

  /**
   * Setup for individual test
   */
  async testSetup(testName?: string): Promise<TestContext> {
    const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const context: TestContext = {
      testId,
      startTime: Date.now(),
      operations: [],
      cleanup: [],
    };

    try {
      // Setup database connection if enabled
      if (this.config.enableDatabase) {
        const dbSetup = setupDatabaseTest();
        context.dbConnection = await dbSetup.setup(testName);
        context.cleanup.push(() => dbSetup.cleanup());
      }

      // Reset mocks based on isolation level
      if (this.config.isolation === 'test') {
        await this.resetAllMocks();
      }

      this.contexts.set(testId, context);

      if (this.config.debug) {
        console.log(`🧪 Test setup completed for: ${testName || testId}`);
      }

      return context;
    } catch (error) {
      console.error(`❌ Failed to setup test: ${testName || testId}`, error);
      throw error;
    }
  }

  /**
   * Cleanup for individual test
   */
  async testCleanup(testId: string): Promise<void> {
    const context = this.contexts.get(testId);
    if (!context) {
      if (this.config.debug) {
        console.warn(`⚠️ No context found for test: ${testId}`);
      }
      return;
    }

    if (this.config.cleanup === 'auto') {
      await this.cleanupContext(testId);
    }
  }

  /**
   * Execute operation in test transaction
   */
  async executeInTransaction<T>(
    testId: string,
    operation: (transactionId: string) => Promise<T>
  ): Promise<T> {
    const context = this.contexts.get(testId);
    if (!context || !context.dbConnection) {
      throw new Error(`No database connection available for test: ${testId}`);
    }

    const dbSetup = setupDatabaseTest();
    const result = await dbSetup.executeInTransaction(operation);
    
    context.operations.push({
      type: 'transaction',
      timestamp: Date.now(),
      success: true,
    });

    return result;
  }

  /**
   * Simulate various error conditions
   */
  async simulateErrors(testId: string, errorConfig: {
    database?: 'connection' | 'constraint' | 'timeout';
    cache?: 'connection' | 'timeout' | 'memory';
    slowOperations?: boolean;
  }): Promise<void> {
    const context = this.contexts.get(testId);
    if (!context) {
      throw new Error(`No context found for test: ${testId}`);
    }

    try {
      if (errorConfig.database && this.config.enableDatabase) {
        simulateDbError(errorConfig.database);
      }

      if (errorConfig.cache && this.config.enableCache) {
        simulateCacheError(errorConfig.cache);
      }

      if (errorConfig.slowOperations) {
        setSlowCacheMode(true);
        context.cleanup.push(() => {
          setSlowCacheMode(false);
          return Promise.resolve();
        });
      }

      context.operations.push({
        type: 'error_simulation',
        timestamp: Date.now(),
        success: true,
      });

      if (this.config.debug) {
        console.log(`🔥 Simulated errors for test: ${testId}`, errorConfig);
      }
    } catch (error) {
      context.operations.push({
        type: 'error_simulation',
        timestamp: Date.now(),
        success: false,
      });
      throw error;
    }
  }

  /**
   * Get test statistics
   */
  getTestStats(testId: string) {
    const context = this.contexts.get(testId);
    if (!context) {
      return null;
    }

    const duration = Date.now() - context.startTime;
    const successfulOps = context.operations.filter(op => op.success).length;
    const failedOps = context.operations.filter(op => !op.success).length;

    return {
      testId: context.testId,
      duration,
      operations: {
        total: context.operations.length,
        successful: successfulOps,
        failed: failedOps,
      },
      dbConnection: context.dbConnection,
      hasTransaction: !!context.transactionId,
    };
  }

  // Private methods

  private async setupDatabaseMocks(): Promise<void> {
    // Mock database service modules
    vi.mock('../../src/database/DatabaseService', () => ({
      DatabaseService: vi.fn().mockImplementation(() => mockDatabaseService),
      databaseService: mockDatabaseService,
    }));

    // Mock Prisma client
    vi.mock('@prisma/client', () => ({
      PrismaClient: vi.fn().mockImplementation(() => mockDatabaseService),
    }));
  }

  private async setupCacheMocks(): Promise<void> {
    // Mock cache service modules
    vi.mock('../../src/cache/redis', () => ({
      CacheService: vi.fn().mockImplementation(() => mockCacheService),
      cacheService: mockCacheService,
    }));

    // Mock Redis client
    vi.mock('redis', () => ({
      createClient: vi.fn().mockImplementation(() => mockCacheService),
    }));
  }

  private async setupMessagingMocks(): Promise<void> {
    // Mock NATS messaging
    const mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue('subscription-id'),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };

    vi.mock('../../src/messaging/nats', () => ({
      EventPublisher: vi.fn().mockImplementation(() => mockEventPublisher),
      eventPublisher: mockEventPublisher,
    }));
  }

  private async setupStoreMocks(): Promise<void> {
    // Mock store-db module
    vi.mock('../../src/store-db', () => ({
      store: {
        addThread: vi.fn().mockResolvedValue(undefined),
        updateThread: vi.fn().mockResolvedValue(undefined),
        findThread: vi.fn().mockReturnValue(null),
        addJiraLink: vi.fn().mockResolvedValue(undefined),
        addGitHubLink: vi.fn().mockResolvedValue(undefined),
        getJiraKey: vi.fn().mockResolvedValue(null),
        getGitHubNumber: vi.fn().mockResolvedValue(null),
        clearThreads: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      },
      resolveServices: vi.fn().mockResolvedValue({
        databaseService: mockDatabaseService,
        cacheService: mockCacheService,
        eventPublisher: { publish: vi.fn() },
      }),
    }));
  }

  private async resetAllMocks(): Promise<void> {
    const resetPromises = [];

    if (this.config.enableDatabase) {
      resetPromises.push(Promise.resolve(resetDatabaseMocks()));
    }

    if (this.config.enableCache) {
      resetPromises.push(Promise.resolve(resetCacheMocks()));
    }

    await Promise.all(resetPromises);
  }

  private async cleanupContext(testId: string): Promise<void> {
    const context = this.contexts.get(testId);
    if (!context) return;

    try {
      // Run all cleanup functions
      await Promise.all(context.cleanup.map(cleanup => cleanup()));

      // Remove context
      this.contexts.delete(testId);

      if (this.config.debug) {
        const stats = this.getTestStats(testId);
        if (stats) {
          console.log(`🧹 Cleaned up test ${testId} (${stats.duration}ms, ${stats.operations.total} ops)`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to cleanup test context: ${testId}`, error);
      throw error;
    }
  }

  private async cleanupCacheMocks(): Promise<void> {
    resetCacheMocks();
  }

  private async cleanupMessagingMocks(): Promise<void> {
    // Reset NATS mocks
    // Implementation depends on specific messaging mock setup
  }

  private async cleanupStoreMocks(): Promise<void> {
    // Reset store mocks
    // Implementation depends on specific store mock setup
  }
}

// Global instance for easy access
export const testSetup = new ComprehensiveTestSetup();

// Convenience functions for common test patterns
export const createDatabaseTest = (config?: TestEnvironmentConfig) => {
  const setup = new ComprehensiveTestSetup({ ...config, enableDatabase: true });
  
  return {
    beforeAll: () => setup.globalSetup(),
    afterAll: () => setup.globalCleanup(),
    beforeEach: (testName?: string) => setup.testSetup(testName),
    afterEach: (testId: string) => setup.testCleanup(testId),
    executeInTransaction: (testId: string, operation: (txId: string) => Promise<any>) => 
      setup.executeInTransaction(testId, operation),
    simulateErrors: (testId: string, errors: any) => setup.simulateErrors(testId, errors),
    getStats: (testId: string) => setup.getTestStats(testId),
  };
};

export const createIntegrationTest = (config?: TestEnvironmentConfig) => {
  const setup = new ComprehensiveTestSetup({ 
    ...config,
    enableDatabase: true,
    enableCache: true,
    enableMessaging: true,
    enableStore: true,
  });

  return {
    beforeAll: () => setup.globalSetup(),
    afterAll: () => setup.globalCleanup(),
    beforeEach: (testName?: string) => setup.testSetup(testName),
    afterEach: (testId: string) => setup.testCleanup(testId),
    executeInTransaction: (testId: string, operation: (txId: string) => Promise<any>) => 
      setup.executeInTransaction(testId, operation),
    simulateErrors: (testId: string, errors: any) => setup.simulateErrors(testId, errors),
    getStats: (testId: string) => setup.getTestStats(testId),
  };
};

// Vitest setup helpers
export const setupVitest = (config?: TestEnvironmentConfig) => {
  const setup = new ComprehensiveTestSetup(config);
  let currentContext: TestContext | null = null;

  beforeAll(async () => {
    await setup.globalSetup();
  });

  afterAll(async () => {
    await setup.globalCleanup();
  });

  beforeEach(async (ctx) => {
    const testName = ctx?.meta?.name || 'unknown-test';
    currentContext = await setup.testSetup(testName);
    // Store context in test context for access in tests
    (ctx as any).testContext = currentContext;
  });

  afterEach(async () => {
    if (currentContext) {
      await setup.testCleanup(currentContext.testId);
      currentContext = null;
    }
  });

  return {
    executeInTransaction: async <T>(operation: (txId: string) => Promise<T>): Promise<T> => {
      if (!currentContext) {
        throw new Error('No active test context. Make sure to call this within a test.');
      }
      return setup.executeInTransaction(currentContext.testId, operation);
    },
    simulateErrors: async (errors: any) => {
      if (!currentContext) {
        throw new Error('No active test context. Make sure to call this within a test.');
      }
      return setup.simulateErrors(currentContext.testId, errors);
    },
    getStats: () => {
      if (!currentContext) {
        return null;
      }
      return setup.getTestStats(currentContext.testId);
    },
  };
};