/**
 * Prisma Client Mock Implementation
 * 
 * Comprehensive mock for @prisma/client with proper transaction support,
 * query simulation, and error handling for testing database operations
 */

import { vi } from "vitest";

// Mock data storage for consistent test behavior
const mockData = {
  threads: new Map(),
  messages: new Map(),
  githubIssues: new Map(),
  jiraIssues: new Map(),
  threadGithubLinks: new Map(),
  threadJiraLinks: new Map(),
  threadTags: new Map(),
  tags: new Map(),
  discordUsers: new Map(),
  userSessions: new Map(),
};

// Helper to generate unique IDs
let idCounter = 1;
const generateId = () => (idCounter++).toString();

/**
 * Mock Prisma model operations
 */
const createMockModel = (modelName: string, dataStore: Map<any, any>) => ({
  findUnique: vi.fn().mockImplementation(async ({ where, include }: any) => {
    const key = Object.values(where)[0] as string;
    const record = dataStore.get(key);
    
    if (!record) return null;
    
    // Simulate includes
    if (include && record) {
      const result = { ...record };
      // Add included relations based on the model
      if (modelName === 'thread' && include.messages) {
        result.messages = Array.from(mockData.messages.values())
          .filter((msg: any) => msg.threadId === record.id && !msg.deletedAt);
      }
      if (modelName === 'thread' && include.githubLinks) {
        result.githubLinks = Array.from(mockData.threadGithubLinks.values())
          .filter((link: any) => link.threadId === record.id)
          .map((link: any) => ({
            ...link,
            githubIssue: mockData.githubIssues.get(link.githubIssueId)
          }));
      }
      if (modelName === 'thread' && include.jiraLinks) {
        result.jiraLinks = Array.from(mockData.threadJiraLinks.values())
          .filter((link: any) => link.threadId === record.id)
          .map((link: any) => ({
            ...link,
            jiraIssue: mockData.jiraIssues.get(link.jiraIssueId)
          }));
      }
      if (modelName === 'thread' && include.tags) {
        result.tags = Array.from(mockData.threadTags.values())
          .filter((tt: any) => tt.threadId === record.id)
          .map((tt: any) => ({
            ...tt,
            tag: mockData.tags.get(tt.tagId)
          }));
      }
      return result;
    }
    
    return record;
  }),

  findFirst: vi.fn().mockImplementation(async ({ where, include, orderBy }: any) => {
    const records = Array.from(dataStore.values());
    let filtered = records;
    
    // Simple where filtering
    if (where) {
      filtered = records.filter((record: any) => {
        return Object.entries(where).every(([key, value]) => {
          if (key === 'deletedAt' && value === null) {
            return record.deletedAt === null || record.deletedAt === undefined;
          }
          if (typeof value === 'object' && value !== null && 'lt' in value) {
            return new Date(record[key]) < new Date((value as any).lt);
          }
          if (typeof value === 'object' && value !== null && 'gt' in value) {
            return new Date(record[key]) > new Date((value as any).gt);
          }
          if (typeof value === 'object' && value !== null && 'not' in value) {
            return record[key] !== (value as any).not;
          }
          return record[key] === value;
        });
      });
    }
    
    // Simple ordering
    if (orderBy) {
      const [field, direction] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
      filtered.sort((a: any, b: any) => {
        const aVal = a[field];
        const bVal = b[field];
        if (direction === 'desc') {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        }
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      });
    }
    
    return filtered[0] || null;
  }),

  findMany: vi.fn().mockImplementation(async ({ where, include, orderBy }: any) => {
    const records = Array.from(dataStore.values());
    let filtered = records;
    
    // Simple where filtering
    if (where) {
      filtered = records.filter((record: any) => {
        return Object.entries(where).every(([key, value]) => {
          if (key === 'deletedAt' && value === null) {
            return record.deletedAt === null || record.deletedAt === undefined;
          }
          if (typeof value === 'object' && value !== null && 'in' in value) {
            return (value as any).in.includes(record[key]);
          }
          return record[key] === value;
        });
      });
    }
    
    // Simple ordering
    if (orderBy) {
      const [field, direction] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
      filtered.sort((a: any, b: any) => {
        const aVal = a[field];
        const bVal = b[field];
        if (direction === 'desc') {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        }
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      });
    }
    
    return filtered;
  }),

  create: vi.fn().mockImplementation(async ({ data }: any) => {
    const id = data.id || generateId();
    const record = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dataStore.set(id, record);
    return record;
  }),

  update: vi.fn().mockImplementation(async ({ where, data }: any) => {
    const key = Object.values(where)[0] as string;
    const existing = dataStore.get(key);
    if (!existing) {
      throw new Error(`Record not found`);
    }
    
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    dataStore.set(key, updated);
    return updated;
  }),

  upsert: vi.fn().mockImplementation(async ({ where, create, update }: any) => {
    const key = Object.values(where)[0] as string;
    const existing = dataStore.get(key);
    
    if (existing) {
      const updated = {
        ...existing,
        ...update,
        updatedAt: new Date(),
      };
      dataStore.set(key, updated);
      return updated;
    } else {
      const id = create.id || key || generateId();
      const record = {
        ...create,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dataStore.set(id, record);
      return record;
    }
  }),

  delete: vi.fn().mockImplementation(async ({ where }: any) => {
    let keyToDelete: any = null;

    if (where.threadId_githubIssueId) {
      for (const [key, value] of dataStore.entries()) {
        if (value.threadId === where.threadId_githubIssueId.threadId && value.githubIssueId === where.threadId_githubIssueId.githubIssueId) {
          keyToDelete = key;
          break;
        }
      }
    } else if (where.threadId_jiraIssueId) {
      for (const [key, value] of dataStore.entries()) {
        if (value.threadId === where.threadId_jiraIssueId.threadId && value.jiraIssueId === where.threadId_jiraIssueId.jiraIssueId) {
          keyToDelete = key;
          break;
        }
      }
    } else {
      keyToDelete = Object.values(where)[0] as string;
    }

    const existing = dataStore.get(keyToDelete);
    if (!existing) {
      // Fail silently in tests if record not found, to avoid unrelated test failures
      return null;
    }
    dataStore.delete(keyToDelete);
    return existing;
  }),

  deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
    let deletedCount = 0;
    const records = Array.from(dataStore.entries());
    
    for (const [key, record] of records) {
      const shouldDelete = Object.entries(where || {}).every(([field, value]) => {
        if (typeof value === 'object' && value !== null && 'lt' in value) {
          return new Date((record as any)[field]) < new Date((value as any).lt);
        }
        if (typeof value === 'object' && value !== null && 'in' in value) {
          return (value as any).in.includes((record as any)[field]);
        }
        return (record as any)[field] === value;
      });
      
      if (shouldDelete) {
        dataStore.delete(key);
        deletedCount++;
      }
    }
    
    return { count: deletedCount };
  }),

  createMany: vi.fn().mockImplementation(async ({ data, skipDuplicates }: any) => {
    const records = Array.isArray(data) ? data : [data];
    let created = 0;
    
    for (const item of records) {
      const id = item.id || generateId();
      if (skipDuplicates && dataStore.has(id)) {
        continue;
      }
      
      const record = {
        ...item,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dataStore.set(id, record);
      created++;
    }
    
    return { count: created };
  }),

  count: vi.fn().mockImplementation(async (opts: any = {}) => {
    const { where } = opts || {};
    if (!opts || !where) {
      return dataStore.size;
    }
    
    const records = Array.from(dataStore.values());
    const filtered = records.filter((record: any) => {
      return Object.entries(where).every(([key, value]) => {
        if (key === 'deletedAt' && value === null) {
          return record.deletedAt === null || record.deletedAt === undefined;
        }
        if (typeof value === 'object' && value !== null && 'lt' in value) {
          return new Date(record[key]) < new Date((value as any).lt);
        }
        if (typeof value === 'object' && value !== null && 'gt' in value) {
          return new Date(record[key]) > new Date((value as any).gt);
        }
        if (typeof value === 'object' && value !== null && 'not' in value) {
          return record[key] !== (value as any).not;
        }
        return record[key] === value;
      });
    });
    
    return filtered.length;
  }),
});

