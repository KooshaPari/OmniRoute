/**
 * Discord.js Mock Implementation
 * 
 * Comprehensive mock for Discord.js library including Client, Interactions,
 * Embeds, Components, and other Discord API objects.
 */

import { vi } from "vitest";

// Mock Discord.js constants
export const ActivityType = {
  Playing: 0,
  Streaming: 1,
  Listening: 2,
  Watching: 3,
  Custom: 4,
  Competing: 5,
} as const;

export const ApplicationCommandType = {
  ChatInput: 1,
  User: 2,
  Message: 3,
} as const;

export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
} as const;

export const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
  Link: 5,
} as const;

export const TextInputStyle = {
  Short: 1,
  Paragraph: 2,
} as const;

export const ChannelType = {
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
} as const;

// Mock MessageFlags
export const MessageFlags = {
  Crossposted: 1 << 0,
  IsCrosspost: 1 << 1,
  SuppressEmbeds: 1 << 2,
  SourceMessageDeleted: 1 << 3,
  Urgent: 1 << 4,
  HasThread: 1 << 5,
  Ephemeral: 1 << 6,
  Loading: 1 << 7,
  FailedToMentionSomeRolesInThread: 1 << 8,
  SuppressNotifications: 1 << 12,
  IsVoiceMessage: 1 << 13,
};

// Mock PermissionFlagsBits
export const PermissionFlagsBits = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageGuildExpressions: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ViewCreatorMonetizationAnalytics: 1n << 41n,
  UseSoundboard: 1n << 42n,
  UseExternalSounds: 1n << 45n,
  SendVoiceMessages: 1n << 46n,
};

// Mock InteractionResponseType
export const InteractionResponseType = {
  Pong: 1,
  ChannelMessageWithSource: 4,
  DeferredChannelMessageWithSource: 5,
  DeferredUpdateMessage: 6,
  UpdateMessage: 7,
  ApplicationCommandAutocompleteResult: 8,
  Modal: 9,
};

// Simple mock implementations for basic classes
export class SlashCommandBuilder {
  public name: string = "";
  public description: string = "";
  public options: any[] = [];

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  addStringOption = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const option = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        setRequired: vi.fn().mockReturnThis(),
        setChoices: vi.fn().mockReturnThis(),
        addChoices: vi.fn().mockReturnThis(),
        setAutocomplete: vi.fn().mockReturnThis(),
      };
      fn(option);
    }
    return this;
  });
  
  addIntegerOption = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const option = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        setRequired: vi.fn().mockReturnThis(),
        setChoices: vi.fn().mockReturnThis(),
        addChoices: vi.fn().mockReturnThis(),
        setMinValue: vi.fn().mockReturnThis(),
        setMaxValue: vi.fn().mockReturnThis(),
      };
      fn(option);
    }
    return this;
  });
  
  addBooleanOption = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const option = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        setRequired: vi.fn().mockReturnThis(),
      };
      fn(option);
    }
    return this;
  });
  
  addUserOption = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const option = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        setRequired: vi.fn().mockReturnThis(),
      };
      fn(option);
    }
    return this;
  });
  
  addChannelOption = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const option = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        setRequired: vi.fn().mockReturnThis(),
        addChannelTypes: vi.fn().mockReturnThis(),
      };
      fn(option);
    }
    return this;
  });
  
  addRoleOption = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const option = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        setRequired: vi.fn().mockReturnThis(),
      };
      fn(option);
    }
    return this;
  });
  
  addSubcommand = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const subcommand = new SlashCommandBuilder();
      fn(subcommand);
    }
    return this;
  });
  
  addSubcommandGroup = vi.fn().mockImplementation((fn?: Function) => {
    if (fn) {
      const group = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        addSubcommand: vi.fn().mockImplementation((fn2?: Function) => {
          if (fn2) {
            const subcommand = new SlashCommandBuilder();
            fn2(subcommand);
          }
          return group;
        }),
      };
      fn(group);
    }
    return this;
  });
  
  setDMPermission = vi.fn().mockReturnThis();

  toJSON(): any {
    return {
      name: this.name,
      description: this.description,
      options: this.options,
    };
  }
}

