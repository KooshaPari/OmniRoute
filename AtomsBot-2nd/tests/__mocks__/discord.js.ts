/**
 * Vitest Mock for discord.js
 * 
 * This file is automatically loaded by Vitest when discord.js is imported
 * in any test file. It provides a complete mock implementation.
 */

import discordMocks from "../mocks/discord";

// Re-export all Discord.js mocks
export const {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  SlashCommandBuilder,
  ActivityType,
  ApplicationCommandType,
  ComponentType,
  ButtonStyle,
  TextInputStyle,
  ChannelType,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  MessageFlags,
  PermissionFlagsBits,
  InteractionResponseType,
  Collection,
  Message,
  ThreadChannel,
  ForumChannel,
  User,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
} = discordMocks;

// Make REST available as a named export
export const RESTExport = REST;

// Set as default export
export default discordMocks;