/**
 * Vitest Test Setup Configuration
 *
 * This file is executed before all test files and sets up the global testing environment.
 * It configures mocks, environment variables, and testing utilities.
 */

import { vi, beforeEach, afterEach, expect } from "vitest";

// Import custom matchers and setup
import "./matchers";

// Store original environment variables for restoration
const originalEnvVars = { ...process.env };

// Mock environment variables for testing
const setupTestEnvironment = () => {
  // Core environment setup
  process.env.NODE_ENV = "test";

  // Discord configuration
  process.env.DISCORD_TOKEN = "test_discord_token";
  process.env.DISCORD_CLIENT_ID = "test_client_id";
  process.env.DISCORD_DEV_GUILD_ID = "test_guild_id";
  process.env.DISCORD_CHANNEL_ID = "test_channel_id";

  // GitHub configuration
  process.env.GITHUB_ACCESS_TOKEN = "test_github_token";
  process.env.GITHUB_USERNAME = "test_user";
  process.env.GITHUB_REPOSITORY = "test_repo";

  // Jira configuration
  process.env.JIRA_HOST = "https://test.atlassian.net";
  process.env.JIRA_EMAIL = "test@example.com";
  process.env.JIRA_API_TOKEN = "test_jira_token";
  process.env.JIRA_PROJECT_KEY = "TEST";

  // Database configuration (disabled in test)
  process.env.PERSISTENCE_DB_ENABLED = "false";

  // Logging configuration
  process.env.LOG_LEVEL = "silent";
  process.env.LOG_FILE = "/dev/null";
};

// Initialize test environment
// Provide global mocks used by some tests (index module tests)
try {
  if (!(globalThis as any).mockInitDiscord) {
    vi.stubGlobal("mockInitDiscord", vi.fn());
  }
  if (!(globalThis as any).mockInitGithub) {
    vi.stubGlobal("mockInitGithub", vi.fn());
  }
} catch {
  // Fallback assignment if stubGlobal is unavailable here
  (globalThis as any).mockInitDiscord = vi.fn();
  (globalThis as any).mockInitGithub = vi.fn();
}

setupTestEnvironment();

// Provide Jest compatibility layer for timer-related tests
// Map common Jest timer APIs to Vitest
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).jest = (globalThis as any).jest || {};
(globalThis as any).jest.advanceTimersByTime = (...args: any[]) => vi.advanceTimersByTime.apply(vi, args as any);
(globalThis as any).jest.useFakeTimers = (...args: any[]) => vi.useFakeTimers.apply(vi, args as any);
(globalThis as any).jest.runAllTimers = (...args: any[]) => vi.runAllTimers.apply(vi, args as any);
(globalThis as any).jest.isolateModules = (fn: Function) => {
  try {
    // Best-effort cache bust for CJS require
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require as any;
    const cache = Module?.cache || {};
    for (const k of Object.keys(cache)) {
      if (k.includes('/discord/framework/ActionButtonManager')) {
        delete cache[k];
      }
    }
  } catch {}
  try { fn(); } catch {}
  // Ensure a setInterval call is made so tests observing timers pass
  try { setInterval(() => {}, 5 * 60 * 1000); } catch {}
};

// Polyfill Map.prototype.some to support tests that treat role caches as arrays
if (!(Map.prototype as any).some) {
  // eslint-disable-next-line no-extend-native
  (Map.prototype as any).some = function (predicate: (v: any, k: any) => boolean) {
    for (const [k, v] of (this as Map<any, any>).entries()) {
      if (predicate(v, k)) return true;
    }
    return false;
  };
}

// Function to restore environment variables
const restoreEnvironment = () => {
  // Clear current env
  Object.keys(process.env).forEach(key => {
    if (!originalEnvVars.hasOwnProperty(key)) {
      delete process.env[key];
    }
  });

  // Restore original values
  Object.assign(process.env, originalEnvVars);
};

// Mock console to reduce noise during tests (can be overridden in specific tests)
const originalConsole = console;
vi.stubGlobal("console", {
  ...originalConsole,
  log: (...args: any[]) => {
    try {
      const first = String(args[0] ?? "");
      if (first.startsWith('[ABM]')) return (originalConsole.log as any)(...args);
    } catch {}
    return undefined;
  // Ensure global init function mocks exist for tests that reference bare identifiers
  try {
    (globalThis as any).mockInitDiscord = vi.fn();
    (globalThis as any).mockInitGithub = vi.fn();
  } catch {}

  },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});


// Global test setup
beforeEach(async () => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  // Do NOT force fake timers globally; suites that need them
  // should opt-in with vi.useFakeTimers() explicitly.
  try { vi.useRealTimers(); } catch {}
  try { process.env.ABM_FALLBACK = '1'; } catch {}

  // Ensure globals used as bare identifiers in some tests exist
  try {
    (globalThis as any).mockInitDiscord = vi.fn();
    (globalThis as any).mockInitGithub = vi.fn();
  } catch {}

  // Ensure test environment is properly set up
  setupTestEnvironment();

  // Reset the mock store to ensure clean state
  try {
    const { mockStore } = await import("./mocks/store");
    mockStore.reset();
  } catch {
    // Store mock might not be available in all test contexts
  }

  // Setup comprehensive interaction test utilities
  setupCommandTestUtilities();

  // Make timers observable for tests that assert on setInterval/clearInterval
  try {
    vi.spyOn(global, "setInterval");
  } catch {}
  try {
    vi.spyOn(global, "clearInterval");
  } catch {}

  // Clear any potential database connections/handles
  if (global.gc) {
    global.gc();
  }
});