export class Client {
  public user: any = { id: "test_bot_id", username: "TestBot" };
  public guilds: any = {
    cache: new Map(),
    fetch: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve({
        id,
        name: "Test Guild",
        ownerId: "owner_123456",
        memberCount: 100,
        channels: { cache: new Map() },
      });
    }),
  };
  public users: any = {
    cache: new Map(),
    fetch: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve(new User({ id, username: "TestUser" }));
    }),
  };
  public channels: any = {
    cache: new Map(),
    fetch: vi.fn().mockImplementation((id: string) => {
      if (id === "test_channel_id") {
        return Promise.resolve({
          id,
          name: "test-forum",
          type: ChannelType.GuildForum,
          threads: {
            create: vi.fn().mockResolvedValue({
              id: "test_thread_id_" + Math.random().toString(36).substr(2, 9),
              name: "Test Thread",
              parentId: id,
            }),
            fetch: vi.fn().mockResolvedValue(new Map()),
            cache: new Map(),
          },
          parent: {
            createWebhook: vi.fn().mockImplementation((options: any) => {
              return Promise.resolve({
                id: "test_webhook_id",
                name: options.name || "Test Webhook",
                avatar: options.avatar || null,
                channelId: id,
                send: vi.fn().mockResolvedValue({
                  id: "test_message_id",
                  content: "Test message",
                  author: { username: options.name, avatar: options.avatar },
                }),
                delete: vi.fn().mockResolvedValue(undefined),
              });
            }),
          },
        });
      }
      return Promise.resolve(new ThreadChannel({ id, name: "test-thread" }));
    }),
  };

  constructor() {
    // Set up default test channel in cache after construction
    this.channels.cache.set("test_channel_id", {
      id: "test_channel_id",
      name: "test-forum",
      type: ChannelType.GuildForum,
      threads: {
        create: vi.fn().mockResolvedValue({
          id: "test_thread_id_" + Math.random().toString(36).substr(2, 9),
          name: "Test Thread",
          parentId: "test_channel_id",
        }),
        fetch: vi.fn().mockResolvedValue(new Map()),
        cache: new Map(),
      },
      parent: {
        createWebhook: vi.fn().mockImplementation((options: any) => {
          return Promise.resolve({
            id: "test_webhook_id",
            name: options.name || "Test Webhook",
            avatar: options.avatar || null,
            channelId: "test_channel_id",
            send: vi.fn().mockResolvedValue({
              id: "test_message_id",
              content: "Test message",
              author: { username: options.name, avatar: options.avatar },
            }),
            delete: vi.fn().mockResolvedValue(undefined),
          });
        }),
      },
    });
  }

  login = vi.fn().mockResolvedValue("token");
  on = vi.fn().mockReturnThis();
  once = vi.fn().mockReturnThis();
  destroy = vi.fn().mockResolvedValue(undefined);
  isReady = vi.fn().mockReturnValue(true);
  readyTimestamp = Date.now();
  setReady = vi.fn().mockImplementation(() => {
    this.user = { id: "test_bot_id", username: "TestBot" };
  });
}

export class Collection<K, V> extends Map<K, V> {
  // Discord.js Collection specific methods
  map<T>(fn: (value: V, key: K, collection: this) => T): T[] {
    const results: T[] = [];
    this.forEach((value, key) => {
      results.push(fn(value, key, this));
    });
    return results;
  }

  filter(fn: (value: V, key: K, collection: this) => boolean): Collection<K, V> {
    const filtered = new Collection<K, V>();
    this.forEach((value, key) => {
      if (fn(value, key, this)) {
        filtered.set(key, value);
      }
    });
    return filtered;
  }

  find(fn: (value: V, key: K, collection: this) => boolean): V | undefined {
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        return value;
      }
    }
    return undefined;
  }

  first(): V | undefined {
    return this.values().next().value;
  }

  last(): V | undefined {
    let lastValue: V | undefined = undefined;
    for (const value of this.values()) {
      lastValue = value;
    }
    return lastValue;
  }

  array(): V[] {
    return Array.from(this.values());
  }

  keyArray(): K[] {
    return Array.from(this.keys());
  }

  random(): V | undefined {
    const values = this.array();
    return values[Math.floor(Math.random() * values.length)];
  }
}

export class Message {
  public id: string = "test_message_id";
  public channelId: string = "test_channel_id";
  public author: any = { bot: false };
  public channel: any = null;

  constructor(data: any = {}) {
    Object.assign(this, data);
  }
}

export class ThreadChannel {
  public id: string = "test_thread_id";
  public name: string = "test-thread";
  public parentId: string = "test_parent_id";
  public archived: boolean = false;
  public locked: boolean = false;
  public messages: any;

