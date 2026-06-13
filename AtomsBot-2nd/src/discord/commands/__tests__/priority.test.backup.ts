import {
  ChatInputCommandInteraction,
  ThreadChannel,
} from "discord.js";
import { vi, beforeEach, describe, it, expect } from "vitest";

// Mock all dependencies
vi.mock("../../../store", () => ({
  store: {
    threads: [],
  },
}));

vi.mock("../../../github/githubActions", () => ({
  octokit: {
    rest: {
      issues: {
        get: vi.fn(),
        update: vi.fn(),
        addLabels: vi.fn(),
      },
    },
  },
  repoCredentials: {
    owner: "testowner",
    repo: "testrepo",
  },
  getRepoCredentialsForThread: vi.fn().mockReturnValue({
    owner: "testowner",
    repo: "testrepo",
  }),
}));

vi.mock("../../../jira/jiraClient", () => ({
  jiraService: {
    updateIssuePriority: vi.fn(),
    updateIssue: vi.fn(),
  },
}));

vi.mock("../../../logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks are set up
import { store } from "../../../store";
import { octokit } from "../../../github/githubActions";
import { logger } from "../../../logger";
import { priorityCommand } from "../priority";

describe("Priority Command", () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>;
  let mockChannel: Partial<ThreadChannel>;
  let mockThread: any;

  beforeEach(() => {
    // Setup mock channel
    mockChannel = {
      id: "thread123",
      name: "Test Thread",
    };

    // Setup mock thread
    mockThread = {
      id: "thread123",
      title: "Test Thread",
      number: 456,
      appliedTags: [],
      archived: false,
      locked: false,
      comments: [],
    };

    // Setup mock interaction
    mockInteraction = {
      channel: mockChannel as ThreadChannel,
      channelId: "thread123",
      options: {
        getString: vi.fn(),
      },
      reply: vi.fn(),
      followUp: vi.fn(),
      user: {
        tag: "testuser#1234",
      },
    };

    // Reset store threads
    store.threads = [];
    
    // Reset specific mock functions
    vi.mocked(octokit.rest.issues.get).mockReset();
    vi.mocked(octokit.rest.issues.update).mockReset();
    vi.mocked(octokit.rest.issues.addLabels).mockReset();
    vi.mocked(logger.info).mockReset();
    vi.mocked(logger.error).mockReset();
  });

  describe("Command Structure", () => {
    it("should have correct command structure", () => {
      expect(priorityCommand.data.name).toBe("priority");
      expect(priorityCommand.data.description).toBe("Set the priority of a GitHub issue");
    });

    it("should have priority level options", () => {
      const options = priorityCommand.data.options;
      expect(options).toHaveLength(1);
      
      const levelOption = options?.[0];
      expect(levelOption?.name).toBe("level");
      expect(levelOption?.required).toBe(true);
      
      // Check that choices are properly configured
      const choices = (levelOption as any)?.choices;
      expect(choices).toBeDefined();
      expect(choices).toHaveLength(5);
      
      const choiceValues = choices?.map((choice: any) => choice.value);
      expect(choiceValues).toContain("critical");
      expect(choiceValues).toContain("high");
      expect(choiceValues).toContain("medium");
      expect(choiceValues).toContain("low");
      expect(choiceValues).toContain("none");
    });

    it("should have proper emoji and text for choices", () => {
      const options = priorityCommand.data.options;
      const levelOption = options?.[0];
      const choices = (levelOption as any)?.choices;
      
      const criticalChoice = choices?.find((c: any) => c.value === "critical");
      expect(criticalChoice?.name).toBe("🔴 Critical");
      
      const highChoice = choices?.find((c: any) => c.value === "high");
      expect(highChoice?.name).toBe("🟠 High");
      
      const mediumChoice = choices?.find((c: any) => c.value === "medium");
      expect(mediumChoice?.name).toBe("🟡 Medium");
      
      const lowChoice = choices?.find((c: any) => c.value === "low");
      expect(lowChoice?.name).toBe("🟢 Low");
      
      const noneChoice = choices?.find((c: any) => c.value === "none");
      expect(noneChoice?.name).toBe("⚪ None");
    });
  });

  describe("Channel Validation", () => {
    it("should reject null channels", async () => {
      mockInteraction.channel = null;

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ This command can only be used in forum threads.",
        ephemeral: true,
      });
    });

    it("should reject non-thread channels", async () => {
      mockInteraction.channel = { id: "channel123" } as any; // Not a ThreadChannel

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ This command can only be used in forum threads.",
        ephemeral: true,
      });
    });
  });

  describe("Thread Validation", () => {
    it("should reject threads not in store", async () => {
      store.threads = []; // Empty store

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ This thread is not linked to a GitHub issue.",
        ephemeral: true,
      });
    });

    it("should reject threads without GitHub issue number", async () => {
      mockThread.number = undefined;
      store.threads.push(mockThread);

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ This thread is not linked to a GitHub issue.",
        ephemeral: true,
      });
    });

    it("should reject threads with null GitHub issue number", async () => {
      mockThread.number = null;
      store.threads.push(mockThread);

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ This thread is not linked to a GitHub issue.",
        ephemeral: true,
      });
    });

    it("should reject threads with zero GitHub issue number", async () => {
      mockThread.number = 0;
      store.threads.push(mockThread);

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ This thread is not linked to a GitHub issue.",
        ephemeral: true,
      });
    });
  });

  describe("Priority Setting", () => {
    beforeEach(() => {
      store.threads.push(mockThread);
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("high");
      
      vi.mocked(octokit.rest.issues.get).mockResolvedValue({
        data: {
          labels: [
            { name: "bug" },
            { name: "priority:low" },
            { name: "enhancement" },
          ],
        },
      });
    });

    it("should set high priority", async () => {
      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.get).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
      });

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "enhancement", "priority:high"],
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              color: 0xff8800, // High priority color
              title: "Priority Updated",
              description: "Priority set to 🟠 **HIGH**",
            }),
          }),
        ]),
      });

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "🏷️ **Priority updated:** 🟠 **HIGH**",
      });

      expect(logger.info).toHaveBeenCalledWith(
        "Issue #456 priority set to high by testuser#1234"
      );
    });

    it("should set critical priority", async () => {
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("critical");

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "enhancement", "priority:critical"],
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              color: 0xff0000, // Critical priority color
              description: "Priority set to 🔴 **CRITICAL**",
            }),
          }),
        ]),
      });
    });

    it("should set medium priority", async () => {
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("medium");

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "enhancement", "priority:medium"],
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              color: 0xffff00, // Medium priority color
              description: "Priority set to 🟡 **MEDIUM**",
            }),
          }),
        ]),
      });
    });

    it("should set low priority", async () => {
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("low");

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "enhancement", "priority:low"],
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              color: 0x00ff00, // Low priority color
              description: "Priority set to 🟢 **LOW**",
            }),
          }),
        ]),
      });
    });

    it("should remove priority (set to none)", async () => {
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("none");

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "enhancement"], // Priority label removed
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              color: 0x888888, // None priority color
              description: "Priority set to ⚪ **NONE**",
            }),
          }),
        ]),
      });
    });
  });

  describe("Label Management", () => {
    beforeEach(() => {
      store.threads.push(mockThread);
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("high");
    });

    it("should remove various priority label formats", async () => {
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: {
          labels: [
            { name: "bug" },
            { name: "critical" }, // Should be removed
            { name: "priority:low" }, // Should be removed
            { name: "priority:medium" }, // Should be removed
            { name: "high" }, // Should be removed
            { name: "enhancement" },
            { name: "PRIORITY:CRITICAL" }, // Should be removed (case insensitive)
          ],
        },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "enhancement", "priority:high"],
      });
    });

    it("should handle string labels", async () => {
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: {
          labels: ["bug", "priority:low", "enhancement"],
        },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "enhancement", "priority:high"],
      });
    });

    it("should handle mixed label formats", async () => {
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: {
          labels: [
            "bug",
            { name: "priority:medium" },
            { name: "help wanted" },
            "documentation",
          ],
        },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "help wanted", "documentation", "priority:high"],
      });
    });

    it("should handle labels with null or undefined names", async () => {
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: {
          labels: [
            { name: "bug" },
            { name: null }, // Should be filtered out
            { name: undefined }, // Should be filtered out
            { name: "priority:low" },
            "", // Empty string should be filtered out
          ],
        },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["bug", "priority:high"],
      });
    });

    it("should preserve non-priority labels", async () => {
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: {
          labels: [
            { name: "bug" },
            { name: "help wanted" },
            { name: "good first issue" },
            { name: "documentation" },
            { name: "enhancement" },
            { name: "priority:low" }, // Only this should be removed
          ],
        },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: [
          "bug",
          "help wanted",
          "good first issue",
          "documentation",
          "enhancement",
          "priority:high",
        ],
      });
    });
  });

