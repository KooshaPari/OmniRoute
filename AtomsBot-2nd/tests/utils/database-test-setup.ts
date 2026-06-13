/**
 * Database Test Setup and Utilities
 * 
 * Comprehensive database setup, teardown, and transaction isolation utilities
 * for integration tests. Provides SQLite test database configuration with
 * proper cleanup and data isolation between tests.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { createDatabaseClient, closeDatabaseConnection } from '../../src/database/config';
import { logger } from '../../src/logger';

// Test database configuration
export interface TestDatabaseConfig {
  testName?: string;
  isolation?: 'transaction' | 'database' | 'none';
  seedData?: boolean;
  logQueries?: boolean;
}

// Global test database clients
let testPrismaClient: PrismaClient | null = null;
let testDatabasePath: string | null = null;
let activeTransactions: Map<string, any> = new Map();

/**
 * Initialize test database for integration tests
 */
export async function setupTestDatabase(config: TestDatabaseConfig = {}): Promise<PrismaClient> {
  try {
    // Create test database directory with absolute path
    const testDataDir = path.resolve(process.cwd(), 'test-data');
    await fs.mkdir(testDataDir, { recursive: true });

    // Generate unique database name for this test run
    const testName = config.testName || `integration_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    testDatabasePath = path.resolve(testDataDir, `${testName}.db`);

    // Clean up any existing test database
    await fs.unlink(testDatabasePath).catch(() => {}); // Ignore if doesn't exist

    // Create an empty database file first
    await fs.writeFile(testDatabasePath, '');

    // Create new Prisma client with test database using absolute file path
    testPrismaClient = createDatabaseClient({
      url: `file:${testDatabasePath}`,
      enableLogging: config.logQueries || false,
    });

    // Run database migrations for test database
    await runTestMigrations(testPrismaClient);

    // Seed initial data if requested
    if (config.seedData) {
      await seedTestData(testPrismaClient);
    }

    logger.info(`Test database initialized: ${testDatabasePath}`);
    return testPrismaClient;

  } catch (error) {
    logger.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Clean up test database after tests
 */
export async function teardownTestDatabase(): Promise<void> {
  try {
    // Close all active transactions
    for (const [testId, transaction] of activeTransactions) {
      try {
        await transaction.rollback();
      } catch (error) {
        logger.warn(`Failed to rollback transaction for test ${testId}:`, error);
      }
    }
    activeTransactions.clear();

    // Close database connection
    if (testPrismaClient) {
      await testPrismaClient.$disconnect();
      testPrismaClient = null;
    }

    // Remove test database file
    if (testDatabasePath) {
      await fs.unlink(testDatabasePath).catch(() => {}); // Ignore if already deleted
      testDatabasePath = null;
    }

    logger.info('Test database cleaned up successfully');
  } catch (error) {
    logger.error('Failed to teardown test database:', error);
    throw error;
  }
}

/**
 * Start a database transaction for test isolation
 */
export async function startTestTransaction(testId: string): Promise<PrismaClient> {
  if (!testPrismaClient) {
    throw new Error('Test database not initialized. Call setupTestDatabase first.');
  }

  try {
    // Create a transaction that we can control
    const transactionClient = testPrismaClient;
    
    // Store transaction reference for cleanup
    activeTransactions.set(testId, {
      client: transactionClient,
      rollback: async () => {
        // In SQLite, we'll use savepoints for transaction isolation
        try {
          await transactionClient.$executeRaw`ROLLBACK TO SAVEPOINT test_${testId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } catch (error) {
          logger.warn(`Rollback failed for test ${testId}:`, error);
        }
      },
    });

    // Create savepoint for this test
    await transactionClient.$executeRaw`SAVEPOINT test_${testId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    logger.debug(`Started transaction for test: ${testId}`);
    return transactionClient;

  } catch (error) {
    logger.error(`Failed to start transaction for test ${testId}:`, error);
    throw error;
  }
}

/**
 * Rollback test transaction to clean up data
 */
export async function rollbackTestTransaction(testId: string): Promise<void> {
  const transaction = activeTransactions.get(testId);
  if (!transaction) {
    logger.warn(`No transaction found for test: ${testId}`);
    return;
  }

  try {
    await transaction.rollback();
    activeTransactions.delete(testId);
    logger.debug(`Rolled back transaction for test: ${testId}`);
  } catch (error) {
    logger.error(`Failed to rollback transaction for test ${testId}:`, error);
    activeTransactions.delete(testId);
    throw error;
  }
}

/**
 * Get test database client
 */
export function getTestDatabaseClient(): PrismaClient {
  if (!testPrismaClient) {
    throw new Error('Test database not initialized. Call setupTestDatabase first.');
  }
  return testPrismaClient;
}

/**
 * Run database migrations for test database
 */
async function runTestMigrations(client: PrismaClient): Promise<void> {
  try {
    // Enable foreign keys for SQLite
    await client.$executeRaw`PRAGMA foreign_keys = ON;`;

    // Create tables based on schema
    // Note: In a real implementation, you'd run actual Prisma migrations
    // For now, we'll create a basic schema for testing
    
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS Thread (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT,
        appliedTags TEXT,
        archived BOOLEAN DEFAULT FALSE,
        locked BOOLEAN DEFAULT FALSE,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        number INTEGER,
        node_id TEXT,
        repoOwner TEXT,
        repoName TEXT,
        jiraKey TEXT
      );
    `;

    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS Message (
        id TEXT PRIMARY KEY,
        threadId TEXT NOT NULL,
        content TEXT NOT NULL,
        authorId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        git_id INTEGER,
        FOREIGN KEY (threadId) REFERENCES Thread(id) ON DELETE CASCADE
      );
    `;

    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS GithubIssue (
        id INTEGER PRIMARY KEY,
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        state TEXT NOT NULL,
        html_url TEXT NOT NULL,
        node_id TEXT NOT NULL,
        repoOwner TEXT NOT NULL,
        repoName TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        threadId TEXT,
        FOREIGN KEY (threadId) REFERENCES Thread(id) ON DELETE SET NULL
      );
    `;

    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS JiraIssue (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        issueType TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        threadId TEXT,
        githubIssueId INTEGER,
        FOREIGN KEY (threadId) REFERENCES Thread(id) ON DELETE SET NULL,
        FOREIGN KEY (githubIssueId) REFERENCES GithubIssue(id) ON DELETE SET NULL
      );
    `;

    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS DiscordUser (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        discriminator TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `;

    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS UserSession (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        data TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES DiscordUser(id) ON DELETE CASCADE
      );
    `;

    // Create indexes for better performance
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS idx_thread_number ON Thread(number);`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS idx_thread_node_id ON Thread(node_id);`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS idx_thread_jira_key ON Thread(jiraKey);`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS idx_message_thread_id ON Message(threadId);`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS idx_github_issue_thread_id ON GithubIssue(threadId);`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS idx_jira_issue_thread_id ON JiraIssue(threadId);`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS idx_user_session_expires ON UserSession(expiresAt);`;

    logger.info('Test database migrations completed');
  } catch (error) {
    logger.error('Failed to run test migrations:', error);
    throw error;
  }
}

