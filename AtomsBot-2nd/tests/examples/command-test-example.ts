/**
 * Example: How to Use Enhanced Command Test Infrastructure
 * 
 * This example demonstrates proper usage of the enhanced test infrastructure
 * for testing Discord commands with comprehensive interaction mocking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCommandTestInteraction, testCommand } from '../utils/command-test-helpers';
import { store } from '../../src/store';

// Example test for the help command
describe('Enhanced Command Testing Example', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('demonstrates basic command interaction testing', async () => {
    // Create a comprehensive mock interaction
    const mockInteraction = createCommandTestInteraction({
      commandName: 'help',
      userId: 'test_user_123',
      username: 'testuser',
      guildId: 'test_guild_123',
      channelId: 'test_channel_123'
    });

    // Mock command execution
    const mockCommand = {
      data: { name: 'help', description: 'Test help command' },
      execute: vi.fn().mockImplementation(async (interaction) => {
        await interaction.reply({
          content: 'Help message',
          ephemeral: true
        });
      })
    };

    // Execute the command
    await mockCommand.execute(mockInteraction);

    // Validate the interaction behavior
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Help message',
      ephemeral: true
    });
    expect(mockInteraction.replied).toBe(true);
    expect(mockInteraction.ephemeral).toBe(true);
  });

  it('demonstrates thread-based command testing', async () => {
    // Setup store with test data
    const testThread = {
      id: 'test_thread_123',
      title: 'Test Issue',
      number: 42,
      appliedTags: ['bug'],
      archived: false,
      locked: false,
      comments: []
    };
    store.threads.push(testThread);

    // Create interaction in a thread channel
    const mockInteraction = createCommandTestInteraction({
      commandName: 'issue',
      channelId: 'test_thread_123',
      isThread: true,
      commandOptions: {
        number: 42
      }
    });

    // Mock a thread-dependent command
    const mockIssueCommand = {
      data: { name: 'issue', description: 'Show issue info' },
      execute: vi.fn().mockImplementation(async (interaction) => {
        // Commands often check guild existence
        if (!interaction.guild) {
          await interaction.reply({
            content: '❌ This command can only be used in a server.',
            ephemeral: true
          });
          return;
        }

        // Commands often defer for async operations
        await interaction.deferReply();

        // Find thread data
        const issueNumber = interaction.options.getInteger('number');
        const thread = store.threads.find(t => t.number === issueNumber);

        if (!thread) {
          await interaction.editReply({
            content: '❌ Thread not found'
          });
          return;
        }

        await interaction.editReply({
          content: `Found issue #${thread.number}: ${thread.title}`
        });
      })
    };

    // Execute and validate
    await mockIssueCommand.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'Found issue #42: Test Issue'
    });
    expect(mockInteraction.deferred).toBe(true);
  });

  it('demonstrates error handling testing', async () => {
    // Test DM usage (no guild)
    const dmInteraction = createCommandTestInteraction({
      guild: null // DM context
    });

    const mockCommand = {
      execute: vi.fn().mockImplementation(async (interaction) => {
        if (!interaction.guild) {
          await interaction.reply({
            content: '❌ This command can only be used in a server.',
            ephemeral: true
          });
          return;
        }
      })
    };

    await mockCommand.execute(dmInteraction);

    expect(dmInteraction.reply).toHaveBeenCalledWith({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
  });

  it('demonstrates the testCommand utility function', async () => {
    const mockCommand = {
      data: { name: 'test' },
      execute: vi.fn().mockImplementation(async (interaction) => {
        await interaction.reply({ content: 'Success!' });
        return 'command_result';
      })
    };

    // Use the testCommand utility for comprehensive testing
    const result = await testCommand(mockCommand, {
      interaction: {
        commandName: 'test',
        userId: 'test_user'
      },
      storeSetup: async () => {
        // Setup any store state needed for the test
        store.threads = [];
      }
    });

    // Use helper methods for assertions
    expect(result.wasReplied()).toBe(true);
    expect(result.getReplyContent()).toBe('Success!');
    expect(result.error).toBeNull();
    expect(result.result).toBe('command_result');
  });

  it('demonstrates interaction state validation', async () => {
    const mockInteraction = createCommandTestInteraction();

    // Test proper state tracking
    expect(mockInteraction.replied).toBe(false);
    expect(mockInteraction.deferred).toBe(false);

    await mockInteraction.reply({ content: 'Test' });
    expect(mockInteraction.replied).toBe(true);

    // Test that double reply throws error
    await expect(mockInteraction.reply({ content: 'Test2' }))
      .rejects.toThrow('Interaction has already been replied to');
  });

  it('demonstrates option handling', async () => {
    const mockInteraction = createCommandTestInteraction({
      commandOptions: {
        'text-option': 'hello world',
        'number-option': 42,
        'boolean-option': true,
        'user-option': {
          id: 'user_123',
          username: 'targetuser'
        }
      }
    });

    // Test option retrieval
    expect(mockInteraction.options.getString('text-option')).toBe('hello world');
    expect(mockInteraction.options.getInteger('number-option')).toBe(42);
    expect(mockInteraction.options.getBoolean('boolean-option')).toBe(true);
    
    const user = mockInteraction.options.getUser('user-option');
    expect(user.id).toBe('user_123');
    expect(user.username).toBe('targetuser');
    
    // Test null returns for missing options
    expect(mockInteraction.options.getString('missing')).toBe(null);
  });
});