/**
 * Mock PrismaClient implementation
 */
function MockPrismaClient(this: any) {
  // Initialize model mocks
  this.thread = createMockModel('thread', mockData.threads);
  this.message = createMockModel('message', mockData.messages);
  this.githubIssue = createMockModel('githubIssue', mockData.githubIssues);
  this.jiraIssue = createMockModel('jiraIssue', mockData.jiraIssues);
  this.threadGithubLink = createMockModel('threadGithubLink', mockData.threadGithubLinks);
  this.threadJiraLink = createMockModel('threadJiraLink', mockData.threadJiraLinks);
  this.threadTag = createMockModel('threadTag', mockData.threadTags);
  this.tag = createMockModel('tag', mockData.tags);
  this.discordUser = createMockModel('discordUser', mockData.discordUsers);
  this.userSession = createMockModel('userSession', mockData.userSessions);

  // Core Prisma methods
  this.$connect = vi.fn().mockResolvedValue(undefined);
  this.$disconnect = vi.fn().mockResolvedValue(undefined);
  // Event subscription mock for logging hooks
  this.$on = vi.fn();
  
  this.$queryRaw = vi.fn().mockImplementation(async (query: any) => {
    // Mock basic queries
    if (typeof query === 'string' || (query && query.strings)) {
      return [{ result: 1 }];
    }
    return [];
  });
  
  this.$executeRaw = vi.fn().mockResolvedValue(1);
  
  this.$transaction = vi.fn().mockImplementation(async (operations: any) => {
    if (typeof operations === 'function') {
      // Interactive transaction
      return operations(this);
    } else if (Array.isArray(operations)) {
      // Sequential transaction
      const results = [];
      for (const op of operations) {
        results.push(await op);
      }
      return results;
    }
  });

  // Health check method
  this.$queryRawUnsafe = vi.fn().mockResolvedValue([{ result: 1 }]);
  
  try {
    (globalThis as any).mockPrismaClient = this;
    try {
      const defineVar = new Function('c', 'try { mockPrismaClient = c; } catch {}');
      defineVar(this);
    } catch {}
  } catch {}
  return this;
}

