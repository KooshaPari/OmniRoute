/**
 * Test suite for settings service
 * Tests forum channel mappings and team settings
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsService } from "../SettingsService";

// Create a mock Prisma client
const mockPrismaClient = {
  forumChannelConfig: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn()
  },
  teamSettings: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  }
};

// Mock Prisma client constructor
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => mockPrismaClient)
}));

vi.mock("../../logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe("SettingsService", () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsService = new SettingsService(mockPrismaClient as any);
  });

  describe("Forum Channel Settings", () => {
    it("should set forum channel mapping", async () => {
      const guildId = "guild123";
      const forumId = "forum456";
      const channelId = "channel789";

      mockPrismaClient.forumChannelConfig.upsert.mockResolvedValue({
        guildId,
        forumId,
        channelId
      });

      // Test that the method completes without error
      await expect(settingsService.setForumChannelId(guildId, forumId, channelId))
        .resolves.not.toThrow();

      expect(mockPrismaClient.forumChannelConfig.upsert).toHaveBeenCalled();
    });

    it("should get forum channel mapping", async () => {
      const guildId = "guild123";
      const forumId = "forum456";
      const channelId = "channel789";

      mockPrismaClient.forumChannelConfig.findUnique.mockResolvedValue({
        guildId,
        forumId,
        channelId
      });

      const result = await settingsService.getForumChannelId(guildId, forumId);

      expect(result).toBe(channelId);
      expect(mockPrismaClient.forumChannelConfig.findUnique).toHaveBeenCalled();
    });

    it("should return undefined for non-existent forum channel mapping", async () => {
      const guildId = "guild123";
      const forumId = "nonexistent";

      mockPrismaClient.forumChannelConfig.findUnique.mockResolvedValue(null);

      const result = await settingsService.getForumChannelId(guildId, forumId);

      expect(result).toBeUndefined();
    });

    it("should list forum mappings", async () => {
      const guildId = "guild123";
      const mappings = [
        { forumId: "forum1", channelId: "channel1" },
        { forumId: "forum2", channelId: "channel2" }
      ];

      mockPrismaClient.forumChannelConfig.findMany.mockResolvedValue(mappings);

      const result = await settingsService.listForumMappings(guildId);

      expect(result).toEqual(mappings);
      expect(mockPrismaClient.forumChannelConfig.findMany).toHaveBeenCalled();
    });
  });

  describe("Team Settings", () => {
    it("should upsert team settings", async () => {
      const teamId = "team123";
      const teamData = {
        name: "Development Team",
        description: "Main dev team",
        color: 0xff0000
      };

      mockPrismaClient.teamSettings.findUnique.mockResolvedValue(null);
      mockPrismaClient.teamSettings.create.mockResolvedValue({
        id: teamId,
        ...teamData
      });

      await expect(settingsService.upsertTeamSettings(teamId, teamData))
        .resolves.not.toThrow();

      expect(mockPrismaClient.teamSettings.findUnique).toHaveBeenCalled();
    });
  });
});