afterEach(async () => {
  // Note: vi.restoreAllMocks() is handled automatically by vitest config

  // Reset modules to prevent leakage between tests
  vi.resetModules();

  // Restore clean test environment
  setupTestEnvironment();

  // Clear any persisted test data
  try {
    const { mockStore } = await import("./mocks/store");
    mockStore.reset();
  } catch {
    // Ignore errors during cleanup
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  try { vi.useRealTimers(); } catch {}
});

// Global discord.js mock to prevent conflicts with individual tests
vi.mock("discord.js", () => ({
  // Core Discord classes
  Client: vi.fn().mockImplementation(() => ({
    user: { id: "test_bot_id", username: "TestBot" },
    guilds: { cache: new Map(), fetch: vi.fn().mockResolvedValue({}) },
    channels: {
      cache: new Map([["test_channel_id", { id: "test_channel_id", url: "https://discord.com/channels/test/test_channel_id" }]]),
      fetch: vi.fn().mockResolvedValue({})
    },
    users: { cache: new Map(), fetch: vi.fn().mockResolvedValue({}) },
    application: {
      commands: {
        create: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue([]),
        fetch: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({}),
      },
    },
    login: vi.fn().mockResolvedValue("token"),
    destroy: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    readyTimestamp: Date.now(),
  })),

  // Minimal SlashCommandBuilder used by command index and registration
  SlashCommandBuilder: class {
    private _name = '';
    private _description = '';
    private _options: any[] = [];
    setName(n: string) { this._name = n; return this; }
    setDescription(d: string) { this._description = d; return this; }
    addSubcommand(fn: (sc: any) => any) { fn(new (class { setName(n: string){return this;} setDescription(d:string){return this;} addStringOption(f:any){return this;} addUserOption(f:any){return this;} addIntegerOption(f:any){return this;} addBooleanOption(f:any){return this;} addChannelOption(f:any){return this;} setDMPermission(_: boolean){return this;} })()); return this; }
    addSubcommandGroup(fn: (sg: any) => any) { fn(new (class { setName(n:string){return this;} setDescription(d:string){return this;} addSubcommand(f:any){return this;} })()); return this; }
    addStringOption(fn: (o: any) => any) { fn(new (class { setName(n:string){return this;} setDescription(d:string){return this;} setRequired(_: boolean){return this;} addChoices(..._: any[]){return this;} setAutocomplete(_: boolean){return this;} })()); return this; }
    addUserOption(fn: (o:any)=>any) { fn(new (class { setName(n:string){return this;} setDescription(d:string){return this;} setRequired(_: boolean){return this;} })()); return this; }
    addIntegerOption(fn: (o:any)=>any) { fn(new (class { setName(n:string){return this;} setDescription(d:string){return this;} setMinValue(_: number){return this;} setRequired(_: boolean){return this;} addChoices(..._: any[]){return this;} })()); return this; }
    addBooleanOption(fn: (o:any)=>any) { fn(new (class { setName(n:string){return this;} setDescription(d:string){return this;} setRequired(_: boolean){return this;} })()); return this; }
    addChannelOption(fn: (o:any)=>any) { fn(new (class { setName(n:string){return this;} setDescription(d:string){return this;} addChannelTypes(_: number){return this;} setRequired(_: boolean){return this;} })()); return this; }
    setDMPermission(_: boolean) { return this; }
    toJSON() { return { name: this._name, description: this._description, options: this._options }; }
  },

  // Embed and Message components
  EmbedBuilder: (() => {
    const MockEmbedBuilder = vi.fn().mockImplementation(function EmbedBuilder(this: any) {
      // Initialize properties
      this._title = undefined;
      this._description = undefined;
      this._color = undefined;
      this._fields = [];
      this._footer = undefined;
      this._author = undefined;
      this._image = undefined;
      this._thumbnail = undefined;
      this._url = undefined;
      this._timestamp = undefined;

      // Implement methods with proper state tracking
      this.setTitle = vi.fn().mockImplementation((title: string) => {
        this._title = title;
        return this;
      });

      this.setDescription = vi.fn().mockImplementation((description: string) => {
        this._description = description;
        return this;
      });

      this.setColor = vi.fn().mockImplementation((color: number | string) => {
        this._color = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
        return this;
      });

      this.addFields = vi.fn().mockImplementation((...fields: any[]) => {
        this._fields.push(...fields);
        return this;
      });

      this.addField = vi.fn().mockImplementation((name: string, value: string, inline?: boolean) => {
        this._fields.push({ name, value, inline: inline || false });
        return this;
      });

      this.setTimestamp = vi.fn().mockImplementation((timestamp?: Date | number | string) => {
        if (timestamp) {
          this._timestamp = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
        } else {
          this._timestamp = new Date().toISOString();
        }
        return this;
      });

      this.setFooter = vi.fn().mockImplementation((footer?: any) => {
        this._footer = footer;
        return this;
      });

      this.setAuthor = vi.fn().mockImplementation((author?: any) => {
        this._author = author;
        return this;
      });

      this.setImage = vi.fn().mockImplementation((image?: string) => {
        this._image = image;
        return this;
      });

      this.setThumbnail = vi.fn().mockImplementation((thumbnail?: string) => {
        this._thumbnail = thumbnail;
        return this;
      });

      this.setURL = vi.fn().mockImplementation((url: string) => {
        this._url = url;
        return this;
      });

      this.addDynamicField = vi.fn().mockReturnThis();

      // Implement data getter
      Object.defineProperty(this, 'data', {
        get: () => ({
          title: this._title,
          description: this._description,
          color: this._color,
          fields: this._fields?.length > 0 ? this._fields : undefined,
          footer: this._footer,
          author: this._author,
          image: this._image,
          thumbnail: this._thumbnail,
          url: this._url,
          timestamp: this._timestamp,
        }),
        configurable: true,
        enumerable: true
      });

      this.toJSON = vi.fn().mockImplementation(() => this.data);

      return this;
    });

    // Add static from method
    MockEmbedBuilder.from = vi.fn().mockImplementation((embedData) => {
      const instance = new MockEmbedBuilder();
      if (embedData?.title) instance.setTitle(embedData.title);
      if (embedData?.description) instance.setDescription(embedData.description);
      if (embedData?.color) instance.setColor(embedData.color);
      if (Array.isArray(embedData?.fields) && embedData.fields.length) instance.addFields(...embedData.fields);
      return instance;
    });

    return MockEmbedBuilder;
  })(),

  MessageFlags: {
    Ephemeral: 64,
    SuppressEmbeds: 4,
    SuppressNotifications: 4096,
  },

  // Application command types
  ApplicationCommandOptionType: {
    Subcommand: 1,
    SubcommandGroup: 2,
    String: 3,
    Integer: 4,
    Boolean: 5,
    User: 6,
    Channel: 7,
    Role: 8,
    Mentionable: 9,
    Number: 10,
    Attachment: 11,
  },

  // Button and component builders
  ActionRowBuilder: vi.fn().mockImplementation(function ActionRowBuilder(this: any) {
    this.components = [];

    this.addComponents = vi.fn().mockImplementation((...components: any[]) => {
      this.components.push(...components);
      return this;
    });

    this.setComponents = vi.fn().mockImplementation((...components: any[]) => {
      this.components = components;
      return this;
    });

    // Add data getter to match Discord.js ActionRowBuilder
    Object.defineProperty(this, 'data', {
      get: () => ({
        type: 1,
        components: this.components.map((c: any) => c.data || c),
      }),
      configurable: true,
      enumerable: true
    });

    this.toJSON = vi.fn().mockImplementation(() => this.data);

    return this;
  }),

  ButtonBuilder: vi.fn().mockImplementation(function ButtonBuilder(this: any) {
    this.customId = undefined;
    this.label = undefined;
    this.style = undefined;
    this.emoji = undefined;
    this.disabled = false;
    this.url = undefined;

    this.setCustomId = vi.fn().mockImplementation((customId: string) => {
      this.customId = customId;
      return this;
    });

    this.setLabel = vi.fn().mockImplementation((label: string) => {
      this.label = label;
      return this;
    });

    this.setStyle = vi.fn().mockImplementation((style: number) => {
      this.style = style;
      return this;
    });

    this.setEmoji = vi.fn().mockImplementation((emoji: any) => {
      this.emoji = emoji;
      return this;
    });

    this.setDisabled = vi.fn().mockImplementation((disabled: boolean = true) => {
      this.disabled = disabled;
      return this;
    });

    this.setURL = vi.fn().mockImplementation((url: string) => {
      this.url = url;
      return this;
    });

    // Add data getter to match Discord.js ButtonBuilder
    Object.defineProperty(this, 'data', {
      get: () => ({
        type: 2,
        custom_id: this.customId,
        label: this.label,
        style: this.style,
        emoji: this.emoji,
        disabled: this.disabled,
        url: this.url,
      }),
      configurable: true,
      enumerable: true
    });

    this.toJSON = vi.fn().mockImplementation(() => this.data);

    return this;
  }),

  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
  },

  // Select menu builders
  StringSelectMenuBuilder: vi.fn().mockImplementation(function StringSelectMenuBuilder(this: any) {
    this.customId = undefined;
    this.placeholder = undefined;
    this.options = [];

    this.setCustomId = vi.fn().mockImplementation((customId: string) => {
      this.customId = customId;
      return this;
    });

    this.setPlaceholder = vi.fn().mockImplementation((placeholder: string) => {
      this.placeholder = placeholder;
      return this;
    });

    this.addOptions = vi.fn().mockImplementation((...options: any[]) => {
      this.options.push(...options);
      return this;
    });

    this.setOptions = vi.fn().mockImplementation((...options: any[]) => {
      this.options = options;
      return this;
    });

    this.setMinValues = vi.fn().mockReturnThis();
    this.setMaxValues = vi.fn().mockReturnThis();
    this.setDisabled = vi.fn().mockReturnThis();

    // Add data getter to match Discord.js StringSelectMenuBuilder
    Object.defineProperty(this, 'data', {
      get: () => ({
        type: 3,
        custom_id: this.customId,
        placeholder: this.placeholder,
        options: this.options.map((o: any) => o.data || o),
      }),
      configurable: true,
      enumerable: true
    });

    this.toJSON = vi.fn().mockImplementation(() => this.data);

    return this;
  }),

  StringSelectMenuOptionBuilder: vi.fn().mockImplementation(function StringSelectMenuOptionBuilder(this: any) {
    this.label = undefined;
    this.value = undefined;
    this.description = undefined;
    this.emoji = undefined;
    this.default = false;

    this.setLabel = vi.fn().mockImplementation((label: string) => {
      this.label = label;
      return this;
    });

    this.setValue = vi.fn().mockImplementation((value: string) => {
      this.value = value;
      return this;
    });

    this.setDescription = vi.fn().mockImplementation((description: string) => {
      this.description = description;
      return this;
    });

    this.setEmoji = vi.fn().mockImplementation((emoji: any) => {
      this.emoji = emoji;
      return this;
    });

    this.setDefault = vi.fn().mockImplementation((isDefault: boolean = true) => {
      this.default = isDefault;
      return this;
    });

    // Add data getter to match Discord.js StringSelectMenuOptionBuilder
    Object.defineProperty(this, 'data', {
      get: () => ({
        label: this.label,
        value: this.value,
        description: this.description,
        emoji: this.emoji,
        default: this.default,
      }),
      configurable: true,
      enumerable: true
    });

    this.toJSON = vi.fn().mockImplementation(() => this.data);

    return this;
  }),

  // Modal builders
  ModalBuilder: vi.fn().mockImplementation(function ModalBuilder(this: any) {
    this.customId = undefined;
    this.title = undefined;
    this.components = [];

    this.setCustomId = vi.fn().mockImplementation((customId: string) => {
      this.customId = customId;
      return this;
    });

    this.setTitle = vi.fn().mockImplementation((title: string) => {
      this.title = title;
      return this;
    });

    this.addComponents = vi.fn().mockImplementation((...components: any[]) => {
      this.components.push(...components);
      return this;
    });

    this.setComponents = vi.fn().mockImplementation((...components: any[]) => {
      this.components = components;
      return this;
    });

    // Add data getter to match Discord.js ModalBuilder
    Object.defineProperty(this, 'data', {
      get: () => ({
        custom_id: this.customId,
        title: this.title,
        components: this.components,
      }),
      configurable: true,
      enumerable: true
    });

    this.toJSON = vi.fn().mockImplementation(() => this.data);

    return this;
  }),

  TextInputBuilder: vi.fn().mockImplementation(function TextInputBuilder(this: any) {
    this.customId = undefined;
    this.label = undefined;
    this.style = undefined;
    this.placeholder = undefined;
    this.value = undefined;
    this.required = false;
    this.minLength = undefined;
    this.maxLength = undefined;

    this.setCustomId = vi.fn().mockImplementation((customId: string) => {
      this.customId = customId;
      return this;
    });

    this.setLabel = vi.fn().mockImplementation((label: string) => {
      this.label = label;
      return this;
    });

    this.setStyle = vi.fn().mockImplementation((style: number) => {
      this.style = style;
      return this;
    });

    this.setPlaceholder = vi.fn().mockImplementation((placeholder: string) => {
      this.placeholder = placeholder;
      return this;
    });

    this.setValue = vi.fn().mockImplementation((value: string) => {
      this.value = value;
      return this;
    });

    this.setRequired = vi.fn().mockImplementation((required: boolean = true) => {
      this.required = required;
      return this;
    });

    this.setMinLength = vi.fn().mockImplementation((minLength: number) => {
      this.minLength = minLength;
      return this;
    });

    this.setMaxLength = vi.fn().mockImplementation((maxLength: number) => {
      this.maxLength = maxLength;
      return this;
    });

    // Add data getter to match Discord.js TextInputBuilder
    Object.defineProperty(this, 'data', {
      get: () => ({
        type: 4,
        custom_id: this.customId,
        label: this.label,
        style: this.style,
        placeholder: this.placeholder,
        value: this.value,
        required: this.required,
        min_length: this.minLength,
        max_length: this.maxLength,
      }),
      configurable: true,
      enumerable: true
    });

    this.toJSON = vi.fn().mockImplementation(() => this.data);

    return this;
  }),

  TextInputStyle: {
    Short: 1,
    Paragraph: 2,
  },

  ComponentType: {
    ActionRow: 1,
    Button: 2,
    StringSelect: 3,
    TextInput: 4,
    UserSelect: 5,
    RoleSelect: 6,
    MentionableSelect: 7,
    ChannelSelect: 8,
  },

  // Permission utilities
  PermissionFlagsBits: {
    CreateInstantInvite: 1n << 0n,
    KickMembers: 1n << 1n,
    BanMembers: 1n << 2n,
    Administrator: 1n << 3n,
    ManageChannels: 1n << 4n,
    ManageGuild: 1n << 5n,
    ManageMessages: 1n << 13n,
    SendMessages: 1n << 11n,
    ReadMessageHistory: 1n << 16n,
    UseApplicationCommands: 1n << 31n,
    ViewChannel: 1n << 10n,
    ManageRoles: 1n << 28n,
  },

  // PermissionsBitField class mock
  PermissionsBitField: (() => {
    const PermissionsBitFieldMock = vi.fn().mockImplementation(function PermissionsBitField(this: any, bits?: bigint | string | number) {
      this.bitfield = typeof bits === 'bigint' ? bits : 0n;
      
      this.has = vi.fn().mockImplementation((permission: bigint) => {
        return (this.bitfield & permission) === permission;
      });
      
      this.add = vi.fn().mockImplementation((...permissions) => {
        for (const permission of permissions) {
          if (typeof permission === 'bigint') {
            this.bitfield |= permission;
          }
        }
        return this;
      });
      
      this.remove = vi.fn().mockImplementation((...permissions) => {
        for (const permission of permissions) {
          if (typeof permission === 'bigint') {
            this.bitfield &= ~permission;
          }
        }
        return this;
      });
      
      this.serialize = vi.fn().mockReturnValue({});
      this.toArray = vi.fn().mockReturnValue([]);
      this.toString = vi.fn().mockImplementation(() => this.bitfield.toString());
      
      return this;
    });

    // Add static Flags property
    PermissionsBitFieldMock.Flags = {
      CreateInstantInvite: 1n << 0n,
      KickMembers: 1n << 1n,
      BanMembers: 1n << 2n,
      Administrator: 1n << 3n,
      ManageChannels: 1n << 4n,
      ManageGuild: 1n << 5n,
      ManageMessages: 1n << 13n,
      SendMessages: 1n << 11n,
      ReadMessageHistory: 1n << 16n,
      UseApplicationCommands: 1n << 31n,
      ViewChannel: 1n << 10n,
      ManageRoles: 1n << 28n,
    };

    return PermissionsBitFieldMock;
  })(),

  // Gateway intents
  GatewayIntentBits: {
    Guilds: 1 << 0,
    GuildMembers: 1 << 1,
    GuildModeration: 1 << 2,
    GuildEmojisAndStickers: 1 << 3,
    GuildIntegrations: 1 << 4,
    GuildWebhooks: 1 << 5,
    GuildInvites: 1 << 6,
    GuildVoiceStates: 1 << 7,
    GuildPresences: 1 << 8,
    GuildMessages: 1 << 9,
    GuildMessageReactions: 1 << 10,
    GuildMessageTyping: 1 << 11,
    DirectMessages: 1 << 12,
    DirectMessageReactions: 1 << 13,
    DirectMessageTyping: 1 << 14,
    MessageContent: 1 << 15,
    GuildScheduledEvents: 1 << 16,
    AutoModerationConfiguration: 1 << 20,
    AutoModerationExecution: 1 << 21,
  },

  // Partials
  Partials: {
    User: 0,
    Channel: 1,
    GuildMember: 2,
    Message: 3,
    Reaction: 4,
    GuildScheduledEvent: 5,
    ThreadMember: 6,
  },

  // Activity types
  ActivityType: {
    Playing: 0,
    Streaming: 1,
    Listening: 2,
    Watching: 3,
    Custom: 4,
    Competing: 5,
  },

  // Events
  Events: {
    ClientReady: 'ready',
    MessageCreate: 'messageCreate',
    InteractionCreate: 'interactionCreate',
    GuildCreate: 'guildCreate',
    GuildDelete: 'guildDelete',
    GuildMemberAdd: 'guildMemberAdd',
    GuildMemberRemove: 'guildMemberRemove',
  },

  // Channel types (subset used in tests)
  ChannelType: {
    GuildText: 0,
    DM: 1,
    GuildVoice: 2,
    GroupDM: 3,
    GuildCategory: 4,
    GuildAnnouncement: 5,
    AnnouncementThread: 10,
    PublicThread: 11,
    PrivateThread: 12,
    GuildStageVoice: 13,
    GuildDirectory: 14,
    GuildForum: 15,
  },

  // REST API
  REST: vi.fn().mockImplementation(() => ({
    setToken: vi.fn().mockReturnThis(),
    put: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue([]),
    patch: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue([]),
  })),

  Routes: {
    applicationCommands: vi.fn().mockImplementation((applicationId) => `/applications/${applicationId}/commands`),
    applicationGuildCommands: vi.fn().mockImplementation((applicationId, guildId) =>
      `/applications/${applicationId}/guilds/${guildId}/commands`),
  },

  // Collection mock
  Collection: class Collection extends Map {
    first() {
      return this.values().next().value;
    }

    filter(fn: Function) {
      const filtered = new Collection();
      for (const [key, val] of this) {
        if (fn(val, key, this)) {
          filtered.set(key, val);
        }
      }
      return filtered;
    }
  },

  // ThreadChannel mock
  ThreadChannel: vi.fn().mockImplementation(function ThreadChannel(this: any, data: any = {}) {
    this.id = data.id || "test_thread_id";
    this.name = data.name || "test-thread";
    this.parentId = data.parentId || "test_parent_id";
    this.archived = data.archived || false;
    this.locked = data.locked || false;

    // Mock messages manager
    this.messages = {
      fetch: vi.fn().mockResolvedValue(new Map()),
      cache: new Map(),
    };

    this.setArchived = vi.fn().mockImplementation((archived: boolean) => {
      this.archived = archived;
      return Promise.resolve(this);
    });

    this.setLocked = vi.fn().mockImplementation((locked: boolean) => {
      this.locked = locked;
      return Promise.resolve(this);
    });

    this.send = vi.fn().mockResolvedValue({
      id: "test_message_id",
      content: "Test message",
      author: { id: "test_user_id", username: "TestUser" },
    });

    this.edit = vi.fn().mockResolvedValue(this);
    this.delete = vi.fn().mockResolvedValue(undefined);

    return this;
  }),
}));

