/**
 * Database Service Mock Implementation
 * 
 * Comprehensive mock for DatabaseService and repositories
 * Provides in-memory storage with proper error simulation and transaction support
 */

import { vi } from "vitest";
import type { Thread, JiraLinkMapping, GitHubLinkMapping } from "../../src/interfaces";

// In-memory storage for testing with transaction support
let mockThreads: Thread[] = [];
let mockJiraLinks: JiraLinkMapping[] = [];
let mockGitHubLinks: GitHubLinkMapping[] = [];
let transactionInProgress = false;
let transactionData: {
  threads: Thread[];
  jiraLinks: JiraLinkMapping[];
  githubLinks: GitHubLinkMapping[];
} | null = null;
let connectionFailureMode = false;
let slowQueryMode = false;

/**
 * Mock Thread Repository with enhanced transaction and error handling
 */
export const mockThreadRepository = {
  findById: vi.fn().mockImplementation(async (id: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    if (slowQueryMode) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const threads = transactionInProgress ? transactionData?.threads || [] : mockThreads;
    return threads.find(t => t.id === id) || null;
  }),

  create: vi.fn().mockImplementation(async (data: any) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const thread: Thread = {
      id: data.id,
      title: data.title,
      appliedTags: data.tagIds || [],
      archived: data.archived || false,
      locked: data.locked || false,
      comments: [],
    };
    if (transactionInProgress && transactionData) {
      transactionData.threads.push(thread);
    } else {
      mockThreads.push(thread);
    }
    return undefined;
  }),

  update: vi.fn().mockImplementation(async (id: string, data: any) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const threads = transactionInProgress ? transactionData?.threads || [] : mockThreads;
    const index = threads.findIndex(t => t.id === id);
    if (index !== -1) {
      threads[index] = {
        ...threads[index],
        ...data,
      };
    } else {
      throw new Error('Record not found for update');
    }
    return undefined;
  }),

  delete: vi.fn().mockImplementation(async (id: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    if (transactionInProgress && transactionData) {
      transactionData.threads = transactionData.threads.filter(t => t.id !== id);
    } else {
      mockThreads = mockThreads.filter(t => t.id !== id);
    }
    return undefined;
  }),

  findAll: vi.fn().mockImplementation(async () => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const threads = transactionInProgress ? transactionData?.threads || [] : mockThreads;
    return [...threads];
  }),
};

/**
 * Mock GitHub Repository with enhanced transaction support
 */
export const mockGitHubRepository = {
  findByNumber: vi.fn().mockImplementation(async (number: number) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.githubLinks || [] : mockGitHubLinks;
    const link = links.find(l => l.number === number);
    return link || null;
  }),

  create: vi.fn().mockImplementation(async (data: any) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const link: GitHubLinkMapping = {
      threadId: data.threadId,
      number: data.number,
      owner: data.owner,
      repo: data.repo,
      createdAt: Date.now(),
    };
    if (transactionInProgress && transactionData) {
      transactionData.githubLinks.push(link);
    } else {
      mockGitHubLinks.push(link);
    }
    return undefined;
  }),

  update: vi.fn().mockImplementation(async (id: string, data: any) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.githubLinks || [] : mockGitHubLinks;
    const index = links.findIndex(l => l.threadId === id);
    if (index !== -1) {
      links[index] = {
        ...links[index],
        ...data,
      };
    }
    return undefined;
  }),

  delete: vi.fn().mockImplementation(async (id: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    if (transactionInProgress && transactionData) {
      transactionData.githubLinks = transactionData.githubLinks.filter(l => l.threadId !== id);
    } else {
      mockGitHubLinks = mockGitHubLinks.filter(l => l.threadId !== id);
    }
    return undefined;
  }),
};

/**
 * Mock Database Service with comprehensive transaction support
 */
