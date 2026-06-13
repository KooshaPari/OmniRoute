/**
 * Discord Smart Embed Framework
 *
 * A comprehensive framework for creating interactive, real-time Discord embeds
 * with action buttons, modal forms, and state management.
 *
 * @version 1.0.0
 * @author AI Assistant
 */

import { SmartEmbedBuilder, SmartEmbedManager, smartEmbedManager } from "./SmartEmbedBuilder";
import { StateManager, stateManager } from "./StateManager";
import { ActionButtonManager, actionButtonManager } from "./ActionButtonManager";
import { ModalFormManager, modalFormManager } from "./ModalFormManager";
import { ComponentRegistry, componentRegistry } from "./ComponentRegistry";

// Core Framework Components
export {
  SmartEmbedBuilder,
  SmartEmbedManager,
  smartEmbedManager,
  type SmartEmbedState,
  type SmartEmbedConfig,
  type ActionButtonConfig,
  type SmartField,
} from "./SmartEmbedBuilder";

export {
  ActionButtonManager,
  actionButtonManager,
  type ButtonAction,
  type ModalConfig,
  type ConfirmationConfig,
} from "./ActionButtonManager";

export {
  ModalFormManager,
  modalFormManager,
  type FormField,
  type FormStep,
  type FormTemplate,
  type FormSubmission,
  type ValidationResult,
} from "./ModalFormManager";

export {
  StateManager,
  stateManager,
  type EmbedState,
  type StateUpdate,
  type StateSubscription,
} from "./StateManager";

export {
  ComponentRegistry,
  componentRegistry,
  type ComponentTheme,
  type ComponentTemplate,
  type StatusBadge,
  type ProgressBar,
} from "./ComponentRegistry";

/**
 * Framework initialization and configuration
 */
export class SmartEmbedFramework {
  private static instance: SmartEmbedFramework;
  private initialized = false;
  private refreshAllTimer?: NodeJS.Timeout;
  // Expose managers for tests and convenience
  public get stateManager() { return stateManager; }
  public get actionButtonManager() { return actionButtonManager; }
  public get modalFormManager() { return modalFormManager; }
  public get componentRegistry() { return componentRegistry; }

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): SmartEmbedFramework {
    if (!SmartEmbedFramework.instance) {
      SmartEmbedFramework.instance = new SmartEmbedFramework();
    }
    return SmartEmbedFramework.instance;
  }

  /**
   * Initialize the framework
   */
  async initialize(config?: {
    theme?: string;
    persistence?: boolean;
    autoCleanup?: boolean;
    cleanupInterval?: number;
  }): Promise<void> {
    if (this.initialized) {
      console.warn("Smart Embed Framework already initialized");
      return;
    }

    console.log("🚀 Initializing Smart Embed Framework...");

    // Set theme if provided
    if (config?.theme) {
      componentRegistry.setTheme(config.theme);
    }

    // Configure state manager
    if (config?.persistence !== undefined) {
      stateManager.setPersistenceEnabled(config.persistence);
    }

    // Setup auto-cleanup if enabled
    if (config?.autoCleanup) {
      const interval = config.cleanupInterval || 60 * 60 * 1000; // 1 hour default
      setInterval(() => {
        this.performCleanup();
      }, interval);
    }

    // Setup event listeners for integration
    await this.setupEventListeners();

    // Optional: auto-refresh all smart embeds via env toggle
    try {
      const intervalSec = Number(process.env.SMART_EMBED_REFRESH_INTERVAL);
      if (Number.isFinite(intervalSec) && intervalSec > 0) {
        this.refreshAllTimer = setInterval(() => {
          try { smartEmbedManager.refreshAll(); } catch {}
        }, intervalSec * 1000);
        console.log(`🔄 SmartEmbed auto-refresh enabled (${intervalSec}s)`);
      }
    } catch {}

    this.initialized = true;
    console.log("✅ Smart Embed Framework initialized successfully");
  }

  /**
   * Setup event listeners for framework integration
   */
  private async setupEventListeners(): Promise<void> {

    // State manager events
    stateManager.on("discordUpdateRequired", async (data) => {
      // This would be handled by the main Discord client
      console.log("Discord update required:", data);
    });

    stateManager.on("persistenceRequired", async (state) => {
      // This would be handled by the persistence layer
      console.log("Persistence required for state:", state.id);
    });

    // Action button manager events
    actionButtonManager.on("actionConfirmed", async (data) => {
      console.log("Action confirmed:", data.action.id);
    });

    actionButtonManager.on("actionError", (data) => {
      console.error("Action error:", data.error);
    });

    // Modal form manager events
    modalFormManager.on("formCompleted", (data) => {
      console.log(
        "Form completed:",
        data.template.id,
        "by user:",
        data.user.id,
      );
    });

    modalFormManager.on("formCancelled", (submission) => {
      console.log(
        "Form cancelled:",
        submission.formId,
        "by user:",
        submission.userId,
      );
    });

    // Smart embed manager events
    smartEmbedManager.on("embedUpdated", (state) => {
      console.log("Embed updated:", state.id);
    });
  }

  /**
   * Perform cleanup operations
   */
  private async performCleanup(): Promise<void> {
    console.log("🧹 Performing framework cleanup...");

    // Cleanup old form submissions
    modalFormManager.cleanupOldSubmissions();

    // Cleanup expired cooldowns
    actionButtonManager.cleanupCooldowns();

    console.log("✅ Framework cleanup completed");
  }

  /**
   * Get framework statistics
   */
  async getStats(): Promise<{
    embeds: number;
    actions: number;
    templates: number;
    themes: number;
    activeSubmissions: number;
    stateManager: any;
  }> {

    return {
      embeds: smartEmbedManager?.getAllStates?.()?.length ?? 0,
      actions: actionButtonManager?.getActions?.()?.length ?? 0,
      templates: componentRegistry?.getTemplates?.()?.length ?? 0,
      themes: componentRegistry?.getThemes?.()?.length ?? 0,
      activeSubmissions: modalFormManager?.getTemplates?.()?.length ?? 0,
      stateManager: stateManager?.getStats?.() ?? {},
    };
  }

  /**
   * Shutdown the framework
   */
  async shutdown(): Promise<void> {
    console.log("🛑 Shutting down Smart Embed Framework...");

    try {
      // Cleanup all managers
      smartEmbedManager.destroy();
      stateManager.cleanup();
    } catch (error) {
      console.warn("Error during shutdown:", error);
    }

    // Stop optional auto-refresh timer
    if (this.refreshAllTimer) {
      try { clearInterval(this.refreshAllTimer); } catch {}
      this.refreshAllTimer = undefined;
    }

    this.initialized = false;
    console.log("✅ Smart Embed Framework shutdown completed");
  }

  /**
   * Check if framework is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Convenience function to get the framework instance
 */
