/**
 * Cache Service Mock Implementation
 * 
 * Comprehensive mock for Redis cache service with enhanced persistence tracking
 * Provides in-memory cache simulation with error conditions and sync status monitoring
 */

import { vi } from "vitest";

// Enhanced in-memory cache storage for testing
let mockCache = new Map<string, { value: any; expiry?: number; accessCount: number; lastAccess: number }>();
let persistenceTracker = new Map<string, { persisted: boolean; syncStatus: 'pending' | 'success' | 'failed' }>(); 
let cacheOperationLog: Array<{ operation: string; key: string; timestamp: number; success: boolean }> = [];
let connectionFailureMode = false;
let slowCacheMode = false;
let networkPartitionMode = false;

/**
 * Mock Cache Service
 */
export const mockCacheService = {
  // Basic cache operations with enhanced tracking
  get: vi.fn().mockImplementation(async <T>(key: string): Promise<T | null> => {
    if (connectionFailureMode || networkPartitionMode) {
      cacheOperationLog.push({ operation: 'get', key, timestamp: Date.now(), success: false });
      throw new Error('Redis connection lost');
    }
    
    if (slowCacheMode) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const cached = mockCache.get(key);
    cacheOperationLog.push({ operation: 'get', key, timestamp: Date.now(), success: true });
    
    if (!cached) return null;
    
    // Check expiry
    if (cached.expiry && Date.now() > cached.expiry) {
      mockCache.delete(key);
      persistenceTracker.delete(key);
      return null;
    }
    
    // Update access tracking
    cached.accessCount++;
    cached.lastAccess = Date.now();
    
    return cached.value;
  }),

  set: vi.fn().mockImplementation(async <T>(key: string, value: T, ttl?: number): Promise<boolean> => {
    if (connectionFailureMode) {
      cacheOperationLog.push({ operation: 'set', key, timestamp: Date.now(), success: false });
      persistenceTracker.set(key, { persisted: false, syncStatus: 'failed' });
      return false;
    }
    
    if (slowCacheMode) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const expiry = ttl ? Date.now() + (ttl * 1000) : undefined;
    mockCache.set(key, { 
      value, 
      expiry, 
      accessCount: 0, 
      lastAccess: Date.now() 
    });
    
    persistenceTracker.set(key, { persisted: true, syncStatus: 'success' });
    cacheOperationLog.push({ operation: 'set', key, timestamp: Date.now(), success: true });
    
    return true;
  }),

  del: vi.fn().mockImplementation(async (key: string | string[]): Promise<boolean> => {
    if (connectionFailureMode) {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach(k => cacheOperationLog.push({ operation: 'del', key: k, timestamp: Date.now(), success: false }));
      return false;
    }
    
    if (slowCacheMode) {
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    
    const keys = Array.isArray(key) ? key : [key];
    let deletedCount = 0;
    
    keys.forEach(k => {
      if (mockCache.delete(k)) {
        persistenceTracker.delete(k);
        deletedCount++;
      }
      cacheOperationLog.push({ operation: 'del', key: k, timestamp: Date.now(), success: true });
    });
    
    return deletedCount > 0;
  }),

  exists: vi.fn().mockImplementation(async (key: string | string[]): Promise<boolean | number> => {
    if (connectionFailureMode) {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach(k => cacheOperationLog.push({ operation: 'exists', key: k, timestamp: Date.now(), success: false }));
      throw new Error('Redis connection lost');
    }
    
    const keys = Array.isArray(key) ? key : [key];
    let existsCount = 0;
    
    keys.forEach(k => {
      const cached = mockCache.get(k);
      if (cached) {
        // Check expiry
        if (cached.expiry && Date.now() > cached.expiry) {
          mockCache.delete(k);
          persistenceTracker.delete(k);
        } else {
          existsCount++;
        }
      }
      cacheOperationLog.push({ operation: 'exists', key: k, timestamp: Date.now(), success: true });
    });
    
    return Array.isArray(key) ? existsCount : existsCount > 0;
  }),

  // Pattern operations with enhanced logging
  invalidatePattern: vi.fn().mockImplementation(async (pattern: string): Promise<number> => {
    if (connectionFailureMode) {
      cacheOperationLog.push({ operation: 'invalidatePattern', key: pattern, timestamp: Date.now(), success: false });
      throw new Error('Redis connection lost');
    }
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    let deleted = 0;
    
    const keysToDelete = Array.from(mockCache.keys()).filter(key => regex.test(key));
    
    keysToDelete.forEach(key => {
      mockCache.delete(key);
      persistenceTracker.delete(key);
      deleted++;
    });
    
    cacheOperationLog.push({ operation: 'invalidatePattern', key: pattern, timestamp: Date.now(), success: true });
    
    return deleted;
  }),
  
  // Additional pattern operations
  keys: vi.fn().mockImplementation(async (pattern: string): Promise<string[]> => {
    if (connectionFailureMode) {
      throw new Error('Redis connection lost');
    }
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    const matchingKeys: string[] = [];
    
    mockCache.forEach((entry, key) => {
      if (regex.test(key)) {
        // Check expiry while collecting keys
        if (entry.expiry && Date.now() > entry.expiry) {
          mockCache.delete(key);
          persistenceTracker.delete(key);
        } else {
          matchingKeys.push(key);
        }
      }
    });
    
    cacheOperationLog.push({ operation: 'keys', key: pattern, timestamp: Date.now(), success: true });
    return matchingKeys;
  }),

  // Rate limiting
  checkRateLimit: vi.fn().mockImplementation(async (
    identifier: string,
    action: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
    const key = `ratelimit:${action}:${identifier}`;
    const cached = mockCache.get(key);
    const now = Date.now();
    
    if (!cached) {
      // First request in window
      mockCache.set(key, { value: 1, expiry: now + (windowSeconds * 1000) });
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: now + (windowSeconds * 1000),
      };
    }
    
    // Check if window has expired
    if (cached.expiry && now > cached.expiry) {
      mockCache.set(key, { value: 1, expiry: now + (windowSeconds * 1000) });
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: now + (windowSeconds * 1000),
      };
    }
    
    // Increment counter
    const newCount = cached.value + 1;
    mockCache.set(key, { value: newCount, expiry: cached.expiry });
    
    return {
      allowed: newCount <= limit,
      remaining: Math.max(0, limit - newCount),
      resetTime: cached.expiry || now + (windowSeconds * 1000),
    };
  }),

  // Session management with enhanced tracking
  setUserSession: vi.fn().mockImplementation(async (
    userId: string,
    sessionId: string,
    data: any,
    ttl: number = 3600
  ): Promise<boolean> => {
    const key = `session:${userId}:${sessionId}`;
    cacheOperationLog.push({ operation: 'setUserSession', key, timestamp: Date.now(), success: true });
    return mockCacheService.set(key, data, ttl);
  }),

  getUserSession: vi.fn().mockImplementation(async <T>(
    userId: string,
    sessionId: string
  ): Promise<T | null> => {
    const key = `session:${userId}:${sessionId}`;
    cacheOperationLog.push({ operation: 'getUserSession', key, timestamp: Date.now(), success: true });
    return mockCacheService.get<T>(key);
  }),

  deleteUserSession: vi.fn().mockImplementation(async (
    userId: string,
    sessionId: string
  ): Promise<boolean> => {
    const key = `session:${userId}:${sessionId}`;
    cacheOperationLog.push({ operation: 'deleteUserSession', key, timestamp: Date.now(), success: true });
    return mockCacheService.del(key);
  }),

  // Webhook deduplication
  markWebhookProcessing: vi.fn().mockImplementation(async (
    webhookId: string,
    ttl: number = 300
  ): Promise<boolean> => {
    const key = `webhook:processing:${webhookId}`;
    const cached = mockCache.get(key);
    
    if (cached) {
      // Already processing
      return false;
    }
    
    mockCache.set(key, { value: '1', expiry: Date.now() + (ttl * 1000) });
    return true;
  }),

  isWebhookProcessing: vi.fn().mockImplementation(async (
    webhookId: string
  ): Promise<boolean> => {
    const key = `webhook:processing:${webhookId}`;
    return mockCacheService.exists(key);
  }),

  // Enhanced health check with diagnostics
  healthCheck: vi.fn().mockImplementation(async () => {
    if (connectionFailureMode) {
      return { 
        healthy: false, 
        error: 'Redis connection lost', 
        latency: 0,
        totalKeys: 0 
      };
    }
    
    const latency = slowCacheMode ? 100 : 1;
    return { 
      healthy: true, 
      latency,
      totalKeys: mockCache.size,
      operations: cacheOperationLog.length 
    };
  }),
  
  // TTL operations for better Redis compatibility
  ttl: vi.fn().mockImplementation(async (key: string): Promise<number> => {
    if (connectionFailureMode) {
      throw new Error('Redis connection lost');
    }
    
    const cached = mockCache.get(key);
    if (!cached) return -2; // Key doesn't exist
    if (!cached.expiry) return -1; // No expiry set
    
    const remaining = Math.max(0, cached.expiry - Date.now());
    return Math.ceil(remaining / 1000);
  }),
  
  expire: vi.fn().mockImplementation(async (key: string, ttl: number): Promise<boolean> => {
    if (connectionFailureMode) {
      return false;
    }
    
    const cached = mockCache.get(key);
    if (!cached) return false;
    
    cached.expiry = Date.now() + (ttl * 1000);
    cacheOperationLog.push({ operation: 'expire', key, timestamp: Date.now(), success: true });
    return true;
  }),
  
  // Multi-get operation
  mget: vi.fn().mockImplementation(async (keys: string[]): Promise<Array<any | null>> => {
    if (connectionFailureMode) {
      throw new Error('Redis connection lost');
    }
    
    const results = keys.map(key => {
      const cached = mockCache.get(key);
      if (!cached) return null;
      
      if (cached.expiry && Date.now() > cached.expiry) {
        mockCache.delete(key);
        persistenceTracker.delete(key);
        return null;
      }
      
      cached.accessCount++;
      cached.lastAccess = Date.now();
      return cached.value;
    });
    
    cacheOperationLog.push({ operation: 'mget', key: keys.join(','), timestamp: Date.now(), success: true });
    return results;
  }),
  
  // Increment/decrement operations
  incr: vi.fn().mockImplementation(async (key: string): Promise<number> => {
    if (connectionFailureMode) {
      throw new Error('Redis connection lost');
    }
    
    const cached = mockCache.get(key);
    const currentValue = cached ? (typeof cached.value === 'number' ? cached.value : 0) : 0;
    const newValue = currentValue + 1;
    
    mockCache.set(key, {
      value: newValue,
      expiry: cached?.expiry,
      accessCount: cached ? cached.accessCount + 1 : 1,
      lastAccess: Date.now()
    });
    
    persistenceTracker.set(key, { persisted: true, syncStatus: 'success' });
    cacheOperationLog.push({ operation: 'incr', key, timestamp: Date.now(), success: true });
    
    return newValue;
  }),
  
  decr: vi.fn().mockImplementation(async (key: string): Promise<number> => {
    if (connectionFailureMode) {
      throw new Error('Redis connection lost');
    }
    
    const cached = mockCache.get(key);
    const currentValue = cached ? (typeof cached.value === 'number' ? cached.value : 0) : 0;
    const newValue = currentValue - 1;
    
    mockCache.set(key, {
      value: newValue,
      expiry: cached?.expiry,
      accessCount: cached ? cached.accessCount + 1 : 1,
      lastAccess: Date.now()
    });
    
    persistenceTracker.set(key, { persisted: true, syncStatus: 'success' });
    cacheOperationLog.push({ operation: 'decr', key, timestamp: Date.now(), success: true });
    
    return newValue;
  }),
};