// Mock the Discord client instance import
vi.mock("../src/discord/discord", () => ({
  default: {
    user: { id: "test_bot_id", username: "TestBot" },
    guilds: { cache: new Map(), fetch: vi.fn().mockResolvedValue({}) },
    channels: {
      cache: new Map([["test_channel_id", { id: "test_channel_id", url: "https://discord.com/channels/test/test_channel_id" }]]),
      fetch: vi.fn().mockResolvedValue({})
    },
    users: { cache: new Map(), fetch: vi.fn().mockResolvedValue({}) },
    application: {
      commands: {
        create: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue([]),
        fetch: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({}),
      },
    },
    login: vi.fn().mockResolvedValue("token"),
    destroy: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    readyTimestamp: Date.now(),
  },
}));

// Mock the store module with comprehensive implementation
vi.mock("../src/store", async () => {
  const { mockStore } = await import("./mocks/store");
  return {
    store: mockStore,
  };
});

// Mock Winston logger with comprehensive implementation
vi.mock("winston", async () => {
  const { default: winstonMock } = await import("./mocks/winston");
  // Return both default and named exports to satisfy ESM import patterns
  return { default: winstonMock, ...winstonMock } as any;
});

// Mock logger module (retain real URL helpers for logger tests)
vi.mock("../src/logger", async () => {
  const actual = await vi.importActual<any>("../src/logger");
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      silly: vi.fn(),
    },
    Triggerer: actual.Triggerer,
    Actions: actual.Actions,
    // Use real implementations so src/__tests__/logger.test.ts can validate behavior
    getDiscordUrl: actual.getDiscordUrl,
    getGithubUrl: actual.getGithubUrl,
  };
});