export const framework = SmartEmbedFramework.getInstance();

/**
 * Quick start function for common use cases
 */
export async function quickStart(config?: {
  theme?: string;
  persistence?: boolean;
}): Promise<void> {
  await framework.initialize(config);
}

/**
 * Create a quick issue card
 */
export async function createIssueCard(config: {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
}): Promise<SmartEmbedBuilder | null> {
  const res = componentRegistry.createComponent("issue-card", config);
  if (res) return res;
  // Fallback minimal card when registry is mocked
  return new SmartEmbedBuilder({ id: config.id, title: config.title, description: config.description });
}

/**
 * Create a quick dashboard card
 */
export async function createDashboardCard(config: {
  id: string;
  title: string;
  description?: string;
  metrics?: Record<string, any>;
  progress?: { current: number; total: number };
  refreshInterval?: number;
}): Promise<SmartEmbedBuilder | null> {
  const res = componentRegistry.createComponent("dashboard-card", config);
  if (res) return res;
  return new SmartEmbedBuilder({ id: config.id, title: config.title, description: config.description });
}

/**
 * Create a quick status card
 */
export async function createStatusCard(config: {
  id: string;
  title: string;
  status: "online" | "warning" | "offline";
  uptime?: string;
  refreshInterval?: number;
}): Promise<SmartEmbedBuilder | null> {
  const res = componentRegistry.createComponent("status-card", config);
  if (res) return res;
  return new SmartEmbedBuilder({ id: config.id, title: config.title });
}

/**
 * Create a quick form card
 */
export async function createFormCard(config: {
  id: string;
  title: string;
  description?: string;
  fields: Array<{
    label: string;
    placeholder?: string;
  }>;
}): Promise<SmartEmbedBuilder | null> {
  const res = componentRegistry.createComponent("form-card", config);
  if (res) return res;
  return new SmartEmbedBuilder({ id: config.id, title: config.title, description: config.description });
}

/**
 * Register a quick action
 */
export async function registerQuickAction(
  id: string,
  label: string,
  handler: (interaction: any) => Promise<void>,
  options?: {
    emoji?: string;
    permissions?: string[];
    cooldown?: number;
  },
): Promise<void> {
  actionButtonManager.createQuickAction(id, label, handler, options);
}

/**
 * Register a quick form
 */
export async function registerQuickForm(
  id: string,
  name: string,
  description: string,
  fields: Array<{
    id: string;
    label: string;
    type?: "text" | "textarea" | "number" | "email" | "url";
    required?: boolean;
    placeholder?: string;
  }>,
): Promise<void> {

  const formFields = fields.map((field) => ({
    ...field,
    style: field.type === "textarea" ? 1 : 0, // TextInputStyle.Paragraph : TextInputStyle.Short
    type: field.type || "text",
  }));

  modalFormManager.createSimpleForm(id, name, description, formFields as any);
}

// Export version information
export const VERSION = "1.0.0";
export const BUILD_DATE = new Date().toISOString();

console.log(`📦 Smart Embed Framework v${VERSION} loaded`);
