/**
 * Test Utilities and Helpers
 * 
 * Common utilities for testing Discord bot functionality including
 * interaction builders, assertion helpers, and test data factories.
 */

import { vi } from "vitest";
import type { MockedFunction } from "vitest";

// Discord Interaction Builders
class InteractionBuilder {
  private interaction: any = {
    id: "test_interaction_id",
    applicationId: "test_app_id",
    type: 2, // CHAT_INPUT
    data: {},
    guildId: "test_guild_id",
    channelId: "test_channel_id",
    user: {
      id: "test_user_id",
      username: "testuser",
      discriminator: "0000",
      avatar: null,
      bot: false,
    },
    member: {
      user: {
        id: "test_user_id",
        username: "testuser",
        discriminator: "0000",
        avatar: null,
        bot: false,
      },
      nick: null,
      avatar: null,
      roles: [],
      joinedAt: new Date().toISOString(),
      premiumSince: null,
      permissions: "0",
    },
    token: "test_interaction_token",
    version: 1,
    replied: false,
    deferred: false,
    ephemeral: false,
    guild: {
      id: "test_guild_id",
      name: "Test Guild",
      ownerId: "test_owner_id",
      memberCount: 10,
    },
    channel: {
      id: "test_channel_id",
      name: "test-channel",
      type: 0, // GUILD_TEXT
      send: vi.fn().mockResolvedValue({}),
    },
    // Mock methods
    isChatInputCommand: vi.fn().mockReturnValue(true),
    isButton: vi.fn().mockReturnValue(false),
    isStringSelectMenu: vi.fn().mockReturnValue(false),
    isModalSubmit: vi.fn().mockReturnValue(false),
    isContextMenuCommand: vi.fn().mockReturnValue(false),
    reply: vi.fn().mockResolvedValue({}),
    followUp: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    deferReply: vi.fn().mockResolvedValue({}),
    deferUpdate: vi.fn().mockResolvedValue({}),
    editReply: vi.fn().mockResolvedValue({}),
    deleteReply: vi.fn().mockResolvedValue({}),
    fetchReply: vi.fn().mockResolvedValue({}),
    showModal: vi.fn().mockResolvedValue({}),
    webhook: {
      send: vi.fn().mockResolvedValue({}),
      editMessage: vi.fn().mockResolvedValue({}),
      deleteMessage: vi.fn().mockResolvedValue({}),
    },
    options: {
      getString: vi.fn().mockReturnValue(null),
      getInteger: vi.fn().mockReturnValue(null),
      getBoolean: vi.fn().mockReturnValue(null),
      getUser: vi.fn().mockReturnValue(null),
      getMember: vi.fn().mockReturnValue(null),
      getRole: vi.fn().mockReturnValue(null),
      getChannel: vi.fn().mockReturnValue(null),
      getMentionable: vi.fn().mockReturnValue(null),
      getNumber: vi.fn().mockReturnValue(null),
      getSubcommand: vi.fn().mockReturnValue(null),
      getSubcommandGroup: vi.fn().mockReturnValue(null),
      get: vi.fn().mockReturnValue(null),
    },
  };

  chatInput(): this {
    this.interaction.type = 2;
    this.interaction.isChatInputCommand = vi.fn().mockReturnValue(true);
    this.interaction.isButton = vi.fn().mockReturnValue(false);
    this.interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    this.interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    return this;
  }

  button(customId?: string): this {
    this.interaction.type = 3;
    this.interaction.customId = customId || "test_button";
    this.interaction.isChatInputCommand = vi.fn().mockReturnValue(false);
    this.interaction.isButton = vi.fn().mockReturnValue(true);
    this.interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    this.interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    return this;
  }

  selectMenu(customId?: string, values?: string[]): this {
    this.interaction.type = 3;
    this.interaction.customId = customId || "test_select";
    this.interaction.values = values || ["test_value"];
    this.interaction.isChatInputCommand = vi.fn().mockReturnValue(false);
    this.interaction.isButton = vi.fn().mockReturnValue(false);
    this.interaction.isStringSelectMenu = vi.fn().mockReturnValue(true);
    this.interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    return this;
  }