  constructor(data: any = {}) {
    Object.assign(this, data);
    
    // Mock messages manager
    this.messages = {
      fetch: vi.fn().mockResolvedValue(new Collection()),
      cache: new Collection(),
    };
  }

  setArchived = vi.fn().mockImplementation((archived: boolean) => {
    this.archived = archived;
    return Promise.resolve(this);
  });

  setLocked = vi.fn().mockImplementation((locked: boolean) => {
    this.locked = locked;
    return Promise.resolve(this);
  });

  send = vi.fn().mockResolvedValue({
    id: "test_message_id",
    content: "Test message",
    author: { id: "test_user_id", username: "TestUser" },
  });

  edit = vi.fn().mockResolvedValue(this);
  delete = vi.fn().mockResolvedValue(undefined);
}

export class ForumChannel {
  public id: string = "test_forum_id";
  public name: string = "test-forum";
  public parentId: string | null = null;
  public availableTags: any[] = [];
  public threads: any;
  public parent: any;
  public type: number = ChannelType.GuildForum; // Set the default type

  constructor(data: any = {}) {
    Object.assign(this, data);
    
    // Mock threads manager
    this.threads = {
      create: vi.fn().mockResolvedValue({
        id: "test_thread_id_" + Math.random().toString(36).substr(2, 9),
        name: "Test Thread",
        parentId: this.id,
      }),
      fetch: vi.fn().mockResolvedValue(new Map()),
      cache: new Map(),
    };

    // Mock parent with webhook creation
    this.parent = {
      createWebhook: vi.fn().mockImplementation((options: any) => {
        return Promise.resolve({
          id: "test_webhook_id",
          name: options.name || "Test Webhook",
          avatar: options.avatar || null,
          channelId: this.id,
          send: vi.fn().mockResolvedValue({
            id: "test_message_id",
            content: "Test message",
            author: { username: options.name, avatar: options.avatar },
          }),
          delete: vi.fn().mockResolvedValue(undefined),
        });
      }),
    };
  }
}

export class User {
  public id: string = "test_user_id";
  public bot: boolean = false;
  public tag: string = "TestUser#0000";

  constructor(data: any = {}) {
    Object.assign(this, data);
  }
}

// Builder classes
export class EmbedBuilder {
  public title: string | undefined;
  public description: string | undefined;
  public color: number | undefined;
  public fields: any[] = [];
  public footer: any | undefined;
  public author: any | undefined;
  public url: string | undefined;
  public timestamp: string | undefined;
  public image: any | undefined;
  public thumbnail: any | undefined;

  constructor(data?: any) {
    // Reset all mocks for fresh instance
    this.resetMocks();
    
    // Initialize from data if provided
    if (data) {
      if (data.title) this.title = data.title;
      if (data.description) this.description = data.description;
      if (data.color) this.color = data.color;
      if (data.fields) this.fields = [...data.fields];
      if (data.footer) this.footer = data.footer;
      if (data.author) this.author = data.author;
      if (data.url) this.url = data.url;
      if (data.timestamp) this.timestamp = data.timestamp;
      if (data.image) this.image = data.image;
      if (data.thumbnail) this.thumbnail = data.thumbnail;
    }
  }