// Mock error classes
MockPrismaClient.PrismaClientKnownRequestError = class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: any;
  
  constructor(message: string, code: string, meta?: any) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.meta = meta;
  }
};

MockPrismaClient.PrismaClientUnknownRequestError = class PrismaClientUnknownRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientUnknownRequestError';
  }
};

MockPrismaClient.PrismaClientRustPanicError = class PrismaClientRustPanicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientRustPanicError';
  }
};

MockPrismaClient.PrismaClientInitializationError = class PrismaClientInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientInitializationError';
  }
};

MockPrismaClient.PrismaClientValidationError = class PrismaClientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientValidationError';
  }
};

/**
 * Test utilities for mock data manipulation
 */
export const prismaTestUtils = {
  /**
   * Clear all mock data
   */
  clearAllData: () => {
    Object.values(mockData).forEach(store => store.clear());
    idCounter = 1;
  },

  /**
   * Get mock data store
   */
  getMockData: () => mockData,

  /**
   * Seed test data
   */
  seedTestData: () => {
    // Add some test data
    mockData.threads.set('thread1', {
      id: 'thread1',
      channelId: 'channel1',
      title: 'Test Thread 1',
      archived: false,
      locked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockData.githubIssues.set(1, {
      id: 1,
      number: 1,
      owner: 'testowner',
      repo: 'testrepo',
      title: 'Test Issue',
      state: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockData.jiraIssues.set('JIRA-1', {
      id: 'JIRA-1',
      key: 'JIRA-1',
      projectKey: 'JIRA',
      summary: 'Test Jira Issue',
      status: 'To Do',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Simulate database errors
   */
  simulateError: (method: string, errorType: 'connection' | 'constraint' | 'notfound' = 'connection') => {
    const client = new MockPrismaClient();
    const errorMap = {
      connection: new MockPrismaClient.PrismaClientInitializationError('Database connection failed'),
      constraint: new MockPrismaClient.PrismaClientKnownRequestError('Constraint violation', 'P2002'),
      notfound: new MockPrismaClient.PrismaClientKnownRequestError('Record not found', 'P2025'),
    };

    // Mock the specified method to throw error
    if (method.includes('.')) {
      const [model, operation] = method.split('.');
      client[model][operation].mockRejectedValueOnce(errorMap[errorType]);
    } else {
      client[method].mockRejectedValueOnce(errorMap[errorType]);
    }

    return client;
  },

  /**
   * Create mock client with custom behavior
   */
  createMockClient: (overrides: any = {}) => {
    const client = new MockPrismaClient();
    Object.assign(client, overrides);
    return client;
  },
};

// Export the mock and utilities
export { MockPrismaClient };
export default MockPrismaClient;
