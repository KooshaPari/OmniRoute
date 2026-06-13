/**
 * Jira API Mock Implementation
 * 
 * Comprehensive mock for jira.js library including issues, projects,
 * users, boards, sprints, and other Jira API endpoints.
 */

import { vi } from "vitest";

// Mock Jira API Response Types
export interface MockJiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      id: string;
      name: string;
      statusCategory: {
        id: number;
        key: string;
        colorName: string;
        name: string;
      };
    };
    priority: {
      id: string;
      name: string;
      iconUrl: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress: string;
      avatarUrls: {
        "16x16": string;
        "24x24": string;
        "32x32": string;
        "48x48": string;
      };
    };
    reporter: {
      accountId: string;
      displayName: string;
      emailAddress: string;
      avatarUrls: {
        "16x16": string;
        "24x24": string;
        "32x32": string;
        "48x48": string;
      };
    };
    created: string;
    updated: string;
    labels: string[];
    components: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
    issueType: {
      id: string;
      name: string;
      iconUrl: string;
      subtask: boolean;
    };
    project: {
      id: string;
      key: string;
      name: string;
      avatarUrls: {
        "16x16": string;
        "24x24": string;
        "32x32": string;
        "48x48": string;
      };
    };
    resolution?: {
      id: string;
      name: string;
      description: string;
    };
    resolutiondate?: string;
    environment?: string;
    versions: Array<{
      id: string;
      name: string;
      archived: boolean;
      released: boolean;
    }>;
    fixVersions: Array<{
      id: string;
      name: string;
      archived: boolean;
      released: boolean;
    }>;
    duedate?: string;
    comment?: {
      comments: Array<{
        id: string;
        body: string;
        author: {
          accountId: string;
          displayName: string;
          emailAddress: string;
        };
        created: string;
        updated: string;
      }>;
      total: number;
    };
  };
}

export interface MockJiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead: {
    accountId: string;
    displayName: string;
    emailAddress: string;
  };
  projectCategory?: {
    id: string;
    name: string;
    description: string;
  };
  avatarUrls: {
    "16x16": string;
    "24x24": string;
    "32x32": string;
    "48x48": string;
  };
  issueTypes: Array<{
    id: string;
    name: string;
    iconUrl: string;
    subtask: boolean;
  }>;
  versions: Array<{
    id: string;
    name: string;
    archived: boolean;
    released: boolean;
  }>;
  components: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  projectTypeKey: string;
  simplified: boolean;
  style: string;
  isPrivate: boolean;
}

