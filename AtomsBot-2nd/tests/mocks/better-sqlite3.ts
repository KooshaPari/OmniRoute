/**
 * Better-SQLite3 Mock Implementation
 * 
 * Comprehensive mock for better-sqlite3 database operations
 * Provides in-memory database functionality for testing with proper isolation
 */

import { vi } from "vitest";

/**
 * Mock database statement for prepared statements
 */
class MockStatement {
  private sql: string;
  private db: MockDatabase;

  constructor(sql: string, db: MockDatabase) {
    this.sql = sql;
    this.db = db;
  }

  run = vi.fn().mockImplementation((params?: any) => {
    try {
      // Mock basic SQL operations
      if (this.sql.includes('INSERT') || this.sql.includes('UPDATE') || this.sql.includes('DELETE')) {
        return { changes: 1, lastInsertRowid: Math.floor(Math.random() * 1000) };
      }
      return { changes: 0, lastInsertRowid: null };
    } catch (error) {
      throw new Error(`Mock SQL execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  get = vi.fn().mockImplementation((params?: any) => {
    // Return mock data based on SQL query type
    if (this.sql.includes('jira_links')) {
      return {
        threadId: params?.threadId || 'mock-thread',
        jiraKey: params?.jiraKey || 'MOCK-123',
        githubNumber: params?.githubNumber || null,
        createdAt: Date.now()
      };
    }
    if (this.sql.includes('github_links')) {
      return {
        threadId: params?.threadId || 'mock-thread',
        number: params?.number || 123,
        owner: params?.owner || null,
        repo: params?.repo || null,
        createdAt: Date.now()
      };
    }
    return null;
  });

  all = vi.fn().mockImplementation(() => {
    // Return empty array for mock data
    return [];
  });

  finalize = vi.fn().mockReturnThis();
}

/**
 * Mock database class
 */
class MockDatabase {
  private path: string;
  private options: any;
  private closed: boolean = false;
  private inTransaction: boolean = false;

  constructor(path: string, options?: any) {
    this.path = path;
    this.options = options;
  }

  // Core database operations
  prepare = vi.fn().mockImplementation((sql: string) => {
    if (this.closed) {
      throw new Error('Database is closed');
    }
    return new MockStatement(sql, this);
  });

  exec = vi.fn().mockImplementation((sql: string) => {
    if (this.closed) {
      throw new Error('Database is closed');
    }
    return this;
  });

  close = vi.fn().mockImplementation(() => {
    this.closed = true;
    return this;
  });

  // Pragma operations
  pragma = vi.fn().mockImplementation((pragma: string) => {
    if (this.closed) {
      throw new Error('Database is closed');
    }
    
    if (pragma.includes('journal_mode')) {
      return 'wal';
    }
    if (pragma.includes('foreign_keys')) {
      return 1;
    }
    return null;
  });

  // Transaction operations
  transaction = vi.fn().mockImplementation((callback: () => any) => {
    return () => {
      this.inTransaction = true;
      try {
        const result = callback();
        this.inTransaction = false;
        return result;
      } catch (error) {
        this.inTransaction = false;
        throw error;
      }
    };
  });

  // Backup operations
  backup = vi.fn().mockImplementation((destination: string) => {
    return {
      step: vi.fn().mockReturnValue(true),
      finish: vi.fn(),
      close: vi.fn()
    };
  });

  // Function operations
  function = vi.fn().mockReturnThis();
  aggregate = vi.fn().mockReturnThis();

  // Database info
  open = true;
  inWalMode = true;
  readonly = false;
  name = this.path;

  // Memory stats
  memory = vi.fn().mockReturnValue({
    used: 1024,
    high: 2048
  });

  // Mock utility methods for testing
  isClosed = vi.fn().mockImplementation(() => this.closed);
  isInTransaction = vi.fn().mockImplementation(() => this.inTransaction);
  getPath = vi.fn().mockImplementation(() => this.path);
}

/**
 * Mock better-sqlite3 constructor function
 */
const MockBetterSQLite3 = vi.fn().mockImplementation((path: string, options?: any) => {
  // Validate path
  if (!path || typeof path !== 'string') {
    throw new Error('Database path must be a string');
  }

  // Handle special paths
  if (path === ':memory:') {
    return new MockDatabase(':memory:', options);
  }

  // Create mock file-based database
  return new MockDatabase(path, options);
});

// Add static methods
MockBetterSQLite3.SqliteError = class MockSqliteError extends Error {
  code: string;
  
  constructor(message: string, code: string = 'SQLITE_ERROR') {
    super(message);
    this.name = 'SqliteError';
    this.code = code;
  }
};

// Mock version information
MockBetterSQLite3.version = '9.0.0';

/**
 * Helper functions for test utilities
 */
export const createMockDatabase = (path: string = ':memory:', options?: any) => {
  return new MockDatabase(path, options);
};

export const createMockStatement = (sql: string, db?: MockDatabase) => {
  return new MockStatement(sql, db || new MockDatabase(':memory:'));
};

/**
 * Reset all mock database instances and calls
 */
export const resetDatabaseMocks = () => {
  MockBetterSQLite3.mockClear();
  vi.clearAllMocks();
};

/**
 * Get mock call history for database operations
 */
export const getDatabaseMockCalls = () => {
  return {
    constructorCalls: MockBetterSQLite3.mock.calls,
    totalInstances: MockBetterSQLite3.mock.instances.length
  };
};

/**
 * Simulate database errors for testing
 */
export const simulateDatabaseError = (errorType: 'connection' | 'syntax' | 'constraint' = 'connection') => {
  const errorMap = {
    connection: new MockBetterSQLite3.SqliteError('Database connection failed', 'SQLITE_CANTOPEN'),
    syntax: new MockBetterSQLite3.SqliteError('SQL syntax error', 'SQLITE_ERROR'),
    constraint: new MockBetterSQLite3.SqliteError('Constraint violation', 'SQLITE_CONSTRAINT')
  };

  MockBetterSQLite3.mockImplementationOnce(() => {
    throw errorMap[errorType];
  });
};

// Default export
export default MockBetterSQLite3;

// Named exports for different use cases
export {
  MockBetterSQLite3,
  MockDatabase,
  MockStatement
};