import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ActionButtonManager,
  ButtonAction,
  ModalConfig,
  ConfirmationConfig,
} from "../ActionButtonManager";
import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionsBitField,
  GuildMember,
  User,
} from "discord.js";

// Mock Discord.js components
vi.mock("discord.js", () => ({
  ModalBuilder: vi.fn().mockImplementation(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setTitle: vi.fn().mockReturnThis(),
    addComponents: vi.fn().mockReturnThis(),
  })),
  TextInputBuilder: vi.fn().mockImplementation(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setLabel: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    setRequired: vi.fn().mockReturnThis(),
    setPlaceholder: vi.fn().mockReturnThis(),
    setMinLength: vi.fn().mockReturnThis(),
    setMaxLength: vi.fn().mockReturnThis(),
    setValue: vi.fn().mockReturnThis(),
  })),
  ActionRowBuilder: vi.fn().mockImplementation(() => ({
    addComponents: vi.fn().mockReturnThis(),
  })),
  ButtonBuilder: vi.fn().mockImplementation(() => ({
    setCustomId: vi.fn().mockReturnThis(),
    setLabel: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
  })),
  TextInputStyle: {
    Short: 1,
    Paragraph: 2,
  },
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
  },
  MessageFlags: {
    Ephemeral: 64,
  },
  PermissionsBitField: {
    Flags: {
      Administrator: BigInt(0x8),
      ManageMessages: BigInt(0x2000),
      ViewChannel: BigInt(0x400),
    },
  },
}));