/**
 * Seed test database with initial data
 */
async function seedTestData(client: PrismaClient): Promise<void> {
  try {
    // Insert sample Discord users
    await client.$executeRaw`
      INSERT OR IGNORE INTO DiscordUser (id, username, discriminator, createdAt, updatedAt)
      VALUES 
        ('test_user_123', 'testuser', '0001', '${new Date().toISOString()}', '${new Date().toISOString()}'),
        ('test_user_456', 'anotheruser', '0002', '${new Date().toISOString()}', '${new Date().toISOString()}');
    `;

    // Insert sample threads
    await client.$executeRaw`
      INSERT OR IGNORE INTO Thread (id, title, body, appliedTags, archived, locked, createdAt, updatedAt)
      VALUES 
        ('thread_sample_1', 'Sample Bug Report', 'This is a sample bug report for testing', '["bug"]', FALSE, FALSE, '${new Date().toISOString()}', '${new Date().toISOString()}'),
        ('thread_sample_2', 'Sample Feature Request', 'This is a sample feature request for testing', '["feature-request"]', FALSE, FALSE, '${new Date().toISOString()}', '${new Date().toISOString()}');
    `;

    logger.info('Test database seeded with sample data');
  } catch (error) {
    logger.error('Failed to seed test data:', error);
    throw error;
  }
}