// Mock data generators
export const createMockJiraIssue = (overrides: Partial<MockJiraIssue> = {}): MockJiraIssue => {
  const baseIssue = {
    id: "10001",
    key: "TEST-1",
    self: "https://test.atlassian.net/rest/api/3/issue/10001",
    fields: {
      summary: "Test Jira Issue",
      description: "This is a test Jira issue description",
      status: {
        id: "1",
        name: "To Do",
        statusCategory: {
          id: 2,
          key: "new",
          colorName: "blue-gray",
          name: "To Do",
        },
      },
      priority: {
        id: "3",
        name: "Medium",
        iconUrl: "https://test.atlassian.net/images/icons/priorities/medium.svg",
      },
      assignee: null,
      reporter: {
        accountId: "test-account-id",
        displayName: "Test User",
        emailAddress: "test@example.com",
        avatarUrls: {
          "16x16": "https://test.atlassian.net/secure/useravatar?size=xsmall&avatarId=10338",
          "24x24": "https://test.atlassian.net/secure/useravatar?size=small&avatarId=10338",
          "32x32": "https://test.atlassian.net/secure/useravatar?size=medium&avatarId=10338",
          "48x48": "https://test.atlassian.net/secure/useravatar?avatarId=10338",
        },
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      labels: [],
      components: [],
      issueType: {
        id: "10001",
        name: "Bug",
        iconUrl: "https://test.atlassian.net/images/icons/issuetypes/bug.png",
        subtask: false,
      },
      project: {
        id: "10000",
        key: "TEST",
        name: "Test Project",
        avatarUrls: {
          "16x16": "https://test.atlassian.net/secure/projectavatar?size=xsmall&pid=10000",
          "24x24": "https://test.atlassian.net/secure/projectavatar?size=small&pid=10000",
          "32x32": "https://test.atlassian.net/secure/projectavatar?size=medium&pid=10000",
          "48x48": "https://test.atlassian.net/secure/projectavatar?pid=10000",
        },
      },
      versions: [],
      fixVersions: [],
    },
  };

  // Deep merge overrides, especially for nested fields
  const result = { ...baseIssue, ...overrides };
  if (overrides.fields) {
    result.fields = { ...baseIssue.fields, ...overrides.fields };
  }
  
  return result;
};

export const createMockJiraProject = (overrides: Partial<MockJiraProject> = {}): MockJiraProject => ({
  id: "10000",
  key: "TEST",
  name: "Test Project",
  description: "A test project for development",
  lead: {
    accountId: "test-account-id",
    displayName: "Test User",
    emailAddress: "test@example.com",
  },
  projectCategory: {
    id: "10001",
    name: "Development",
    description: "Development projects",
  },
  avatarUrls: {
    "16x16": "https://test.atlassian.net/secure/projectavatar?size=xsmall&pid=10000",
    "24x24": "https://test.atlassian.net/secure/projectavatar?size=small&pid=10000",
    "32x32": "https://test.atlassian.net/secure/projectavatar?size=medium&pid=10000",
    "48x48": "https://test.atlassian.net/secure/projectavatar?pid=10000",
  },
  issueTypes: [
    {
      id: "10001",
      name: "Bug",
      iconUrl: "https://test.atlassian.net/images/icons/issuetypes/bug.png",
      subtask: false,
    },
    {
      id: "10002",
      name: "Task",
      iconUrl: "https://test.atlassian.net/images/icons/issuetypes/task.png",
      subtask: false,
    },
    {
      id: "10003",
      name: "Story",
      iconUrl: "https://test.atlassian.net/images/icons/issuetypes/story.png",
      subtask: false,
    },
  ],
  versions: [],
  components: [],
  projectTypeKey: "software",
  simplified: false,
  style: "next-gen",
  isPrivate: false,
  ...overrides,
});

// Mock Jira Version3Client
export class MockVersion3Client {
  public issues: any;
  public projects: any;
  public users: any;
  public issueTypes: any;
  public priorities: any;
  public statuses: any;
  public transitions: any;
  public comments: any;
  public attachments: any;
  public workflows: any;
  public boards: any;
  public sprints: any;
  public search: any;
  public fields: any;
  public myself: any;

  constructor(config: {
    host: string;
    authentication: {
      basic: {
        email: string;
        apiToken: string;
      };
    };
  }) {
    this.host = config.host;
    this.authentication = config.authentication;

    // Issues API
    this.issues = {
      getIssue: vi.fn().mockResolvedValue(createMockJiraIssue()),
      
      createIssue: vi.fn().mockResolvedValue({
        id: "10001",
        key: "TEST-1",
        self: "https://test.atlassian.net/rest/api/3/issue/10001",
      }),
      
      updateIssue: vi.fn().mockResolvedValue(undefined),
      
      deleteIssue: vi.fn().mockResolvedValue(undefined),
      
      assignIssue: vi.fn().mockResolvedValue(undefined),
      
      getTransitions: vi.fn().mockResolvedValue({
        transitions: [
          {
            id: "11",
            name: "To Do",
            to: {
              id: "1",
              name: "To Do",
              statusCategory: { key: "new", name: "To Do" },
            },
          },
          {
            id: "21",
            name: "In Progress",
            to: {
              id: "2",
              name: "In Progress",
              statusCategory: { key: "indeterminate", name: "In Progress" },
            },
          },
          {
            id: "31",
            name: "Done",
            to: {
              id: "3",
              name: "Done",
              statusCategory: { key: "done", name: "Done" },
            },
          },
        ],
      }),
      
      doTransition: vi.fn().mockResolvedValue(undefined),
      
      editIssue: vi.fn().mockResolvedValue(undefined),
      
      addWatcher: vi.fn().mockResolvedValue(undefined),
      
      removeWatcher: vi.fn().mockResolvedValue(undefined),
      
      getWatchers: vi.fn().mockResolvedValue({
        watchers: [
          {
            accountId: "test-account-id",
            displayName: "Test User",
            emailAddress: "test@example.com",
          },
        ],
      }),
      
      getVotes: vi.fn().mockResolvedValue({
        votes: 0,
        hasVoted: false,
        voters: [],
      }),
      
      addVote: vi.fn().mockResolvedValue(undefined),
      
      removeVote: vi.fn().mockResolvedValue(undefined),
    };

    // Projects API
    this.projects = {
      getAllProjects: vi.fn().mockResolvedValue([createMockJiraProject()]),
      
      getProject: vi.fn().mockResolvedValue(createMockJiraProject()),
      
      createProject: vi.fn().mockResolvedValue({
        id: "10000",
        key: "TEST",
        self: "https://test.atlassian.net/rest/api/3/project/10000",
      }),
      
      updateProject: vi.fn().mockResolvedValue(createMockJiraProject()),
      
      deleteProject: vi.fn().mockResolvedValue(undefined),
      
      getProjectComponents: vi.fn().mockResolvedValue([
        {
          id: "10001",
          name: "Backend",
          description: "Backend components",
          lead: {
            accountId: "test-account-id",
            displayName: "Test User",
          },
        },
      ]),
      
      getProjectVersions: vi.fn().mockResolvedValue([
        {
          id: "10001",
          name: "1.0.0",
          archived: false,
          released: false,
          description: "First version",
        },
      ]),
    };

    // Users API
    this.users = {
      getUser: vi.fn().mockResolvedValue({
        accountId: "test-account-id",
        displayName: "Test User",
        emailAddress: "test@example.com",
        avatarUrls: {
          "16x16": "https://test.atlassian.net/secure/useravatar?size=xsmall&avatarId=10338",
          "24x24": "https://test.atlassian.net/secure/useravatar?size=small&avatarId=10338",
          "32x32": "https://test.atlassian.net/secure/useravatar?size=medium&avatarId=10338",
          "48x48": "https://test.atlassian.net/secure/useravatar?avatarId=10338",
        },
        active: true,
        timeZone: "UTC",
        locale: "en_US",
      }),
      
      findUsers: vi.fn().mockResolvedValue([
        {
          accountId: "test-account-id",
          displayName: "Test User",
          emailAddress: "test@example.com",
          active: true,
        },
      ]),
      
      findAssignableUsers: vi.fn().mockResolvedValue([
        {
          accountId: "test-account-id",
          displayName: "Test User",
          emailAddress: "test@example.com",
          active: true,
        },
      ]),
    };

    // Issue Types API
    this.issueTypes = {
      getAllIssueTypes: vi.fn().mockResolvedValue([
        {
          id: "10001",
          name: "Bug",
          iconUrl: "https://test.atlassian.net/images/icons/issuetypes/bug.png",
          subtask: false,
          description: "A problem which impairs or prevents the functions of the product.",
        },
        {
          id: "10002",
          name: "Task",
          iconUrl: "https://test.atlassian.net/images/icons/issuetypes/task.png",
          subtask: false,
          description: "A task that needs to be done.",
        },
        {
          id: "10003",
          name: "Story",
          iconUrl: "https://test.atlassian.net/images/icons/issuetypes/story.png",
          subtask: false,
          description: "A user story.",
        },
      ]),
      
      getIssueType: vi.fn().mockResolvedValue({
        id: "10001",
        name: "Bug",
        iconUrl: "https://test.atlassian.net/images/icons/issuetypes/bug.png",
        subtask: false,
        description: "A problem which impairs or prevents the functions of the product.",
      }),
    };

    // Priorities API
    this.priorities = {
      getPriorities: vi.fn().mockResolvedValue([
        {
          id: "1",
          name: "Highest",
          iconUrl: "https://test.atlassian.net/images/icons/priorities/highest.svg",
        },
        {
          id: "2",
          name: "High",
          iconUrl: "https://test.atlassian.net/images/icons/priorities/high.svg",
        },
        {
          id: "3",
          name: "Medium",
          iconUrl: "https://test.atlassian.net/images/icons/priorities/medium.svg",
        },
        {
          id: "4",
          name: "Low",
          iconUrl: "https://test.atlassian.net/images/icons/priorities/low.svg",
        },
        {
          id: "5",
          name: "Lowest",
          iconUrl: "https://test.atlassian.net/images/icons/priorities/lowest.svg",
        },
      ]),
      
      getPriority: vi.fn().mockResolvedValue({
        id: "3",
        name: "Medium",
        iconUrl: "https://test.atlassian.net/images/icons/priorities/medium.svg",
        description: "Medium priority",
      }),
    };

    // Statuses API
    this.statuses = {
      getAllStatuses: vi.fn().mockResolvedValue([
        {
          id: "1",
          name: "To Do",
          statusCategory: {
            id: 2,
            key: "new",
            colorName: "blue-gray",
            name: "To Do",
          },
        },
        {
          id: "2",
          name: "In Progress",
          statusCategory: {
            id: 4,
            key: "indeterminate",
            colorName: "yellow",
            name: "In Progress",
          },
        },
        {
          id: "3",
          name: "Done",
          statusCategory: {
            id: 3,
            key: "done",
            colorName: "green",
            name: "Done",
          },
        },
      ]),
      
      getStatus: vi.fn().mockResolvedValue({
        id: "1",
        name: "To Do",
        description: "The issue is open and ready for the assignee to start work on it.",
        statusCategory: {
          id: 2,
          key: "new",
          colorName: "blue-gray",
          name: "To Do",
        },
      }),
    };

    // Comments API
    this.comments = {
      getComments: vi.fn().mockResolvedValue({
        comments: [
          {
            id: "10001",
            body: "Test comment",
            author: {
              accountId: "test-account-id",
              displayName: "Test User",
              emailAddress: "test@example.com",
            },
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        ],
        total: 1,
      }),
      
      addComment: vi.fn().mockResolvedValue({
        id: "10001",
        body: "Test comment",
        author: {
          accountId: "test-account-id",
          displayName: "Test User",
          emailAddress: "test@example.com",
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }),
      
      updateComment: vi.fn().mockResolvedValue({
        id: "10001",
        body: "Updated comment",
        author: {
          accountId: "test-account-id",
          displayName: "Test User",
          emailAddress: "test@example.com",
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }),
      
      deleteComment: vi.fn().mockResolvedValue(undefined),
    };

    // Search API
    this.search = {
      searchForIssuesUsingJql: vi.fn().mockResolvedValue({
        issues: [createMockJiraIssue()],
        total: 1,
        startAt: 0,
        maxResults: 50,
      }),
      
      searchForIssuesUsingJqlGet: vi.fn().mockResolvedValue({
        issues: [createMockJiraIssue()],
        total: 1,
        startAt: 0,
        maxResults: 50,
      }),
    };

    // Myself API
    this.myself = {
      getCurrentUser: vi.fn().mockResolvedValue({
        accountId: "test-account-id",
        displayName: "Test User",
        emailAddress: "test@example.com",
        avatarUrls: {
          "16x16": "https://test.atlassian.net/secure/useravatar?size=xsmall&avatarId=10338",
          "24x24": "https://test.atlassian.net/secure/useravatar?size=small&avatarId=10338",
          "32x32": "https://test.atlassian.net/secure/useravatar?size=medium&avatarId=10338",
          "48x48": "https://test.atlassian.net/secure/useravatar?avatarId=10338",
        },
        active: true,
        timeZone: "UTC",
        locale: "en_US",
      }),
    };

    // Fields API
    this.fields = {
      getFields: vi.fn().mockResolvedValue([
        {
          id: "summary",
          name: "Summary",
          custom: false,
          orderable: true,
          navigable: true,
          searchable: true,
          schema: {
            type: "string",
            system: "summary",
          },
        },
        {
          id: "description",
          name: "Description",
          custom: false,
          orderable: true,
          navigable: true,
          searchable: true,
          schema: {
            type: "string",
            system: "description",
          },
        },
      ]),
      
      createCustomField: vi.fn().mockResolvedValue({
        id: "customfield_10001",
        name: "Custom Field",
        custom: true,
        schema: {
          type: "string",
          custom: "com.atlassian.jira.plugin.system.customfieldtypes:textfield",
          customId: 10001,
        },
      }),
    };
  }

  host: string;
  authentication: any;
}

// Jira webhook payload creators
export const createJiraWebhookPayload = (eventType: string, overrides: any = {}) => {
  const basePayload = {
    timestamp: Date.now(),
    webhookEvent: eventType,
    user: {
      accountId: "test-account-id",
      displayName: "Test User",
      emailAddress: "test@example.com",
    },
    issue: createMockJiraIssue(),
    changelog: {
      id: "10001",
      items: [
        {
          field: "status",
          fieldtype: "jira",
          fieldId: "status",
          from: "1",
          fromString: "To Do",
          to: "2",
          toString: "In Progress",
        },
      ],
    },
    ...overrides,
  };

  return basePayload;
};

// Export all mocks
export { MockVersion3Client as Version3Client };

// Default export
export default {
  MockVersion3Client,
  Version3Client: MockVersion3Client,
  createMockJiraIssue,
  createMockJiraProject,
  createJiraWebhookPayload,
};