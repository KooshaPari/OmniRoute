import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ComponentRegistry,
  ComponentTheme,
  ComponentTemplate,
} from "../ComponentRegistry";
import {
  SmartEmbedBuilder,
  SmartEmbedConfig,
} from "../SmartEmbedBuilder";
import {
  ButtonStyle,
} from "discord.js";

// Mock SmartEmbedBuilder
vi.mock("../SmartEmbedBuilder", () => ({
  SmartEmbedBuilder: vi.fn().mockImplementation((config: SmartEmbedConfig) => ({
    getState: vi.fn().mockReturnValue({ id: config.id }),
    addDynamicField: vi.fn().mockReturnThis(),
    addActionButton: vi.fn().mockReturnThis(),
    setMetadata: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  })),
}));

// Mock Discord.js
vi.mock("discord.js", () => ({
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
  },
}));

describe("ComponentRegistry", () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ComponentRegistry();
  });

  describe("Initialization", () => {
    it("should initialize with default themes", () => {
      const themes = registry.getThemes();

      expect(themes.length).toBeGreaterThan(0);

      const themeNames = themes.map(t => t.name);
      expect(themeNames).toContain("default");
      expect(themeNames).toContain("dark");
      expect(themeNames).toContain("light");
    });

    it("should set default theme as current", () => {
      const currentTheme = registry.getCurrentTheme();
      expect(currentTheme.name).toBe("default");
    });

    it("should initialize with default templates", () => {
      const templates = registry.getTemplates();

      expect(templates.length).toBeGreaterThan(0);

      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain("issue-card");
      expect(templateIds).toContain("dashboard-card");
      expect(templateIds).toContain("status-card");
      expect(templateIds).toContain("form-card");
    });
  });

  describe("Theme Management", () => {
    it("should register custom themes", () => {
      const customTheme: ComponentTheme = {
        name: "custom",
        colors: {
          primary: 0xff0000,
          secondary: 0x00ff00,
          success: 0x0000ff,
          warning: 0xffff00,
          danger: 0xff00ff,
          info: 0x00ffff,
        },
        styles: {
          primaryButton: ButtonStyle.Primary,
          secondaryButton: ButtonStyle.Secondary,
          successButton: ButtonStyle.Success,
          dangerButton: ButtonStyle.Danger,
        },
      };

      registry.registerTheme(customTheme);

      const themes = registry.getThemes();
      const customThemeFound = themes.find(t => t.name === "custom");
      expect(customThemeFound).toEqual(customTheme);
    });

    it("should switch themes", () => {
      const switched = registry.setTheme("dark");
      expect(switched).toBe(true);

      const currentTheme = registry.getCurrentTheme();
      expect(currentTheme.name).toBe("dark");
    });

    it("should return false for non-existent theme", () => {
      const switched = registry.setTheme("non-existent");
      expect(switched).toBe(false);

      // Should remain on previous theme
      const currentTheme = registry.getCurrentTheme();
      expect(currentTheme.name).toBe("default");
    });

    it("should validate theme properties", () => {
      const themes = registry.getThemes();
      
      themes.forEach(theme => {
        expect(theme).toHaveProperty("name");
        expect(theme).toHaveProperty("colors");
        expect(theme).toHaveProperty("styles");
        
        expect(theme.colors).toHaveProperty("primary");
        expect(theme.colors).toHaveProperty("secondary");
        expect(theme.colors).toHaveProperty("success");
        expect(theme.colors).toHaveProperty("warning");
        expect(theme.colors).toHaveProperty("danger");
        expect(theme.colors).toHaveProperty("info");
        
        expect(theme.styles).toHaveProperty("primaryButton");
        expect(theme.styles).toHaveProperty("secondaryButton");
        expect(theme.styles).toHaveProperty("successButton");
        expect(theme.styles).toHaveProperty("dangerButton");
      });
    });
  });

  describe("Template Management", () => {
    it("should register custom templates", () => {
      const customTemplate: ComponentTemplate = {
        id: "custom-template",
        name: "Custom Template",
        description: "A custom template",
        category: "custom",
        tags: ["custom", "test"],
        factory: (config) => new SmartEmbedBuilder(config),
      };

      registry.registerTemplate(customTemplate);

      const templates = registry.getTemplates();
      const customTemplateFound = templates.find(t => t.id === "custom-template");
      expect(customTemplateFound).toEqual(customTemplate);
    });

    it("should get templates by category", () => {
      const projectTemplates = registry.getTemplatesByCategory("project-management");
      expect(projectTemplates.length).toBeGreaterThan(0);
      
      projectTemplates.forEach(template => {
        expect(template.category).toBe("project-management");
      });

      const analyticsTemplates = registry.getTemplatesByCategory("analytics");
      expect(analyticsTemplates.length).toBeGreaterThan(0);
      
      analyticsTemplates.forEach(template => {
        expect(template.category).toBe("analytics");
      });
    });

    it("should search templates by tags", () => {
      const issueTemplates = registry.searchTemplates(["issue"]);
      expect(issueTemplates.length).toBeGreaterThan(0);
      
      issueTemplates.forEach(template => {
        expect(template.tags.some(tag => tag.includes("issue"))).toBe(true);
      });

      const managementTemplates = registry.searchTemplates(["management"]);
      expect(managementTemplates.length).toBeGreaterThan(0);
      
      managementTemplates.forEach(template => {
        expect(template.tags.some(tag => tag.includes("management"))).toBe(true);
      });
    });

    it("should search templates by multiple tags", () => {
      const templates = registry.searchTemplates(["github", "jira"]);
      expect(templates.length).toBeGreaterThan(0);
      
      templates.forEach(template => {
        const hasGithub = template.tags.some(tag => tag.includes("github"));
        const hasJira = template.tags.some(tag => tag.includes("jira"));
        expect(hasGithub || hasJira).toBe(true);
      });
    });

    it("should return empty array for non-matching tags", () => {
      const templates = registry.searchTemplates(["non-existent-tag"]);
      expect(templates).toEqual([]);
    });

    it("should handle case-insensitive tag search", () => {
      const templates = registry.searchTemplates(["ISSUE"]);
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe("Component Creation", () => {
    it("should create issue card component", () => {
      const config = {
        id: "test-issue",
        title: "Test Issue",
        description: "A test issue",
        status: "open",
        priority: "high",
        assignee: "test-user",
      };

      const _component = registry.createComponent("issue-card", config);

      expect(_component).toBeInstanceOf(SmartEmbedBuilder);
      expect((_component as any)!.getState().id).toBe("test-issue");

      const SmartEmbedBuilderMock = SmartEmbedBuilder as any;
      const instance = SmartEmbedBuilderMock.mock.instances[0];

      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "📊 Status" })
      );
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "⚡ Priority" })
      );
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "👤 Assignee" })
      );

      expect(instance.addActionButton).toHaveBeenCalledTimes(4);
    });

    it("should create dashboard card component", () => {
      const config = {
        id: "test-dashboard",
        title: "Test Dashboard",
        description: "A test dashboard",
        metrics: {
          issues: 10,
          bugs: 3,
          features: 7,
        },
        progress: {
          current: 7,
          total: 10,
        },
        refreshInterval: 120,
      };

      const _component = registry.createComponent("dashboard-card", config);

      expect(_component).toBeInstanceOf(SmartEmbedBuilder);

      const SmartEmbedBuilderMock = SmartEmbedBuilder as any;
      const instance = SmartEmbedBuilderMock.mock.instances[0];

      // Check that metrics were added as fields
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "issues", value: "10" })
      );
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "bugs", value: "3" })
      );
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "features", value: "7" })
      );

      // Check that progress bar was added
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "📈 Progress" })
      );

      // Check that refresh button was added
      expect(instance.addActionButton).toHaveBeenCalledWith(
        expect.objectContaining({ id: `refresh_${config.id}` })
      );
    });

    it("should create status card component", () => {
      const config = {
        id: "test-status",
        title: "Test Status",
        status: "online",
        uptime: "99.9%",
        refreshInterval: 30,
      };

      const _component = registry.createComponent("status-card", config);

      expect(_component).toBeInstanceOf(SmartEmbedBuilder);

      const SmartEmbedBuilderMock = SmartEmbedBuilder as any;
      const instance = SmartEmbedBuilderMock.mock.instances[0];

      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ 
          name: "Status",
          value: expect.stringContaining("🟢 ONLINE")
        })
      );

      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Uptime" })
      );

      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ 
          name: "Last Check",
          dynamic: true 
        })
      );
    });

    it("should create form card component", () => {
      const config = {
        id: "test-form",
        title: "Test Form",
        description: "A test form",
        fields: [
          { label: "Name", placeholder: "Enter your name" },
          { label: "Email", placeholder: "Enter your email" },
        ],
      };

      const _component = registry.createComponent("form-card", config);

      // Use the correct variable name from above
      expect(_component).toBeInstanceOf(SmartEmbedBuilder);

      const SmartEmbedBuilderMock = SmartEmbedBuilder as any;
      const instance = SmartEmbedBuilderMock.mock.instances[0];

      // Check that form fields were added as display fields
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Name" })
      );
      expect(instance.addDynamicField).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Email" })
      );

      // Check that form button was added
      expect(instance.addActionButton).toHaveBeenCalledWith(
        expect.objectContaining({ id: `form_${config.id}` })
      );
    });

    it("should return null for non-existent template", () => {
      const _component = registry.createComponent("non-existent", {});
      expect(_component).toBeNull();
    });

    it("should handle template factory errors", () => {
      const errorTemplate: ComponentTemplate = {
        id: "error-template",
        name: "Error Template",
        description: "Template that throws errors",
        category: "test",
        tags: ["error"],
        factory: () => {
          throw new Error("Template factory failed");
        },
      };

      registry.registerTemplate(errorTemplate);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined as any);

      const _component = registry.createComponent("error-template", {});

      expect(_component).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating component from template error-template:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Status Badges", () => {
    it("should create status badges for known statuses", () => {
      const statuses = ["open", "closed", "in_progress", "review", "done"];
      
      statuses.forEach(status => {
        const badge = registry.createStatusBadge(status);
        
        expect(badge).toHaveProperty("text");
        expect(badge).toHaveProperty("color");
        expect(badge.text).toContain(status.toUpperCase().replace("_", " "));
        expect(typeof badge.color).toBe("number");
      });
    });

    it("should create default badge for unknown status", () => {
      const badge = registry.createStatusBadge("unknown-status");
      
      expect(badge.text).toBe("UNKNOWN-STATUS");
      expect(typeof badge.color).toBe("number");
    });

    it("should handle case-insensitive status", () => {
      const badge = registry.createStatusBadge("OPEN");
      
      expect(badge.text).toContain("OPEN");
    });

    it("should create correct badges for specific statuses", () => {
      const openBadge = registry.createStatusBadge("open");
      expect(openBadge.text).toContain("🟢 OPEN");

      const closedBadge = registry.createStatusBadge("closed");
      expect(closedBadge.text).toContain("🔴 CLOSED");

      const inProgressBadge = registry.createStatusBadge("in_progress");
      expect(inProgressBadge.text).toContain("🟡 IN PROGRESS");

      const reviewBadge = registry.createStatusBadge("review");
      expect(reviewBadge.text).toContain("🔵 REVIEW");

      const doneBadge = registry.createStatusBadge("done");
      expect(doneBadge.text).toContain("✅ DONE");
    });
  });

  describe("Progress Bars", () => {
    it("should create basic progress bar", () => {
      const progressBar = registry.createProgressBar({
        current: 7,
        total: 10,
      });

      expect(progressBar).toContain("█");
      expect(progressBar).toContain("░");
      expect(progressBar).toContain("70%");
    });

    it("should create progress bar with custom width", () => {
      const progressBar = registry.createProgressBar({
        current: 5,
        total: 10,
        width: 20,
      });

      // Should have 20 total characters for the bar (excluding percentage)
      const barPart = progressBar.split(" ")[0];
      expect(barPart.length).toBe(20);
    });

    it("should create progress bar without percentage", () => {
      const progressBar = registry.createProgressBar({
        current: 7,
        total: 10,
        showPercentage: false,
      });

      expect(progressBar).not.toContain("%");
    });

    it("should create progress bar with blocks style", () => {
      const progressBar = registry.createProgressBar({
        current: 5,
        total: 10,
        style: "blocks",
      });

      expect(progressBar).toContain("█");
      expect(progressBar).toContain("░");
    });

    it("should create progress bar with dots style", () => {
      const progressBar = registry.createProgressBar({
        current: 5,
        total: 10,
        style: "dots",
      });

      expect(progressBar).toContain("●");
      expect(progressBar).toContain("○");
    });

    it("should handle edge cases", () => {
      // 0% progress
      const zeroProgress = registry.createProgressBar({
        current: 0,
        total: 10,
      });
      expect(zeroProgress).toContain("0%");
      expect(zeroProgress).toContain("░".repeat(10));

      // 100% progress
      const fullProgress = registry.createProgressBar({
        current: 10,
        total: 10,
      });
      expect(fullProgress).toContain("100%");
      expect(fullProgress).toContain("█".repeat(10));

      // Over 100%
      const overProgress = registry.createProgressBar({
        current: 15,
        total: 10,
      });
      expect(overProgress).toContain("100%");
      expect(overProgress).toContain("█".repeat(10));

      // Negative progress (should be treated as 0)
      const negativeProgress = registry.createProgressBar({
        current: -5,
        total: 10,
      });
      expect(negativeProgress).toContain("0%");
    });

    it("should handle decimal progress", () => {
      const progressBar = registry.createProgressBar({ current: 37, total: 100 });

      expect(progressBar).toContain("37%");
    });
  });

  describe("Helper Methods", () => {
    it("should get correct theme colors by type", () => {
      const getThemeColor = (registry as any).getThemeColor.bind(registry);

      // Test color mappings
      expect(getThemeColor("primary")).toBe(registry.getCurrentTheme().colors.primary);
      expect(getThemeColor("danger")).toBe(registry.getCurrentTheme().colors.danger);
      expect(getThemeColor("critical")).toBe(registry.getCurrentTheme().colors.danger);
      expect(getThemeColor("high")).toBe(registry.getCurrentTheme().colors.warning);
      expect(getThemeColor("medium")).toBe(registry.getCurrentTheme().colors.info);
      expect(getThemeColor("low")).toBe(registry.getCurrentTheme().colors.success);
      expect(getThemeColor("unknown")).toBe(registry.getCurrentTheme().colors.primary);
    });

    it("should get correct priority emojis", () => {
      const getPriorityEmoji = (registry as any).getPriorityEmoji.bind(registry);

      expect(getPriorityEmoji("critical")).toBe("🔴");
      expect(getPriorityEmoji("high")).toBe("🟠");
      expect(getPriorityEmoji("medium")).toBe("🟡");
      expect(getPriorityEmoji("low")).toBe("🟢");
      expect(getPriorityEmoji("unknown")).toBe("⚪");
    });

    it("should handle case-insensitive priority", () => {
      const getPriorityEmoji = (registry as any).getPriorityEmoji.bind(registry);

      expect(getPriorityEmoji("CRITICAL")).toBe("🔴");
      expect(getPriorityEmoji("High")).toBe("🟠");
    });
  });

  describe("Component Type Specific Features", () => {
    it("should handle different status card statuses", () => {
      const statuses = ["online", "warning", "offline"];
      
      statuses.forEach(status => {
      const _component = registry.createComponent("status-card", {
          id: `status-${status}`,
          status,
        });

        expect(_component).toBeInstanceOf(SmartEmbedBuilder);

        // Verify the status emoji was set correctly
        const SmartEmbedBuilderMock = SmartEmbedBuilder as any;
        const instance = SmartEmbedBuilderMock.mock.instances[SmartEmbedBuilderMock.mock.instances.length - 1];

        let expectedEmoji;
        switch (status) {
          case "online":
            expectedEmoji = "🟢";
            break;
          case "warning":
            expectedEmoji = "🟡";
            break;
          default:
            expectedEmoji = "🔴";
            break;
        }

        expect(instance.addDynamicField).toHaveBeenCalledWith(
          expect.objectContaining({
            value: expect.stringContaining(expectedEmoji),
          })
        );
      });
    });

    it("should handle issue card without optional fields", () => {
      const config = {
        id: "minimal-issue",
        title: "Minimal Issue",
      };

      const _component = registry.createComponent("issue-card", config);

      expect(_component).toBeInstanceOf(SmartEmbedBuilder);
    });

    it("should handle dashboard card without metrics or progress", () => {
      const config = {
        id: "minimal-dashboard",
        title: "Minimal Dashboard",
      };

      const _component = registry.createComponent("dashboard-card", config);

      expect(_component).toBeInstanceOf(SmartEmbedBuilder);
    });

    it("should handle form card without fields", () => {
      const config = {
        id: "minimal-form",
        title: "Minimal Form",
      };

      const _component = registry.createComponent("form-card", config);

      expect(_component).toBeInstanceOf(SmartEmbedBuilder);
    });
  });

  describe("Global Registry Instance", () => {
    it("should export a global registry instance", async () => {
      const { componentRegistry } = await import("../ComponentRegistry");
      // In some mocked module setups, instanceof can fail due to duplicate module contexts.
      // Prefer a duck-typing check to verify it's the expected registry instance.
      expect(typeof (componentRegistry as any).createComponent).toBe("function");
      expect(typeof (componentRegistry as any).getTemplates).toBe("function");
    });
  });
});
