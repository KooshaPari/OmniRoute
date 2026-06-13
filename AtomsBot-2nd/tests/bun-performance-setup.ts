/**
 * Bun-specific performance optimizations for test execution
 * Provides enhanced compatibility and performance tuning for Bun runtime
 */

import { beforeAll, afterAll, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

// Global performance tracking
const performanceMetrics = {
  testStartTime: 0,
  suiteStartTime: 0,
  memoryUsage: new Map<string, number>(),
  testCounts: { total: 0, passed: 0, failed: 0, skipped: 0 }
};

// Bun-specific environment setup
beforeAll(async () => {
  performanceMetrics.suiteStartTime = performance.now();
  
  // Optimize garbage collection for Bun
  if (typeof Bun !== 'undefined') {
    // Enable Bun-specific optimizations
    process.env.BUN_RUNTIME = 'true';
    process.env.BUN_ENV = 'test';
    
    // Bun garbage collection hints
    if (typeof Bun.gc === 'function') {
      Bun.gc(false); // Request minor GC
    }
  }
  
  // Memory baseline
  const memUsage = process.memoryUsage();
  performanceMetrics.memoryUsage.set('baseline', memUsage.heapUsed);
  
  // Optimize V8 settings for test performance (when not using Bun)
  if (typeof globalThis.gc === 'function' && typeof Bun === 'undefined') {
    globalThis.gc();
  }
  
  // Console optimization for tests
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  if (process.env.VITEST_SUPPRESS_LOGS === 'true') {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  }
  
  // Restore on cleanup
  (globalThis as any).__originalConsole = {
    log: originalLog,
    error: originalError,
    warn: originalWarn
  };
});

afterAll(async () => {
  const totalTime = performance.now() - performanceMetrics.suiteStartTime;
  const finalMemory = process.memoryUsage();
  const memoryDelta = finalMemory.heapUsed - (performanceMetrics.memoryUsage.get('baseline') || 0);
  
  // Performance summary (only in verbose mode)
  if (process.env.VITEST_REPORTER_VERBOSE === 'true') {
    console.info(`\n📊 Test Suite Performance Summary:`);
    console.info(`   ⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
    console.info(`   🧠 Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    console.info(`   🏃 Runtime: ${typeof Bun !== 'undefined' ? 'Bun' : 'Node.js'}`);
  }
  
  // Restore console if suppressed
  const original = (globalThis as any).__originalConsole;
  if (original) {
    console.log = original.log;
    console.error = original.error;
    console.warn = original.warn;
  }
  
  // Final cleanup
  if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
    Bun.gc(true); // Force full GC after test suite
  } else if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
});

// Test-level performance tracking
export const trackTestPerformance = (testName: string) => {
  const startTime = performance.now();
  
  return {
    end: () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (duration > 1000) { // Log slow tests (>1s)
        console.warn(`⚠️  Slow test detected: "${testName}" took ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    }
  };
};

// Memory pressure testing utility
export const checkMemoryPressure = (testName: string, threshold: number = 100) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  
  if (heapUsedMB > threshold) {
    console.warn(`🧠 Memory pressure in "${testName}": ${heapUsedMB.toFixed(2)}MB heap used`);
    
    // Suggest GC
    if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
      Bun.gc(false);
    }
  }
  
  return heapUsedMB;
};

// Bun-optimized mock factory
export const createBunOptimizedMock = <T extends (...args: any[]) => any>(
  implementation?: T
): MockedFunction<T> => {
  const mock = vi.fn(implementation) as MockedFunction<T>;
  
  // Bun-specific mock optimizations
  if (typeof Bun !== 'undefined') {
    // Add Bun-specific mock behaviors if needed
    Object.defineProperty(mock, '_bunOptimized', {
      value: true,
      enumerable: false
    });
  }
  
  return mock;
};

// Utility for cleaning up resources between tests
export const cleanupResources = () => {
  // Clear all timers
  vi.clearAllTimers();
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset modules
  vi.resetModules();
  
  // Memory hint
  if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
    Bun.gc(false);
  }
};

// Export performance metrics for analysis
export const getPerformanceMetrics = () => ({ ...performanceMetrics });

// Bun runtime detection
export const isBunRuntime = typeof Bun !== 'undefined';
export const isNodeRuntime = !isBunRuntime;

// Test environment information
export const getTestEnvironmentInfo = () => ({
  runtime: isBunRuntime ? 'Bun' : 'Node.js',
  version: isBunRuntime ? Bun.version : process.version,
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  vitestWorkers: process.env.VITEST_POOL_THREAD === 'true',
  ci: !!process.env.CI
});

// Conditional test utilities for runtime-specific behavior
export const runOnBun = (testFn: () => void | Promise<void>) => {
  if (isBunRuntime) {
    return testFn();
  } else {
    console.log('⏭️  Skipping Bun-specific test on Node.js runtime');
  }
};

export const runOnNode = (testFn: () => void | Promise<void>) => {
  if (isNodeRuntime) {
    return testFn();
  } else {
    console.log('⏭️  Skipping Node.js-specific test on Bun runtime');
  }
};

export default {
  trackTestPerformance,
  checkMemoryPressure,
  createBunOptimizedMock,
  cleanupResources,
  getPerformanceMetrics,
  getTestEnvironmentInfo,
  runOnBun,
  runOnNode,
  isBunRuntime,
  isNodeRuntime
};