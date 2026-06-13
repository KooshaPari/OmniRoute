/**
 * Database Test Isolation Utilities
 * 
 * This module provides comprehensive database isolation for tests, ensuring:
 * 1. Each test runs with a clean database state
 * 2. In-memory databases for test performance
 * 3. Proper cleanup after each test
 * 4. Transaction rollback/isolation support
 * 5. Environment variable isolation
 */

import { vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

interface DatabaseTestContext {
  originalEnv: Record<string, string | undefined>;
  tempDbPath?: string;
  dbConnections: Set<any>;
  cleanupCallbacks: Array<() => Promise<void> | void>;
}

/**
 * Global test context for tracking database state across tests
 */
const testContext: DatabaseTestContext = {
  originalEnv: {},
  dbConnections: new Set(),
  cleanupCallbacks: []
};

/**
 * Save current environment variables for restoration
 */
function saveEnvironment(): void {
  const envVars = [
    'NODE_ENV',
    'PERSISTENCE_DB_ENABLED',
    'DB_SQLITE_PATH',
    'DATABASE_URL'
  ];
  
  for (const key of envVars) {
    testContext.originalEnv[key] = process.env[key];
  }
}

/**
 * Restore original environment variables
 */
function restoreEnvironment(): void {
  for (const [key, value] of Object.entries(testContext.originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  testContext.originalEnv = {};
}

/**
 * Create a unique temporary database path for test isolation
 */
function createTempDbPath(): string {
  const testId = Math.random().toString(36).substring(7);
  const timestamp = Date.now();
  const tempDir = path.join(process.cwd(), '.test-temp', 'databases');
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  return path.join(tempDir, `test-db-${timestamp}-${testId}.db`);
}

/**
 * Setup test database with proper isolation
 */
export function setupTestDatabase(options: {
  enablePersistence?: boolean;
  useInMemory?: boolean;
  customPath?: string;
} = {}): void {
  const { enablePersistence = false, useInMemory = true, customPath } = options;
  
  // Save current environment
  saveEnvironment();
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.PERSISTENCE_DB_ENABLED = enablePersistence ? '1' : '0';
  
  if (enablePersistence && !useInMemory) {
    // Use file-based database with unique path
    testContext.tempDbPath = customPath || createTempDbPath();
    process.env.DB_SQLITE_PATH = testContext.tempDbPath;
  } else if (enablePersistence && useInMemory) {
    // Use in-memory database for faster tests
    process.env.DB_SQLITE_PATH = ':memory:';
  }
}

/**
 * Cleanup test database and restore environment
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    // Close all database connections
    for (const db of testContext.dbConnections) {
      try {
        if (db && typeof db.close === 'function') {
          db.close();
        }
      } catch (error) {
        console.warn('Error closing database connection:', error);
      }
    }
    testContext.dbConnections.clear();
    
    // Run cleanup callbacks
    for (const callback of testContext.cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        console.warn('Error in cleanup callback:', error);
      }
    }
    testContext.cleanupCallbacks = [];
    
    // Remove temporary database file if it exists
    if (testContext.tempDbPath && fs.existsSync(testContext.tempDbPath)) {
      try {
        fs.unlinkSync(testContext.tempDbPath);
      } catch (error) {
        console.warn('Error removing temporary database file:', error);
      }
    }
    testContext.tempDbPath = undefined;
    
    // Restore environment
    restoreEnvironment();
    
  } catch (error) {
    console.error('Error during database cleanup:', error);
    // Still try to restore environment even if cleanup fails
    restoreEnvironment();
  }
}

/**
 * Track database connection for cleanup
 */
export function trackDatabaseConnection(db: any): void {
  testContext.dbConnections.add(db);
}

/**
 * Add cleanup callback to run during test cleanup
 */
export function addCleanupCallback(callback: () => Promise<void> | void): void {
  testContext.cleanupCallbacks.push(callback);
}

/**
 * Create an isolated database connection for testing
 */
export function createTestDatabaseConnection(options: {
  enablePersistence?: boolean;
  useInMemory?: boolean;
} = {}) {
  const { enablePersistence = true, useInMemory = true } = options;
  
  if (!enablePersistence) {
    return null;
  }
  
  try {
    // Mock the SQLite module for tests
    const mockDb = {
      prepare: vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn()
      })),
      exec: vi.fn(),
      close: vi.fn(),
      pragma: vi.fn()
    };
    
    trackDatabaseConnection(mockDb);
    return mockDb;
    
  } catch (error) {
    console.warn('Failed to create test database connection:', error);
    return null;
  }
}

