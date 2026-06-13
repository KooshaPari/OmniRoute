import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

export const jiraCommand = {
  data: {
    name: 'jira',
    description: 'Jira utilities (stub)'
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: 'Jira command placeholder', flags: MessageFlags.Ephemeral });
  },
};

export default jiraCommand;

