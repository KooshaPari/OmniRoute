/**
 * Custom Vitest Matchers for Discord Bot Testing
 * 
 * This file extends Vitest's expect functionality with custom matchers
 * specifically designed for testing Discord.js interactions and bot functionality.
 */

import { expect } from "vitest";
import type { MatcherResult } from "@vitest/expect";

interface CustomMatchers<R = unknown> {
  toHaveBeenCalledWithInteraction(interaction: any): R;
  toHaveRepliedWith(content: string | { embeds?: any[]; components?: any[] }): R;
  toHaveFollowedUpWith(content: string | { embeds?: any[]; components?: any[] }): R;
  toHaveDeferred(): R;
  toHaveUpdated(): R;
  toBeValidDiscordEmbed(): R;
  toBeValidDiscordComponent(): R;
  toHaveValidDiscordTimestamp(): R;
  toMatchJiraIssueStructure(): R;
  toMatchGitHubIssueStructure(): R;
  toHaveLoggedWithLevel(level: string, message?: string): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// Custom matcher for Discord interaction calls
expect.extend({
  toHaveBeenCalledWithInteraction(received: any, interaction: any): MatcherResult {
    const pass = received.mock.calls.some((call: any[]) => {
      const firstArg = call[0];
      return firstArg && firstArg.customId === interaction.customId;
    });

    return {
      pass,
      message: () =>
        pass
          ? `Expected function not to have been called with interaction ${interaction.customId}`
          : `Expected function to have been called with interaction ${interaction.customId}`,
    };
  },

  toHaveRepliedWith(received: any, content: string | object): MatcherResult {
    if (!received.reply || !received.reply.mock) {
      return {
        pass: false,
        message: () => "Expected interaction to have a mocked reply method",
      };
    }

    const calls = received.reply.mock.calls;
    const pass = calls.some((call: any[]) => {
      const firstArg = call[0];
      if (typeof content === "string") {
        return firstArg === content || firstArg.content === content;
      }
      // For object content, check if it matches structure
      return JSON.stringify(firstArg) === JSON.stringify(content);
    });

    return {
      pass,
      message: () =>
        pass
          ? `Expected interaction not to have replied with ${JSON.stringify(content)}`
          : `Expected interaction to have replied with ${JSON.stringify(content)}. Actual calls: ${JSON.stringify(calls)}`,
    };
  },

  toHaveFollowedUpWith(received: any, content: string | object): MatcherResult {
    if (!received.followUp || !received.followUp.mock) {
      return {
        pass: false,
        message: () => "Expected interaction to have a mocked followUp method",
      };
    }

    const calls = received.followUp.mock.calls;
    const pass = calls.some((call: any[]) => {
      const firstArg = call[0];
      if (typeof content === "string") {
        return firstArg === content || firstArg.content === content;
      }
      return JSON.stringify(firstArg) === JSON.stringify(content);
    });

    return {
      pass,
      message: () =>
        pass
          ? `Expected interaction not to have followed up with ${JSON.stringify(content)}`
          : `Expected interaction to have followed up with ${JSON.stringify(content)}`,
    };
  },

  toHaveDeferred(received: any): MatcherResult {
    const pass = received.deferReply && received.deferReply.mock.calls.length > 0;

    return {
      pass,
      message: () =>
        pass
          ? "Expected interaction not to have been deferred"
          : "Expected interaction to have been deferred",
    };
  },

  toHaveUpdated(received: any): MatcherResult {
    const pass = received.update && received.update.mock.calls.length > 0;

    return {
      pass,
      message: () =>
        pass
          ? "Expected interaction not to have been updated"
          : "Expected interaction to have been updated",
    };
  },

  toBeValidDiscordEmbed(received: any): MatcherResult {
    const isValidEmbed = (embed: any) => {
      return (
        embed &&
        (embed.title || embed.description || embed.fields) &&
        (!embed.color || typeof embed.color === "number") &&
        (!embed.timestamp || typeof embed.timestamp === "string" || embed.timestamp instanceof Date) &&
        (!embed.fields || Array.isArray(embed.fields))
      );
    };

    const pass = isValidEmbed(received);

    return {
      pass,
      message: () =>
        pass
          ? "Expected object not to be a valid Discord embed"
          : `Expected object to be a valid Discord embed. Received: ${JSON.stringify(received)}`,
    };
  },

  toBeValidDiscordComponent(received: any): MatcherResult {
    const isValidComponent = (component: any) => {
      return (
        component &&
        typeof component.type === "number" &&
        component.type >= 1 && component.type <= 5 &&
        (component.custom_id || component.customId || component.type === 1) // Action rows don't need custom_id
      );
    };

    const pass = isValidComponent(received);

    return {
      pass,
      message: () =>
        pass
          ? "Expected object not to be a valid Discord component"
          : `Expected object to be a valid Discord component. Received: ${JSON.stringify(received)}`,
    };
  },

  toHaveValidDiscordTimestamp(received: any): MatcherResult {
    // Discord timestamps should be Unix timestamps (seconds) or ISO strings
    const isValidTimestamp = (timestamp: any) => {
      if (!timestamp) return false;
      
      // Check if it's a Unix timestamp (number)
      if (typeof timestamp === "number") {
        return timestamp > 946684800 && timestamp < 4102444800; // Between 2000 and 2100
      }
      
      // Check if it's a valid ISO string
      if (typeof timestamp === "string") {
        const date = new Date(timestamp);
        return !isNaN(date.getTime());
      }
      
      return false;
    };

    const pass = isValidTimestamp(received);

    return {
      pass,
      message: () =>
        pass
          ? "Expected timestamp not to be a valid Discord timestamp"
          : `Expected timestamp to be a valid Discord timestamp. Received: ${received}`,
    };
  },

  toMatchJiraIssueStructure(received: any): MatcherResult {
    const hasRequiredFields = (issue: any) => {
      return (
        issue &&
        typeof issue.id === "string" &&
        typeof issue.key === "string" &&
        typeof issue.summary === "string" &&
        issue.status &&
        typeof issue.status.name === "string" &&
        issue.priority &&
        typeof issue.priority.name === "string" &&
        issue.issueType &&
        typeof issue.issueType.name === "string"
      );
    };

    const pass = hasRequiredFields(received);

    return {
      pass,
      message: () =>
        pass
          ? "Expected object not to match Jira issue structure"
          : `Expected object to match Jira issue structure. Received: ${JSON.stringify(received)}`,
    };
  },

  toMatchGitHubIssueStructure(received: any): MatcherResult {
    const hasRequiredFields = (issue: any) => {
      return (
        issue &&
        typeof issue.number === "number" &&
        typeof issue.title === "string" &&
        typeof issue.html_url === "string" &&
        typeof issue.state === "string" &&
        (issue.state === "open" || issue.state === "closed") &&
        typeof issue.locked === "boolean" &&
        issue.user &&
        typeof issue.user.login === "string"
      );
    };

    const pass = hasRequiredFields(received);

    return {
      pass,
      message: () =>
        pass
          ? "Expected object not to match GitHub issue structure"
          : `Expected object to match GitHub issue structure. Received: ${JSON.stringify(received)}`,
    };
  },

  toHaveLoggedWithLevel(received: any, level: string, message?: string): MatcherResult {
    if (!received[level] || !received[level].mock) {
      return {
        pass: false,
        message: () => `Expected logger to have a mocked ${level} method`,
      };
    }

    const calls = received[level].mock.calls;
    if (calls.length === 0) {
      return {
        pass: false,
        message: () => `Expected logger.${level} to have been called`,
      };
    }

    if (message) {
      const pass = calls.some((call: any[]) => 
        call.some((arg: any) => 
          typeof arg === "string" && arg.includes(message)
        )
      );

      return {
        pass,
        message: () =>
          pass
            ? `Expected logger.${level} not to have been called with message containing "${message}"`
            : `Expected logger.${level} to have been called with message containing "${message}". Actual calls: ${JSON.stringify(calls)}`,
      };
    }

    return {
      pass: true,
      message: () => `Logger.${level} was called as expected`,
    };
  },
});

// Export types for TypeScript support
export type { CustomMatchers };