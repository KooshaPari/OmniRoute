import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ButtonInteraction,
  User,
  Guild,
  TextChannel,
  GuildMember,
  Message,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
  InteractionResponse,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";

// Mock dependencies
vi.mock("../../../cache/redis");
vi.mock("../../embeds");
vi.mock("../StateManager");

// Import after mocking
import { ActionButtonManager } from "../ActionButtonManager";
import { cacheService } from "../../../cache/redis";
import { createErrorEmbed, createSuccessEmbed } from "../../embeds";

describe("ActionButtonManager - Full Test Suite", () => {
  let manager: ActionButtonManager;
  let mockUser: Partial<User>;
  let mockMember: Partial<GuildMember>;
  let mockGuild: Partial<Guild>;
  let mockChannel: Partial<TextChannel>;
  let mockMessage: Partial<Message>;
  let mockInteraction: Partial<ButtonInteraction>;
  let mockInteractionResponse: Partial<InteractionResponse>;

  // Test utilities
  const createMockHandler = (behavior?: "success" | "error" | "slow") => {
    switch (behavior) {
      case "error":
        return vi.fn().mockRejectedValue(new Error("Handler error"));
      case "slow":
        return vi.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 5000))
        );
      default:
        return vi.fn().mockResolvedValue(undefined);
    }
  };

  const createMockInteraction = (customId: string, overrides = {}) => ({
    ...mockInteraction,
    customId,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Discord objects
    mockUser = {
      id: "user123",
      username: "testuser",
      displayName: "Test User",
      discriminator: "0001",
      tag: "testuser#0001",
      bot: false,
      avatar: "avatar123",
      createdAt: new Date("2020-01-01"),
    };

    mockMember = {
      id: "user123",
      user: mockUser as User,
      displayName: "Test User",
      nickname: "TestNick",
      roles: {
        cache: new Map(),
        highest: {
          name: "@everyone",
          position: 0,
        },
      } as any,
      permissions: new PermissionsBitField(["ViewChannel", "SendMessages"]),
      joinedAt: new Date("2020-01-01"),
    };

    mockChannel = {
      id: "channel123",
      name: "test-channel",
      type: 0, // TextChannel
      guild: null as any, // Will be set below
      send: vi.fn().mockResolvedValue({}),
      permissionsFor: vi.fn().mockReturnValue(new PermissionsBitField(["ViewChannel", "SendMessages"])),
    };

    mockGuild = {
      id: "guild123",
      name: "Test Guild",
      ownerId: "owner123",
      memberCount: 100,
      channels: {
        cache: new Map([["channel123", mockChannel]]),
        fetch: vi.fn().mockResolvedValue(mockChannel),
      } as any,
      members: {
        cache: new Map([["user123", mockMember]]),
        fetch: vi.fn().mockResolvedValue(mockMember),
      } as any,
      roles: {
        cache: new Map(),
        everyone: {
          id: "guild123",
          name: "@everyone",
          position: 0,
        },
      } as any,
    };

    mockChannel.guild = mockGuild as Guild;

    mockMessage = {
      id: "message123",
      content: "Test message",
      author: mockUser as User,
      channel: mockChannel as TextChannel,
      guild: mockGuild as Guild,
      createdAt: new Date(),
      edit: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      reactions: {
        removeAll: vi.fn().mockResolvedValue({}),
      } as any,
    };

    mockInteractionResponse = {
      id: "response123",
    };

    mockInteraction = {
      id: "interaction123",
      type: 3, // MessageComponent
      user: mockUser as User,
      member: mockMember as GuildMember,
      guild: mockGuild as Guild,
      channel: mockChannel as TextChannel,
      message: mockMessage as Message,
      customId: "test_button",
      componentType: ComponentType.Button,
      token: "interaction_token",
      version: 1,
      appPermissions: new PermissionsBitField(["SendMessages"]),
      memberPermissions: new PermissionsBitField(["ViewChannel", "SendMessages"]),
      locale: "en-US",
      guildLocale: "en-US",
      createdAt: new Date(),
      reply: vi.fn().mockResolvedValue(mockInteractionResponse),
      deferReply: vi.fn().mockResolvedValue(mockInteractionResponse),
      editReply: vi.fn().mockResolvedValue({}),
      followUp: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      deferUpdate: vi.fn().mockResolvedValue({}),
      showModal: vi.fn().mockResolvedValue({}),
      isRepliable: () => true,
      isChatInputCommand: () => false,
      isButton: () => true,
      isStringSelectMenu: () => false,
      isModalSubmit: () => false,
      replied: false,
      deferred: false,
      ephemeral: false,
      webhook: null,
    };

    // Mock cache service
    (cacheService.set as any) = vi.fn().mockResolvedValue(true);
    (cacheService.get as any) = vi.fn().mockResolvedValue(null);
    (cacheService.del as any) = vi.fn().mockResolvedValue(true);
    (cacheService.exists as any) = vi.fn().mockResolvedValue(false);
    (cacheService.clear as any) = vi.fn().mockResolvedValue(undefined);
    (cacheService.checkRateLimit as any) = vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 10,
    });

    // Mock embed creators
    (createErrorEmbed as any) = vi.fn().mockReturnValue(new EmbedBuilder());
    (createSuccessEmbed as any) = vi.fn().mockReturnValue(new EmbedBuilder());

    // Create manager instance
    manager = new ActionButtonManager({
      maxHandlers: 100,
      defaultTimeout: 30000,
      enableLogging: true,
      rateLimitConfig: {
        maxRequests: 10,
        windowSeconds: 60,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Manager Initialization", () => {
    it("should initialize with default configuration", () => {
      const defaultManager = new ActionButtonManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager).toBeInstanceOf(ActionButtonManager);
    });

    it("should initialize with custom configuration", () => {
      const config = {
        maxHandlers: 50,
        defaultTimeout: 15000,
        enableLogging: false,
        rateLimitConfig: {
          maxRequests: 5,
          windowSeconds: 30,
        },
      };

      const customManager = new ActionButtonManager(config);
      expect(customManager).toBeDefined();

      const internalConfig = (customManager as any).config;
      expect(internalConfig.maxHandlers).toBe(50);
      expect(internalConfig.defaultTimeout).toBe(15000);
      expect(internalConfig.enableLogging).toBe(false);
    });

    it("should validate configuration parameters", () => {
      expect(() => new ActionButtonManager({ maxHandlers: -1 })).toThrow();
      expect(() => new ActionButtonManager({ defaultTimeout: 0 })).toThrow();
      expect(() => new ActionButtonManager({
        rateLimitConfig: { maxRequests: -1, windowSeconds: 60 }
      })).toThrow();
    });

    it("should initialize internal data structures", () => {
      const handlers = (manager as any).handlers;
      const metrics = (manager as any).metrics;
      const middleware = (manager as any).middleware;

      expect(handlers).toBeDefined();
      expect(metrics).toBeDefined();
      expect(middleware).toBeDefined();
      expect(handlers.size).toBe(0);
    });
  });

  describe("Handler Registration", () => {
    describe("Basic Registration", () => {
      it("should register simple handler", async () => {
        const handler = createMockHandler();
        const result = await manager.registerHandler("simple_button", handler);

        expect(result.success).toBe(true);
        expect(result.handlerId).toBe("simple_button");
        expect(result.message).toContain("registered");
      });

      it("should register handler with metadata", async () => {
        const handler = createMockHandler();
        const metadata = {
          description: "Test button handler",
          category: "testing",
          version: "1.0.0",
          author: "test-author",
          permissions: ["SEND_MESSAGES"],
          cooldown: 5000,
          ownerOnly: false,
          guildOnly: true,
        };

        const result = await manager.registerHandler("meta_button", handler, metadata);

        expect(result.success).toBe(true);
        expect(result.metadata).toEqual(metadata);
      });

      it("should validate handler ID format", async () => {
        const handler = createMockHandler();
        const invalidIds = [
          "",
          "   ",
          "id with spaces",
          "id-with-special@chars!",
          "id".repeat(20), // Too long
          "123numeric_start",
          "mixed-CASE_id",
        ];

        for (const id of invalidIds) {
          const result = await manager.registerHandler(id, handler);
          expect(result.success).toBe(false);
          expect(result.error).toContain("Invalid handler ID");
        }
      });

      it("should validate handler function", async () => {
        const invalidHandlers = [
          null,
          undefined,
          "string",
          123,
          {},
          [],
          true,
        ];

        for (const handler of invalidHandlers) {
          const result = await manager.registerHandler("test", handler as any);
          expect(result.success).toBe(false);
          expect(result.error).toContain("Invalid handler");
        }
      });

      it("should prevent duplicate registration", async () => {
        const handler1 = createMockHandler();
        const handler2 = createMockHandler();

        await manager.registerHandler("duplicate_test", handler1);
        const result = await manager.registerHandler("duplicate_test", handler2);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already exists");
      });

      it("should allow forced overwrite", async () => {
        const handler1 = createMockHandler();
        const handler2 = createMockHandler();

        await manager.registerHandler("overwrite_test", handler1);
        const result = await manager.registerHandler("overwrite_test", handler2, undefined, true);

        expect(result.success).toBe(true);
        expect(result.message).toContain("overwritten");
      });

      it("should enforce handler limit", async () => {
        const limitedManager = new ActionButtonManager({ maxHandlers: 2 });
        const handler = createMockHandler();

        await limitedManager.registerHandler("handler1", handler);
        await limitedManager.registerHandler("handler2", handler);

        const result = await limitedManager.registerHandler("handler3", handler);
        expect(result.success).toBe(false);
        expect(result.error).toContain("maximum");
      });

      it("should generate unique registration IDs", async () => {
        const handler = createMockHandler();
        const results = [];

        for (let i = 0; i < 5; i++) {
          results.push(await manager.registerHandler(`handler_${i}`, handler));
        }

        const registrationIds = results.map(r => r.registrationId);
        const uniqueIds = [...new Set(registrationIds)];

        expect(uniqueIds.length).toBe(registrationIds.length);
      });
    });

    describe("Advanced Registration", () => {
      it("should register handler with permissions", async () => {
        const handler = createMockHandler();
        const metadata = {
          permissions: ["MANAGE_MESSAGES", "ADMINISTRATOR"],
        };

        const result = await manager.registerHandler("perm_button", handler, metadata);

        expect(result.success).toBe(true);
        expect(result.metadata?.permissions).toEqual(["MANAGE_MESSAGES", "ADMINISTRATOR"]);
      });

      it("should register handler with cooldown", async () => {
        const handler = createMockHandler();
        const metadata = {
          cooldown: 30000, // 30 seconds
        };

        const result = await manager.registerHandler("cooldown_button", handler, metadata);

        expect(result.success).toBe(true);
        expect(result.metadata?.cooldown).toBe(30000);
      });

      it("should register owner-only handler", async () => {
        const handler = createMockHandler();
        const metadata = {
          ownerOnly: true,
        };

        const result = await manager.registerHandler("owner_button", handler, metadata);

        expect(result.success).toBe(true);
        expect(result.metadata?.ownerOnly).toBe(true);
      });

      it("should register guild-only handler", async () => {
        const handler = createMockHandler();
        const metadata = {
          guildOnly: true,
        };

        const result = await manager.registerHandler("guild_button", handler, metadata);

        expect(result.success).toBe(true);
        expect(result.metadata?.guildOnly).toBe(true);
      });

      it("should register handler with middleware", async () => {
        const handler = createMockHandler();
        const middleware = vi.fn().mockResolvedValue(true);

        await manager.registerMiddleware("test_middleware", middleware);

        const metadata = {
          middleware: ["test_middleware"],
        };

        const result = await manager.registerHandler("middleware_button", handler, metadata);

        expect(result.success).toBe(true);
        expect(result.metadata?.middleware).toEqual(["test_middleware"]);
      });

      it("should validate middleware dependencies", async () => {
        const handler = createMockHandler();
        const metadata = {
          middleware: ["nonexistent_middleware"],
        };

        const result = await manager.registerHandler("invalid_middleware", handler, metadata);

        expect(result.success).toBe(false);
        expect(result.error).toContain("middleware not found");
      });

      it("should register handler with custom timeout", async () => {
        const handler = createMockHandler();
        const metadata = {
          timeout: 60000, // 1 minute
        };

        const result = await manager.registerHandler("timeout_button", handler, metadata);

        expect(result.success).toBe(true);
        expect(result.metadata?.timeout).toBe(60000);
      });

      it("should cache registration data", async () => {
        const handler = createMockHandler();
        const metadata = { description: "Cached handler" };

        await manager.registerHandler("cached_button", handler, metadata);

        expect(cacheService.set).toHaveBeenCalledWith(
          expect.stringMatching(/^handler:cached_button:/),
          expect.objectContaining({
            id: "cached_button",
            metadata,
            registered: expect.any(Date),
          }),
          expect.any(Number)
        );
      });
    });

    describe("Registration Events", () => {
      it("should emit registration events", async () => {
        const eventHandler = vi.fn();
        manager.on("handlerRegistered", eventHandler);

        const handler = createMockHandler();
        await manager.registerHandler("event_button", handler);

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "event_button",
            success: true,
          })
        );
      });

      it("should emit registration failure events", async () => {
        const eventHandler = vi.fn();
        manager.on("handlerRegistrationFailed", eventHandler);

        await manager.registerHandler("", createMockHandler());

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining("Invalid handler ID"),
          })
        );
      });
    });
  });

  describe("Handler Execution", () => {
    describe("Basic Execution", () => {
      beforeEach(async () => {
        const handler = createMockHandler();
        await manager.registerHandler("test_button", handler);
      });

      it("should execute registered handler", async () => {
        const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

        expect(result.success).toBe(true);
        expect(result.handlerId).toBe("test_button");
        expect(result.executionTime).toBeDefined();
      });

      it("should pass correct context to handler", async () => {
        const handler = createMockHandler();
        await manager.registerHandler("context_button", handler, undefined, true);

        const contextInteraction = createMockInteraction("context_button");
        await manager.handleButtonInteraction(contextInteraction as ButtonInteraction);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            interaction: contextInteraction,
            user: mockUser,
            member: mockMember,
            guild: mockGuild,
            channel: mockChannel,
            customId: "context_button",
            manager: manager,
          })
        );
      });

      it("should handle non-existent handler", async () => {
        const nonExistentInteraction = createMockInteraction("non_existent");
        const result = await manager.handleButtonInteraction(nonExistentInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.any(Array),
            ephemeral: true,
          })
        );
      });

      it("should handle handler execution errors", async () => {
        const errorHandler = createMockHandler("error");
        await manager.registerHandler("error_button", errorHandler, undefined, true);

        const errorInteraction = createMockInteraction("error_button");
        const result = await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Handler error");
      });

      it("should handle interaction reply errors", async () => {
        (mockInteraction.reply as any).mockRejectedValue(new Error("Reply failed"));

        const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Reply failed");
      });

      it("should defer reply for long-running handlers", async () => {
        const slowHandler = vi.fn().mockImplementation(async (context) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return undefined;
        });

        await manager.registerHandler("slow_button", slowHandler, undefined, true);

        const slowInteraction = createMockInteraction("slow_button");
        await manager.handleButtonInteraction(slowInteraction as ButtonInteraction);

        expect(slowInteraction.deferReply).toHaveBeenCalled();
      });

      it("should timeout extremely long handlers", async () => {
        const timeoutManager = new ActionButtonManager({ defaultTimeout: 100 });
        const slowHandler = createMockHandler("slow");

        await timeoutManager.registerHandler("timeout_button", slowHandler);

        const timeoutInteraction = createMockInteraction("timeout_button");
        const result = await timeoutManager.handleButtonInteraction(timeoutInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("timeout");
      });
    });

    describe("Permission Checking", () => {
      it("should check user permissions", async () => {
        const handler = createMockHandler();
        const metadata = {
          permissions: ["MANAGE_MESSAGES"],
        };

        await manager.registerHandler("perm_button", handler, metadata);

        // Mock member without required permissions
        const unauthorizedInteraction = createMockInteraction("perm_button", {
          member: {
            ...mockMember,
            permissions: new PermissionsBitField(["VIEW_CHANNEL"]),
          },
        });

        const result = await manager.handleButtonInteraction(unauthorizedInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("permission");
        expect(handler).not.toHaveBeenCalled();
      });

      it("should allow execution with proper permissions", async () => {
        const handler = createMockHandler();
        const metadata = {
          permissions: ["SEND_MESSAGES"],
        };

        await manager.registerHandler("perm_button", handler, metadata);

        // Mock member with required permissions
        const authorizedInteraction = createMockInteraction("perm_button", {
          member: {
            ...mockMember,
            permissions: new PermissionsBitField(["SEND_MESSAGES", "VIEW_CHANNEL"]),
          },
        });

        const result = await manager.handleButtonInteraction(authorizedInteraction as ButtonInteraction);

        expect(result.success).toBe(true);
        expect(handler).toHaveBeenCalled();
      });

      it("should check owner-only restrictions", async () => {
        const handler = createMockHandler();
        const metadata = {
          ownerOnly: true,
        };

        await manager.registerHandler("owner_button", handler, metadata);

        // Mock non-owner user
        const nonOwnerInteraction = createMockInteraction("owner_button", {
          user: { ...mockUser, id: "not_owner" },
        });

        // Mock guild with different owner
        (nonOwnerInteraction as any).guild = {
          ...mockGuild,
          ownerId: "actual_owner",
        };

        const result = await manager.handleButtonInteraction(nonOwnerInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("owner");
        expect(handler).not.toHaveBeenCalled();
      });

      it("should check guild-only restrictions", async () => {
        const handler = createMockHandler();
        const metadata = {
          guildOnly: true,
        };

        await manager.registerHandler("guild_button", handler, metadata);

        // Mock DM interaction (no guild)
        const dmInteraction = createMockInteraction("guild_button", {
          guild: null,
        });

        const result = await manager.handleButtonInteraction(dmInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("guild");
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe("Rate Limiting", () => {
      it("should apply rate limiting to handler execution", async () => {
        (cacheService.checkRateLimit as any).mockResolvedValue({
          allowed: false,
          remaining: 0,
        });

        const handler = createMockHandler();
        await manager.registerHandler("rate_button", handler);

        const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("rate limit");
        expect(handler).not.toHaveBeenCalled();
      });

      it("should use handler-specific rate limits", async () => {
        const handler = createMockHandler();
        const metadata = {
          rateLimit: {
            maxRequests: 3,
            windowSeconds: 30,
          },
        };

        await manager.registerHandler("custom_rate_button", handler, metadata);

        const customRateInteraction = createMockInteraction("custom_rate_button");
        await manager.handleButtonInteraction(customRateInteraction as ButtonInteraction);

        expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
          "user123",
          "custom_rate_button",
          3,
          30
        );
      });

      it("should handle rate limit check errors", async () => {
        (cacheService.checkRateLimit as any).mockRejectedValue(new Error("Cache error"));

        const handler = createMockHandler();
        await manager.registerHandler("rate_error_button", handler);

        // Should continue execution if rate limit check fails
        const result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

        expect(result.success).toBe(true);
        expect(handler).toHaveBeenCalled();
      });

      it("should implement cooldown periods", async () => {
        const handler = createMockHandler();
        const metadata = {
          cooldown: 5000, // 5 seconds
        };

        await manager.registerHandler("cooldown_button", handler, metadata);

        const cooldownInteraction = createMockInteraction("cooldown_button");

        // First execution should succeed
        const result1 = await manager.handleButtonInteraction(cooldownInteraction as ButtonInteraction);
        expect(result1.success).toBe(true);

        // Second execution should be blocked by cooldown
        const result2 = await manager.handleButtonInteraction(cooldownInteraction as ButtonInteraction);
        expect(result2.success).toBe(false);
        expect(result2.error).toContain("cooldown");
      });
    });

    describe("Middleware Execution", () => {
      beforeEach(async () => {
        const middleware1 = vi.fn().mockResolvedValue(true);
        const middleware2 = vi.fn().mockResolvedValue(true);

        await manager.registerMiddleware("middleware1", middleware1);
        await manager.registerMiddleware("middleware2", middleware2);
      });

      it("should execute middleware before handler", async () => {
        const middleware = vi.fn().mockResolvedValue(true);
        const handler = createMockHandler();

        await manager.registerMiddleware("test_middleware", middleware);
        await manager.registerHandler("middleware_button", handler, {
          middleware: ["test_middleware"],
        });

        await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);

        expect(middleware).toHaveBeenCalledBefore(handler as any);
      });

      it("should block handler execution if middleware fails", async () => {
        const failingMiddleware = vi.fn().mockResolvedValue(false);
        const handler = createMockHandler();

        await manager.registerMiddleware("failing_middleware", failingMiddleware);
        await manager.registerHandler("blocked_button", handler, {
          middleware: ["failing_middleware"],
        });

        const blockedInteraction = createMockInteraction("blocked_button");
        const result = await manager.handleButtonInteraction(blockedInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("middleware");
        expect(handler).not.toHaveBeenCalled();
      });

      it("should execute multiple middleware in order", async () => {
        const middleware1 = vi.fn().mockResolvedValue(true);
        const middleware2 = vi.fn().mockResolvedValue(true);
        const handler = createMockHandler();

        await manager.registerMiddleware("order_middleware1", middleware1);
        await manager.registerMiddleware("order_middleware2", middleware2);
        await manager.registerHandler("order_button", handler, {
          middleware: ["order_middleware1", "order_middleware2"],
        });

        const orderInteraction = createMockInteraction("order_button");
        await manager.handleButtonInteraction(orderInteraction as ButtonInteraction);

        expect(middleware1).toHaveBeenCalledBefore(middleware2 as any);
        expect(middleware2).toHaveBeenCalledBefore(handler as any);
      });

      it("should handle middleware errors", async () => {
        const errorMiddleware = vi.fn().mockRejectedValue(new Error("Middleware error"));
        const handler = createMockHandler();

        await manager.registerMiddleware("error_middleware", errorMiddleware);
        await manager.registerHandler("middleware_error_button", handler, {
          middleware: ["error_middleware"],
        });

        const errorInteraction = createMockInteraction("middleware_error_button");
        const result = await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Middleware error");
      });

      it("should pass context to middleware", async () => {
        const contextMiddleware = vi.fn().mockResolvedValue(true);
        const handler = createMockHandler();

        await manager.registerMiddleware("context_middleware", contextMiddleware);
        await manager.registerHandler("context_middleware_button", handler, {
          middleware: ["context_middleware"],
        });

        const contextInteraction = createMockInteraction("context_middleware_button");
        await manager.handleButtonInteraction(contextInteraction as ButtonInteraction);

        expect(contextMiddleware).toHaveBeenCalledWith(
          expect.objectContaining({
            interaction: contextInteraction,
            user: mockUser,
            guild: mockGuild,
          })
        );
      });
    });

    describe("Bot and DM Handling", () => {
      it("should reject bot interactions", async () => {
        const handler = createMockHandler();
        await manager.registerHandler("bot_button", handler);

        const botInteraction = createMockInteraction("bot_button", {
          user: { ...mockUser, bot: true },
        });

        const result = await manager.handleButtonInteraction(botInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("bot");
        expect(handler).not.toHaveBeenCalled();
      });

      it("should handle DM interactions appropriately", async () => {
        const handler = createMockHandler();
        await manager.registerHandler("dm_button", handler);

        const dmInteraction = createMockInteraction("dm_button", {
          guild: null,
          member: null,
        });

        const result = await manager.handleButtonInteraction(dmInteraction as ButtonInteraction);

        // Should succeed unless handler is guild-only
        expect(result.success).toBe(true);
        expect(handler).toHaveBeenCalled();
      });
    });
  });

  describe("Button and Component Creation", () => {
    describe("Basic Button Creation", () => {
      it("should create basic button", () => {
        const button = manager.createButton("test_id", "Test Button");

        expect(button).toBeInstanceOf(ButtonBuilder);
        expect(button.data.custom_id).toBe("test_id");
        expect(button.data.label).toBe("Test Button");
        expect(button.data.style).toBe(ButtonStyle.Primary);
        expect(button.data.disabled).toBe(false);
      });

      it("should create button with custom style", () => {
        const styles = [
          ButtonStyle.Primary,
          ButtonStyle.Secondary,
          ButtonStyle.Success,
          ButtonStyle.Danger,
          ButtonStyle.Link,
        ];

        for (const style of styles) {
          const button = manager.createButton("test_id", "Test Button", { style });
          expect(button.data.style).toBe(style);
        }
      });

      it("should create disabled button", () => {
        const button = manager.createButton("disabled_id", "Disabled Button", {
          disabled: true,
        });

        expect(button.data.disabled).toBe(true);
      });

      it("should create button with emoji", () => {
        const emojiButton = manager.createButton("emoji_id", "Emoji Button", {
          emoji: "🚀",
        });

        expect(emojiButton.data.emoji).toEqual({ name: "🚀" });
      });

      it("should create button with custom emoji", () => {
        const customEmojiButton = manager.createButton("custom_emoji_id", "Custom Emoji", {
          emoji: { id: "123456789", name: "custom_emoji" },
        });

        expect(customEmojiButton.data.emoji).toEqual({
          id: "123456789",
          name: "custom_emoji",
        });
      });

      it("should create link button", () => {
        const linkButton = manager.createButton("link_id", "Visit Site", {
          style: ButtonStyle.Link,
          url: "https://example.com",
        });

        expect(linkButton.data.style).toBe(ButtonStyle.Link);
        expect(linkButton.data.url).toBe("https://example.com");
        expect(linkButton.data.custom_id).toBeUndefined();
      });

      it("should validate button parameters", () => {
        // Invalid ID
        expect(() => manager.createButton("", "Test")).toThrow("Invalid button ID");
        
        // Invalid label
        expect(() => manager.createButton("test", "")).toThrow("Invalid button label");
        
        // ID too long
        expect(() => manager.createButton("a".repeat(101), "Test")).toThrow("Button ID too long");
        
        // Label too long
        expect(() => manager.createButton("test", "a".repeat(81))).toThrow("Button label too long");
        
        // Link button without URL
        expect(() => manager.createButton("link", "Link", {
          style: ButtonStyle.Link,
        })).toThrow("Link buttons require URL");
        
        // Non-link button with URL
        expect(() => manager.createButton("test", "Test", {
          style: ButtonStyle.Primary,
          url: "https://example.com",
        })).toThrow("Only link buttons can have URL");
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

        expect(row).toBeInstanceOf(ActionRowBuilder);
        expect(row.components).toHaveLength(3);
        expect(row.components[0]).toBe(buttons[0]);
        expect(row.components[1]).toBe(buttons[1]);
        expect(row.components[2]).toBe(buttons[2]);
      });

      it("should enforce maximum buttons per row", () => {
        const buttons = Array.from({ length: 6 }, (_, i) =>
          manager.createButton(`btn${i}`, `Button ${i}`)
        );

        expect(() => manager.createActionRow(buttons)).toThrow("Too many components");
      });

      it("should handle empty button array", () => {
        expect(() => manager.createActionRow([])).toThrow("No components provided");
      });

      it("should create multiple rows from button array", () => {
        const buttons = Array.from({ length: 8 }, (_, i) =>
          manager.createButton(`btn${i}`, `Button ${i}`)
        );

        const rows = manager.createActionRows(buttons);

        expect(rows).toHaveLength(2);
        expect(rows[0].components).toHaveLength(5);
        expect(rows[1].components).toHaveLength(3);
      });

      it("should handle exactly 5 buttons", () => {
        const buttons = Array.from({ length: 5 }, (_, i) =>
          manager.createButton(`btn${i}`, `Button ${i}`)
        );

        const rows = manager.createActionRows(buttons);

        expect(rows).toHaveLength(1);
        expect(rows[0].components).toHaveLength(5);
      });

      it("should handle button array larger than 10", () => {
        const buttons = Array.from({ length: 15 }, (_, i) =>
          manager.createButton(`btn${i}`, `Button ${i}`)
        );

        const rows = manager.createActionRows(buttons);

        expect(rows).toHaveLength(3);
        expect(rows[0].components).toHaveLength(5);
        expect(rows[1].components).toHaveLength(5);
        expect(rows[2].components).toHaveLength(5); // Only first 15 buttons, 5 per row
      });

      it("should enforce maximum rows limit", () => {
        const buttons = Array.from({ length: 30 }, (_, i) =>
          manager.createButton(`btn${i}`, `Button ${i}`)
        );

        expect(() => manager.createActionRows(buttons)).toThrow("Too many buttons");
      });
    });

    describe("Advanced Button Features", () => {
      it("should create button with all properties", () => {
        const button = manager.createButton("full_button", "Full Button", {
          style: ButtonStyle.Success,
          emoji: "✅",
          disabled: false,
        });

        expect(button.data.custom_id).toBe("full_button");
        expect(button.data.label).toBe("Full Button");
        expect(button.data.style).toBe(ButtonStyle.Success);
        expect(button.data.emoji).toEqual({ name: "✅" });
        expect(button.data.disabled).toBe(false);
      });

      it("should create button without label if emoji provided", () => {
        const button = manager.createButton("emoji_only", "", {
          emoji: "📧",
        });

        expect(button.data.custom_id).toBe("emoji_only");
        expect(button.data.label).toBe("");
        expect(button.data.emoji).toEqual({ name: "📧" });
      });

      it("should validate URL format for link buttons", () => {
        const invalidUrls = [
          "not-a-url",
          "ftp://example.com",
          "javascript:alert('xss')",
          "mailto:test@example.com",
        ];

        for (const url of invalidUrls) {
          expect(() => manager.createButton("link", "Link", {
            style: ButtonStyle.Link,
            url,
          })).toThrow("Invalid URL");
        }
      });

      it("should accept valid URLs for link buttons", () => {
        const validUrls = [
          "https://example.com",
          "http://example.com",
          "https://subdomain.example.com/path?query=value",
          "https://example.com:8080/path",
        ];

        for (const url of validUrls) {
          expect(() => manager.createButton("link", "Link", {
            style: ButtonStyle.Link,
            url,
          })).not.toThrow();
        }
      });
    });
  });

  describe("Handler Management", () => {
    describe("Handler Retrieval", () => {
      beforeEach(async () => {
        const handler1 = createMockHandler();
        const handler2 = createMockHandler();
        const handler3 = createMockHandler();

        await manager.registerHandler("handler1", handler1, { description: "Handler 1" });
        await manager.registerHandler("handler2", handler2, { description: "Handler 2" });
        await manager.registerHandler("handler3", handler3, { description: "Handler 3" });
      });

      it("should list all registered handlers", async () => {
        const handlers = await manager.listHandlers();

        expect(handlers).toHaveLength(3);
        expect(handlers.map(h => h.id)).toEqual(["handler1", "handler2", "handler3"]);
      });

      it("should get handler information", async () => {
        const info = await manager.getHandlerInfo("handler1");

        expect(info).toBeDefined();
        expect(info?.id).toBe("handler1");
        expect(info?.metadata?.description).toBe("Handler 1");
        expect(info?.registered).toBeInstanceOf(Date);
      });

      it("should return null for non-existent handler info", async () => {
        const info = await manager.getHandlerInfo("nonexistent");

        expect(info).toBeNull();
      });

      it("should check if handler exists", async () => {
        expect(await manager.hasHandler("handler1")).toBe(true);
        expect(await manager.hasHandler("nonexistent")).toBe(false);
      });

      it("should get handlers by category", async () => {
        await manager.registerHandler("cat1_handler", createMockHandler(), { category: "category1" });
        await manager.registerHandler("cat2_handler", createMockHandler(), { category: "category1" });
        await manager.registerHandler("cat3_handler", createMockHandler(), { category: "category2" });

        const cat1Handlers = await manager.getHandlersByCategory("category1");
        const cat2Handlers = await manager.getHandlersByCategory("category2");

        expect(cat1Handlers).toHaveLength(2);
        expect(cat2Handlers).toHaveLength(1);
        expect(cat1Handlers.map(h => h.id)).toEqual(["cat1_handler", "cat2_handler"]);
      });

      it("should filter handlers by metadata", async () => {
        await manager.registerHandler("perm_handler", createMockHandler(), {
          permissions: ["ADMINISTRATOR"],
        });
        await manager.registerHandler("owner_handler", createMockHandler(), {
          ownerOnly: true,
        });

        const handlers = await manager.listHandlers();
        const permHandlers = handlers.filter(h => h.metadata?.permissions?.length > 0);
        const ownerHandlers = handlers.filter(h => h.metadata?.ownerOnly === true);

        expect(permHandlers).toHaveLength(1);
        expect(ownerHandlers).toHaveLength(1);
      });
    });

    describe("Handler Removal", () => {
      beforeEach(async () => {
        const handler = createMockHandler();
        await manager.registerHandler("removable", handler);
      });

      it("should unregister handler successfully", async () => {
        const result = await manager.unregisterHandler("removable");

        expect(result.success).toBe(true);
        expect(result.handlerId).toBe("removable");
        expect(await manager.hasHandler("removable")).toBe(false);
      });

      it("should handle unregistering non-existent handler", async () => {
        const result = await manager.unregisterHandler("nonexistent");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });

      it("should clean up handler cache", async () => {
        await manager.unregisterHandler("removable");

        expect(cacheService.del).toHaveBeenCalledWith(
          expect.stringMatching(/^handler:removable:/)
        );
      });

      it("should emit unregistration events", async () => {
        const eventHandler = vi.fn();
        manager.on("handlerUnregistered", eventHandler);

        await manager.unregisterHandler("removable");

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "removable",
            success: true,
          })
        );
      });
    });

    describe("Bulk Operations", () => {
      beforeEach(async () => {
        for (let i = 1; i <= 5; i++) {
          await manager.registerHandler(`bulk_handler_${i}`, createMockHandler());
        }
      });

      it("should clear all handlers", async () => {
        const result = await manager.clearHandlers();

        expect(result.success).toBe(true);
        expect(result.clearedCount).toBe(8); // 5 bulk + 3 from previous tests
        
        const handlers = await manager.listHandlers();
        expect(handlers).toHaveLength(0);
      });

      it("should unregister handlers by pattern", async () => {
        const result = await manager.unregisterHandlersByPattern(/^bulk_/);

        expect(result.success).toBe(true);
        expect(result.unregisteredCount).toBe(5);

        const remainingHandlers = await manager.listHandlers();
        expect(remainingHandlers.every(h => !h.id.startsWith("bulk_"))).toBe(true);
      });

      it("should unregister handlers by category", async () => {
        await manager.registerHandler("cat_handler1", createMockHandler(), { category: "test_cat" });
        await manager.registerHandler("cat_handler2", createMockHandler(), { category: "test_cat" });

        const result = await manager.unregisterHandlersByCategory("test_cat");

        expect(result.success).toBe(true);
        expect(result.unregisteredCount).toBe(2);
      });

      it("should get handler count", async () => {
        const count = await manager.getHandlerCount();
        expect(count).toBe(8); // 5 bulk + 3 from previous tests
      });

      it("should get categories", async () => {
        await manager.registerHandler("cat1", createMockHandler(), { category: "category1" });
        await manager.registerHandler("cat2", createMockHandler(), { category: "category2" });

        const categories = await manager.getCategories();
        expect(categories).toContain("category1");
        expect(categories).toContain("category2");
      });
    });
  });

  describe("Middleware System", () => {
    describe("Middleware Registration", () => {
      it("should register middleware", async () => {
        const middleware = vi.fn().mockResolvedValue(true);
        const result = await manager.registerMiddleware("test_middleware", middleware);

        expect(result.success).toBe(true);
        expect(result.middlewareId).toBe("test_middleware");
      });

      it("should prevent duplicate middleware registration", async () => {
        const middleware1 = vi.fn().mockResolvedValue(true);
        const middleware2 = vi.fn().mockResolvedValue(true);

        await manager.registerMiddleware("duplicate", middleware1);
        const result = await manager.registerMiddleware("duplicate", middleware2);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already exists");
      });

      it("should validate middleware function", async () => {
        const result = await manager.registerMiddleware("invalid", "not a function" as any);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid middleware");
      });

      it("should unregister middleware", async () => {
        const middleware = vi.fn().mockResolvedValue(true);
        await manager.registerMiddleware("removable_middleware", middleware);

        const result = await manager.unregisterMiddleware("removable_middleware");

        expect(result.success).toBe(true);
      });

      it("should list registered middleware", async () => {
        const middleware1 = vi.fn().mockResolvedValue(true);
        const middleware2 = vi.fn().mockResolvedValue(true);

        await manager.registerMiddleware("middleware1", middleware1);
        await manager.registerMiddleware("middleware2", middleware2);

        const middlewareList = await manager.listMiddleware();

        expect(middlewareList).toHaveLength(2);
        expect(middlewareList.map(m => m.id)).toEqual(["middleware1", "middleware2"]);
      });
    });

    describe("Middleware Execution Order", () => {
      it("should execute middleware in registration order", async () => {
        const executionOrder: string[] = [];

        const middleware1 = vi.fn().mockImplementation(async () => {
          executionOrder.push("middleware1");
          return true;
        });
        const middleware2 = vi.fn().mockImplementation(async () => {
          executionOrder.push("middleware2");
          return true;
        });
        const handler = vi.fn().mockImplementation(async () => {
          executionOrder.push("handler");
        });

        await manager.registerMiddleware("middleware1", middleware1);
        await manager.registerMiddleware("middleware2", middleware2);
        await manager.registerHandler("order_test", handler, {
          middleware: ["middleware1", "middleware2"],
        });

        const orderInteraction = createMockInteraction("order_test");
        await manager.handleButtonInteraction(orderInteraction as ButtonInteraction);

        expect(executionOrder).toEqual(["middleware1", "middleware2", "handler"]);
      });

      it("should stop execution if middleware returns false", async () => {
        const middleware1 = vi.fn().mockResolvedValue(true);
        const middleware2 = vi.fn().mockResolvedValue(false); // This should stop execution
        const middleware3 = vi.fn().mockResolvedValue(true);
        const handler = vi.fn();

        await manager.registerMiddleware("middleware1", middleware1);
        await manager.registerMiddleware("middleware2", middleware2);
        await manager.registerMiddleware("middleware3", middleware3);
        await manager.registerHandler("stop_test", handler, {
          middleware: ["middleware1", "middleware2", "middleware3"],
        });

        const stopInteraction = createMockInteraction("stop_test");
        const result = await manager.handleButtonInteraction(stopInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(middleware1).toHaveBeenCalled();
        expect(middleware2).toHaveBeenCalled();
        expect(middleware3).not.toHaveBeenCalled();
        expect(handler).not.toHaveBeenCalled();
      });

      it("should handle middleware that throws errors", async () => {
        const errorMiddleware = vi.fn().mockRejectedValue(new Error("Middleware error"));
        const handler = vi.fn();

        await manager.registerMiddleware("error_middleware", errorMiddleware);
        await manager.registerHandler("error_test", handler, {
          middleware: ["error_middleware"],
        });

        const errorInteraction = createMockInteraction("error_test");
        const result = await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Middleware error");
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe("Built-in Middleware", () => {
      it("should provide authentication middleware", async () => {
        const authMiddleware = manager.createAuthMiddleware({
          requireGuild: true,
          allowBots: false,
          requiredPermissions: ["SEND_MESSAGES"],
        });

        await manager.registerMiddleware("auth", authMiddleware);
        await manager.registerHandler("auth_test", createMockHandler(), {
          middleware: ["auth"],
        });

        // Should pass for normal user with permissions
        let result = await manager.handleButtonInteraction(mockInteraction as ButtonInteraction);
        expect(result.success).toBe(true);

        // Should fail for bot
        const botInteraction = createMockInteraction("auth_test", {
          user: { ...mockUser, bot: true },
        });
        result = await manager.handleButtonInteraction(botInteraction as ButtonInteraction);
        expect(result.success).toBe(false);

        // Should fail without guild
        const dmInteraction = createMockInteraction("auth_test", {
          guild: null,
          member: null,
        });
        result = await manager.handleButtonInteraction(dmInteraction as ButtonInteraction);
        expect(result.success).toBe(false);
      });

      it("should provide rate limiting middleware", async () => {
        const rateLimitMiddleware = manager.createRateLimitMiddleware({
          maxRequests: 2,
          windowSeconds: 60,
        });

        await manager.registerMiddleware("rate_limit", rateLimitMiddleware);
        await manager.registerHandler("rate_limit_test", createMockHandler(), {
          middleware: ["rate_limit"],
        });

        // Mock cache to simulate rate limiting
        let callCount = 0;
        (cacheService.checkRateLimit as any).mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            allowed: callCount <= 2,
            remaining: Math.max(0, 2 - callCount),
          });
        });

        const rateLimitInteraction = createMockInteraction("rate_limit_test");

        // First two calls should succeed
        let result = await manager.handleButtonInteraction(rateLimitInteraction as ButtonInteraction);
        expect(result.success).toBe(true);

        result = await manager.handleButtonInteraction(rateLimitInteraction as ButtonInteraction);
        expect(result.success).toBe(true);

        // Third call should fail
        result = await manager.handleButtonInteraction(rateLimitInteraction as ButtonInteraction);
        expect(result.success).toBe(false);
      });

      it("should provide logging middleware", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        const loggingMiddleware = manager.createLoggingMiddleware({
          logLevel: "info",
          includeUserInfo: true,
        });

        await manager.registerMiddleware("logging", loggingMiddleware);
        await manager.registerHandler("logging_test", createMockHandler(), {
          middleware: ["logging"],
        });

        const loggingInteraction = createMockInteraction("logging_test");
        await manager.handleButtonInteraction(loggingInteraction as ButtonInteraction);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Button interaction"),
          expect.stringContaining("logging_test"),
          expect.stringContaining("testuser")
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe("Metrics and Statistics", () => {
    describe("Handler Metrics", () => {
      beforeEach(async () => {
        const handler = createMockHandler();
        await manager.registerHandler("metrics_test", handler);
      });

      it("should track handler execution metrics", async () => {
        const metricsInteraction = createMockInteraction("metrics_test");

        // Execute handler multiple times
        await manager.handleButtonInteraction(metricsInteraction as ButtonInteraction);
        await manager.handleButtonInteraction(metricsInteraction as ButtonInteraction);
        await manager.handleButtonInteraction(metricsInteraction as ButtonInteraction);

        const metrics = await manager.getHandlerMetrics("metrics_test");

        expect(metrics).toBeDefined();
        expect(metrics.totalExecutions).toBe(3);
        expect(metrics.successfulExecutions).toBe(3);
        expect(metrics.failedExecutions).toBe(0);
        expect(metrics.averageExecutionTime).toBeGreaterThan(0);
        expect(metrics.lastExecuted).toBeInstanceOf(Date);
      });

      it("should track failed executions", async () => {
        const errorHandler = createMockHandler("error");
        await manager.registerHandler("error_metrics", errorHandler, undefined, true);

        const errorInteraction = createMockInteraction("error_metrics");
        
        // Execute handler that will fail
        await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);
        await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

        const metrics = await manager.getHandlerMetrics("error_metrics");

        expect(metrics.totalExecutions).toBe(2);
        expect(metrics.successfulExecutions).toBe(0);
        expect(metrics.failedExecutions).toBe(2);
      });

      it("should track execution time", async () => {
        const slowHandler = vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });

        await manager.registerHandler("slow_metrics", slowHandler, undefined, true);

        const slowInteraction = createMockInteraction("slow_metrics");
        await manager.handleButtonInteraction(slowInteraction as ButtonInteraction);

        const metrics = await manager.getHandlerMetrics("slow_metrics");

        expect(metrics.averageExecutionTime).toBeGreaterThan(40);
        expect(metrics.minExecutionTime).toBeGreaterThan(40);
        expect(metrics.maxExecutionTime).toBeGreaterThan(40);
      });

      it("should return null for non-existent handler metrics", async () => {
        const metrics = await manager.getHandlerMetrics("nonexistent");
        expect(metrics).toBeNull();
      });
    });

    describe("Global Statistics", () => {
      beforeEach(async () => {
        // Register multiple handlers for statistics
        for (let i = 1; i <= 5; i++) {
          await manager.registerHandler(`stats_handler_${i}`, createMockHandler());
        }
      });

      it("should provide global statistics", async () => {
        const stats = await manager.getGlobalStats();

        expect(stats).toBeDefined();
        expect(stats.totalHandlers).toBeGreaterThanOrEqual(5);
        expect(stats.totalMiddleware).toBeGreaterThanOrEqual(0);
        expect(stats.totalExecutions).toBeGreaterThanOrEqual(0);
        expect(stats.uptime).toBeGreaterThan(0);
        expect(stats.memoryUsage).toBeDefined();
      });

      it("should track total executions", async () => {
        const initialStats = await manager.getGlobalStats();

        // Execute some handlers
        const handler1Interaction = createMockInteraction("stats_handler_1");
        const handler2Interaction = createMockInteraction("stats_handler_2");

        await manager.handleButtonInteraction(handler1Interaction as ButtonInteraction);
        await manager.handleButtonInteraction(handler2Interaction as ButtonInteraction);
        await manager.handleButtonInteraction(handler1Interaction as ButtonInteraction);

        const finalStats = await manager.getGlobalStats();

        expect(finalStats.totalExecutions).toBe(initialStats.totalExecutions + 3);
      });

      it("should provide performance metrics", async () => {
        const performanceMetrics = await manager.getPerformanceMetrics();

        expect(performanceMetrics).toBeDefined();
        expect(performanceMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
        expect(performanceMetrics.requestsPerSecond).toBeGreaterThanOrEqual(0);
        expect(performanceMetrics.errorRate).toBeGreaterThanOrEqual(0);
        expect(performanceMetrics.errorRate).toBeLessThanOrEqual(1);
      });

      it("should export statistics", async () => {
        const exportedStats = await manager.exportStatistics();

        expect(exportedStats).toBeDefined();
        expect(exportedStats.timestamp).toBeInstanceOf(Date);
        expect(exportedStats.handlers).toBeDefined();
        expect(exportedStats.global).toBeDefined();
        expect(exportedStats.performance).toBeDefined();
      });

      it("should reset statistics", async () => {
        // Execute some handlers to generate statistics
        const testInteraction = createMockInteraction("stats_handler_1");
        await manager.handleButtonInteraction(testInteraction as ButtonInteraction);

        const beforeReset = await manager.getGlobalStats();
        expect(beforeReset.totalExecutions).toBeGreaterThan(0);

        await manager.resetStatistics();

        const afterReset = await manager.getGlobalStats();
        expect(afterReset.totalExecutions).toBe(0);
      });
    });

    describe("Performance Monitoring", () => {
      it("should monitor memory usage", async () => {
        const memoryUsage = await manager.getMemoryUsage();

        expect(memoryUsage).toBeDefined();
        expect(memoryUsage.heapUsed).toBeGreaterThan(0);
        expect(memoryUsage.heapTotal).toBeGreaterThan(0);
        expect(memoryUsage.external).toBeGreaterThanOrEqual(0);
        expect(memoryUsage.rss).toBeGreaterThan(0);
      });

      it("should detect memory leaks", async () => {
        const initialMemory = await manager.getMemoryUsage();

        // Simulate potential memory leak by registering many handlers
        for (let i = 0; i < 100; i++) {
          await manager.registerHandler(`leak_test_${i}`, createMockHandler());
        }

        const afterRegistration = await manager.getMemoryUsage();

        expect(afterRegistration.heapUsed).toBeGreaterThan(initialMemory.heapUsed);

        // Clean up
        await manager.clearHandlers();

        // Memory should not have increased dramatically (within reasonable bounds)
        const afterCleanup = await manager.getMemoryUsage();
        const memoryIncrease = afterCleanup.heapUsed - initialMemory.heapUsed;
        
        // Allow for some memory increase but detect if it's excessive
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB threshold
      });

      it("should provide health check", async () => {
        const health = await manager.getHealthStatus();

        expect(health).toBeDefined();
        expect(health.status).toBe("healthy");
        expect(health.uptime).toBeGreaterThan(0);
        expect(health.handlerCount).toBeGreaterThanOrEqual(0);
        expect(health.memoryUsage).toBeDefined();
        expect(health.lastActivity).toBeInstanceOf(Date);
      });
    });
  });

  describe("Error Handling and Recovery", () => {
    describe("Handler Errors", () => {
      it("should handle synchronous errors in handlers", async () => {
        const syncErrorHandler = vi.fn().mockImplementation(() => {
          throw new Error("Synchronous error");
        });

        await manager.registerHandler("sync_error", syncErrorHandler);

        const errorInteraction = createMockInteraction("sync_error");
        const result = await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Synchronous error");
      });

      it("should handle asynchronous errors in handlers", async () => {
        const asyncErrorHandler = createMockHandler("error");

        await manager.registerHandler("async_error", asyncErrorHandler);

        const errorInteraction = createMockInteraction("async_error");
        const result = await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Handler error");
      });

      it("should continue functioning after handler errors", async () => {
        const errorHandler = createMockHandler("error");
        const normalHandler = createMockHandler();

        await manager.registerHandler("error_handler", errorHandler);
        await manager.registerHandler("normal_handler", normalHandler);

        // First interaction fails
        const errorInteraction = createMockInteraction("error_handler");
        const errorResult = await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);
        expect(errorResult.success).toBe(false);

        // Second interaction should still work
        const normalInteraction = createMockInteraction("normal_handler");
        const normalResult = await manager.handleButtonInteraction(normalInteraction as ButtonInteraction);
        expect(normalResult.success).toBe(true);
      });

      it("should handle timeout errors", async () => {
        const timeoutManager = new ActionButtonManager({ defaultTimeout: 50 });
        const slowHandler = createMockHandler("slow");

        await timeoutManager.registerHandler("timeout_test", slowHandler);

        const timeoutInteraction = createMockInteraction("timeout_test");
        const result = await timeoutManager.handleButtonInteraction(timeoutInteraction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("timeout");
      });
    });

    describe("System Errors", () => {
      it("should handle cache service failures", async () => {
        (cacheService.set as any).mockRejectedValue(new Error("Cache failed"));
        (cacheService.get as any).mockRejectedValue(new Error("Cache failed"));

        const handler = createMockHandler();

        // Registration should still work despite cache failure
        const registerResult = await manager.registerHandler("cache_fail", handler);
        expect(registerResult.success).toBe(true);

        // Execution should still work despite cache failure
        const interaction = createMockInteraction("cache_fail");
        const executeResult = await manager.handleButtonInteraction(interaction as ButtonInteraction);
        expect(executeResult.success).toBe(true);
      });

      it("should handle Discord API failures", async () => {
        (mockInteraction.reply as any).mockRejectedValue(new Error("Discord API failed"));

        const handler = createMockHandler();
        await manager.registerHandler("api_fail", handler);

        const interaction = createMockInteraction("api_fail");
        const result = await manager.handleButtonInteraction(interaction as ButtonInteraction);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Discord API failed");
      });

      it("should provide error recovery mechanisms", async () => {
        // Simulate system failure
        const originalCacheSet = cacheService.set;
        (cacheService.set as any).mockRejectedValue(new Error("System failure"));

        const handler = createMockHandler();
        await manager.registerHandler("recovery_test", handler);

        // Restore functionality
        (cacheService.set as any).mockImplementation(originalCacheSet);

        // Manager should recover and function normally
        const normalHandler = createMockHandler();
        const result = await manager.registerHandler("normal_after_recovery", normalHandler);

        expect(result.success).toBe(true);
      });
    });

    describe("Resource Management", () => {
      it("should clean up expired handlers", async () => {
        const shortLivedManager = new ActionButtonManager({
          handlerTTL: 100, // Very short TTL for testing
          enableAutocleanup: true,
          cleanupInterval: 50,
        });

        const handler = createMockHandler();
        await shortLivedManager.registerHandler("short_lived", handler);

        expect(await shortLivedManager.hasHandler("short_lived")).toBe(true);

        // Wait for expiration and cleanup
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(await shortLivedManager.hasHandler("short_lived")).toBe(false);
      });

      it("should handle resource exhaustion gracefully", async () => {
        const limitedManager = new ActionButtonManager({ maxHandlers: 2 });

        // Fill up to the limit
        await limitedManager.registerHandler("handler1", createMockHandler());
        await limitedManager.registerHandler("handler2", createMockHandler());

        // Attempt to exceed limit
        const result = await limitedManager.registerHandler("handler3", createMockHandler());

        expect(result.success).toBe(false);
        expect(result.error).toContain("maximum");

        // Manager should still function for existing handlers
        const interaction = createMockInteraction("handler1");
        const executeResult = await limitedManager.handleButtonInteraction(interaction as ButtonInteraction);
        expect(executeResult.success).toBe(true);
      });

      it("should dispose resources properly", async () => {
        const disposableManager = new ActionButtonManager();

        // Register some handlers
        await disposableManager.registerHandler("disposable1", createMockHandler());
        await disposableManager.registerHandler("disposable2", createMockHandler());

        // Dispose should clean up everything
        await disposableManager.dispose();

        const handlers = await disposableManager.listHandlers();
        expect(handlers).toHaveLength(0);

        // Manager should not accept new operations after disposal
        const result = await disposableManager.registerHandler("after_dispose", createMockHandler());
        expect(result.success).toBe(false);
        expect(result.error).toContain("disposed");
      });
    });
  });

  describe("Advanced Features", () => {
    describe("Event System", () => {
      it("should emit handler execution events", async () => {
        const executionStartHandler = vi.fn();
        const executionEndHandler = vi.fn();

        manager.on("handlerExecutionStart", executionStartHandler);
        manager.on("handlerExecutionEnd", executionEndHandler);

        const handler = createMockHandler();
        await manager.registerHandler("event_test", handler);

        const eventInteraction = createMockInteraction("event_test");
        await manager.handleButtonInteraction(eventInteraction as ButtonInteraction);

        expect(executionStartHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            handlerId: "event_test",
            userId: "user123",
            startTime: expect.any(Date),
          })
        );

        expect(executionEndHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            handlerId: "event_test",
            userId: "user123",
            success: true,
            executionTime: expect.any(Number),
          })
        );
      });

      it("should emit error events", async () => {
        const errorHandler = vi.fn();
        manager.on("handlerError", errorHandler);

        const failingHandler = createMockHandler("error");
        await manager.registerHandler("error_event", failingHandler);

        const errorInteraction = createMockInteraction("error_event");
        await manager.handleButtonInteraction(errorInteraction as ButtonInteraction);

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            handlerId: "error_event",
            error: expect.any(Error),
            userId: "user123",
          })
        );
      });

      it("should support custom events", async () => {
        const customEventHandler = vi.fn();
        manager.on("customEvent", customEventHandler);

        manager.emit("customEvent", { data: "test" });

        expect(customEventHandler).toHaveBeenCalledWith({ data: "test" });
      });
    });

    describe("Plugin System", () => {
      it("should support plugins", async () => {
        const plugin = {
          name: "test-plugin",
          version: "1.0.0",
          install: vi.fn(),
          uninstall: vi.fn(),
        };

        const result = await manager.installPlugin(plugin);

        expect(result.success).toBe(true);
        expect(plugin.install).toHaveBeenCalledWith(manager);

        const installedPlugins = await manager.getInstalledPlugins();
        expect(installedPlugins).toContain("test-plugin");
      });

      it("should uninstall plugins", async () => {
        const plugin = {
          name: "removable-plugin",
          version: "1.0.0",
          install: vi.fn(),
          uninstall: vi.fn(),
        };

        await manager.installPlugin(plugin);
        const result = await manager.uninstallPlugin("removable-plugin");

        expect(result.success).toBe(true);
        expect(plugin.uninstall).toHaveBeenCalledWith(manager);
      });

      it("should prevent duplicate plugin installation", async () => {
        const plugin = {
          name: "duplicate-plugin",
          version: "1.0.0",
          install: vi.fn(),
          uninstall: vi.fn(),
        };

        await manager.installPlugin(plugin);
        const result = await manager.installPlugin(plugin);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already installed");
      });
    });

    describe("Configuration Management", () => {
      it("should update configuration at runtime", async () => {
        const newConfig = {
          maxHandlers: 200,
          defaultTimeout: 60000,
        };

        const result = await manager.updateConfiguration(newConfig);

        expect(result.success).toBe(true);

        const currentConfig = await manager.getConfiguration();
        expect(currentConfig.maxHandlers).toBe(200);
        expect(currentConfig.defaultTimeout).toBe(60000);
      });

      it("should validate configuration changes", async () => {
        const invalidConfig = {
          maxHandlers: -1, // Invalid
          defaultTimeout: 0, // Invalid
        };

        const result = await manager.updateConfiguration(invalidConfig);

        expect(result.success).toBe(false);
        expect(result.errors).toContain("maxHandlers must be positive");
        expect(result.errors).toContain("defaultTimeout must be positive");
      });

      it("should export and import configuration", async () => {
        const originalConfig = await manager.getConfiguration();
        const exportedConfig = await manager.exportConfiguration();

        // Create new manager and import config
        const newManager = new ActionButtonManager();
        const importResult = await newManager.importConfiguration(exportedConfig);

        expect(importResult.success).toBe(true);

        const importedConfig = await newManager.getConfiguration();
        expect(importedConfig).toEqual(originalConfig);
      });
    });

    describe("Debugging and Development", () => {
      it("should provide debug information", async () => {
        const handler = createMockHandler();
        await manager.registerHandler("debug_test", handler);

        const debugInfo = await manager.getDebugInfo("debug_test");

        expect(debugInfo).toBeDefined();
        expect(debugInfo.handlerId).toBe("debug_test");
        expect(debugInfo.registered).toBeInstanceOf(Date);
        expect(debugInfo.metadata).toBeDefined();
        expect(debugInfo.metrics).toBeDefined();
      });

      it("should support dry run mode", async () => {
        const handler = vi.fn();
        await manager.registerHandler("dry_run_test", handler);

        const dryRunInteraction = createMockInteraction("dry_run_test");
        const result = await manager.handleButtonInteraction(dryRunInteraction as ButtonInteraction, {
          dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
        expect(handler).not.toHaveBeenCalled(); // Handler should not execute in dry run
      });

      it("should validate handler configurations", async () => {
        const validationResults = await manager.validateHandlers();

        expect(validationResults).toBeDefined();
        expect(validationResults.valid).toBe(true);
        expect(validationResults.issues).toEqual([]);
      });

      it("should provide performance profiling", async () => {
        const handler = createMockHandler();
        await manager.registerHandler("profile_test", handler);

        const profileInteraction = createMockInteraction("profile_test");
        const result = await manager.handleButtonInteraction(profileInteraction as ButtonInteraction, {
          profile: true,
        });

        expect(result.success).toBe(true);
        expect(result.profile).toBeDefined();
        expect(result.profile.executionTime).toBeGreaterThan(0);
        expect(result.profile.memoryUsage).toBeDefined();
      });
    });
  });
});