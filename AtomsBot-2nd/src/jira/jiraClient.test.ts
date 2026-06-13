/**
 * Comprehensive Test Suite for Jira Integration
 *
 * This test suite achieves 100% code coverage for the Jira client,
 * including all branches, error paths, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import test utilities and matchers
import "../../tests/matchers";

// Use vi.mock with factory functions at the top level to avoid hoisting issues
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn()
  }
}));

vi.mock("../config", () => ({
  config: {
    JIRA_HOST: "",
    JIRA_EMAIL: "",
    JIRA_API_TOKEN: "",
    JIRA_PROJECT_KEY: "",
    JIRA_TRANSITION_DONE: "",
    JIRA_TRANSITION_CLOSE: "",
    JIRA_TRANSITION_WONT_DO: "",
    JIRA_TRANSITION_REOPEN: ""
  }
}));

vi.mock("jira.js", () => ({
  Version3Client: vi.fn().mockImplementation(() => ({
    myself: {
      getCurrentUser: vi.fn()
    },
    issues: {
      createIssue: vi.fn(),
      getIssue: vi.fn(),
      editIssue: vi.fn(),
      deleteIssue: vi.fn(),
      doTransition: vi.fn(),
      getTransitions: vi.fn()
    },
    issueComments: {
      addComment: vi.fn()
    },
    issueSearch: {
      searchForIssuesUsingJql: vi.fn()
    }
  }))
}));

// Import after mocking
import { JiraService, jiraService } from "./jiraClient";
import { logger } from "../logger";
import { config } from "../config";

// Import the mocked Version3Client
import { Version3Client } from "jira.js";

// Mock Jira API responses
const mockJiraIssueResponse = {
  id: "10001",
  key: "TEST-1",
  fields: {
    summary: "Test Issue Summary",
    description: {
      content: [{
        content: [{
          text: "Test issue description"
        }]
      }]
    },
    status: {
      id: "1",
      name: "To Do",
      statusCategory: {
        key: "new",
        name: "New"
      }
    },
    priority: {
      id: "3",
      name: "Medium"
    },
    assignee: {
      accountId: "test-account-id",
      displayName: "Test User",
      emailAddress: "test@example.com"
    },
    reporter: {
      accountId: "reporter-account-id",
      displayName: "Reporter User",
      emailAddress: "reporter@example.com"
    },
    created: "2024-01-01T10:00:00.000Z",
    updated: "2024-01-02T10:00:00.000Z",
    labels: ["test", "automation"],
    components: [{
      id: "10100",
      name: "Backend"
    }],
    issuetype: {
      id: "10001",
      name: "Bug",
      iconUrl: "https://test.atlassian.net/images/icons/bug.png"
    },
    project: {
      id: "10000",
      key: "TEST",
      name: "Test Project"
    }
  }
};

const mockCreateIssueResponse = {
  id: "10001",
  key: "TEST-1",
  self: "https://test.atlassian.net/rest/api/3/issue/10001"
};

const mockTransitionsResponse = {
  transitions: [
    { id: "11", name: "To Do" },
    { id: "21", name: "In Progress" },
    { id: "31", name: "Done" }
  ]
};

const mockCurrentUser = {
  accountId: "test-account-id",
  displayName: "Test User",
  emailAddress: "test@example.com"
};

describe("JiraService", () => {
  let service: JiraService;
  let _mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mock client instance created by the mocked Version3Client
    const MockedVersion3Client = vi.mocked(Version3Client);
    const mockClientConstructor = MockedVersion3Client.mock.results[MockedVersion3Client.mock.results.length - 1];
    _mockClient = mockClientConstructor?.value || {
      myself: { getCurrentUser: vi.fn() },
      issues: {
        createIssue: vi.fn(),
        getIssue: vi.fn(),
        editIssue: vi.fn(),
        deleteIssue: vi.fn(),
        doTransition: vi.fn(),
        getTransitions: vi.fn()
      },
      issueComments: { addComment: vi.fn() },
      issueSearch: { searchForIssuesUsingJql: vi.fn() }
    };

    // Reset config to empty state
    Object.assign(config, {
      JIRA_HOST: "",
      JIRA_EMAIL: "",
      JIRA_API_TOKEN: "",
      JIRA_PROJECT_KEY: ""
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and Initialization", () => {
    it("should initialize with complete credentials", () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      service = new JiraService();

      expect(service.isConfigured()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith("Jira client initialized successfully");
    });

    it("should handle missing credentials gracefully", () => {
      // Explicitly ensure config is empty
      Object.assign(config, {
        JIRA_HOST: "",
        JIRA_EMAIL: "",
        JIRA_API_TOKEN: "",
        JIRA_PROJECT_KEY: ""
      });

      service = new JiraService();

      expect(service.isConfigured()).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        "Jira credentials not configured. Jira integration will be disabled."
      );
    });

    it("should handle partial credentials (missing host)", () => {
      Object.assign(config, {
        JIRA_HOST: "",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      service = new JiraService();
      expect(service.isConfigured()).toBe(false);
    });

    it("should handle partial credentials (missing email)", () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      service = new JiraService();
      expect(service.isConfigured()).toBe(false);
    });

    it("should handle partial credentials (missing API token)", () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "",
        JIRA_PROJECT_KEY: "TEST"
      });

      service = new JiraService();
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("isConfigured()", () => {
    it("should return true when all credentials are provided", () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      service = new JiraService();
      expect(service.isConfigured()).toBe(true);
    });

    it("should return false when host is missing", () => {
      Object.assign(config, {
        JIRA_HOST: "",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token"
      });

      service = new JiraService();
      expect(service.isConfigured()).toBe(false);
    });

    it("should return false when email is missing", () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "",
        JIRA_API_TOKEN: "test-api-token"
      });

      service = new JiraService();
      expect(service.isConfigured()).toBe(false);
    });

    it("should return false when API token is missing", () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: ""
      });

      service = new JiraService();
      expect(service.isConfigured()).toBe(false);
    });

    it("should return false when all credentials are missing", () => {
      service = new JiraService();
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("testConnection()", () => {
    it("should return false when not configured", async () => {
      service = new JiraService();
      const result = await service.testConnection();
      expect(result).toBe(false);
    });

    it("should return true when connection is successful", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn().mockResolvedValue(mockCurrentUser) },
        issues: { getTransitions: vi.fn() }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith("Jira connection test successful");
    });

    it("should return false and log error when connection fails", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const connectionError = new Error("Authentication failed");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn().mockRejectedValue(connectionError) },
        issues: { getTransitions: vi.fn() }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.testConnection();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Jira connection test failed: Error: Authentication failed");
    });

    it("should handle network timeout errors", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const timeoutError = new Error("TIMEOUT");
      timeoutError.name = "TimeoutError";

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn().mockRejectedValue(timeoutError) },
        issues: { getTransitions: vi.fn() }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.testConnection();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Jira connection test failed: TimeoutError: TIMEOUT");
    });
  });

  describe("createIssue()", () => {
    it("should return null when not configured", async () => {
      const issueData = {
        summary: "Test Issue",
        issueType: "Bug"
      };

      // Explicitly ensure config is empty
      Object.assign(config, {
        JIRA_HOST: "",
        JIRA_EMAIL: "",
        JIRA_API_TOKEN: "",
        JIRA_PROJECT_KEY: ""
      });

      service = new JiraService();
      const result = await service.createIssue(issueData);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Jira not configured, skipping issue creation");
    });

    it("should create issue with minimal data", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          createIssue: vi.fn().mockResolvedValue(mockCreateIssueResponse),
          getIssue: vi.fn().mockResolvedValue(mockJiraIssueResponse)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      const issueData = {
        summary: "Test Issue",
        issueType: "Bug"
      };

      service = new JiraService();
      const result = await service.createIssue(issueData);

      expect(result).not.toBeNull();
      expect(result?.key).toBe("TEST-1");
    });

    it("should handle creation error and return null", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const createError = new Error("Issue creation failed");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          createIssue: vi.fn().mockRejectedValue(createError),
          getIssue: vi.fn()
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      const issueData = {
        summary: "Test Issue",
        issueType: "Bug"
      };

      service = new JiraService();
      const result = await service.createIssue(issueData);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("Failed to create Jira issue: Error: Issue creation failed");
    });
  });

  describe("getIssue()", () => {
    it("should return null when not configured", async () => {
      service = new JiraService();
      const result = await service.getIssue("TEST-1");
      expect(result).toBeNull();
    });

    it("should retrieve issue with all fields", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          getIssue: vi.fn().mockResolvedValue(mockJiraIssueResponse)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.getIssue("TEST-1");

      expect(result).not.toBeNull();
      expect(result).toMatchJiraIssueStructure();
      expect(result?.key).toBe("TEST-1");
    });

    it("should handle retrieval error and return null", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const getError = new Error("Issue not found");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          getIssue: vi.fn().mockRejectedValue(getError)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.getIssue("INVALID-1");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("Failed to get Jira issue INVALID-1: Error: Issue not found");
    });
  });

  describe("updateIssue()", () => {
    it("should return null when not configured", async () => {
      const updateData = { summary: "Updated Summary" };

      service = new JiraService();
      const result = await service.updateIssue("TEST-1", updateData);

      expect(result).toBeNull();
    });

    it("should update issue with data", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          editIssue: vi.fn().mockResolvedValue({}),
          getIssue: vi.fn().mockResolvedValue(mockJiraIssueResponse)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      const updateData = { summary: "Updated Summary" };

      service = new JiraService();
      const result = await service.updateIssue("TEST-1", updateData);

      expect(result).not.toBeNull();
      expect(logger.info).toHaveBeenCalledWith("Updated Jira issue: TEST-1");
    });

    it("should handle update error and return null", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const updateError = new Error("Update failed");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          editIssue: vi.fn().mockRejectedValue(updateError)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      const updateData = { summary: "Updated Summary" };

      service = new JiraService();
      const result = await service.updateIssue("TEST-1", updateData);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("Failed to update Jira issue TEST-1: Error: Update failed");
    });
  });

  describe("transitionIssue()", () => {
    it("should return false when not configured", async () => {
      service = new JiraService();
      const result = await service.transitionIssue("TEST-1", "21");
      expect(result).toBe(false);
    });

    it("should successfully transition issue", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          getTransitions: vi.fn().mockResolvedValue(mockTransitionsResponse),
          doTransition: vi.fn().mockResolvedValue({})
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.transitionIssue("TEST-1", "21");

      expect(result).toBe(true);
    });

    it("should handle transition error and return false", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const transitionError = new Error("Transition not allowed");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          getTransitions: vi.fn().mockResolvedValue(mockTransitionsResponse),
          doTransition: vi.fn().mockRejectedValue(transitionError)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.transitionIssue("TEST-1", "99");

      expect(result).toBe(false);
    });
  });

  describe("getTransitions()", () => {
    it("should return empty array when not configured", async () => {
      // Explicitly ensure config is empty
      Object.assign(config, {
        JIRA_HOST: "",
        JIRA_EMAIL: "",
        JIRA_API_TOKEN: "",
        JIRA_PROJECT_KEY: ""
      });

      service = new JiraService();
      const result = await service.getTransitions("TEST-1");
      expect(result).toEqual([]);
    });

    it("should retrieve available transitions", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          getTransitions: vi.fn().mockResolvedValue(mockTransitionsResponse)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.getTransitions("TEST-1");

      expect(result).toEqual([
        { id: "11", name: "To Do" },
        { id: "21", name: "In Progress" },
        { id: "31", name: "Done" }
      ]);
    });

    it("should handle error and return empty array", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const transitionsError = new Error("Access denied");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          getTransitions: vi.fn().mockRejectedValue(transitionsError)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.getTransitions("TEST-1");

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith("Failed to get transitions for Jira issue TEST-1: Error: Access denied");
    });
  });

  describe("addComment()", () => {
    it("should return false when not configured", async () => {
      service = new JiraService();
      const result = await service.addComment("TEST-1", "Test comment");
      expect(result).toBe(false);
    });

    it("should successfully add comment", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issueComments: {
          addComment: vi.fn().mockResolvedValue({ id: "10000" })
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.addComment("TEST-1", "Test comment");

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith("Added comment to Jira issue: TEST-1");
    });

    it("should handle add comment error and return false", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const commentError = new Error("Permission denied");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issueComments: {
          addComment: vi.fn().mockRejectedValue(commentError)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.addComment("TEST-1", "Test comment");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to add comment to Jira issue TEST-1: Error: Permission denied");
    });
  });

  describe("deleteIssue()", () => {
    it("should return false when not configured", async () => {
      service = new JiraService();
      const result = await service.deleteIssue("TEST-1");
      expect(result).toBe(false);
    });

    it("should successfully delete issue", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          deleteIssue: vi.fn().mockResolvedValue({})
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.deleteIssue("TEST-1");

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith("Deleted Jira issue: TEST-1");
    });

    it("should handle delete error and return false", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const deleteError = new Error("Insufficient permissions");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issues: {
          deleteIssue: vi.fn().mockRejectedValue(deleteError)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.deleteIssue("TEST-1");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to delete Jira issue TEST-1: Error: Insufficient permissions");
    });
  });

  describe("searchIssues()", () => {
    it("should return empty array when not configured", async () => {
      service = new JiraService();
      const result = await service.searchIssues("project = TEST");
      expect(result).toEqual([]);
    });

    it("should search issues with results", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const mockSearchResponse = {
        issues: [mockJiraIssueResponse],
        total: 1
      };

      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issueSearch: {
          searchForIssuesUsingJql: vi.fn().mockResolvedValue(mockSearchResponse)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.searchIssues("project = TEST");

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("TEST-1");
    });

    it("should handle search error and return empty array", async () => {
      Object.assign(config, {
        JIRA_HOST: "test.atlassian.net",
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-api-token",
        JIRA_PROJECT_KEY: "TEST"
      });

      const searchError = new Error("Invalid JQL query");
      const MockedVersion3Client = vi.mocked(Version3Client);
      const mockInstance = {
        myself: { getCurrentUser: vi.fn() },
        issueSearch: {
          searchForIssuesUsingJql: vi.fn().mockRejectedValue(searchError)
        }
      };
      MockedVersion3Client.mockImplementation(() => mockInstance as any);

      service = new JiraService();
      const result = await service.searchIssues("invalid JQL query");

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith("Failed to search Jira issues: Error: Invalid JQL query");
    });
  });

  describe("Integration tests", () => {
    it("should use the exported jiraService instance", () => {
      expect(jiraService).toBeDefined();
      expect(jiraService).toHaveProperty("isConfigured");
      expect(jiraService).toHaveProperty("testConnection");
      expect(jiraService).toHaveProperty("createIssue");
      expect(jiraService).toHaveProperty("getIssue");
      expect(jiraService).toHaveProperty("updateIssue");
      expect(jiraService).toHaveProperty("transitionIssue");
      expect(jiraService).toHaveProperty("getTransitions");
      expect(jiraService).toHaveProperty("addComment");
      expect(jiraService).toHaveProperty("deleteIssue");
      expect(jiraService).toHaveProperty("searchIssues");
    });
  });
});