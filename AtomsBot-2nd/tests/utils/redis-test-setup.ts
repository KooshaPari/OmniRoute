/**
 * Redis Test Setup and Utilities
 * 
 * Test-specific Redis database configuration with cleanup utilities
 * and isolated test instances for integration testing.
 */

import Redis from 'ioredis';
import { logger } from '../../src/logger';
import { createRedisClient, closeRedisConnection } from '../../src/cache/redis';

// Test Redis configuration
export interface TestRedisConfig {
  host?: string;
  port?: number;
  db?: number;
  keyPrefix?: string;
  flushOnSetup?: boolean;
  isolateTests?: boolean;
}

// Global test Redis client
let testRedisClient: Redis | null = null;
let testRedisConfig: TestRedisConfig | null = null;

/**
 * Setup Redis for integration tests
 */
export async function setupTestRedis(config: TestRedisConfig = {}): Promise<Redis> {
  try {
    testRedisConfig = {
      host: config.host || process.env.TEST_REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.TEST_REDIS_PORT || '6380'), // Different port for tests
      db: config.db || parseInt(process.env.TEST_REDIS_DB || '15'), // Use DB 15 for tests
      keyPrefix: config.keyPrefix || 'atomsbot:test:',
      flushOnSetup: config.flushOnSetup !== false, // Default to true
      isolateTests: config.isolateTests !== false, // Default to true
    };

    // Create test Redis client
    testRedisClient = createRedisClient({
      host: testRedisConfig.host!,
      port: testRedisConfig.port!,
      db: testRedisConfig.db,
      keyPrefix: testRedisConfig.keyPrefix,
      lazyConnect: true,
    });

    // Test connection
    try {
      await (testRedisClient as Redis).ping();
      logger.info(`Test Redis connected to ${testRedisConfig.host}:${testRedisConfig.port}/${testRedisConfig.db}`);
    } catch (error) {
      logger.warn('Redis not available for testing, using mock implementation');
      return createMockRedisClient();
    }

    // Flush test database if requested
    if (testRedisConfig.flushOnSetup) {
      await flushTestRedis();
    }

    return testRedisClient as Redis;

  } catch (error) {
    logger.error('Failed to setup test Redis:', error);
    // Fall back to mock Redis client for tests
    return createMockRedisClient();
  }
}

/**
 * Teardown test Redis
 */
export async function teardownTestRedis(): Promise<void> {
  try {
    if (testRedisClient && !(testRedisClient as any).__isMock) {
      // Clean up test data
      await flushTestRedis();
      
      // Close connection
      await testRedisClient.quit();
      testRedisClient = null;
      testRedisConfig = null;
      
      logger.info('Test Redis connection closed');
    }
  } catch (error) {
    logger.error('Failed to teardown test Redis:', error);
  }
}

/**
 * Get test Redis client
 */
export function getTestRedisClient(): Redis {
  if (!testRedisClient) {
    throw new Error('Test Redis not initialized. Call setupTestRedis first.');
  }
  return testRedisClient as Redis;
}

/**
 * Flush test Redis database
 */
export async function flushTestRedis(): Promise<void> {
  if (!testRedisClient || (testRedisClient as any).__isMock) {
    return;
  }

  try {
    // Only flush the specific test database
    await testRedisClient.flushdb();
    logger.debug('Test Redis database flushed');
  } catch (error) {
    logger.error('Failed to flush test Redis:', error);
    throw error;
  }
}

/**
 * Create isolated test Redis namespace for a specific test
 */
