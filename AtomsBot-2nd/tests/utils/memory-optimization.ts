/**
 * Memory Optimization Utilities for Tests
 * 
 * This module provides comprehensive memory management and leak prevention
 * utilities to ensure optimal memory usage during test execution.
 */

import { afterEach, beforeEach } from "vitest";

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  timestamp: number;
  testName?: string;
}

interface MemoryLeakDetection {
  threshold: number; // MB
  consecutiveIncreases: number;
  maxConsecutiveIncreases: number;
  enabled: boolean;
}

class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private leakDetection: MemoryLeakDetection = {
    threshold: 10, // 10MB
    consecutiveIncreases: 0,
    maxConsecutiveIncreases: 3,
    enabled: process.env.VITEST_MEMORY_MONITORING === "true",
  };
  private gcForced = 0;
  private maxSnapshots = 100;

  constructor() {
    // Enable heap profiling if available
    if (process.env.VITEST_HEAP_PROFILING && typeof global.gc === "function") {
      // Configure V8 for better memory tracking
      const v8 = require("v8");
      if (v8.setFlagsFromString) {
        try {
          v8.setFlagsFromString("--expose-gc --max-old-space-size=4096");
        } catch (error) {
          // Ignore if flags can't be set
        }
      }
    }
  }

  takeSnapshot(testName?: string): MemorySnapshot {
    const memoryUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      timestamp: Date.now(),
      testName,
    };

    this.snapshots.push(snapshot);
    
    // Keep only the last N snapshots to prevent memory leaks in the monitor itself
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    return snapshot;
  }

  detectMemoryLeak(): boolean {
    if (!this.leakDetection.enabled || this.snapshots.length < 2) {
      return false;
    }

    const current = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];
    
    const heapIncrease = (current.heapUsed - previous.heapUsed) / 1024 / 1024; // MB

    if (heapIncrease > this.leakDetection.threshold) {
      this.leakDetection.consecutiveIncreases++;
      
      if (this.leakDetection.consecutiveIncreases >= this.leakDetection.maxConsecutiveIncreases) {
        return true;
      }
    } else {
      this.leakDetection.consecutiveIncreases = 0;
    }

    return false;
  }

  forceGarbageCollection(): boolean {
    if (typeof global.gc === "function") {
      global.gc();
      this.gcForced++;
      return true;
    }
    return false;
  }

  getMemoryReport(): {
    current: MemorySnapshot;
    peak: MemorySnapshot;
    baseline?: MemorySnapshot;
    gcForced: number;
    totalSnapshots: number;
    averageHeapUsage: number;
  } {
    if (this.snapshots.length === 0) {
      const current = this.takeSnapshot("report");
      return {
        current,
        peak: current,
        baseline: current,
        gcForced: this.gcForced,
        totalSnapshots: 1,
        averageHeapUsage: current.heapUsed / 1024 / 1024,
      };
    }

    const current = this.snapshots[this.snapshots.length - 1];
    const peak = this.snapshots.reduce((max, snapshot) => 
      snapshot.heapUsed > max.heapUsed ? snapshot : max
    );
    const baseline = this.snapshots[0];
    const averageHeapUsage = this.snapshots.reduce((sum, snapshot) => 
      sum + snapshot.heapUsed, 0
    ) / this.snapshots.length / 1024 / 1024;

    return {
      current,
      peak,
      baseline,
      gcForced: this.gcForced,
      totalSnapshots: this.snapshots.length,
      averageHeapUsage,
    };
  }

  reset(): void {
    this.snapshots = [];
    this.leakDetection.consecutiveIncreases = 0;
    this.gcForced = 0;
  }

  getTopMemoryConsumers(): Array<{ testName?: string; heapUsed: number; timestamp: number }> {
    return this.snapshots
      .filter(snapshot => snapshot.testName)
      .sort((a, b) => b.heapUsed - a.heapUsed)
      .slice(0, 10)
      .map(snapshot => ({
        testName: snapshot.testName,
        heapUsed: Math.round(snapshot.heapUsed / 1024 / 1024), // MB
        timestamp: snapshot.timestamp,
      }));
  }
}

