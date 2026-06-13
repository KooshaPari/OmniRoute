/**
 * Mock implementation of ActionButtonManager for testing
 */

import { vi } from "vitest";
import { EventEmitter } from "events";

export interface ButtonAction {
  id: string;
  type: "modal" | "callback" | "link" | "menu" | "confirmation";
  permissions?: string[];
  cooldown?: number;
  data?: any;
  handler?: (interaction: any, data?: any) => Promise<void>;
}

export interface ModalConfig {
  id: string;
  title: string;
  inputs: Array<{
    id: string;
    label: string;
    style: number;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    value?: string;
  }>;
}

export interface ConfirmationConfig {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmStyle?: number;
  timeout?: number;
}

/**
 * Mock ActionButtonManager class that extends EventEmitter
 */
export class MockActionButtonManager extends EventEmitter {
  private _actions: Map<string, ButtonAction> = new Map();
  private _cooldowns: Map<string, Map<string, number>> = new Map();
  public confirmations: Map<string, ConfirmationConfig> = new Map();

  constructor() {
    super();
    this._actions = new Map();
    this._cooldowns = new Map();
    this.confirmations = new Map();
    try {
      // Auto cleanup every 5 minutes (tests may spy on setInterval)
      setInterval(() => this.cleanupCooldowns(), 5 * 60 * 1000);
    } catch {}
  }

  // Expose actions and cooldowns as plain objects like production manager
  get actions(): Record<string, ButtonAction> {
    const result: Record<string, ButtonAction> = {};
    this._actions.forEach((v, k) => { result[k] = v; });
    return result;
  }

