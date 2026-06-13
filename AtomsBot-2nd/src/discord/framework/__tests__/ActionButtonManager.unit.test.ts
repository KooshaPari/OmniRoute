import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ButtonInteraction,
  User,
  Guild,
  TextChannel,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";

// Mock dependencies
vi.mock("../../../cache/redis", () => ({
  cacheService: {
    set: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(true),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  },
}));

// Import after mocking
import { ActionButtonManager } from "../ActionButtonManager";

describe("ActionButtonManager - Unit Tests", () => {
  let manager: ActionButtonManager;
  let mockInteraction: Partial<ButtonInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Minimal mock setup for unit tests
    mockInteraction = {
      id: "interaction123",
      user: { id: "user123", username: "testuser", bot: false } as User,
      guild: { id: "guild123", name: "Test Guild" } as Guild,
      channel: { id: "channel123", name: "test-channel" } as TextChannel,
      customId: "test_button",
      reply: vi.fn().mockResolvedValue({}),
      deferReply: vi.fn().mockResolvedValue({}),
      editReply: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      isRepliable: () => true,
      replied: false,
      deferred: false,
    };

    manager = new ActionButtonManager();
  });

  describe("Constructor", () => {
    it("should initialize with default configuration", () => {
      const defaultManager = new ActionButtonManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager).toBeInstanceOf(ActionButtonManager);
    });

    it("should accept custom configuration", () => {
      const customConfig = {
        maxHandlers: 50,
        defaultTimeout: 10000,
        enableLogging: false,
      };

      const customManager = new ActionButtonManager(customConfig);
      expect(customManager).toBeDefined();
    });

    it("should throw on invalid configuration", () => {
      expect(() => new ActionButtonManager({ maxHandlers: -1 })).toThrow();
      expect(() => new ActionButtonManager({ defaultTimeout: 0 })).toThrow();
    });
  });

  describe("Handler Registration - Unit Level", () => {
    it("should register handler function", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const result = await manager.registerHandler("unit_test", handler);

      expect(result.success).toBe(true);
      expect(result.handlerId).toBe("unit_test");
      expect(typeof result.registrationId).toBe("string");
    });

    it("should reject null handler", async () => {
      const result = await manager.registerHandler("null_handler", null as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid handler");
    });

    it("should reject undefined handler", async () => {
      const result = await manager.registerHandler("undefined_handler", undefined as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid handler");
    });

    it("should reject non-function handler", async () => {
      const result = await manager.registerHandler("string_handler", "not a function" as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid handler");
    });

    it("should validate handler ID format", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      // Test various invalid IDs
      const invalidIds = ["", "   ", "123start", "with spaces", "special@chars"];

      for (const id of invalidIds) {
        const result = await manager.registerHandler(id, handler);
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid handler ID");
      }
    });

    it("should prevent duplicate registration", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("duplicate", handler1);
      const result = await manager.registerHandler("duplicate", handler2);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("should allow forced overwrite", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      await manager.registerHandler("overwrite", handler1);
      const result = await manager.registerHandler("overwrite", handler2, undefined, true);

      expect(result.success).toBe(true);
    });

    it("should enforce handler limit", async () => {
      const limitedManager = new ActionButtonManager({ maxHandlers: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);

      await limitedManager.registerHandler("first", handler);
      const result = await limitedManager.registerHandler("second", handler);

      expect(result.success).toBe(false);
      expect(result.error).toContain("maximum");
    });

    it("should store handler metadata", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const metadata = { description: "Test handler", version: "1.0.0" };

      const result = await manager.registerHandler("meta_test", handler, metadata);

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual(metadata);
    });

    it("should generate unique registration timestamps", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const result1 = await manager.registerHandler("time_test1", handler);
      await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
      const result2 = await manager.registerHandler("time_test2", handler);

      expect(result1.timestamp).toBeDefined();
      expect(result2.timestamp).toBeDefined();
      expect(result1.timestamp).not.toEqual(result2.timestamp);
    });
  });

  describe("Handler Execution - Unit Level", () => {
    beforeEach(async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);
    });

    it("should execute registered handler", async () => {
      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(true);
      expect(result.handlerId).toBe("test_button");
      expect(typeof result.executionTime).toBe("number");
    });

    it("should handle missing handler", async () => {
      const missingInteraction = { ...mockInteraction, customId: "missing_button" };
      const result = await manager.handleButtonInteraction(missingInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle handler execution error", async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      await manager.registerHandler("error_button", errorHandler, undefined, true);

      const errorInteraction = { ...mockInteraction, customId: "error_button" };
      const result = await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Handler failed");
    });

    it("should measure execution time", async () => {
      const slowHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await manager.registerHandler("slow_button", slowHandler, undefined, true);

      const slowInteraction = { ...mockInteraction, customId: "slow_button" };
      const result = await manager.handleButtonInteraction(slowInteraction as ButtonInteraction);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(5);
    });

    it("should pass correct context to handler", async () => {
      const contextHandler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("context_button", contextHandler, undefined, true);

      const contextInteraction = { ...mockInteraction, customId: "context_button" };
      await manager.handleButtonInteraction(contextInteraction as ButtonInteraction);

      expect(contextHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          interaction: contextInteraction,
          user: mockInteraction.user,
          guild: mockInteraction.guild,
          channel: mockInteraction.channel,
          customId: "context_button",
        })
      );
    });

    it("should handle interaction without guild", async () => {
      const dmInteraction = { ...mockInteraction, guild: null, member: null };
      const result = await manager.handleButtonInteraction(dmInteraction as ButtonInteraction);

      // Should handle gracefully (specific behavior depends on handler requirements)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should reject bot interactions", async () => {
      const botInteraction = {
        ...mockInteraction,
        user: { ...mockInteraction.user, bot: true },
      };

      const result = await manager.handleButtonInteraction(botInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("bot");
    });

    it("should handle synchronous handler errors", async () => {
      const syncErrorHandler = vi.fn().mockImplementation(() => {
        throw new Error("Sync error");
      });

      await manager.registerHandler("sync_error", syncErrorHandler, undefined, true);

      const syncInteraction = { ...mockInteraction, customId: "sync_error" };
      const result = await manager.handleButtonInteraction(syncInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Sync error");
    });

    it("should handle async handler errors", async () => {
      const asyncErrorHandler = vi.fn().mockRejectedValue(new Error("Async error"));

      await manager.registerHandler("async_error", asyncErrorHandler, undefined, true);

      const asyncInteraction = { ...mockInteraction, customId: "async_error" };
      const result = await manager.handleButtonInteraction(asyncInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Async error");
    });
  });

  describe("Button Creation - Unit Level", () => {
    it("should create basic button", () => {
      const button = manager.createButton("basic_id", "Basic Button");

      expect(button).toBeInstanceOf(ButtonBuilder);
      expect(button.data.custom_id).toBe("basic_id");
      expect(button.data.label).toBe("Basic Button");
      expect(button.data.style).toBe(ButtonStyle.Primary);
    });

    it("should create button with custom style", () => {
      const button = manager.createButton("styled_id", "Styled Button", {
        style: ButtonStyle.Danger,
      });

      expect(button.data.style).toBe(ButtonStyle.Danger);
    });

    it("should create disabled button", () => {
      const button = manager.createButton("disabled_id", "Disabled Button", {
        disabled: true,
      });

      expect(button.data.disabled).toBe(true);
    });

    it("should create button with emoji", () => {
      const button = manager.createButton("emoji_id", "Emoji Button", {
        emoji: "🔥",
      });

      expect(button.data.emoji).toEqual({ name: "🔥" });
    });

    it("should validate button ID", () => {
      expect(() => manager.createButton("", "Label")).toThrow("Invalid button ID");
      expect(() => manager.createButton("   ", "Label")).toThrow("Invalid button ID");
    });

    it("should validate button label", () => {
      expect(() => manager.createButton("id", "")).toThrow("Invalid button label");
      expect(() => manager.createButton("id", "   ")).toThrow("Invalid button label");
    });

    it("should enforce ID length limit", () => {
      const longId = "a".repeat(101);
      expect(() => manager.createButton(longId, "Label")).toThrow("Button ID too long");
    });

    it("should enforce label length limit", () => {
      const longLabel = "a".repeat(81);
      expect(() => manager.createButton("id", longLabel)).toThrow("Button label too long");
    });

    it("should handle link buttons", () => {
      const button = manager.createButton("link_id", "Visit", {
        style: ButtonStyle.Link,
        url: "https://example.com",
      });

      expect(button.data.style).toBe(ButtonStyle.Link);
      expect(button.data.url).toBe("https://example.com");
      expect(button.data.custom_id).toBeUndefined();
    });

    it("should require URL for link buttons", () => {
      expect(() => manager.createButton("link", "Link", {
        style: ButtonStyle.Link,
      })).toThrow("Link buttons require URL");
    });

    it("should reject URL for non-link buttons", () => {
      expect(() => manager.createButton("nonlink", "Button", {
        style: ButtonStyle.Primary,
        url: "https://example.com",
      })).toThrow("Only link buttons can have URL");
    });
  });

  describe("Action Row Creation - Unit Level", () => {
    it("should create action row with buttons", () => {
      const buttons = [
        manager.createButton("btn1", "Button 1"),
        manager.createButton("btn2", "Button 2"),
      ];

      const row = manager.createActionRow(buttons);

      expect(row).toBeInstanceOf(ActionRowBuilder);
      expect(row.components).toHaveLength(2);
    });

    it("should reject empty button array", () => {
      expect(() => manager.createActionRow([])).toThrow("No components provided");
    });

    it("should enforce component limit per row", () => {
      const buttons = Array.from({ length: 6 }, (_, i) =>
        manager.createButton(`btn${i}`, `Button ${i}`)
      );

      expect(() => manager.createActionRow(buttons)).toThrow("Too many components");
    });

    it("should create multiple rows from buttons", () => {
      const buttons = Array.from({ length: 7 }, (_, i) =>
        manager.createButton(`btn${i}`, `Button ${i}`)
      );

      const rows = manager.createActionRows(buttons);

      expect(rows).toHaveLength(2);
      expect(rows[0].components).toHaveLength(5);
      expect(rows[1].components).toHaveLength(2);
    });

    it("should handle exactly 5 buttons", () => {
      const buttons = Array.from({ length: 5 }, (_, i) =>
        manager.createButton(`btn${i}`, `Button ${i}`)
      );

      const rows = manager.createActionRows(buttons);

      expect(rows).toHaveLength(1);
      expect(rows[0].components).toHaveLength(5);
    });

    it("should limit total buttons", () => {
      const buttons = Array.from({ length: 30 }, (_, i) =>
        manager.createButton(`btn${i}`, `Button ${i}`)
      );

      expect(() => manager.createActionRows(buttons)).toThrow("Too many buttons");
    });
  });

  describe("Handler Management - Unit Level", () => {
    beforeEach(async () => {
      // Register some test handlers
      for (let i = 1; i <= 3; i++) {
        const handler = vi.fn().mockResolvedValue(undefined);
        await manager.registerHandler(`handler${i}`, handler, {
          description: `Handler ${i}`,
        });
      }
    });

    it("should list registered handlers", async () => {
      const handlers = await manager.listHandlers();

      expect(handlers).toHaveLength(3);
      expect(handlers.map(h => h.id)).toEqual(["handler1", "handler2", "handler3"]);
    });

    it("should get handler information", async () => {
      const info = await manager.getHandlerInfo("handler1");

      expect(info).toBeDefined();
      expect(info?.id).toBe("handler1");
      expect(info?.metadata?.description).toBe("Handler 1");
    });

    it("should return null for non-existent handler", async () => {
      const info = await manager.getHandlerInfo("nonexistent");

      expect(info).toBeNull();
    });

    it("should check handler existence", async () => {
      expect(await manager.hasHandler("handler1")).toBe(true);
      expect(await manager.hasHandler("nonexistent")).toBe(false);
    });

    it("should unregister handler", async () => {
      const result = await manager.unregisterHandler("handler1");

      expect(result.success).toBe(true);
      expect(result.handlerId).toBe("handler1");
      expect(await manager.hasHandler("handler1")).toBe(false);
    });

    it("should handle unregistering non-existent handler", async () => {
      const result = await manager.unregisterHandler("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should clear all handlers", async () => {
      const result = await manager.clearHandlers();

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(3);

      const handlers = await manager.listHandlers();
      expect(handlers).toHaveLength(0);
    });

    it("should get handler count", async () => {
      const count = await manager.getHandlerCount();
      expect(count).toBe(3);
    });
  });

  describe("Configuration Management - Unit Level", () => {
    it("should return current configuration", async () => {
      const config = await manager.getConfiguration();

      expect(config).toBeDefined();
      expect(typeof config.maxHandlers).toBe("number");
      expect(typeof config.defaultTimeout).toBe("number");
      expect(typeof config.enableLogging).toBe("boolean");
    });

    it("should update configuration", async () => {
      const updates = {
        maxHandlers: 150,
        defaultTimeout: 45000,
      };

      const result = await manager.updateConfiguration(updates);

      expect(result.success).toBe(true);

      const newConfig = await manager.getConfiguration();
      expect(newConfig.maxHandlers).toBe(150);
      expect(newConfig.defaultTimeout).toBe(45000);
    });

    it("should validate configuration updates", async () => {
      const invalidUpdates = {
        maxHandlers: -5,
        defaultTimeout: 0,
      };

      const result = await manager.updateConfiguration(invalidUpdates);

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe("Statistics - Unit Level", () => {
    beforeEach(async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("stats_test", handler);
    });

    it("should provide global statistics", async () => {
      const stats = await manager.getGlobalStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalHandlers).toBe("number");
      expect(typeof stats.totalExecutions).toBe("number");
      expect(typeof stats.uptime).toBe("number");
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it("should track handler metrics", async () => {
      const statsInteraction = { ...mockInteraction, customId: "stats_test" };
      await manager.handleButtonInteraction(statsInteraction as ButtonInteraction);

      const metrics = await manager.getHandlerMetrics("stats_test");

      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBe(1);
      expect(metrics?.successfulExecutions).toBe(1);
      expect(metrics?.failedExecutions).toBe(0);
    });

    it("should return null for non-existent handler metrics", async () => {
      const metrics = await manager.getHandlerMetrics("nonexistent");

      expect(metrics).toBeNull();
    });

    it("should track failed executions", async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error("Test error"));
      await manager.registerHandler("error_stats", errorHandler, undefined, true);

      const errorInteraction = { ...mockInteraction, customId: "error_stats" };
      await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

      const metrics = await manager.getHandlerMetrics("error_stats");

      expect(metrics?.totalExecutions).toBe(1);
      expect(metrics?.successfulExecutions).toBe(0);
      expect(metrics?.failedExecutions).toBe(1);
    });
  });

  describe("Disposal and Cleanup - Unit Level", () => {
    it("should dispose manager", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("disposable", handler);

      await manager.dispose();

      const handlers = await manager.listHandlers();
      expect(handlers).toHaveLength(0);
    });

    it("should reject operations after disposal", async () => {
      await manager.dispose();

      const result = await manager.registerHandler("after_dispose", vi.fn());

      expect(result.success).toBe(false);
      expect(result.error).toContain("disposed");
    });

    it("should handle multiple dispose calls", async () => {
      await manager.dispose();
      
      // Second dispose should not throw
      await expect(manager.dispose()).resolves.not.toThrow();
    });
  });

  describe("Error Handling - Unit Level", () => {
    it("should handle invalid interaction objects", async () => {
      const invalidInteraction = {
        customId: "test_button",
        // Missing required properties
      };

      const result = await manager.handleButtonInteraction(invalidInteraction as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle null/undefined interactions", async () => {
      let result = await manager.handleButtonInteraction(null as any);
      expect(result.success).toBe(false);

      result = await manager.handleButtonInteraction(undefined as any);
      expect(result.success).toBe(false);
    });

    it("should handle handler registration errors gracefully", async () => {
      // Simulate internal error during registration
      const originalConsoleError = console.error;
      console.error = vi.fn(); // Suppress error logs during test

      const result = await manager.registerHandler("test", null as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.error = originalConsoleError;
    });

    it("should maintain state consistency after errors", async () => {
      // Register a handler that will fail
      await manager.registerHandler("fail_handler", null as any);

      // Manager should still function normally
      const normalHandler = vi.fn().mockResolvedValue(undefined);
      const result = await manager.registerHandler("normal_handler", normalHandler);

      expect(result.success).toBe(true);
    });
  });

  describe("Memory Management - Unit Level", () => {
    it("should report memory usage", async () => {
      const memoryUsage = await manager.getMemoryUsage();

      expect(memoryUsage).toBeDefined();
      expect(typeof memoryUsage.heapUsed).toBe("number");
      expect(typeof memoryUsage.heapTotal).toBe("number");
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
    });

    it("should handle memory cleanup on handler removal", async () => {
      // Register and remove many handlers
      for (let i = 0; i < 10; i++) {
        const handler = vi.fn().mockResolvedValue(undefined);
        await manager.registerHandler(`temp_${i}`, handler);
      }

      // Remove all handlers
      for (let i = 0; i < 10; i++) {
        await manager.unregisterHandler(`temp_${i}`);
      }

      const handlers = await manager.listHandlers();
      expect(handlers).toHaveLength(0);
    });
  });
});