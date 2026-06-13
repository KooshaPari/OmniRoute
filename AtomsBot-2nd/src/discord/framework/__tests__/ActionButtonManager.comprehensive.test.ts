import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ButtonInteraction,
  User,
  Guild,
  TextChannel,
  Message,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
  InteractionResponse,
} from "discord.js";

// Mock dependencies
vi.mock("../../../cache/redis");
vi.mock("../../embeds");

// Import after mocking
import { ActionButtonManager } from "../ActionButtonManager";
import { cacheService } from "../../../cache/redis";
import { createErrorEmbed, createSuccessEmbed } from "../../embeds";

describe("ActionButtonManager - Comprehensive Tests", () => {
  let manager: ActionButtonManager;
  let mockUser: Partial<User>;
  let mockGuild: Partial<Guild>;
  let mockChannel: Partial<TextChannel>;
  let mockMessage: Partial<Message>;
  let mockInteraction: Partial<ButtonInteraction>;
  let mockInteractionResponse: Partial<InteractionResponse>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Discord objects
    mockUser = {
      id: "user123",
      username: "testuser",
      displayName: "Test User",
      bot: false,
    };

    mockChannel = {
      id: "channel123",
      name: "test-channel",
      send: vi.fn().mockResolvedValue({}),
    };

    mockGuild = {
      id: "guild123",
      name: "Test Guild",
      channels: {
        cache: new Map(),
        fetch: vi.fn().mockResolvedValue(mockChannel),
      } as any,
      members: {
        fetch: vi.fn().mockResolvedValue({ user: mockUser }),
      } as any,
    };

    mockMessage = {
      id: "message123",
      content: "Test message",
      author: mockUser as User,
      channel: mockChannel as TextChannel,
      edit: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({}),
    };

    mockInteractionResponse = {
      id: "response123",
    };

    mockInteraction = {
      id: "interaction123",
      user: mockUser as User,
      guild: mockGuild as Guild,
      channel: mockChannel as TextChannel,
      message: mockMessage as Message,
      customId: "test_button",
      componentType: ComponentType.Button,
      reply: vi.fn().mockResolvedValue(mockInteractionResponse),
      deferReply: vi.fn().mockResolvedValue(mockInteractionResponse),
      editReply: vi.fn().mockResolvedValue({}),
      followUp: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      deferUpdate: vi.fn().mockResolvedValue({}),
      showModal: vi.fn().mockResolvedValue({}),
      isRepliable: () => true,
      replied: false,
      deferred: false,
      ephemeral: false,
    };

    // Mock cache service
    (cacheService.set as any) = vi.fn().mockResolvedValue(true);
    (cacheService.get as any) = vi.fn().mockResolvedValue(null);
    (cacheService.del as any) = vi.fn().mockResolvedValue(true);
    (cacheService.exists as any) = vi.fn().mockResolvedValue(false);
    (cacheService.checkRateLimit as any) = vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 10,
    });

    // Mock embed creators
    (createErrorEmbed as any) = vi.fn().mockReturnValue({
      setTitle: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
    });
    (createSuccessEmbed as any) = vi.fn().mockReturnValue({
      setTitle: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
    });

    // Create manager instance
    manager = new ActionButtonManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with empty handlers map", () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(ActionButtonManager);
    });

    it("should initialize with default configuration", () => {
      const config = (manager as any).config;
      expect(config).toBeDefined();
      expect(config.maxHandlers).toBeGreaterThan(0);
      expect(config.defaultTimeout).toBeGreaterThan(0);
    });

    it("should allow custom configuration", () => {
      const customManager = new ActionButtonManager({
        maxHandlers: 500,
        defaultTimeout: 120000,
        enableLogging: false,
      });

      const config = (customManager as any).config;
      expect(config.maxHandlers).toBe(500);
      expect(config.defaultTimeout).toBe(120000);
      expect(config.enableLogging).toBe(false);
    });
  });

  describe("Handler Registration", () => {
    it("should register button handler successfully", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const result = await manager.registerHandler("test_button", handler);

      expect(result.success).toBe(true);
      expect(result.handlerId).toBe("test_button");
    });

    it("should register handler with metadata", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const metadata = {
        description: "Test button handler",
        category: "testing",
        permissions: ["MANAGE_MESSAGES"],
      };

      const result = await manager.registerHandler("test_button", handler, metadata);

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual(metadata);
    });

    it("should prevent duplicate handler registration", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("test_button", handler1);
      const result = await manager.registerHandler("test_button", handler2);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("should allow handler overwrite when forced", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("test_button", handler1);
      const result = await manager.registerHandler("test_button", handler2, undefined, true);

      expect(result.success).toBe(true);
    });

    it("should reject invalid handler IDs", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const result1 = await manager.registerHandler("", handler);
      const result2 = await manager.registerHandler("   ", handler);
      const result3 = await manager.registerHandler("id with spaces", handler);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });

    it("should enforce maximum handler limit", async () => {
      const customManager = new ActionButtonManager({ maxHandlers: 2 });
      const handler = vi.fn().mockResolvedValue(undefined);

      await customManager.registerHandler("handler1", handler);
      await customManager.registerHandler("handler2", handler);
      const result = await customManager.registerHandler("handler3", handler);

      expect(result.success).toBe(false);
      expect(result.error).toContain("maximum");
    });

    it("should validate handler function", async () => {
      const result1 = await manager.registerHandler("test", null as any);
      const result2 = await manager.registerHandler("test", "not a function" as any);
      const result3 = await manager.registerHandler("test", {} as any);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });

    it("should cache registered handlers", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("test_button", handler);

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining("handler:test_button"),
        expect.any(Object),
        expect.any(Number)
      );
    });
  });

  describe("Handler Execution", () => {
    beforeEach(async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);
    });

    it("should execute registered handler successfully", async () => {
      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(true);
      expect(result.handlerId).toBe("test_button");
    });

    it("should pass correct context to handler", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler, undefined, true);

      await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          interaction: mockInteraction,
          user: mockUser,
          guild: mockGuild,
          channel: mockChannel,
          customId: "test_button",
        })
      );
    });

    it("should handle non-existent handler gracefully", async () => {
      const nonExistentInteraction = {
        ...mockInteraction,
        customId: "non_existent_button",
      };

      const result = await manager.handleButtonInteraction(nonExistentInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should apply rate limiting to handler execution", async () => {
      (cacheService.checkRateLimit as any).mockResolvedValue({
        allowed: false,
        remaining: 0,
      });

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("rate limit");
    });

    it("should handle handler execution errors", async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      await manager.registerHandler("test_button", errorHandler, undefined, true);

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Handler failed");
    });

    it("should timeout long-running handlers", async () => {
      const slowHandler = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );
      const fastManager = new ActionButtonManager({ defaultTimeout: 100 });
      await fastManager.registerHandler("slow_button", slowHandler);

      const slowInteraction = { ...mockInteraction, customId: "slow_button" };
      const result = await fastManager.handleButtonInteraction(slowInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("should handle interaction reply failures", async () => {
      (mockInteraction.reply as any).mockRejectedValue(new Error("Reply failed"));

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Reply failed");
    });

    it("should defer reply for long-running handlers", async () => {
      const longHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      await manager.registerHandler("test_button", longHandler, undefined, true);

      await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
    });

    it("should track handler execution metrics", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler, undefined, true);

      await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      const metrics = await manager.getHandlerMetrics("test_button");
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(0);
    });
  });

  describe("Button Creation", () => {
    it("should create basic button", () => {
      const button = manager.createButton("test_id", "Test Button");

      expect(button).toBeDefined();
      expect(button.data.custom_id).toBe("test_id");
      expect(button.data.label).toBe("Test Button");
      expect(button.data.style).toBe(ButtonStyle.Primary);
    });

    it("should create button with custom style", () => {
      const button = manager.createButton("test_id", "Test Button", {
        style: ButtonStyle.Danger,
      });

      expect(button.data.style).toBe(ButtonStyle.Danger);
    });

    it("should create button with emoji", () => {
      const button = manager.createButton("test_id", "Test Button", {
        emoji: "🚀",
      });

      expect(button.data.emoji).toEqual({ name: "🚀" });
    });

    it("should create disabled button", () => {
      const button = manager.createButton("test_id", "Test Button", {
        disabled: true,
      });

      expect(button.data.disabled).toBe(true);
    });

    it("should create button with URL style", () => {
      const button = manager.createButton("test_id", "Visit Site", {
        style: ButtonStyle.Link,
        url: "https://example.com",
      });

      expect(button.data.style).toBe(ButtonStyle.Link);
      expect(button.data.url).toBe("https://example.com");
    });

    it("should validate button parameters", () => {
      expect(() => manager.createButton("", "Test")).toThrow();
      expect(() => manager.createButton("test", "")).toThrow();
      expect(() => manager.createButton("test".repeat(20), "Test")).toThrow();
    });
  });

  describe("Action Row Management", () => {
    it("should create action row with buttons", () => {
      const buttons = [
        manager.createButton("btn1", "Button 1"),
        manager.createButton("btn2", "Button 2"),
        manager.createButton("btn3", "Button 3"),
      ];

      const row = manager.createActionRow(buttons);

      expect(row).toBeDefined();
      expect(row.components).toHaveLength(3);
    });

    it("should enforce maximum buttons per row", () => {
      const buttons = Array.from({ length: 10 }, (_, i) => 
        manager.createButton(`btn${i}`, `Button ${i}`)
      );

      expect(() => manager.createActionRow(buttons)).toThrow();
    });

    it("should create multiple action rows from buttons", () => {
      const buttons = Array.from({ length: 8 }, (_, i) => 
        manager.createButton(`btn${i}`, `Button ${i}`)
      );

      const rows = manager.createActionRows(buttons);

      expect(rows).toHaveLength(2);
      expect(rows[0].components).toHaveLength(5);
      expect(rows[1].components).toHaveLength(3);
    });

    it("should handle empty button array", () => {
      const rows = manager.createActionRows([]);
      expect(rows).toHaveLength(0);
    });
  });

  describe("Handler Management", () => {
    it("should unregister handler successfully", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      const result = await manager.unregisterHandler("test_button");

      expect(result.success).toBe(true);
      expect(cacheService.del).toHaveBeenCalled();
    });

    it("should handle unregistering non-existent handler", async () => {
      const result = await manager.unregisterHandler("non_existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should list all registered handlers", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("handler1", handler1);
      await manager.registerHandler("handler2", handler2);

      const handlers = await manager.listHandlers();

      expect(handlers).toHaveLength(2);
      expect(handlers.map(h => h.id)).toEqual(["handler1", "handler2"]);
    });

    it("should get handler information", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const metadata = { description: "Test handler" };

      await manager.registerHandler("test_handler", handler, metadata);

      const info = await manager.getHandlerInfo("test_handler");

      expect(info?.id).toBe("test_handler");
      expect(info?.metadata).toEqual(metadata);
      expect(info?.registered).toBeDefined();
    });

    it("should clear all handlers", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("handler1", handler);
      await manager.registerHandler("handler2", handler);

      const result = await manager.clearHandlers();

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(2);

      const handlers = await manager.listHandlers();
      expect(handlers).toHaveLength(0);
    });
  });

  describe("Middleware Support", () => {
    it("should execute middleware before handler", async () => {
      const middleware = vi.fn().mockResolvedValue(true);
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerMiddleware("auth", middleware);
      await manager.registerHandler("test_button", handler, {
        middleware: ["auth"],
      });

      await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(middleware).toHaveBeenCalledBefore(handler as any);
    });

    it("should block handler execution if middleware fails", async () => {
      const middleware = vi.fn().mockResolvedValue(false);
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerMiddleware("auth", middleware);
      await manager.registerHandler("test_button", handler, {
        middleware: ["auth"],
      });

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle middleware errors", async () => {
      const errorMiddleware = vi.fn().mockRejectedValue(new Error("Middleware failed"));
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerMiddleware("auth", errorMiddleware);
      await manager.registerHandler("test_button", handler, {
        middleware: ["auth"],
      });

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Middleware failed");
    });

    it("should execute multiple middleware in order", async () => {
      const middleware1 = vi.fn().mockResolvedValue(true);
      const middleware2 = vi.fn().mockResolvedValue(true);
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerMiddleware("middleware1", middleware1);
      await manager.registerMiddleware("middleware2", middleware2);
      await manager.registerHandler("test_button", handler, {
        middleware: ["middleware1", "middleware2"],
      });

      await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(middleware1).toHaveBeenCalledBefore(middleware2 as any);
      expect(middleware2).toHaveBeenCalledBefore(handler as any);
    });
  });

  describe("Permission Checking", () => {
    it("should check user permissions before handler execution", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("test_button", handler, {
        permissions: ["MANAGE_MESSAGES"],
      });

      // Mock user without permissions
      const unauthorizedInteraction = {
        ...mockInteraction,
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(false),
          },
        },
      };

      const result = await manager.handleButtonInteraction(unauthorizedInteraction as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("permission");
    });

    it("should allow execution with proper permissions", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("test_button", handler, {
        permissions: ["MANAGE_MESSAGES"],
      });

      // Mock user with permissions
      const authorizedInteraction = {
        ...mockInteraction,
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(true),
          },
        },
      };

      const result = await manager.handleButtonInteraction(authorizedInteraction as any);

      expect(result.success).toBe(true);
    });
  });

  describe("Error Recovery", () => {
    it("should recover from handler crashes", async () => {
      const crashingHandler = vi.fn().mockImplementation(() => {
        throw new Error("Handler crashed");
      });

      await manager.registerHandler("crash_button", crashingHandler);

      const crashInteraction = { ...mockInteraction, customId: "crash_button" };
      const result = await manager.handleButtonInteraction(crashInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Handler crashed");
      
      // Manager should still be functional
      const handler = vi.fn().mockResolvedValue(undefined);
      const registerResult = await manager.registerHandler("recovery_button", handler);
      expect(registerResult.success).toBe(true);
    });

    it("should handle cache failures gracefully", async () => {
      (cacheService.set as any).mockRejectedValue(new Error("Cache failed"));

      const handler = vi.fn().mockResolvedValue(undefined);
      const result = await manager.registerHandler("test_button", handler);

      // Should still register in memory even if cache fails
      expect(result.success).toBe(true);
    });
  });

  describe("Cleanup and Resource Management", () => {
    it("should cleanup expired handlers", async () => {
      const shortLivedManager = new ActionButtonManager({
        handlerTTL: 100, // Very short TTL for testing
      });

      const handler = vi.fn().mockResolvedValue(undefined);
      await shortLivedManager.registerHandler("temp_button", handler);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup
      await shortLivedManager.cleanupExpiredHandlers();

      const handlers = await shortLivedManager.listHandlers();
      expect(handlers).toHaveLength(0);
    });

    it("should dispose of manager resources", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      await manager.dispose();

      const handlers = await manager.listHandlers();
      expect(handlers).toHaveLength(0);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle high volume of handlers", async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const handler = vi.fn().mockResolvedValue(undefined);
        promises.push(manager.registerHandler(`handler_${i}`, handler));
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.success)).toBe(true);

      const handlers = await manager.listHandlers();
      expect(handlers).toHaveLength(100);
    });

    it("should handle concurrent handler executions", async () => {
      const slowHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Register multiple handlers
      for (let i = 0; i < 5; i++) {
        await manager.registerHandler(`concurrent_${i}`, slowHandler);
      }

      // Execute concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const interaction = {
          ...mockInteraction,
          customId: `concurrent_${i}`,
        };
        promises.push(manager.handleButtonInteraction(interaction as ButtonInteraction));
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.success)).toBe(true);
      expect(slowHandler).toHaveBeenCalledTimes(5);
    });
  });

  describe("Event Logging and Monitoring", () => {
    it("should log handler registration events", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("logged_button", handler);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Registered handler: logged_button")
      );

      consoleSpy.mockRestore();
    });

    it("should log handler execution events", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler, undefined, true);

      await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Executing handler: test_button")
      );

      consoleSpy.mockRestore();
    });

    it("should collect execution statistics", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("stats_button", handler);

      const statsInteraction = { ...mockInteraction, customId: "stats_button" };

      // Execute multiple times
      for (let i = 0; i < 3; i++) {
        await manager.handleButtonInteraction(statsInteraction as ButtonInteraction);
      }

      const stats = await manager.getGlobalStats();
      expect(stats.totalHandlers).toBeGreaterThan(0);
      expect(stats.totalExecutions).toBe(3);
    });
  });
});