// Global memory monitor instance
const memoryMonitor = new MemoryMonitor();

/**
 * Object pool for reusing objects and reducing garbage collection overhead
 */
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(factory: () => T, resetFn: (obj: T) => void, maxSize = 50) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    const obj = this.pool.pop() || this.factory();
    return obj;
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
    // If pool is full, let the object be garbage collected
  }

  clear(): void {
    this.pool.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }
}

/**
 * Memory-efficient mock factory
 */
class MockFactory {
  private stringPool = new ObjectPool(
    () => "",
    (str) => { /* strings are immutable, no reset needed */ },
    100
  );

  private arrayPool = new ObjectPool(
    () => [],
    (arr) => { arr.length = 0; },
    50
  );

  private objectPool = new ObjectPool(
    () => ({}),
    (obj) => {
      // Clear all properties
      for (const key in obj) {
        delete obj[key];
      }
    },
    50
  );

  createMockArray<T>(initialItems?: T[]): T[] {
    const arr = this.arrayPool.acquire() as T[];
    if (initialItems) {
      arr.push(...initialItems);
    }
    return arr;
  }

  createMockObject<T extends Record<string, any>>(properties?: Partial<T>): T {
    const obj = this.objectPool.acquire() as T;
    if (properties) {
      Object.assign(obj, properties);
    }
    return obj;
  }

  releaseMockArray<T>(arr: T[]): void {
    this.arrayPool.release(arr);
  }

  releaseMockObject<T extends Record<string, any>>(obj: T): void {
    this.objectPool.release(obj);
  }

  clearAllPools(): void {
    this.stringPool.clear();
    this.arrayPool.clear();
    this.objectPool.clear();
  }

  getPoolStats(): { strings: number; arrays: number; objects: number } {
    return {
      strings: this.stringPool.size,
      arrays: this.arrayPool.size,
      objects: this.objectPool.size,
    };
  }
}

const mockFactory = new MockFactory();

/**
 * WeakRef-based cache for better memory management
 */
class WeakCache<K, V extends object> {
  private cache = new Map<K, WeakRef<V>>();
  private registry = new FinalizationRegistry((key: K) => {
    this.cache.delete(key);
  });

  set(key: K, value: V): void {
    const ref = new WeakRef(value);
    this.cache.set(key, ref);
    this.registry.register(value, key);
  }

  get(key: K): V | undefined {
    const ref = this.cache.get(key);
    if (!ref) return undefined;
    
    const value = ref.deref();
    if (!value) {
      // Object was garbage collected
      this.cache.delete(key);
      return undefined;
    }
    
    return value;
  }