/**
 * Enhanced error simulation utilities
 */
export const simulateCacheError = (
  errorType: 'connection' | 'timeout' | 'memory' = 'connection',
  affectedOperations: Array<keyof typeof mockCacheService> = ['get', 'set', 'del']
) => {
  const errorMap = {
    connection: new Error('Redis connection lost'),
    timeout: new Error('Redis operation timed out'),  
    memory: new Error('Redis out of memory'),
  };

  const error = errorMap[errorType];
  
  if (affectedOperations.length === 0 || affectedOperations.includes('get' as any)) {
    // Enable global failure mode
    connectionFailureMode = true;
    setTimeout(() => {
      connectionFailureMode = false;
    }, 1000); // Auto-recover after 1 second
  } else {
    // Make specified operations fail temporarily
    affectedOperations.forEach(operation => {
      if (mockCacheService[operation]) {
        (mockCacheService[operation] as any).mockRejectedValueOnce(error);
      }
    });
  }
};

/**
 * Set connection failure mode
 */
export const setConnectionFailureMode = (enabled: boolean) => {
  connectionFailureMode = enabled;
};

/**
 * Set slow cache mode for timeout testing
 */
export const setSlowCacheMode = (enabled: boolean) => {
  slowCacheMode = enabled;
};

/**
 * Simulate network partition
 */