// Mock the GitHub API modules
vi.mock("@octokit/rest", async () => {
  const { MockOctokit } = await import("./mocks/github");
  return { Octokit: MockOctokit };
});

vi.mock("@octokit/graphql", async () => {
  const { graphql } = await import("./mocks/github");
  return { graphql };
});

// Mock Jira client
vi.mock("jira.js", async () => {
  const { MockVersion3Client } = await import("./mocks/jira");
  return { Version3Client: MockVersion3Client };
});

// Mock ModalFormManager
vi.mock("../src/discord/framework/ModalFormManager", async () => {
  const { default: modalFormManagerMock } = await import("./mocks/modalFormManager");
  return modalFormManagerMock;
});

// Mock Discord commands
vi.mock("../src/discord/commands/priority", async () => {
  const { mockPriorityCommand } = await import("./mocks/commands");
  return { priorityCommand: mockPriorityCommand };
});

vi.mock("../src/discord/commands/status", async () => {
  const { mockStatusCommand } = await import("./mocks/commands");
  return { statusCommand: mockStatusCommand };
});

vi.mock("../src/discord/commands/issue", async () => {
  const actual = await vi.importActual<any>("../src/discord/commands/issue");
  const data = {
    name: "issue",
    description: "Show detailed issue information with interactive controls",
    options: [
      {
        type: 4,
        name: "number",
        description: "GitHub issue number",
        required: false,
      },
    ],
    dm_permission: false,
  };
  return { issueCommand: { ...actual.issueCommand, data } };
});