describe("ActionButtonManager", () => {
  let manager: ActionButtonManager;
  let mockButtonInteraction: Partial<ButtonInteraction>;
  let mockSelectMenuInteraction: Partial<StringSelectMenuInteraction>;
  let mockGuildMember: Partial<GuildMember>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = new ActionButtonManager();

    mockGuildMember = {
      id: "test-user-123",
      permissions: {
        has: vi.fn().mockReturnValue(false),
      } as any,
      roles: {
        cache: new Map([
          ["role1", { name: "TestRole", id: "role1" }],
          ["role2", { name: "AdminRole", id: "role2" }],
        ]) as any,
      } as any,
    };

    mockButtonInteraction = {
      customId: "test-action",
      user: { id: "test-user-123" } as User,
      member: mockGuildMember as GuildMember,
      reply: vi.fn(),
      showModal: vi.fn(),
      editReply: vi.fn(),
      awaitMessageComponent: vi.fn(),
    };

    mockSelectMenuInteraction = {
      customId: "test-select",
      user: { id: "test-user-123" } as User,
      member: mockGuildMember as GuildMember,
      reply: vi.fn(),
      values: ["option1"],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Action Registration", () => {
    it("should register a button action", () => {
      const action: ButtonAction = {
        id: "test-action",
        type: "callback",
        handler: vi.fn(),
      };

      const emitSpy = vi.spyOn(manager, "emit");
      manager.registerAction(action);

      expect(manager.getActions()).toHaveLength(1);
      expect(manager.getActions()[0]).toEqual(action);
      expect(emitSpy).toHaveBeenCalledWith("actionRegistered", action);
    });

    it("should create quick action", () => {
      const handler = vi.fn();
      manager.createQuickAction("quick-test", "Quick Test", handler, {
        emoji: "⚡",
        style: ButtonStyle.Primary,
        permissions: ["ManageMessages"],
        cooldown: 10,
      });

      const actions = manager.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe("quick-test");
      expect(actions[0].type).toBe("callback");
      expect(actions[0].handler).toBe(handler);
      expect(actions[0].permissions).toEqual(["ManageMessages"]);
      expect(actions[0].cooldown).toBe(10);
    });

    it("should create modal action", () => {
      const modalConfig: ModalConfig = {
        id: "test-modal",
        title: "Test Modal",
        inputs: [
          {
            id: "test-input",
            label: "Test Input",
            style: TextInputStyle.Short,
            required: true,
          },
        ],
      };

      manager.createModalAction("modal-test", modalConfig, {
        permissions: ["ViewChannel"],
        cooldown: 5,
      });

      const actions = manager.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe("modal-test");
      expect(actions[0].type).toBe("modal");
      expect(actions[0].data).toEqual(modalConfig);
    });

    it("should create confirmation action", () => {
      const confirmationConfig: ConfirmationConfig = {
        title: "Confirm Action",
        description: "Are you sure?",
        confirmLabel: "Yes",
        cancelLabel: "No",
        confirmStyle: ButtonStyle.Danger,
        timeout: 30,
      };

      manager.createConfirmationAction("confirm-test", confirmationConfig, {
        permissions: ["Administrator"],
      });

      const actions = manager.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe("confirm-test");
      expect(actions[0].type).toBe("confirmation");
      expect(actions[0].data).toEqual(confirmationConfig);
    });

    it("should remove actions", () => {
      manager.createQuickAction("to-remove", "Remove Me", vi.fn());
      expect(manager.getActions()).toHaveLength(1);

      const emitSpy = vi.spyOn(manager, "emit");
      const removed = manager.removeAction("to-remove");

      expect(removed).toBe(true);
      expect(manager.getActions()).toHaveLength(0);
      expect(emitSpy).toHaveBeenCalledWith("actionRemoved", "to-remove");
    });

    it("should return false when removing non-existent action", () => {
      const removed = manager.removeAction("non-existent");
      expect(removed).toBe(false);
    });
  });

  describe("Button Interaction Handling", () => {
    it("should handle unknown action", async () => {
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Unknown action. This button may be outdated.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle callback action", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalledWith(mockButtonInteraction, undefined);
      expect(emitSpy).toHaveBeenCalledWith("actionExecuted", {
        action: expect.any(Object),
        user: mockButtonInteraction.user,
      });
    });

    it("should handle callback action with data", async () => {
      const handler = vi.fn();
      const actionData = { test: "data" };
      
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        data: actionData,
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalledWith(mockButtonInteraction, actionData);
    });

    it("should handle callback action without handler", async () => {
      manager.registerAction({
        id: "test-action",
        type: "callback",
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(emitSpy).toHaveBeenCalledWith("actionError", {
        error: expect.any(Error),
        interaction: mockButtonInteraction,
      });
    });

    it("should handle modal action", async () => {
      const modalConfig: ModalConfig = {
        id: "test-modal",
        title: "Test Modal",
        inputs: [
          {
            id: "input1",
            label: "Input 1",
            style: TextInputStyle.Short,
            placeholder: "Enter text",
            required: true,
            minLength: 1,
            maxLength: 100,
            value: "default",
          },
        ],
      };

      manager.registerAction({
        id: "test-action",
        type: "modal",
        data: modalConfig,
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockButtonInteraction.showModal).toHaveBeenCalled();
    });

    it("should handle modal action without config", async () => {
      manager.registerAction({
        id: "test-action",
        type: "modal",
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(emitSpy).toHaveBeenCalledWith("actionError", {
        error: expect.any(Error),
        interaction: mockButtonInteraction,
      });
    });

    it("should handle confirmation action", async () => {
      const confirmationConfig: ConfirmationConfig = {
        title: "Confirm",
        description: "Are you sure?",
        confirmLabel: "Yes",
        cancelLabel: "No",
        confirmStyle: ButtonStyle.Danger,
        timeout: 30,
      };

      manager.registerAction({
        id: "test-action",
        type: "confirmation",
        data: confirmationConfig,
      });

      // Mock successful confirmation
      const mockResponse = {
        awaitMessageComponent: vi.fn().mockResolvedValue({
          customId: "test-action_confirm",
          update: vi.fn(),
        }),
      };
      (mockButtonInteraction.reply as any).mockResolvedValue(mockResponse);

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "**Confirm**\nAre you sure?",
        components: expect.any(Array),
        ephemeral: true,
      });

      expect(emitSpy).toHaveBeenCalledWith("actionConfirmed", expect.any(Object));
    });

    it("should handle confirmation cancellation", async () => {
      const confirmationConfig: ConfirmationConfig = {
        title: "Confirm",
        description: "Are you sure?",
      };

      manager.registerAction({
        id: "test-action",
        type: "confirmation",
        data: confirmationConfig,
      });

      // Mock cancelled confirmation
      const mockCancelInteraction = {
        customId: "test-action_cancel",
        update: vi.fn(),
      };
      const mockResponse = {
        awaitMessageComponent: vi.fn().mockResolvedValue(mockCancelInteraction),
      };
      (mockButtonInteraction.reply as any).mockResolvedValue(mockResponse);

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockCancelInteraction.update).toHaveBeenCalledWith({
        content: "❌ Action cancelled.",
        components: [],
      });
    });

    it("should handle confirmation timeout", async () => {
      const confirmationConfig: ConfirmationConfig = {
        title: "Confirm",
        description: "Are you sure?",
        timeout: 5,
      };

      manager.registerAction({
        id: "test-action",
        type: "confirmation",
        data: confirmationConfig,
      });

      // Mock timeout
      const mockResponse = {
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("Timeout")),
      };
      (mockButtonInteraction.reply as any).mockResolvedValue(mockResponse);

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockButtonInteraction.editReply).toHaveBeenCalledWith({
        content: "⏰ Confirmation timed out.",
        components: [],
      });
    });

    it("should handle confirmation without config", async () => {
      manager.registerAction({
        id: "test-action",
        type: "confirmation",
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(emitSpy).toHaveBeenCalledWith("actionError", {
        error: expect.any(Error),
        interaction: mockButtonInteraction,
      });
    });

    it("should handle menu action", async () => {
      manager.registerAction({
        id: "test-action",
        type: "menu",
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(emitSpy).toHaveBeenCalledWith("selectMenuRequested", {
        action: expect.any(Object),
        interaction: mockButtonInteraction,
      });
    });

    it("should handle unsupported action type", async () => {
      manager.registerAction({
        id: "test-action",
        type: "unsupported" as any,
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(emitSpy).toHaveBeenCalledWith("actionError", {
        error: expect.any(Error),
        interaction: mockButtonInteraction,
      });
    });
  });

  describe("Select Menu Interaction Handling", () => {
    it("should handle unknown select menu action", async () => {
      await manager.handleSelectMenuInteraction(mockSelectMenuInteraction);

      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Unknown select menu action.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle valid select menu action", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-select",
        type: "callback",
        handler,
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleSelectMenuInteraction(mockSelectMenuInteraction);

      expect(handler).toHaveBeenCalledWith(mockSelectMenuInteraction, undefined);
      expect(emitSpy).toHaveBeenCalledWith("actionExecuted", {
        action: expect.any(Object),
        user: mockSelectMenuInteraction.user,
      });
    });

    it("should handle select menu action error", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      manager.registerAction({
        id: "test-select",
        type: "callback",
        handler,
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleSelectMenuInteraction(mockSelectMenuInteraction);

      expect(emitSpy).toHaveBeenCalledWith("actionError", {
        error: expect.any(Error),
        interaction: mockSelectMenuInteraction,
      });
    });
  });

  describe("Permission Handling", () => {
    it("should allow action without permissions", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalled();
    });

    it("should allow action with empty permissions array", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: [],
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalled();
    });

    it("should allow administrator to perform any action", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["ManageMessages"],
      });

      // Mock administrator permissions
      (mockGuildMember!.permissions!.has as any).mockReturnValue(true);

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalled();
    });

    it("should check role-based permissions", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["role:TestRole"],
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalled();
    });

    it("should check user ID permissions", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["user:test-user-123"],
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalled();
    });

    it("should check Discord permissions", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["ManageMessages"],
      });

      // Mock the specific permission check
      (mockGuildMember!.permissions!.has as any).mockImplementation((permission) => {
        return permission === PermissionsBitField.Flags.ManageMessages;
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalled();
    });

    it("should deny action without required permissions", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["ManageMessages"],
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).not.toHaveBeenCalled();
      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "❌ You do not have permission to perform this action.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should deny action for non-guild members", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["ManageMessages"],
      });

      const dmInteraction = {
        ...mockButtonInteraction,
        member: null, // Not in a guild
      };

      await manager.handleButtonInteraction(dmInteraction as ButtonInteraction);

      expect(handler).not.toHaveBeenCalled();
      expect(dmInteraction.reply).toHaveBeenCalledWith({
        content: "❌ You do not have permission to perform this action.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle invalid permission names gracefully", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["InvalidPermission"],
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).not.toHaveBeenCalled();
      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "❌ You do not have permission to perform this action.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle role permission for non-existent role", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["role:NonExistentRole"],
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).not.toHaveBeenCalled();
      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "❌ You do not have permission to perform this action.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle user permission for different user", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        permissions: ["user:different-user"],
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).not.toHaveBeenCalled();
      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "❌ You do not have permission to perform this action.",
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("Cooldown Management", () => {
    it("should allow action without cooldown", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).toHaveBeenCalled();
    });

    it("should set and enforce cooldowns", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        cooldown: 10, // 10 seconds
      });

      // First interaction should succeed
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);
      expect(handler).toHaveBeenCalledTimes(1);

      // Reset mock
      vi.clearAllMocks();

      // Second interaction should be blocked by cooldown
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(handler).not.toHaveBeenCalled();
      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("⏰ Please wait"),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should allow action after cooldown expires", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        cooldown: 1, // 1 second
      });

      // First interaction
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);
      expect(handler).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds
      jest.advanceTimersByTime(2000);

      // Reset mock
      vi.clearAllMocks();

      // Second interaction should succeed after cooldown
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should track cooldowns per user", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        cooldown: 10,
      });

      // First user
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);
      expect(handler).toHaveBeenCalledTimes(1);

      // Different user should not be affected by cooldown
      const differentUserInteraction = {
        ...mockButtonInteraction,
        user: { id: "different-user" },
      };

      await manager.handleButtonInteraction(differentUserInteraction as ButtonInteraction);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should clear user cooldowns", () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        cooldown: 10,
      });

      // Set a cooldown
      const setCooldown = (manager as any).setCooldown.bind(manager);
      setCooldown("test-user-123", { id: "test-action", cooldown: 10 });

      // Verify cooldown exists
      const checkCooldown = (manager as any).checkCooldown.bind(manager);
      expect(checkCooldown("test-user-123", { id: "test-action", cooldown: 10 })).toBe(false);

      // Clear cooldowns
      manager.clearUserCooldowns("test-user-123");

      // Verify cooldown is cleared
      expect(checkCooldown("test-user-123", { id: "test-action", cooldown: 10 })).toBe(true);
    });

    it("should cleanup expired cooldowns", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        cooldown: 1, // 1 second
      });

      // Trigger action to set cooldown
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      // Advance time to expire cooldown
      jest.advanceTimersByTime(2000);

      // Cleanup expired cooldowns
      manager.cleanupCooldowns();

      // Verify cooldown was cleaned up by checking internal state
      const cooldowns = (manager as any).cooldowns;
      const userCooldowns = cooldowns.get("test-action");
      expect(userCooldowns?.has("test-user-123")).toBe(false);
    });

    it("should not cleanup active cooldowns", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
        cooldown: 10, // 10 seconds
      });

      // Trigger action to set cooldown
      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      // Cleanup without advancing time
      manager.cleanupCooldowns();

      // Verify cooldown is still active
      const cooldowns = (manager as any).cooldowns;
      const userCooldowns = cooldowns.get("test-action");
      expect(userCooldowns?.has("test-user-123")).toBe(true);
    });

    it("should calculate remaining cooldown time correctly", () => {
      const getRemainingCooldown = (manager as any).getRemainingCooldown.bind(manager);
      const setCooldown = (manager as any).setCooldown.bind(manager);

      const action = { id: "test-action", cooldown: 10 };

      // Set cooldown
      setCooldown("test-user-123", action);

      // Check remaining time immediately
      const remaining = getRemainingCooldown("test-user-123", action);
      expect(remaining).toBe(10);

      // Advance time by 3 seconds
      jest.advanceTimersByTime(3000);

      const remainingAfter = getRemainingCooldown("test-user-123", action);
      expect(remainingAfter).toBe(7);
    });

    it("should return 0 for expired cooldowns", () => {
      const getRemainingCooldown = (manager as any).getRemainingCooldown.bind(manager);
      const setCooldown = (manager as any).setCooldown.bind(manager);

      const action = { id: "test-action", cooldown: 5 };

      // Set cooldown
      setCooldown("test-user-123", action);

      // Advance time past cooldown
      jest.advanceTimersByTime(10000);

      const remaining = getRemainingCooldown("test-user-123", action);
      expect(remaining).toBe(0);
    });

    it("should return 0 for non-existent cooldowns", () => {
      const getRemainingCooldown = (manager as any).getRemainingCooldown.bind(manager);

      const action = { id: "non-existent", cooldown: 10 };
      const remaining = getRemainingCooldown("test-user-123", action);
      expect(remaining).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle action execution errors", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      const emitSpy = vi.spyOn(manager, "emit");

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(emitSpy).toHaveBeenCalledWith("actionError", {
        error: expect.any(Error),
        interaction: mockButtonInteraction,
      });

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Error: Handler failed",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle action execution errors for replied interactions", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      const repliedInteraction = {
        ...mockButtonInteraction,
        replied: true,
        followUp: vi.fn(),
      };

      await manager.handleButtonInteraction(repliedInteraction as ButtonInteraction);

      expect(repliedInteraction.followUp).toHaveBeenCalledWith({
        content: "❌ Error: Handler failed",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle action execution errors for deferred interactions", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      const deferredInteraction = {
        ...mockButtonInteraction,
        deferred: true,
        followUp: vi.fn(),
      };

      await manager.handleButtonInteraction(deferredInteraction as ButtonInteraction);

      expect(deferredInteraction.followUp).toHaveBeenCalledWith({
        content: "❌ Error: Handler failed",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle non-Error exceptions", async () => {
      const handler = vi.fn().mockRejectedValue("String error");
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: "❌ Error: An unknown error occurred",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle error message sending failures", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      manager.registerAction({
        id: "test-action",
        type: "callback",
        handler,
      });

      const brokenInteraction = {
        ...mockButtonInteraction,
        reply: vi.fn().mockRejectedValue(new Error("Reply failed")),
        followUp: vi.fn().mockRejectedValue(new Error("FollowUp failed")),
      };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined as any);

      await manager.handleButtonInteraction(brokenInteraction as ButtonInteraction);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to send error message:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Select Menu Cooldowns", () => {
    it("should enforce cooldowns on select menu interactions", async () => {
      const handler = vi.fn();
      manager.registerAction({
        id: "test-select",
        type: "callback",
        handler,
        cooldown: 5,
      });

      // First interaction should succeed
      await manager.handleSelectMenuInteraction(mockSelectMenuInteraction);
      expect(handler).toHaveBeenCalledTimes(1);

      // Reset mock
      vi.clearAllMocks();

      // Second interaction should be blocked
      await manager.handleSelectMenuInteraction(mockSelectMenuInteraction);

      expect(handler).not.toHaveBeenCalled();
      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("⏰ Please wait"),
        ephemeral: true,
      });
    });
  });

  describe("Modal Configuration Edge Cases", () => {
    it("should handle modal with all input options", async () => {
      const modalConfig: ModalConfig = {
        id: "full-modal",
        title: "Full Modal",
        inputs: [
          {
            id: "input1",
            label: "Input 1",
            style: TextInputStyle.Short,
            placeholder: "Placeholder",
            required: true,
            minLength: 5,
            maxLength: 100,
            value: "Default value",
          },
          {
            id: "input2",
            label: "Input 2",
            style: TextInputStyle.Paragraph,
            required: false,
          },
        ],
      };

      manager.registerAction({
        id: "test-action",
        type: "modal",
        data: modalConfig,
      });

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      expect(mockButtonInteraction.showModal).toHaveBeenCalled();

      // Verify all TextInputBuilder methods were called
      const TextInputBuilderMock = TextInputBuilder as any;
      const instances = TextInputBuilderMock.mock.instances;
      
      expect(instances).toHaveLength(2);
      
      // Check that all methods were called on the first input
      expect(instances[0].setCustomId).toHaveBeenCalledWith("input1");
      expect(instances[0].setLabel).toHaveBeenCalledWith("Input 1");
      expect(instances[0].setStyle).toHaveBeenCalledWith(TextInputStyle.Short);
      expect(instances[0].setPlaceholder).toHaveBeenCalledWith("Placeholder");
      expect(instances[0].setRequired).toHaveBeenCalledWith(true);
      expect(instances[0].setMinLength).toHaveBeenCalledWith(5);
      expect(instances[0].setMaxLength).toHaveBeenCalledWith(100);
      expect(instances[0].setValue).toHaveBeenCalledWith("Default value");
    });
  });

  describe("Confirmation Edge Cases", () => {
    it("should use default labels and styles for confirmation", async () => {
      const confirmationConfig: ConfirmationConfig = {
        title: "Confirm",
        description: "Are you sure?",
        // No custom labels or styles
      };

      manager.registerAction({
        id: "test-action",
        type: "confirmation",
        data: confirmationConfig,
      });

      const mockResponse = {
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("Timeout")),
      };
      (mockButtonInteraction.reply as any).mockResolvedValue(mockResponse);

      await manager.handleButtonInteraction(mockButtonInteraction as ButtonInteraction);

      // Check that default values were used
      const ButtonBuilderMock = ButtonBuilder as any;
      const instances = ButtonBuilderMock.mock.instances;
      
      expect(instances).toHaveLength(2); // Cancel and confirm buttons
      
      // Check labels were set to defaults
      const setLabelCalls = instances.flatMap(instance => (instance.setLabel as any).mock.calls);
      expect(setLabelCalls).toContainEqual(["Cancel"]);
      expect(setLabelCalls).toContainEqual(["Confirm"]);
    });
  });

  describe("Automatic Cleanup", () => {
    it("should automatically cleanup cooldowns", () => {
      // Test the global cleanup interval (mocked)
      vi.clearAllTimers();
      
      // Re-import to trigger the setInterval
      jest.isolateModules(() => {
        require("../ActionButtonManager");
      });

      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000 // 5 minutes
      );
    });
  });
});