export const mockDatabaseService = {
  // Initialization with connection management
  initialize: vi.fn().mockImplementation(async () => {
    if (connectionFailureMode) {
      throw new Error('Failed to initialize database connection');
    }
    return undefined;
  }),
  close: vi.fn().mockImplementation(async () => {
    if (connectionFailureMode) {
      throw new Error('Failed to close database connection');
    }
    transactionInProgress = false;
    transactionData = null;
    return undefined;
  }),

  // Transaction support
  $transaction: vi.fn().mockImplementation(async (fn: Function) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost during transaction');
    }
    
    // Start transaction
    transactionInProgress = true;
    transactionData = {
      threads: [...mockThreads],
      jiraLinks: [...mockJiraLinks],
      githubLinks: [...mockGitHubLinks],
    };
    
    try {
      const result = await fn(mockDatabaseService);
      
      // Commit transaction
      mockThreads = [...transactionData.threads];
      mockJiraLinks = [...transactionData.jiraLinks];
      mockGitHubLinks = [...transactionData.githubLinks];
      
      transactionInProgress = false;
      transactionData = null;
      
      return result;
    } catch (error) {
      // Rollback transaction
      transactionInProgress = false;
      transactionData = null;
      throw error;
    }
  }),

  // Repository references
  threads: mockThreadRepository,
  github: mockGitHubRepository,

  // Thread operations with enhanced error handling
  getAllThreads: vi.fn().mockImplementation(async () => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const threads = transactionInProgress ? transactionData?.threads || [] : mockThreads;
    return [...threads];
  }),

  findThread: vi.fn().mockImplementation(async (threadId: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const threads = transactionInProgress ? transactionData?.threads || [] : mockThreads;
    return threads.find(t => t.id === threadId) || null;
  }),

  ensureGuildAndChannel: vi.fn().mockImplementation(async (params: any) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    return undefined;
  }),

  ensureTags: vi.fn().mockImplementation(async (tags: any[]) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    return undefined;
  }),

  removeJiraLink: vi.fn().mockImplementation(async (threadId: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.jiraLinks || [] : mockJiraLinks;
    const filtered = links.filter(l => l.threadId !== threadId);
    if (transactionInProgress && transactionData) {
      transactionData.jiraLinks = filtered;
    } else {
      mockJiraLinks = filtered;
    }
    return undefined;
  }),

  // Jira operations with transaction support
  getJiraKey: vi.fn().mockImplementation(async (threadId: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.jiraLinks || [] : mockJiraLinks;
    const link = links.find(l => l.threadId === threadId);
    return link?.jiraKey || null;
  }),

  addJiraLink: vi.fn().mockImplementation(async (threadId: string, jiraKey: string, githubNumber?: number) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    
    const links = transactionInProgress ? transactionData?.jiraLinks || [] : mockJiraLinks;
    const existingIndex = links.findIndex(l => l.threadId === threadId);
    
    if (existingIndex !== -1) {
      links[existingIndex] = {
        ...links[existingIndex],
        jiraKey,
        githubNumber: githubNumber || links[existingIndex].githubNumber,
      };
    } else {
      const newLink: JiraLinkMapping = {
        threadId,
        jiraKey,
        githubNumber,
        createdAt: Date.now(),
      };
      
      if (transactionInProgress && transactionData) {
        transactionData.jiraLinks.push(newLink);
      } else {
        mockJiraLinks.push(newLink);
      }
    }
    return undefined;
  }),

  getJiraLinks: vi.fn().mockImplementation(async () => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.jiraLinks || [] : mockJiraLinks;
    return [...links];
  }),

  // GitHub operations with enhanced transaction support
  getGitHubNumber: vi.fn().mockImplementation(async (threadId: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.githubLinks || [] : mockGitHubLinks;
    const link = links.find(l => l.threadId === threadId);
    return link?.number || null;
  }),

  addGitHubLink: vi.fn().mockImplementation(async (threadId: string, number: number, owner?: string, repo?: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    
    const links = transactionInProgress ? transactionData?.githubLinks || [] : mockGitHubLinks;
    const existingIndex = links.findIndex(l => l.threadId === threadId);
    
    if (existingIndex !== -1) {
      links[existingIndex] = {
        ...links[existingIndex],
        number,
        owner: owner || links[existingIndex].owner,
        repo: repo || links[existingIndex].repo,
      };
    } else {
      const newLink: GitHubLinkMapping = {
        threadId,
        number,
        owner,
        repo,
        createdAt: Date.now(),
      };
      
      if (transactionInProgress && transactionData) {
        transactionData.githubLinks.push(newLink);
      } else {
        mockGitHubLinks.push(newLink);
      }
    }
    return undefined;
  }),

  getGitHubLinks: vi.fn().mockImplementation(async () => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.githubLinks || [] : mockGitHubLinks;
    return [...links];
  }),

  getGitHubLinkDetails: vi.fn().mockImplementation(async (threadId: string) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    const links = transactionInProgress ? transactionData?.githubLinks || [] : mockGitHubLinks;
    const link = links.find(l => l.threadId === threadId);
    return link ? {
      owner: link.owner || 'unknown',
      repo: link.repo || 'unknown',
      number: link.number
    } : null;
  }),

  // Migration helpers with transaction support
  importFromLegacyStore: vi.fn().mockImplementation(async (data: any) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost during import');
    }
    
    return mockDatabaseService.$transaction(async () => {
      // Clear existing data
      if (transactionData) {
        transactionData.threads = [];
        transactionData.jiraLinks = [];
        transactionData.githubLinks = [];
        
        // Import new data
        transactionData.threads = [...(data.threads || [])];
        transactionData.jiraLinks = [...(data.jiraLinks || [])];
        transactionData.githubLinks = [...(data.githubLinks || [])];
      }
    });
  }),
  
  // Raw query support for advanced operations
  $queryRaw: vi.fn().mockImplementation(async (query: any) => {
    if (connectionFailureMode) {
      throw new Error('Database connection lost');
    }
    // Mock successful raw query
    return [];
  }),
  
  $disconnect: vi.fn().mockImplementation(async () => {
    transactionInProgress = false;
    transactionData = null;
    return undefined;
  }),
};