/**
 * Clean all data from test database (alternative to transaction rollback)
 */
export async function cleanTestData(): Promise<void> {
  if (!testPrismaClient) {
    throw new Error('Test database not initialized');
  }

  try {
    // Delete in correct order to respect foreign key constraints
    await testPrismaClient.$executeRaw`DELETE FROM UserSession;`;
    await testPrismaClient.$executeRaw`DELETE FROM Message;`;
    await testPrismaClient.$executeRaw`DELETE FROM JiraIssue;`;
    await testPrismaClient.$executeRaw`DELETE FROM GithubIssue;`;
    await testPrismaClient.$executeRaw`DELETE FROM Thread;`;
    await testPrismaClient.$executeRaw`DELETE FROM DiscordUser;`;

    logger.debug('Test database cleaned');
  } catch (error) {
    logger.error('Failed to clean test data:', error);
    throw error;
  }
}

/**
 * Get database statistics for debugging
 */
export async function getTestDatabaseStats(): Promise<{
  threads: number;
  messages: number;
  githubIssues: number;
  jiraIssues: number;
  users: number;
}> {
  if (!testPrismaClient) {
    throw new Error('Test database not initialized');
  }

  try {
    const [
      threads,
      messages,
      githubIssues,
      jiraIssues,
      users,
    ] = await Promise.all([
      testPrismaClient.$queryRaw`SELECT COUNT(*) as count FROM Thread;`,
      testPrismaClient.$queryRaw`SELECT COUNT(*) as count FROM Message WHERE deletedAt IS NULL;`,
      testPrismaClient.$queryRaw`SELECT COUNT(*) as count FROM GithubIssue;`,
      testPrismaClient.$queryRaw`SELECT COUNT(*) as count FROM JiraIssue;`,
      testPrismaClient.$queryRaw`SELECT COUNT(*) as count FROM DiscordUser;`,
    ]);

    return {
      threads: (threads as any)[0].count,
      messages: (messages as any)[0].count,
      githubIssues: (githubIssues as any)[0].count,
      jiraIssues: (jiraIssues as any)[0].count,
      users: (users as any)[0].count,
    };
  } catch (error) {
    const msg = (error as any)?.message ?? String(error);
    logger.error('Failed to get database stats:', msg);
    throw (error as any);
  }
}

/**
 * Verify database integrity
 */
export async function verifyTestDatabaseIntegrity(): Promise<{ isValid: boolean; issues: string[] }> {
  if (!testPrismaClient) {
    return { isValid: false, issues: ['Test database not initialized'] };
  }

  const issues: string[] = [];

  try {
    // Check foreign key constraints
    const foreignKeyCheck = await testPrismaClient.$queryRaw`PRAGMA foreign_key_check;`;
    if ((foreignKeyCheck as any).length > 0) {
      issues.push('Foreign key constraint violations found');
    }

    // Check for orphaned messages
    const orphanedMessages = await testPrismaClient.$queryRaw`
      SELECT COUNT(*) as count FROM Message m 
      LEFT JOIN Thread t ON m.threadId = t.id 
      WHERE t.id IS NULL;
    `;
    if ((orphanedMessages as any)[0].count > 0) {
      issues.push(`${(orphanedMessages as any)[0].count} orphaned messages found`);
    }

    // Check for orphaned GitHub issues
    const orphanedGithubIssues = await testPrismaClient.$queryRaw`
      SELECT COUNT(*) as count FROM GithubIssue g 
      LEFT JOIN Thread t ON g.threadId = t.id 
      WHERE g.threadId IS NOT NULL AND t.id IS NULL;
    `;
    if ((orphanedGithubIssues as any)[0].count > 0) {
      issues.push(`${(orphanedGithubIssues as any)[0].count} orphaned GitHub issues found`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  } catch (error) {
    const msg = (error as any)?.message ?? String(error);
    issues.push(`Database integrity check failed: ${msg}`);
    return { isValid: false, issues };
  }
}

export default {
  setupTestDatabase,
  teardownTestDatabase,
  startTestTransaction,
  rollbackTestTransaction,
  getTestDatabaseClient,
  cleanTestData,
  getTestDatabaseStats,
  verifyTestDatabaseIntegrity,
};