  modal(customId?: string, fields?: Array<{ customId: string; value: string }>): this {
    this.interaction.type = 5;
    this.interaction.customId = customId || "test_modal";
    
    // Create proper fields mock with getTextInputValue method
    const fieldsMap = fields ? new Map(fields.map(f => [f.customId, { value: f.value }])) : new Map();
    this.interaction.fields = {
      getTextInputValue: vi.fn().mockImplementation((customId: string) => {
        const field = fieldsMap.get(customId);
        return field ? field.value : "";
      }),
      // Add additional methods that might be needed
      has: vi.fn().mockImplementation((customId: string) => fieldsMap.has(customId)),
      get: vi.fn().mockImplementation((customId: string) => fieldsMap.get(customId)),
      size: fieldsMap.size,
      [Symbol.iterator]: () => fieldsMap.entries()
    };
    
    this.interaction.isChatInputCommand = vi.fn().mockReturnValue(false);
    this.interaction.isButton = vi.fn().mockReturnValue(false);
    this.interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    this.interaction.isModalSubmit = vi.fn().mockReturnValue(true);
    return this;
  }

  withUser(userId: string, username?: string): this {
    this.interaction.user.id = userId;
    this.interaction.member.user.id = userId;
    if (username) {
      this.interaction.user.username = username;
      this.interaction.member.user.username = username;
    }
    return this;
  }

  withGuild(guildId: string, guildName?: string): this {
    this.interaction.guildId = guildId;
    this.interaction.guild.id = guildId;
    if (guildName) {
      this.interaction.guild.name = guildName;
    }
    return this;
  }

  withChannel(channelId: string, channelName?: string): this {
    this.interaction.channelId = channelId;
    this.interaction.channel.id = channelId;
    if (channelName) {
      this.interaction.channel.name = channelName;
    }
    return this;
  }

  withCommandData(commandName: string, options?: Array<{ name: string; value: any }>): this {
    this.interaction.data.name = commandName;
    this.interaction.data.options = options?.map(opt => ({
      name: opt.name,
      value: opt.value,
      type: typeof opt.value === "string" ? 3 : typeof opt.value === "number" ? 4 : 5,
    })) || [];
    
    // Update options methods
    this.interaction.options.getString = vi.fn().mockImplementation((name: string) => {
      const option = options?.find(opt => opt.name === name && typeof opt.value === "string");
      return option?.value || null;
    });
    
    this.interaction.options.getInteger = vi.fn().mockImplementation((name: string) => {
      const option = options?.find(opt => opt.name === name && typeof opt.value === "number");
      return option?.value || null;
    });
    
    this.interaction.options.getBoolean = vi.fn().mockImplementation((name: string) => {
      const option = options?.find(opt => opt.name === name && typeof opt.value === "boolean");
      return option?.value || null;
    });
    
    return this;
  }

  withModalFields(fields: Array<{ customId: string; value: string }>): this {
    const fieldsMap = new Map(fields.map(f => [f.customId, { value: f.value }]));
    this.interaction.fields = {
      getTextInputValue: vi.fn().mockImplementation((customId: string) => {
        const field = fieldsMap.get(customId);
        return field ? field.value : "";
      }),
      has: vi.fn().mockImplementation((customId: string) => fieldsMap.has(customId)),
      get: vi.fn().mockImplementation((customId: string) => fieldsMap.get(customId)),
      size: fieldsMap.size,
      [Symbol.iterator]: () => fieldsMap.entries()
    };
    return this;
  }

  build(): any {
    return this.interaction;
  }
}

