import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ButtonInteraction,
  User,
  Guild,
  TextChannel,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

// Mock dependencies
vi.mock("../../../cache/redis");

// Import after mocking
import { ActionButtonManager } from "../ActionButtonManager";
import { cacheService } from "../../../cache/redis";

describe("ActionButtonManager - Minimal Tests", () => {
  let manager: ActionButtonManager;
  let mockInteraction: Partial<ButtonInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Minimal mock setup
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

    // Mock cache service
    (cacheService.set as any) = vi.fn().mockResolvedValue(true);
    (cacheService.get as any) = vi.fn().mockResolvedValue(null);
    (cacheService.del as any) = vi.fn().mockResolvedValue(true);
    (cacheService.checkRateLimit as any) = vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 10,
    });

    manager = new ActionButtonManager();
  });

  describe("Basic Functionality", () => {
    it("should create manager instance", () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(ActionButtonManager);
    });

    it("should register handler", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const result = await manager.registerHandler("test_button", handler);

      expect(result.success).toBe(true);
      expect(result.handlerId).toBe("test_button");
    });

    it("should execute registered handler", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it("should handle missing handler", async () => {
      const nonExistentInteraction = {
        ...mockInteraction,
        customId: "non_existent",
      };

      const result = await manager.handleButtonInteraction(nonExistentInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should create button", () => {
      const button = manager.createButton("test_id", "Test Button");

      expect(button).toBeInstanceOf(ButtonBuilder);
      expect(button.data.custom_id).toBe("test_id");
      expect(button.data.label).toBe("Test Button");
      expect(button.data.style).toBe(ButtonStyle.Primary);
    });

    it("should unregister handler", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      const result = await manager.unregisterHandler("test_button");

      expect(result.success).toBe(true);
    });

    it("should list registered handlers", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("handler1", handler);
      await manager.registerHandler("handler2", handler);

      const handlers = await manager.listHandlers();

      expect(handlers).toHaveLength(2);
      expect(handlers.map(h => h.id)).toEqual(["handler1", "handler2"]);
    });

    it("should handle rate limiting", async () => {
      (cacheService.checkRateLimit as any).mockResolvedValue({
        allowed: false,
        remaining: 0,
      });

      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("rate limit");
      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle handler errors", async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      await manager.registerHandler("test_button", errorHandler);

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Handler failed");
    });

    it("should validate button parameters", () => {
      expect(() => manager.createButton("", "Test")).toThrow();
      expect(() => manager.createButton("test", "")).toThrow();
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

    it("should create action row with buttons", () => {
      const buttons = [
        manager.createButton("btn1", "Button 1"),
        manager.createButton("btn2", "Button 2"),
      ];

      const row = manager.createActionRow(buttons);

      expect(row.components).toHaveLength(2);
    });

    it("should enforce button limit per row", () => {
      const buttons = Array.from({ length: 10 }, (_, i) => 
        manager.createButton(`btn${i}`, `Button ${i}`)
      );

      expect(() => manager.createActionRow(buttons)).toThrow();
    });

    it("should get handler info", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const metadata = { description: "Test handler" };

      await manager.registerHandler("test_handler", handler, metadata);

      const info = await manager.getHandlerInfo("test_handler");

      expect(info?.id).toBe("test_handler");
      expect(info?.metadata).toEqual(metadata);
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

    it("should handle invalid handler function", async () => {
      const result = await manager.registerHandler("test", null as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid handler");
    });

    it("should handle invalid handler ID", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const result = await manager.registerHandler("", handler);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid handler ID");
    });

    it("should handle interaction reply failure", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      (mockInteraction.reply as any).mockRejectedValue(new Error("Reply failed"));

      await manager.registerHandler("test_button", handler);

      const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Reply failed");
    });

    it("should handle cache service errors gracefully", async () => {
      (cacheService.set as any).mockRejectedValue(new Error("Cache error"));

      const handler = vi.fn().mockResolvedValue(undefined);
      const result = await manager.registerHandler("test_button", handler);

      // Should still succeed despite cache error
      expect(result.success).toBe(true);
    });

    it("should create button with custom style", () => {
      const button = manager.createButton("test_id", "Test Button", {
        style: ButtonStyle.Danger,
      });

      expect(button.data.style).toBe(ButtonStyle.Danger);
    });

    it("should create disabled button", () => {
      const button = manager.createButton("test_id", "Test Button", {
        disabled: true,
      });

      expect(button.data.disabled).toBe(true);
    });

    it("should create button with emoji", () => {
      const button = manager.createButton("test_id", "Test Button", {
        emoji: "🚀",
      });

      expect(button.data.emoji).toEqual({ name: "🚀" });
    });

    it("should handle bot user interactions", async () => {
      const botInteraction = {
        ...mockInteraction,
        user: { ...mockInteraction.user, bot: true },
      };

      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      const result = await manager.handleButtonInteraction(botInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("bot");
      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle DM interactions", async () => {
      const dmInteraction = {
        ...mockInteraction,
        guild: null,
      };

      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      const result = await manager.handleButtonInteraction(dmInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("guild");
      expect(handler).not.toHaveBeenCalled();
    });

    it("should timeout long-running handlers", async () => {
      const slowHandler = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );
      
      const fastManager = new ActionButtonManager({ defaultTimeout: 100 });
      await fastManager.registerHandler("slow_button", slowHandler);

      const slowInteraction = { ...mockInteraction, customId: "slow_button" };
      const result = await fastManager.handleButtonInteraction(slowInteraction as ButtonInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("should dispose manager", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("test_button", handler);

      await manager.dispose();

      const handlers = await manager.listHandlers();
      expect(handlers).toHaveLength(0);
    });

    it("should get global statistics", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("stats_button", handler);

      const statsInteraction = { ...mockInteraction, customId: "stats_button" };
      await manager.handleButtonInteraction(statsInteraction as ButtonInteraction);

      const stats = await manager.getGlobalStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalHandlers).toBe("number");
      expect(typeof stats.totalExecutions).toBe("number");
    });

    it("should get handler metrics", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await manager.registerHandler("metrics_button", handler);

      const metricsInteraction = { ...mockInteraction, customId: "metrics_button" };
      await manager.handleButtonInteraction(metricsInteraction as ButtonInteraction);

      const metrics = await manager.getHandlerMetrics("metrics_button");
      
      expect(metrics).toBeDefined();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
    });
  });
});