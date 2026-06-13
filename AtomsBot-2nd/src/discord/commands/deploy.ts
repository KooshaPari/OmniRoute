import { ChatInputCommandInteraction } from 'discord.js';
import { initDevBranchPicker, openDeploymentsModal, showEnvPicker } from './deployments';

export const data = {
  name: 'deploy',
  description: 'Alias: start a deployment (Development/Staging/Production)',
  options: [
    {
      name: 'env',
      type: 3,
      description: 'Environment',
      required: false,
      choices: [
        { name: 'Development (Preview)', value: 'Development' },
        { name: 'Staging (Preview)', value: 'Staging' },
        { name: 'Production', value: 'Production' },
      ],
    },
  ],
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const envRaw = interaction.options.getString('env');
  if (!envRaw) {
    await showEnvPicker(interaction as any, 'alias');
    return;
  }
  const env = envRaw as 'Production'|'Staging'|'Development';
  if (env === 'Development') {
    const owner = process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
    const repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
    await initDevBranchPicker(interaction as any, owner, repo, { respondWith: 'reply' });
    return;
  }

  await openDeploymentsModal(interaction as any, env);
  return; // modal handles the rest
}

export const deployCommand = { data, execute };
