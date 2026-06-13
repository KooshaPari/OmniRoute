/**
 * Performance Test Utilities
 * 
 * Shared utilities for optimizing test performance across all test suites
 * Provides common patterns for fake timers, mock optimizations, and test isolation
 */

import { vi } from 'vitest';

export interface PerformanceTestOptions {
  useFakeTimers?: boolean;
  shouldAdvanceTime?: boolean;
  mockNetwork?: boolean;
  optimizeMocks?: boolean;
}

export class PerformanceTestHelper {
  private static defaultOptions: PerformanceTestOptions = {
    useFakeTimers: true,
    shouldAdvanceTime: true,
    mockNetwork: true,
    optimizeMocks: true
  };

  /**
   * Set up performance optimizations for a test suite
   */
  static setupSuite(options: PerformanceTestOptions = {}) {
    const config = { ...this.defaultOptions, ...options };
    
    return {
      beforeAll: () => {
        if (config.useFakeTimers) {
          vi.useFakeTimers({ shouldAdvanceTime: config.shouldAdvanceTime });
        }
        
        if (config.mockNetwork) {
          this.setupNetworkMocks();
        }
        
        if (config.optimizeMocks) {
          this.setupOptimizedMocks();
        }
      },
      
      afterAll: () => {
        if (config.useFakeTimers) {
          vi.useRealTimers();
        }
        vi.restoreAllMocks();
      },
      
      beforeEach: () => {
        vi.clearAllMocks();
        vi.clearAllTimers();
      },
      
      afterEach: () => {
        vi.clearAllTimers();
      }
    };
  }

  /**
   * Set up optimized network mocks for faster test execution
   */
  private static setupNetworkMocks() {
    // Mock fetch for instant responses
    global.fetch = vi.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        headers: new Map()
      })
    );

    // Mock setTimeout/setInterval for instant resolution
    global.setTimeout = vi.fn().mockImplementation((callback: Function, _delay?: number) => {
      if (vi.isFakeTimers()) {
        return vi.fn(callback)();
      }
      return setTimeout(callback, 0);
    });

    global.setInterval = vi.fn().mockImplementation((callback: Function, _delay?: number) => {
      if (vi.isFakeTimers()) {
        return vi.fn(callback)();
      }
      return setInterval(callback, 0);
    });
  }

  /**
   * Set up optimized mocks for common operations
   */
  private static setupOptimizedMocks() {
    // Mock crypto operations for instant execution
    vi.mock('crypto', () => ({
      randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
      createHash: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mock-hash')
      }),
      createHmac: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mock-hmac')
      })
    }));

    // Mock file system operations for instant execution
    vi.mock('fs', () => ({
      promises: {
        readFile: vi.fn().mockResolvedValue('mock-file-content'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined)
      },
      readFileSync: vi.fn().mockReturnValue('mock-file-content'),
      writeFileSync: vi.fn().mockReturnValue(undefined),
      existsSync: vi.fn().mockReturnValue(true)
    }));
  }

  /**
   * Create fast async operation that resolves immediately
   */
  static fastAsync<T>(result: T): Promise<T> {
    return Promise.resolve(result);
  }

  /**
   * Create fast async operation that rejects immediately
   */
  static fastAsyncError(error: Error): Promise<never> {
    return Promise.reject(error);
  }

  /**
   * Advance fake timers by specified time and run all pending timers
   */
  static async advanceTimersAndRun(time: number = 0) {
    if (vi.isFakeTimers()) {
      vi.advanceTimersByTime(time);
      await vi.runAllTimersAsync();
    }
  }

  /**
   * Create optimized mock for database operations
   */
  static createFastDatabaseMock() {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue({ insertId: 1 }),
      update: vi.fn().mockResolvedValue({ affectedRows: 1 }),
      delete: vi.fn().mockResolvedValue({ affectedRows: 1 }),
      transaction: vi.fn().mockImplementation((callback) => callback())
    };
  }

  /**
   * Create optimized mock for cache operations
   */
  static createFastCacheMock() {
    const cache = new Map();
    return {
      get: vi.fn().mockImplementation((key) => this.fastAsync(cache.get(key) || null)),
      set: vi.fn().mockImplementation((key, value) => {
        cache.set(key, value);
        return this.fastAsync(true);
      }),
      del: vi.fn().mockImplementation((key) => {
        cache.delete(key);
        return this.fastAsync(true);
      }),
      clear: vi.fn().mockImplementation(() => {
        cache.clear();
        return this.fastAsync(true);
      })
    };
  }

  /**
   * Create optimized mock for event publisher
   */
  static createFastEventMock() {
    return {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined)
    };
  }

  /**
   * Batch multiple async operations for parallel execution
   */
  static async batchOperations<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(operations.map(op => op()));
  }

  /**
   * Create performance-optimized test data generators
   */
  static createTestDataGenerator(size: number = 10) {
    return {
      threads: Array.from({ length: size }, (_, i) => ({
        id: `thread-${i}`,
        title: `Test Thread ${i}`,
        archived: false,
        locked: false,
        comments: [],
        appliedTags: [`tag-${i}`]
      })),
      
      users: Array.from({ length: size }, (_, i) => ({
        id: `user-${i}`,
        username: `testuser${i}`,
        email: `test${i}@example.com`,
        permissions: ['read']
      })),
      
      interactions: Array.from({ length: size }, (_, i) => ({
        id: `interaction-${i}`,
        customId: `button-${i}`,
        user: { id: `user-${i}`, username: `testuser${i}` },
        reply: vi.fn().mockResolvedValue(undefined),
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined)
      }))
    };
  }

  /**
   * Measure test performance (for debugging slow tests)
   */
  static measurePerformance() {
    const start = performance.now();
    
    return {
      end: () => {
        const duration = performance.now() - start;
        return {
          duration,
          isSlowTest: duration > 100, // Flag tests taking more than 100ms
          benchmark: {
            veryFast: duration < 10,
            fast: duration < 50,
            acceptable: duration < 100,
            slow: duration >= 100
          }
        };
      }
    };
  }

  /**
   * Skip slow operations in test environment
   */
  static skipSlowOperations() {
    return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  }
}