  private resetMocks() {
    this.setTitle = vi.fn().mockImplementation((title: string) => {
      this.title = title;
      return this;
    });
    
    this.setDescription = vi.fn().mockImplementation((description: string) => {
      this.description = description;
      return this;
    });
    
    this.setColor = vi.fn().mockImplementation((color: number | string) => {
      if (typeof color === 'string') {
        this.color = parseInt(color.replace('#', ''), 16);
      } else {
        this.color = color;
      }
      return this;
    });
    
    this.addFields = vi.fn().mockImplementation((...fields: any[]) => {
      // Handle both array spread and single array argument
      const fieldsToAdd = Array.isArray(fields[0]) && fields.length === 1 ? fields[0] : fields;
      this.fields.push(...fieldsToAdd);
      return this;
    });
    
    this.addField = vi.fn().mockImplementation((name: string, value: string, inline: boolean = false) => {
      this.fields.push({
        name: name,
        value: value,
        inline: inline,
      });
      return this;
    });
    
    this.setTimestamp = vi.fn().mockImplementation((timestamp?: Date | number | string) => {
      if (timestamp) {
        this.timestamp = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
      } else {
        this.timestamp = new Date().toISOString();
      }
      return this;
    });
    
    this.setFooter = vi.fn().mockImplementation((footer?: any) => {
      this.footer = footer;
      return this;
    });
    
    this.setAuthor = vi.fn().mockImplementation((author?: any) => {
      this.author = author;
      return this;
    });
    
    this.setImage = vi.fn().mockImplementation((image?: string | any) => {
      this.image = typeof image === 'string' ? { url: image } : image;
      return this;
    });
    
    this.setThumbnail = vi.fn().mockImplementation((thumbnail?: string | any) => {
      this.thumbnail = typeof thumbnail === 'string' ? { url: thumbnail } : thumbnail;
      return this;
    });
    
    this.setURL = vi.fn().mockImplementation((url: string) => {
      this.url = url;
      return this;
    });

    // Additional methods that might be used
    this.spliceFields = vi.fn().mockImplementation((index: number, deleteCount: number, ...fields: any[]) => {
      this.fields.splice(index, deleteCount, ...fields);
      return this;
    });

    this.setFields = vi.fn().mockImplementation((...fields: any[]) => {
      const fieldsToSet = Array.isArray(fields[0]) && fields.length === 1 ? fields[0] : fields;
      this.fields = [...fieldsToSet];
      return this;
    });
  }

  // Mock function declarations (will be overridden in resetMocks)
  setTitle!: any;
  setDescription!: any;
  setColor!: any;
  addFields!: any;
  addField!: any;
  setTimestamp!: any;
  setFooter!: any;
  setAuthor!: any;
  setImage!: any;
  setThumbnail!: any;
  setURL!: any;
  spliceFields!: any;
  setFields!: any;

  // Add data getter to match Discord.js EmbedBuilder
  get data() {
    return {
      title: this.title,
      description: this.description,
      color: this.color,
      fields: this.fields?.length > 0 ? this.fields : undefined,
      footer: this.footer,
      author: this.author,
      url: this.url,
      timestamp: this.timestamp,
      image: this.image,
      thumbnail: this.thumbnail,
    };
  }

  toJSON(): any {
    return this.data;
  }

  static from(data: any): EmbedBuilder {
    const eb = new EmbedBuilder(data);
    return eb;
  }
}

export class ActionRowBuilder {
  public components: any[] = [];
  
  constructor() {
    this.addComponents = vi.fn().mockImplementation((...components: any[]) => {
      this.components.push(...components);
      return this;
    });
    
    this.setComponents = vi.fn().mockImplementation((...components: any[]) => {
      this.components = components;
      return this;
    });
  }

  addComponents!: any;
  setComponents!: any;

  // Add data getter to match Discord.js ActionRowBuilder
  get data() {
    return {
      type: ComponentType.ActionRow,
      components: this.components.map(c => c.data || c),
    };
  }

  toJSON(): any {
    return this.data;
  }
}

export class ButtonBuilder {
  public customId: string | undefined;
  public label: string | undefined;
  public style: number | undefined;
  public emoji: any | undefined;
  public url: string | undefined;
  public disabled: boolean = false;
  
  constructor() {
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
    
    this.setURL = vi.fn().mockImplementation((url: string) => {
      this.url = url;
      return this;
    });
    
    this.setDisabled = vi.fn().mockImplementation((disabled: boolean = true) => {
      this.disabled = disabled;
      return this;
    });
  }

  setCustomId!: any;
  setLabel!: any;
  setStyle!: any;
  setEmoji!: any;
  setURL!: any;
  setDisabled!: any;

  // Add data getter to match Discord.js ButtonBuilder
  get data() {
    return {
      type: ComponentType.Button,
      custom_id: this.customId,
      label: this.label,
      style: this.style,
      emoji: this.emoji,
      url: this.url,
      disabled: this.disabled,
    };
  }

  toJSON(): any {
    return this.data;
  }
}

export class StringSelectMenuBuilder {
  public customId: string | undefined;
  public placeholder: string | undefined;
  public options: any[] = [];
  public minValues: number | undefined;
  public maxValues: number | undefined;
  public disabled: boolean = false;
  
  constructor() {
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
    
    this.setMinValues = vi.fn().mockImplementation((minValues: number) => {
      this.minValues = minValues;
      return this;
    });
    
    this.setMaxValues = vi.fn().mockImplementation((maxValues: number) => {
      this.maxValues = maxValues;
      return this;
    });
    
    this.setDisabled = vi.fn().mockImplementation((disabled: boolean = true) => {
      this.disabled = disabled;
      return this;
    });
  }

