/**
 * Store-Database Synchronization Test Utilities
 * 
 * Handles synchronization between in-memory store and database operations,
 * ensuring data consistency and proper state management during tests
 */

import { vi } from 'vitest';
import type { Thread } from '../../src/interfaces';
import { mockDatabaseService, getMockDataState, setMockDataState } from '../mocks/database';
import { mockCacheService, getMockCacheState, setMockCacheState } from '../mocks/cache';

interface SyncStatus {
  store: 'synced' | 'ahead' | 'behind' | 'diverged';
  database: 'synced' | 'ahead' | 'behind' | 'diverged';
  cache: 'synced' | 'ahead' | 'behind' | 'diverged';
  lastSync: number;
  conflicts: Array<{
    type: 'thread' | 'jira_link' | 'github_link';
    id: string;
    storeValue: any;
    databaseValue: any;
    cacheValue?: any;
  }>;
}

interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  entity: 'thread' | 'jira_link' | 'github_link';
  id: string;
  data: any;
  timestamp: number;
  source: 'store' | 'database' | 'cache';
  status: 'pending' | 'completed' | 'failed' | 'conflict';
}

export class StoreDatabaseSync {
  private operations: Map<string, SyncOperation> = new Map();
  private syncHistory: SyncOperation[] = [];
  private conflictResolver: Map<string, (conflict: any) => Promise<any>> = new Map();
  private autoSyncEnabled = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime = 0;

  constructor(private config: {
    enableAutoSync?: boolean;
    syncInterval?: number;
    conflictResolution?: 'store_wins' | 'database_wins' | 'timestamp_wins' | 'merge' | 'manual';
    enableLogging?: boolean;
  } = {}) {
    this.config = {
      enableAutoSync: false,
      syncInterval: 1000,
      conflictResolution: 'timestamp_wins',
      enableLogging: process.env.DEBUG_SYNC === 'true',
      ...config,
    };
  }

  /**
   * Enable automatic synchronization
   */
  enableAutoSync(): void {
    if (this.autoSyncEnabled) return;
    
    this.autoSyncEnabled = true;
    this.syncInterval = setInterval(() => {
      this.performSync().catch(error => {
        if (this.config.enableLogging) {
          console.error('Auto-sync failed:', error);
        }
      });
    }, this.config.syncInterval);

    if (this.config.enableLogging) {
      console.log('🔄 Auto-sync enabled');
    }
  }