/**
 * Decorator for performance-optimized test suites
 */
export function optimizeTestSuite(options: PerformanceTestOptions = {}) {
  return function(target: any) {
    const setup = PerformanceTestHelper.setupSuite(options);
    
    // Add performance setup to the test suite
    if (typeof target.beforeAll === 'function') {
      const originalBeforeAll = target.beforeAll;
      target.beforeAll = () => {
        setup.beforeAll();
        originalBeforeAll();
      };
    } else {
      target.beforeAll = setup.beforeAll;
    }
    
    if (typeof target.afterAll === 'function') {
      const originalAfterAll = target.afterAll;
      target.afterAll = () => {
        originalAfterAll();
        setup.afterAll();
      };
    } else {
      target.afterAll = setup.afterAll;
    }
    
    return target;
  };
}

/**
 * Common performance patterns for different test types
 */
export const TestPatterns = {
  // For ActionButtonManager and UI component tests
  ui: {
    useFakeTimers: true,
    shouldAdvanceTime: true,
    mockNetwork: true,
    optimizeMocks: true
  },
  
  // For database and persistence tests
  database: {
    useFakeTimers: true,
    shouldAdvanceTime: false, // Database tests may need real timing
    mockNetwork: false, // May need real network for DB connections
    optimizeMocks: true
  },
  
  // For security and validation tests
  security: {
    useFakeTimers: true,
    shouldAdvanceTime: true,
    mockNetwork: true, // Mock network to avoid real requests
    optimizeMocks: true
  },
  
  // For end-to-end workflow tests
  integration: {
    useFakeTimers: true,
    shouldAdvanceTime: true,
    mockNetwork: false, // E2E tests may need real network behavior
    optimizeMocks: false // E2E tests may need real implementations
  }
};