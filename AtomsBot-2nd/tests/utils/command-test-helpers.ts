/**
 * Command Test Helpers
 * 
 * Specialized utilities for testing Discord slash commands with comprehensive
 * interaction mocking and validation.
 */

import { vi } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';

/**
 * Create a comprehensive mock interaction specifically designed for command testing
 */
export function createCommandTestInteraction(options: CommandTestInteractionOptions = {}): MockCommandInteraction {
  const mockInteraction = {
    // Basic command properties
    id: options.id || 'test_interaction_id',
    token: options.token || 'test_token',
    customId: options.customId,
    commandName: options.commandName || 'test',
    channelId: options.channelId || 'test_channel_123',
    guildId: options.guildId || 'test_guild_123',
    createdTimestamp: Date.now(),
    
    // User information - required for all commands
    user: {
      id: options.userId || 'test_user_123',
      username: options.username || 'testuser',
      discriminator: '0000',
      tag: `${options.username || 'testuser'}#0000`,
      bot: false,
      avatar: null,
      ...options.user
    },
    
    // Member information
    member: options.member || {
      id: options.userId || 'test_user_123',
      displayName: options.displayName || 'Test User',
      user: {
        id: options.userId || 'test_user_123',
        username: options.username || 'testuser'
      },
      roles: { cache: new Map() },
      permissions: { has: vi.fn().mockReturnValue(true) }
    },
    
    // Guild information - critical for command validation
    guild: options.guild === null ? null : {
      id: options.guildId || 'test_guild_123',
      name: 'Test Guild',
      channels: {
        cache: new Map(),
        fetch: vi.fn().mockResolvedValue({})
      },
      members: {
        cache: new Map(),
        fetch: vi.fn().mockImplementation(async (userId) => ({
          id: userId,
          displayName: 'Fetched User',
          user: { id: userId, username: 'fetcheduser' }
        }))
      },
      roles: {
        cache: new Map(),
        fetch: vi.fn().mockResolvedValue({})
      },
      ...options.guild
    },
    
    // Channel information with proper thread support
    channel: options.channel === null ? null : createCommandTestChannel({
      id: options.channelId || 'test_channel_123',
      name: options.channelName || 'test-thread',
      isThread: options.isThread !== false,
      ...options.channel
    }),
    
    // Interaction state tracking - essential for proper command flow testing
    replied: false,
    deferred: false,
    ephemeral: false,
    
    // Core interaction methods with realistic state management
    reply: vi.fn().mockImplementation(async function(this: any, response) {
      if (this.replied || this.deferred) {
        throw new Error('Interaction has already been replied to');
      }
      this.replied = true;
      this.ephemeral = response?.ephemeral || false;
      return {
        id: 'mock_message_id',
        content: response?.content,
        embeds: response?.embeds,
        components: response?.components,
        ephemeral: this.ephemeral
      };
    }),
    
    deferReply: vi.fn().mockImplementation(async function(this: any, options = {}) {
      if (this.replied || this.deferred) {
        throw new Error('Interaction has already been replied to');
      }
      this.deferred = true;
      this.ephemeral = options?.ephemeral || false;
      return undefined;
    }),
    
    editReply: vi.fn().mockImplementation(async function(this: any, response) {
      if (!this.replied && !this.deferred) {
        throw new Error('Interaction must be replied to or deferred first');
      }
      return {
        id: 'mock_message_id',
        content: response?.content,
        embeds: response?.embeds,
        components: response?.components,
        ephemeral: this.ephemeral
      };
    }),
    
    followUp: vi.fn().mockImplementation(async function(this: any, response) {
      if (!this.replied && !this.deferred) {
        throw new Error('Interaction must be replied to first');
      }
      return {
        id: 'mock_followup_id',
        content: response?.content,
        embeds: response?.embeds,
        components: response?.components,
        ephemeral: response?.ephemeral || false
      };
    }),
    
    deferUpdate: vi.fn().mockImplementation(async function(this: any) {
      if (this.replied || this.deferred) {
        throw new Error('Interaction has already been replied to');
      }
      this.deferred = true;
      return undefined;
    }),
    
    update: vi.fn().mockImplementation(async (response) => ({
      id: 'mock_message_id',
      ...response
    })),
    
    deleteReply: vi.fn().mockResolvedValue(undefined),
    fetchReply: vi.fn().mockResolvedValue({ 
      id: 'mock_message_id',
      content: 'Mock reply'
    }),
    
    // Comprehensive options handling for all Discord.js option types
    options: createCommandOptionsHandler(options.commandOptions || {}),
    
    // Modal and component interaction support
    fields: {
      getTextInputValue: vi.fn().mockImplementation((customId: string) => {
        return options.fieldValues?.[customId] || '';
      })
    },
    
    // Interaction type detection methods
    isChatInputCommand: vi.fn().mockReturnValue(options.type === 'command' || !options.type),
    isButton: vi.fn().mockReturnValue(options.type === 'button'),
    isStringSelectMenu: vi.fn().mockReturnValue(options.type === 'select'),
    isModalSubmit: vi.fn().mockReturnValue(options.type === 'modal'),
    isContextMenuCommand: vi.fn().mockReturnValue(options.type === 'contextMenu'),
    
    // Client reference for advanced operations
    client: {
      user: { id: 'bot_123', username: 'TestBot' },
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
    
    // Additional properties that can be overridden
    ...options.additionalProps
  };
  
  // Bind context to methods that use 'this'
  mockInteraction.reply = mockInteraction.reply.bind(mockInteraction);
  mockInteraction.deferReply = mockInteraction.deferReply.bind(mockInteraction);
  mockInteraction.editReply = mockInteraction.editReply.bind(mockInteraction);
  mockInteraction.followUp = mockInteraction.followUp.bind(mockInteraction);
  mockInteraction.deferUpdate = mockInteraction.deferUpdate.bind(mockInteraction);
  
  return mockInteraction as MockCommandInteraction;
}

/**
 * Create a mock channel with proper thread support for command testing
 */
export function createCommandTestChannel(options: CommandTestChannelOptions = {}) {
  return {
    id: options.id || 'test_channel_123',
    name: options.name || 'test-thread',
    type: options.type || (options.isThread !== false ? 11 : 0), // Thread or Text channel
    parentId: options.parentId || 'test_parent_123',
    
    // Thread-specific methods - critical for commands that check channel type
    isThread: vi.fn().mockReturnValue(options.isThread !== false),
    
    // Thread management methods
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
    
    // Permission checking
    permissionsFor: vi.fn().mockReturnValue({
      has: vi.fn().mockReturnValue(true)
    }),
    
    // Additional properties
    guild: options.guild || { id: 'test_guild_123' },
    url: `https://discord.com/channels/test_guild/test_channel/${options.id || 'test_channel_123'}`,
    ...options
  };
}

/**
 * Create comprehensive options handler for command testing
 */
function createCommandOptionsHandler(commandOptions: Record<string, any> = {}) {
  return {
    getString: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      return typeof value === 'string' ? value : null;
    }),
    
    getInteger: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      return typeof value === 'number' ? Math.floor(value) : null;
    }),
    
    getNumber: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      return typeof value === 'number' ? value : null;
    }),
    
    getBoolean: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      return typeof value === 'boolean' ? value : null;
    }),
    
    getUser: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      if (value && typeof value === 'object' && value.id) {
        return {
          id: value.id,
          username: value.username || 'optionuser',
          discriminator: '0000',
          tag: `${value.username || 'optionuser'}#0000`,
          bot: false,
          ...value
        };
      }
      return null;
    }),
    
    getChannel: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      if (value && typeof value === 'object') {
        return createCommandTestChannel(value);
      }
      return null;
    }),
    
    getRole: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      if (value && typeof value === 'object' && value.id) {
        return {
          id: value.id,
          name: value.name || 'Test Role',
          color: value.color || 0,
          ...value
        };
      }
      return null;
    }),
    
    getMember: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      if (value && typeof value === 'object' && value.id) {
        return {
          id: value.id,
          displayName: value.displayName || 'Test Member',
          user: { id: value.id, username: value.username || 'testmember' },
          ...value
        };
      }
      return null;
    }),
    
    getMentionable: vi.fn().mockImplementation((name: string) => {
      const value = commandOptions[name];
      return value && typeof value === 'object' ? value : null;
    }),
    
    getSubcommand: vi.fn().mockReturnValue(commandOptions._subcommand || null),
    getSubcommandGroup: vi.fn().mockReturnValue(commandOptions._subcommandGroup || null),
    
    get: vi.fn().mockImplementation((name: string) => commandOptions[name] || null)
  };
}