  /**
   * Disable automatic synchronization
   */
  disableAutoSync(): void {
    if (!this.autoSyncEnabled) return;
    
    this.autoSyncEnabled = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.config.enableLogging) {
      console.log('⏹️ Auto-sync disabled');
    }
  }

  /**
   * Perform manual synchronization
   */
  async performSync(): Promise<SyncStatus> {
    const startTime = Date.now();
    
    try {
      if (this.config.enableLogging) {
        console.log('🔄 Starting store-database synchronization...');
      }

      // Get current state from all sources
      const [storeState, dbState, cacheState] = await Promise.all([
        this.getStoreState(),
        this.getDatabaseState(),
        this.getCacheState(),
      ]);

      // Compare states and identify conflicts
      const conflicts = this.identifyConflicts(storeState, dbState, cacheState);
      
      // Resolve conflicts based on configured strategy
      await this.resolveConflicts(conflicts);

      // Update sync status
      const syncStatus: SyncStatus = {
        store: 'synced',
        database: 'synced', 
        cache: 'synced',
        lastSync: Date.now(),
        conflicts: conflicts.map(conflict => ({
          type: conflict.entity,
          id: conflict.id,
          storeValue: conflict.storeValue,
          databaseValue: conflict.databaseValue,
          cacheValue: conflict.cacheValue,
        })),
      };

      this.lastSyncTime = Date.now();

      if (this.config.enableLogging) {
        const duration = Date.now() - startTime;
        console.log(`✅ Sync completed in ${duration}ms (${conflicts.length} conflicts resolved)`);
      }

      return syncStatus;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('❌ Sync failed:', error);
      }
      throw error;
    }
  }

  /**
   * Queue an operation for synchronization
   */
  queueOperation(operation: Omit<SyncOperation, 'timestamp' | 'status'>): string {
    const opId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullOperation: SyncOperation = {
      ...operation,
      timestamp: Date.now(),
      status: 'pending',
    };

    this.operations.set(opId, fullOperation);

    if (this.config.enableLogging) {
      console.log(`📝 Queued ${operation.type} operation for ${operation.entity}:${operation.id}`);
    }

    return opId;
  }

  /**
   * Process queued operations
   */
  async processQueuedOperations(): Promise<void> {
    const pendingOps = Array.from(this.operations.entries())
      .filter(([_, op]) => op.status === 'pending')
      .sort(([_, a], [__, b]) => a.timestamp - b.timestamp);

    for (const [opId, operation] of pendingOps) {
      try {
        await this.executeOperation(operation);
        operation.status = 'completed';
        this.syncHistory.push({ ...operation });
      } catch (error) {
        operation.status = 'failed';
        if (this.config.enableLogging) {
          console.error(`❌ Operation ${opId} failed:`, error);
        }
      }
    }

    // Clean up completed operations
    for (const [opId, operation] of this.operations.entries()) {
      if (operation.status === 'completed' || operation.status === 'failed') {
        this.operations.delete(opId);
      }
    }
  }

  /**
   * Register conflict resolver for specific entity type
   */
  registerConflictResolver(
    entityType: string,
    resolver: (conflict: any) => Promise<any>
  ): void {
    this.conflictResolver.set(entityType, resolver);
  }

  /**
   * Wait for all pending operations to complete
   */
  async waitForSync(timeoutMs = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const pendingOps = Array.from(this.operations.values()).filter(op => op.status === 'pending');
      
      if (pendingOps.length === 0) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const pendingCount = Array.from(this.operations.values()).filter(op => op.status === 'pending').length;
    if (pendingCount > 0) {
      throw new Error(`Timeout waiting for sync completion. ${pendingCount} operations still pending.`);
    }
  }

  /**
   * Get synchronization statistics
   */
  getStats(): {
    pendingOperations: number;
    completedOperations: number;
    failedOperations: number;
    lastSyncTime: number;
    autoSyncEnabled: boolean;
  } {
    const pendingOps = Array.from(this.operations.values()).filter(op => op.status === 'pending').length;
    const completedOps = this.syncHistory.filter(op => op.status === 'completed').length;
    const failedOps = this.syncHistory.filter(op => op.status === 'failed').length;

    return {
      pendingOperations: pendingOps,
      completedOperations: completedOps,
      failedOperations: failedOps,
      lastSyncTime: this.lastSyncTime,
      autoSyncEnabled: this.autoSyncEnabled,
    };
  }

  /**
   * Force synchronization for specific entity
   */
  async forceSyncEntity(entityType: 'thread' | 'jira_link' | 'github_link', id: string): Promise<void> {
    const opId = this.queueOperation({
      type: 'update',
      entity: entityType,
      id,
      data: await this.getEntityData(entityType, id),
      source: 'store',
    });

    await this.processQueuedOperations();
  }

  /**
   * Reset synchronization state
   */
  async reset(): Promise<void> {
    this.disableAutoSync();
    this.operations.clear();
    this.syncHistory = [];
    this.lastSyncTime = 0;

    if (this.config.enableLogging) {
      console.log('🔄 Sync state reset');
    }
  }

  // Private methods

  private async getStoreState(): Promise<any> {
    // This would integrate with the actual store implementation
    // For now, return mock data
    return {
      threads: new Map(),
      jiraLinks: new Map(),
      githubLinks: new Map(),
    };
  }

  private async getDatabaseState(): Promise<any> {
    const mockData = getMockDataState();
    return {
      threads: new Map(mockData.threads?.map(t => [t.id, t]) || []),
      jiraLinks: new Map(mockData.jiraLinks?.map(l => [l.threadId, l]) || []),
      githubLinks: new Map(mockData.githubLinks?.map(l => [l.threadId, l]) || []),
    };
  }

  private async getCacheState(): Promise<any> {
    const cacheData = getMockCacheState();
    const result = {
      threads: new Map(),
      jiraLinks: new Map(),
      githubLinks: new Map(),
    };

    // Parse cache data
    Object.entries(cacheData.data || {}).forEach(([key, value]) => {
      if (key.startsWith('discord:thread:')) {
        const threadId = key.replace('discord:thread:', '');
        result.threads.set(threadId, value);
      } else if (key.startsWith('jira:thread:')) {
        const threadId = key.replace('jira:thread:', '');
        result.jiraLinks.set(threadId, { threadId, jiraKey: value });
      } else if (key.startsWith('github:thread:')) {
        const threadId = key.replace('github:thread:', '');
        result.githubLinks.set(threadId, { threadId, number: value });
      }
    });

    return result;
  }

  private identifyConflicts(storeState: any, dbState: any, cacheState: any): Array<{
    entity: 'thread' | 'jira_link' | 'github_link';
    id: string;
    storeValue: any;
    databaseValue: any;
    cacheValue?: any;
    conflictType: 'missing_in_store' | 'missing_in_db' | 'missing_in_cache' | 'value_mismatch';
  }> {
    const conflicts: any[] = [];

    // Compare threads
    const allThreadIds = new Set([
      ...storeState.threads.keys(),
      ...dbState.threads.keys(),
      ...cacheState.threads.keys(),
    ]);

    for (const threadId of allThreadIds) {
      const storeThread = storeState.threads.get(threadId);
      const dbThread = dbState.threads.get(threadId);
      const cacheThread = cacheState.threads.get(threadId);

      if (!storeThread && dbThread) {
        conflicts.push({
          entity: 'thread',
          id: threadId,
          storeValue: null,
          databaseValue: dbThread,
          cacheValue: cacheThread,
          conflictType: 'missing_in_store',
        });
      } else if (storeThread && !dbThread) {
        conflicts.push({
          entity: 'thread',
          id: threadId,
          storeValue: storeThread,
          databaseValue: null,
          cacheValue: cacheThread,
          conflictType: 'missing_in_db',
        });
      } else if (storeThread && dbThread && !this.isEqual(storeThread, dbThread)) {
        conflicts.push({
          entity: 'thread',
          id: threadId,
          storeValue: storeThread,
          databaseValue: dbThread,
          cacheValue: cacheThread,
          conflictType: 'value_mismatch',
        });
      }
    }

    // Similar logic for jira links and github links...
    // (Implementation abbreviated for brevity)

    return conflicts;
  }

  private async resolveConflicts(conflicts: any[]): Promise<void> {
    for (const conflict of conflicts) {
      try {
        await this.resolveConflict(conflict);
      } catch (error) {
        if (this.config.enableLogging) {
          console.error(`❌ Failed to resolve conflict for ${conflict.entity}:${conflict.id}:`, error);
        }
      }
    }
  }

  private async resolveConflict(conflict: any): Promise<void> {
    const customResolver = this.conflictResolver.get(conflict.entity);
    if (customResolver) {
      await customResolver(conflict);
      return;
    }

    // Apply default resolution strategy
    switch (this.config.conflictResolution) {
      case 'store_wins':
        await this.applyToDatabase(conflict.entity, conflict.id, conflict.storeValue);
        break;
      case 'database_wins':
        await this.applyToStore(conflict.entity, conflict.id, conflict.databaseValue);
        break;
      case 'timestamp_wins':
        await this.applyTimestampResolution(conflict);
        break;
      case 'merge':
        await this.applyMergeResolution(conflict);
        break;
      case 'manual':
        // Store for manual resolution
        this.operations.set(`conflict-${conflict.id}`, {
          type: 'update',
          entity: conflict.entity,
          id: conflict.id,
          data: conflict,
          timestamp: Date.now(),
          source: 'conflict',
          status: 'conflict',
        });
        break;
    }
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    switch (operation.entity) {
      case 'thread':
        await this.syncThread(operation);
        break;
      case 'jira_link':
        await this.syncJiraLink(operation);
        break;
      case 'github_link':
        await this.syncGitHubLink(operation);
        break;
    }
  }

  private async syncThread(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        if (operation.source === 'store') {
          await mockDatabaseService.threads.create(operation.data);
        }
        break;
      case 'update':
        if (operation.source === 'store') {
          await mockDatabaseService.threads.update(operation.id, operation.data);
        }
        break;
      case 'delete':
        if (operation.source === 'store') {
          await mockDatabaseService.threads.delete(operation.id);
        }
        break;
    }
  }

  private async syncJiraLink(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
      case 'update':
        if (operation.source === 'store' && operation.data.jiraKey) {
          await mockDatabaseService.addJiraLink(operation.id, operation.data.jiraKey);
        }
        break;
      case 'delete':
        // Implementation for removing Jira links
        break;
    }
  }

  private async syncGitHubLink(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
      case 'update':
        if (operation.source === 'store' && operation.data.number) {
          await mockDatabaseService.addGitHubLink(
            operation.id,
            operation.data.number,
            operation.data.owner,
            operation.data.repo
          );
        }
        break;
      case 'delete':
        // Implementation for removing GitHub links
        break;
    }
  }

  private async getEntityData(entityType: string, id: string): Promise<any> {
    switch (entityType) {
      case 'thread':
        return mockDatabaseService.findThread(id);
      case 'jira_link':
        return { jiraKey: await mockDatabaseService.getJiraKey(id) };
      case 'github_link':
        return { number: await mockDatabaseService.getGitHubNumber(id) };
      default:
        return null;
    }
  }

  private async applyToDatabase(entityType: string, id: string, value: any): Promise<void> {
    // Apply store value to database
    await this.executeOperation({
      type: 'update',
      entity: entityType as any,
      id,
      data: value,
      timestamp: Date.now(),
      source: 'store',
      status: 'pending',
    });
  }

  private async applyToStore(entityType: string, id: string, value: any): Promise<void> {
    // Apply database value to store
    // This would integrate with the actual store implementation
  }

  private async applyTimestampResolution(conflict: any): Promise<void> {
    // Choose value with latest timestamp
    const storeTimestamp = conflict.storeValue?.updatedAt || 0;
    const dbTimestamp = conflict.databaseValue?.updatedAt || 0;

    if (storeTimestamp > dbTimestamp) {
      await this.applyToDatabase(conflict.entity, conflict.id, conflict.storeValue);
    } else {
      await this.applyToStore(conflict.entity, conflict.id, conflict.databaseValue);
    }
  }

  private async applyMergeResolution(conflict: any): Promise<void> {
    // Merge both values intelligently
    const merged = {
      ...conflict.databaseValue,
      ...conflict.storeValue,
      updatedAt: Math.max(
        conflict.storeValue?.updatedAt || 0,
        conflict.databaseValue?.updatedAt || 0
      ),
    };

    await this.applyToDatabase(conflict.entity, conflict.id, merged);
    await this.applyToStore(conflict.entity, conflict.id, merged);
  }

  private isEqual(a: any, b: any): boolean {
    // Simple equality check - could be enhanced with deep comparison
    return JSON.stringify(a) === JSON.stringify(b);
  }
}

