/**
 * GitHub (Octokit) Mock Implementation
 * 
 * Comprehensive mock for @octokit/rest and @octokit/graphql libraries
 * including repositories, issues, pull requests, and other GitHub API endpoints.
 */

import { vi } from "vitest";

// Mock GitHub API Response Types
export interface MockGitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: "open" | "closed";
  locked: boolean;
  node_id: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
    type: string;
  };
  assignees: Array<{
    id: number;
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    id: number;
    node_id: string;
    name: string;
    color: string;
    default: boolean;
    description: string;
  }>;
  milestone: {
    id: number;
    title: string;
    description: string;
    due_on: string | null;
    state: "open" | "closed";
  } | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
  reactions: {
    total_count: number;
    "+1": number;
    "-1": number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
}

export interface MockGitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  private: boolean;
  html_url: string;
  description: string;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  clone_url: string;
  ssh_url: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
  } | null;
  allow_forking: boolean;
  is_template: boolean;
  topics: string[];
  visibility: "public" | "private";
  default_branch: string;
}

// Mock data generators
export const createMockIssue = (overrides: Partial<MockGitHubIssue> = {}): MockGitHubIssue => ({
  id: 123456,
  number: 1,
  title: "Test Issue",
  body: "This is a test issue description",
  html_url: "https://github.com/test/repo/issues/1",
  state: "open",
  locked: false,
  node_id: "I_test_node_id",
  user: {
    id: 12345,
    login: "testuser",
    avatar_url: "https://avatars.githubusercontent.com/u/12345",
    type: "User",
  },
  assignees: [],
  labels: [
    {
      id: 1,
      node_id: "L_test_label_id",
      name: "bug",
      color: "d73a49",
      default: true,
      description: "Something isn't working",
    },
  ],
  milestone: null,
  comments: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  closed_at: null,
  author_association: "OWNER",
  reactions: {
    total_count: 0,
    "+1": 0,
    "-1": 0,
    laugh: 0,
    hooray: 0,
    confused: 0,
    heart: 0,
    rocket: 0,
    eyes: 0,
  },
  ...overrides,
});

export const createMockRepository = (overrides: Partial<MockGitHubRepository> = {}): MockGitHubRepository => ({
  id: 123456789,
  name: "test-repo",
  full_name: "testuser/test-repo",
  owner: {
    login: "testuser",
    id: 12345,
    avatar_url: "https://avatars.githubusercontent.com/u/12345",
    type: "User",
  },
  private: false,
  html_url: "https://github.com/testuser/test-repo",
  description: "A test repository",
  fork: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  pushed_at: new Date().toISOString(),
  clone_url: "https://github.com/testuser/test-repo.git",
  ssh_url: "git@github.com:testuser/test-repo.git",
  size: 100,
  stargazers_count: 5,
  watchers_count: 5,
  language: "TypeScript",
  forks_count: 2,
  archived: false,
  disabled: false,
  open_issues_count: 1,
  license: {
    key: "mit",
    name: "MIT License",
    spdx_id: "MIT",
  },
  allow_forking: true,
  is_template: false,
  topics: ["discord-bot", "typescript"],
  visibility: "public",
  default_branch: "main",
  ...overrides,
});

// Mock Octokit REST API
export class MockOctokit {
  public repos: any;
  public issues: any;
  public pulls: any;
  public git: any;
  public users: any;
  public search: any;
  public actions: any;
  public checks: any;
  public projects: any;
  public orgs: any;
  public teams: any;
  public apps: any;
  public oauth: any;
  public request: any;
  public graphql: any;
  public rest: any;