// GitHub Request Builder
class GitHubRequestBuilder {
  private request: any = {
    body: {
      action: "opened",
      issue: {
        id: 123456,
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
    },
    headers: {
      "x-github-event": "issues",
      "x-github-delivery": "test-delivery-id",
    },
  };

  action(action: string): this {
    this.request.body.action = action;
    return this;
  }

  issue(issueData: Partial<any>): this {
    this.request.body.issue = { ...this.request.body.issue, ...issueData };
    return this;
  }

  repository(repoData: Partial<any>): this {
    this.request.body.repository = { ...this.request.body.repository, ...repoData };
    return this;
  }

  sender(senderData: Partial<any>): this {
    this.request.body.sender = { ...this.request.body.sender, ...senderData };
    return this;
  }

  event(eventType: string): this {
    this.request.headers["x-github-event"] = eventType;
    return this;
  }

  build(): any {
    return this.request;
  }
}

// Error Testing Utilities
class ErrorTester {
  static async expectThrows<T>(
    fn: () => Promise<T>,
    expectedError?: string | RegExp | ((error: Error) => boolean)
  ): Promise<Error> {
    try {
      await fn();
      throw new Error("Expected function to throw an error, but it didn't");
    } catch (error) {
      if (error instanceof Error) {
        if (typeof expectedError === "string") {
          if (!error.message.includes(expectedError)) {
            throw new Error(`Expected error message to include "${expectedError}", but got "${error.message}"`);
          }
        } else if (expectedError instanceof RegExp) {
          if (!expectedError.test(error.message)) {
            throw new Error(`Expected error message to match ${expectedError}, but got "${error.message}"`);
          }
        } else if (typeof expectedError === "function") {
          if (!expectedError(error)) {
            throw new Error(`Error did not pass custom validation: ${error.message}`);
          }
        }
        return error;
      }
      throw error;
    }
  }

  static expectThrowsSync<T>(
    fn: () => T,
    expectedError?: string | RegExp | ((error: Error) => boolean)
  ): Error {
    try {
      fn();
      throw new Error("Expected function to throw an error, but it didn't");
    } catch (error) {
      if (error instanceof Error) {
        if (typeof expectedError === "string") {
          if (!error.message.includes(expectedError)) {
            throw new Error(`Expected error message to include "${expectedError}", but got "${error.message}"`);
          }
        } else if (expectedError instanceof RegExp) {
          if (!expectedError.test(error.message)) {
            throw new Error(`Expected error message to match ${expectedError}, but got "${error.message}"`);
          }
        } else if (typeof expectedError === "function") {
          if (!expectedError(error)) {
            throw new Error(`Error did not pass custom validation: ${error.message}`);
          }
        }
        return error;
      }
      throw error;
    }
  }
}

// Async Testing Utilities
class AsyncTestUtils {
  static async waitFor(
    condition: () => boolean,
    timeout: number = 1000,
    interval: number = 10
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return;
      }
      await this.sleep(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async waitForExpect(
    expectation: () => void,
    timeout: number = 1000,
    interval: number = 10
  ): Promise<void> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    while (Date.now() - startTime < timeout) {
      try {
        expectation();
        return;
      } catch (error) {
        lastError = error as Error;
        await this.sleep(interval);
      }
    }
    
    throw lastError || new Error(`Expectation not met within ${timeout}ms`);
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async flushPromises(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }

  static runInSequence<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    return tasks.reduce(async (acc, task) => {
      const results = await acc;
      const result = await task();
      return [...results, result];
    }, Promise.resolve([] as T[]));
  }
}

// Mock Function Utilities
class MockUtils {
  static createMockFunction<T extends (...args: any[]) => any>(): MockedFunction<T> {
    return vi.fn() as MockedFunction<T>;
  }

  static createAsyncMockFunction<T>(resolveValue?: T): MockedFunction<() => Promise<T>> {
    return vi.fn().mockResolvedValue(resolveValue);
  }

  static createRejectedMockFunction<T>(error: Error | string): MockedFunction<() => Promise<T>> {
    const errorToThrow = typeof error === "string" ? new Error(error) : error;
    return vi.fn().mockRejectedValue(errorToThrow);
  }