export function createTestRedisNamespace(testId: string): {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<'OK'>;
  del: (key: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  flushNamespace: () => Promise<void>;
} {
  const client = getTestRedisClient();
  const namespace = `test:${testId}:`;

  return {
    async get(key: string) {
      return client.get(`${namespace}${key}`);
    },
    
    async set(key: string, value: string, ttl?: number) {
      if (ttl) {
        return client.setex(`${namespace}${key}`, ttl, value);
      }
      return client.set(`${namespace}${key}`, value);
    },
    
    async del(key: string) {
      return client.del(`${namespace}${key}`);
    },
    
    async keys(pattern: string) {
      return client.keys(`${namespace}${pattern}`);
    },
    
    async flushNamespace() {
      const keys = await client.keys(`${namespace}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    },
  };
}

/**
 * Create mock Redis client for testing when Redis is not available
 */
function createMockRedisClient(): Redis {
  const mockData = new Map<string, { value: string; expires?: number }>();

  const mockClient = {
    __isMock: true,
    
    async ping(): Promise<string> {
      return 'PONG';
    },
    
    async get(key: string): Promise<string | null> {
      const item = mockData.get(key);
      if (!item) return null;
      
      if (item.expires && Date.now() > item.expires) {
        mockData.delete(key);
        return null;
      }
      
      return item.value;
    },
    
    async set(key: string, value: string): Promise<'OK'> {
      mockData.set(key, { value });
      return 'OK';
    },
    
    async setex(key: string, seconds: number, value: string): Promise<'OK'> {
      mockData.set(key, { 
        value, 
        expires: Date.now() + (seconds * 1000) 
      });
      return 'OK';
    },
    
    async del(...keys: string[]): Promise<number> {
      let deleted = 0;
      for (const key of keys) {
        if (mockData.has(key)) {
          mockData.delete(key);
          deleted++;
        }
      }
      return deleted;
    },
    
    async exists(key: string): Promise<number> {
      const item = mockData.get(key);
      if (!item) return 0;
      
      if (item.expires && Date.now() > item.expires) {
        mockData.delete(key);
        return 0;
      }
      
      return 1;
    },
    
    async keys(pattern: string): Promise<string[]> {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const matchingKeys: string[] = [];
      
      for (const [key, item] of mockData) {
        if (item.expires && Date.now() > item.expires) {
          mockData.delete(key);
          continue;
        }
        
        if (regex.test(key)) {
          matchingKeys.push(key);
        }
      }
      
      return matchingKeys;
    },
    
    async incr(key: string): Promise<number> {
      const current = await this.get(key);
      const newValue = (parseInt(current || '0') + 1).toString();
      await this.set(key, newValue);
      return parseInt(newValue);
    },
    
    async ttl(key: string): Promise<number> {
      const item = mockData.get(key);
      if (!item) return -2;
      if (!item.expires) return -1;
      
      const remaining = Math.ceil((item.expires - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },
    
    async expire(key: string, seconds: number): Promise<number> {
      const item = mockData.get(key);
      if (!item) return 0;
      
      mockData.set(key, {
        ...item,
        expires: Date.now() + (seconds * 1000)
      });
      return 1;
    },
    
    async flushdb(): Promise<'OK'> {
      mockData.clear();
      return 'OK';
    },
    
    async quit(): Promise<'OK'> {
      mockData.clear();
      return 'OK';
    },
    
    on(event: string, handler: Function) {
      // Mock event handling
      return this;
    },
  } as any;

  logger.info('Using mock Redis client for testing');
  return mockClient;
}

/**
 * Verify Redis test environment
 */
export async function verifyTestRedisEnvironment(): Promise<{
  isConnected: boolean;
  isMock: boolean;
  stats: { keys: number; memory?: string };
}> {
  try {
    const client = getTestRedisClient();
    const isMock = !!(client as any).__isMock;
    
    if (isMock) {
      return {
        isConnected: true,
        isMock: true,
        stats: { keys: 0 }, // Mock doesn't track memory
      };
    }
    
    const isConnected = await client.ping() === 'PONG';
    const keys = await client.keys('*');
    // Use MEMORY STATS for compatibility with ioredis typings
    const memoryStats = await client.memory('STATS').catch(() => undefined as unknown[] | undefined);
    let memory: string | undefined;
    if (Array.isArray(memoryStats)) {
      // MEMORY STATS returns a flat array of key/value pairs. Try common fields.
      const entries = memoryStats as any[];
      const findNumber = (label: string): number | undefined => {
        const idx = entries.indexOf(label);
        const val = idx !== -1 ? entries[idx + 1] : undefined;
        return typeof val === 'number' ? val : undefined;
      };
      const bytes =
        findNumber('total.allocated') ??
        findNumber('peak.allocated') ??
        findNumber('dataset.bytes');
      if (typeof bytes === 'number' && Number.isFinite(bytes)) {
        memory = `${bytes} bytes`;
      }
    }
    
    return {
      isConnected,
      isMock: false,
      stats: { 
        keys: keys.length,
        memory,
      },
    };
  } catch (error) {
    return {
      isConnected: false,
      isMock: false,
      stats: { keys: 0 },
    };
  }
}

/**
 * Create test-specific Redis keys with automatic cleanup
 */
export class TestRedisKeys {
  private keys: Set<string> = new Set();
  private client: Redis;
  
  constructor(private testId: string) {
    this.client = getTestRedisClient();
  }
  
  private getKey(key: string): string {
    const fullKey = `test:${this.testId}:${key}`;
    this.keys.add(fullKey);
    return fullKey;
  }
  
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    const fullKey = this.getKey(key);
    if (ttl) {
      return this.client.setex(fullKey, ttl, value);
    }
    return this.client.set(fullKey, value);
  }
  
  async get(key: string): Promise<string | null> {
    return this.client.get(this.getKey(key));
  }
  
  async del(key: string): Promise<number> {
    const fullKey = this.getKey(key);
    this.keys.delete(fullKey);
    return this.client.del(fullKey);
  }
  
  async cleanup(): Promise<void> {
    if (this.keys.size > 0) {
      await this.client.del(...Array.from(this.keys));
      this.keys.clear();
    }
  }
}

export default {
  setupTestRedis,
  teardownTestRedis,
  getTestRedisClient,
  flushTestRedis,
  createTestRedisNamespace,
  verifyTestRedisEnvironment,
  TestRedisKeys,
};