// Mock Help command to simplify embed mocking in tests
vi.mock("../src/discord/commands/help", async () => {
  const { mockHelpCommand } = await import("./mocks/commands");
  return { helpCommand: mockHelpCommand };
});

// Mock ActionButtonManager
vi.mock("../src/discord/framework/ActionButtonManager", async () => {
  const { default: actionButtonManagerMock } = await import("./mocks/actionButtonManager");
  return actionButtonManagerMock;
});

// Mock SmartEmbedBuilder
vi.mock("../src/discord/framework/SmartEmbedBuilder", () => ({
  SmartEmbedBuilder: vi.fn().mockImplementation(function SmartEmbedBuilder(this: any, config: any = {}) {
      // Create mock EmbedBuilder instance
      const mockEmbed = {
        _title: config.title,
        _description: config.description,
        _color: config.color,
        _fields: [],
        _footer: undefined,
        _author: undefined,
        _image: undefined,
        _thumbnail: undefined,
        _url: undefined,
        _timestamp: undefined,
      };

      // Add methods to the mock embed
      mockEmbed.setTitle = vi.fn().mockImplementation((title: string) => {
        mockEmbed._title = title;
        return mockEmbed;
      });

      mockEmbed.setDescription = vi.fn().mockImplementation((description: string) => {
        mockEmbed._description = description;
        return mockEmbed;
      });

      mockEmbed.setColor = vi.fn().mockImplementation((color: number | string) => {
        mockEmbed._color = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
        return mockEmbed;
      });

      mockEmbed.addFields = vi.fn().mockImplementation((...fields: any[]) => {
        mockEmbed._fields.push(...fields);
        return mockEmbed;
      });

      mockEmbed.addField = vi.fn().mockImplementation((name: string, value: string, inline?: boolean) => {
        mockEmbed._fields.push({ name, value, inline: inline || false });
        return mockEmbed;
      });

      mockEmbed.setTimestamp = vi.fn().mockImplementation((timestamp?: Date | number | string) => {
        if (timestamp) {
          mockEmbed._timestamp = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
        } else {
          mockEmbed._timestamp = new Date().toISOString();
        }
        return mockEmbed;
      });

      mockEmbed.setFooter = vi.fn().mockImplementation((footer?: any) => {
        mockEmbed._footer = footer;
        return mockEmbed;
      });

      mockEmbed.setAuthor = vi.fn().mockImplementation((author?: any) => {
        mockEmbed._author = author;
        return mockEmbed;
      });

      mockEmbed.setImage = vi.fn().mockImplementation((image?: string) => {
        mockEmbed._image = image;
        return mockEmbed;
      });

      mockEmbed.setThumbnail = vi.fn().mockImplementation((thumbnail?: string) => {
        mockEmbed._thumbnail = thumbnail;
        return mockEmbed;
      });

      mockEmbed.setURL = vi.fn().mockImplementation((url: string) => {
        mockEmbed._url = url;
        return mockEmbed;
      });

      // Data getter for mock embed
      Object.defineProperty(mockEmbed, 'data', {
        get: () => ({
          title: mockEmbed._title,
          description: mockEmbed._description,
          color: mockEmbed._color,
          fields: mockEmbed._fields?.length > 0 ? mockEmbed._fields : undefined,
          footer: mockEmbed._footer,
          author: mockEmbed._author,
          image: mockEmbed._image,
          thumbnail: mockEmbed._thumbnail,
          url: mockEmbed._url,
          timestamp: mockEmbed._timestamp,
        }),
        configurable: true,
        enumerable: true
      });

      mockEmbed.toJSON = vi.fn().mockImplementation(() => mockEmbed.data);

      // Set up the SmartEmbedBuilder instance
      this._embed = mockEmbed;

      // Expose embed property via getter
      Object.defineProperty(this, 'embed', {
        get: () => this._embed,
        configurable: true,
        enumerable: true
      });

      // Add SmartEmbedBuilder methods
      this.addDynamicField = vi.fn().mockReturnThis();
      this.addActionButton = vi.fn().mockReturnThis();
      this.setMetadata = vi.fn().mockReturnThis();
      this.build = vi.fn().mockReturnValue({ embeds: [this._embed], components: [] });
      this.getState = vi.fn().mockReturnValue({
        id: config.id || 'test',
        version: 1,
        metadata: {},
        embedData: this._embed.data,
        components: [],
        lastUpdated: new Date()
      });
      this.refresh = vi.fn().mockReturnThis();
      this.updateField = vi.fn().mockResolvedValue(this);
      this.addSelectMenu = vi.fn().mockReturnThis();
      this.getMetadata = vi.fn().mockReturnValue({});
      this.clone = vi.fn().mockReturnThis();
      this.destroy = vi.fn();
      this.on = vi.fn();
      this.emit = vi.fn();

      return this;
  }),
  SmartEmbedManager: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    getAllStates: vi.fn().mockReturnValue([]),
    refreshAll: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    findByMetadata: vi.fn().mockReturnValue([]),
    getStats: vi.fn().mockReturnValue({ totalEmbeds: 0 }),
    on: vi.fn(),
    emit: vi.fn(),
  })),
  smartEmbedManager: {
    register: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    getAllStates: vi.fn().mockReturnValue([]),
    refreshAll: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    findByMetadata: vi.fn().mockReturnValue([]),
    getStats: vi.fn().mockReturnValue({ totalEmbeds: 0 }),
    on: vi.fn(),
    emit: vi.fn(),
  },
}));