  get cooldowns(): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    this._cooldowns.forEach((userMap, actionId) => {
      result[actionId] = {};
      userMap.forEach((ts, userId) => { result[actionId][userId] = ts; });
    });
    return result;
  }

  // Mock methods with proper implementations
  registerAction = vi.fn().mockImplementation((action: ButtonAction) => {
    console.log(`🔧 MockActionButtonManager: Registering action "${action.id}"`);
    this._actions.set(action.id, action);
    this.emit("actionRegistered", action);
  });

  handleButtonInteraction = vi.fn().mockImplementation(async (interaction: any) => {
    const customId = interaction.customId;

    const hasMemberPerms = !!(interaction?.member && interaction.member.permissions);

    if (!customId) {
      // Prefer permission denied if member context missing
      if (!hasMemberPerms) {
        await interaction.reply({ content: "❌ You do not have permission to perform this action.", flags: 64 });
      } else {
        await interaction.reply({ content: "❌ Unknown action. This button may be outdated.", flags: 64 });
      }
      return;
    }

    const action = this._actions.get(customId);

    if (!action) {
      if (!hasMemberPerms) {
        await interaction.reply({ content: "❌ You do not have permission to perform this action.", flags: 64 });
      } else {
        await interaction.reply({ content: "❌ Unknown action. This button may be outdated.", flags: 64 });
      }
      return;
    }

    // Permission check first
    if (!this.checkPermissions(interaction, action)) {
      await interaction.reply({ content: "❌ You do not have permission to perform this action.", flags: 64 });
      return;
    }

    // Cooldown check
    if (!this.checkCooldown(interaction.user.id, action)) {
      const remainingTime = this.getRemainingCooldown(interaction.user.id, action);
      await interaction.reply({ content: `⏰ Please wait ${remainingTime} seconds before using this action again.`, flags: 64 });
      return;
    }

    try {
      await this.executeAction(interaction, action);
      this.setCooldown(interaction.user.id, action);
      this.emit("actionExecuted", { action, user: interaction.user });
    } catch (error) {
      console.error(`Error executing action ${action.id}:`, error);
      this.emit("actionError", { error, interaction });
      await this.handleActionError(interaction, error);
    }
  });

  handleSelectMenuInteraction = vi.fn().mockImplementation(async (interaction: any) => {
    const customId = interaction.customId;
    const action = this._actions.get(customId);

    if (!action) {
      await interaction.reply({
        content: "❌ Unknown select menu action.",
        flags: 64,
      });
      return;
    }

    if (!this.checkPermissions(interaction, action)) {
      await interaction.reply({
        content: "❌ You do not have permission to perform this action.",
        flags: 64,
      });
      return;
    }

    if (!this.checkCooldown(interaction.user.id, action)) {
      const remainingTime = this.getRemainingCooldown(interaction.user.id, action);
      await interaction.reply({
        content: `⏰ Please wait ${remainingTime} seconds before using this action again.`,
        flags: 64,
      });
      return;
    }

    try {
      await this.executeAction(interaction, action);
      this.setCooldown(interaction.user.id, action);
      this.emit("actionExecuted", { action, user: interaction.user });
    } catch (error) {
      console.error(`Error executing action ${action.id}:`, error);
      await this.handleActionError(interaction, error);
    }
  });

  private async executeAction(interaction: any, action: ButtonAction): Promise<void> {
    switch (action.type) {
      case "modal": {
        const modalConfig = action.data as ModalConfig | undefined;
        if (!modalConfig) {
          const err = new Error(`No modal configuration for action: ${action.id}`);
          this.emit("actionError", { error: err, interaction });
          await this.handleActionError(interaction, err);
          return;
        }
        try {
          await this.showModal(interaction, action);
        } catch (error) {
          console.error(`Error showing modal for action ${action.id}:`, error);
          this.emit("actionError", { error, interaction });
          await this.handleActionError(interaction, error);
        }
        break;
      }
      case "callback":
        if (action.handler) {
          await action.handler(interaction, action.data);
        } else {
          const err = new Error(`No handler defined for callback action: ${action.id}`);
          this.emit("actionError", { error: err, interaction });
          await this.handleActionError(interaction, err);
        }
        break;
      case "confirmation": {
        if (!action.data) {
          const err = new Error(`No confirmation configuration for action: ${action.id}`);
          this.emit("actionError", { error: err, interaction });
          await this.handleActionError(interaction, err);
          return;
        }
        await this.showConfirmation(interaction, action);
        break;
      }
      case "menu":
        await this.showSelectMenu(interaction, action);
        break;
      default: {
        const err = new Error(`Unsupported action type: ${action.type}`);
        this.emit("actionError", { error: err, interaction });
        await this.handleActionError(interaction, err);
      }
    }
  }

  private async showModal(interaction: any, action: ButtonAction): Promise<void> {
    const modalConfig = action.data as ModalConfig;
    if (!modalConfig) {
      throw new Error(`No modal configuration for action: ${action.id}`);
    }

    // Use mocked Discord.js builders so tests observe instance usage
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    const modal: any = new (ModalBuilder as any)();
    modal.setCustomId(`${action.id}-modal`).setTitle(modalConfig.title);

    const rows: any[] = [];
    for (const input of modalConfig.inputs || []) {
      const text = new (TextInputBuilder as any)()
        .setCustomId(input.id)
        .setLabel(input.label)
        .setStyle(input.style ?? (TextInputStyle as any).Short)
        .setRequired(input.required ?? false);
      if (input.placeholder) text.setPlaceholder(input.placeholder);
      if (typeof input.minLength === 'number') text.setMinLength(input.minLength);
      if (typeof input.maxLength === 'number') text.setMaxLength(input.maxLength);
      if (typeof input.value === 'string') text.setValue(input.value);
      const row = new (ActionRowBuilder as any)();
      row.addComponents(text);
      rows.push(row);
    }

    if (typeof modal.addComponents === 'function') modal.addComponents(...rows);
    if (interaction.showModal) await interaction.showModal(modal);
  }

  private async showConfirmation(interaction: any, action: ButtonAction): Promise<void> {
    const config = action.data as ConfirmationConfig;
    if (!config) {
      throw new Error(`No confirmation configuration for action: ${action.id}`);
    }

    const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import('discord.js');
    const cancelBtn: any = new (ButtonBuilder as any)();
    cancelBtn.setCustomId(`${action.id}_cancel`).setLabel(config.cancelLabel || 'Cancel').setStyle((ButtonStyle as any).Secondary || 2);
    const confirmBtn: any = new (ButtonBuilder as any)();
    confirmBtn.setCustomId(`${action.id}_confirm`).setLabel(config.confirmLabel || 'Confirm').setStyle(config.confirmStyle || (ButtonStyle as any).Primary || 1);

    const row: any = new (ActionRowBuilder as any)();
    if (typeof row.addComponents === 'function') row.addComponents(cancelBtn, confirmBtn);

    const response = await interaction.reply({
      content: `**${config.title}**\n${config.description}`,
      components: [row],
      ephemeral: true,
    });

    try {
      const confirmation = await response.awaitMessageComponent({
        filter: (i: any) => i.user.id === interaction.user.id,
        time: (config.timeout || 30) * 1000,
      });

      if (confirmation.customId === `${action.id}_confirm`) {
        this.emit("actionConfirmed", { action, interaction: confirmation });
      } else {
        this.emit("actionCancelled", { action, interaction: confirmation });
        try {
          await confirmation.update({ content: "❌ Action cancelled.", components: [] });
        } catch (replyError) {
          console.error("Error sending cancellation response:", replyError);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("time") || msg.includes("Timeout")) {
        console.warn(`Confirmation timeout for action ${action.id}`);
        try { await interaction.editReply({ content: "⏰ Confirmation timed out.", components: [] }); } catch {}
      } else {
        console.error(`Error awaiting confirmation for action ${action.id}:`, error);
        this.emit("actionError", { error, interaction });
      }
    }
  }

  private async showSelectMenu(interaction: any, action: ButtonAction): Promise<void> {
    this.emit("selectMenuRequested", { action, interaction });
  }

  private checkPermissions(interaction: any, action: ButtonAction): boolean {
    if (!action.permissions || action.permissions.length === 0) {
      return true;
    }

    const member = interaction.member;
    if (!member || !member.permissions) {
      return false;
    }

    try {
      // big-int administrator flag or mock truthy
      if ((member.permissions.has && member.permissions.has(8n)) || member.permissions.has === true) {
        return true;
      }
    } catch {}

    return action.permissions.some((permission) => {
      if (permission.startsWith("role:")) {
        const roleName = permission.substring(5);
        if (!member.roles || !member.roles.cache) return false;
        return member.roles.cache.some((role: any) => role.name === roleName);
      }
      if (permission.startsWith("user:")) {
        const userId = permission.substring(5);
        return member.id === userId;
      }
      try {
        return member.permissions.has && member.permissions.has(permission);
      } catch { return false; }
    });
  }

  private checkCooldown(userId: string, action: ButtonAction): boolean {
    if (!action.cooldown) return true;
    const userCooldowns = this._cooldowns.get(action.id);
    if (!userCooldowns) return true;
    const lastUsed = userCooldowns.get(userId);
    if (!lastUsed) return true;
    const now = Date.now();
    const cooldownMs = action.cooldown * 1000;
    return now - lastUsed >= cooldownMs;
  }

  private getRemainingCooldown(userId: string, action: ButtonAction): number {
    if (!action.cooldown) return 0;
    const userCooldowns = this._cooldowns.get(action.id);
    if (!userCooldowns) return 0;
    const lastUsed = userCooldowns.get(userId);
    if (!lastUsed) return 0;
    const now = Date.now();
    const cooldownMs = action.cooldown * 1000;
    const elapsed = now - lastUsed;
    const remaining = Math.max(0, cooldownMs - elapsed);
    return Math.ceil(remaining / 1000);
  }

  private setCooldown(userId: string, action: ButtonAction): void {
    if (!action.cooldown) return;
    let userCooldowns = this._cooldowns.get(action.id);
    if (!userCooldowns) {
      userCooldowns = new Map();
      this._cooldowns.set(action.id, userCooldowns);
    }
    userCooldowns.set(userId, Date.now());
  }

  private async handleActionError(interaction: any, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ Error: ${errorMessage}`, flags: 64 });
      } else {
        await interaction.reply({ content: `❌ Error: ${errorMessage}`, flags: 64 });
      }
    } catch (replyError) { console.error("Failed to send error message:", replyError); }
    this.emit("actionError", { error, interaction });
  }

  createQuickAction = vi.fn().mockImplementation((id: string, label: string, handler: (interaction: any) => Promise<void>, options?: { emoji?: string; style?: number; permissions?: string[]; cooldown?: number; }) => {
    this.registerAction({ id, type: "callback", permissions: options?.permissions, cooldown: options?.cooldown, handler });
  });

  createModalAction = vi.fn().mockImplementation((id: string, modalConfig: ModalConfig, options?: { permissions?: string[]; cooldown?: number; }) => {
    this.registerAction({ id, type: "modal", permissions: options?.permissions, cooldown: options?.cooldown, data: modalConfig });
  });

  createConfirmationAction = vi.fn().mockImplementation((id: string, confirmationConfig: ConfirmationConfig, options?: { permissions?: string[]; cooldown?: number; }) => {
    this.registerAction({ id, type: "confirmation", permissions: options?.permissions, cooldown: options?.cooldown, data: confirmationConfig });
  });

  unregisterAction = vi.fn().mockImplementation((id: string): boolean => {
    const removed = this._actions.delete(id);
    if (removed) { this._cooldowns.delete(id); this.emit("actionRemoved", id); }
    return removed;
  });

  removeAction = vi.fn().mockImplementation((id: string): boolean => this.unregisterAction(id));

  getActions = vi.fn().mockImplementation((): ButtonAction[] => Array.from(this._actions.values()));

  clearUserCooldowns = vi.fn().mockImplementation((userId: string): void => {
    this._cooldowns.forEach((userCooldowns) => { userCooldowns.delete(userId); });
  });

  cleanupCooldowns = vi.fn().mockImplementation((): void => {
    const now = Date.now();
    this._cooldowns.forEach((userCooldowns, actionId) => {
      const action = this._actions.get(actionId);
      if (!action?.cooldown) return;
      const cooldownMs = action.cooldown * 1000;
      userCooldowns.forEach((timestamp, userId) => { if (now - timestamp >= cooldownMs) userCooldowns.delete(userId); });
    });
  });
}

// Create a mock instance
export const mockActionButtonManager = new MockActionButtonManager();

// Default export with both class and instance
export default {
  ActionButtonManager: MockActionButtonManager,
  actionButtonManager: mockActionButtonManager,
};