  constructor(options: { auth?: string } = {}) {
    // Mock authentication
    this.auth = options.auth || "test_token";

    // Repositories API
    this.repos = {
      get: vi.fn().mockResolvedValue({
        data: createMockRepository(),
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo",
      }),
      
      listForUser: vi.fn().mockResolvedValue({
        data: [createMockRepository()],
        status: 200,
        headers: {},
        url: "https://api.github.com/users/testuser/repos",
      }),

      listForOrg: vi.fn().mockResolvedValue({
        data: [createMockRepository()],
        status: 200,
        headers: {},
        url: "https://api.github.com/orgs/testorg/repos",
      }),

      create: vi.fn().mockResolvedValue({
        data: createMockRepository(),
        status: 201,
        headers: {},
        url: "https://api.github.com/user/repos",
      }),

      update: vi.fn().mockResolvedValue({
        data: createMockRepository(),
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo",
      }),

      delete: vi.fn().mockResolvedValue({
        data: null,
        status: 204,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo",
      }),

      listLanguages: vi.fn().mockResolvedValue({
        data: { TypeScript: 50000, JavaScript: 30000, HTML: 10000 },
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/languages",
      }),

      listTopics: vi.fn().mockResolvedValue({
        data: { names: ["discord-bot", "typescript"] },
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/topics",
      }),
    };

    // Issues API
    this.issues = {
      get: vi.fn().mockResolvedValue({
        data: createMockIssue(),
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1",
      }),

      list: vi.fn().mockResolvedValue({
        data: [createMockIssue()],
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues",
      }),

      listForRepo: vi.fn().mockResolvedValue({
        data: [createMockIssue()],
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues",
      }),

      create: vi.fn().mockResolvedValue({
        data: createMockIssue(),
        status: 201,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues",
      }),

      update: vi.fn().mockResolvedValue({
        data: createMockIssue({ state: "closed" }),
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1",
      }),

      addAssignees: vi.fn().mockResolvedValue({
        data: createMockIssue({
          assignees: [{ id: 12345, login: "testuser", avatar_url: "https://avatars.githubusercontent.com/u/12345" }],
        }),
        status: 201,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/assignees",
      }),

      removeAssignees: vi.fn().mockResolvedValue({
        data: createMockIssue(),
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/assignees",
      }),

      addLabels: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            node_id: "L_test_label_id",
            name: "enhancement",
            color: "a2eeef",
            default: false,
            description: "New feature or request",
          },
        ],
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/labels",
      }),

      removeLabel: vi.fn().mockResolvedValue({
        data: [],
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/labels/bug",
      }),

      setLabels: vi.fn().mockResolvedValue({
        data: [
          {
            id: 2,
            node_id: "L_test_label_id_2",
            name: "enhancement",
            color: "a2eeef",
            default: false,
            description: "New feature or request",
          },
        ],
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/labels",
      }),

      lock: vi.fn().mockResolvedValue({
        data: null,
        status: 204,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/lock",
      }),

      unlock: vi.fn().mockResolvedValue({
        data: null,
        status: 204,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/lock",
      }),

      createComment: vi.fn().mockResolvedValue({
        data: {
          id: 987654,
          body: "Test comment",
          user: {
            id: 12345,
            login: "testuser",
            avatar_url: "https://avatars.githubusercontent.com/u/12345",
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: "https://github.com/testuser/test-repo/issues/1#issuecomment-987654",
        },
        status: 201,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/comments",
      }),

      listComments: vi.fn().mockResolvedValue({
        data: [
          {
            id: 987654,
            body: "Test comment",
            user: {
              id: 12345,
              login: "testuser",
              avatar_url: "https://avatars.githubusercontent.com/u/12345",
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            html_url: "https://github.com/testuser/test-repo/issues/1#issuecomment-987654",
          },
        ],
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/issues/1/comments",
      }),
    };

    // Pull Requests API
    this.pulls = {
      get: vi.fn().mockResolvedValue({
        data: {
          ...createMockIssue(),
          head: {
            ref: "feature-branch",
            sha: "abc123",
            repo: createMockRepository(),
          },
          base: {
            ref: "main",
            sha: "def456",
            repo: createMockRepository(),
          },
          merged: false,
          mergeable: true,
          draft: false,
        },
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/pulls/1",
      }),

      list: vi.fn().mockResolvedValue({
        data: [],
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/pulls",
      }),

      create: vi.fn().mockResolvedValue({
        data: {
          ...createMockIssue(),
          head: { ref: "feature-branch", sha: "abc123" },
          base: { ref: "main", sha: "def456" },
        },
        status: 201,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/pulls",
      }),

      merge: vi.fn().mockResolvedValue({
        data: {
          sha: "ghi789",
          merged: true,
          message: "Pull request successfully merged",
        },
        status: 200,
        headers: {},
        url: "https://api.github.com/repos/testuser/test-repo/pulls/1/merge",
      }),
    };

    // Users API
    this.users = {
      getByUsername: vi.fn().mockResolvedValue({
        data: {
          id: 12345,
          login: "testuser",
          avatar_url: "https://avatars.githubusercontent.com/u/12345",
          type: "User",
          name: "Test User",
          email: "test@example.com",
          bio: "Test user bio",
          location: "Test Location",
          hireable: null,
          blog: "",
          twitter_username: null,
          company: null,
          public_repos: 10,
          public_gists: 5,
          followers: 100,
          following: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: 200,
        headers: {},
        url: "https://api.github.com/users/testuser",
      }),

      getAuthenticated: vi.fn().mockResolvedValue({
        data: {
          id: 12345,
          login: "testuser",
          avatar_url: "https://avatars.githubusercontent.com/u/12345",
          type: "User",
          name: "Test User",
          email: "test@example.com",
        },
        status: 200,
        headers: {},
        url: "https://api.github.com/user",
      }),
    };

    // Search API
    this.search = {
      issuesAndPullRequests: vi.fn().mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [createMockIssue()],
        },
        status: 200,
        headers: {},
        url: "https://api.github.com/search/issues",
      }),

      repos: vi.fn().mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [createMockRepository()],
        },
        status: 200,
        headers: {},
        url: "https://api.github.com/search/repositories",
      }),

      users: vi.fn().mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              id: 12345,
              login: "testuser",
              avatar_url: "https://avatars.githubusercontent.com/u/12345",
              type: "User",
            },
          ],
        },
        status: 200,
        headers: {},
        url: "https://api.github.com/search/users",
      }),
    };

    // Request method for direct API calls
    this.request = vi.fn().mockImplementation((route: string, parameters?: any) => {
      return Promise.resolve({
        data: {},
        status: 200,
        headers: {},
        url: route,
      });
    });

    // GraphQL support
    this.graphql = vi.fn().mockImplementation((query: string, variables?: any) => {
      return Promise.resolve({
        repository: {
          issues: {
            nodes: [createMockIssue()],
            totalCount: 1,
          },
        },
      });
    });

    // REST property for compatibility
    this.rest = this;
  }

  auth: string;
}

