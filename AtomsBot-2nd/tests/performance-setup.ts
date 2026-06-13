/**
 * Performance-Optimized Test Setup
 * 
 * This file contains performance optimizations that are loaded before the main setup.
 * It focuses on reducing memory usage, optimizing mocks, and improving test execution speed.
 */

import { vi } from "vitest";

// Optimize Node.js performance for tests
if (typeof global !== 'undefined') {
  // Increase max listeners to prevent warnings in parallel tests
  process.setMaxListeners(50);
  
  // Optimize garbage collection for tests
  if (global.gc) {
    // Force garbage collection to free memory more aggressively
    const originalGc = global.gc;
    global.gc = () => {
      try {
        originalGc();
      } catch (error) {
        // Ignore GC errors in tests
      }
    };
  }
}

// Mock pool system for high-performance mock reuse
class MockPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn?: (item: T) => void;

  constructor(factory: () => T, resetFn?: (item: T) => void) {
    this.factory = factory;
    this.resetFn = resetFn;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      const item = this.pool.pop()!;
      return item;
    }
    return this.factory();
  }

  release(item: T): void {
    if (this.resetFn) {
      this.resetFn(item);
    }
    this.pool.push(item);
  }

  clear(): void {
    this.pool.length = 0;
  }
}

// Create mock pools for commonly used objects
const mockInteractionPool = new MockPool(
  () => ({
    customId: "test_custom_id",
    user: { id: "test_user_id", username: "testuser", discriminator: "0000" },
    member: { id: "test_user_id", displayName: "Test User" },
    guild: { id: "test_guild_id", name: "Test Guild" },
    channel: { id: "test_channel_id", name: "test-channel" },
    replied: false,
    deferred: false,
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    fetchReply: vi.fn().mockResolvedValue({}),
    isChatInputCommand: vi.fn().mockReturnValue(false),
    isButton: vi.fn().mockReturnValue(false),
    isStringSelectMenu: vi.fn().mockReturnValue(false),
    isModalSubmit: vi.fn().mockReturnValue(false),
    isContextMenuCommand: vi.fn().mockReturnValue(false),
  }),
  (item) => {
    // Reset mock functions
    Object.values(item).forEach(value => {
      if (typeof value === 'function' && value.mockReset) {
        value.mockReset();
      }
    });
    item.replied = false;
    item.deferred = false;
  }
);

const mockGitHubRequestPool = new MockPool(
  () => ({
    body: {
      action: "opened",
      issue: {
        id: 123,
        number: 1,
        title: "Test Issue",
        body: "Test issue description",
        html_url: "https://github.com/test/repo/issues/1",
        state: "open",
        locked: false,
        node_id: "test_node_id",
        user: { login: "testuser", id: 12345 },
        assignees: [],
        labels: [],
        milestone: null,
        comments: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closed_at: null,
      },
      repository: {
        name: "test_repo",
        full_name: "test_user/test_repo",
        owner: { login: "test_user", id: 12345 },
        html_url: "https://github.com/test_user/test_repo",
      },
      sender: {
        login: "test_user",
        id: 12345,
        type: "User",
      },
    },
    headers: {
      "x-github-event": "issues",
      "x-github-delivery": "test-delivery-id",
    },
  }),
  (item) => {
    // Reset to default values
    item.body.action = "opened";
    item.body.issue.state = "open";
    item.body.issue.locked = false;
  }
);

