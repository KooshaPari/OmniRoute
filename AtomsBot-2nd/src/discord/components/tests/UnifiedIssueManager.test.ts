import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  User,
  GuildMember,
  TextChannel,
  ForumChannel,
  ThreadChannel,
  Guild,
  ChannelType,
  Message,
  MessageCreateOptions,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";

// Mock dependencies first
vi.mock("../../../github/githubService");
vi.mock("../../../jira/jiraService");
vi.mock("../../../cache/redis");
vi.mock("../../embeds");

// Import after mocking
import {
  UnifiedIssueManager,
  IssueData,
  IssueType,
  IssuePriority,
  IssueStatus,
} from "../UnifiedIssueManager";
import { githubService } from "../../../github/githubService";
import { jiraService } from "../../../jira/jiraService";
import { cacheService } from "../../../cache/redis";
import { createIssueEmbed, createSuccessEmbed, createErrorEmbed } from "../../embeds";

describe("UnifiedIssueManager", () => {
  let manager: UnifiedIssueManager;
  let mockGuild: Partial<Guild>;
  let mockChannel: Partial<ForumChannel>;
  let mockTextChannel: Partial<TextChannel>;
  let mockThreadChannel: Partial<ThreadChannel>;
  let mockUser: Partial<User>;
  let mockMember: Partial<GuildMember>;
  let mockMessage: Partial<Message>;

  const mockIssueData: IssueData = {
    title: "Test Issue",
    description: "This is a test issue description",
    category: "bug",
    priority: "medium" as IssuePriority,
    type: "bug" as IssueType,
    forum: "test-forum",
    submitter: {
      id: "user123",
      username: "testuser",
      displayName: "Test User",
    },
    assignees: [],
    labels: ["bug", "test"],
    metadata: {
      source: "discord",
      channelId: "channel123",
      threadId: "thread456",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Discord objects
    mockUser = {
      id: "user123",
      username: "testuser",
      displayName: "Test User",
      discriminator: "0001",
      tag: "testuser#0001",
    };

    mockMember = {
      id: "user123",
      user: mockUser as User,
      displayName: "Test User",
      nickname: "Test User",
    };

    mockMessage = {
      id: "message123",
      content: "Test message",
      author: mockUser as User,
      channel: mockTextChannel as TextChannel,
      edit: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({}),
    };

    mockThreadChannel = {
      id: "thread456",
      name: "Test Thread",
      type: ChannelType.PublicThread,
      send: vi.fn().mockResolvedValue(mockMessage),
      setName: vi.fn().mockResolvedValue({}),
      setArchived: vi.fn().mockResolvedValue({}),
      setLocked: vi.fn().mockResolvedValue({}),
    };

    mockTextChannel = {
      id: "channel123",
      name: "test-channel",
      type: ChannelType.GuildText,
      send: vi.fn().mockResolvedValue(mockMessage),
      threads: {
        create: vi.fn().mockResolvedValue(mockThreadChannel),
      } as any,
    };

    mockChannel = {
      id: "forum123",
      name: "test-forum",
      type: ChannelType.GuildForum,
      threads: {
        create: vi.fn().mockResolvedValue(mockThreadChannel),
      } as any,
    };

    mockGuild = {
      id: "guild123",
      name: "Test Guild",
      channels: {
        cache: new Map([
          ["forum123", mockChannel],
          ["channel123", mockTextChannel],
        ]),
        fetch: vi.fn().mockImplementation((id: string) => {
          const channel = mockGuild.channels!.cache.get(id);
          return Promise.resolve(channel || null);
        }),
      } as any,
      members: {
        cache: new Map([["user123", mockMember]]),
        fetch: vi.fn().mockResolvedValue(mockMember),
      } as any,
    };

    // Mock service responses
    (githubService.createIssue as any) = vi.fn().mockResolvedValue({
      success: true,
      issue: {
        id: 123,
        number: 456,
        html_url: "https://github.com/test/repo/issues/456",
        title: "Test Issue",
        body: "This is a test issue description",
        state: "open",
        labels: [],
        assignees: [],
      },
    });

    (jiraService.createIssue as any) = vi.fn().mockResolvedValue({
      success: true,
      issue: {
        id: "PROJ-123",
        key: "PROJ-123",
        self: "https://test.atlassian.net/rest/api/2/issue/PROJ-123",
        fields: {
          summary: "Test Issue",
          description: "This is a test issue description",
          status: { name: "To Do" },
          priority: { name: "Medium" },
          issuetype: { name: "Bug" },
        },
      },
    });

    (cacheService.set as any) = vi.fn().mockResolvedValue(true);
    (cacheService.get as any) = vi.fn().mockResolvedValue(null);
    (cacheService.exists as any) = vi.fn().mockResolvedValue(false);
    (cacheService.del as any) = vi.fn().mockResolvedValue(true);

    // Mock embed creators
    (createIssueEmbed as any) = vi.fn().mockReturnValue(new EmbedBuilder());
    (createSuccessEmbed as any) = vi.fn().mockReturnValue(new EmbedBuilder());
    (createErrorEmbed as any) = vi.fn().mockReturnValue(new EmbedBuilder());

    // Create manager instance
    manager = new UnifiedIssueManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with default configuration", () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(UnifiedIssueManager);
    });
  });

  describe("Issue Creation", () => {
    describe("createIssue", () => {
      it("should create issue successfully with GitHub and Jira", async () => {
        const result = await manager.createIssue(mockIssueData);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.github?.success).toBe(true);
        expect(result.jira?.success).toBe(true);
        expect(githubService.createIssue).toHaveBeenCalledWith(
          expect.objectContaining({
            title: mockIssueData.title,
            body: mockIssueData.description,
          })
        );
        expect(jiraService.createIssue).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: mockIssueData.title,
            description: mockIssueData.description,
          })
        );
      });

      it("should handle GitHub creation failure", async () => {
        (githubService.createIssue as any).mockResolvedValue({
          success: false,
          error: "GitHub API error",
        });

        const result = await manager.createIssue(mockIssueData);

        expect(result.success).toBe(false);
        expect(result.github?.success).toBe(false);
        expect(result.github?.error).toBe("GitHub API error");
        expect(result.jira?.success).toBe(true);
      });

      it("should handle Jira creation failure", async () => {
        (jiraService.createIssue as any).mockResolvedValue({
          success: false,
          error: "Jira API error",
        });

        const result = await manager.createIssue(mockIssueData);

        expect(result.success).toBe(false);
        expect(result.github?.success).toBe(true);
        expect(result.jira?.success).toBe(false);
        expect(result.jira?.error).toBe("Jira API error");
      });

      it("should handle both services failing", async () => {
        (githubService.createIssue as any).mockResolvedValue({
          success: false,
          error: "GitHub error",
        });
        (jiraService.createIssue as any).mockResolvedValue({
          success: false,
          error: "Jira error",
        });

        const result = await manager.createIssue(mockIssueData);

        expect(result.success).toBe(false);
        expect(result.github?.success).toBe(false);
        expect(result.jira?.success).toBe(false);
      });

      it("should cache created issue", async () => {
        const result = await manager.createIssue(mockIssueData);

        expect(cacheService.set).toHaveBeenCalledWith(
          expect.stringMatching(/^issue:/),
          expect.objectContaining({
            ...mockIssueData,
            id: expect.any(String),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            status: "open",
          }),
          expect.any(Number)
        );
      });

      it("should generate unique issue IDs", async () => {
        const result1 = await manager.createIssue(mockIssueData);
        const result2 = await manager.createIssue(mockIssueData);

        expect(result1.issue?.id).toBeDefined();
        expect(result2.issue?.id).toBeDefined();
        expect(result1.issue?.id).not.toBe(result2.issue?.id);
      });

      it("should set correct issue status and timestamps", async () => {
        const result = await manager.createIssue(mockIssueData);

        expect(result.issue?.status).toBe("open");
        expect(result.issue?.createdAt).toBeInstanceOf(Date);
        expect(result.issue?.updatedAt).toBeInstanceOf(Date);
      });

      it("should handle different issue types", async () => {
        const bugIssue: IssueData = { ...mockIssueData, type: "bug" };
        const featureIssue: IssueData = { ...mockIssueData, type: "feature" };
        const enhancementIssue: IssueData = { ...mockIssueData, type: "enhancement" };

        await manager.createIssue(bugIssue);
        await manager.createIssue(featureIssue);
        await manager.createIssue(enhancementIssue);

        expect(githubService.createIssue).toHaveBeenCalledTimes(3);
        expect(jiraService.createIssue).toHaveBeenCalledTimes(3);
      });

      it("should handle different priority levels", async () => {
        const priorities: IssuePriority[] = ["low", "medium", "high", "urgent"];

        for (const priority of priorities) {
          const issueData: IssueData = { ...mockIssueData, priority };
          await manager.createIssue(issueData);
        }

        expect(githubService.createIssue).toHaveBeenCalledTimes(priorities.length);
        expect(jiraService.createIssue).toHaveBeenCalledTimes(priorities.length);
      });

      it("should include assignees in issue creation", async () => {
        const issueWithAssignees: IssueData = {
          ...mockIssueData,
          assignees: ["user1", "user2"],
        };

        await manager.createIssue(issueWithAssignees);

        expect(githubService.createIssue).toHaveBeenCalledWith(
          expect.objectContaining({
            assignees: ["user1", "user2"],
          })
        );
        expect(jiraService.createIssue).toHaveBeenCalledWith(
          expect.objectContaining({
            assignee: "user1", // Jira typically uses single assignee
          })
        );
      });

      it("should include labels in issue creation", async () => {
        const issueWithLabels: IssueData = {
          ...mockIssueData,
          labels: ["bug", "high-priority", "ui"],
        };

        await manager.createIssue(issueWithLabels);

        expect(githubService.createIssue).toHaveBeenCalledWith(
          expect.objectContaining({
            labels: ["bug", "high-priority", "ui"],
          })
        );
      });
    });

    describe("createDiscordThread", () => {
      it("should create thread in forum channel", async () => {
        const result = await manager.createDiscordThread(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        expect(result.success).toBe(true);
        expect(result.thread).toBe(mockThreadChannel);
        expect(mockChannel.threads!.create).toHaveBeenCalledWith({
          name: mockIssueData.title,
          message: expect.objectContaining({
            embeds: expect.any(Array),
            components: expect.any(Array),
          }),
          appliedTags: expect.any(Array),
        });
      });

      it("should create thread in text channel", async () => {
        const result = await manager.createDiscordThread(
          mockGuild as Guild,
          mockTextChannel as TextChannel,
          mockIssueData
        );

        expect(result.success).toBe(true);
        expect(result.thread).toBe(mockThreadChannel);
        expect(mockTextChannel.threads!.create).toHaveBeenCalledWith({
          name: mockIssueData.title,
          type: ChannelType.PublicThread,
        });
      });

      it("should handle thread creation failure", async () => {
        (mockChannel.threads!.create as any).mockRejectedValue(
          new Error("Thread creation failed")
        );

        const result = await manager.createDiscordThread(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Thread creation failed");
      });

      it("should include issue embed in thread message", async () => {
        await manager.createDiscordThread(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        expect(createIssueEmbed).toHaveBeenCalledWith(
          expect.objectContaining({
            ...mockIssueData,
            id: expect.any(String),
          })
        );
      });

      it("should include action buttons in thread message", async () => {
        await manager.createDiscordThread(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        const createCall = (mockChannel.threads!.create as any).mock.calls[0][0];
        expect(createCall.message.components).toBeDefined();
        expect(createCall.message.components).toHaveLength(1);
      });

      it("should apply appropriate tags for forum threads", async () => {
        await manager.createDiscordThread(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        const createCall = (mockChannel.threads!.create as any).mock.calls[0][0];
        expect(createCall.appliedTags).toBeDefined();
        expect(Array.isArray(createCall.appliedTags)).toBe(true);
      });
    });

    describe("createFullIssueFlow", () => {
      it("should complete full issue creation flow", async () => {
        const result = await manager.createFullIssueFlow(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        expect(result.success).toBe(true);
        expect(result.issue).toBeDefined();
        expect(result.thread?.success).toBe(true);
        expect(result.github?.success).toBe(true);
        expect(result.jira?.success).toBe(true);
      });

      it("should handle thread creation failure in full flow", async () => {
        (mockChannel.threads!.create as any).mockRejectedValue(
          new Error("Thread creation failed")
        );

        const result = await manager.createFullIssueFlow(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        expect(result.success).toBe(false);
        expect(result.thread?.success).toBe(false);
      });

      it("should continue flow even if external services fail", async () => {
        (githubService.createIssue as any).mockResolvedValue({
          success: false,
          error: "GitHub error",
        });

        const result = await manager.createFullIssueFlow(
          mockGuild as Guild,
          mockChannel as ForumChannel,
          mockIssueData
        );

        // Should still succeed in creating issue and thread
        expect(result.success).toBe(false); // Overall failure due to GitHub
        expect(result.issue).toBeDefined();
        expect(result.thread?.success).toBe(true);
        expect(result.github?.success).toBe(false);
      });
    });
  });

  describe("Issue Retrieval", () => {
    describe("getIssue", () => {
      it("should retrieve issue from cache", async () => {
        const cachedIssue = { ...mockIssueData, id: "issue123", status: "open" };
        (cacheService.get as any).mockResolvedValue(cachedIssue);

        const result = await manager.getIssue("issue123");

        expect(result).toEqual(cachedIssue);
        expect(cacheService.get).toHaveBeenCalledWith("issue:issue123");
      });

      it("should return null for non-existent issue", async () => {
        (cacheService.get as any).mockResolvedValue(null);

        const result = await manager.getIssue("nonexistent");

        expect(result).toBeNull();
      });

      it("should handle cache retrieval errors", async () => {
        (cacheService.get as any).mockRejectedValue(new Error("Cache error"));

        const result = await manager.getIssue("issue123");

        expect(result).toBeNull();
      });
    });

    describe("getIssuesByStatus", () => {
      it("should retrieve issues by status", async () => {
        const mockIssues = [
          { id: "issue1", status: "open" },
          { id: "issue2", status: "open" },
        ];

        // Mock cache pattern search
        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:status:open") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });

        const result = await manager.getIssuesByStatus("open");

        expect(result).toEqual(mockIssues);
      });

      it("should return empty array if no issues found", async () => {
        (cacheService.get as any).mockResolvedValue(null);

        const result = await manager.getIssuesByStatus("open");

        expect(result).toEqual([]);
      });
    });

    describe("getIssuesByForum", () => {
      it("should retrieve issues by forum", async () => {
        const mockIssues = [
          { id: "issue1", forum: "test-forum" },
          { id: "issue2", forum: "test-forum" },
        ];

        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:forum:test-forum") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });

        const result = await manager.getIssuesByForum("test-forum");

        expect(result).toEqual(mockIssues);
      });
    });

    describe("getIssuesByAssignee", () => {
      it("should retrieve issues by assignee", async () => {
        const mockIssues = [
          { id: "issue1", assignees: ["user123"] },
          { id: "issue2", assignees: ["user123", "user456"] },
        ];

        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:assignee:user123") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });

        const result = await manager.getIssuesByAssignee("user123");

        expect(result).toEqual(mockIssues);
      });
    });
  });

  describe("Issue Updates", () => {
    describe("updateIssue", () => {
      const existingIssue = {
        ...mockIssueData,
        id: "issue123",
        status: "open" as IssueStatus,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
      };

      beforeEach(() => {
        (cacheService.get as any).mockResolvedValue(existingIssue);
      });

      it("should update issue successfully", async () => {
        const updates = { status: "in-progress" as IssueStatus, title: "Updated Title" };

        const result = await manager.updateIssue("issue123", updates);

        expect(result.success).toBe(true);
        expect(result.issue?.status).toBe("in-progress");
        expect(result.issue?.title).toBe("Updated Title");
        expect(result.issue?.updatedAt).toBeInstanceOf(Date);
      });

      it("should return error for non-existent issue", async () => {
        (cacheService.get as any).mockResolvedValue(null);

        const result = await manager.updateIssue("nonexistent", { status: "closed" });

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });

      it("should sync updates to GitHub and Jira", async () => {
        (githubService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });
        (jiraService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });

        const updates = { status: "closed" as IssueStatus };
        await manager.updateIssue("issue123", updates);

        expect(githubService.updateIssue).toHaveBeenCalled();
        expect(jiraService.updateIssue).toHaveBeenCalled();
      });

      it("should update cache with new issue data", async () => {
        const updates = { status: "closed" as IssueStatus };
        await manager.updateIssue("issue123", updates);

        expect(cacheService.set).toHaveBeenCalledWith(
          "issue:issue123",
          expect.objectContaining({
            ...existingIssue,
            ...updates,
            updatedAt: expect.any(Date),
          }),
          expect.any(Number)
        );
      });

      it("should handle partial updates", async () => {
        const result = await manager.updateIssue("issue123", { priority: "high" });

        expect(result.success).toBe(true);
        expect(result.issue?.priority).toBe("high");
        expect(result.issue?.title).toBe(existingIssue.title); // Unchanged
        expect(result.issue?.status).toBe(existingIssue.status); // Unchanged
      });

      it("should update assignees", async () => {
        const updates = { assignees: ["user456", "user789"] };
        const result = await manager.updateIssue("issue123", updates);

        expect(result.success).toBe(true);
        expect(result.issue?.assignees).toEqual(["user456", "user789"]);
      });

      it("should update labels", async () => {
        const updates = { labels: ["urgent", "backend"] };
        const result = await manager.updateIssue("issue123", updates);

        expect(result.success).toBe(true);
        expect(result.issue?.labels).toEqual(["urgent", "backend"]);
      });
    });

    describe("closeIssue", () => {
      const openIssue = {
        ...mockIssueData,
        id: "issue123",
        status: "open" as IssueStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      beforeEach(() => {
        (cacheService.get as any).mockResolvedValue(openIssue);
      });

      it("should close issue successfully", async () => {
        const result = await manager.closeIssue("issue123", "Fixed");

        expect(result.success).toBe(true);
        expect(result.issue?.status).toBe("closed");
        expect(result.issue?.resolution).toBe("Fixed");
      });

      it("should handle already closed issue", async () => {
        const closedIssue = { ...openIssue, status: "closed" as IssueStatus };
        (cacheService.get as any).mockResolvedValue(closedIssue);

        const result = await manager.closeIssue("issue123", "Already fixed");

        expect(result.success).toBe(true);
        expect(result.issue?.status).toBe("closed");
      });

      it("should sync close to external services", async () => {
        (githubService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });
        (jiraService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });

        await manager.closeIssue("issue123", "Fixed");

        expect(githubService.updateIssue).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ state: "closed" })
        );
        expect(jiraService.updateIssue).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ status: "Done" })
        );
      });
    });

    describe("assignIssue", () => {
      const unassignedIssue = {
        ...mockIssueData,
        id: "issue123",
        assignees: [],
        status: "open" as IssueStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      beforeEach(() => {
        (cacheService.get as any).mockResolvedValue(unassignedIssue);
      });

      it("should assign single user to issue", async () => {
        const result = await manager.assignIssue("issue123", "user456");

        expect(result.success).toBe(true);
        expect(result.issue?.assignees).toContain("user456");
      });

      it("should assign multiple users to issue", async () => {
        const result = await manager.assignIssue("issue123", ["user456", "user789"]);

        expect(result.success).toBe(true);
        expect(result.issue?.assignees).toEqual(
          expect.arrayContaining(["user456", "user789"])
        );
      });

      it("should not duplicate existing assignees", async () => {
        const assignedIssue = { ...unassignedIssue, assignees: ["user456"] };
        (cacheService.get as any).mockResolvedValue(assignedIssue);

        const result = await manager.assignIssue("issue123", "user456");

        expect(result.success).toBe(true);
        expect(result.issue?.assignees.filter(a => a === "user456")).toHaveLength(1);
      });

      it("should sync assignment to external services", async () => {
        (githubService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });
        (jiraService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });

        await manager.assignIssue("issue123", "user456");

        expect(githubService.updateIssue).toHaveBeenCalled();
        expect(jiraService.updateIssue).toHaveBeenCalled();
      });
    });

    describe("unassignIssue", () => {
      const assignedIssue = {
        ...mockIssueData,
        id: "issue123",
        assignees: ["user456", "user789"],
        status: "open" as IssueStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      beforeEach(() => {
        (cacheService.get as any).mockResolvedValue(assignedIssue);
      });

      it("should unassign user from issue", async () => {
        const result = await manager.unassignIssue("issue123", "user456");

        expect(result.success).toBe(true);
        expect(result.issue?.assignees).not.toContain("user456");
        expect(result.issue?.assignees).toContain("user789");
      });

      it("should handle unassigning non-assigned user", async () => {
        const result = await manager.unassignIssue("issue123", "user999");

        expect(result.success).toBe(true);
        expect(result.issue?.assignees).toEqual(assignedIssue.assignees);
      });

      it("should sync unassignment to external services", async () => {
        (githubService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });
        (jiraService.updateIssue as any) = vi.fn().mockResolvedValue({ success: true });

        await manager.unassignIssue("issue123", "user456");

        expect(githubService.updateIssue).toHaveBeenCalled();
        expect(jiraService.updateIssue).toHaveBeenCalled();
      });
    });
  });

  describe("Issue Deletion", () => {
    describe("deleteIssue", () => {
      const existingIssue = {
        ...mockIssueData,
        id: "issue123",
        status: "open" as IssueStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      beforeEach(() => {
        (cacheService.get as any).mockResolvedValue(existingIssue);
      });

      it("should delete issue successfully", async () => {
        const result = await manager.deleteIssue("issue123");

        expect(result.success).toBe(true);
        expect(cacheService.del).toHaveBeenCalledWith("issue:issue123");
      });

      it("should return error for non-existent issue", async () => {
        (cacheService.get as any).mockResolvedValue(null);

        const result = await manager.deleteIssue("nonexistent");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });

      it("should handle cache deletion errors", async () => {
        (cacheService.del as any).mockRejectedValue(new Error("Cache error"));

        const result = await manager.deleteIssue("issue123");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Cache error");
      });
    });
  });

  describe("Discord Thread Management", () => {
    describe("updateDiscordThread", () => {
      const issueWithThread = {
        ...mockIssueData,
        id: "issue123",
        status: "open" as IssueStatus,
        metadata: {
          ...mockIssueData.metadata,
          threadId: "thread456",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      beforeEach(() => {
        (cacheService.get as any).mockResolvedValue(issueWithThread);
      });

      it("should update thread with issue changes", async () => {
        const result = await manager.updateDiscordThread(
          mockGuild as Guild,
          "issue123",
          { status: "closed" }
        );

        expect(result.success).toBe(true);
        expect(mockThreadChannel.send).toHaveBeenCalled();
      });

      it("should handle missing thread ID", async () => {
        const issueWithoutThread = {
          ...issueWithThread,
          metadata: { ...issueWithThread.metadata, threadId: undefined },
        };
        (cacheService.get as any).mockResolvedValue(issueWithoutThread);

        const result = await manager.updateDiscordThread(
          mockGuild as Guild,
          "issue123",
          { status: "closed" }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Thread ID not found");
      });

      it("should handle thread not found in guild", async () => {
        (mockGuild.channels!.fetch as any).mockResolvedValue(null);

        const result = await manager.updateDiscordThread(
          mockGuild as Guild,
          "issue123",
          { status: "closed" }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Thread not found");
      });

      it("should archive closed issue threads", async () => {
        await manager.updateDiscordThread(
          mockGuild as Guild,
          "issue123",
          { status: "closed" }
        );

        expect(mockThreadChannel.setArchived).toHaveBeenCalledWith(true);
      });

      it("should lock resolved issue threads", async () => {
        await manager.updateDiscordThread(
          mockGuild as Guild,
          "issue123",
          { status: "closed", resolution: "Fixed" }
        );

        expect(mockThreadChannel.setLocked).toHaveBeenCalledWith(true);
      });
    });

    describe("closeDiscordThread", () => {
      const issueWithThread = {
        ...mockIssueData,
        id: "issue123",
        status: "open" as IssueStatus,
        metadata: {
          ...mockIssueData.metadata,
          threadId: "thread456",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      beforeEach(() => {
        (cacheService.get as any).mockResolvedValue(issueWithThread);
      });

      it("should close and archive thread", async () => {
        const result = await manager.closeDiscordThread(
          mockGuild as Guild,
          "issue123",
          "Issue resolved"
        );

        expect(result.success).toBe(true);
        expect(mockThreadChannel.send).toHaveBeenCalled();
        expect(mockThreadChannel.setArchived).toHaveBeenCalledWith(true);
        expect(mockThreadChannel.setLocked).toHaveBeenCalledWith(true);
      });

      it("should send closure message with reason", async () => {
        await manager.closeDiscordThread(
          mockGuild as Guild,
          "issue123",
          "Issue resolved"
        );

        expect(mockThreadChannel.send).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining("Issue resolved"),
                }),
              }),
            ]),
          })
        );
      });
    });
  });

  describe("Search and Filtering", () => {
    describe("searchIssues", () => {
      it("should search issues by title", async () => {
        const mockIssues = [
          { id: "issue1", title: "Bug in login", status: "open" },
          { id: "issue2", title: "Login feature request", status: "open" },
          { id: "issue3", title: "Dashboard bug", status: "open" },
        ];

        // Mock cache search functionality
        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:all") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });

        const result = await manager.searchIssues("login");

        expect(result).toHaveLength(2);
        expect(result.every(issue => 
          issue.title.toLowerCase().includes("login")
        )).toBe(true);
      });

      it("should search issues by description", async () => {
        const mockIssues = [
          { id: "issue1", title: "Test", description: "Authentication bug", status: "open" },
          { id: "issue2", title: "Test", description: "UI enhancement", status: "open" },
        ];

        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:all") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });

        const result = await manager.searchIssues("authentication");

        expect(result).toHaveLength(1);
        expect(result[0].description).toContain("Authentication");
      });

      it("should return empty array for no matches", async () => {
        const mockIssues = [
          { id: "issue1", title: "Test", description: "Test description", status: "open" },
        ];

        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:all") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });

        const result = await manager.searchIssues("nonexistent");

        expect(result).toEqual([]);
      });
    });

    describe("filterIssues", () => {
      const mockIssues = [
        {
          id: "issue1",
          title: "Bug 1",
          status: "open" as IssueStatus,
          priority: "high" as IssuePriority,
          type: "bug" as IssueType,
          forum: "forum1",
          assignees: ["user1"],
          labels: ["critical", "backend"],
        },
        {
          id: "issue2",
          title: "Feature 1",
          status: "in-progress" as IssueStatus,
          priority: "medium" as IssuePriority,
          type: "feature" as IssueType,
          forum: "forum2",
          assignees: ["user2"],
          labels: ["enhancement", "frontend"],
        },
        {
          id: "issue3",
          title: "Bug 2",
          status: "closed" as IssueStatus,
          priority: "low" as IssuePriority,
          type: "bug" as IssueType,
          forum: "forum1",
          assignees: [],
          labels: ["minor", "backend"],
        },
      ];

      beforeEach(() => {
        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:all") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });
      });

      it("should filter by status", async () => {
        const result = await manager.filterIssues({ status: "open" });

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("open");
      });

      it("should filter by priority", async () => {
        const result = await manager.filterIssues({ priority: "high" });

        expect(result).toHaveLength(1);
        expect(result[0].priority).toBe("high");
      });

      it("should filter by type", async () => {
        const result = await manager.filterIssues({ type: "bug" });

        expect(result).toHaveLength(2);
        expect(result.every(issue => issue.type === "bug")).toBe(true);
      });

      it("should filter by forum", async () => {
        const result = await manager.filterIssues({ forum: "forum1" });

        expect(result).toHaveLength(2);
        expect(result.every(issue => issue.forum === "forum1")).toBe(true);
      });

      it("should filter by assignee", async () => {
        const result = await manager.filterIssues({ assignee: "user1" });

        expect(result).toHaveLength(1);
        expect(result[0].assignees).toContain("user1");
      });

      it("should filter by labels", async () => {
        const result = await manager.filterIssues({ labels: ["backend"] });

        expect(result).toHaveLength(2);
        expect(result.every(issue => 
          issue.labels.some(label => label === "backend")
        )).toBe(true);
      });

      it("should filter by multiple criteria", async () => {
        const result = await manager.filterIssues({
          status: "open",
          type: "bug",
          priority: "high",
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("issue1");
      });

      it("should return empty array when no issues match filters", async () => {
        const result = await manager.filterIssues({
          status: "open",
          type: "feature",
        });

        expect(result).toEqual([]);
      });
    });
  });

  describe("Statistics and Analytics", () => {
    describe("getIssueStats", () => {
      const mockIssues = [
        { status: "open", type: "bug", priority: "high", forum: "forum1" },
        { status: "open", type: "feature", priority: "medium", forum: "forum1" },
        { status: "closed", type: "bug", priority: "low", forum: "forum2" },
        { status: "in-progress", type: "enhancement", priority: "medium", forum: "forum2" },
      ];

      beforeEach(() => {
        (cacheService.get as any).mockImplementation((key: string) => {
          if (key === "issues:all") return Promise.resolve(mockIssues);
          return Promise.resolve(null);
        });
      });

      it("should return comprehensive statistics", async () => {
        const stats = await manager.getIssueStats();

        expect(stats).toMatchObject({
          total: 4,
          byStatus: {
            open: 2,
            closed: 1,
            "in-progress": 1,
          },
          byType: {
            bug: 2,
            feature: 1,
            enhancement: 1,
          },
          byPriority: {
            high: 1,
            medium: 2,
            low: 1,
          },
          byForum: {
            forum1: 2,
            forum2: 2,
          },
        });
      });

      it("should handle empty issue list", async () => {
        (cacheService.get as any).mockResolvedValue([]);

        const stats = await manager.getIssueStats();

        expect(stats).toMatchObject({
          total: 0,
          byStatus: {},
          byType: {},
          byPriority: {},
          byForum: {},
        });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle cache service errors gracefully", async () => {
      (cacheService.set as any).mockRejectedValue(new Error("Cache error"));

      const result = await manager.createIssue(mockIssueData);

      // Should still succeed in creating issue even if cache fails
      expect(result.success).toBe(true);
      expect(result.issue).toBeDefined();
    });

    it("should handle GitHub service errors", async () => {
      (githubService.createIssue as any).mockRejectedValue(new Error("Network error"));

      const result = await manager.createIssue(mockIssueData);

      expect(result.success).toBe(false);
      expect(result.github?.error).toContain("Network error");
    });

    it("should handle Jira service errors", async () => {
      (jiraService.createIssue as any).mockRejectedValue(new Error("Auth error"));

      const result = await manager.createIssue(mockIssueData);

      expect(result.success).toBe(false);
      expect(result.jira?.error).toContain("Auth error");
    });

    it("should handle Discord API errors", async () => {
      (mockChannel.threads!.create as any).mockRejectedValue(
        new Error("Discord API rate limit")
      );

      const result = await manager.createDiscordThread(
        mockGuild as Guild,
        mockChannel as ForumChannel,
        mockIssueData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Discord API rate limit");
    });

    it("should validate issue data", async () => {
      const invalidIssue = {
        ...mockIssueData,
        title: "", // Invalid: empty title
      };

      const result = await manager.createIssue(invalidIssue);

      expect(result.success).toBe(false);
      expect(result.error).toContain("title");
    });

    it("should handle invalid issue IDs", async () => {
      const result = await manager.getIssue("");

      expect(result).toBeNull();
    });

    it("should handle malformed cache data", async () => {
      (cacheService.get as any).mockResolvedValue("invalid json");

      const result = await manager.getIssue("issue123");

      expect(result).toBeNull();
    });
  });

  describe("Integration", () => {
    it("should work with all components together", async () => {
      // Create issue
      const createResult = await manager.createFullIssueFlow(
        mockGuild as Guild,
        mockChannel as ForumChannel,
        mockIssueData
      );

      expect(createResult.success).toBe(true);

      // Update issue
      const updateResult = await manager.updateIssue(
        createResult.issue!.id,
        { status: "in-progress" }
      );

      expect(updateResult.success).toBe(true);

      // Assign issue
      const assignResult = await manager.assignIssue(
        createResult.issue!.id,
        "user456"
      );

      expect(assignResult.success).toBe(true);

      // Close issue
      const closeResult = await manager.closeIssue(
        createResult.issue!.id,
        "Fixed"
      );

      expect(closeResult.success).toBe(true);
      expect(closeResult.issue?.status).toBe("closed");
      expect(closeResult.issue?.resolution).toBe("Fixed");
    });
  });
});