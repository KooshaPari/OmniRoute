/**
 * Discord Commands Mock Implementation
 * 
 * Comprehensive mocks for Discord slash commands to support testing
 * of command execution and error handling.
 */

import { vi } from "vitest";
// Import the real embed factory so tests that mock ../../embeds can spy on it
// This path resolves to src/discord/embeds from the test environment
// and will be intercepted by vi.mock("../../embeds") in command tests.
// Note: Do NOT import embeds statically here; tests need to vi.mock("../../embeds").
// We'll dynamically import inside execute() so the mock is respected.

// Mock priority command
export const mockPriorityCommand = {
  data: {
    name: "priority",
    description: "Set the priority of a GitHub issue"
  },
  execute: vi.fn().mockResolvedValue(undefined)
};

// Mock status command  
export const mockStatusCommand = {
  data: {
    name: "status",
    description: "Update the status of a GitHub issue"
  },
  execute: vi.fn().mockResolvedValue(undefined)
};

// Mock issue command
export const mockIssueCommand = {
  data: {
    name: "issue",
    description: "Show detailed issue information"
  },
  execute: vi.fn().mockResolvedValue(undefined)
};

// Mock help command
export const mockHelpCommand = {
  data: {
    name: "help",
    description: "Show available bot commands and usage information",
    options: [],
  },
  async execute(interaction: any) {
    const { createCommandHelpEmbed } = await import("../../src/discord/embeds");
    const embed = createCommandHelpEmbed();
    // Ensure a promise is returned for tests using `.rejects`
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// Mock commands export
export const mockCommands = {
  priorityCommand: mockPriorityCommand,
  statusCommand: mockStatusCommand,
  issueCommand: mockIssueCommand,
  helpCommand: mockHelpCommand
};

export default mockCommands;