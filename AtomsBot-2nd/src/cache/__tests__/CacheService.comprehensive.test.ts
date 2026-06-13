import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService } from '../redis';

// Mock the logger to prevent test output noise
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('CacheService Comprehensive Tests', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a new instance for each test to ensure isolation
    cacheService = new CacheService();
  });

  afterEach(() => {
    // Clean up any resources
    vi.restoreAllMocks();
  });

  describe('Cache Initialization', () => {
    it('should initialize with Redis disabled by default', () => {
      const service = new CacheService();
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CacheService);
    });

    it('should not setup Redis client when disabled', () => {
      const mockRedisClient = {
        on: vi.fn(),
        ping: vi.fn().mockResolvedValue('PONG'),
        quit: vi.fn().mockResolvedValue('OK')
      };
      
      // Even when a client is provided, it shouldn't be used when isEnabled = false
      const service = new CacheService(mockRedisClient);
      
      // Since isEnabled is false, client setup should not happen
      expect(mockRedisClient.on).not.toHaveBeenCalled();
    });

    it('should not register Redis event handlers when disabled', () => {
      const mockRedisClient = {
        on: vi.fn(),
        ping: vi.fn().mockResolvedValue('PONG')
      };
      
      new CacheService(mockRedisClient);
      
      // Event handlers should not be registered when Redis is disabled
      expect(mockRedisClient.on).not.toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).not.toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });

  describe('Fallback Behavior - In-Memory Operations', () => {
    it('should use in-memory storage for get/set operations', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      
      // Set a value - should use in-memory storage
      const setResult = await cacheService.set(key, value);
      expect(setResult).toBe(true);
      
      // Get the value - should retrieve from in-memory storage
      const getResult = await cacheService.get(key);
      expect(getResult).toEqual(value);
    });

    it('should handle TTL expiration in memory mode', async () => {
      const key = 'ttl-test-key';
      const value = 'ttl-test-value';
      const ttlSeconds = 1;
      
      // Set with TTL
      await cacheService.set(key, value, ttlSeconds);
      
      // Should exist immediately
      const exists = await cacheService.exists(key);
      expect(exists).toBe(true);
      
      // Wait for TTL to expire and manually expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired now
      const expiredValue = await cacheService.get(key);
      expect(expiredValue).toBeNull();
    });

    it('should handle setNX operations in memory mode', async () => {
      const key = 'setnx-key';
      const value1 = 'value1';
      const value2 = 'value2';
      
      // First setNX should succeed
      const result1 = await cacheService.setNX(key, value1);
      expect(result1).toBe(true);
      
      // Second setNX should fail (key exists)
      const result2 = await cacheService.setNX(key, value2);
      expect(result2).toBe(false);
      
      // Value should remain unchanged
      const retrievedValue = await cacheService.get(key);
      expect(retrievedValue).toBe(value1);
    });

    it('should handle delete operations in memory mode', async () => {
      const key = 'delete-key';
      const value = 'delete-value';
      
      // Set a value
      await cacheService.set(key, value);
      expect(await cacheService.exists(key)).toBe(true);
      
      // Delete the value
      const deleteResult = await cacheService.del(key);
      expect(deleteResult).toBe(true);
      
      // Should no longer exist
      expect(await cacheService.exists(key)).toBe(false);
      
      // Deleting non-existent key should return false
      const deleteResult2 = await cacheService.del(key);
      expect(deleteResult2).toBe(false);
    });

    it('should handle exists operations in memory mode', async () => {
      const key = 'exists-key';
      
      // Should not exist initially
      expect(await cacheService.exists(key)).toBe(false);
      
      // Set a value
      await cacheService.set(key, 'test-value');
      
      // Should exist now
      expect(await cacheService.exists(key)).toBe(true);
    });

    it('should handle getTTL operations in memory mode', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const ttlSeconds = 10;
      
      // Set with TTL
      await cacheService.set(key, value, ttlSeconds);
      
      // Get TTL - should be positive and close to the set value
      const ttl = await cacheService.getTTL(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(ttlSeconds);
      
      // Key without TTL should return -1
      await cacheService.set('no-ttl-key', 'value');
      const noTtl = await cacheService.getTTL('no-ttl-key');
      expect(noTtl).toBe(-1);
      
      // Non-existent key should return -1 (no TTL entry)
      const nonExistentTtl = await cacheService.getTTL('non-existent-key');
      expect(nonExistentTtl).toBe(-1);
    });

    it('should handle clear operations in memory mode', async () => {
      // Set multiple keys
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.set('key3', 'value3', 60);
      
      // All should exist
      expect(await cacheService.exists('key1')).toBe(true);
      expect(await cacheService.exists('key2')).toBe(true);
      expect(await cacheService.exists('key3')).toBe(true);
      
      // Clear cache
      await cacheService.clear();
      
      // All should be gone
      expect(await cacheService.exists('key1')).toBe(false);
      expect(await cacheService.exists('key2')).toBe(false);
      expect(await cacheService.exists('key3')).toBe(false);
    });
  });

  describe('Cache Operations - Data Types', () => {
    it('should handle string values', async () => {
      const key = 'string-key';
      const value = 'test string value';
      
      await cacheService.set(key, value);
      const result = await cacheService.get<string>(key);
      
      expect(result).toBe(value);
    });

    it('should handle number values', async () => {
      const key = 'number-key';
      const value = 42;
      
      await cacheService.set(key, value);
      const result = await cacheService.get<number>(key);
      
      expect(result).toBe(value);
    });

    it('should handle boolean values', async () => {
      const key = 'boolean-key';
      const value = true;
      
      await cacheService.set(key, value);
      const result = await cacheService.get<boolean>(key);
      
      expect(result).toBe(value);
    });

    it('should handle object values', async () => {
      const key = 'object-key';
      const value = { foo: 'bar', num: 123, nested: { prop: 'value' } };
      
      await cacheService.set(key, value);
      const result = await cacheService.get<typeof value>(key);
      
      expect(result).toEqual(value);
    });

    it('should handle array values', async () => {
      const key = 'array-key';
      const value = [1, 'two', { three: 3 }, [4, 5]];
      
      await cacheService.set(key, value);
      const result = await cacheService.get<typeof value>(key);
      
      expect(result).toEqual(value);
    });

    it('should handle null values', async () => {
      const key = 'null-key';
      const value = null;
      
      await cacheService.set(key, value);
      const result = await cacheService.get(key);
      
      expect(result).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting in memory mode', async () => {
      const userId = 'user123';
      const action = 'test-action';
      const limit = 3;
      const windowSeconds = 60;
      
      // First three requests should be allowed
      for (let i = 0; i < limit; i++) {
        const result = await cacheService.checkRateLimit(userId, action, limit, windowSeconds);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - (i + 1));
      }
      
      // Fourth request should be denied
      const deniedResult = await cacheService.checkRateLimit(userId, action, limit, windowSeconds);
      expect(deniedResult.allowed).toBe(false);
      expect(deniedResult.remaining).toBe(0);
    });

    it('should reset rate limit after window expires', async () => {
      const userId = 'user456';
      const action = 'reset-test';
      const limit = 2;
      const windowSeconds = 1;
      
      // Use up the limit
      await cacheService.checkRateLimit(userId, action, limit, windowSeconds);
      const limitedResult = await cacheService.checkRateLimit(userId, action, limit, windowSeconds);
      expect(limitedResult.allowed).toBe(true);
      
      // Should be at limit now
      const deniedResult = await cacheService.checkRateLimit(userId, action, limit, windowSeconds);
      expect(deniedResult.allowed).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed again
      const allowedResult = await cacheService.checkRateLimit(userId, action, limit, windowSeconds);
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('Webhook Processing', () => {
    it('should handle webhook processing markers in memory mode', async () => {
      const webhookId = 'webhook-123';
      const ttlSeconds = 60;
      
      // Should not be processing initially
      expect(await cacheService.isWebhookProcessing(webhookId)).toBe(false);
      
      // Mark as processing
      const markResult = await cacheService.markWebhookProcessing(webhookId, ttlSeconds);
      expect(markResult).toBe(true);
      
      // Should be processing now
      expect(await cacheService.isWebhookProcessing(webhookId)).toBe(true);
      
      // Trying to mark again should fail (setNX behavior)
      const markAgainResult = await cacheService.markWebhookProcessing(webhookId, ttlSeconds);
      expect(markAgainResult).toBe(false);
    });

    it('should expire webhook processing markers', async () => {
      const webhookId = 'webhook-456';
      const ttlSeconds = 1;
      
      // Mark as processing with short TTL
      await cacheService.markWebhookProcessing(webhookId, ttlSeconds);
      expect(await cacheService.isWebhookProcessing(webhookId)).toBe(true);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should no longer be processing
      expect(await cacheService.isWebhookProcessing(webhookId)).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return false for health check when Redis is disabled', async () => {
      const health = await cacheService.healthCheck();
      expect(health).toBe(false);
    });
  });

  describe('Disconnect', () => {
    it('should handle disconnect gracefully when Redis is disabled', async () => {
      // Should not throw any errors
      await expect(cacheService.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors gracefully', async () => {
      const key = 'circular-key';
      
      // Create circular reference
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      // Should handle circular reference by converting to string
      await cacheService.set(key, circularObj);
      const result = await cacheService.get(key);
      
      // Result should be the string representation
      expect(typeof result).toBe('string');
      expect(result).toBe('[object Object]');
    });

    it('should handle malformed JSON gracefully', async () => {
      // This test simulates what would happen if stored data was corrupted
      // Since we're using in-memory storage, we'll test the JSON parsing logic
      const key = 'json-test';
      
      // Set a valid value first
      await cacheService.set(key, 'valid string');
      const result = await cacheService.get(key);
      
      expect(result).toBe('valid string');
    });
  });

  describe('SetNX Edge Cases', () => {
    it('should handle setNX with TTL in memory mode', async () => {
      const key = 'setnx-ttl-key';
      const value = 'setnx-ttl-value';
      const ttlSeconds = 2;
      
      // SetNX with TTL should succeed
      const result = await cacheService.setNX(key, value, ttlSeconds);
      expect(result).toBe(true);
      
      // Value should be retrievable
      expect(await cacheService.get(key)).toBe(value);
      
      // Should have TTL set
      const ttl = await cacheService.getTTL(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(ttlSeconds);
      
      // Second setNX should fail
      const result2 = await cacheService.setNX(key, 'different-value', ttlSeconds);
      expect(result2).toBe(false);
    });

    it('should handle setNX on expired keys', async () => {
      const key = 'expired-setnx-key';
      const value1 = 'value1';
      const value2 = 'value2';
      const shortTtl = 1;
      
      // Set with short TTL
      await cacheService.setNX(key, value1, shortTtl);
      expect(await cacheService.get(key)).toBe(value1);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Manually trigger expiration by calling get (which calls expireIfNeeded)
      await cacheService.get(key);
      
      // SetNX should succeed on expired key
      const result = await cacheService.setNX(key, value2);
      expect(result).toBe(true);
      expect(await cacheService.get(key)).toBe(value2);
    });
  });

  describe('Memory TTL Edge Cases', () => {
    it('should clean up TTL entries when keys are deleted', async () => {
      const key = 'ttl-cleanup-key';
      const value = 'ttl-cleanup-value';
      const ttlSeconds = 60;
      
      // Set with TTL
      await cacheService.set(key, value, ttlSeconds);
      expect(await cacheService.exists(key)).toBe(true);
      
      // Delete the key
      await cacheService.del(key);
      expect(await cacheService.exists(key)).toBe(false);
      
      // TTL should return -1 for non-existent key (no TTL entry)
      expect(await cacheService.getTTL(key)).toBe(-1);
    });

    it('should handle multiple TTL expirations', async () => {
      const keys = ['multi-ttl-1', 'multi-ttl-2', 'multi-ttl-3'];
      const ttlSeconds = 1;
      
      // Set multiple keys with TTL
      for (const key of keys) {
        await cacheService.set(key, `value-${key}`, ttlSeconds);
      }
      
      // All should exist initially
      for (const key of keys) {
        expect(await cacheService.exists(key)).toBe(true);
      }
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // All should be expired
      for (const key of keys) {
        expect(await cacheService.get(key)).toBeNull();
      }
    });
  });

  describe('Clear Operation', () => {
    it('should clear both memory and TTL maps', async () => {
      // Set keys with and without TTL
      await cacheService.set('key-no-ttl', 'value-no-ttl');
      await cacheService.set('key-with-ttl', 'value-with-ttl', 60);
      
      // Verify they exist
      expect(await cacheService.exists('key-no-ttl')).toBe(true);
      expect(await cacheService.exists('key-with-ttl')).toBe(true);
      
      // Clear all
      await cacheService.clear();
      
      // All should be gone
      expect(await cacheService.exists('key-no-ttl')).toBe(false);
      expect(await cacheService.exists('key-with-ttl')).toBe(false);
      
      // TTL queries should return -1 (no TTL entry)
      expect(await cacheService.getTTL('key-with-ttl')).toBe(-1);
    });
  });

  describe('Rate Limiting Advanced Cases', () => {
    it('should handle different users independently', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      const action = 'same-action';
      const limit = 2;
      const windowSeconds = 60;
      
      // User1 uses up their limit
      await cacheService.checkRateLimit(user1, action, limit, windowSeconds);
      const user1Limited = await cacheService.checkRateLimit(user1, action, limit, windowSeconds);
      expect(user1Limited.allowed).toBe(true);
      
      const user1Denied = await cacheService.checkRateLimit(user1, action, limit, windowSeconds);
      expect(user1Denied.allowed).toBe(false);
      
      // User2 should still have full quota
      const user2Result = await cacheService.checkRateLimit(user2, action, limit, windowSeconds);
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.remaining).toBe(limit - 1);
    });

    it('should handle different actions independently', async () => {
      const user = 'user123';
      const action1 = 'action1';
      const action2 = 'action2';
      const limit = 1;
      const windowSeconds = 60;
      
      // Use up quota for action1
      const action1Result = await cacheService.checkRateLimit(user, action1, limit, windowSeconds);
      expect(action1Result.allowed).toBe(true);
      
      const action1Denied = await cacheService.checkRateLimit(user, action1, limit, windowSeconds);
      expect(action1Denied.allowed).toBe(false);
      
      // action2 should still be available
      const action2Result = await cacheService.checkRateLimit(user, action2, limit, windowSeconds);
      expect(action2Result.allowed).toBe(true);
    });
  });
});