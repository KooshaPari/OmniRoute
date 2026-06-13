import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

export const githubCommand = {
  data: {
    name: 'github',
    description: 'GitHub utilities (stub)'
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: 'GitHub command placeholder', flags: MessageFlags.Ephemeral });
  },
};

export default githubCommand;