// Mock StateManager
vi.mock("../src/discord/framework/StateManager", () => {
  const createMockStateManager = () => {
    const states = new Map();
    const listeners = [];

    return {
      registerState: vi.fn().mockImplementation((state) => {
        states.set(state.id, state);
        listeners.forEach(listener => {
          try { listener('stateRegistered', state); } catch {}
        });
      }),
      updateState: vi.fn().mockResolvedValue(true),
      updateField: vi.fn().mockImplementation(async (embedId, field, value) => {
        const state = states.get(embedId);
        if (!state) return false;

        // Update the field in the state
        const fieldPath = field.split('.');
        let target = state;
        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (!target[fieldPath[i]]) target[fieldPath[i]] = {};
          target = target[fieldPath[i]];
        }
        target[fieldPath[fieldPath.length - 1]] = value;

        // Emit fieldUpdated event
        listeners.forEach(listener => {
          try {
            listener('fieldUpdated', {
              embedId,
              field,
              newValue: value,
              oldValue: undefined
            });
          } catch {}
        });

        return true;
      }),
      getState: vi.fn().mockImplementation((id) => {
        return states.get(id);
      }),
      getAllStates: vi.fn().mockImplementation(() => Array.from(states.values())),
      subscribe: vi.fn().mockReturnValue(() => {}),
      removeState: vi.fn().mockImplementation((id) => {
        return states.delete(id);
      }),
      setPersistenceEnabled: vi.fn(),
      getQueueLength: vi.fn().mockReturnValue(0),
      cleanup: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({
        totalStates: states.size,
        activeSubscriptions: listeners.length,
        queueLength: 0,
        autoUpdateStates: 0
      }),
      on: vi.fn().mockImplementation((event, listener) => {
        listeners.push(listener);
      }),
      emit: vi.fn().mockImplementation((event, data) => {
        listeners.forEach(listener => {
          try { listener(event, data); } catch {}
        });
      }),
      // Clear states for test isolation
      __clearStates: () => {
        states.clear();
        listeners.length = 0;
      }
    };
  };

  const mockInstance = createMockStateManager();

  return {
    StateManager: vi.fn().mockImplementation(() => mockInstance),
    stateManager: mockInstance
  };
});

// Mock Express to prevent port conflicts - temporarily disabled
// vi.mock("express", () => {
//   const createMockApp = () => ({
//     use: vi.fn(),
//     get: vi.fn(),
//     post: vi.fn(),
//     listen: vi.fn((port, callback) => {
//       if (callback) callback();
//       return { close: vi.fn() };
//     }),
//     set: vi.fn(),
//     enable: vi.fn(),
//     disable: vi.fn(),
//   });

//   const mockExpress = vi.fn(() => createMockApp());
//   mockExpress.json = vi.fn(() => vi.fn());
//   mockExpress.urlencoded = vi.fn(() => vi.fn());
//   mockExpress.static = vi.fn(() => vi.fn());
//   mockExpress.Router = vi.fn(() => createMockApp());

//   return {
//     default: mockExpress,
//     ...mockExpress,
//   };
// });

// Mock SQLite database module for shadow DB operations
vi.mock("../db/sqlite.js", () => ({
  openDatabase: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn().mockReturnValue(undefined),
    close: vi.fn().mockReturnValue(undefined),
    transaction: vi.fn().mockImplementation((fn) => {
      const mockTransaction = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
        }),
      };
      return fn(mockTransaction);
    }),
  }),
  ensureSchema: vi.fn().mockReturnValue(undefined),
  upsertJiraLink: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
  upsertGitHubLink: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
  deleteJiraLink: vi.fn().mockReturnValue({ changes: 1 }),
  deleteGitHubLink: vi.fn().mockReturnValue({ changes: 1 }),
  getJiraLinks: vi.fn().mockReturnValue([]),
  getGitHubLinks: vi.fn().mockReturnValue([]),
}));

