import { describe, it, expect, beforeEach, vi } from "vitest";
import { SelectMenuBuilder, ActionRowBuilder } from "discord.js";
import { createForumSelectionUI } from "../forumSelectionUI";

describe("forumSelectionUI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createForumSelectionUI", () => {
    it("should create forum selection UI with options", () => {
      const forums = [
        { id: "forum1", name: "Bug Reports", emoji: "🐛" },
        { id: "forum2", name: "Feature Requests", emoji: "🚀" },
        { id: "forum3", name: "Support", emoji: "❓" },
      ];

      const result = createForumSelectionUI(forums);

      expect(result).toBeDefined();
      expect(result.components).toHaveLength(1);

      const actionRow = result.components[0] as ActionRowBuilder<SelectMenuBuilder>;
      expect(actionRow.components).toHaveLength(1);

      const selectMenu = actionRow.components[0];
      expect(selectMenu.data.custom_id).toBe("forum_select");
      expect(selectMenu.data.placeholder).toBe("Select a forum...");
      expect(selectMenu.data.options).toHaveLength(3);
      
      expect(selectMenu.data.options![0]).toEqual(
        expect.objectContaining({
          label: "Bug Reports",
          value: "forum1",
          emoji: { name: "🐛" },
        })
      );
    });

    it("should handle forums without emojis", () => {
      const forums = [
        { id: "forum1", name: "General", emoji: "" },
        { id: "forum2", name: "Discussion" },
      ];

      const result = createForumSelectionUI(forums);
      const actionRow = result.components[0] as ActionRowBuilder<SelectMenuBuilder>;
      const selectMenu = actionRow.components[0];

      expect(selectMenu.data.options![0].emoji).toBeUndefined();
      expect(selectMenu.data.options![1].emoji).toBeUndefined();
    });

    it("should handle empty forum list", () => {
      const result = createForumSelectionUI([]);

      const actionRow = result.components[0] as ActionRowBuilder<SelectMenuBuilder>;
      const selectMenu = actionRow.components[0];

      expect(selectMenu.data.options).toHaveLength(0);
      expect(selectMenu.data.placeholder).toBe("No forums available");
    });

    it("should limit to 25 forum options", () => {
      const forums = Array.from({ length: 30 }, (_, i) => ({
        id: `forum${i}`,
        name: `Forum ${i}`,
        emoji: "📁",
      }));

      const result = createForumSelectionUI(forums);
      const actionRow = result.components[0] as ActionRowBuilder<SelectMenuBuilder>;
      const selectMenu = actionRow.components[0];

      expect(selectMenu.data.options).toHaveLength(25);
    });
  });
});