  has(key: K): boolean {
    const ref = this.cache.get(key);
    if (!ref) return false;
    
    const value = ref.deref();
    if (!value) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    // Clean up dead references before returning size
    for (const [key, ref] of this.cache.entries()) {
      if (!ref.deref()) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

/**
 * Memory-optimized test utilities
 */
export const memoryUtils = {
  monitor: memoryMonitor,
  mockFactory,
  
  /**
   * Creates a memory-efficient test environment
   */
  setupMemoryOptimizedTest: (testName: string) => {
    const startSnapshot = memoryMonitor.takeSnapshot(`${testName}-start`);
    
    return {
      takeSnapshot: (label?: string) => 
        memoryMonitor.takeSnapshot(`${testName}-${label || 'checkpoint'}`),
      
      cleanup: () => {
        mockFactory.clearAllPools();
        if (memoryMonitor.detectMemoryLeak()) {
          console.warn(`Potential memory leak detected in test: ${testName}`);
          memoryMonitor.forceGarbageCollection();
        }
        memoryMonitor.takeSnapshot(`${testName}-end`);
      },
      
      getMemoryDiff: () => {
        const endSnapshot = memoryMonitor.takeSnapshot(`${testName}-diff`);
        const heapDiff = (endSnapshot.heapUsed - startSnapshot.heapUsed) / 1024 / 1024;
        return {
          heapDiffMB: Math.round(heapDiff * 100) / 100,
          startHeapMB: Math.round(startSnapshot.heapUsed / 1024 / 1024 * 100) / 100,
          endHeapMB: Math.round(endSnapshot.heapUsed / 1024 / 1024 * 100) / 100,
        };
      }
    };
  },

  /**
   * Creates a weak cache for test data
   */
  createWeakCache: <K, V extends object>() => new WeakCache<K, V>(),

  /**
   * Force garbage collection and return memory statistics
   */
  forceCleanup: () => {
    mockFactory.clearAllPools();
    const gcResult = memoryMonitor.forceGarbageCollection();
    const report = memoryMonitor.getMemoryReport();
    
    return {
      gcForced: gcResult,
      currentHeapMB: Math.round(report.current.heapUsed / 1024 / 1024 * 100) / 100,
      peakHeapMB: Math.round(report.peak.heapUsed / 1024 / 1024 * 100) / 100,
      averageHeapMB: Math.round(report.averageHeapUsage * 100) / 100,
    };
  },

  /**
   * Get memory usage report
   */
  getReport: () => {
    const report = memoryMonitor.getMemoryReport();
    const poolStats = mockFactory.getPoolStats();
    
    return {
      memory: {
        currentMB: Math.round(report.current.heapUsed / 1024 / 1024 * 100) / 100,
        peakMB: Math.round(report.peak.heapUsed / 1024 / 1024 * 100) / 100,
        averageMB: Math.round(report.averageHeapUsage * 100) / 100,
        gcForced: report.gcForced,
        snapshots: report.totalSnapshots,
      },
      pools: poolStats,
      topConsumers: memoryMonitor.getTopMemoryConsumers(),
    };
  },

  /**
   * Reset all memory tracking
   */
  reset: () => {
    memoryMonitor.reset();
    mockFactory.clearAllPools();
  },
};

/**
 * Memory-optimized beforeEach/afterEach hooks
 */
export function useMemoryOptimization() {
  let testMemoryTracker: ReturnType<typeof memoryUtils.setupMemoryOptimizedTest> | null = null;

  beforeEach((ctx) => {
    testMemoryTracker = memoryUtils.setupMemoryOptimizedTest(ctx.task.name);
  });

  afterEach(() => {
    if (testMemoryTracker) {
      testMemoryTracker.cleanup();
      testMemoryTracker = null;
    }
  });

  return {
    takeSnapshot: (label?: string) => testMemoryTracker?.takeSnapshot(label),
    getMemoryDiff: () => testMemoryTracker?.getMemoryDiff(),
  };
}

/**
 * Memory leak detection hook
 */
export function useMemoryLeakDetection(options: {
  threshold?: number; // MB
  autoForceGC?: boolean;
} = {}) {
  const threshold = options.threshold || 50; // 50MB default
  const autoForceGC = options.autoForceGC ?? true;

  afterEach((ctx) => {
    const report = memoryUtils.getReport();
    
    if (report.memory.currentMB > threshold) {
      console.warn(
        `High memory usage detected in test "${ctx.task.name}": ${report.memory.currentMB}MB`
      );
      
      if (autoForceGC) {
        const cleanup = memoryUtils.forceCleanup();
        console.log(`Forced cleanup: ${cleanup.currentHeapMB}MB after GC`);
      }
    }
  });
}

// Export the memory monitor for global access
globalThis.memoryUtils = memoryUtils;

// Add TypeScript declarations
declare global {
  var memoryUtils: typeof memoryUtils;
}

export default memoryUtils;