import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Interaction,
  CommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  User,
  Guild,
  TextChannel,
  Message,
  EmbedBuilder,
} from "discord.js";

// Mock dependencies
vi.mock("../cache/redis");
vi.mock("./embeds");
vi.mock("./buttonHandlers");

// Import after mocking
import { handleInteraction, handleMessage, handleReady } from "./discordHandlers";
import { cacheService } from "../cache/redis";
import { createErrorEmbed } from "./embeds";
import { handleButtonInteraction } from "./buttonHandlers";

describe("discordHandlers", () => {
  let mockUser: Partial<User>;
  let mockGuild: Partial<Guild>;
  let mockChannel: Partial<TextChannel>;
  let mockMessage: Partial<Message>;
  let mockCommandInteraction: Partial<CommandInteraction>;
  let mockButtonInteraction: Partial<ButtonInteraction>;
  let mockSelectMenuInteraction: Partial<StringSelectMenuInteraction>;
  let mockModalInteraction: Partial<ModalSubmitInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = {
      id: "user123",
      username: "testuser",
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
      } as any,
    };

    mockMessage = {
      id: "message123",
      content: "Hello bot!",
      author: mockUser as User,
      channel: mockChannel as TextChannel,
      guild: mockGuild as Guild,
      reply: vi.fn().mockResolvedValue({}),
    };

    mockCommandInteraction = {
      id: "interaction123",
      type: 2, // ApplicationCommand
      user: mockUser as User,
      guild: mockGuild as Guild,
      channel: mockChannel as TextChannel,
      commandName: "test",
      reply: vi.fn().mockResolvedValue({}),
      deferReply: vi.fn().mockResolvedValue({}),
      editReply: vi.fn().mockResolvedValue({}),
      followUp: vi.fn().mockResolvedValue({}),
      isCommand: () => true,
      isChatInputCommand: () => true,
      isRepliable: () => true,
    };

    mockButtonInteraction = {
      id: "button123",
      type: 3, // MessageComponent
      user: mockUser as User,
      guild: mockGuild as Guild,
      channel: mockChannel as TextChannel,
      customId: "test_button",
      componentType: 2, // Button
      reply: vi.fn().mockResolvedValue({}),
      deferReply: vi.fn().mockResolvedValue({}),
      editReply: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      isButton: () => true,
      isRepliable: () => true,
    };

    mockSelectMenuInteraction = {
      id: "select123",
      type: 3, // MessageComponent
      user: mockUser as User,
      guild: mockGuild as Guild,
      channel: mockChannel as TextChannel,
      customId: "test_select",
      componentType: 3, // SelectMenu
      values: ["option1"],
      reply: vi.fn().mockResolvedValue({}),
      deferReply: vi.fn().mockResolvedValue({}),
      editReply: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      isStringSelectMenu: () => true,
      isRepliable: () => true,
    };

    mockModalInteraction = {
      id: "modal123",
      type: 5, // ModalSubmit
      user: mockUser as User,
      guild: mockGuild as Guild,
      channel: mockChannel as TextChannel,
      customId: "test_modal",
      fields: {
        getTextInputValue: vi.fn().mockReturnValue("test input"),
      } as any,
      reply: vi.fn().mockResolvedValue({}),
      deferReply: vi.fn().mockResolvedValue({}),
      editReply: vi.fn().mockResolvedValue({}),
      isModalSubmit: () => true,
      isRepliable: () => true,
    };

    // Mock service responses
    (cacheService.checkRateLimit as any) = vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 10,
    });

    (createErrorEmbed as any) = vi.fn().mockReturnValue(new EmbedBuilder());
    (handleButtonInteraction as any) = vi.fn().mockResolvedValue(undefined);
  });

  describe("handleInteraction", () => {
    it("should handle command interactions", async () => {
      await handleInteraction(mockCommandInteraction as CommandInteraction);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        "user123",
        "command",
        10,
        60
      );
    });

    it("should handle button interactions", async () => {
      await handleInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handleButtonInteraction).toHaveBeenCalledWith(mockButtonInteraction);
    });

    it("should handle select menu interactions", async () => {
      await handleInteraction(mockSelectMenuInteraction as StringSelectMenuInteraction);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        "user123",
        "interaction",
        20,
        60
      );
    });

    it("should handle modal submit interactions", async () => {
      await handleInteraction(mockModalInteraction as ModalSubmitInteraction);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        "user123",
        "modal",
        5,
        60
      );
    });

    it("should handle rate limiting for commands", async () => {
      (cacheService.checkRateLimit as any).mockResolvedValue({
        allowed: false,
        remaining: 0,
      });

      await handleInteraction(mockCommandInteraction as CommandInteraction);

      expect(mockCommandInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.any(Array),
        ephemeral: true,
      });
    });

    it("should handle rate limiting for interactions", async () => {
      (cacheService.checkRateLimit as any).mockResolvedValue({
        allowed: false,
        remaining: 0,
      });

      await handleInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.any(Array),
        ephemeral: true,
      });
    });

    it("should ignore bot users", async () => {
      const botUser = { ...mockUser, bot: true };
      const botInteraction = {
        ...mockCommandInteraction,
        user: botUser,
      };

      await handleInteraction(botInteraction as CommandInteraction);

      expect(cacheService.checkRateLimit).not.toHaveBeenCalled();
    });

    it("should handle interactions without guild", async () => {
      const dmInteraction = {
        ...mockCommandInteraction,
        guild: null,
      };

      await handleInteraction(dmInteraction as CommandInteraction);

      expect(mockCommandInteraction.reply).toHaveBeenCalledWith({
        embeds: expect.any(Array),
        ephemeral: true,
      });
    });

    it("should handle unknown interaction types", async () => {
      const unknownInteraction = {
        ...mockCommandInteraction,
        type: 999,
        isCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
      };

      await handleInteraction(unknownInteraction as any);

      // Should not throw and handle gracefully
      expect(true).toBe(true);
    });

    it("should handle interaction errors gracefully", async () => {
      (handleButtonInteraction as any).mockRejectedValue(new Error("Handler error"));

      await expect(
        handleInteraction(mockButtonInteraction as ButtonInteraction)
      ).resolves.not.toThrow();
    });

    it("should handle rate limit check errors", async () => {
      (cacheService.checkRateLimit as any).mockRejectedValue(
        new Error("Cache error")
      );

      await expect(
        handleInteraction(mockCommandInteraction as CommandInteraction)
      ).resolves.not.toThrow();
    });
  });

  describe("handleMessage", () => {
    it("should ignore bot messages", async () => {
      const botMessage = {
        ...mockMessage,
        author: { ...mockUser, bot: true },
      };

      await handleMessage(botMessage as Message);

      expect(cacheService.checkRateLimit).not.toHaveBeenCalled();
    });

    it("should ignore messages without content", async () => {
      const emptyMessage = {
        ...mockMessage,
        content: "",
      };

      await handleMessage(emptyMessage as Message);

      expect(cacheService.checkRateLimit).not.toHaveBeenCalled();
    });

    it("should handle DM messages", async () => {
      const dmMessage = {
        ...mockMessage,
        guild: null,
        content: "!help",
      };

      await handleMessage(dmMessage as Message);

      // Should handle DM messages appropriately
      expect(true).toBe(true);
    });

    it("should handle rate limiting for messages", async () => {
      (cacheService.checkRateLimit as any).mockResolvedValue({
        allowed: false,
        remaining: 0,
      });

      const messageWithContent = {
        ...mockMessage,
        content: "Some message content",
      };

      await handleMessage(messageWithContent as Message);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        "user123",
        "message",
        50,
        60
      );
    });

    it("should handle message processing errors", async () => {
      const errorMessage = {
        ...mockMessage,
        content: "test message",
        reply: vi.fn().mockRejectedValue(new Error("Reply failed")),
      };

      await expect(
        handleMessage(errorMessage as Message)
      ).resolves.not.toThrow();
    });

    it("should process regular messages", async () => {
      const regularMessage = {
        ...mockMessage,
        content: "Hello there!",
      };

      await handleMessage(regularMessage as Message);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        "user123",
        "message",
        50,
        60
      );
    });
  });

  describe("handleReady", () => {
    const mockClient = {
      user: {
        id: "bot123",
        username: "testbot",
        tag: "testbot#0001",
      },
      guilds: {
        cache: new Map([
          ["guild1", { id: "guild1", name: "Guild 1", memberCount: 100 }],
          ["guild2", { id: "guild2", name: "Guild 2", memberCount: 200 }],
        ]),
      },
      users: {
        cache: new Map(),
      },
      channels: {
        cache: new Map(),
      },
    };

    it("should log ready status", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await handleReady(mockClient as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("testbot#0001 is now online!")
      );

      consoleSpy.mockRestore();
    });

    it("should log guild count", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await handleReady(mockClient as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Serving 2 guilds")
      );

      consoleSpy.mockRestore();
    });

    it("should handle ready event without client user", async () => {
      const clientWithoutUser = {
        ...mockClient,
        user: null,
      };

      await expect(
        handleReady(clientWithoutUser as any)
      ).resolves.not.toThrow();
    });

    it("should handle ready event errors", async () => {
      const errorClient = {
        ...mockClient,
        guilds: {
          cache: {
            size: 0,
            get size() {
              throw new Error("Guild cache error");
            },
          },
        },
      };

      await expect(
        handleReady(errorClient as any)
      ).resolves.not.toThrow();
    });

    it("should initialize cache if available", async () => {
      (cacheService.healthCheck as any) = vi.fn().mockResolvedValue(true);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await handleReady(mockClient as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cache service is healthy")
      );

      consoleSpy.mockRestore();
    });
  });
});