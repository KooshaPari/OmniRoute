import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { createCommandHelpEmbed } from "../embeds";

export const helpCommand = {
  data: {
    name: "help",
    description: "Show available bot commands and usage information"
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = createCommandHelpEmbed();
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