export const setNetworkPartitionMode = (enabled: boolean) => {
  networkPartitionMode = enabled;
};

/**
 * Simulate slow cache operations
 */
export const simulateSlowCache = (delayMs: number = 1000) => {
  Object.values(mockCacheService).forEach(method => {
    if (typeof method === 'function') {
      method.mockImplementationOnce(async (...args: any[]) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        // Call original implementation
        return method.getMockImplementation()?.(...args);
      });
    }
  });
};

/**
 * Enhanced reset cache mocks with comprehensive cleanup
 */
export const resetCacheMocks = () => {
  mockCache.clear();
  persistenceTracker.clear();
  cacheOperationLog = [];
  connectionFailureMode = false;
  slowCacheMode = false;
  networkPartitionMode = false;
  
  // Reset all mock functions
  Object.values(mockCacheService).forEach(method => {
    if (typeof method === 'function' && method.mockClear) {
      method.mockClear();
    }
  });
};

/**
 * Get current cache state with enhanced metadata
 */
export const getMockCacheState = () => {
  const state: Record<string, any> = {};
  const metadata: Record<string, any> = {};
  
  for (const [key, cached] of mockCache) {
    // Check if not expired
    if (!cached.expiry || Date.now() <= cached.expiry) {
      state[key] = cached.value;
      metadata[key] = {
        accessCount: cached.accessCount,
        lastAccess: cached.lastAccess,
        hasExpiry: !!cached.expiry,
        ttlRemaining: cached.expiry ? Math.max(0, Math.ceil((cached.expiry - Date.now()) / 1000)) : null,
        persistenceStatus: persistenceTracker.get(key),
      };
    }
  }
  
  return { data: state, metadata, totalKeys: mockCache.size };
};