// Performance-optimized mock utilities
globalThis.performanceUtils = {
  mockPools: {
    interaction: mockInteractionPool,
    githubRequest: mockGitHubRequestPool,
  },

  // Fast mock creators that reuse objects
  createMockInteraction: (customId = "test_custom_id", userId = "test_user_id") => {
    const interaction = mockInteractionPool.acquire();
    interaction.customId = customId;
    interaction.user.id = userId;
    return interaction;
  },

  createMockGitHubRequest: (action = "opened", overrides = {}) => {
    const request = mockGitHubRequestPool.acquire();
    request.body.action = action;
    Object.assign(request.body, overrides);
    return request;
  },

  // Batch mock reset for performance
  resetAllMocks: () => {
    mockInteractionPool.clear();
    mockGitHubRequestPool.clear();
  },

  // Memory cleanup utilities
  forceGarbageCollection: () => {
    if (global.gc) {
      global.gc();
    }
    // Clear any circular references
    vi.clearAllMocks();
  },

  // Performance timing utilities
  measureAsync: async <T>(fn: () => Promise<T>, label = "operation"): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      if (process.env.VITEST_DEBUG_PERFORMANCE) {
        console.log(`${label} took ${duration.toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      if (process.env.VITEST_DEBUG_PERFORMANCE) {
        console.log(`${label} failed after ${duration.toFixed(2)}ms`);
      }
      throw error;
    }
  },
};

// Optimize console for tests (reduce I/O overhead)
const silentConsole = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: process.env.VITEST_SHOW_ERRORS ? console.error : () => {},
  debug: () => {},
  trace: () => {},
  dir: () => {},
  time: () => {},
  timeEnd: () => {},
  group: () => {},
  groupEnd: () => {},
  clear: () => {},
  count: () => {},
  countReset: () => {},
  assert: () => {},
  table: () => {},
};

// Apply silent console unless debug mode is enabled
if (!process.env.VITEST_DEBUG) {
  Object.assign(console, silentConsole);
}

// Optimize timers for tests
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

// Track active timers for cleanup
const activeTimers = new Set();

global.setTimeout = ((fn: any, delay: any, ...args: any[]) => {
  const id = originalSetTimeout(fn, delay, ...args);
  activeTimers.add(id);
  return id;
}) as typeof setTimeout;

global.setInterval = ((fn: any, delay: any, ...args: any[]) => {
  const id = originalSetInterval(fn, delay, ...args);
  activeTimers.add(id);
  return id;
}) as typeof setInterval;

global.clearTimeout = ((id: any) => {
  activeTimers.delete(id);
  return originalClearTimeout(id);
}) as typeof clearTimeout;

global.clearInterval = ((id: any) => {
  activeTimers.delete(id);
  return originalClearInterval(id);
}) as typeof clearInterval;

// Cleanup function for timers
globalThis.performanceUtils.cleanupTimers = () => {
  for (const id of activeTimers) {
    try {
      clearTimeout(id as any);
      clearInterval(id as any);
    } catch {
      // Ignore cleanup errors
    }
  }
  activeTimers.clear();
};

// Set up memory monitoring
let lastMemoryUsage = process.memoryUsage();
let memoryLeakWarnings = 0;

globalThis.performanceUtils.checkMemoryUsage = () => {
  const currentUsage = process.memoryUsage();
  const heapIncrease = currentUsage.heapUsed - lastMemoryUsage.heapUsed;
  
  if (heapIncrease > 50 * 1024 * 1024) { // 50MB increase
    memoryLeakWarnings++;
    if (memoryLeakWarnings > 3 && process.env.VITEST_DEBUG_MEMORY) {
      console.warn(`Potential memory leak detected: heap increased by ${Math.round(heapIncrease / 1024 / 1024)}MB`);
    }
  }
  
  lastMemoryUsage = currentUsage;
  return currentUsage;
};

// Performance monitoring
const performanceMetrics = {
  testStartTimes: new Map<string, number>(),
  testDurations: new Map<string, number>(),
  slowTests: [] as Array<{ name: string; duration: number }>,
};

globalThis.performanceUtils.metrics = performanceMetrics;

globalThis.performanceUtils.startTestTimer = (testName: string) => {
  performanceMetrics.testStartTimes.set(testName, performance.now());
};

globalThis.performanceUtils.endTestTimer = (testName: string) => {
  const startTime = performanceMetrics.testStartTimes.get(testName);
  if (startTime) {
    const duration = performance.now() - startTime;
    performanceMetrics.testDurations.set(testName, duration);
    
    if (duration > 1000) { // Tests taking longer than 1 second
      performanceMetrics.slowTests.push({ name: testName, duration });
    }
    
    performanceMetrics.testStartTimes.delete(testName);
  }
};

globalThis.performanceUtils.getSlowTests = () => {
  return [...performanceMetrics.slowTests]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10); // Top 10 slowest tests
};

// Export for TypeScript
declare global {
  var performanceUtils: {
    mockPools: {
      interaction: MockPool<any>;
      githubRequest: MockPool<any>;
    };
    createMockInteraction: (customId?: string, userId?: string) => any;
    createMockGitHubRequest: (action?: string, overrides?: any) => any;
    resetAllMocks: () => void;
    forceGarbageCollection: () => void;
    measureAsync: <T>(fn: () => Promise<T>, label?: string) => Promise<T>;
    cleanupTimers: () => void;
    checkMemoryUsage: () => NodeJS.MemoryUsage;
    metrics: {
      testStartTimes: Map<string, number>;
      testDurations: Map<string, number>;
      slowTests: Array<{ name: string; duration: number }>;
    };
    startTestTimer: (testName: string) => void;
    endTestTimer: (testName: string) => void;
    getSlowTests: () => Array<{ name: string; duration: number }>;
  };
}

// Initialize performance monitoring
if (process.env.VITEST_PERFORMANCE_MONITORING) {
  console.log("Performance monitoring enabled for tests");
}