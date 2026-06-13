import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ForumChannel,
  Guild,
  ChannelType,
  PermissionFlagsBits,

  Role,
} from "discord.js";

// Mock dependencies (use correct relative paths so mocks apply to imports below)
vi.mock("../ForumConfig");
vi.mock("../UnifiedIssueManager");

// Import after mocking
import { ForumManager, forumManager } from "../ForumManager";
import {
  FORUM_CONFIGURATIONS,
  TEAM_CONFIGURATIONS,
  ENVIRONMENT_CONFIG,
  validateConfigurations,
  ForumConfig,
  TeamConfig,
  ForumTag,
} from "../ForumConfig";
import { IssueData } from "../UnifiedIssueManager";

describe("ForumManager", () => {
  let manager: ForumManager;
  let mockGuild: Partial<Guild>;
  let mockForumChannel: Partial<ForumChannel>;
  let mockRole: Partial<Role>;
  let originalConsole: any;

  // Mock configurations
  const mockForumConfigs: ForumConfig[] = [
    {
      id: "test-forum-1",
      name: "🧪 Test Forum 1",
      description: "Test forum description 1",
      category: "bug-reports",
      team: "test-team-1",
      priority: 1,
      tags: [
        { name: "test", emoji: "🧪" },
        { name: "bug", emoji: "🐛" },
      ],
      permissions: {
        allowedRoles: ["@everyone"],
        restrictedToTeam: false,
      },
      autoAssign: ["test-team-1"],
      labels: ["test", "bug"],
    },
    {
      id: "test-forum-2",
      name: "🚀 Test Forum 2",
      description: "Test forum description 2",
      category: "feature-requests",
      team: "test-team-2",
      priority: 2,
      tags: [
        { name: "feature", emoji: "🚀" },
        { name: "enhancement", emoji: "✨" },
      ],
      permissions: {
        allowedRoles: ["@everyone", "developer"],
        restrictedToTeam: false,
      },
      autoAssign: ["test-team-2"],
      labels: ["enhancement", "feature"],
    },
    {
      id: "test-forum-3",
      name: "❓ Test Support",
      description: "Test support forum",
      category: "support",
      team: "test-team-1",
      priority: 3,
      tags: [
        { name: "support", emoji: "❓" },
        { name: "help", emoji: "🆘" },
      ],
      permissions: {
        allowedRoles: ["@everyone"],
        restrictedToTeam: false,
      },
      autoAssign: ["test-team-1"],
      labels: ["support", "help"],
    },
  ];

  const mockTeamConfigs: TeamConfig[] = [
    {
      id: "test-team-1",
      name: "Test Team 1",
      description: "First test team",
      color: 0xff0000,
      emoji: "🧪",
      forums: ["test-forum-1", "test-forum-3"],
      members: ["member1", "member2"],
    },
    {
      id: "test-team-2",
      name: "Test Team 2",
      description: "Second test team",
      color: 0x00ff00,
      emoji: "🚀",
      forums: ["test-forum-2"],
      members: ["member3", "member4"],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock configurations
    (FORUM_CONFIGURATIONS as any).length = 0;
    (FORUM_CONFIGURATIONS as any).push(...mockForumConfigs);
    (TEAM_CONFIGURATIONS as any).length = 0;
    (TEAM_CONFIGURATIONS as any).push(...mockTeamConfigs);

    // Mock environment config by mutating properties on the mocked export
    (ENVIRONMENT_CONFIG as any).FORUM_CHANNEL_IDS = {
      "test-forum-1": "channel-123",
      "test-forum-2": "",
      "test-forum-3": "channel-789",
    };
    (ENVIRONMENT_CONFIG as any).ROLE_MAPPINGS = {
      "test-team-1": "role-123",
      "test-team-2": "role-456",
    };
    (ENVIRONMENT_CONFIG as any).AUTO_ASSIGNMENT = {
      enabled: true,
      notifyAssignees: true,
      createThreads: true,
    };
    (ENVIRONMENT_CONFIG as any).FORUM_CREATION = {
      autoCreateForums: true,
      defaultPermissions: {
        viewChannel: true,
        sendMessages: true,
        createPublicThreads: true,
        sendMessagesInThreads: true,
      },
    };

    // Mock validateConfigurations
    (validateConfigurations as vi.Mock).mockReturnValue({
      valid: true,
      errors: [],
    });

    // Mock console methods
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();

    // Mock Discord objects
    mockRole = {
      id: "everyone-role-id",
    };

    mockForumChannel = {
      id: "new-forum-channel-123",
      name: "Test Forum Channel",
      type: ChannelType.GuildForum,
    };

    mockGuild = {
      id: "guild-123",
      roles: {
        everyone: mockRole as Role,
      },
      channels: {
        create: vi.fn().mockResolvedValue(mockForumChannel),
      },
    };

    // Create new instance for each test
    manager = new ForumManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe("Constructor", () => {
    it("should initialize from configuration", () => {
      expect(manager).toBeDefined();
      expect(console.log).toHaveBeenCalledWith(
        "🏗️ ForumManager initialized - auto-create will be handled by discord.ts"
      );
    });

    it("should load forums from configuration", () => {
      const forum1 = manager.getForum("test-forum-1");
      const forum2 = manager.getForum("test-forum-2");

      expect(forum1).toEqual(expect.objectContaining({
        id: "test-forum-1",
        name: "🧪 Test Forum 1",
        category: "bug-reports",
      }));
      expect(forum2).toEqual(expect.objectContaining({
        id: "test-forum-2",
        name: "🚀 Test Forum 2",
        category: "feature-requests",
      }));
    });

    it("should load teams from configuration", () => {
      const team1 = manager.getTeam("test-team-1");
      const team2 = manager.getTeam("test-team-2");

      expect(team1).toEqual(expect.objectContaining({
        id: "test-team-1",
        name: "Test Team 1",
        color: 0xff0000,
      }));
      expect(team2).toEqual(expect.objectContaining({
        id: "test-team-2",
        name: "Test Team 2",
        color: 0x00ff00,
      }));
    });

    it("should set channel IDs from environment config", () => {
      const forum1 = manager.getForum("test-forum-1");
      const forum3 = manager.getForum("test-forum-3");

      expect((forum1 as any)?.channelId).toBe("channel-123");
      expect((forum3 as any)?.channelId).toBe("channel-789");
    });

    it("should handle validation warnings", () => {
      (validateConfigurations as vi.Mock).mockReturnValue({
        valid: false,
        errors: ["Test error 1", "Test error 2"],
      });

      new ForumManager();

      expect(console.warn).toHaveBeenCalledWith(
        "Forum configuration validation failed:",
        ["Test error 1", "Test error 2"]
      );
      expect(console.warn).toHaveBeenCalledWith("- Test error 1");
      expect(console.warn).toHaveBeenCalledWith("- Test error 2");
    });
  });

  describe("Forum Registration", () => {
    describe("registerForum", () => {
      it("should register a new forum", () => {
        const newForum: ForumConfig = {
          id: "new-forum",
          name: "New Forum",
          description: "A new forum",
          category: "support",
          team: "test-team-1",
          priority: 10,
          tags: [],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        };

        manager.registerForum(newForum);

        expect(manager.getForum("new-forum")).toEqual(newForum);
      });

      it("should register forum with channel ID mapping", () => {
        const forumWithChannel: ForumConfig & { channelId: string } = {
          id: "forum-with-channel",
          name: "Forum with Channel",
          description: "A forum with channel ID",
          category: "bug-reports",
          team: "test-team-1",
          priority: 5,
          tags: [],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
          channelId: "custom-channel-456",
        };

        manager.registerForum(forumWithChannel);

        expect(manager.getForumByChannelId("custom-channel-456")).toEqual(forumWithChannel);
      });

      it("should overwrite existing forum with same ID", () => {
        const originalForum = manager.getForum("test-forum-1");
        const updatedForum: ForumConfig = {
          ...originalForum!,
          name: "Updated Forum Name",
          description: "Updated description",
        };

        manager.registerForum(updatedForum);

        expect(manager.getForum("test-forum-1")?.name).toBe("Updated Forum Name");
        expect(manager.getForum("test-forum-1")?.description).toBe("Updated description");
      });
    });

    describe("registerTeam", () => {
      it("should register a new team", () => {
        const newTeam: TeamConfig = {
          id: "new-team",
          name: "New Team",
          description: "A new team",
          color: 0x0000ff,
          emoji: "🆕",
          forums: ["test-forum-1"],
          members: ["new-member"],
        };

        manager.registerTeam(newTeam);

        expect(manager.getTeam("new-team")).toEqual(newTeam);
      });

      it("should overwrite existing team with same ID", () => {
        const updatedTeam: TeamConfig = {
          id: "test-team-1",
          name: "Updated Team Name",
          description: "Updated team description",
          color: 0xffffff,
          emoji: "🔄",
          forums: ["test-forum-2"],
          members: ["updated-member"],
        };

        manager.registerTeam(updatedTeam);

        expect(manager.getTeam("test-team-1")?.name).toBe("Updated Team Name");
        expect(manager.getTeam("test-team-1")?.color).toBe(0xffffff);
      });
    });
  });

  describe("Forum Retrieval", () => {
    describe("getForum", () => {
      it("should return forum by ID", () => {
        const forum = manager.getForum("test-forum-1");

        expect(forum).toBeDefined();
        expect(forum?.id).toBe("test-forum-1");
        expect(forum?.name).toBe("🧪 Test Forum 1");
      });

      it("should return undefined for non-existent forum", () => {
        const forum = manager.getForum("non-existent");

        expect(forum).toBeUndefined();
      });

      it("should handle empty string ID", () => {
        const forum = manager.getForum("");

        expect(forum).toBeUndefined();
      });
    });

    describe("getTeam", () => {
      it("should return team by ID", () => {
        const team = manager.getTeam("test-team-1");

        expect(team).toBeDefined();
        expect(team?.id).toBe("test-team-1");
        expect(team?.name).toBe("Test Team 1");
      });

      it("should return undefined for non-existent team", () => {
        const team = manager.getTeam("non-existent");

        expect(team).toBeUndefined();
      });
    });

    describe("getForumByChannelId", () => {
      it("should return forum by channel ID", () => {
        const forum = manager.getForumByChannelId("channel-123");

        expect(forum).toBeDefined();
        expect(forum?.id).toBe("test-forum-1");
      });

      it("should return undefined for non-existent channel ID", () => {
        const forum = manager.getForumByChannelId("non-existent-channel");

        expect(forum).toBeUndefined();
      });

      it("should handle empty channel mapping", () => {
        const forum = manager.getForumByChannelId("channel-456");

        expect(forum).toBeUndefined();
      });
    });

    describe("getForumsByCategory", () => {
      it("should return forums by category sorted by priority", () => {
        const bugReportForums = manager.getForumsByCategory("bug-reports");

        expect(bugReportForums).toHaveLength(1);
        expect(bugReportForums[0].id).toBe("test-forum-1");
        expect(bugReportForums[0].category).toBe("bug-reports");
      });

      it("should return empty array for non-existent category", () => {
        const forums = manager.getForumsByCategory("non-existent" as any);

        expect(forums).toEqual([]);
      });

      it("should sort forums by priority", () => {
        // Add another forum with lower priority to same category
        const lowPriorityForum: ForumConfig = {
          id: "low-priority",
          name: "Low Priority Forum",
          description: "Low priority bug forum",
          category: "bug-reports",
          team: "test-team-1",
          priority: 0, // Lower than existing forum (priority 1)
          tags: [],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        };

        manager.registerForum(lowPriorityForum);

        const bugReportForums = manager.getForumsByCategory("bug-reports");

        expect(bugReportForums).toHaveLength(2);
        expect(bugReportForums[0].id).toBe("low-priority");
        expect(bugReportForums[1].id).toBe("test-forum-1");
      });

      it("should handle all valid categories", () => {
        const bugForums = manager.getForumsByCategory("bug-reports");
        const featureForums = manager.getForumsByCategory("feature-requests");
        const supportForums = manager.getForumsByCategory("support");

        expect(bugForums).toHaveLength(1);
        expect(featureForums).toHaveLength(1);
        expect(supportForums).toHaveLength(1);
      });
    });

    describe("getForumsByTeam", () => {
      it("should return forums by team ID sorted by priority", () => {
        const team1Forums = manager.getForumsByTeam("test-team-1");

        expect(team1Forums).toHaveLength(2);
        expect(team1Forums[0].id).toBe("test-forum-1"); // priority 1
        expect(team1Forums[1].id).toBe("test-forum-3"); // priority 3
      });

      it("should return empty array for non-existent team", () => {
        const forums = manager.getForumsByTeam("non-existent-team");

        expect(forums).toEqual([]);
      });

      it("should return single forum for team with one forum", () => {
        const team2Forums = manager.getForumsByTeam("test-team-2");

        expect(team2Forums).toHaveLength(1);
        expect(team2Forums[0].id).toBe("test-forum-2");
      });
    });

    describe("getAllForums", () => {
      it("should return all forums sorted by priority", () => {
        const allForums = manager.getAllForums();

        expect(allForums).toHaveLength(3);
        expect(allForums[0].id).toBe("test-forum-1"); // priority 1
        expect(allForums[1].id).toBe("test-forum-2"); // priority 2
        expect(allForums[2].id).toBe("test-forum-3"); // priority 3
      });

      it("should return empty array when no forums registered", () => {
        const emptyManager = new ForumManager();
        // Clear the forums map
        (emptyManager as any).forums.clear();

        const allForums = emptyManager.getAllForums();

        expect(allForums).toEqual([]);
      });
    });

    describe("getAllTeams", () => {
      it("should return all teams", () => {
        const allTeams = manager.getAllTeams();

        expect(allTeams).toHaveLength(2);
        expect(allTeams.map(t => t.id)).toContain("test-team-1");
        expect(allTeams.map(t => t.id)).toContain("test-team-2");
      });

      it("should return empty array when no teams registered", () => {
        const emptyManager = new ForumManager();
        // Clear the teams map
        (emptyManager as any).teams.clear();

        const allTeams = emptyManager.getAllTeams();

        expect(allTeams).toEqual([]);
      });
    });
  });

  describe("Discord Forum Creation", () => {
    describe("createDiscordForum", () => {
      it("should create a Discord forum channel successfully", async () => {
        const forumConfig = manager.getForum("test-forum-1")!;

        const result = await manager.createDiscordForum(mockGuild as Guild, forumConfig);

        expect(mockGuild.channels!.create).toHaveBeenCalledWith({
          name: forumConfig.name,
          type: ChannelType.GuildForum,
          topic: forumConfig.description,
          availableTags: expect.arrayContaining([
            expect.objectContaining({
              name: "test",
              emoji: { id: null, name: "🧪" },
              moderated: false,
            }),
          ]),
          defaultReactionEmoji: { id: null, name: "👍" },
          rateLimitPerUser: 5,
          permissionOverwrites: expect.arrayContaining([
            expect.objectContaining({
              id: mockRole.id,
              allow: expect.arrayContaining([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.SendMessagesInThreads,
              ]),
            }),
          ]),
        });

        expect(result).toBe(mockForumChannel);
        expect(console.log).toHaveBeenCalledWith(
          `Created Discord forum: ${forumConfig.name} (${mockForumChannel.id})`
        );
      });

      it("should update forum config with channel ID after creation", async () => {
        const forumConfig = manager.getForum("test-forum-2")!;

        await manager.createDiscordForum(mockGuild as Guild, forumConfig);

        expect((forumConfig as any).channelId).toBe(mockForumChannel.id);
        expect(manager.getForumByChannelId(mockForumChannel.id!)).toEqual(forumConfig);
      });

      it("should handle forum creation error", async () => {
        const error = new Error("Discord API Error");
        (mockGuild.channels!.create as vi.Mock).mockRejectedValue(error);

        const forumConfig = manager.getForum("test-forum-1")!;

        const result = await manager.createDiscordForum(mockGuild as Guild, forumConfig);

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
          `Failed to create Discord forum for ${forumConfig.name}:`,
          error
        );
      });

      it("should handle tags with null emoji", async () => {
        const forumConfigWithoutEmoji: ForumConfig = {
          id: "no-emoji-forum",
          name: "No Emoji Forum",
          description: "Forum with tags without emojis",
          category: "support",
          team: "test-team-1",
          priority: 5,
          tags: [
            { name: "no-emoji", emoji: "" },
            { name: "with-emoji", emoji: "✨" },
          ],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        };

        manager.registerForum(forumConfigWithoutEmoji);

        await manager.createDiscordForum(mockGuild as Guild, forumConfigWithoutEmoji);

        const createCall = (mockGuild.channels!.create as vi.Mock).mock.calls[0][0];
        expect(createCall.availableTags[0].emoji).toBeNull();
        expect(createCall.availableTags[1].emoji).toEqual({ id: null, name: "✨" });
      });

      it("should handle moderated tags", async () => {
        const forumConfigWithModerated: ForumConfig & { tags: Array<ForumTag & { moderated?: boolean }> } = {
          id: "moderated-forum",
          name: "Moderated Forum",
          description: "Forum with moderated tags",
          category: "bug-reports",
          team: "test-team-1",
          priority: 5,
          tags: [
            { name: "normal", emoji: "🏷️" },
            { name: "moderated", emoji: "🔒", moderated: true },
          ],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        };

        manager.registerForum(forumConfigWithModerated);

        await manager.createDiscordForum(mockGuild as Guild, forumConfigWithModerated);

        const createCall = (mockGuild.channels!.create as vi.Mock).mock.calls[0][0];
        expect(createCall.availableTags[0].moderated).toBe(false);
        expect(createCall.availableTags[1].moderated).toBe(true);
      });
    });

    describe("autoCreateForums", () => {
      it("should auto-create all forums without channel IDs", async () => {
        await manager.autoCreateForums(mockGuild as Guild);

        // Should create forum-2 (which has no channelId)
        expect(mockGuild.channels!.create).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith("Auto-creating Discord forums...");
      });

      it("should skip auto-creation when disabled", async () => {
        (ENVIRONMENT_CONFIG as any).FORUM_CREATION.autoCreateForums = false;

        await manager.autoCreateForums(mockGuild as Guild);

        expect(mockGuild.channels!.create).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith("Auto-creation of forums is disabled");
      });

      it("should add delay between forum creations", async () => {
        // Add more forums without channel IDs
        const forum4: ForumConfig = {
          id: "test-forum-4",
          name: "Test Forum 4",
          description: "Fourth test forum",
          category: "support",
          team: "test-team-1",
          priority: 4,
          tags: [],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        };

        manager.registerForum(forum4);

        const setTimeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
          callback();
          return 0 as any;
        });

        await manager.autoCreateForums(mockGuild as Guild);

        expect(mockGuild.channels!.create).toHaveBeenCalledTimes(2);
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

        setTimeoutSpy.mockRestore();
      });

      it("should handle errors during auto-creation", async () => {
        const error = new Error("Creation failed");
        (mockGuild.channels!.create as vi.Mock).mockRejectedValueOnce(error);

        await manager.autoCreateForums(mockGuild as Guild);

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to create Discord forum"),
          error
        );
      });
    });
  });

  describe("Unified Issue Creation", () => {
    describe("createUnifiedIssue", () => {
      it("should throw error for non-existent forum", async () => {
        const issueData: Omit<IssueData, "forum"> = {
          title: "Test Issue",
          description: "Test description",
          category: "bug",
          priority: "medium",
          type: "bug",
          submitter: {
            id: "user-123",
            username: "testuser",
            displayName: "Test User",
          },
        };

        await expect(
          manager.createUnifiedIssue("non-existent-forum", issueData)
        ).rejects.toThrow("Forum non-existent-forum not found");
      });

      it("should throw error for forum without channel ID", async () => {
        const issueData: Omit<IssueData, "forum"> = {
          title: "Test Issue",
          description: "Test description",
          category: "bug",
          priority: "medium",
          type: "bug",
          submitter: {
            id: "user-123",
            username: "testuser",
            displayName: "Test User",
          },
        };

        await expect(
          manager.createUnifiedIssue("test-forum-2", issueData)
        ).rejects.toThrow("Forum channel not configured");
      });

      it("should throw error indicating need for guild context", async () => {
        const issueData: Omit<IssueData, "forum"> = {
          title: "Test Issue",
          description: "Test description",
          category: "bug",
          priority: "medium",
          type: "bug",
          submitter: {
            id: "user-123",
            username: "testuser",
            displayName: "Test User",
          },
        };

        await expect(
          manager.createUnifiedIssue("test-forum-1", issueData)
        ).rejects.toThrow(
          "createUnifiedIssue requires guild context - use UnifiedIssueManager directly instead"
        );
      });
    });
  });

  describe("Statistics", () => {
    describe("getStatistics", () => {
      it("should return correct forum and team statistics", () => {
        const stats = manager.getStatistics();

        expect(stats.totalForums).toBe(3);
        expect(stats.totalTeams).toBe(2);
        expect(stats.forumsByCategory).toEqual({
          "bug-reports": 1,
          "feature-requests": 1,
          "support": 1,
        });
        expect(stats.forumsByTeam).toEqual({
          "test-team-1": 2,
          "test-team-2": 1,
        });
      });

      it("should return zero statistics for empty manager", () => {
        const emptyManager = new ForumManager();
        (emptyManager as any).forums.clear();
        (emptyManager as any).teams.clear();

        const stats = emptyManager.getStatistics();

        expect(stats.totalForums).toBe(0);
        expect(stats.totalTeams).toBe(0);
        expect(stats.forumsByCategory).toEqual({});
        expect(stats.forumsByTeam).toEqual({});
      });

      it("should handle categories and teams with multiple forums", () => {
        // Add more forums to same category and team
        const additionalForums: ForumConfig[] = [
          {
            id: "extra-bug-forum",
            name: "Extra Bug Forum",
            description: "Another bug forum",
            category: "bug-reports",
            team: "test-team-1",
            priority: 10,
            tags: [],
            permissions: { allowedRoles: [], restrictedToTeam: false },
            autoAssign: [],
            labels: [],
          },
          {
            id: "another-feature-forum",
            name: "Another Feature Forum",
            description: "Another feature forum",
            category: "feature-requests",
            team: "test-team-2",
            priority: 11,
            tags: [],
            permissions: { allowedRoles: [], restrictedToTeam: false },
            autoAssign: [],
            labels: [],
          },
        ];

        additionalForums.forEach(forum => manager.registerForum(forum));

        const stats = manager.getStatistics();

        expect(stats.totalForums).toBe(5);
        expect(stats.forumsByCategory["bug-reports"]).toBe(2);
        expect(stats.forumsByCategory["feature-requests"]).toBe(2);
        expect(stats.forumsByTeam["test-team-1"]).toBe(3);
        expect(stats.forumsByTeam["test-team-2"]).toBe(2);
      });
    });
  });

  describe("Global Instance", () => {
    it("should export a global forumManager instance", () => {
      expect(forumManager).toBeInstanceOf(ForumManager);
    });

    it("should have forums loaded from configuration", () => {
      const forum = forumManager.getForum("test-forum-1");
      expect(forum).toBeDefined();
    });

    it("should have teams loaded from configuration", () => {
      const team = forumManager.getTeam("test-team-1");
      expect(team).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null/undefined inputs gracefully", () => {
      expect(manager.getForum(null as any)).toBeUndefined();
      expect(manager.getForum(undefined as any)).toBeUndefined();
      expect(manager.getTeam(null as any)).toBeUndefined();
      expect(manager.getTeam(undefined as any)).toBeUndefined();
      expect(manager.getForumByChannelId(null as any)).toBeUndefined();
      expect(manager.getForumByChannelId(undefined as any)).toBeUndefined();
    });

    it("should handle forums with empty tag arrays", () => {
      const forumWithoutTags: ForumConfig = {
        id: "no-tags-forum",
        name: "No Tags Forum",
        description: "Forum without tags",
        category: "support",
        team: "test-team-1",
        priority: 5,
        tags: [],
        permissions: { allowedRoles: [], restrictedToTeam: false },
        autoAssign: [],
        labels: [],
      };

      expect(() => manager.registerForum(forumWithoutTags)).not.toThrow();
      expect(manager.getForum("no-tags-forum")).toEqual(forumWithoutTags);
    });

    it("should handle forums with complex permission structures", () => {
      const complexPermissionsForum: ForumConfig = {
        id: "complex-perms-forum",
        name: "Complex Permissions Forum",
        description: "Forum with complex permissions",
        category: "bug-reports",
        team: "test-team-1",
        priority: 5,
        tags: [],
        permissions: {
          allowedRoles: [
            "@everyone",
            "moderator",
            "admin",
            "developer",
            "contributor",
          ],
          restrictedToTeam: true,
        },
        autoAssign: ["team-lead", "senior-dev", "qa-lead"],
        labels: ["complex", "permissions", "restricted"],
      };

      manager.registerForum(complexPermissionsForum);
      const retrievedForum = manager.getForum("complex-perms-forum");

      expect(retrievedForum?.permissions.allowedRoles).toHaveLength(5);
      expect(retrievedForum?.permissions.restrictedToTeam).toBe(true);
      expect(retrievedForum?.autoAssign).toHaveLength(3);
      expect(retrievedForum?.labels).toHaveLength(3);
    });

    it("should handle very large numbers of forums and teams", () => {
      // Add many forums and teams
      for (let i = 0; i < 100; i++) {
        const forum: ForumConfig = {
          id: `bulk-forum-${i}`,
          name: `Bulk Forum ${i}`,
          description: `Bulk forum ${i} description`,
          category: "support",
          team: "test-team-1",
          priority: 1000 + i,
          tags: [],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        };
        manager.registerForum(forum);
      }

      for (let i = 0; i < 50; i++) {
        const team: TeamConfig = {
          id: `bulk-team-${i}`,
          name: `Bulk Team ${i}`,
          description: `Bulk team ${i} description`,
          color: 0x000000,
          emoji: "🔧",
          forums: [],
          members: [],
        };
        manager.registerTeam(team);
      }

      const stats = manager.getStatistics();
      expect(stats.totalForums).toBe(103); // 3 original + 100 bulk
      expect(stats.totalTeams).toBe(52); // 2 original + 50 bulk

      const allForums = manager.getAllForums();
      expect(allForums).toHaveLength(103);

      const allTeams = manager.getAllTeams();
      expect(allTeams).toHaveLength(52);
    });

    it("should handle forums with duplicate priorities correctly", () => {
      const duplicatePriorityForums: ForumConfig[] = [
        {
          id: "dup-priority-1",
          name: "Duplicate Priority 1",
          description: "First forum with duplicate priority",
          category: "bug-reports",
          team: "test-team-1",
          priority: 5,
          tags: [],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        },
        {
          id: "dup-priority-2",
          name: "Duplicate Priority 2",
          description: "Second forum with duplicate priority",
          category: "bug-reports",
          team: "test-team-1",
          priority: 5,
          tags: [],
          permissions: { allowedRoles: [], restrictedToTeam: false },
          autoAssign: [],
          labels: [],
        },
      ];

      duplicatePriorityForums.forEach(forum => manager.registerForum(forum));

      const bugForums = manager.getForumsByCategory("bug-reports");
      expect(bugForums).toHaveLength(3); // 1 original + 2 duplicates

      // Both duplicate priority forums should be included
      const duplicateForums = bugForums.filter(f => f.priority === 5);
      expect(duplicateForums).toHaveLength(2);
    });

    it("should handle concurrent forum registration", () => {
      const forums: ForumConfig[] = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-${i}`,
        name: `Concurrent Forum ${i}`,
        description: `Concurrently registered forum ${i}`,
        category: "support",
        team: "test-team-1",
        priority: i,
        tags: [],
        permissions: { allowedRoles: [], restrictedToTeam: false },
        autoAssign: [],
        labels: [],
      }));

      // Register all forums concurrently
      forums.forEach(forum => manager.registerForum(forum));

      // All should be registered successfully
      forums.forEach(forum => {
        expect(manager.getForum(forum.id)).toEqual(forum);
      });

      expect(manager.getAllForums()).toHaveLength(13); // 3 original + 10 concurrent
    });
  });

  describe("Integration with Configuration Validation", () => {
    it("should handle invalid configurations gracefully", () => {
      (validateConfigurations as vi.Mock).mockReturnValue({
        valid: false,
        errors: [
          "Duplicate forum IDs found: test-duplicate",
          "Forum 'invalid-forum' references non-existent team 'invalid-team'",
          "Team 'invalid-team' references non-existent forum 'invalid-forum'",
        ],
      });

      // Should not throw even with invalid configuration
      expect(() => new ForumManager()).not.toThrow();

      expect(console.warn).toHaveBeenCalledWith(
        "Forum configuration validation failed:",
        expect.any(Array)
      );
    });

    it("should continue operation despite validation warnings", () => {
      (validateConfigurations as vi.Mock).mockReturnValue({
        valid: false,
        errors: ["Minor configuration warning"],
      });

      const managerWithWarnings = new ForumManager();

      // Should still function normally
      expect(managerWithWarnings.getAllForums().length).toBeGreaterThan(0);
      expect(managerWithWarnings.getAllTeams().length).toBeGreaterThan(0);
      expect(managerWithWarnings.getStatistics().totalForums).toBeGreaterThan(0);
    });
  });
});