/**
 * Set cache state for testing with enhanced tracking
 */
export const setMockCacheState = (state: Record<string, any>, ttl?: number) => {
  mockCache.clear();
  persistenceTracker.clear();
  const expiry = ttl ? Date.now() + (ttl * 1000) : undefined;
  
  for (const [key, value] of Object.entries(state)) {
    mockCache.set(key, { 
      value, 
      expiry, 
      accessCount: 0, 
      lastAccess: Date.now() 
    });
    persistenceTracker.set(key, { persisted: true, syncStatus: 'success' });
  }
};

/**
 * Advance time to expire cached items
 */
export const advanceTime = (ms: number) => {
  // This would need to be combined with vi.advanceTimersByTime() in tests
  // For now, just manually expire items
  const cutoff = Date.now() + ms;
  for (const [key, cached] of mockCache) {
    if (cached.expiry && cached.expiry < cutoff) {
      mockCache.delete(key);
    }
  }
};

/**
 * Enhanced cache statistics for comprehensive monitoring
 */
export const getCacheStats = () => {
  let expiredKeys = 0;
  let totalAccesses = 0;
  
  mockCache.forEach(cached => {
    if (cached.expiry && Date.now() > cached.expiry) {
      expiredKeys++;
    }
    totalAccesses += cached.accessCount;
  });
  
  const successfulOps = cacheOperationLog.filter(op => op.success).length;
  const failedOps = cacheOperationLog.filter(op => !op.success).length;
  const persistedKeys = Array.from(persistenceTracker.values()).filter(p => p.persisted).length;
  const failedPersistence = Array.from(persistenceTracker.values()).filter(p => p.syncStatus === 'failed').length;
  
  return {
    totalKeys: mockCache.size,
    expiredKeys,
    totalAccesses,
    memoryUsage: JSON.stringify(Object.fromEntries(mockCache)).length,
    operations: {
      total: cacheOperationLog.length,
      successful: successfulOps,
      failed: failedOps,
      recentOperations: cacheOperationLog.slice(-10),
    },
    persistence: {
      total: persistenceTracker.size,
      persisted: persistedKeys,
      failed: failedPersistence,
      syncRatio: persistenceTracker.size > 0 ? persistedKeys / persistenceTracker.size : 1,
    },
    modes: {
      connectionFailure: connectionFailureMode,
      slowCache: slowCacheMode,
      networkPartition: networkPartitionMode,
    },
  };
};

/**
 * Get cache synchronization status
 */
export const getCacheSyncStatus = () => {
  const total = persistenceTracker.size;
  const synced = Array.from(persistenceTracker.values()).filter(p => p.syncStatus === 'success').length;
  const failed = Array.from(persistenceTracker.values()).filter(p => p.syncStatus === 'failed').length;
  const pending = Array.from(persistenceTracker.values()).filter(p => p.syncStatus === 'pending').length;
  
  return { total, synced, failed, pending, syncRatio: total > 0 ? synced / total : 1 };
};

/**
 * Wait for cache operations to complete (useful for async testing)
 */
export const waitForCacheOperations = async (timeoutMs = 1000) => {
  if (slowCacheMode) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return true;
};

// Enhanced exports for comprehensive testing
export {
  mockCacheService as default,
  connectionFailureMode,
  slowCacheMode,
  networkPartitionMode,
};

// Test utilities for complex scenarios
export const CacheTestUtils = {
  simulateCacheError,
  setConnectionFailureMode,
  setSlowCacheMode,
  setNetworkPartitionMode,
  resetCacheMocks,
  getMockCacheState,
  setMockCacheState,
  getCacheStats,
  getCacheSyncStatus,
  waitForCacheOperations,
  advanceTime,
};

// Mock Redis client for direct instantiation  
export const MockRedisClient = vi.fn().mockImplementation(() => mockCacheService);

// Cache event emitter for testing pub/sub patterns
export const mockCacheEvents = {
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Simulate cache warming functionality
export const simulateCacheWarming = async (keys: string[], data: Record<string, any>) => {
  for (const key of keys) {
    if (data[key] !== undefined) {
      await mockCacheService.set(key, data[key], 3600);
    }
  }
};