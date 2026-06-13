/**
 * Store Mock Implementation
 * 
 * Comprehensive mock for the store module including all methods
 * used across the codebase for thread management and Jira links.
 */

import { vi } from "vitest";
import type { GuildForumTag } from "discord.js";
import type { Thread } from "../../src/interfaces";

// Mock store class
export class MockStore {
  public threads: Thread[] = [];
  public availableTags: GuildForumTag[] = [];
  private jiraLinks: Array<{ threadId: string; jiraKey: string; githubNumber?: number; createdAt: number }> = [];
  private githubLinks: Array<{ threadId: string; number: number; owner?: string; repo?: string }> = [];

  // Database configuration mock (private properties need public accessor for testing)
  public dbEnabled: boolean = false;
  private _db: any = null;
  private _dbMod: any = null;

  // Thread management methods - keep sync versions for backwards compatibility
  deleteThread = vi.fn().mockImplementation((id: string | undefined): Thread[] => {
    if (id === undefined || id === null) {
      return this.threads;
    }
    
    const index = this.threads.findIndex((obj) => obj.id === id);
    if (index !== -1) {
      this.threads.splice(index, 1);
    }
    return this.threads;
  });

  clearThreads = vi.fn().mockImplementation((): void => {
    this.threads = [];
  });

  // Tag management methods
  setAvailableTags = vi.fn().mockImplementation((tags: GuildForumTag[]): void => {
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }
    this.availableTags = [...tags];
  });

  getAvailableTags = vi.fn().mockImplementation((): GuildForumTag[] => {
    return [...this.availableTags];
  });

  // Statistics
  getStats = vi.fn().mockImplementation((): { threadCount: number; tagCount: number } => ({
    threadCount: this.threads.length,
    tagCount: this.availableTags.length
  }));

  // Jira link management methods - keep sync versions for backwards compatibility
  setJiraLink = vi.fn().mockImplementation((threadId: string, jiraKey: string): void => {
    if (!threadId || !jiraKey) {
      throw new Error('Invalid threadId or jiraKey provided');
    }

    // Remove existing link if present
    this.jiraLinks = this.jiraLinks.filter(link => link.threadId !== threadId);
    
    // Add new link
    this.jiraLinks.push({
      threadId,
      jiraKey,
      createdAt: Date.now()
    });
  });

  // Sync version
  getJiraKeySync = vi.fn().mockImplementation((threadId: string): string | undefined => {
    if (!threadId) {
      return undefined;
    }
    const link = this.jiraLinks.find(link => link.threadId === threadId);
    return link?.jiraKey;
  });

  removeJiraLink = vi.fn().mockImplementation((threadId: string): void => {
    if (!threadId) {
      return;
    }
    this.jiraLinks = this.jiraLinks.filter(link => link.threadId !== threadId);
  });

  // The key missing method causing test failures
  restoreJiraLinks = vi.fn().mockImplementation((): void => {
    let restored = 0;
    
    this.jiraLinks.forEach(link => {
      const thread = this.threads.find(t => t.id === link.threadId);
      if (thread && !thread.jiraKey) {
        thread.jiraKey = link.jiraKey;
        restored++;
      }
    });
  });

  getAllJiraLinks = vi.fn().mockImplementation(() => {
    return [...this.jiraLinks];
  });
  
  // New database-style async methods
  addJiraLink = vi.fn().mockImplementation(async (threadId: string, jiraKey: string, githubNumber?: number): Promise<void> => {
    if (!threadId || !jiraKey) {
      throw new Error('Invalid threadId or jiraKey provided');
    }

    // Remove existing link if present
    this.jiraLinks = this.jiraLinks.filter(link => link.threadId !== threadId);
    
    // Add new link
    this.jiraLinks.push({
      threadId,
      jiraKey,
      githubNumber,
      createdAt: Date.now()
    });
  });
  
  addGitHubLink = vi.fn().mockImplementation(async (threadId: string, number: number, owner?: string, repo?: string): Promise<void> => {
    if (!threadId || typeof number !== 'number') {
      throw new Error('Invalid threadId or number provided');
    }

    // Remove existing link if present
    this.githubLinks = this.githubLinks.filter(link => link.threadId !== threadId);
    
    // Add new link
    this.githubLinks.push({
      threadId,
      number,
      owner,
      repo,
      createdAt: Date.now()
    });
  });
  
  getJiraKey = vi.fn().mockImplementation(async (threadId: string): Promise<string | null> => {
    if (!threadId) {
      return null;
    }
    const link = this.jiraLinks.find(link => link.threadId === threadId);
    return link?.jiraKey || null;
  });
  
  getGitHubNumber = vi.fn().mockImplementation(async (threadId: string): Promise<number | null> => {
    if (!threadId) {
      return null;
    }
    const link = this.githubLinks.find(link => link.threadId === threadId);
    return link?.number || null;
  });
  
  getJiraLinks = vi.fn().mockImplementation(async () => {
    return [...this.jiraLinks];
  });
  
  getGitHubLinks = vi.fn().mockImplementation(async () => {
    return this.githubLinks.map(link => ({
      threadId: link.threadId,
      number: link.number,
      owner: link.owner,
      repo: link.repo,
      createdAt: link.createdAt || Date.now()
    }));
  });
  
  // Synchronous implementations to match src/store API expected by tests
  findThread = vi.fn().mockImplementation((threadId: string): Thread | undefined => {
    if (!threadId) return undefined;
    return this.threads.find(t => t.id === threadId);
  });

  getAllThreads = vi.fn().mockImplementation((): Thread[] => {
    return [...this.threads];
  });

  addThread = vi.fn().mockImplementation((thread: Thread): void => {
    if (!thread || typeof thread !== 'object') {
      throw new Error('Invalid thread object provided');
    }
    if (!thread.id || typeof thread.id !== 'string') {
      throw new Error('Thread must have a valid string ID');
    }
    if (!thread.title || typeof thread.title !== 'string') {
      throw new Error('Thread must have a valid string title');
    }
    const existingIndex = this.threads.findIndex(t => t.id === thread.id);
    if (existingIndex !== -1) this.threads[existingIndex] = thread;
    else this.threads.push(thread);
  });

  updateThread = vi.fn().mockImplementation(async (threadId: string, updates: Partial<Thread>): Promise<void> => {
    const threadIndex = this.threads.findIndex(t => t.id === threadId);
    if (threadIndex !== -1) {
      this.threads[threadIndex] = { ...this.threads[threadIndex], ...updates } as Thread;
    }
  });
  
  // Database service compatibility
  loadThreads = vi.fn().mockImplementation(async (): Promise<void> => {
    // Mock loading from database
  });
  
  cleanup = vi.fn().mockImplementation(async (): Promise<void> => {
    this.threads = [];
    this.availableTags = [];
    this.jiraLinks = [];
    this.githubLinks = [];
  });

  // GitHub link management methods
  setGitHubLink = vi.fn().mockImplementation((threadId: string, number: number, owner?: string, repo?: string): void => {
    if (!threadId || typeof number !== 'number') {
      throw new Error('Invalid threadId or number provided');
    }

    // Remove existing link if present
    this.githubLinks = this.githubLinks.filter(link => link.threadId !== threadId);
    
    // Add new link
    this.githubLinks.push({
      threadId,
      number,
      owner,
      repo
    });
  });

  getGitHubLinkMapping = vi.fn().mockImplementation((threadId: string): { number: number; owner?: string; repo?: string } | undefined => {
    if (!threadId) {
      return undefined;
    }
    const link = this.githubLinks.find(link => link.threadId === threadId);
    return link ? { number: link.number, owner: link.owner, repo: link.repo } : undefined;
  });

  // Jira link mapping method
  getJiraLinkMapping = vi.fn().mockImplementation((threadId: string): { threadId: string; jiraKey: string; githubNumber?: number; createdAt: number } | undefined => {
    if (!threadId) {
      return undefined;
    }
    return this.jiraLinks.find(link => link.threadId === threadId);
  });

  // Restore GitHub links method
  restoreGitHubLinks = vi.fn().mockImplementation((): void => {
    let restored = 0;

    this.githubLinks.forEach(link => {
      const thread = this.threads.find(t => t.id === link.threadId);
      if (!thread) return;

      let changed = false;
      if (!thread.number && typeof link.number === 'number') {
        thread.number = link.number;
        changed = true;
      }
      if (link.owner && !thread.repoOwner) {
        thread.repoOwner = link.owner;
        changed = true;
      }
      if (link.repo && !thread.repoName) {
        thread.repoName = link.repo;
        changed = true;
      }
      if (changed) restored++;
    });
  });

  // File persistence methods
  loadLinksFromDisk = vi.fn().mockResolvedValue(undefined);
  persistLinks = vi.fn().mockResolvedValue(undefined);

  // Validation method
  validateIntegrity = vi.fn().mockImplementation((): { isValid: boolean; issues: string[] } => {
    const issues: string[] = [];

    // Check for duplicate thread IDs
    const threadIds = this.threads.map(t => t.id);
    const duplicateIds = threadIds.filter((id, index) => threadIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      issues.push(`Duplicate thread IDs found: ${duplicateIds.join(', ')}`);
    }

    // Check for invalid thread objects
    this.threads.forEach((thread, index) => {
      if (!thread.id || typeof thread.id !== 'string') {
        issues.push(`Thread at index ${index} has invalid ID`);
      }
      if (!thread.title || typeof thread.title !== 'string') {
        issues.push(`Thread at index ${index} has invalid title`);
      }
      if (!Array.isArray(thread.appliedTags)) {
        issues.push(`Thread at index ${index} has invalid appliedTags`);
      }
      if (!Array.isArray(thread.comments)) {
        issues.push(`Thread at index ${index} has invalid comments`);
      }
    });

    // Check available tags
    if (!Array.isArray(this.availableTags)) {
      issues.push('Available tags is not an array');
    }

    return { isValid: issues.length === 0, issues };
  });

  // Reset method for testing
  reset = vi.fn().mockImplementation((): void => {
    this.threads = [];
    this.availableTags = [];
    this.jiraLinks = [];
    this.githubLinks = [];
    this.dbEnabled = false;
    this._db = null;
    this._dbMod = null;
  });
}

// Create singleton mock store instance
export const mockStore = new MockStore();

// Mock the store module
export const storeMock = {
  store: mockStore,
  MockStore,
};

export default storeMock;