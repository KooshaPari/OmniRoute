/**
 * Database Connection Manager for Tests
 * 
 * Handles proper database connection lifecycle, transaction management,
 * and cleanup for test environments to prevent connection leaks and hanging tests
 */

import { vi } from "vitest";

interface ConnectionOptions {
  maxConnections?: number;
  connectionTimeout?: number;
  transactionTimeout?: number;
  retryAttempts?: number;
  enableLogging?: boolean;
}

interface TransactionContext {
  id: string;
  startTime: number;
  operations: Array<{ type: string; timestamp: number }>;
  status: 'active' | 'committed' | 'rolled_back' | 'failed';
}

export class DatabaseConnectionManager {
  private connections: Map<string, { active: boolean; lastUsed: number; operations: number }> = new Map();
  private transactions: Map<string, TransactionContext> = new Map();
  private options: Required<ConnectionOptions>;
  private isShuttingDown = false;
  private connectionPool: Array<{ id: string; busy: boolean; lastUsed: number }> = [];

  constructor(options: ConnectionOptions = {}) {
    this.options = {
      maxConnections: options.maxConnections || 10,
      connectionTimeout: options.connectionTimeout || 30000,
      transactionTimeout: options.transactionTimeout || 60000,
      retryAttempts: options.retryAttempts || 3,
      enableLogging: options.enableLogging !== false,
    };

    // Initialize connection pool
    for (let i = 0; i < this.options.maxConnections; i++) {
      this.connectionPool.push({
        id: `conn-${i}`,
        busy: false,
        lastUsed: Date.now(),
      });
    }
  }

