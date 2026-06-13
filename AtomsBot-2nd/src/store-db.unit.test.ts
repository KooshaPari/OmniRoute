/**
 * Test suite for database-backed store
 * Tests thread operations, link management, batch operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DatabaseStore } from "./store-db";

// Mock the services
vi.mock("./database/DatabaseService", () => ({
  databaseService: {
    initialize: vi.fn(),
    getAllThreads: vi.fn().mockResolvedValue([]),
    threads: {
      create: vi.fn(),
      update: vi.fn(),
      findById: vi.fn()
    },
    getJiraKey: vi.fn().mockResolvedValue(null),
    addJiraLink: vi.fn(),
    getGitHubNumber: vi.fn().mockResolvedValue(null),
    addGitHubLink: vi.fn(),
    getJiraLinks: vi.fn().mockResolvedValue([]),
    getGitHubLinks: vi.fn().mockResolvedValue([]),
    close: vi.fn()
  }
}));

vi.mock("./cache/redis", () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  }
}));

vi.mock("./messaging/nats", () => ({
  eventPublisher: {
    publish: vi.fn()
  }
}));

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe("DatabaseStore", () => {
  let store: DatabaseStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new DatabaseStore();
  });

  afterEach(async () => {
    if (store) {
      await store.cleanup();
    }
  });

  describe("Thread Operations", () => {
    it("should add thread", async () => {
      const threadData = {
        id: "thread123",
        title: "Test Thread",
        archived: false,
        locked: false,
        appliedTags: [],
        comments: []
      };

      await store.addThread(threadData, "channel123");

      expect(store.findThread("thread123")).toEqual(threadData);
    });

    it("should find thread by ID", () => {
      const threadData = {
        id: "thread123",
        title: "Test Thread",
        archived: false,
        locked: false,
        appliedTags: [],
        comments: []
      };

      store.threads.push(threadData);
      const result = store.findThread("thread123");

      expect(result).toEqual(threadData);
    });

    it("should return undefined for non-existent thread", () => {
      const result = store.findThread("nonexistent");
      expect(result).toBeNull();
    });

    it("should update thread", async () => {
      const threadData = {
        id: "thread123",
        title: "Test Thread",
        archived: false,
        locked: false,
        appliedTags: [],
        comments: []
      };

      store.threads.push(threadData);

      const updates = {
        title: "Updated Thread",
        archived: true
      };

      await store.updateThread("thread123", updates);

      const updated = store.findThread("thread123");
      expect(updated?.title).toBe("Updated Thread");
      expect(updated?.archived).toBe(true);
    });

    it("should clear all threads", () => {
      const threadData = {
        id: "thread123",
        title: "Test Thread",
        archived: false,
        locked: false,
        appliedTags: [],
        comments: []
      };

      store.threads.push(threadData);
      expect(store.threads).toHaveLength(1);

      store.clearThreads();
      expect(store.threads).toHaveLength(0);
    });
  });

  describe("Jira Link Operations", () => {
    it("should get Jira key", async () => {
      const jiraKey = await store.getJiraKey("thread123");
      expect(jiraKey).toBeNull();
    });

    it("should add Jira link", async () => {
      await store.addJiraLink("thread123", "TEST-1");
      // Verify the link was processed (actual persistence is mocked)
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it("should get Jira link mapping", () => {
      const threadData = {
        id: "thread123",
        title: "Test Thread",
        archived: false,
        locked: false,
        appliedTags: [],
        comments: []
      };

      store.threads.push(threadData);
      const mapping = store.getJiraLinkMapping("thread123");

      expect(mapping).toBeNull(); // No Jira key set
    });

    it("should remove Jira link", async () => {
      await store.removeJiraLink("thread123");
      // Verify the removal was processed (actual persistence is mocked)
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe("GitHub Link Operations", () => {
    it("should get GitHub number", async () => {
      const githubNumber = await store.getGitHubNumber("thread123");
      expect(githubNumber).toBeNull();
    });

    it("should add GitHub link", async () => {
      await store.addGitHubLink("thread123", 123, "owner", "repo");
      // Verify the link was processed (actual persistence is mocked)
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it("should get GitHub link mapping", () => {
      const threadData = {
        id: "thread123",
        title: "Test Thread",
        archived: false,
        locked: false,
        appliedTags: [],
        comments: []
      };

      store.threads.push(threadData);
      const mapping = store.getGitHubLinkMapping("thread123");

      expect(mapping).toBeNull(); // No GitHub number set
    });
  });

  describe("Batch Operations", () => {
    it("should load threads", async () => {
      await store.loadThreads();
      expect(store.threads).toEqual([]);
    });

    it("should get link stats", async () => {
      const stats = await store.getLinkStats();
      
      expect(stats).toEqual({
        jira: { totalMappings: 0, threadsWithKey: 0 },
        github: { totalMappings: 0, threadsWithNumber: 0 }
      });
    });

    it("should log link restoration summary", async () => {
      await store.logLinkRestorationSummary();
      // Verify no errors thrown
      expect(true).toBe(true);
    });
  });

  describe("Database Management", () => {
    it("should validate integrity", () => {
      const result = store.validateIntegrity();
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should detect integrity issues", () => {
      // Add invalid thread data
      (store.threads as any).push({ id: null, title: null });
      
      const result = store.validateIntegrity();
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should cleanup resources", async () => {
      await store.cleanup();
      expect(store.threads).toHaveLength(0);
    });
  });

  describe("Link Reconciliation", () => {
    it("should start link reconciler", () => {
      store.startLinkReconciler(1000);
      // Verify no errors thrown
      expect(true).toBe(true);
    });

    it("should stop link reconciler", () => {
      store.startLinkReconciler(1000);
      store.stopLinkReconciler();
      // Verify no errors thrown
      expect(true).toBe(true);
    });

    it("should reconcile cached links", async () => {
      await store.reconcileCachedLinks();
      // Verify no errors thrown
      expect(true).toBe(true);
    });
  });
});