/**
 * Test a command with comprehensive setup and validation
 */
export async function testCommand(
  command: any,
  options: CommandTestOptions = {}
): Promise<CommandTestResult> {
  const mockInteraction = createCommandTestInteraction(options.interaction || {});
  
  // Setup store with test data
  if (options.storeSetup) {
    await options.storeSetup();
  }
  
  // Execute the command
  let error: Error | null = null;
  let result: any = null;
  
  try {
    result = await command.execute(mockInteraction);
  } catch (e) {
    error = e as Error;
  }
  
  return {
    interaction: mockInteraction,
    result,
    error,
    // Helper methods for common assertions
    wasReplied: () => mockInteraction.replied || mockInteraction.deferred,
    getReplyContent: () => {
      const call = mockInteraction.reply.mock?.calls?.[0]?.[0] || 
                   mockInteraction.editReply.mock?.calls?.[0]?.[0];
      return call?.content || null;
    },
    getReplyEmbeds: () => {
      const call = mockInteraction.reply.mock?.calls?.[0]?.[0] || 
                   mockInteraction.editReply.mock?.calls?.[0]?.[0];
      return call?.embeds || [];
    },
    wasEphemeral: () => mockInteraction.ephemeral
  };
}

// Type definitions
export interface CommandTestInteractionOptions {
  id?: string;
  token?: string;
  customId?: string;
  commandName?: string;
  channelId?: string;
  guildId?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  channelName?: string;
  isThread?: boolean;
  type?: 'command' | 'button' | 'select' | 'modal' | 'contextMenu';
  user?: any;
  member?: any;
  guild?: any | null;
  channel?: any | null;
  commandOptions?: Record<string, any>;
  fieldValues?: Record<string, string>;
  additionalProps?: any;
}

export interface CommandTestChannelOptions {
  id?: string;
  name?: string;
  type?: number;
  parentId?: string;
  isThread?: boolean;
  guild?: any;
  [key: string]: any;
}

export interface CommandTestOptions {
  interaction?: CommandTestInteractionOptions;
  storeSetup?: () => Promise<void> | void;
}

export interface CommandTestResult {
  interaction: MockCommandInteraction;
  result: any;
  error: Error | null;
  wasReplied: () => boolean;
  getReplyContent: () => string | null;
  getReplyEmbeds: () => any[];
  wasEphemeral: () => boolean;
}

export interface MockCommandInteraction extends Partial<ChatInputCommandInteraction> {
  replied: boolean;
  deferred: boolean;
  ephemeral: boolean;
  reply: any;
  deferReply: any;
  editReply: any;
  followUp: any;
  deferUpdate: any;
  update: any;
  deleteReply: any;
  fetchReply: any;
  options: any;
  fields: any;
  [key: string]: any;
}

// Export utility functions
export const CommandTestHelpers = {
  createCommandTestInteraction,
  createCommandTestChannel,
  testCommand
};

export default CommandTestHelpers;