  /**
   * Acquire a database connection from the pool
   */
  async acquireConnection(testName?: string): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Connection manager is shutting down');
    }

    const connectionId = this.findAvailableConnection();
    if (!connectionId) {
      throw new Error('No available connections in pool');
    }

    this.connections.set(connectionId, {
      active: true,
      lastUsed: Date.now(),
      operations: 0,
    });

    const poolConnection = this.connectionPool.find(conn => conn.id === connectionId);
    if (poolConnection) {
      poolConnection.busy = true;
      poolConnection.lastUsed = Date.now();
    }

    if (this.options.enableLogging) {
      console.log(`[DB] Acquired connection ${connectionId} for test: ${testName || 'unknown'}`);
    }

    return connectionId;
  }

  /**
   * Release a database connection back to the pool
   */
  async releaseConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      if (this.options.enableLogging) {
        console.warn(`[DB] Attempted to release unknown connection: ${connectionId}`);
      }
      return;
    }

    // End any active transactions for this connection
    await this.rollbackActiveTransactions(connectionId);

    connection.active = false;
    this.connections.delete(connectionId);

    const poolConnection = this.connectionPool.find(conn => conn.id === connectionId);
    if (poolConnection) {
      poolConnection.busy = false;
      poolConnection.lastUsed = Date.now();
    }

    if (this.options.enableLogging) {
      console.log(`[DB] Released connection ${connectionId} after ${connection.operations} operations`);
    }
  }

  /**
   * Start a new transaction
   */
  async beginTransaction(connectionId: string): Promise<string> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.active) {
      throw new Error(`Invalid connection: ${connectionId}`);
    }

    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction: TransactionContext = {
      id: transactionId,
      startTime: Date.now(),
      operations: [],
      status: 'active',
    };

    this.transactions.set(transactionId, transaction);
    connection.operations++;

    if (this.options.enableLogging) {
      console.log(`[DB] Started transaction ${transactionId} on connection ${connectionId}`);
    }

    // Set up automatic timeout
    setTimeout(() => {
      const tx = this.transactions.get(transactionId);
      if (tx && tx.status === 'active') {
        this.rollbackTransaction(transactionId, 'timeout');
      }
    }, this.options.transactionTimeout);

    return transactionId;
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active (status: ${transaction.status})`);
    }

    transaction.status = 'committed';
    transaction.operations.push({ type: 'commit', timestamp: Date.now() });

    if (this.options.enableLogging) {
      const duration = Date.now() - transaction.startTime;
      console.log(`[DB] Committed transaction ${transactionId} after ${duration}ms (${transaction.operations.length} operations)`);
    }

    // Clean up transaction after a delay
    setTimeout(() => {
      this.transactions.delete(transactionId);
    }, 1000);
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId: string, reason = 'manual'): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      if (this.options.enableLogging) {
        console.warn(`[DB] Attempted to rollback unknown transaction: ${transactionId}`);
      }
      return;
    }

    transaction.status = reason === 'timeout' ? 'failed' : 'rolled_back';
    transaction.operations.push({ type: 'rollback', timestamp: Date.now() });

    if (this.options.enableLogging) {
      const duration = Date.now() - transaction.startTime;
      console.log(`[DB] Rolled back transaction ${transactionId} after ${duration}ms (reason: ${reason})`);
    }

    // Clean up transaction immediately on rollback
    setTimeout(() => {
      this.transactions.delete(transactionId);
    }, 100);
  }

  /**
   * Execute an operation within a transaction context
   */
  async executeInTransaction<T>(
    connectionId: string,
    operation: (transactionId: string) => Promise<T>,
    options: { retryOnFailure?: boolean; timeout?: number } = {}
  ): Promise<T> {
    const transactionId = await this.beginTransaction(connectionId);
    const transaction = this.transactions.get(transactionId)!;

    try {
      const result = await this.withTimeout(
        operation(transactionId),
        options.timeout || this.options.transactionTimeout
      );

      await this.commitTransaction(transactionId);
      return result;
    } catch (error) {
      await this.rollbackTransaction(transactionId, 'error');

      if (options.retryOnFailure && this.shouldRetry(error)) {
        if (this.options.enableLogging) {
          console.log(`[DB] Retrying transaction due to: ${error}`);
        }
        return this.executeInTransaction(connectionId, operation, {
          ...options,
          retryOnFailure: false, // Prevent infinite retries
        });
      }

      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const activeConnections = Array.from(this.connections.values()).filter(conn => conn.active).length;
    const busyConnections = this.connectionPool.filter(conn => conn.busy).length;
    const activeTransactions = Array.from(this.transactions.values()).filter(tx => tx.status === 'active').length;

    return {
      total: this.connectionPool.length,
      active: activeConnections,
      busy: busyConnections,
      available: this.connectionPool.length - busyConnections,
      transactions: {
        active: activeTransactions,
        total: this.transactions.size,
      },
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Clean up all connections and transactions
   */
  async cleanup(): Promise<void> {
    this.isShuttingDown = true;

    if (this.options.enableLogging) {
      console.log('[DB] Starting connection manager cleanup...');
    }

    // Rollback all active transactions
    const activeTransactions = Array.from(this.transactions.entries())
      .filter(([_, tx]) => tx.status === 'active');

    await Promise.all(
      activeTransactions.map(([txId, _]) => 
        this.rollbackTransaction(txId, 'cleanup')
      )
    );

    // Release all active connections
    const activeConnections = Array.from(this.connections.keys());
    await Promise.all(
      activeConnections.map(connId => this.releaseConnection(connId))
    );

    // Reset state
    this.connections.clear();
    this.transactions.clear();
    this.connectionPool.forEach(conn => {
      conn.busy = false;
      conn.lastUsed = Date.now();
    });

    this.isShuttingDown = false;

    if (this.options.enableLogging) {
      console.log('[DB] Connection manager cleanup completed');
    }
  }

  /**
   * Wait for all operations to complete
   */
  async waitForCompletion(timeoutMs = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const stats = this.getConnectionStats();
      
      if (stats.active === 0 && stats.transactions.active === 0) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const stats = this.getConnectionStats();
    if (stats.active > 0 || stats.transactions.active > 0) {
      console.warn('[DB] Timeout waiting for operations to complete:', stats);
    }
  }

  // Private helper methods

  private findAvailableConnection(): string | null {
    const available = this.connectionPool.find(conn => !conn.busy);
    return available?.id || null;
  }

  private async rollbackActiveTransactions(connectionId: string): Promise<void> {
    // Note: In a real implementation, we'd track which transactions belong to which connection
    // For now, we'll rollback all active transactions as a safety measure
    const activeTransactions = Array.from(this.transactions.entries())
      .filter(([_, tx]) => tx.status === 'active');

    await Promise.all(
      activeTransactions.map(([txId, _]) => 
        this.rollbackTransaction(txId, 'connection_cleanup')
      )
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }

  private shouldRetry(error: any): boolean {
    const retryableErrors = [
      'connection lost',
      'database locked',
      'timeout',
      'network error'
    ];

    const errorMessage = (error?.message || String(error)).toLowerCase();
    return retryableErrors.some(retryableError => errorMessage.includes(retryableError));
  }
}

// Global instance for tests
export const testDbConnectionManager = new DatabaseConnectionManager({
  maxConnections: 5,
  connectionTimeout: 10000,
  transactionTimeout: 30000,
  enableLogging: process.env.NODE_ENV === 'test' && process.env.DEBUG_DB === 'true',
});

// Test utilities
export const createMockConnection = async (testName?: string): Promise<string> => {
  return testDbConnectionManager.acquireConnection(testName);
};

export const cleanupMockConnection = async (connectionId: string): Promise<void> => {
  return testDbConnectionManager.releaseConnection(connectionId);
};

export const executeInTestTransaction = async <T>(
  connectionId: string,
  operation: (transactionId: string) => Promise<T>
): Promise<T> => {
  return testDbConnectionManager.executeInTransaction(connectionId, operation);
};

// Vitest integration helpers
export const setupDatabaseTest = () => {
  let connectionId: string;

  return {
    async setup(testName?: string) {
      connectionId = await createMockConnection(testName);
      return connectionId;
    },

    async cleanup() {
      if (connectionId) {
        await cleanupMockConnection(connectionId);
      }
    },

    async executeInTransaction<T>(operation: (txId: string) => Promise<T>): Promise<T> {
      if (!connectionId) {
        throw new Error('Database connection not initialized. Call setup() first.');
      }
      return executeInTestTransaction(connectionId, operation);
    },

    getStats() {
      return testDbConnectionManager.getConnectionStats();
    }
  };
};

// Global cleanup for test suites
export const cleanupAllConnections = async (): Promise<void> => {
  await testDbConnectionManager.cleanup();
};

export const waitForAllOperations = async (timeoutMs = 5000): Promise<void> => {
  await testDbConnectionManager.waitForCompletion(timeoutMs);
};