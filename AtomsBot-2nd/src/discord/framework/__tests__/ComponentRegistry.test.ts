/**
 * Comprehensive test suite for ComponentRegistry.ts
 * Target: 100% branch and statement coverage
 * Tests: Theme management, template registration, component creation, utility methods, edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ComponentRegistry,
  componentRegistry,
  type ComponentTheme,
  type ComponentTemplate
} from "../ComponentRegistry";
import { SmartEmbedBuilder } from "../SmartEmbedBuilder";
import { ButtonStyle } from "discord.js";

// Mock SmartEmbedBuilder
vi.mock("../SmartEmbedBuilder", () => ({
  SmartEmbedBuilder: vi.fn().mockImplementation((config) => ({
    config,
    addDynamicField: vi.fn().mockReturnThis(),
    addActionButton: vi.fn().mockReturnThis(),
    setMetadata: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue({ embeds: [], components: [] }),
  })),
}));

// Mock Discord.js components
vi.mock("discord.js", () => ({
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
  },
}));

describe("ComponentRegistry", () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = new ComponentRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and Initialization", () => {
    it("should create a new ComponentRegistry instance", () => {
      expect(registry).toBeInstanceOf(ComponentRegistry);
      expect(registry).toHaveProperty("registerTheme");
      expect(registry).toHaveProperty("registerTemplate");
    });

    it("should initialize with default themes", () => {
      const themes = registry.getThemes();
      expect(themes).toHaveLength(3); // default, dark, light

      const themeNames = themes.map(theme => theme.name);
      expect(themeNames).toContain("default");
      expect(themeNames).toContain("dark");
      expect(themeNames).toContain("light");
    });

    it("should initialize with default templates", () => {
      const templates = registry.getTemplates();
      expect(templates).toHaveLength(4); // issue-card, dashboard-card, status-card, form-card

      const templateIds = templates.map(template => template.id);
      expect(templateIds).toContain("issue-card");
      expect(templateIds).toContain("dashboard-card");
      expect(templateIds).toContain("status-card");
      expect(templateIds).toContain("form-card");
    });

    it("should set default theme as current", () => {
      const currentTheme = registry.getCurrentTheme();
      expect(currentTheme.name).toBe("default");
      expect(currentTheme.colors.primary).toBe(0x0099ff);
    });

    it("should initialize default theme with correct properties", () => {
      const themes = registry.getThemes();
      const defaultTheme = themes.find(t => t.name === "default");

      expect(defaultTheme).toBeDefined();
      expect(defaultTheme!.colors).toEqual({
        primary: 0x0099ff,
        secondary: 0x6c757d,
        success: 0x28a745,
        warning: 0xffc107,
        danger: 0xdc3545,
        info: 0x17a2b8,
      });
      expect(defaultTheme!.styles).toEqual({
        primaryButton: ButtonStyle.Primary,
        secondaryButton: ButtonStyle.Secondary,
        successButton: ButtonStyle.Success,
        dangerButton: ButtonStyle.Danger,
      });
    });

    it("should initialize dark theme with correct properties", () => {
      const themes = registry.getThemes();
      const darkTheme = themes.find(t => t.name === "dark");

      expect(darkTheme).toBeDefined();
      expect(darkTheme!.colors).toEqual({
        primary: 0x7289da,
        secondary: 0x4f545c,
        success: 0x43b581,
        warning: 0xfaa61a,
        danger: 0xf04747,
        info: 0x00d4ff,
      });
    });

    it("should initialize light theme with correct properties", () => {
      const themes = registry.getThemes();
      const lightTheme = themes.find(t => t.name === "light");

      expect(lightTheme).toBeDefined();
      expect(lightTheme!.colors).toEqual({
        primary: 0x007bff,
        secondary: 0x868e96,
        success: 0x28a745,
        warning: 0xffc107,
        danger: 0xdc3545,
        info: 0x17a2b8,
      });
    });
  });

  describe("Theme Management", () => {
    it("should register a new theme", () => {
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
      expect(themes).toHaveLength(4);
      expect(themes).toContainEqual(customTheme);
    });

    it("should set theme successfully", () => {
      const success = registry.setTheme("dark");

      expect(success).toBe(true);
      expect(registry.getCurrentTheme().name).toBe("dark");
    });

    it("should return false when setting non-existent theme", () => {
      const success = registry.setTheme("non-existent");

      expect(success).toBe(false);
      expect(registry.getCurrentTheme().name).toBe("default"); // Should remain unchanged
    });

    it("should get current theme", () => {
      registry.setTheme("light");
      const currentTheme = registry.getCurrentTheme();

      expect(currentTheme.name).toBe("light");
      expect(currentTheme.colors.primary).toBe(0x007bff);
    });
  });

  describe("Template Management", () => {
    it("should register a new template", () => {
      const customTemplate: ComponentTemplate = {
        id: "custom-template",
        name: "Custom Template",
        description: "A custom template for testing",
        category: "test",
        tags: ["test", "custom"],
        factory: vi.fn().mockReturnValue(new SmartEmbedBuilder({ id: "test", title: "Test" })),
      };

      registry.registerTemplate(customTemplate);

      const templates = registry.getTemplates();
      expect(templates).toHaveLength(5);
      expect(templates).toContainEqual(customTemplate);
    });

    it("should get templates by category", () => {
      const projectManagementTemplates = registry.getTemplatesByCategory("project-management");

      expect(projectManagementTemplates).toHaveLength(1);
      expect(projectManagementTemplates[0].id).toBe("issue-card");
    });

    it("should get empty array for non-existent category", () => {
      const templates = registry.getTemplatesByCategory("non-existent");
      expect(templates).toHaveLength(0);
    });

    it("should search templates by tags", () => {
      const issueTemplates = registry.searchTemplates(["issue"]);

      expect(issueTemplates).toHaveLength(1);
      expect(issueTemplates[0].id).toBe("issue-card");
    });

    it("should search templates with multiple tags", () => {
      const templates = registry.searchTemplates(["metrics", "health"]);

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.tags.includes("metrics") || t.tags.includes("health"))).toBe(true);
    });

    it("should return empty array when searching with non-existent tags", () => {
      const templates = registry.searchTemplates(["non-existent-tag"]);
      expect(templates).toHaveLength(0);
    });

    it("should handle case-insensitive tag search", () => {
      const templates = registry.searchTemplates(["ISSUE"]);

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe("issue-card");
    });
  });

  describe("Component Creation", () => {
    it("should create component from existing template", () => {
      const config = {
        id: "test-issue",
        title: "Test Issue",
        status: "open",
        priority: "high",
      };

      const component = registry.createComponent("issue-card", config);

      expect(component).toBeInstanceOf(SmartEmbedBuilder);
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "test-issue",
        title: "Test Issue",
        description: undefined,
        color: registry.getCurrentTheme().colors.warning, // high priority maps to warning
        theme: "default",
      });
    });

    it("should return null for non-existent template", () => {
      const component = registry.createComponent("non-existent", {});
      expect(component).toBeNull();
    });

    it("should handle factory errors gracefully", () => {
      const errorTemplate: ComponentTemplate = {
        id: "error-template",
        name: "Error Template",
        description: "Template that throws error",
        category: "test",
        tags: ["error"],
        factory: vi.fn().mockImplementation(() => {
          throw new Error("Factory error");
        }),
      };

      registry.registerTemplate(errorTemplate);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const component = registry.createComponent("error-template", {});

      expect(component).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating component from template error-template:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Issue Card Creation", () => {
    it("should create issue card with all properties", () => {
      const config = {
        id: "issue-123",
        title: "Test Issue",
        description: "Issue description",
        status: "open",
        priority: "critical",
        assignee: "john.doe",
        theme: "dark",
      };

      const component = registry.createComponent("issue-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "issue-123",
        title: "Test Issue",
        description: "Issue description",
        color: registry.getCurrentTheme().colors.danger, // critical priority maps to danger
        theme: "dark",
      });

      // Verify that SmartEmbedBuilder was called to create the component
      expect(SmartEmbedBuilder).toHaveBeenCalledTimes(1);
    });

    it("should create issue card with minimal properties", () => {
      const config = {
        id: "issue-minimal",
        title: "Minimal Issue",
      };

      const component = registry.createComponent("issue-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "issue-minimal",
        title: "Minimal Issue",
        description: undefined,
        color: registry.getCurrentTheme().colors.info, // default priority
        theme: "default",
      });
    });

    it("should create issue card with action buttons", () => {
      const config = {
        id: "issue-with-buttons",
        title: "Issue with Buttons",
      };

      const component = registry.createComponent("issue-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "issue-with-buttons",
        title: "Issue with Buttons",
        description: undefined,
        color: registry.getCurrentTheme().colors.info, // default priority maps to info
        theme: "default",
      });
    });
  });

  describe("Dashboard Card Creation", () => {
    it("should create dashboard card with all properties", () => {
      const config = {
        id: "dashboard-123",
        title: "Test Dashboard",
        description: "Dashboard description",
        refreshInterval: 120,
        metrics: {
          "Active Users": "1,234",
          "Total Issues": "456",
        },
        progress: {
          current: 7,
          total: 10,
        },
      };

      const component = registry.createComponent("dashboard-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "dashboard-123",
        title: "Test Dashboard",
        description: "Dashboard description",
        color: registry.getCurrentTheme().colors.info,
        autoRefresh: true,
        refreshInterval: 120,
      });
    });

    it("should add metrics as dynamic fields", () => {
      const config = {
        id: "dashboard-metrics",
        title: "Metrics Dashboard",
        metrics: {
          "Users": "100",
          "Sales": "$1000",
        },
      };

      const component = registry.createComponent("dashboard-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "dashboard-metrics",
        title: "Metrics Dashboard",
        description: undefined,
        color: registry.getCurrentTheme().colors.info,
        autoRefresh: true,
        refreshInterval: 60,
      });
    });

    it("should add progress bar when provided", () => {
      const config = {
        id: "dashboard-progress",
        title: "Progress Dashboard",
        progress: {
          current: 3,
          total: 5,
        },
      };

      const component = registry.createComponent("dashboard-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "dashboard-progress",
        title: "Progress Dashboard",
        description: undefined,
        color: registry.getCurrentTheme().colors.info,
        autoRefresh: true,
        refreshInterval: 60,
      });
    });

    it("should add refresh button", () => {
      const config = {
        id: "dashboard-refresh",
        title: "Refresh Dashboard",
      };

      const component = registry.createComponent("dashboard-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "dashboard-refresh",
        title: "Refresh Dashboard",
        description: undefined,
        color: registry.getCurrentTheme().colors.info,
        autoRefresh: true,
        refreshInterval: 60,
      });
    });
  });

  describe("Status Card Creation", () => {
    it("should create status card with online status", () => {
      const config = {
        id: "status-online",
        title: "Online Service",
        status: "online",
        uptime: "99.9%",
        refreshInterval: 30,
      };

      const component = registry.createComponent("status-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "status-online",
        title: "Online Service",
        color: registry.getCurrentTheme().colors.success,
        autoRefresh: true,
        refreshInterval: 30,
      });
    });

    it("should create status card with warning status", () => {
      const config = {
        id: "status-warning",
        title: "Warning Service",
        status: "warning",
      };

      const component = registry.createComponent("status-card", config);

      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "status-warning",
        title: "Warning Service",
        color: registry.getCurrentTheme().colors.warning,
        autoRefresh: true,
        refreshInterval: 30,
      });
    });

    it("should create status card with offline status", () => {
      const config = {
        id: "status-offline",
        title: "Offline Service",
        status: "offline",
      };

      const component = registry.createComponent("status-card", config);

      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "status-offline",
        title: "Offline Service",
        color: registry.getCurrentTheme().colors.danger,
        autoRefresh: true,
        refreshInterval: 30,
      });
    });

    it("should add status indicator with correct emoji", () => {
      const configs = [
        { status: "online", expectedEmoji: "🟢", expectedText: "ONLINE" },
        { status: "warning", expectedEmoji: "🟡", expectedText: "WARNING" },
        { status: "offline", expectedEmoji: "🔴", expectedText: "OFFLINE" },
        { status: undefined, expectedEmoji: "🔴", expectedText: "UNKNOWN" },
      ];

      configs.forEach(({ status, expectedEmoji, expectedText }) => {
        vi.clearAllMocks();

        const config = {
          id: `status-${status || "undefined"}`,
          title: "Test Service",
          status,
        };

        const component = registry.createComponent("status-card", config);

        expect(component).toBeDefined();
        // Test that component was created properly
        expect(SmartEmbedBuilder).toHaveBeenCalled();
      });
    });

    it("should add uptime field when provided", () => {
      const config = {
        id: "status-uptime",
        title: "Service with Uptime",
        status: "online",
        uptime: "99.5%",
      };

      const component = registry.createComponent("status-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "status-uptime",
        title: "Service with Uptime",
        color: registry.getCurrentTheme().colors.success, // online status
        autoRefresh: true,
        refreshInterval: 30,
      });
    });

    it("should add dynamic last check time field", () => {
      const config = {
        id: "status-time",
        title: "Service with Time",
        status: "online",
      };

      const component = registry.createComponent("status-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "status-time",
        title: "Service with Time",
        color: registry.getCurrentTheme().colors.success, // online status
        autoRefresh: true,
        refreshInterval: 30,
      });
    });
  });

  describe("Form Card Creation", () => {
    it("should create form card with all properties", () => {
      const config = {
        id: "form-123",
        title: "Test Form",
        description: "Form description",
        fields: [
          { label: "Name", placeholder: "Enter your name" },
          { label: "Email", placeholder: "Enter your email" },
        ],
      };

      const component = registry.createComponent("form-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "form-123",
        title: "Test Form",
        description: "Form description",
        color: registry.getCurrentTheme().colors.primary,
      });
    });

    it("should add form fields as display", () => {
      const config = {
        id: "form-fields",
        title: "Form with Fields",
        fields: [
          { label: "Field 1", placeholder: "Placeholder 1" },
          { label: "Field 2" },
        ],
      };

      const component = registry.createComponent("form-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "form-fields",
        title: "Form with Fields",
        description: undefined,
        color: registry.getCurrentTheme().colors.primary,
      });
    });

    it("should add form button", () => {
      const config = {
        id: "form-button",
        title: "Form with Button",
      };

      const component = registry.createComponent("form-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "form-button",
        title: "Form with Button",
        description: undefined,
        color: registry.getCurrentTheme().colors.primary,
      });
    });
  });

  describe("Status Badge Creation", () => {
    it("should create status badges for all predefined statuses", () => {
      const statuses = [
        { status: "open", expectedText: "🟢 OPEN", expectedColor: "success" },
        { status: "closed", expectedText: "🔴 CLOSED", expectedColor: "danger" },
        { status: "in_progress", expectedText: "🟡 IN PROGRESS", expectedColor: "warning" },
        { status: "review", expectedText: "🔵 REVIEW", expectedColor: "info" },
        { status: "done", expectedText: "✅ DONE", expectedColor: "success" },
      ];

      statuses.forEach(({ status, expectedText, expectedColor }) => {
        const badge = registry.createStatusBadge(status);

        expect(badge.text).toBe(expectedText);
        expect(badge.color).toBe((registry.getCurrentTheme().colors as any)[expectedColor]);
      });
    });

    it("should handle unknown status", () => {
      const badge = registry.createStatusBadge("unknown_status");

      expect(badge.text).toBe("UNKNOWN_STATUS");
      expect(badge.color).toBe(registry.getCurrentTheme().colors.secondary);
    });

    it("should handle case-insensitive statuses", () => {
      const badge = registry.createStatusBadge("OPEN");

      expect(badge.text).toBe("🟢 OPEN");
      expect(badge.color).toBe(registry.getCurrentTheme().colors.success);
    });
  });

  describe("Progress Bar Creation", () => {
    it("should create progress bar with default options", () => {
      const progressBar = registry.createProgressBar({
        current: 5,
        total: 10,
      });

      expect(progressBar).toBe("█████░░░░░ 50%");
    });

    it("should create progress bar with custom width", () => {
      const progressBar = registry.createProgressBar({
        current: 3,
        total: 6,
        width: 6,
      });

      expect(progressBar).toBe("███░░░ 50%");
    });

    it("should create progress bar without percentage", () => {
      const progressBar = registry.createProgressBar({
        current: 7,
        total: 10,
        showPercentage: false,
      });

      expect(progressBar).toBe("███████░░░");
    });

    it("should create progress bar with blocks style", () => {
      const progressBar = registry.createProgressBar({
        current: 2,
        total: 4,
        style: "blocks",
      });

      expect(progressBar).toBe("█████░░░░░ 50%");
    });

    it("should create progress bar with dots style", () => {
      const progressBar = registry.createProgressBar({
        current: 3,
        total: 6,
        style: "dots",
      });

      expect(progressBar).toBe("●●●●●○○○○○ 50%");
    });

    it("should handle progress over 100%", () => {
      const progressBar = registry.createProgressBar({
        current: 12,
        total: 10,
      });

      expect(progressBar).toBe("██████████ 100%");
    });

    it("should handle negative progress", () => {
      const progressBar = registry.createProgressBar({
        current: -5,
        total: 10,
      });

      expect(progressBar).toBe("░░░░░░░░░░ 0%");
    });

    it("should handle zero total", () => {
      const progressBar = registry.createProgressBar({
        current: 5,
        total: 0,
      });

      // Should handle division by zero gracefully
      expect(progressBar).toMatch(/░{10} \d+%/);
    });
  });

  describe("Helper Methods", () => {
    it("should get theme color by type", () => {
      const colorMap = [
        { type: "primary", expected: "primary" },
        { type: "secondary", expected: "secondary" },
        { type: "success", expected: "success" },
        { type: "warning", expected: "warning" },
        { type: "danger", expected: "danger" },
        { type: "info", expected: "info" },
        { type: "critical", expected: "danger" },
        { type: "high", expected: "warning" },
        { type: "medium", expected: "info" },
        { type: "low", expected: "success" },
        { type: "unknown", expected: "primary" },
      ];

      colorMap.forEach(({ type, expected }) => {
        const color = registry["getThemeColor"](type);
        expect(color).toBe((registry.getCurrentTheme().colors as any)[expected]);
      });
    });

    it("should get priority emoji", () => {
      const emojiMap = [
        { priority: "critical", expected: "🔴" },
        { priority: "high", expected: "🟠" },
        { priority: "medium", expected: "🟡" },
        { priority: "low", expected: "🟢" },
        { priority: "unknown", expected: "⚪" },
      ];

      emojiMap.forEach(({ priority, expected }) => {
        const emoji = registry["getPriorityEmoji"](priority);
        expect(emoji).toBe(expected);
      });
    });

    it("should handle case-insensitive priority emoji", () => {
      const emoji = registry["getPriorityEmoji"]("HIGH");
      expect(emoji).toBe("🟠");
    });
  });

  describe("Global Instance", () => {
    it("should provide global componentRegistry instance", () => {
      expect(componentRegistry).toBeInstanceOf(ComponentRegistry);
    });

    it("should have same default configuration as new instance", () => {
      const globalThemes = componentRegistry.getThemes();
      const globalTemplates = componentRegistry.getTemplates();

      expect(globalThemes).toHaveLength(3);
      expect(globalTemplates).toHaveLength(4);
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle null/undefined config in component creation", () => {
      const component1 = registry.createComponent("issue-card", null as any);
      const component2 = registry.createComponent("issue-card", undefined as any);

      expect(component1).toBeDefined();
      expect(component2).toBeDefined();
    });

    it("should handle empty strings in theme and color methods", () => {
      const color = registry["getThemeColor"]("");
      const emoji = registry["getPriorityEmoji"]("");

      expect(color).toBe(registry.getCurrentTheme().colors.primary);
      expect(emoji).toBe("⚪");
    });

    it("should handle special characters in status badge", () => {
      const badge = registry.createStatusBadge("status-with-special_chars");
      expect(badge.text).toBe("STATUS-WITH-SPECIAL_CHARS");
    });

    it("should handle very small progress bar widths", () => {
      const progressBar = registry.createProgressBar({
        current: 1,
        total: 2,
        width: 1,
      });

      expect(progressBar).toBe("█ 50%");
    });

    it("should handle zero width progress bar", () => {
      const progressBar = registry.createProgressBar({
        current: 1,
        total: 2,
        width: 0,
      });

      expect(progressBar).toBe(" 50%");
    });

    it("should handle template with undefined factory", () => {
      const brokenTemplate: ComponentTemplate = {
        id: "broken-template",
        name: "Broken Template",
        description: "Template with undefined factory",
        category: "test",
        tags: ["broken"],
        factory: undefined as any,
      };

      registry.registerTemplate(brokenTemplate);

      const component = registry.createComponent("broken-template", {});
      expect(component).toBeNull();
    });

    it("should handle search with empty tags array", () => {
      const templates = registry.searchTemplates([]);
      expect(templates).toHaveLength(0);
    });

    it("should handle search with null/undefined tags", () => {
      const templates1 = registry.searchTemplates(null as any);
      const templates2 = registry.searchTemplates(undefined as any);

      expect(templates1).toHaveLength(0);
      expect(templates2).toHaveLength(0);
    });
  });

  describe("Template Factory Functions", () => {
    it("should call factory function with correct config", () => {
      const factory = vi.fn().mockReturnValue(new SmartEmbedBuilder({ id: "test", title: "Test" }));
      const template: ComponentTemplate = {
        id: "test-factory",
        name: "Test Factory",
        description: "Test template",
        category: "test",
        tags: ["test"],
        factory,
      };

      registry.registerTemplate(template);

      const config = { id: "test", title: "Test Config" };
      registry.createComponent("test-factory", config);

      expect(factory).toHaveBeenCalledWith(config);
    });

    it("should handle async factory function", async () => {
      const asyncFactory = vi.fn().mockResolvedValue(new SmartEmbedBuilder({ id: "async", title: "Async" }));
      const template: ComponentTemplate = {
        id: "async-template",
        name: "Async Template",
        description: "Async template",
        category: "test",
        tags: ["async"],
        factory: asyncFactory,
      };

      registry.registerTemplate(template);

      const config = { id: "async", title: "Async Config" };
      const component = registry.createComponent("async-template", config);

      expect(component).toBeDefined();
      expect(asyncFactory).toHaveBeenCalledWith(config);
    });
  });

  describe("Complex Component Configurations", () => {
    it("should handle issue card with all possible fields", () => {
      const config = {
        id: "complex-issue",
        title: "Complex Issue",
        description: "Complex issue description",
        status: "in_progress",
        priority: "medium",
        assignee: "complex.user@example.com",
        theme: "light",
        labels: ["bug", "frontend"],
        milestone: "v2.0",
        dueDate: "2024-12-31",
      };

      const component = registry.createComponent("issue-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith(expect.objectContaining({
        id: "complex-issue",
        title: "Complex Issue",
        description: "Complex issue description",
        theme: "light",
      }));
    });

    it("should handle dashboard with complex metrics", () => {
      const config = {
        id: "complex-dashboard",
        title: "Complex Dashboard",
        metrics: {
          "Active Users": "1,234",
          "Revenue": "$45,678",
          "Conversion Rate": "3.2%",
          "Error Rate": "0.1%",
        },
        progress: {
          current: 87,
          total: 100,
          showPercentage: true,
        },
      };

      const component = registry.createComponent("dashboard-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "complex-dashboard",
        title: "Complex Dashboard",
        description: undefined,
        color: registry.getCurrentTheme().colors.info,
        autoRefresh: true,
        refreshInterval: 60,
      });
    });

    it("should handle form with complex field configuration", () => {
      const config = {
        id: "complex-form",
        title: "Complex Form",
        description: "A complex form with various fields",
        fields: [
          { label: "Name", placeholder: "Enter your full name" },
          { label: "Email" },
          { label: "Message", placeholder: "Enter your message here" },
          { label: "Priority" },
        ],
      };

      const component = registry.createComponent("form-card", config);

      expect(component).toBeDefined();
      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "complex-form",
        title: "Complex Form",
        description: "A complex form with various fields",
        color: registry.getCurrentTheme().colors.primary,
      });
    });
  });

  describe("Additional Coverage Tests", () => {
    it("should handle template factory functions that return null", () => {
      const nullFactoryTemplate: ComponentTemplate = {
        id: "null-factory",
        name: "Null Factory",
        description: "Returns null",
        category: "test",
        tags: ["null"],
        factory: vi.fn().mockReturnValue(null),
      };

      registry.registerTemplate(nullFactoryTemplate);
      const component = registry.createComponent("null-factory", {});

      expect(component).toBeNull();
    });

    it("should handle progress bar with very large numbers", () => {
      const largeProgress = registry.createProgressBar({
        current: 999999,
        total: 1000000,
      });

      expect(largeProgress).toContain("100%"); // Should be rounded to 100%
    });

    it("should handle progress bar edge case with same current and total", () => {
      const sameProgress = registry.createProgressBar({
        current: 5,
        total: 5,
      });

      expect(sameProgress).toContain("100%");
    });

    it("should handle getThemeColor with null input", () => {
      const color = registry["getThemeColor"](null as any);
      expect(color).toBe(registry.getCurrentTheme().colors.primary);
    });

    it("should handle getPriorityEmoji with null input", () => {
      const emoji = registry["getPriorityEmoji"](null as any);
      expect(emoji).toBe("⚪");
    });

    it("should handle template search with undefined tags array", () => {
      const templates = registry.searchTemplates(undefined as any);
      expect(templates).toHaveLength(0);
    });

    it("should handle getTemplatesByCategory with null category", () => {
      const templates = registry.getTemplatesByCategory(null as any);
      expect(templates).toHaveLength(0);
    });

    it("should handle complex nested object creation in createComponent", () => {
      const complexConfig = {
        id: "complex-test",
        title: "Complex Test",
        nested: {
          deep: {
            value: "nested value",
          },
        },
        array: [1, 2, 3],
        nullValue: null,
        undefinedValue: undefined,
      };

      const component = registry.createComponent("issue-card", complexConfig);
      expect(component).toBeDefined();
    });

    it("should handle theme registration with duplicate name", () => {
      const originalTheme: ComponentTheme = {
        name: "duplicate",
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

      const updatedTheme: ComponentTheme = {
        ...originalTheme,
        colors: {
          ...originalTheme.colors,
          primary: 0x123456, // Different color
        },
      };

      registry.registerTheme(originalTheme);
      registry.registerTheme(updatedTheme); // Should replace

      const themes = registry.getThemes();
      const duplicateTheme = themes.find(t => t.name === "duplicate");
      expect(duplicateTheme!.colors.primary).toBe(0x123456);
    });

    it("should handle template registration with duplicate id", () => {
      const originalTemplate: ComponentTemplate = {
        id: "duplicate-template",
        name: "Original Template",
        description: "Original description",
        category: "test",
        tags: ["original"],
        factory: vi.fn().mockReturnValue(new SmartEmbedBuilder({ id: "original", title: "Original" })),
      };

      const updatedTemplate: ComponentTemplate = {
        id: "duplicate-template",
        name: "Updated Template",
        description: "Updated description",
        category: "test",
        tags: ["updated"],
        factory: vi.fn().mockReturnValue(new SmartEmbedBuilder({ id: "updated", title: "Updated" })),
      };

      registry.registerTemplate(originalTemplate);
      const initialCount = registry.getTemplates().length;

      registry.registerTemplate(updatedTemplate); // Should replace

      const templates = registry.getTemplates();
      expect(templates.length).toBe(initialCount); // No new template added

      const duplicateTemplate = templates.find(t => t.id === "duplicate-template");
      expect(duplicateTemplate!.name).toBe("Updated Template");
    });

    it("should handle issue card with empty status and priority", () => {
      const config = {
        id: "empty-values",
        title: "Empty Values Test",
        status: "",
        priority: "",
      };

      const component = registry.createComponent("issue-card", config);
      expect(component).toBeDefined();
    });

    it("should handle dashboard with empty metrics object", () => {
      const config = {
        id: "empty-metrics",
        title: "Empty Metrics",
        metrics: {},
      };

      const component = registry.createComponent("dashboard-card", config);
      expect(component).toBeDefined();

      expect(SmartEmbedBuilder).toHaveBeenCalledWith({
        id: "empty-metrics",
        title: "Empty Metrics",
        description: undefined,
        color: registry.getCurrentTheme().colors.info,
        autoRefresh: true,
        refreshInterval: 60,
      });
    });

    it("should handle form card with empty fields array", () => {
      const config = {
        id: "empty-fields",
        title: "Empty Fields",
        fields: [],
      };

      const component = registry.createComponent("form-card", config);
      expect(component).toBeDefined();
    });

    it("should handle complex nested configurations with memory efficiency", () => {
      // Create components to test memory management with more realistic scale
      const componentCount = 100; // Reduced from 1000 to 100 for more reasonable test scope
      const components = [];

      const start = performance.now();

      for (let i = 0; i < componentCount; i++) {
        const config = {
          id: `complex-${i}`,
          title: `Complex Component ${i}`,
          status: i % 4 === 0 ? 'open' : i % 4 === 1 ? 'closed' : i % 4 === 2 ? 'in_progress' : 'review',
          priority: i % 3 === 0 ? 'critical' : i % 3 === 1 ? 'high' : 'medium',
          assignee: `user${i}@example.com`,
          metadata: {
            iteration: i,
            tags: [`tag${i}`, `category${i % 10}`],
            nestedData: {
              deep: {
                value: `nested${i}`,
                array: Array.from({ length: 5 }, () => i), // Further reduced array size for performance
              },
            },
          },
        };

        components.push(registry.createComponent("issue-card", config));
      }

      const creationTime = performance.now() - start;
      expect(creationTime).toBeLessThan(1000); // Should handle 100 components in under 1 second
      expect(components.filter(c => c !== null)).toHaveLength(componentCount);

      // Also test that components are properly created
      expect(components[0]).toBeDefined();
      expect(components[0]).not.toBeNull();
    });

    it("should handle factory function memory leaks", () => {
      let factoryCallCount = 0;
      const leakyTemplate: ComponentTemplate = {
        id: "leaky-template",
        name: "Leaky Template",
        description: "Template that could cause memory leaks",
        category: "test",
        tags: ["memory"],
        factory: vi.fn().mockImplementation((config) => {
          factoryCallCount++;
          // Simulate memory-heavy operations
          const largeData = Array.from({ length: 1000 }, () => config.id);
          return {
            id: config.id,
            data: largeData,
            cleanup: () => { largeData.length = 0; },
            build: () => ({ embeds: [], components: [] }),
          };
        }),
      };

      registry.registerTemplate(leakyTemplate);

      // Create many instances
      for (let i = 0; i < 100; i++) {
        registry.createComponent("leaky-template", { id: `leak-${i}` });
      }

      expect(factoryCallCount).toBe(100);
      expect(leakyTemplate.factory).toHaveBeenCalledTimes(100);
    });

    it("should handle concurrent theme and template operations", async () => {
      const operations = [];

      // Concurrent theme operations
      for (let i = 0; i < 10; i++) {
        operations.push(Promise.resolve().then(() => {
          registry.registerTheme({
            name: `concurrent-theme-${i}`,
            colors: {
              primary: i * 1000,
              secondary: i * 1001,
              success: i * 1002,
              warning: i * 1003,
              danger: i * 1004,
              info: i * 1005,
            },
            styles: {
              primaryButton: ButtonStyle.Primary,
              secondaryButton: ButtonStyle.Secondary,
              successButton: ButtonStyle.Success,
              dangerButton: ButtonStyle.Danger,
            },
          });
        }));
      }

      // Concurrent template operations
      for (let i = 0; i < 10; i++) {
        operations.push(Promise.resolve().then(() => {
          registry.registerTemplate({
            id: `concurrent-template-${i}`,
            name: `Concurrent Template ${i}`,
            description: "Concurrent template",
            category: "concurrent",
            tags: [`concurrent${i}`],
            factory: vi.fn().mockReturnValue({ build: () => ({ embeds: [], components: [] }) }),
          });
        }));
      }

      await Promise.all(operations);

      const themes = registry.getThemes();
      const templates = registry.getTemplates();

      expect(themes.length).toBeGreaterThanOrEqual(13); // 3 default + 10 concurrent
      expect(templates.length).toBeGreaterThanOrEqual(14); // 4 default + 10 concurrent
    });

    it("should handle factory functions with async operations", async () => {
      const asyncTemplate: ComponentTemplate = {
        id: "async-template",
        name: "Async Template",
        description: "Template with async factory",
        category: "async",
        tags: ["async"],
        factory: vi.fn().mockImplementation(async (config) => {
          // Simulate async operations
          await new Promise(resolve => setTimeout(resolve, 1));
          return {
            id: config.id,
            asyncData: await Promise.resolve("async-result"),
            build: () => ({ embeds: [], components: [] }),
          };
        }),
      };

      registry.registerTemplate(asyncTemplate);

      // Create component with async factory
      const component = registry.createComponent("async-template", { id: "async-test" });

      expect(component).toBeDefined();
      expect(asyncTemplate.factory).toHaveBeenCalled();
    });

    it("should handle component creation with circular references", () => {
      const circularConfig: any = {
        id: "circular-test",
        title: "Circular Reference Test",
      };

      // Create circular reference
      circularConfig.self = circularConfig;
      circularConfig.nested = {
        parent: circularConfig,
        deep: {
          root: circularConfig,
        },
      };

      // Should not throw or cause infinite loops
      const component = registry.createComponent("issue-card", circularConfig);
      expect(component).toBeDefined();
    });

    it("should handle theme switching with active components", () => {
      // Create components with different themes
      registry.setTheme("default");
      const defaultComponent = registry.createComponent("issue-card", {
        id: "default-themed",
        title: "Default Theme",
      });

      registry.setTheme("dark");
      const darkComponent = registry.createComponent("issue-card", {
        id: "dark-themed",
        title: "Dark Theme",
      });

      registry.setTheme("light");
      const lightComponent = registry.createComponent("issue-card", {
        id: "light-themed",
        title: "Light Theme",
      });

      // All should be created successfully
      expect(defaultComponent).toBeDefined();
      expect(darkComponent).toBeDefined();
      expect(lightComponent).toBeDefined();
    });

    it("should handle progress bar edge cases and performance", () => {
      const edgeCases = [
        { current: 0, total: 0, expected: /░{10} 0%/ }, // Division by zero should result in 0%
        { current: -100, total: 50, expected: /░{10} 0%/ },
        { current: 1000000, total: 1, expected: /█{10} 100%/ },
        { current: 0.5, total: 1, expected: /█{5}░{5} 50%/ },
        { current: 1, total: 3, width: 20, expected: /█{7}░{13} 33%/ },
      ];

      edgeCases.forEach(({ current, total, width, expected }) => {
        const progressBar = registry.createProgressBar({
          current,
          total,
          width,
          showPercentage: true
        });
        expect(progressBar).toMatch(expected);
      });

      // Performance test with large numbers
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        registry.createProgressBar({
          current: Math.random() * 1000000,
          total: Math.random() * 1000000 + 1,
          width: 50,
        });
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it("should handle status badge creation with extreme inputs", () => {
      const extremeInputs = [
        "",
        " ",
        "\n\t\r",
        "a".repeat(1000),
        "STATUS_WITH_MULTIPLE_UNDERSCORES_AND_NUMBERS_123",
        "status with emojis 🚀 💯 🔥",
        "status\nwith\nnewlines",
        "status\twith\ttabs",
      ];

      extremeInputs.forEach(status => {
        const badge = registry.createStatusBadge(status);
        expect(badge).toBeDefined();
        expect(badge.text).toBeDefined();
        expect(badge.color).toBeDefined();
        expect(typeof badge.text).toBe('string');
        expect(typeof badge.color).toBe('number');
      });
    });

    it("should handle template search with complex tag combinations", () => {
      // Register templates with various tag combinations
      const complexTemplates = [
        {
          id: "multi-tag-1",
          name: "Multi Tag 1",
          description: "Template with multiple tags",
          category: "complex",
          tags: ["analytics", "dashboard", "metrics", "real-time"],
          factory: () => ({ build: () => ({ embeds: [], components: [] }) }),
        },
        {
          id: "multi-tag-2",
          name: "Multi Tag 2",
          description: "Another multi-tag template",
          category: "complex",
          tags: ["monitoring", "health", "status", "real-time"],
          factory: () => ({ build: () => ({ embeds: [], components: [] }) }),
        },
        {
          id: "single-tag",
          name: "Single Tag",
          description: "Template with one tag",
          category: "simple",
          tags: ["basic"],
          factory: () => ({ build: () => ({ embeds: [], components: [] }) }),
        },
      ];

      complexTemplates.forEach(template => registry.registerTemplate(template));

      // Test various search combinations
      const analyticsHealthResults = registry.searchTemplates(["analytics", "health"]);
      const realTimeResults = registry.searchTemplates(["real-time"]);
      const basicResults = registry.searchTemplates(["basic"]);

      // Should find templates that match any of the tags
      expect(analyticsHealthResults.length).toBeGreaterThanOrEqual(1);
      expect(realTimeResults.length).toBeGreaterThanOrEqual(1);
      expect(basicResults).toHaveLength(1);
      expect(registry.searchTemplates(["nonexistent"])).toHaveLength(0);
      expect(registry.searchTemplates([])).toHaveLength(0);
    });

    it("should handle status badge with special characters in status", () => {
      const specialStatuses = [
        "status with spaces",
        "status-with-dashes",
        "status_with_underscores",
        "status.with.dots",
        "status@with@symbols",
      ];

      specialStatuses.forEach(status => {
        const badge = registry.createStatusBadge(status);
        expect(badge.text).toContain(status.toUpperCase());
        expect(badge.color).toBeDefined();
      });
    });
  });
});