  setCustomId!: any;
  setPlaceholder!: any;
  addOptions!: any;
  setOptions!: any;
  setMinValues!: any;
  setMaxValues!: any;
  setDisabled!: any;

  // Add data getter to match Discord.js StringSelectMenuBuilder
  get data() {
    return {
      type: ComponentType.StringSelect,
      custom_id: this.customId,
      placeholder: this.placeholder,
      options: this.options.map(o => o.data || o),
      min_values: this.minValues,
      max_values: this.maxValues,
      disabled: this.disabled,
    };
  }
}

export class StringSelectMenuOptionBuilder {
  public label: string | undefined;
  public value: string | undefined;
  public description: string | undefined;
  public emoji: any | undefined;
  public default: boolean = false;
  
  constructor() {
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
  }

  setLabel!: any;
  setValue!: any;
  setDescription!: any;
  setEmoji!: any;
  setDefault!: any;

  // Add data getter to match Discord.js StringSelectMenuOptionBuilder
  get data() {
    return {
      label: this.label,
      value: this.value,
      description: this.description,
      emoji: this.emoji,
      default: this.default,
    };
  }
}

export class ModalBuilder {
  public customId: string | undefined;
  public title: string | undefined;
  public components: any[] = [];
  
  constructor() {
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
  }

  setCustomId!: any;
  setTitle!: any;
  addComponents!: any;
  setComponents!: any;

  // Add data getter to match Discord.js ModalBuilder
  get data() {
    return {
      custom_id: this.customId,
      title: this.title,
      components: this.components.map(c => c.data || c),
    };
  }

  toJSON(): any {
    return this.data;
  }
}

export class TextInputBuilder {
  public customId: string | undefined;
  public label: string | undefined;
  public style: number | undefined;
  public placeholder: string | undefined;
  public value: string | undefined;
  public required: boolean = false;
  public minLength: number | undefined;
  public maxLength: number | undefined;
  
  constructor() {
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
  }

  setCustomId!: any;
  setLabel!: any;
  setStyle!: any;
  setPlaceholder!: any;
  setValue!: any;
  setRequired!: any;
  setMinLength!: any;
  setMaxLength!: any;

  // Add data getter to match Discord.js TextInputBuilder
  get data() {
    return {
      type: ComponentType.TextInput,
      custom_id: this.customId,
      label: this.label,
      style: this.style,
      placeholder: this.placeholder,
      value: this.value,
      required: this.required,
      min_length: this.minLength,
      max_length: this.maxLength,
    };
  }

  toJSON(): any {
    return this.data;
  }
}

// Event constants
export const Events = {
  ClientReady: 'ready',
  InteractionCreate: 'interactionCreate',
  MessageCreate: 'messageCreate',
  MessageUpdate: 'messageUpdate',
  MessageDelete: 'messageDelete',
  ThreadCreate: 'threadCreate',
  ThreadUpdate: 'threadUpdate',
  ThreadDelete: 'threadDelete',
  GuildCreate: 'guildCreate',
  GuildUpdate: 'guildUpdate',
  GuildDelete: 'guildDelete',
} as const;

// Gateway intents
export const GatewayIntentBits = {
  Guilds: 1 << 0,
  GuildMembers: 1 << 1,
  GuildBans: 1 << 2,
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
} as const;

// Partials
export const Partials = {
  User: 0,
  Channel: 1,
  GuildMember: 2,
  Message: 3,
  Reaction: 4,
  GuildScheduledEvent: 5,
  ThreadMember: 6,
} as const;

// REST and Routes
export class REST {
  constructor(options: any = {}) {}
  
  setToken = vi.fn().mockReturnThis();
  put = vi.fn().mockResolvedValue([]);
  post = vi.fn().mockResolvedValue([]);
  patch = vi.fn().mockResolvedValue([]);
  delete = vi.fn().mockResolvedValue([]);
  get = vi.fn().mockResolvedValue([]);
}

export const Routes = {
  applicationCommands: (applicationId: string) => `/applications/${applicationId}/commands`,
  applicationGuildCommands: (applicationId: string, guildId: string) => 
    `/applications/${applicationId}/guilds/${guildId}/commands`,
} as const;

// Mock MessagePayload class
export class MessagePayload {
  public options: any;
  public files: any[] = [];
  public body: any = {};