describe("Error Handling", () => {
    beforeEach(() => {
      // Ensure thread is linked and a default option is present so we hit error paths
      store.threads.push(mockThread);
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("high");
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({ data: { labels: [] } });
    });

    it("should handle GitHub API get errors", async () => {
      (octokit.rest.issues.get as vi.Mock).mockRejectedValue(
        new Error("Issue not found")
      );

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ Failed to update priority. Please check permissions and try again.",
        ephemeral: true,
      });

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update priority: Error: Issue not found"
      );
    });

    it("should handle GitHub API update errors", async () => {
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: { labels: [] },
      });
      (octokit.rest.issues.update as vi.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ Failed to update priority. Please check permissions and try again.",
        ephemeral: true,
      });

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update priority: Error: Update failed"
      );
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Forbidden");
      (permissionError as any).status = 403;
      (octokit.rest.issues.get as vi.Mock).mockRejectedValue(permissionError);

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ Failed to update priority. Please check permissions and try again.",
        ephemeral: true,
      });
    });

    it("should handle rate limiting", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as any).status = 429;
      (octokit.rest.issues.update as vi.Mock).mockRejectedValue(rateLimitError);

      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: { labels: [] },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ Failed to update priority. Please check permissions and try again.",
        ephemeral: true,
      });
    });

    it("should handle network errors", async () => {
      (octokit.rest.issues.get as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update priority: Error: Network error"
      );
    });

    it("should handle malformed API responses", async () => {
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: {
          labels: null, // Malformed response
        },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ Failed to update priority. Please check permissions and try again.",
        ephemeral: true,
      });
    });
  });

  describe("Embed Generation", () => {
    beforeEach(() => {
      store.threads.push(mockThread);
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: { labels: [] },
      });
    });

    it("should create proper embed for critical priority", async () => {
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("critical");

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      const embedCall = (mockInteraction.reply as vi.Mock).mock.calls[0][0];
      const embed = embedCall.embeds[0];

      expect(embed.data.color).toBe(0xff0000);
      expect(embed.data.title).toBe("Priority Updated");
      expect(embed.data.description).toBe("Priority set to 🔴 **CRITICAL**");
      expect(embed.data.fields).toHaveLength(1);
      expect(embed.data.fields[0].name).toBe("Issue");
      expect(embed.data.fields[0].value).toBe(
        "[#456](https://github.com/testowner/testrepo/issues/456)"
      );
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should include correct GitHub link in embed", async () => {
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("medium");

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      const embedCall = (mockInteraction.reply as vi.Mock).mock.calls[0][0];
      const embed = embedCall.embeds[0];

      expect(embed.data.fields[0].value).toBe(
        "[#456](https://github.com/testowner/testrepo/issues/456)"
      );
    });

    it("should use correct colors for each priority", async () => {
      const priorities = [
        { level: "critical", color: 0xff0000 },
        { level: "high", color: 0xff8800 },
        { level: "medium", color: 0xffff00 },
        { level: "low", color: 0x00ff00 },
        { level: "none", color: 0x888888 },
      ];

      for (const { level, color } of priorities) {
        vi.clearAllMocks();
        (mockInteraction.options!.getString as vi.Mock).mockReturnValue(level);

        await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

        const embedCall = (mockInteraction.reply as vi.Mock).mock.calls[0][0];
        const embed = embedCall.embeds[0];

        expect(embed.data.color).toBe(color);
      }
    });
  });

  describe("Follow-up Messages", () => {
    beforeEach(() => {
      store.threads.push(mockThread);
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: { labels: [] },
      });
    });

    it("should send follow-up message with correct format", async () => {
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("high");

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "🏷️ **Priority updated:** 🟠 **HIGH**",
      });
    });

    it("should send correct follow-up for each priority level", async () => {
      const priorities = [
        { level: "critical", emoji: "🔴", text: "CRITICAL" },
        { level: "high", emoji: "🟠", text: "HIGH" },
        { level: "medium", emoji: "🟡", text: "MEDIUM" },
        { level: "low", emoji: "🟢", text: "LOW" },
        { level: "none", emoji: "⚪", text: "NONE" },
      ];

      for (const { level, emoji, text } of priorities) {
        vi.clearAllMocks();
        (mockInteraction.options!.getString as vi.Mock).mockReturnValue(level);

        await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
          content: `🏷️ **Priority updated:** ${emoji} **${text}**`,
        });
      }
    });
  });

  describe("Integration and Edge Cases", () => {
    it("should handle thread with negative issue number", async () => {
      mockThread.number = -1;
      store.threads.push(mockThread);

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ This thread is not linked to a GitHub issue.",
        ephemeral: true,
      });
    });

    it("should handle concurrent priority updates", async () => {
      const thread1 = { ...mockThread, id: "thread1", number: 100 };
      const thread2 = { ...mockThread, id: "thread2", number: 200 };
      store.threads.push(thread1, thread2);

      const interaction1 = {
        ...mockInteraction,
        channel: { id: "thread1" },
        options: { getString: vi.fn().mockReturnValue("high") },
        reply: vi.fn(),
        followUp: vi.fn(),
      };

      const interaction2 = {
        ...mockInteraction,
        channel: { id: "thread2" },
        options: { getString: vi.fn().mockReturnValue("critical") },
        reply: vi.fn(),
        followUp: vi.fn(),
      };

      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: { labels: [] },
      });

      await Promise.all([
        priorityCommand.execute(interaction1 as ChatInputCommandInteraction),
        priorityCommand.execute(interaction2 as ChatInputCommandInteraction),
      ]);

      expect(octokit.rest.issues.update).toHaveBeenCalledTimes(2);
      expect(interaction1.reply).toHaveBeenCalled();
      expect(interaction2.reply).toHaveBeenCalled();
    });

    it("should maintain thread consistency during errors", async () => {
      const originalThread = { ...mockThread };
      store.threads.push(mockThread);

      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("high");
      (octokit.rest.issues.get as vi.Mock).mockRejectedValue(
        new Error("API Error")
      );

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      // Thread should remain unchanged
      expect(mockThread).toEqual(originalThread);
    });

    it("should handle very long thread titles in embed", async () => {
      mockThread.title = "A".repeat(300); // Very long title
      store.threads.push(mockThread);

      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("high");
      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: { labels: [] },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should handle empty labels array", async () => {
      store.threads.push(mockThread);
      (mockInteraction.options!.getString as vi.Mock).mockReturnValue("high");

      (octokit.rest.issues.get as vi.Mock).mockResolvedValue({
        data: { labels: [] },
      });

      await priorityCommand.execute(mockInteraction as ChatInputCommandInteraction);

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        issue_number: 456,
        labels: ["priority:high"],
      });
    });
  });
});