  static mockImplementationOnce<T extends (...args: any[]) => any>(
    fn: MockedFunction<T>,
    implementation: T
  ): MockedFunction<T> {
    return fn.mockImplementationOnce(implementation);
  }

  static mockReturnValueOnce<T extends (...args: any[]) => any>(
    fn: MockedFunction<T>,
    value: ReturnType<T>
  ): MockedFunction<T> {
    return fn.mockReturnValueOnce(value);
  }

  static mockResolvedValueOnce<T>(
    fn: MockedFunction<() => Promise<T>>,
    value: T
  ): MockedFunction<() => Promise<T>> {
    return fn.mockResolvedValueOnce(value);
  }

  static mockRejectedValueOnce<T>(
    fn: MockedFunction<() => Promise<T>>,
    error: Error | string
  ): MockedFunction<() => Promise<T>> {
    const errorToThrow = typeof error === "string" ? new Error(error) : error;
    return fn.mockRejectedValueOnce(errorToThrow);
  }
}

// Test Data Factories
class TestDataFactory {
  static createDiscordEmbed(overrides: any = {}) {
    return {
      title: "Test Embed",
      description: "Test embed description",
      color: 0x00ff00,
      timestamp: new Date().toISOString(),
      footer: { text: "Test Footer" },
      fields: [],
      ...overrides,
    };
  }

  static createDiscordButton(overrides: any = {}) {
    return {
      type: 2, // BUTTON
      style: 1, // PRIMARY
      custom_id: "test_button",
      label: "Test Button",
      disabled: false,
      ...overrides,
    };
  }

  static createDiscordActionRow(components: any[] = []) {
    return {
      type: 1, // ACTION_ROW
      components: components.length > 0 ? components : [TestDataFactory.createDiscordButton()],
    };
  }

  static createDiscordModal(overrides: any = {}) {
    return {
      custom_id: "test_modal",
      title: "Test Modal",
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 4, // TEXT_INPUT
              custom_id: "test_input",
              label: "Test Input",
              style: 1, // SHORT
              required: true,
            },
          ],
        },
      ],
      ...overrides,
    };
  }
}

// Coverage Helpers
class CoverageHelpers {
  static async testAllBranches<T>(
    testCases: Array<{
      name: string;
      setup?: () => void | Promise<void>;
      execute: () => T | Promise<T>;
      verify: (result: T) => void | Promise<void>;
      cleanup?: () => void | Promise<void>;
    }>
  ): Promise<void> {
    for (const testCase of testCases) {
      try {
        if (testCase.setup) {
          await testCase.setup();
        }
        
        const result = await testCase.execute();
        await testCase.verify(result);
        
        if (testCase.cleanup) {
          await testCase.cleanup();
        }
      } catch (error) {
        throw new Error(`Test case "${testCase.name}" failed: ${error}`);
      }
    }
  }

  static async testErrorPaths<T>(
    errorCases: Array<{
      name: string;
      setup?: () => void | Promise<void>;
      execute: () => T | Promise<T>;
      expectedError: string | RegExp | ((error: Error) => boolean);
      cleanup?: () => void | Promise<void>;
    }>
  ): Promise<void> {
    for (const errorCase of errorCases) {
      try {
        if (errorCase.setup) {
          await errorCase.setup();
        }
        
        await ErrorTester.expectThrows(
          async () => await errorCase.execute(),
          errorCase.expectedError
        );
        
        if (errorCase.cleanup) {
          await errorCase.cleanup();
        }
      } catch (error) {
        throw new Error(`Error test case "${errorCase.name}" failed: ${error}`);
      }
    }
  }
}

// Export all utilities
export {
  InteractionBuilder,
  GitHubRequestBuilder,
  ErrorTester,
  AsyncTestUtils,
  MockUtils,
  TestDataFactory,
  CoverageHelpers,
};