/**
 * Reset all mocks and database state for clean test isolation
 */
export function resetDatabaseMocks(): void {
  vi.clearAllMocks();
  vi.resetModules();
}

/**
 * Create a fresh store instance with proper database isolation
 */
export async function createIsolatedStoreInstance(): Promise<any> {
  // Clear module cache to get fresh instance
  vi.resetModules();
  
  // Import store module fresh
  const storeModule = await import('../../src/store');
  return storeModule.store;
}

/**
 * Setup comprehensive database test hooks
 * Call this in test files that need database isolation
 */
export function setupDatabaseTestHooks(options: {
  enablePersistence?: boolean;
  useInMemory?: boolean;
} = {}): void {
  const { enablePersistence = false, useInMemory = true } = options;
  
  beforeEach(() => {
    setupTestDatabase({ enablePersistence, useInMemory });
    resetDatabaseMocks();
  });
  
  afterEach(async () => {
    await cleanupTestDatabase();
  });
}

/**
 * Verify database isolation between tests
 */
export function verifyDatabaseIsolation(): {
  hasActivConnections: boolean;
  connectionCount: number;
  hasCleanupCallbacks: boolean;
  callbackCount: number;
} {
  return {
    hasActivConnections: testContext.dbConnections.size > 0,
    connectionCount: testContext.dbConnections.size,
    hasCleanupCallbacks: testContext.cleanupCallbacks.length > 0,
    callbackCount: testContext.cleanupCallbacks.length
  };
}

/**
 * Mock better-sqlite3 for testing
 */
export function mockBetterSqlite3() {
  return vi.mock('better-sqlite3', () => {
    const MockDatabase = vi.fn().mockImplementation((path: string) => {
      const mockDb = createTestDatabaseConnection();
      return mockDb;
    });
    
    return {
      default: MockDatabase,
      Database: MockDatabase
    };
  });
}

/**
 * Create test-specific environment isolation
 */
export function withEnvironmentIsolation<T>(
  envVars: Record<string, string>,
  testFn: () => T | Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const originalEnv = { ...process.env };
    
    try {
      // Set test environment variables
      Object.assign(process.env, envVars);
      
      // Run test
      const result = await testFn();
      resolve(result);
      
    } catch (error) {
      reject(error);
    } finally {
      // Restore original environment
      Object.keys(envVars).forEach(key => {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key];
        }
      });
    }
  });
}

/**
 * Wait for async operations to complete (useful for database operations)
 */
export function waitForAsyncOperations(timeout = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Create a comprehensive database test suite setup
 */
export function createDatabaseTestSuite(suiteName: string, options: {
  enablePersistence?: boolean;
  useInMemory?: boolean;
  setupDatabase?: boolean;
} = {}) {
  const { enablePersistence = false, useInMemory = true, setupDatabase = true } = options;
  
  if (setupDatabase) {
    setupDatabaseTestHooks({ enablePersistence, useInMemory });
  }
  
  return {
    createStore: createIsolatedStoreInstance,
    createConnection: () => createTestDatabaseConnection({ enablePersistence, useInMemory }),
    waitForAsync: waitForAsyncOperations,
    verifyIsolation: verifyDatabaseIsolation,
    withEnv: withEnvironmentIsolation
  };
}