/**
 * Enhanced error simulation utilities
 */
export const simulateDbError = (errorType: 'connection' | 'constraint' | 'timeout' = 'connection', methods?: string[]) => {
  const errorMap = {
    connection: new Error('SQLITE_CANTOPEN: unable to open database file'),
    constraint: new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed'),
    timeout: new Error('SQLITE_BUSY: database is locked'),
  };

  const error = errorMap[errorType];
  
  if (methods) {
    // Simulate error only for specific methods
    methods.forEach(methodName => {
      if (mockDatabaseService[methodName as keyof typeof mockDatabaseService]) {
        (mockDatabaseService[methodName as keyof typeof mockDatabaseService] as any).mockRejectedValueOnce(error);
      }
      if (mockThreadRepository[methodName as keyof typeof mockThreadRepository]) {
        (mockThreadRepository[methodName as keyof typeof mockThreadRepository] as any).mockRejectedValueOnce(error);
      }
      if (mockGitHubRepository[methodName as keyof typeof mockGitHubRepository]) {
        (mockGitHubRepository[methodName as keyof typeof mockGitHubRepository] as any).mockRejectedValueOnce(error);
      }
    });
  } else {
    // Simulate error for all methods
    Object.values(mockDatabaseService).forEach(method => {
      if (typeof method === 'function' && method.mockRejectedValueOnce) {
        method.mockRejectedValueOnce(error);
      }
    });

    Object.values(mockThreadRepository).forEach(method => {
      if (typeof method === 'function' && method.mockRejectedValueOnce) {
        method.mockRejectedValueOnce(error);
      }
    });

    Object.values(mockGitHubRepository).forEach(method => {
      if (typeof method === 'function' && method.mockRejectedValueOnce) {
        method.mockRejectedValueOnce(error);
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
 * Set slow query mode for testing timeouts
 */
export const setSlowQueryMode = (enabled: boolean) => {
  slowQueryMode = enabled;
};

/**
 * Force transaction rollback for testing
 */
export const forceTransactionRollback = () => {
  if (transactionInProgress) {
    transactionInProgress = false;
    transactionData = null;
  }
};

/**
 * Reset all mock data and calls with comprehensive cleanup
 */
export const resetDatabaseMocks = () => {
  mockThreads = [];
  mockJiraLinks = [];
  mockGitHubLinks = [];
  
  // Reset transaction state
  transactionInProgress = false;
  transactionData = null;
  connectionFailureMode = false;
  slowQueryMode = false;
  
  // Reset all mock functions
  Object.values(mockDatabaseService).forEach(method => {
    if (typeof method === 'function' && method.mockClear) {
      method.mockClear();
    }
  });

  Object.values(mockThreadRepository).forEach(method => {
    if (typeof method === 'function' && method.mockClear) {
      method.mockClear();
    }
  });

  Object.values(mockGitHubRepository).forEach(method => {
    if (typeof method === 'function' && method.mockClear) {
      method.mockClear();
    }
  });
};

/**
 * Get current mock data state
 */
export const getMockDataState = () => ({
  threads: [...mockThreads],
  jiraLinks: [...mockJiraLinks],
  githubLinks: [...mockGitHubLinks],
});

/**
 * Set mock data state with transaction awareness
 */
export const setMockDataState = (data: {
  threads?: Thread[];
  jiraLinks?: JiraLinkMapping[];
  githubLinks?: GitHubLinkMapping[];
}) => {
  if (transactionInProgress && transactionData) {
    if (data.threads) transactionData.threads = [...data.threads];
    if (data.jiraLinks) transactionData.jiraLinks = [...data.jiraLinks];
    if (data.githubLinks) transactionData.githubLinks = [...data.githubLinks];
  } else {
    if (data.threads) mockThreads = [...data.threads];
    if (data.jiraLinks) mockJiraLinks = [...data.jiraLinks];
    if (data.githubLinks) mockGitHubLinks = [...data.githubLinks];
  }
};

/**
 * Get transaction status for testing
 */
export const getTransactionStatus = () => ({
  inProgress: transactionInProgress,
  hasData: transactionData !== null,
});

/**
 * Wait for all pending database operations to complete
 */
export const waitForDatabaseOperations = async (timeoutMs = 1000) => {
  const startTime = Date.now();
  
  while (transactionInProgress && Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  if (transactionInProgress) {
    throw new Error('Database operations timed out');
  }
};

// Enhanced exports for comprehensive testing
export { 
  mockDatabaseService as default,
  transactionInProgress,
  connectionFailureMode,
  slowQueryMode
};

// Global mock client for Prisma compatibility
export const MockPrismaClient = vi.fn().mockImplementation(() => mockDatabaseService);

// Test utilities for complex scenarios
export const DatabaseTestUtils = {
  simulateDbError,
  setConnectionFailureMode,
  setSlowQueryMode,
  forceTransactionRollback,
  resetDatabaseMocks,
  setMockDataState,
  getMockDataState,
  getTransactionStatus,
  waitForDatabaseOperations,
};