  constructor(target: any, options: any) {
    this.options = options;
    this.body = {
      content: options.content || null,
      embeds: options.embeds || [],
      files: options.files || [],
      components: options.components || [],
      threadId: options.threadId || null,
    };
  }

  static create(target: any, options: any): MessagePayload {
    return new MessagePayload(target, options);
  }

  resolveBody(): any {
    return this.body;
  }

  resolveFiles(): any[] {
    return this.files;
  }

  makeRequest(): any {
    return {
      body: this.body,
      files: this.files,
    };
  }
}

// Mock Webhook class
export class Webhook {
  public id: string = "test_webhook_id";
  public name: string = "Test Webhook";
  public avatar: string | null = null;
  public channelId: string = "test_channel_id";
  public guildId: string = "test_guild_id";
  public token: string = "test_webhook_token";
  public type: number = 1;
  public applicationId: string | null = null;
  public user: any = { id: "test_user_id", username: "TestUser" };

  constructor(data: any = {}) {
    Object.assign(this, data);
  }

  send = vi.fn().mockResolvedValue({
    id: "test_message_id",
    content: "Test message",
    channelId: this.channelId,
    author: { username: this.name, avatar: this.avatar },
    createdTimestamp: Date.now(),
  });

  edit = vi.fn().mockResolvedValue({
    id: "test_message_id",
    content: "Edited message",
  });

  delete = vi.fn().mockResolvedValue(undefined);

  fetchMessage = vi.fn().mockResolvedValue({
    id: "test_message_id",
    content: "Test message",
  });

  editMessage = vi.fn().mockResolvedValue({
    id: "test_message_id",
    content: "Edited message",
  });

  deleteMessage = vi.fn().mockResolvedValue(undefined);
}

// Export all mocks as default
export default {
  ActivityType,
  ApplicationCommandType,
  ComponentType,
  ButtonStyle,
  TextInputStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  InteractionResponseType,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Client,
  Collection,
  Message,
  ThreadChannel,
  ForumChannel,
  User,
  MessagePayload,
  Webhook,
  // Mock interaction types
  ChatInputCommandInteraction: class ChatInputCommandInteraction {
    public isChatInputCommand = () => true;
    public isModalSubmit = () => false;
    public isButton = () => false;
    public isStringSelectMenu = () => false;
    public reply = vi.fn();
    public followUp = vi.fn();
    public deferReply = vi.fn();
    public editReply = vi.fn();
    public replied = false;
    public deferred = false;

    constructor(data: any = {}) {
      Object.assign(this, data);
    }
  },
  ModalSubmitInteraction: class ModalSubmitInteraction {
    public isChatInputCommand = () => false;
    public isModalSubmit = () => true;
    public isButton = () => false;
    public isStringSelectMenu = () => false;
    public reply = vi.fn();
    public followUp = vi.fn();
    public deferReply = vi.fn();
    public editReply = vi.fn();
    public replied = false;
    public deferred = false;
    public fields = {
      getTextInputValue: vi.fn().mockImplementation((customId: string) => {
        return this._fields?.[customId] || "test value";
      })
    };
    private _fields: Record<string, string> = {};

    constructor(data: any = {}) {
      Object.assign(this, data);
      if (data.fields) {
        this._fields = data.fields;
        this.fields.getTextInputValue = vi.fn().mockImplementation((customId: string) => {
          return this._fields[customId] || "test value";
        });
      }
    }
  },
  ButtonInteraction: class ButtonInteraction {
    public isChatInputCommand = () => false;
    public isModalSubmit = () => false;
    public isButton = () => true;
    public isStringSelectMenu = () => false;
    public reply = vi.fn();
    public followUp = vi.fn();
    public deferReply = vi.fn();
    public editReply = vi.fn();
    public replied = false;
    public deferred = false;

    constructor(data: any = {}) {
      Object.assign(this, data);
    }
  },
  StringSelectMenuInteraction: class StringSelectMenuInteraction {
    public isChatInputCommand = () => false;
    public isModalSubmit = () => false;
    public isButton = () => false;
    public isStringSelectMenu = () => true;
    public reply = vi.fn();
    public followUp = vi.fn();
    public deferReply = vi.fn();
    public editReply = vi.fn();
    public replied = false;
    public deferred = false;
    public values = ["test_value"];

    constructor(data: any = {}) {
      Object.assign(this, data);
    }
  }
};
