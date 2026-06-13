/**
 * Mock Integration Tests
 * 
 * These tests verify that all mock libraries work correctly and provide
 * comprehensive coverage for testing scenarios.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  createMockThread, 
  createMockDiscordInteraction,
  createMockGitHubWebhook,
  createMockJiraWebhook,
  waitFor 
} from "../utils/testFactories";

// Import mocks
import discordMocks from "../mocks/discord";
import githubMocks from "../mocks/github";
import jiraMocks from "../mocks/jira";
import { mockStore } from "../mocks/store";
import winstonMock from "../mocks/winston";

describe("Mock Integration Tests", () => {
  beforeEach(() => {
    // Reset store state before each test
    mockStore.reset();
  });

  describe("Discord.js Mock Integration", () => {
    it("should provide all Discord.js classes and constants", () => {
      // Test that all major Discord.js exports are available
      expect(discordMocks.Client).toBeDefined();
      expect(discordMocks.EmbedBuilder).toBeDefined();
      expect(discordMocks.ActionRowBuilder).toBeDefined();
      expect(discordMocks.ButtonBuilder).toBeDefined();
      expect(discordMocks.StringSelectMenuBuilder).toBeDefined();
      expect(discordMocks.ModalBuilder).toBeDefined();
      expect(discordMocks.TextInputBuilder).toBeDefined();
      expect(discordMocks.SlashCommandBuilder).toBeDefined();
      expect(discordMocks.Collection).toBeDefined();
      expect(discordMocks.Message).toBeDefined();
      expect(discordMocks.ThreadChannel).toBeDefined();
      expect(discordMocks.ForumChannel).toBeDefined();
      expect(discordMocks.ChatInputCommandInteraction).toBeDefined();
      expect(discordMocks.ButtonInteraction).toBeDefined();
      expect(discordMocks.ModalSubmitInteraction).toBeDefined();
      expect(discordMocks.MessageFlags).toBeDefined();
      expect(discordMocks.PermissionFlagsBits).toBeDefined();
      expect(discordMocks.InteractionResponseType).toBeDefined();

      // Test constants
      expect(discordMocks.ChannelType.GuildForum).toBe(15);
      expect(discordMocks.ComponentType.Button).toBe(2);
      expect(discordMocks.ButtonStyle.Primary).toBe(1);
      expect(discordMocks.MessageFlags.Ephemeral).toBe(1 << 6);
    });

    it("should create functional Discord client mock", () => {
      const client = new discordMocks.Client();
      
      expect(client.login).toBeDefined();
      expect(client.on).toBeDefined();
      expect(client.guilds).toBeDefined();
      expect(client.channels).toBeDefined();
      expect(client.users).toBeDefined();

      // Test client methods work
      client.setReady();
      expect(client.isReady()).toBe(true);
      expect(client.user).toBeTruthy();
    });

    it("should create functional embed builder", () => {
      const embed = new discordMocks.EmbedBuilder();
      
      const result = embed
        .setTitle("Test Title")
        .setDescription("Test Description")
        .setColor(0xFF0000)
        .addFields({ name: "Field", value: "Value" });

      expect(result).toBe(embed); // Should return this
      
      const json = embed.toJSON();
      expect(json.title).toBe("Test Title");
      expect(json.description).toBe("Test Description");
      expect(json.color).toBe(0xFF0000);
      expect(json.fields).toHaveLength(1);
    });

    it("should create functional button builder", () => {
      const button = new discordMocks.ButtonBuilder();
      
      const result = button
        .setCustomId("test_button")
        .setLabel("Test Button")
        .setStyle(discordMocks.ButtonStyle.Primary);

      expect(result).toBe(button);
      
      const json = button.toJSON();
      expect(json.custom_id).toBe("test_button");
      expect(json.label).toBe("Test Button");
      expect(json.style).toBe(1);
    });

    it("should create functional collections", () => {
      const collection = new discordMocks.Collection();
      
      collection.set("key1", "value1");
      collection.set("key2", "value2");

      expect(collection.size).toBe(2);
      expect(collection.get("key1")).toBe("value1");
      expect(collection.has("key2")).toBe(true);

      const mapped = collection.map((value, key) => `${key}:${value}`);
      expect(mapped).toEqual(["key1:value1", "key2:value2"]);

      const filtered = collection.filter(value => value === "value1");
      expect(filtered.size).toBe(1);
      expect(filtered.get("key1")).toBe("value1");
    });

    it("should create functional interaction mocks", () => {
      // Chat Input Command Interaction
      const commandInteraction = new discordMocks.ChatInputCommandInteraction({
        commandName: "test",
        options: {
          getString: vi.fn().mockReturnValue("test_value")
        }
      });

      expect(commandInteraction.isChatInputCommand()).toBe(true);
      expect(commandInteraction.isButton()).toBe(false);
      expect(commandInteraction.commandName).toBe("test");
      expect(commandInteraction.options.getString("param")).toBe("test_value");

      // Button Interaction
      const buttonInteraction = new discordMocks.ButtonInteraction({
        customId: "test_button"
      });

      expect(buttonInteraction.isButton()).toBe(true);
      expect(buttonInteraction.isChatInputCommand()).toBe(false);
      expect(buttonInteraction.customId).toBe("test_button");

      // Modal Submit Interaction
      const modalInteraction = new discordMocks.ModalSubmitInteraction({
        customId: "test_modal",
        fields: { input1: "test_input" }
      });

      expect(modalInteraction.isModalSubmit()).toBe(true);
      expect(modalInteraction.customId).toBe("test_modal");
      expect(modalInteraction.fields.getTextInputValue("input1")).toBe("test_input");
    });

    it("should handle thread channel operations", () => {
      const thread = new discordMocks.ThreadChannel({
        id: "thread_123",
        name: "Test Thread",
        appliedTags: ["tag1", "tag2"]
      });

      expect(thread.id).toBe("thread_123");
      expect(thread.name).toBe("Test Thread");
      expect(thread.appliedTags).toEqual(["tag1", "tag2"]);
      expect(thread.send).toBeDefined();
      expect(thread.setArchived).toBeDefined();
      expect(thread.setLocked).toBeDefined();
    });

    it("should handle forum channel operations", () => {
      const forum = new discordMocks.ForumChannel({
        id: "forum_123",
        name: "Test Forum"
      });

      expect(forum.id).toBe("forum_123");
      expect(forum.name).toBe("Test Forum");
      expect(forum.type).toBe(15); // GuildForum
      expect(forum.availableTags).toBeDefined();
      expect(forum.threads).toBeDefined();
    });
  });

  describe("Store Mock Integration", () => {
    it("should provide all store methods", () => {
      expect(mockStore.addThread).toBeDefined();
      expect(mockStore.deleteThread).toBeDefined();
      expect(mockStore.findThread).toBeDefined();
      expect(mockStore.getAllThreads).toBeDefined();
      expect(mockStore.clearThreads).toBeDefined();
      expect(mockStore.setAvailableTags).toBeDefined();
      expect(mockStore.getAvailableTags).toBeDefined();
      expect(mockStore.setJiraLink).toBeDefined();
      expect(mockStore.getJiraKey).toBeDefined();
      expect(mockStore.removeJiraLink).toBeDefined();
      expect(mockStore.restoreJiraLinks).toBeDefined();
      expect(mockStore.getAllJiraLinks).toBeDefined();
      expect(mockStore.validateIntegrity).toBeDefined();
      expect(mockStore.getStats).toBeDefined();
    });

    it("should handle thread operations correctly", () => {
      const thread = createMockThread({
        id: "thread_123",
        title: "Test Thread"
      });

      // Add thread
      mockStore.addThread(thread);
      expect(mockStore.addThread).toHaveBeenCalledWith(thread);

      // Find thread
      mockStore.findThread.mockReturnValue(thread);
      const foundThread = mockStore.findThread("thread_123");
      expect(foundThread).toEqual(thread);

      // Get all threads
      mockStore.getAllThreads.mockReturnValue([thread]);
      const allThreads = mockStore.getAllThreads();
      expect(allThreads).toHaveLength(1);
      expect(allThreads[0]).toEqual(thread);

      // Delete thread
      mockStore.deleteThread.mockReturnValue([]);
      const remainingThreads = mockStore.deleteThread("thread_123");
      expect(remainingThreads).toHaveLength(0);
    });

    it("should handle Jira link operations", () => {
      const threadId = "thread_123";
      const jiraKey = "TEST-1";

      // Set Jira link
      mockStore.setJiraLink(threadId, jiraKey);
      expect(mockStore.setJiraLink).toHaveBeenCalledWith(threadId, jiraKey);

      // Get Jira key
      mockStore.getJiraKey.mockReturnValue(jiraKey);
      const retrievedKey = mockStore.getJiraKey(threadId);
      expect(retrievedKey).toBe(jiraKey);

      // Remove Jira link
      mockStore.removeJiraLink(threadId);
      expect(mockStore.removeJiraLink).toHaveBeenCalledWith(threadId);

      // Restore Jira links
      mockStore.restoreJiraLinks();
      expect(mockStore.restoreJiraLinks).toHaveBeenCalled();
    });

    it("should validate store integrity", () => {
      mockStore.validateIntegrity.mockReturnValue({
        isValid: true,
        issues: []
      });

      const result = mockStore.validateIntegrity();
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("GitHub Mock Integration", () => {
    it("should provide Octokit mock with all APIs", () => {
      const octokit = new githubMocks.MockOctokit();

      expect(octokit.repos).toBeDefined();
      expect(octokit.issues).toBeDefined();
      expect(octokit.pulls).toBeDefined();
      expect(octokit.users).toBeDefined();
      expect(octokit.search).toBeDefined();
      expect(octokit.request).toBeDefined();
      expect(octokit.graphql).toBeDefined();

      // Test repository operations
      expect(octokit.repos.get).toBeDefined();
      expect(octokit.repos.listForUser).toBeDefined();
      expect(octokit.repos.create).toBeDefined();

      // Test issue operations
      expect(octokit.issues.get).toBeDefined();
      expect(octokit.issues.list).toBeDefined();
      expect(octokit.issues.create).toBeDefined();
      expect(octokit.issues.update).toBeDefined();
      expect(octokit.issues.addAssignees).toBeDefined();
    });

    it("should create realistic mock data", () => {
      const issue = githubMocks.createMockIssue({
        title: "Custom Issue Title",
        number: 42
      });

      expect(issue.title).toBe("Custom Issue Title");
      expect(issue.number).toBe(42);
      expect(issue.html_url).toBeDefined();
      expect(issue.user).toBeDefined();
      expect(issue.labels).toBeDefined();
      expect(issue.reactions).toBeDefined();

      const repo = githubMocks.createMockRepository({
        name: "custom-repo",
        description: "Custom description"
      });

      expect(repo.name).toBe("custom-repo");
      expect(repo.description).toBe("Custom description");
      expect(repo.owner).toBeDefined();
      expect(repo.html_url).toBeDefined();
    });

    it("should handle webhook payloads", () => {
      const webhook = githubMocks.createGitHubWebhookPayload("opened", {
        issue: { title: "Webhook Issue" },
        repository: { name: "webhook-repo" }
      });

      expect(webhook.action).toBe("opened");
      expect(webhook.issue.title).toBe("Webhook Issue");
      expect(webhook.repository.name).toBe("webhook-repo");
      expect(webhook.sender).toBeDefined();
    });
  });

  describe("Jira Mock Integration", () => {
    it("should provide Version3Client mock with all APIs", () => {
      const jira = new jiraMocks.MockVersion3Client({
        host: "https://test.atlassian.net",
        authentication: {
          basic: {
            email: "test@example.com",
            apiToken: "test_token"
          }
        }
      });

      expect(jira.issues).toBeDefined();
      expect(jira.projects).toBeDefined();
      expect(jira.users).toBeDefined();
      expect(jira.issueTypes).toBeDefined();
      expect(jira.priorities).toBeDefined();
      expect(jira.statuses).toBeDefined();
      expect(jira.comments).toBeDefined();
      expect(jira.search).toBeDefined();

      // Test issue operations
      expect(jira.issues.getIssue).toBeDefined();
      expect(jira.issues.createIssue).toBeDefined();
      expect(jira.issues.updateIssue).toBeDefined();
      expect(jira.issues.getTransitions).toBeDefined();
      expect(jira.issues.doTransition).toBeDefined();

      // Test project operations
      expect(jira.projects.getAllProjects).toBeDefined();
      expect(jira.projects.getProject).toBeDefined();
      expect(jira.projects.getProjectComponents).toBeDefined();
    });

    it("should create realistic Jira mock data", () => {
      const issue = jiraMocks.createMockJiraIssue({
        key: "CUSTOM-123",
        fields: {
          summary: "Custom Jira Issue",
          priority: { name: "High" }
        }
      });

      expect(issue.key).toBe("CUSTOM-123");
      expect(issue.fields.summary).toBe("Custom Jira Issue");
      expect(issue.fields.priority.name).toBe("High");
      expect(issue.fields.status).toBeDefined();
      expect(issue.fields.issueType).toBeDefined();

      const project = jiraMocks.createMockJiraProject({
        key: "CUSTOM",
        name: "Custom Project"
      });

      expect(project.key).toBe("CUSTOM");
      expect(project.name).toBe("Custom Project");
      expect(project.issueTypes).toBeDefined();
      expect(project.components).toBeDefined();
    });

    it("should handle Jira webhook payloads", () => {
      const webhook = jiraMocks.createJiraWebhookPayload("jira:issue_updated", {
        issue: {
          key: "WEBHOOK-1",
          fields: { summary: "Webhook Issue" }
        }
      });

      expect(webhook.webhookEvent).toBe("jira:issue_updated");
      expect(webhook.issue.key).toBe("WEBHOOK-1");
      expect(webhook.issue.fields.summary).toBe("Webhook Issue");
      expect(webhook.user).toBeDefined();
      expect(webhook.changelog).toBeDefined();
    });
  });

  describe("Winston Mock Integration", () => {
    it("should provide logger mock with all methods", () => {
      const logger = winstonMock.createLogger({
        level: "debug",
        format: winstonMock.format.combine(
          winstonMock.format.timestamp(),
          winstonMock.format.json()
        )
      });

      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.verbose).toBeDefined();
      expect(logger.silly).toBeDefined();

      // Test logger configuration
      expect(logger.level).toBe("debug");
      expect(logger.format).toBeDefined();

      // Test logging methods return logger (chainable)
      const result = logger.info("Test message");
      expect(result).toBe(logger);
    });

    it("should provide format functions", () => {
      const timestamp = winstonMock.format.timestamp();
      const json = winstonMock.format.json();
      const colorize = winstonMock.format.colorize({ all: true });
      const printf = winstonMock.format.printf((info) => `${info.level}: ${info.message}`);

      expect(timestamp).toBeDefined();
      expect(json).toBeDefined();
      expect(colorize).toBeDefined();
      expect(printf).toBeDefined();

      // Test format combination
      const combined = winstonMock.format.combine(timestamp, json);
      expect(combined).toBeDefined();
    });

    it("should provide transport mocks", () => {
      const consoleTransport = new winstonMock.transports.Console({
        level: "info",
        format: winstonMock.format.simple()
      });

      const fileTransport = new winstonMock.transports.File({
        filename: "test.log",
        level: "error"
      });

      expect(consoleTransport.name).toBe("console");
      expect(consoleTransport.level).toBe("info");
      expect(fileTransport.name).toBe("file");
      expect(fileTransport.filename).toBe("test.log");
    });
  });

  describe("Test Factory Integration", () => {
    it("should create mock threads with defaults and overrides", () => {
      const defaultThread = createMockThread();
      expect(defaultThread.id).toBeDefined();
      expect(defaultThread.title).toBe("Test Thread Title");
      expect(defaultThread.appliedTags).toEqual([]);
      expect(defaultThread.comments).toEqual([]);

      const customThread = createMockThread({
        title: "Custom Thread",
        appliedTags: ["bug", "urgent"],
        number: 42
      });
      expect(customThread.title).toBe("Custom Thread");
      expect(customThread.appliedTags).toEqual(["bug", "urgent"]);
      expect(customThread.number).toBe(42);
    });

    it("should create Discord interactions for different types", () => {
      const commandInteraction = createMockDiscordInteraction("command", {
        commandName: "test-command"
      });
      expect(commandInteraction.isCommand()).toBe(true);
      expect(commandInteraction.isChatInputCommand()).toBe(true);
      expect(commandInteraction.isButton()).toBe(false);

      const buttonInteraction = createMockDiscordInteraction("button", {
        customId: "test-button"
      });
      expect(buttonInteraction.isButton()).toBe(true);
      expect(buttonInteraction.isCommand()).toBe(false);
      expect(buttonInteraction.customId).toBe("test-button");

      const modalInteraction = createMockDiscordInteraction("modal", {
        customId: "test-modal",
        fields: { input1: "test-value" }
      });
      expect(modalInteraction.isModalSubmit()).toBe(true);
      expect(modalInteraction.fields.getTextInputValue("input1")).toBe("test-value");
    });

    it("should create webhook payloads for GitHub and Jira", () => {
      const githubWebhook = createMockGitHubWebhook("closed", {
        issue: { state: "closed" }
      });
      expect(githubWebhook.action).toBe("closed");
      expect(githubWebhook.issue.state).toBe("closed");

      const jiraWebhook = createMockJiraWebhook("jira:issue_created", {
        issue: { key: "NEW-1" }
      });
      expect(jiraWebhook.webhookEvent).toBe("jira:issue_created");
      expect(jiraWebhook.issue.key).toBe("NEW-1");
    });

    it("should provide utility functions", async () => {
      let counter = 0;
      const condition = () => {
        counter++;
        return counter >= 3;
      };

      await waitFor(condition, { timeout: 1000, interval: 50 });
      expect(counter).toBe(3);

      // Test timeout
      await expect(
        waitFor(() => false, { timeout: 100, interval: 10 })
      ).rejects.toThrow("waitFor condition was not met within 100ms");
    });
  });

  describe("End-to-End Mock Integration", () => {
    it("should handle complete Discord interaction flow", async () => {
      // Setup
      const thread = createMockThread({ id: "thread_123", title: "Test Thread" });
      mockStore.addThread(thread);
      mockStore.findThread.mockReturnValue(thread);

      const interaction = createMockDiscordInteraction("button", {
        customId: "resolve_thread_123",
        channel: { id: "thread_123" }
      });

      // Simulate interaction handling
      const threadId = interaction.customId.split("_")[1];
      const foundThread = mockStore.findThread(threadId);
      
      expect(foundThread).toEqual(thread);
      expect(interaction.customId).toBe("resolve_thread_123");

      // Test interaction response
      await interaction.reply({ content: "Thread resolved!" });
      expect(interaction.reply).toHaveBeenCalledWith({ content: "Thread resolved!" });
      expect(interaction.replied).toBe(true);
    });

    it("should handle GitHub webhook to Discord flow", async () => {
      // Setup GitHub webhook
      const githubWebhook = createMockGitHubWebhook("opened", {
        issue: { number: 123, title: "New GitHub Issue" }
      });

      // Setup Discord thread creation
      const discordThread = new discordMocks.ThreadChannel({
        id: "thread_456",
        name: "GitHub Issue #123"
      });

      // Simulate webhook processing
      const issueNumber = githubWebhook.issue.number;
      const issueTitle = githubWebhook.issue.title;

      expect(issueNumber).toBe(123);
      expect(issueTitle).toBe("New GitHub Issue");

      // Create thread in store
      const newThread = createMockThread({
        id: discordThread.id,
        title: `GitHub Issue #${issueNumber}`,
        number: issueNumber,
        body: issueTitle
      });

      mockStore.addThread(newThread);
      expect(mockStore.addThread).toHaveBeenCalledWith(newThread);
    });

    it("should handle Jira integration flow", async () => {
      // Setup Jira client
      const jira = new jiraMocks.MockVersion3Client({
        host: "https://test.atlassian.net",
        authentication: {
          basic: { email: "test@example.com", apiToken: "token" }
        }
      });

      // Setup issue creation
      jira.issues.createIssue.mockResolvedValue({
        id: "10001",
        key: "TEST-1",
        self: "https://test.atlassian.net/rest/api/3/issue/10001"
      });

      // Test issue creation
      const issueData = {
        fields: {
          project: { key: "TEST" },
          summary: "Test Issue",
          issuetype: { id: "10001" }
        }
      };

      const createdIssue = await jira.issues.createIssue(issueData);
      expect(createdIssue.key).toBe("TEST-1");
      expect(jira.issues.createIssue).toHaveBeenCalledWith(issueData);

      // Link to Discord thread
      const threadId = "thread_789";
      mockStore.setJiraLink(threadId, createdIssue.key);
      mockStore.getJiraKey.mockReturnValue(createdIssue.key);

      const linkedJiraKey = mockStore.getJiraKey(threadId);
      expect(linkedJiraKey).toBe("TEST-1");
    });

    it("should handle error scenarios with comprehensive logging", () => {
      const logger = winstonMock.createLogger();
      
      try {
        // Simulate an error scenario
        throw new Error("Test error");
      } catch (error) {
        logger.error("Operation failed", { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined 
        });
        
        expect(logger.error).toHaveBeenCalledWith("Operation failed", {
          error: "Test error",
          stack: expect.any(String)
        });
      }
    });
  });
});