// Mock GraphQL function with defaults support
export const graphql = Object.assign(
  vi.fn().mockImplementation((query: string, variables?: any) => {
    return Promise.resolve({
      repository: {
        issues: {
          nodes: [createMockIssue()],
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: "start",
            endCursor: "end",
          },
        },
        issue: {
          id: 'test_node_id',
          number: 1,
          title: 'Test Issue',
          body: 'Test issue body',
          url: 'https://github.com/test-owner/test-repo/issues/1',
          state: 'OPEN',
          locked: false,
          assignees: { nodes: [] },
          labels: { nodes: [] },
          milestone: null,
          comments: { totalCount: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          closedAt: null,
        },
        pullRequests: {
          nodes: [],
          totalCount: 0,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: "start",
            endCursor: "end",
          },
        },
      },
    });
  }),
  {
    // Support .defaults() method - this returns a vitest mock function
    defaults: Object.assign(
      vi.fn().mockImplementation((options: any) => {
        const defaultedGraphql = Object.assign(
          vi.fn().mockImplementation((query: string, variables?: any) => {
            return Promise.resolve({
              repository: {
                issues: {
                  nodes: [createMockIssue()],
                  totalCount: 1,
                  pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                    startCursor: "start",
                    endCursor: "end",
                  },
                },
                pullRequests: {
                  nodes: [],
                  totalCount: 0,
                  pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                    startCursor: "start",
                    endCursor: "end",
                  },
                },
              },
            });
          }),
          {
            defaults: vi.fn().mockReturnThis(),
          }
        );
        return defaultedGraphql;
      }),
      {
        // Add vitest mock methods to defaults itself
        mockReturnValue: vi.fn().mockImplementation(function(this: any, returnValue: any) {
          this.mockImplementation(() => returnValue);
          return this;
        }),
        mockImplementation: vi.fn().mockReturnThis(),
        mockResolvedValue: vi.fn().mockReturnThis(),
        mockRejectedValue: vi.fn().mockReturnThis(),
        mockClear: vi.fn().mockReturnThis(),
        mockReset: vi.fn().mockReturnThis(),
        mockRestore: vi.fn().mockReturnThis(),
      }
    ),
  }
);

// GitHub webhook payload creators
export const createGitHubWebhookPayload = (action: string, overrides: any = {}) => {
  const basePayload = {
    action,
    issue: createMockIssue(),
    repository: createMockRepository(),
    sender: {
      login: "testuser",
      id: 12345,
      type: "User",
      site_admin: false,
    },
    ...overrides,
  };

  return basePayload;
};

// Export all mocks
export { MockOctokit as Octokit };
export { MockOctokit as RestEndpointMethodTypes };

// Default export
export default {
  MockOctokit,
  Octokit: MockOctokit,
  graphql,
  createMockIssue,
  createMockRepository,
  createGitHubWebhookPayload,
};