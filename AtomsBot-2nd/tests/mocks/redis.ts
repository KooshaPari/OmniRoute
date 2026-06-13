/**
 * Redis Cache Service Mock Implementation
 * 
 * Comprehensive mock for Redis caching operations including:
 * - Key-value storage with TTL support
 * - Pattern matching and bulk operations
 * - Connection management and error handling
 * - Memory simulation for testing cache behavior
 */

import { vi } from "vitest";

interface CacheEntry {
  value: any;
  expiry?: number;
  createdAt: number;
}

/**
 * Mock Redis Cache Service
 */
export class MockCacheService {
  private cache = new Map<string, CacheEntry>();
  private isConnected = true;
  private connectionError: Error | null = null;

  // Core cache operations
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      throw this.connectionError || new Error('Redis connection failed');
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      throw this.connectionError || new Error('Redis connection failed');
    }

    const entry: CacheEntry = {
      value,
      createdAt: Date.now(),
    };

    if (ttlSeconds) {
      entry.expiry = Date.now() + (ttlSeconds * 1000);
    }

    this.cache.set(key, entry);
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      throw this.connectionError || new Error('Redis connection failed');
    }

    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      throw this.connectionError || new Error('Redis connection failed');
    }

    return this.cache.has(key);
  }

  // Bulk operations
  async mget<T = any>(keys: string[]): Promise<Array<T | null>> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async mdel(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.del(key);
    }
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) {
      throw this.connectionError || new Error('Redis connection failed');
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    await this.mdel(keys);
    return keys.length;
  }

  // Advanced operations
  async incr(key: string): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + 1;
    await this.set(key, newValue);
    return newValue;
  }

  async decr(key: string): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current - 1;
    await this.set(key, newValue);
    return newValue;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expiry = Date.now() + (ttlSeconds * 1000);
      this.cache.set(key, entry);
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) {
      return -2; // Key doesn't exist
    }

    if (!entry.expiry) {
      return -1; // No expiry set
    }

    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2; // Expired
  }

  // List operations
  async lpush(key: string, value: any): Promise<number> {
    const list = await this.get<any[]>(key) || [];
    list.unshift(value);
    await this.set(key, list);
    return list.length;
  }

  async rpush(key: string, value: any): Promise<number> {
    const list = await this.get<any[]>(key) || [];
    list.push(value);
    await this.set(key, list);
    return list.length;
  }

  async lpop(key: string): Promise<any> {
    const list = await this.get<any[]>(key);
    if (!list || list.length === 0) {
      return null;
    }
    const value = list.shift();
    await this.set(key, list);
    return value;
  }

  async rpop(key: string): Promise<any> {
    const list = await this.get<any[]>(key);
    if (!list || list.length === 0) {
      return null;
    }
    const value = list.pop();
    await this.set(key, list);
    return value;
  }

  async llen(key: string): Promise<number> {
    const list = await this.get<any[]>(key);
    return list ? list.length : 0;
  }

  // Hash operations
  async hset(key: string, field: string, value: any): Promise<void> {
    const hash = await this.get<Record<string, any>>(key) || {};
    hash[field] = value;
    await this.set(key, hash);
  }

  async hget(key: string, field: string): Promise<any> {
    const hash = await this.get<Record<string, any>>(key);
    return hash ? hash[field] : null;
  }

  async hgetall(key: string): Promise<Record<string, any> | null> {
    return this.get<Record<string, any>>(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    const hash = await this.get<Record<string, any>>(key);
    if (hash) {
      delete hash[field];
      await this.set(key, hash);
    }
  }

  // Utility methods
  async clear(): Promise<void> {
    this.cache.clear();
  }

  async flushall(): Promise<void> {
    await this.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Connection management
  connect(): Promise<void> {
    this.isConnected = true;
    this.connectionError = null;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.isConnected = false;
    return Promise.resolve();
  }

  isReady(): boolean {
    return this.isConnected;
  }

  // Test utilities
  simulateConnectionError(error?: Error): void {
    this.isConnected = false;
    this.connectionError = error || new Error('Simulated Redis connection failure');
  }

  simulateConnectionRestore(): void {
    this.isConnected = true;
    this.connectionError = null;
  }

  // Get internal state for testing
  getCacheState(): Map<string, CacheEntry> {
    return new Map(this.cache);
  }

  setCacheState(state: Map<string, CacheEntry>): void {
    this.cache = new Map(state);
  }

  // Manually expire entries (for testing)
  expireEntry(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expiry = Date.now() - 1;
      this.cache.set(key, entry);
    }
  }
}

// Mock implementation with vitest spies
export const createMockCacheService = () => {
  const service = new MockCacheService();
  
  return {
    get: vi.fn().mockImplementation(service.get.bind(service)),
    set: vi.fn().mockImplementation(service.set.bind(service)),
    del: vi.fn().mockImplementation(service.del.bind(service)),
    exists: vi.fn().mockImplementation(service.exists.bind(service)),
    mget: vi.fn().mockImplementation(service.mget.bind(service)),
    mset: vi.fn().mockImplementation(service.mset.bind(service)),
    mdel: vi.fn().mockImplementation(service.mdel.bind(service)),
    keys: vi.fn().mockImplementation(service.keys.bind(service)),
    deleteByPattern: vi.fn().mockImplementation(service.deleteByPattern.bind(service)),
    incr: vi.fn().mockImplementation(service.incr.bind(service)),
    decr: vi.fn().mockImplementation(service.decr.bind(service)),
    expire: vi.fn().mockImplementation(service.expire.bind(service)),
    ttl: vi.fn().mockImplementation(service.ttl.bind(service)),
    lpush: vi.fn().mockImplementation(service.lpush.bind(service)),
    rpush: vi.fn().mockImplementation(service.rpush.bind(service)),
    lpop: vi.fn().mockImplementation(service.lpop.bind(service)),
    rpop: vi.fn().mockImplementation(service.rpop.bind(service)),
    llen: vi.fn().mockImplementation(service.llen.bind(service)),
    hset: vi.fn().mockImplementation(service.hset.bind(service)),
    hget: vi.fn().mockImplementation(service.hget.bind(service)),
    hgetall: vi.fn().mockImplementation(service.hgetall.bind(service)),
    hdel: vi.fn().mockImplementation(service.hdel.bind(service)),
    clear: vi.fn().mockImplementation(service.clear.bind(service)),
    flushall: vi.fn().mockImplementation(service.flushall.bind(service)),
    connect: vi.fn().mockImplementation(service.connect.bind(service)),
    disconnect: vi.fn().mockImplementation(service.disconnect.bind(service)),
    isReady: vi.fn().mockImplementation(service.isReady.bind(service)),
    
    // Test utilities
    _service: service, // Access to underlying service for test manipulation
    size: () => service.size(),
    simulateConnectionError: service.simulateConnectionError.bind(service),
    simulateConnectionRestore: service.simulateConnectionRestore.bind(service),
    getCacheState: service.getCacheState.bind(service),
    setCacheState: service.setCacheState.bind(service),
    expireEntry: service.expireEntry.bind(service),
  };
};

// Default mock instance
export const mockCacheService = createMockCacheService();

// Export for use in vi.mock()
export default mockCacheService;