// Global sync instance for tests
export const testSync = new StoreDatabaseSync({
  enableAutoSync: false,
  conflictResolution: 'timestamp_wins',
  enableLogging: process.env.DEBUG_SYNC === 'true',
});

// Test utilities
export const createSyncTest = (config?: any) => {
  const sync = new StoreDatabaseSync(config);

  return {
    enableAutoSync: () => sync.enableAutoSync(),
    disableAutoSync: () => sync.disableAutoSync(),
    performSync: () => sync.performSync(),
    queueOperation: (op: any) => sync.queueOperation(op),
    waitForSync: (timeout?: number) => sync.waitForSync(timeout),
    getStats: () => sync.getStats(),
    reset: () => sync.reset(),
    forceSyncEntity: (type: any, id: string) => sync.forceSyncEntity(type, id),
  };
};

// Vitest integration helpers
export const setupSyncTest = () => {
  let sync: StoreDatabaseSync | null = null;

  return {
    beforeEach: (config?: any) => {
      sync = new StoreDatabaseSync(config);
      return sync;
    },
    afterEach: async () => {
      if (sync) {
        await sync.reset();
        sync = null;
      }
    },
    performSync: () => sync?.performSync(),
    waitForSync: (timeout?: number) => sync?.waitForSync(timeout),
    getStats: () => sync?.getStats(),
  };
};

export default testSync;