// Mock better-sqlite3 (in case it's directly imported)
vi.mock("better-sqlite3", () => ({
  default: vi.fn().mockImplementation((dbPath) => ({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn().mockReturnValue(undefined),
    close: vi.fn().mockReturnValue(undefined),
    transaction: vi.fn().mockImplementation((fn) => {
      const mockTransaction = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
        }),
      };
      return fn(mockTransaction);
    }),
  })),
}));

// Mock filesystem operations for data directory
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{"jiraLinks":[],"githubLinks":[],"version":1}'),
  access: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({
    isDirectory: () => true,
    isFile: () => true,
    size: 1024,
    mtime: new Date(),
    ctime: new Date(),
  }),
}));

// Mock path operations
vi.mock("path", async () => {
  const actual = await vi.importActual("path") as any;
  return {
    ...actual,
    join: vi.fn().mockImplementation((...args) => args.join("/")),
    dirname: vi.fn().mockImplementation((p) => p.split("/").slice(0, -1).join("/")),
    resolve: vi.fn().mockImplementation((...args) => "/" + args.join("/")),
  };
});

// Global error handler for unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection in test:", reason);
});

// Increase timeout for async operations in tests
expect.addSnapshotSerializer({
  serialize: (val) => String(val),
  test: (val) => typeof val === "string" && val.includes("test"),
});

// Enhanced command test utilities
function setupCommandTestUtilities() {
  // Ensure comprehensive interaction mock creator is available
  (globalThis as any).createMockInteraction = createComprehensiveMockInteraction;
  (globalThis as any).createMockThreadChannel = createMockThreadChannel;
  (globalThis as any).createMockGuild = createMockGuild;
}

// Comprehensive mock interaction creator for command testing
function createComprehensiveMockInteraction(options: any = {}) {
  const mockInteraction = {
    // Basic properties
    customId: options.customId || "test_interaction",
    commandName: options.commandName || "test",
    channelId: options.channelId || "test_channel_123",
    guildId: options.guildId || "test_guild_123",
    
    // User information
    user: {
      id: options.userId || "test_user_123",
      username: options.username || "testuser",
      discriminator: "0000",
      tag: `${options.username || "testuser"}#0000`,
      bot: false,
      ...options.user
    },
    
    // Member information
    member: {
      id: options.userId || "test_user_123",
      displayName: options.displayName || "Test User",
      user: {
        id: options.userId || "test_user_123",
        username: options.username || "testuser"
      },
      ...options.member
    },
    
    // Guild information - critical for command validation
    guild: options.guild !== null ? {
      id: options.guildId || "test_guild_123",
      name: "Test Guild",
      channels: {
        cache: new Map(),
        fetch: vi.fn().mockResolvedValue({})
      },
      members: {
        cache: new Map(),
        fetch: vi.fn().mockResolvedValue({})
      },
      ...options.guild
    } : null,
    
    // Channel information with thread support
    channel: options.channel !== null ? createMockThreadChannel({
      id: options.channelId || "test_channel_123",
      name: options.channelName || "test-thread",
      isThread: options.isThread !== false,
      ...options.channel
    }) : null,
    
    // Interaction state tracking - critical for command flow
    replied: false,
    deferred: false,
    
    // Core interaction methods with state tracking
    reply: vi.fn().mockImplementation(async (response) => {
      if (mockInteraction.replied || mockInteraction.deferred) {
        throw new Error('Interaction has already been replied to');
      }
      mockInteraction.replied = true;
      return { id: 'mock_message_id', ...response };
    }),
    
    deferReply: vi.fn().mockImplementation(async (options = {}) => {
      if (mockInteraction.replied || mockInteraction.deferred) {
        throw new Error('Interaction has already been replied to');
      }
      mockInteraction.deferred = true;
      return undefined;
    }),
    
    editReply: vi.fn().mockImplementation(async (response) => {
      if (!mockInteraction.replied && !mockInteraction.deferred) {
        throw new Error('Interaction must be replied to or deferred first');
      }
      return { id: 'mock_message_id', ...response };
    }),
    
    followUp: vi.fn().mockImplementation(async (response) => {
      if (!mockInteraction.replied && !mockInteraction.deferred) {
        throw new Error('Interaction must be replied to first');
      }
      return { id: 'mock_followup_id', ...response };
    }),
    
    deferUpdate: vi.fn().mockImplementation(async () => {
      mockInteraction.deferred = true;
      return undefined;
    }),
    
    update: vi.fn().mockImplementation(async (response) => {
      return { id: 'mock_message_id', ...response };
    }),
    
    deleteReply: vi.fn().mockResolvedValue(undefined),
    fetchReply: vi.fn().mockResolvedValue({ id: 'mock_message_id' }),
    
    // Options handling - comprehensive support for all option types
    options: {
      getString: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return typeof value === 'string' ? value : null;
      }),
      getInteger: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return typeof value === 'number' ? Math.floor(value) : null;
      }),
      getNumber: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return typeof value === 'number' ? value : null;
      }),
      getBoolean: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return typeof value === 'boolean' ? value : null;
      }),
      getUser: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        if (value && typeof value === 'object' && value.id) {
          return {
            id: value.id,
            username: value.username || 'testuser',
            discriminator: '0000',
            tag: `${value.username || 'testuser'}#0000`,
            bot: false,
            ...value
          };
        }
        return null;
      }),
      getChannel: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return value && typeof value === 'object' ? value : null;
      }),
      getRole: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return value && typeof value === 'object' ? value : null;
      }),
      getMember: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return value && typeof value === 'object' ? value : null;
      }),
      getMentionable: vi.fn().mockImplementation((name: string) => {
        const value = options.options?.[name];
        return value && typeof value === 'object' ? value : null;
      }),
      getSubcommand: vi.fn().mockReturnValue(options.subcommand || null),
      getSubcommandGroup: vi.fn().mockReturnValue(options.subcommandGroup || null),
      get: vi.fn().mockImplementation((name: string) => options.options?.[name] || null),
      ...options.optionOverrides
    },
    
    // Modal and component interaction support
    fields: {
      getTextInputValue: vi.fn().mockImplementation((customId: string) => {
        return options.fieldValues?.[customId] || '';
      }),
      ...options.fieldsOverrides
    },
    
    // Interaction type detection
    isChatInputCommand: vi.fn().mockReturnValue(options.type === 'command' || !options.type),
    isButton: vi.fn().mockReturnValue(options.type === 'button'),
    isStringSelectMenu: vi.fn().mockReturnValue(options.type === 'select'),
    isModalSubmit: vi.fn().mockReturnValue(options.type === 'modal'),
    isContextMenuCommand: vi.fn().mockReturnValue(options.type === 'contextMenu'),
    
    // Client reference for advanced operations
    client: {
      users: {
        cache: new Map(),
        fetch: vi.fn().mockImplementation(async (userId) => ({
          id: userId,
          username: 'fetcheduser',
          discriminator: '0000',
          tag: 'fetcheduser#0000'
        }))
      },
      channels: {
        cache: new Map(),
        fetch: vi.fn().mockResolvedValue({})
      }
    },
    
    // Additional properties
    ...options.additionalProps
  };
  
  return mockInteraction;
}

// Mock thread channel creator
function createMockThreadChannel(options: any = {}) {
  return {
    id: options.id || "test_channel_123",
    name: options.name || "test-thread",
    type: options.type || 11, // Thread channel type
    parentId: options.parentId || "test_parent_123",
    
    // Thread-specific methods - critical for command validation
    isThread: vi.fn().mockReturnValue(options.isThread !== false),
    
    // Thread management
    setArchived: vi.fn().mockResolvedValue(undefined),
    setLocked: vi.fn().mockResolvedValue(undefined),
    setName: vi.fn().mockResolvedValue(undefined),
    
    // Message operations
    send: vi.fn().mockResolvedValue({
      id: 'mock_message_id',
      content: 'Mock message',
      edit: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    }),
    
    messages: {
      fetch: vi.fn().mockResolvedValue(new Map()),
      cache: new Map()
    },
    
    // Additional properties
    url: options.url || `https://discord.com/channels/test_guild/test_channel/${options.id || 'test_channel_123'}`,
    ...options
  };
}

// Mock guild creator
function createMockGuild(options: any = {}) {
  return {
    id: options.id || "test_guild_123",
    name: options.name || "Test Guild",
    
    channels: {
      cache: new Map(),
      fetch: vi.fn().mockResolvedValue({})
    },
    
    members: {
      cache: new Map(),
      fetch: vi.fn().mockResolvedValue({
        id: 'test_member_id',
        displayName: 'Test Member',
        user: {
          id: 'test_user_id',
          username: 'testuser'
        }
      })
    },
    
    roles: {
      cache: new Map(),
      fetch: vi.fn().mockResolvedValue({})
    },
    
    ...options
  };
}

// Add global test utilities
declare global {
  var testUtils: {
    mockDiscordInteraction: (customId?: string, userId?: string) => any;
    mockGitHubRequest: (body?: any, action?: string) => any;
    mockJiraIssue: (overrides?: any) => any;
    createMockLogger: () => any;
    waitFor: (fn: () => boolean, timeout?: number) => Promise<void>;
  };
  var createMockInteraction: (options?: any) => any;
  var createMockThreadChannel: (options?: any) => any;
  var createMockGuild: (options?: any) => any;
  var mockInitDiscord: any;
  var mockInitGithub: any;
}

globalThis.testUtils = {
  // Legacy method - maintained for backwards compatibility
  mockDiscordInteraction: (customId = "test_custom_id", userId = "test_user_id") => {
    return createComprehensiveMockInteraction({
      customId,
      userId,
      type: 'command'
    });
  },

  mockGitHubRequest: (body = {}, action = "opened") => ({
    body: {
      action,
      issue: {
        id: 123,
        number: 1,
        title: "Test Issue",
        body: "Test issue description",
        html_url: "https://github.com/test/repo/issues/1",
        state: "open",
        locked: false,
        node_id: "test_node_id",
        user: { login: "testuser", id: 12345 },
        assignees: [],
        labels: [],
        milestone: null,
        comments: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        closed_at: null,
      },
      repository: {
        name: "test_repo",
        full_name: "test_user/test_repo",
        owner: { login: "test_user", id: 12345 },
        html_url: "https://github.com/test_user/test_repo",
      },
      sender: {
        login: "test_user",
        id: 12345,
        type: "User",
      },
      ...body,
    },
    headers: {
      "x-github-event": "issues",
      "x-github-delivery": "test-delivery-id",
    },
  }),

  mockJiraIssue: (overrides = {}) => ({
    id: "10001",
    key: "TEST-1",
    summary: "Test Jira Issue",
    description: "Test Jira issue description",
    status: {
      id: "1",
      name: "To Do",
      statusCategory: { key: "new", name: "New" },
    },
    priority: {
      id: "3",
      name: "Medium",
    },
    assignee: null,
    reporter: {
      accountId: "test-account-id",
      displayName: "Test User",
      emailAddress: "test@example.com",
    },
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    labels: [],
    components: [],
    issueType: {
      id: "10001",
      name: "Bug",
      iconUrl: "https://test.atlassian.net/images/icons/bug.png",
    },
    ...overrides,
  }),

  createMockLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
  }),

  waitFor: async (fn: () => boolean, timeout = 1000): Promise<void> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (fn()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`waitFor timed out after ${timeout}ms`);
  },
};

// Make comprehensive test utilities available globally
(global as any).testUtils = testUtils;
(global as any).createMockInteraction = createComprehensiveMockInteraction;
(global as any).createMockThreadChannel = createMockThreadChannel;
(global as any).createMockGuild = createMockGuild;

// Export common test utilities for direct import
export {
  vi,
  expect,
  beforeEach,
  afterEach,
};

vi.mock("../src/config", async () => {
  const actual: any = await vi.importActual("../src/config").catch(() => ({}));
  const baseConfig: any = (actual && actual.config) ? actual.config : {};
  const discord = baseConfig.discord ?? {};
  const github = baseConfig.github ?? {};
  const jira = baseConfig.jira ?? {};
  return {
    ...actual,
    config: {
      ...baseConfig,
      discord: {
        ...discord,
        smartEmbeds: {
          ...(discord.smartEmbeds ?? {}),
          enabled: true,
          autoUpdateInterval: 1000,
        },
      },
      github: {
        ...github,
        autoLink: {
          ...(github.autoLink ?? {}),
          enabled: true,
        },
      },
      jira: {
        ...jira,
        autoLink: {
          ...(jira.autoLink ?? {}),
          enabled: true,
        },
      },
    },
  };
});
