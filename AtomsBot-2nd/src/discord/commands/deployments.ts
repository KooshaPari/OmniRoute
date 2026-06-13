import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ForumChannel,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { settingsService } from '../../settings/SettingsService';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../../logger';
import { DeployOrchestrator } from '../../deploy/Orchestrator';
import { LocalCloneRepoProvider } from '../../deploy/providers/LocalCloneRepoProvider';
import { LocalPathRepoProvider } from '../../deploy/providers/LocalPathRepoProvider';
import { VercelCliProvider } from '../../deploy/providers/VercelCliProvider';
import { VercelApiProvider } from '../../deploy/providers/VercelApiProvider';
import { secretsStore } from '../../settings/SecretsStore';

const pexec = promisify(execFile);

// Default local repo paths used by the deployments flow.
// - App (single project) default points to the deploy subdirectory
// - Group default points to the repo root
// NOTE: corrected to use 'clean/deploy/atoms.tech' for app, and 'clean/deploy' for group
const DEFAULT_REPO_PATH_APP = '/Users/kooshapari/temp-PRODVERCEL/485/clean/deploy/atoms.tech';
const DEFAULT_REPO_PATH_GROUP = '/Users/kooshapari/temp-PRODVERCEL/485/clean/deploy';

export const data = {
  name: 'deployments',
  description: 'Deployment posts and forum configuration',
  options: [
    {
      name: 'set-forum',
      type: 1,
      description: 'Map the deployments forum to a Discord forum channel',
      options: [
        {
          name: 'channel',
          type: 7,
          description: 'Deployments forum channel',
          channel_types: [15],
          required: true
        }
      ]
    },
    {
      name: 'pr',
      type: 1,
      description: 'Create a Pull Request (branch → branch) via interactive picker'
    },
    {
      name: 'sync',
      type: 1,
      description: 'Fast-forward merge without deploy (e.g., main → production)',
      options: [
        {
          name: 'target',
          type: 3,
          description: 'Target branch to sync to (optional)',
          choices: [ { name: 'production', value: 'production' } ]
        }
      ]
    }
  ]
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(false);
  const guildId = interaction.guildId!;

  if (!sub) {
    const help = [
      'Deployments Help',
      '',
      '• /deployments pr — Interactive PR creation:',
      '  - Pick FROM/TO branches (search, paginate), then fill modal (auto-filled from commits).',
      '  - Optionally enable Auto-FF merge to complete when checks pass.',
      '• /deployments sync [target:production] — Fast-forward without deploy:',
      '  - With target=production → FF main → production after checks are green.',
      '  - Without target → pick an open PR to auto-merge when clean.',
      '',
      'Note: Use /deploy to start actual Vercel deploys.'
    ].join('\n');
    return interaction.reply({ content: help, flags: MessageFlags.Ephemeral });
  }

  if (sub === 'set-forum') {
    const ch = interaction.options.getChannel('channel', true);
    await settingsService.setForumChannelId(guildId, 'deployments', ch.id);
    return interaction.reply({ content: `✅ Mapped deployments forum to <#${ch.id}>`, flags: MessageFlags.Ephemeral });
  }

  if (sub === 'pr') {
    await startPrFlow(interaction as any);
    return;
  }
  if (sub === 'sync') {
    await startSyncFlow(interaction as any);
    return;
  }

  return interaction.reply({ content: '❌ Unknown deployments subcommand', flags: MessageFlags.Ephemeral });
}

function formatDateMMDDYY(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yy = (d.getFullYear() % 100).toString().padStart(2, '0');
  return `${m}/${day}/${yy}`;
}

async function git(cmd: string[], cwd: string): Promise<string> {
  const { stdout } = await pexec('git', cmd, { cwd });
  return stdout.trim();
}

function toFirstName(fullName: string): string {
  const s = (fullName || '').trim();
  if (!s) return 'Unknown';
  return s.split(/\s+/)[0];
}

export async function handleDeploymentsModalSubmit(interaction: any) {
  try {
    const customId: string = interaction.customId || '';
    const parts = customId.split('_');
    // deployments_modal_<Env>_<UserId>
    const env = (parts[2] || 'Production') as 'Production'|'Staging'|'Development';

    // removed unused placeholders: lastCommitRaw, vercelLink
    const groupName = (interaction.fields.getTextInputValue('group') || '').trim();
    const inputRepoPath = (interaction.fields.getTextInputValue('repo_path') || '').trim();
    // Default repo path behavior:
    // - If a Vercel group is provided, default to the standard repo root
    // - Otherwise, default to the app's deploy subdirectory
    const defaultPath = groupName ? DEFAULT_REPO_PATH_GROUP : DEFAULT_REPO_PATH_APP;
    const repoPath = (inputRepoPath || defaultPath).trim();
    const branch = (interaction.fields.getTextInputValue('branch') || 'production').trim();
    const notes = (interaction.fields.getTextInputValue('notes') || '').trim();

    const guildId = interaction.guildId!;
    const channelId = await settingsService.getForumChannelId(guildId, 'deployments');
    if (!channelId) {
      return interaction.editReply({ content: '❌ No deployments forum mapped. Use `/deployments set-forum` or `/setup forums set forum_id:deployments` first.' });
    }

    // Resolve forum channel
    const forum = await interaction.client.channels.fetch(channelId) as ForumChannel;
    if (!forum || forum.type !== ChannelType.GuildForum) {
      return interaction.editReply({ content: '❌ Mapped channel is not a forum. Please remap.' });
    }

    // Progress logging helpers (ephemeral + console)
    const progress: string[] = [];
    const pushProgress = async (line: string) => {
      const ts = new Date().toLocaleTimeString();
      const entry = `${ts} • ${line}`;
      progress.push(entry);
      try { await interaction.editReply({ content: `Deploy progress:\n${progress.join('\n')}` }); } catch {}
      try { logger.info(`[deployments] ${line}`); } catch {}
    };
    await pushProgress(`Starting ${env} deploy on branch '${branch}' at repo '${repoPath}'`);
    await pushProgress(`Using deployments forum <#${forum.id}>`);

    // Build provisional thread name (refined after pull) with env emoji prefix
    const envEmoji = env === 'Production' ? '🚀' : env === 'Staging' ? '🟡' : '🧪';
    const title = `${envEmoji} ${env} … ${formatDateMMDDYY(new Date())}`;

    // Initial embed
    const statusLine = '🟡 Status: Preparing';
    const descParts: string[] = [];
    const envLabel = env === 'Production' ? 'Production' : `${env} (Preview)`;
    descParts.push(`Environment: ${envLabel}`);
    if (branch) descParts.push(`Branch: ${branch}`);
    // Clarify that all envs deploy into the same Vercel project (preview vs prod flag differs)
    const targetNote = env === 'Production' ? 'Target project: production' : 'Target project: production (preview)';
    descParts.push(targetNote);
    const baseDesc = descParts.join('\n');
    const embed = new EmbedBuilder()
      .setTitle(`${envEmoji} Deployment: ${env}`)
      .setDescription([baseDesc, '', statusLine].filter(Boolean).join('\n'))
      .setColor(0xf59e0b)
      .setTimestamp(new Date());

    // Create forum thread with initial message
    // Applied tags: forums may require at least one tag. Try to match env or generic deployment tags.
    const appliedTags = pickDeploymentTagIds(forum, env);

    const thread = await forum.threads.create({
      name: title,
      message: { embeds: [embed] },
      appliedTags,
    });
    await pushProgress(`Thread created: ${thread.name}`);

    const threadMessages = await thread.messages.fetch({ limit: 1 });
    const firstMessage = threadMessages.first();

    // Helper to safely edit the primary message embed
    const setStatus = async (status: string, extraDesc?: string) => {
      const updated = EmbedBuilder.from(embed)
        .setDescription([
          baseDesc,
          extraDesc ? `\n${extraDesc}` : undefined,
          '',
          status,
        ].filter(Boolean).join('\n'))
        .setColor(status.includes('🟢') ? 0x22c55e : status.includes('🔴') ? 0xef4444 : 0xf59e0b)
        .setTimestamp(new Date());
      if (firstMessage) await firstMessage.edit({ embeds: [updated] });
      else await thread.send({ embeds: [updated] });
    };

    const appendLog = async (title: string, chunk: string) => {
      if (!chunk?.trim()) return;
      const MAX = 1800;
      const text = chunk.length > MAX ? chunk.slice(-MAX) : chunk;
      await thread.send({ content: `**${title}**\n\n\`\`\`\n${text}\n\`\`\`` });
    };

    await setStatus('🟡 Status: Preparing');

    // 1) Sync branch (checkout/fetch/pull)
    const { spawn } = await import('node:child_process');
    const { access } = await import('node:fs/promises');
    const { constants } = await import('node:fs');
    const streamCmd = (cmd: string, args: string[], name: string) => new Promise<void>((resolve, reject) => {
      // Verbose: log exact command + cwd
      // Note: also appended into the thread log block
      void pushProgress(`Exec: ${cmd} ${args.join(' ')} (cwd: ${repoPath})`);
      const child = spawn(cmd, args, { cwd: repoPath });
      let buffer = '';
      const flush = async () => { if (buffer) { await appendLog(name, buffer); buffer = ''; } };
      child.stdout.on('data', async (d: Buffer) => { buffer += d.toString(); if (buffer.length > 1200) await flush(); });
      child.stderr.on('data', async (d: Buffer) => { buffer += d.toString(); if (buffer.length > 1200) await flush(); });
      child.on('error', async (e: any) => {
        const msg = `Spawn error for ${name}: ${e?.code || ''} ${e?.message || e}`.trim();
        await appendLog(name, msg);
        await pushProgress(msg);
        reject(e);
      });
      child.on('close', async (code: number|null, signal: NodeJS.Signals|null) => {
        await flush();
        if (code === 0) return resolve();
        const msg = `${name} exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`;
        await pushProgress(msg);
        reject(new Error(msg));
      });
    });

    try {
      // Validate repo path up-front with verbose diagnostics
      try {
        await access(repoPath, constants.R_OK | constants.W_OK);
        await pushProgress(`Repo path OK (read/write): ${repoPath}`);
      } catch (e: any) {
        await setStatus('🔴 Status: Repo path invalid');
        const emsg = `Repo path not accessible: ${repoPath} (${e?.code || ''} ${e?.message || e})`;
        await pushProgress(emsg);
        throw new Error(emsg);
      }

      // Guard: Block if local repo has staged/unstaged/unpushed changes
      try {
        // Gather branch/upstream info
        const branchName = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath).catch(() => '')) || branch;
        const upstream = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repoPath).catch(() => '');
        const statusShort = await git(['status', '-sb'], repoPath).catch(() => '');
        const porcelain = await git(['status', '--porcelain=v1'], repoPath).catch(() => '');
        let unpushedCount = 0;
        if (upstream) {
          const out = await git(['rev-list', '--count', '@{u}..HEAD'], repoPath).catch(() => '0');
          unpushedCount = Math.max(0, parseInt(out || '0', 10) || 0);
        }
        // Classify changes from porcelain output (XY status)
        let staged = 0, unstaged = 0, untracked = 0;
        if (porcelain) {
          for (const line of porcelain.split('\n')) {
            const x = line[0] || ' ';
            const y = line[1] || ' ';
            if (line.startsWith('??')) { untracked++; continue; }
            if (x !== ' ') staged++;
            if (y !== ' ') unstaged++;
          }
        }
        const hasIssues = (staged + unstaged + untracked) > 0 || unpushedCount > 0;
        if (hasIssues) {
          const summary: string[] = [];
          summary.push(`Branch: ${branchName}${upstream ? ` (upstream: ${upstream})` : ''}`);
          if (unpushedCount > 0) summary.push(`Unpushed commits: ${unpushedCount}`);
          if (staged > 0) summary.push(`Staged changes: ${staged}`);
          if (unstaged > 0) summary.push(`Unstaged changes: ${unstaged}`);
          if (untracked > 0) summary.push(`Untracked files: ${untracked}`);

          const details = [
            'This deployment uses your local working directory. To avoid deploying unintended changes, please do one of the following and then re-run the command:',
            '',
            '- Stash local changes: `git stash -u`',
            '- Or commit and push: `git add -A && git commit -m "wip"` then `git push`',
            '',
            summary.join('\n'),
          ].join('\n') + (statusShort ? `\n\n\`\`\`\n${statusShort}\n\`\`\`` : '');
          const warn = new EmbedBuilder()
            .setTitle('Local repository has pending changes')
            .setDescription(details)
            .setColor(0xef4444)
            .setTimestamp(new Date());

          try {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
            // Persist minimal resume context
            try {
              await secretsStore.set(`deploy_resume_ctx_${thread.id}`,
                JSON.stringify({ env, repoPath, branch, groupName, userId: interaction.user.id }));
            } catch {}
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`deployresume_auto_${thread.id}_${interaction.user.id}`).setLabel('Resume Now').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`deployresume_${thread.id}_${interaction.user.id}`).setLabel('Resume (Edit)').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`deployenv_cancel_${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
            );
            await thread.send({ embeds: [warn], components: [row as any] });
          } catch {}
          await setStatus('🔴 Status: Blocked by local changes', 'Please stash or push, then click Resume.');
          return; // Abort flow until user resolves local repo state
        }
      } catch (e) {
        // Non-fatal: if git checks fail, proceed (subsequent steps may surface errors)
        await pushProgress(`Warning: failed to verify local git state (${(e as any)?.message || e})`);
      }
      // Ensure correct branch
      const currentBranch = await git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath).catch(() => '');
      if (currentBranch && currentBranch !== branch) {
        await pushProgress(`Checking out '${branch}' from '${currentBranch}'`);
        await streamCmd('git', ['checkout', branch], 'git checkout');
      }
      await setStatus('🟡 Status: Syncing branch…');
      await pushProgress('Fetching origin');
      await streamCmd('git', ['fetch', 'origin', branch], 'git fetch');
      await pushProgress('Pulling latest changes');
      await streamCmd('git', ['pull', 'origin', branch], 'git pull');
    } catch (e: any) {
      await setStatus('🔴 Status: Failed during git sync');
      // Include detailed diagnostics about PATH and git version to help troubleshoot
      try {
        const pathInfo = process.env.PATH || '';
        await appendLog('env', `PATH=${pathInfo}`);
      } catch {}
      try {
        // Attempt to capture 'git --version' and 'git remote -v' output for context
        await streamCmd('git', ['--version'], 'git --version');
      } catch {}
      try {
        await streamCmd('git', ['remote', '-v'], 'git remote -v');
      } catch {}
      await pushProgress(`Git sync failed: ${(e?.message || e)}`);
      throw e;
    }

    // 2) Determine HEAD and last commit (auto-detect if blank)
    let headShort = '';
    try {
      await git(['rev-parse', 'HEAD'], repoPath);
      headShort = await git(['rev-parse', '--short', 'HEAD'], repoPath);
      // Update thread name to final form
      try { await thread.setName(`${env} ${headShort} ${formatDateMMDDYY(new Date())}`); } catch {}
      await pushProgress(`HEAD now at ${headShort}`);
    } catch {}

    // Auto-detect last commit: prefer Vercel CLI (env-aware), then forum history, then marker file
    let lastCommit = await getLastVercelCommit(repoPath, env, branch).catch(() => '');
    if (!lastCommit) lastCommit = await autoDetectLastCommitFromForum(interaction.client, guildId, channelId, env, repoPath).catch(() => '');
    if (!lastCommit) {
      const { readFile } = await import('node:fs/promises');
      try {
        const envKey = env.toLowerCase() === 'production' ? 'prod' : env.toLowerCase() === 'staging' ? 'staging' : `dev_${branch.replace(/[^a-z0-9._-]+/gi,'_')}`;
        const marker = await readFile(`${repoPath}/.deployments/last_${envKey}`,'utf8');
        lastCommit = marker.trim();
      } catch {}
    }
    await pushProgress(`Last deployed commit: ${lastCommit || '(unknown)'}`);

    // 3) Compute commits last..HEAD
    let commitLines: string[] = [];
    try {
      if (!lastCommit) throw new Error('No last commit');
      const range = `${lastCommit}..HEAD`;
      const logOut = await git(['log', '--pretty=format:%h|%an|%s', range], repoPath);
      commitLines = logOut
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [h, author, subject] = line.split('|');
          const who = toFirstName(author || '');
          return `${who}: ${subject || h}`;
        });
      // If nothing changed since last deploy and we're on a non-main/prod branch,
      // compute against main..HEAD as a fallback comparison for visibility.
      if (commitLines.length === 0) {
        const b = (branch || '').toLowerCase();
        if (b !== 'main' && b !== 'production') {
          try {
            await pushProgress(`No commits since last deploy; comparing against main..HEAD`);
            const logOut2 = await git(['log', '--pretty=format:%h|%an|%s', 'main..HEAD'], repoPath);
            commitLines = logOut2
              .split('\n')
              .filter(Boolean)
              .map(line => {
                const [h, author, subject] = line.split('|');
                const who = toFirstName(author || '');
                return `${who}: ${subject || h}`;
              });
          } catch {}
        }
      }
    } catch {
      // Fallback to main..HEAD when last deploy is unknown
      try {
        const logOut2 = await git(['log', '--pretty=format:%h|%an|%s', 'main..HEAD'], repoPath);
        commitLines = logOut2
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const [h, author, subject] = line.split('|');
            const who = toFirstName(author || '');
            return `${who}: ${subject || h}`;
          });
      } catch {
        // Fall back to no changes or single HEAD line
        if (headShort) commitLines = [`${headShort}: updated`]; else commitLines = [];
      }
    }

    const changesBlock = commitLines.length ? commitLines.map(l => `• ${l}`).join('\n') : '• No changes';
    // Optional: Check for FF sync (main ahead of production); prompt user before proceeding
    try {
      const token = (await (await import('../../settings/SecretsStore')).secretsStore.get('github_access_token')) || process.env.GITHUB_ACCESS_TOKEN || '';
      if (token) {
        const { Octokit } = await import('@octokit/rest');
        const octo = new Octokit({ auth: token });
        const owner = process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
        const repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
        if (owner && repo && env === 'Production') {
          const base = 'production';
          const head = 'main';
          const cmp = await octo.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${base}...${head}` });
          const aheadBy = (cmp.data as any).ahead_by || 0;
          const behindBy = (cmp.data as any).behind_by || 0;
          if (aheadBy > 0 && behindBy === 0) {
            // Create a pending deployment run for button handler to continue
            const runId = await (await import('../../database/DatabaseService')).databaseService.createDeploymentRun({
              guildId: interaction.guildId as string,
              forumThreadId: thread.id,
              env,
              provider: 'vercel',
              repoOwner: owner,
              repoName: repo,
              branch,
              baseBranch: base,
              headBranch: head,
              status: 'awaiting_sync',
            });
            const commitsArr = (cmp.data.commits || []).map((c: any) => `• ${c.sha?.slice(0,7)} ${c.commit?.message?.split('\n')[0]} — ${c.commit?.author?.name}`);
            try { await (await import('../../settings/SecretsStore')).secretsStore.set(`deploy_commits_${runId}`, JSON.stringify(commitsArr)); } catch {}
            const commits = commitsArr.slice(0, 10).join('\n');
            const row = new (await import('discord.js')).ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`deploysync_ff_${runId}_${interaction.user.id}`).setLabel('Fast-Forward & Deploy').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`deploysync_skip_${runId}_${interaction.user.id}`).setLabel('Skip Sync & Deploy').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`deploysync_view_${runId}_${interaction.user.id}`).setLabel('View More Commits').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`deploysync_cancel_${runId}_${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
            );
            await interaction.followUp({
              content: `⚠️ main is ahead of production by ${aheadBy} commit(s).\nTop commits:\n${commits}\n\nProceed?`,
              components: [row],
              flags: MessageFlags.Ephemeral,
            });
            // Exit early; button handler will continue deploy
            return;
          }
        }
      }
    } catch (e) { try { logger.warn?.(`FF prompt check failed: ${(e as any)?.message || e}`); } catch {} }
    await pushProgress(`Computed ${commitLines.length} commit(s) since last deploy`);
    const introNotes = notes ? `\nNotes (from ${interaction.user.username}):\n> ${notes.replace(/\n/g, '\n> ')}` : '';
    await setStatus('🟠 Status: Deploying', ['Changes:', changesBlock, introNotes].filter(Boolean).join('\n'));

    // 4) Orchestrated deploy (CLI primary, API fallback; supports group of projects)
    let detectedUrl = '';
    try {
      await appendLog('deploy', 'Starting orchestrated deploy (CLI/API with group support)');
      // Resolve vercel project/team via repo mapping first, fallback to globals
      const owner = process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
      const repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
      let mapProject: string | undefined = undefined;
      let mapTeam: string | undefined = undefined;
      let mapProjectName: string | undefined = undefined;
      let mapPrefer: 'api'|'cli'|undefined = undefined;
      try {
        const rawEnv = await secretsStore.get(`vercel_map_${owner}_${repo}_${env}`);
        const rawGen = await secretsStore.get(`vercel_map_${owner}_${repo}`);
        const raw = rawEnv || rawGen || '';
        if (raw) { const obj = JSON.parse(raw); mapProject = obj?.projectId || undefined; mapTeam = obj?.teamId || undefined; mapProjectName = obj?.projectName || obj?.projectSlug || undefined; mapPrefer = (obj?.prefer === 'api' || obj?.prefer === 'cli') ? obj.prefer : undefined; }
      } catch {}
      // Resolve projects: prefer group (explicit), then repo→group mapping, else single mapped project/global default
      let groupProjectIds: string[] | undefined;
      let groupTeamId: string | undefined;
      let groupLabels: Record<string,string> | undefined;
      let groupPaths: Record<string,string[]> | undefined;
      let groupProviders: Record<string,'api'|'cli'> | undefined;
      const ownerRepoKey = `${owner}_${repo}`;
      try {
        if (groupName) {
          const raw = await secretsStore.get(`vercel_group_${groupName}`);
          if (raw) { const o = JSON.parse(raw); groupProjectIds = o?.projectIds || undefined; groupTeamId = o?.teamId || undefined; groupLabels = o?.labels || undefined; groupPaths = o?.paths || undefined; groupProviders = o?.providers || undefined; }
        } else {
          const mappedGroup = await secretsStore.get(`vercel_groupmap_${ownerRepoKey}`);
          if (mappedGroup) {
            const raw = await secretsStore.get(`vercel_group_${mappedGroup}`);
            if (raw) { const o = JSON.parse(raw); groupProjectIds = o?.projectIds || undefined; groupTeamId = o?.teamId || undefined; groupLabels = o?.labels || undefined; groupPaths = o?.paths || undefined; groupProviders = o?.providers || undefined; }
          }
        }
      } catch {}

      // Derive monorepo subdir relative to repo root when user provided a concrete path
      const deriveSubdir = (absPath: string): string => {
        try {
          const parts = absPath.split('/').filter(Boolean);
          const idx = parts.lastIndexOf('deploy');
          if (idx >= 0) return parts.slice(idx).join('/');
        } catch {}
        return '';
      };
      const appSubdir = deriveSubdir(repoPath) || '';

      // Resolve orgId (team_*) for the selected project when possible (improves CLI linking)
      let resolvedOrgId: string | undefined;
      try {
        const token = await secretsStore.get('vercel_token');
        const proj = mapProject || (await secretsStore.get('vercel_project_id')) || undefined;
        const teamHint = (groupTeamId || mapTeam || (await secretsStore.get('vercel_team_id')) || undefined) as any;
        if (token && proj && /^prj_/i.test(proj)) {
          const qs = teamHint ? `?teamId=${encodeURIComponent(String(teamHint))}` : '';
          const authHeader = `Bearer ${String(token || '')}`;
          const rs = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(String(proj))}${qs}`, { headers: { Authorization: authHeader } as any });
          if (rs.ok) {
            const body: any = await rs.json();
            const accountId = body?.accountId || body?.teamId || body?.orgId;
            if (typeof accountId === 'string' && /^team_/i.test(accountId)) resolvedOrgId = accountId;
          }
        }
      } catch {}

      // Resolve preferred project id/name
      const secretProjectIdRaw = await secretsStore.get('vercel_project_id').catch(() => '');
      const secretProjectName = (await secretsStore.get('vercel_project_name').catch(() => '')) || (await secretsStore.get('vercel_project_slug').catch(() => '')) || '';
      const resolvedProjectId = (typeof mapProject === 'string' && /^prj_/i.test(mapProject)) ? mapProject : (/^prj_/i.test(secretProjectIdRaw) ? secretProjectIdRaw : undefined);
      const resolvedProjectName = mapProjectName || (resolvedProjectId ? undefined : (mapProject || secretProjectName || repo));

      const ctx = {
        guildId: interaction.guildId as string,
        env,
        repo: { owner, name: repo, branch, baseBranch: 'production', headBranch: 'main' },
        forumThreadId: thread.id,
        vercel: {
          projectId: resolvedProjectId,
          teamId: (groupTeamId || mapTeam || (await secretsStore.get('vercel_team_id')) || undefined) as any,
          orgId: resolvedOrgId,
          projectName: resolvedProjectName,
          autoUnprotect: ((await secretsStore.get('vercel_auto_unprotect').catch(()=>'')) === 'true'),
          unprotectMode: ((await secretsStore.get('vercel_unprotect_mode').catch(()=>'')) || 'link'),
        },
        appSubdir: appSubdir || undefined,
        userId: interaction.user.id,
      };
      const logs = {
        info: async (line: string) => { try { await appendLog('deploy', line); } catch {}; try { logger.info(`[deploy] ${line}`); } catch {} },
        error: async (line: string) => { try { await appendLog('deploy', line); } catch {}; try { logger.error(`[deploy] ${line}`); } catch {} },
        status: async (line: string) => { try { await thread.send({ content: `Status: ${line}` }); } catch {} },
      };
      // Choose repo provider: prefer local path when user provided an absolute path,
      // otherwise fall back to cloning remote.
      const useLocalPath = repoPath.startsWith('/')
      const repoProvider = useLocalPath ? new LocalPathRepoProvider(appSubdir ? repoPath : repoPath) : new LocalCloneRepoProvider(3);
      if (useLocalPath) {
        // When using local path, we already point at the app root; don't append subdir during deploy
        (ctx as any).appSubdir = undefined;
        await logs.info('Using LocalPathRepoProvider');
      } else {
        await logs.info('Using LocalCloneRepoProvider');
      }
      // Expose Vercel token to CLI if present
      try {
        const tok = await secretsStore.get('vercel_token');
        if (tok) (process.env as any).VERCEL_TOKEN = tok;
      } catch {}
      const apiProvider = new VercelApiProvider(
        async () => await secretsStore.get('vercel_token'),
        async () => await secretsStore.get('vercel_team_id'),
        async () => resolvedProjectId,
        async () => resolvedProjectName,
      );
      const cliProvider = new VercelCliProvider(true);
      const preferApiGlobal = (await secretsStore.get('vercel_prefer_api')) === 'true';
      let preferApi = preferApiGlobal;
      if (mapPrefer === 'api') preferApi = true; else if (mapPrefer === 'cli') preferApi = false;
      // Repo-specific default: atoms-tech/atoms.tech → prefer CLI unless overridden
      if (!mapPrefer && owner === 'atoms-tech' && repo === 'atoms.tech') preferApi = false;

      const tStart = Date.now();

      // Preflight: ensure required project env vars exist in Vercel before deploying
      try {
        const requiredCsv = (await secretsStore.get('vercel_required_env').catch(()=>'')) || 'NPM_TOKEN';
        const required = requiredCsv.split(',').map(s => s.trim()).filter(Boolean);
        if (required.length) {
          const token = await secretsStore.get('vercel_token');
          const teamId = (ctx as any).vercel.teamId as string | undefined;
          const projectNameForApi = (ctx as any).vercel.projectId ? undefined : ((ctx as any).vercel.projectName || repo);
          let projectIdForApi = (ctx as any).vercel.projectId as string | undefined;
          if (!token) throw new Error('Missing vercel_token');
          // Resolve project id if only name available
          if (!projectIdForApi && projectNameForApi) {
            const qs0 = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
            const rs0 = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectNameForApi)}${qs0}`, { headers: { Authorization: `Bearer ${token}` } });
            if (rs0.ok) { const pj: any = await rs0.json(); projectIdForApi = pj?.id || undefined; }
          }
          // Fetch env vars list
          let envKeys: string[] = [];
          if (projectIdForApi) {
            const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}&decrypt=false` : '?decrypt=false';
            const rs = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectIdForApi)}/env${qs}`, { headers: { Authorization: `Bearer ${token}` } });
            if (rs.ok) {
              const body: any = await rs.json();
              const list: any[] = Array.isArray(body?.envs) ? body.envs : Array.isArray(body) ? body : [];
              envKeys = list.map((e: any) => e?.key).filter((k: any) => typeof k === 'string');
            }
          }
          const missing = required.filter(k => !envKeys.includes(k));
          if (missing.length) {
            await logs.error(`Preflight: missing Vercel project env vars: ${missing.join(', ')}`);
            throw new Error(`Missing Vercel env: ${missing.join(', ')}`);
          }
        }
      } catch (e) {
        await setStatus('🔴 Status: Preflight failed');
        await pushProgress(`Preflight checks failed: ${(e as any)?.message || e}`);
        throw e;
      }

      const projects: string[] = (groupProjectIds && groupProjectIds.length)
        ? groupProjectIds
        : [ (ctx as any).vercel.projectId || (ctx as any).vercel.projectName || repo ].filter((x: any) => !!x);
      if (!projects.length) {
        // As a hard fallback, use repo name to allow CLI to proceed (API will rely on projectName)
        projects.push(repo || 'default');
        await logs.info('No explicit Vercel project configured; falling back to repo name for single-project deploy.');
      }

      // Concurrency controls
      const concEnabled = (await secretsStore.get('vercel_group_concurrent')) === 'true';
      const concLimit = Math.max(1, Number(await secretsStore.get('vercel_group_concurrency')) || (concEnabled ? 2 : 1));

      const commitCount = commitLines.length;
      const perProjectCommitCounts: Record<string, number> = {};
      if (groupPaths && lastCommit) {
        // Compute per-project counts using git path filtering
        for (const pid of (groupProjectIds || [])) {
          const paths = groupPaths[pid];
          if (Array.isArray(paths) && paths.length) {
            try {
              const range = `${lastCommit}..HEAD`;
              const out = await git(['log', '--pretty=format:%h', range, '--', ...paths], repoPath).catch(() => '');
              const n = out ? out.split('\n').filter(Boolean).length : 0;
              perProjectCommitCounts[pid] = n;
            } catch {}
          }
        }
      }
      const results: Array<{ projectId: string; url?: string; status: string; error?: string; durationSec?: number }> = [];
      const deployOne = async (projectId: string) => {
        const tag = projects.length > 1 ? ` [${projectId}]` : '';
        await logs.status(`Deploying${tag}…`);
        const ctxForProject = { ...(ctx as any), vercel: { ...(ctx as any).vercel, ...(projectId && /^prj_/i.test(projectId) ? { projectId } : { projectName: projectId }) } } as any;
        const t0 = Date.now();
        let result;
        const preferApiThis = groupProviders?.[projectId] === 'api' ? true : groupProviders?.[projectId] === 'cli' ? false : preferApi;
        if (preferApiThis) {
          result = await new DeployOrchestrator(repoProvider, apiProvider).run(ctxForProject, logs);
          if (result.status !== 'ready') {
            await logs.info(`API deploy failed${tag}; attempting CLI`);
            result = await new DeployOrchestrator(repoProvider, cliProvider).run(ctxForProject, logs);
          }
        } else {
          result = await new DeployOrchestrator(repoProvider, cliProvider).run(ctxForProject, logs);
          if (result.status !== 'ready') {
            await logs.info(`CLI deploy failed${tag}; attempting Vercel API`);
            result = await new DeployOrchestrator(repoProvider, apiProvider).run(ctxForProject, logs);
          }
        }
        const durationSec = Math.max(1, Math.round((Date.now() - t0) / 1000));
        const row = { projectId, url: result.url, status: result.status, error: result.error, durationSec } as any;
        results.push(row);
        if (result.status !== 'ready') {
          await logs.error(`Deploy failed for project ${projectId}: ${result.error || 'unknown'}`);
        } else {
          await logs.status(`Up${tag}: ${result.url || '(no url)'}`);
        }
      };

      if (concLimit > 1 && projects.length > 1) {
        // simple async pool
        const queue = projects.slice();
        const workers = Array.from({ length: Math.min(concLimit, projects.length) }, async () => {
          while (queue.length) {
            const next = queue.shift();
            if (!next) break;
            await deployOne(next);
          }
        });
        await Promise.all(workers);
      } else {
        for (const p of projects) await deployOne(p);
      }

      // Use the last successful URL as primary
      const lastOk = results.slice().reverse().find(r => r.status === 'ready');
      if (!lastOk) throw new Error(results.find(r => r.error)?.error || 'Deploy failed for all projects');
      detectedUrl = lastOk.url || '';

      // Stats: run duration and success rate across runs
      const runDurationSec = Math.max(1, Math.round((Date.now() - tStart) / 1000));
      const ok = results.filter(r => r.status === 'ready').length;
      const keyStats = `deploy_stats_${owner}_${repo}_${groupName || ((ctx as any).vercel.projectId || 'default')}`;
      let totals = { runs: 0, projects: 0, ok: 0, dur: 0 };
      try { const raw = await secretsStore.get(keyStats); if (raw) totals = { ...totals, ...JSON.parse(raw) }; } catch {}
      totals.runs += 1; totals.projects += projects.length; totals.ok += ok; totals.dur += runDurationSec;
      try { await secretsStore.set(keyStats, JSON.stringify(totals)); } catch {}
      const pct = totals.projects > 0 ? Math.round(100 * (totals.ok / totals.projects)) : 100;
      const fmtAllTime = (s: number) => s >= 3600 ? `${(s/3600).toFixed(1)}h` : s >= 60 ? `${Math.round(s/60)}m` : `${s}s`;

      // Smart summary embed with per-project status, durations, commit count
      let labelsMap: Record<string,string> = groupLabels || {};
      try {
        // Try to import persisted labels from prior messages in this thread
        const recent = await thread.messages.fetch({ limit: 20 }).catch(() => null);
        const marker = recent?.find((m: any) => typeof m?.content === 'string' && m.content.startsWith('atomsbot:vercel_labels '));
        if (marker) { const j = marker.content.replace('atomsbot:vercel_labels ', '').trim(); try { const obj = JSON.parse(j); labelsMap = Object.assign({}, labelsMap, obj); } catch {} }
      } catch {}
      try {
        const { SmartEmbedBuilder } = await import('../framework/SmartEmbedBuilder');
        const statsLine = `⏱ Run: ${runDurationSec}s • 📈 Success: ${ok}/${projects.length} • ⏲️ All-time: ${fmtAllTime(totals.dur)} • ✅ ${pct}%`;
        const recentSummaryRaw = await secretsStore.get(`deploy_summary_${thread.id}`).catch(() => '');
        const recentSummary = (() => { try { return recentSummaryRaw ? JSON.parse(recentSummaryRaw) : null; } catch { return null; } })();
        const detectedUrl = ((recentSummary?.results||[]).find((x:any)=>x?.url)?.url) || '';
        const smart = new SmartEmbedBuilder({ id: `deploy-${thread.id}`, title: `🚀 Deployment: ${env}` , description: [detectedUrl ? `Link: ${detectedUrl}` : undefined, statsLine].filter(Boolean).join('\n'), color: 0x22c55e });
        for (const r of results) {
          const name = labelsMap?.[r.projectId] || r.projectId;
          const base = r.status === 'ready' ? (r.url || '(no url)') : `failed: ${r.error || 'unknown'}`;
          const cnt = perProjectCommitCounts[r.projectId] ?? commitCount;
          const extras = `\n⏱ ${r.durationSec || 0}s • 🔁 ${cnt} commit${cnt===1?'':'s'}`;
          const value = `${base}${extras}`;
          smart.addDynamicField({ name, value, inline: false, dynamic: false });
        }
        const linkButtons = results.filter(r => r.status === 'ready' && r.url).slice(0,5);
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (const r of linkButtons) {
          const name = labelsMap?.[r.projectId] || r.projectId;
          row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Open ${name}`).setURL(r.url!));
        }
        row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`deploynotes_add_${thread.id}`).setLabel('Add Notes'));
        if (results.some(r => r.status !== 'ready')) {
          row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`deployretry_${thread.id}_${interaction.user.id}`).setLabel('Retry Failed Projects'));
          const concEnabled = (await secretsStore.get('vercel_group_concurrent')) === 'true';
          if (concEnabled) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`deployretry_cancel_${thread.id}_${interaction.user.id}`).setLabel('Cancel Remaining'));
        }
        row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`deployviewcommits_${thread.id}_${interaction.user.id}`).setLabel('View Commits'));
        if (firstMessage) await firstMessage.edit({ embeds: (smart as any).embeds, components: [row] }); else await thread.send({ embeds: (smart as any).embeds, components: [row] });

        // Persist summary + labels for retry/history
        try {
          const perProjectCommits: Record<string,string[]> = {};
          if (groupPaths && lastCommit) {
            for (const pid of (groupProjectIds || [])) {
              const paths = groupPaths[pid];
              if (Array.isArray(paths) && paths.length) {
                try {
                  const range = `${lastCommit}..HEAD`;
                  const out = await git(['log', '--pretty=format:%h %s', range, '--', ...paths], repoPath).catch(() => '');
                  const list = out ? out.split('\n').filter(Boolean).map(l => `• ${l}`) : [];
                  perProjectCommits[pid] = list.slice(0, 50);
                } catch {}
              }
            }
          }
          const summary = { ctx: { owner, repo, branch, env, teamId: (ctx as any).vercel.teamId, groupName, preferApi, paths: groupPaths || {}, providers: groupProviders || {}, repoPath, useLocal: useLocalPath }, results, commitCount, perProjectCommitCounts, perProjectCommits, runDurationSec, firstMessageId: firstMessage?.id || null, labelsMap, lastCommit };
          await secretsStore.set(`deploy_summary_${thread.id}`, JSON.stringify(summary));
        } catch {}
        try { await thread.send({ content: `atomsbot:vercel_labels ${JSON.stringify(labelsMap || {})}` }); } catch {}
      } catch {
        // Fallback summary text
        if (projects.length > 1) {
          const lines = results.map(r => `• ${(labelsMap?.[r.projectId] || r.projectId)}: ${r.status === 'ready' ? (r.url || '(no url)') : `failed: ${r.error || 'unknown'}`}${` (⏱ ${r.durationSec || 0}s • 🔁 ${commitCount})`}`);
          await thread.send({ content: `Deployment summary:\n${lines.join('\n')}` });
        }
      }
    } catch (e) {
      await setStatus('🔴 Status: Deploy failed');
      await pushProgress(`Deploy failed: ${(e as any)?.message || e}`);
      throw e;
    }

    // 5) Finalize Up
    const finalUrl = detectedUrl || '';
    if (finalUrl) await pushProgress(`Detected deployment URL: ${finalUrl}`);
    const finalBaseDesc = [finalUrl ? `Link: ${finalUrl}` : undefined, branch ? `Branch: ${branch}` : undefined, headShort ? `Head: ${headShort}` : undefined].filter(Boolean).join('\n');
    const finalTargetNote = env === 'Production' ? 'Target project: production' : 'Target project: production (preview)';
    const finalEmoji = env === 'Production' ? '🚀' : env === 'Staging' ? '🟡' : '🧪';
    const finalEmbed = new EmbedBuilder()
      .setTitle(`${finalEmoji} Deployment: ${env}`)
      .setDescription([
        finalBaseDesc,
        finalTargetNote,
        '',
        'Changes:',
        changesBlock,
        '',
        '🟢 Status: Up',
      ].join('\n'))
      .setColor(0x22c55e)
      .setTimestamp(new Date());

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (finalUrl) {
      const openLabel = env === 'Production' ? 'Open Prod' : 'Open Preview';
      row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(openLabel).setURL(finalUrl));
    }
    row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`deploynotes_add_${thread.id}`).setLabel('Add Notes'));
    const components = [row];

    if (firstMessage) {
      await firstMessage.edit({ embeds: [finalEmbed], components });
    }
    await thread.send({ content: '✅ Deployment complete. Add any follow-up notes using the button below.', embeds: [finalEmbed], components });
    await pushProgress('Deployment complete');

    return interaction.editReply({ content: `🧵 Created deployment thread: ${thread.name} in <#${forum.id}>` });
  } catch (err: any) {
    const msg = err?.message || String(err);
    try { logger.error(`[deployments] Error: ${msg}`); } catch {}
    return interaction.editReply({ content: `❌ Failed to create deployment post: ${msg}` });
  }
}

// ===================== PR Flow =====================
type PrState = { owner: string; repo: string; branches: string[]; from?: string; to?: string; filter?: string; pageFrom?: number; pageTo?: number };
const PR_KEYS = (guildId: string, userId: string) => ({ state: `deploy_pr_state_${guildId}_${userId}` });

export async function startPrFlow(interaction: any) {
  const owner = (await secretsStore.get('github_username')) || process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
  const repo = (await secretsStore.get('github_repository')) || process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
  const branches = await fetchBranches(owner, repo).catch(()=>[] as string[]);
  const state: PrState = { owner, repo, branches, pageFrom: 1, pageTo: 1 };
  const keys = PR_KEYS(interaction.guildId, interaction.user.id);
  await secretsStore.set(keys.state, JSON.stringify(state));
  const { components } = await rebuildPrComponents(interaction, interaction.user.id);
  await interaction.reply({ content: 'Create PR: pick branches (from → to)', components, flags: MessageFlags.Ephemeral });
}

export async function handlePrBranchSelect(interaction: any, kind: 'from'|'to') {
  const userId = interaction.user.id;
  const keys = PR_KEYS(interaction.guildId, userId);
  const raw = await secretsStore.get(keys.state).catch(()=> '');
  const st = (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() as PrState;
  const val = (interaction.values?.[0] || '').trim();
  if (!val) return interaction.reply({ content: '❌ Invalid selection', flags: MessageFlags.Ephemeral });
  if (kind === 'from') st.from = val; else st.to = val;
  await secretsStore.set(keys.state, JSON.stringify(st));
  const ready = !!(st.from && st.to);
  const { components } = await rebuildPrComponents(interaction, userId, ready);
  await interaction.update({ content: `Create PR: pick branches (from → to)\nCurrent: ${st.from || '—'} → ${st.to || '—'}`, components });
}

export async function handlePrContinue(interaction: any) {
  const userId = interaction.user.id;
  const keys = PR_KEYS(interaction.guildId, userId);
  const raw = await secretsStore.get(keys.state).catch(()=> '');
  const st = (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() as PrState;
  if (!(st.from && st.to && st.owner && st.repo)) {
    return interaction.reply({ content: '❌ Missing selection', flags: MessageFlags.Ephemeral });
  }
  // Prefill PR title/body using commit comparison
  let body = '';
  try {
    const { Octokit } = await import('@octokit/rest');
    const token = (await secretsStore.get('github_access_token')) || process.env.GITHUB_ACCESS_TOKEN || '';
    const octo = token ? new Octokit({ auth: token }) : new Octokit();
    const cmp = await octo.repos.compareCommits({ owner: st.owner, repo: st.repo, base: st.to, head: st.from });
    const commits = (cmp.data.commits || []).map((c: any) => `- ${c.commit?.author?.name || ''}: ${c.commit?.message?.split('\n')[0] || ''}`).join('\n');
    body = commits ? `Changes:\n${commits}` : '';
  } catch {}
  const title = `PR: ${st.from} → ${st.to}`;
  const modal = new ModalBuilder().setCustomId(`pr_modal_${userId}`).setTitle('Create Pull Request');
  const titleInput = new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(true).setValue(title);
  const bodyInput = new TextInputBuilder().setCustomId('body').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false);
  if (body) bodyInput.setValue(body.slice(0, 1900));
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(bodyInput),
  );
  await interaction.showModal(modal);
}

function prApplyFilter(list: string[], filter?: string) {
  if (!filter) return list;
  const q = filter.toLowerCase();
  return list.filter(b => b.toLowerCase().includes(q));
}

function prPaginate<T>(list: T[], page: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, page || 1), totalPages);
  const start = (p - 1) * size;
  return { items: list.slice(start, start + size), page: p, totalPages };
}

export async function setPrState(interaction: any, userId: string, patch: Partial<PrState>) {
  const keys = PR_KEYS(interaction.guildId, userId);
  const raw = await secretsStore.get(keys.state).catch(()=> '');
  const prev = (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() as PrState;
  const next: PrState = { ...prev, ...patch } as any;
  await secretsStore.set(keys.state, JSON.stringify(next));
  return next;
}

export async function refreshPrBranches(interaction: any, userId: string) {
  const keys = PR_KEYS(interaction.guildId, userId);
  const raw = await secretsStore.get(keys.state).catch(()=> '');
  const st = (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() as PrState;
  const list = await fetchBranches(st.owner, st.repo).catch(()=>[] as string[]);
  await secretsStore.set(keys.state, JSON.stringify({ ...st, branches: list, pageFrom: 1, pageTo: 1 }));
}

export async function rebuildPrComponents(interaction: any, userId: string, readyOverride?: boolean) {
  const keys = PR_KEYS(interaction.guildId, userId);
  const raw = await secretsStore.get(keys.state).catch(()=> '');
  const st = (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() as PrState;
  const list = prApplyFilter(st.branches || [], st.filter);
  const from = prPaginate(list, st.pageFrom || 1, PAGE_SIZE);
  const to = prPaginate(list, st.pageTo || 1, PAGE_SIZE);
  const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder } = await import('discord.js');
  const fromSel = new StringSelectMenuBuilder().setCustomId(`pr_from_${userId}`).setPlaceholder(`FROM: ${st.from || '—'}`).addOptions(...from.items.map(b => ({ label: b, value: b }) as any));
  const toSel = new StringSelectMenuBuilder().setCustomId(`pr_to_${userId}`).setPlaceholder(`TO: ${st.to || '—'}`).addOptions(...to.items.map(b => ({ label: b, value: b }) as any));
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`pr_page_prev_from_${userId}`).setLabel('Prev FROM').setStyle(ButtonStyle.Secondary).setDisabled(from.page <= 1),
    new ButtonBuilder().setCustomId(`pr_page_next_from_${userId}`).setLabel('Next FROM').setStyle(ButtonStyle.Secondary).setDisabled(from.page >= from.totalPages),
    new ButtonBuilder().setCustomId(`pr_page_prev_to_${userId}`).setLabel('Prev TO').setStyle(ButtonStyle.Secondary).setDisabled(to.page <= 1),
    new ButtonBuilder().setCustomId(`pr_page_next_to_${userId}`).setLabel('Next TO').setStyle(ButtonStyle.Secondary).setDisabled(to.page >= to.totalPages),
  );
  const ctrlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`pr_search_${userId}`).setLabel('Search').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pr_refresh_${userId}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pr_cancel_${userId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`pr_continue_${userId}`).setLabel('Continue').setStyle(ButtonStyle.Success).setDisabled(!(readyOverride ?? (!!(st.from && st.to))))
  );
  return { components: [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fromSel as any) as any,
    navRow as any,
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(toSel as any) as any,
    ctrlRow as any,
  ], pageFrom: from.page, totalFrom: from.totalPages, pageTo: to.page, totalTo: to.totalPages };
}

export async function handlePrSearchModalSubmit(interaction: any) {
  const q = (interaction.fields.getTextInputValue('query') || '').trim();
  await setPrState(interaction, interaction.user.id, { filter: q || undefined, pageFrom: 1, pageTo: 1 });
  const { components } = await rebuildPrComponents(interaction, interaction.user.id);
  return interaction.editReply({ content: `Create PR: pick branches (from → to)${q ? `\nFilter: "${q}"` : ''}`, components });
}

export async function handlePrModalSubmit(interaction: any) {
  const userId = interaction.user.id;
  const keys = PR_KEYS(interaction.guildId, userId);
  const raw = await secretsStore.get(keys.state).catch(()=> '');
  const st = (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() as PrState;
  const title = (interaction.fields.getTextInputValue('title') || '').trim();
  const body = (interaction.fields.getTextInputValue('body') || '').trim();
  if (!(st.from && st.to && st.owner && st.repo && title)) {
    return interaction.reply({ content: '❌ Missing fields for PR creation', flags: MessageFlags.Ephemeral });
  }
  await interaction.reply({ content: `Creating PR ${st.from} → ${st.to}…`, flags: MessageFlags.Ephemeral });
  try {
    const { Octokit } = await import('@octokit/rest');
    const token = (await secretsStore.get('github_access_token')) || process.env.GITHUB_ACCESS_TOKEN || '';
    const octo = token ? new Octokit({ auth: token }) : new Octokit();
    const pr = await octo.pulls.create({ owner: st.owner, repo: st.repo, head: st.from, base: st.to, title, body, maintainer_can_modify: true, draft: false });
    const prNumber = pr.data.number;
    await interaction.editReply({ content: `✅ PR #${prNumber} created: ${pr.data.html_url}\nEnable auto fast-forward merge after checks pass?`, components: [
      new (await import('discord.js')).ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`pr_autoff_${prNumber}_${userId}`).setLabel('Enable Auto-FF Merge').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`pr_skipff_${prNumber}_${userId}`).setLabel('Skip').setStyle(ButtonStyle.Secondary)
      ) as any
    ] });
  } catch (e: any) {
    return interaction.editReply({ content: `❌ PR creation failed: ${e?.message || e}` });
  }
}

export async function handlePrAutoFf(interaction: any, prNumber: number) {
  await interaction.update({ content: `Auto-FF merge enabled for PR #${prNumber}. Monitoring checks…`, components: [] });
  try {
    const owner = (await secretsStore.get('github_username')) || process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
    const repo = (await secretsStore.get('github_repository')) || process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
    const token = (await secretsStore.get('github_access_token')) || process.env.GITHUB_ACCESS_TOKEN || '';
    const { Octokit } = await import('@octokit/rest');
    const octo = token ? new Octokit({ auth: token }) : new Octokit();
    const poll = async () => {
      try {
        const pr = await octo.pulls.get({ owner, repo, pull_number: prNumber });
        const sha = pr.data.head.sha;
        const checks = await octo.checks.listForRef({ owner, repo, ref: sha, per_page: 100 }).catch(async () => ({ data: { check_runs: [] } } as any));
        const combined = await octo.repos.getCombinedStatusForRef({ owner, repo, ref: sha }).catch(async () => ({ data: { state: 'success' } } as any));
        const allSuccess = (combined.data.state === 'success') && ((checks.data.check_runs || []).every((r: any) => ['success','neutral','skipped'].includes((r.conclusion || '').toLowerCase())));
        const mergeable = pr.data.mergeable && (pr.data.mergeable_state === 'clean' || pr.data.mergeable_state === 'unstable');
        if (allSuccess && mergeable) {
          // Attempt merge (GitHub will FF if possible)
          await octo.pulls.merge({ owner, repo, pull_number: prNumber, merge_method: 'merge' });
          await interaction.editReply({ content: `🟢 PR #${prNumber} merged (fast-forward where possible).` });
          return true;
        } else {
          await interaction.editReply({ content: `Waiting… PR #${prNumber} status: checks=${allSuccess?'ok':'pending'} mergeable=${mergeable?'yes':'no'} (state: ${pr.data.mergeable_state})` });
          return false;
        }
      } catch (e: any) {
        await interaction.editReply({ content: `Error polling PR #${prNumber}: ${e?.message || e}` });
        return false;
      }
    };
    let attempts = 0;
    const maxAttempts = 180; // ~15 min at 5s
    while (attempts++ < maxAttempts) {
      const done = await poll();
      if (done) break;
      if (process.env.NODE_ENV !== 'test') await new Promise(r => setTimeout(r, 5000)); else await Promise.resolve();
    }
  } catch {}
}

// ===================== Sync Flow =====================
export async function startSyncFlow(interaction: any) {
  const target = (interaction.options?.getString?.('target') || '').trim();
  if (target === 'production') {
    await interaction.reply({ content: 'Syncing main → production (fast-forward)…', flags: MessageFlags.Ephemeral });
    try {
      const owner = (await secretsStore.get('github_username')) || process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
      const repo = (await secretsStore.get('github_repository')) || process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
      const token = (await secretsStore.get('github_access_token')) || process.env.GITHUB_ACCESS_TOKEN || '';
      const { Octokit } = await import('@octokit/rest');
      const octo = token ? new Octokit({ auth: token }) : new Octokit();
      const main = await octo.repos.getBranch({ owner, repo, branch: 'main' });
      const sha = main.data.commit.sha;
      // Check statuses
      const combined = await octo.repos.getCombinedStatusForRef({ owner, repo, ref: sha }).catch(async () => ({ data: { state: 'success' } } as any));
      if ((combined.data.state || '').toString().toLowerCase() !== 'success') {
        return await interaction.editReply({ content: '🔴 Checks are not green on main. Aborting.' });
      }
      // Update production ref (FF only; force=false)
      await octo.git.updateRef({ owner, repo, ref: 'heads/production', sha, force: false });
      return await interaction.editReply({ content: '🟢 production fast-forwarded to main.' });
    } catch (e: any) {
      return await interaction.editReply({ content: `❌ Sync failed: ${e?.message || e}` });
    }
  }
  // Else: picker for open PRs
  const owner = (await secretsStore.get('github_username')) || process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
  const repo = (await secretsStore.get('github_repository')) || process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
  try {
    const { Octokit } = await import('@octokit/rest');
    const token = (await secretsStore.get('github_access_token')) || process.env.GITHUB_ACCESS_TOKEN || '';
    const octo = token ? new Octokit({ auth: token }) : new Octokit();
    const prs = await octo.pulls.list({ owner, repo, state: 'open', per_page: 100 });
    const opts = (prs.data || []).slice(0,25).map((p: any) => ({ label: `#${p.number} ${p.title}`.slice(0,100), value: String(p.number) }));
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
    const select = new StringSelectMenuBuilder().setCustomId(`syncpr_pick_${interaction.user.id}`).setPlaceholder('Select PR to merge').addOptions(...opts as any);
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: 'Pick a PR to fast-forward merge (after checks pass):', components: [row as any], flags: MessageFlags.Ephemeral });
  } catch (e: any) {
    await interaction.reply({ content: `❌ Failed to load PRs: ${e?.message || e}`, flags: MessageFlags.Ephemeral });
  }
}

export async function handleSyncPrSelected(interaction: any) {
  const val = (interaction.values?.[0] || '').trim();
  const prNumber = Number(val);
  if (!prNumber) return interaction.reply({ content: '❌ Invalid selection', flags: MessageFlags.Ephemeral });
  await interaction.update({ content: `Tracking PR #${prNumber} for auto fast-forward merge…`, components: [] });
  // Reuse the auto-merge polling
  await handlePrAutoFf(interaction, prNumber);
}

export const deploymentsCommand = { data, execute };

async function autoDetectLastCommitFromForum(client: any, guildId: string, channelId: string, env: 'Production'|'Staging'|'Development', repoPath: string): Promise<string> {
  try {
    const forum = await client.channels.fetch(channelId) as ForumChannel;
    const threads = await forum.threads.fetchActive();
    const list = threads.threads?.map?.((t: any) => t) || Array.from((threads.threads as any)?.values?.() || []);
    const sorted = list.sort((a: any, b: any) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));
    const target = sorted.find((t: any) => typeof t.name === 'string' && t.name.startsWith(env));
    if (!target) return '';
    const m = target.name.match(/\b([0-9a-f]{6,12})\b/i);
    if (!m) return '';
    const short = m[1];
    const full = await git(['rev-parse', short], repoPath).catch(() => '');
    return full || short;
  } catch {
    return '';
  }
}

async function whichVercel(): Promise<{ cmd: string; args: string[] }> {
  const which = async (bin: string) => {
    try {
      const out = await pexec(process.platform === 'win32' ? 'where' : 'which', [bin]);
      return out.stdout?.trim();
    } catch { return ''; }
  };
  const found = await which('vercel');
  if (found) return { cmd: 'vercel', args: [] };
  throw new Error('Vercel CLI not found. Please install it: npm i -g vercel');
}

async function getLastProdCommitViaVercel(repoPath: string): Promise<string> {
  try {
    const vercelCmd = await whichVercel();
    // Try JSON listing for prod deployments
    const tryJson = async (sub: string) => {
      const { spawn } = await import('node:child_process');
      return await new Promise<string>((resolve) => {
        const child = spawn(vercelCmd.cmd, vercelCmd.args.concat([sub, '--prod', '--json', '--limit', '1']), { cwd: repoPath, env: process.env });
        let out = '';
        child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
        child.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        child.on('error', () => resolve(''));
        child.on('close', () => {
          try {
            const data = JSON.parse(out);
            const arr = Array.isArray(data) ? data : (Array.isArray((data as any)?.deployments) ? (data as any).deployments : []);
            const first = arr?.[0] || data;
            const commit = (first?.commit || first?.meta?.commit || first?.meta?.githubCommitSha || first?.gitCommitSha || '').toString();
            resolve(commit || '');
          } catch {
            resolve('');
          }
        });
      });
    };
    let commit = await tryJson('list');
    if (!commit) commit = await tryJson('ls');
    if (commit) return commit;

    // Fallback: parse text table output
    const out = await pexec(vercelCmd.cmd, vercelCmd.args.concat(['list', '--prod', '--limit', '1']), { cwd: repoPath, env: process.env }).then(r => r.stdout + r.stderr).catch(() => '');
    const lines = out.split('\n');
    // Look for hex sha patterns or COMMIT column
    const shaMatch = lines.join(' ').match(/\b([0-9a-f]{7,40})\b/i);
    if (shaMatch) return shaMatch[1];
  } catch {}
  return '';
}

export async function handleDeploymentsNotesModalSubmit(interaction: any) {
  try {
    const threadId = (interaction.customId || '').replace('deploynotes_modal_', '');
    const notes = (interaction.fields.getTextInputValue('notes_input') || '').trim();
    if (!notes) return await interaction.editReply({ content: '❌ No notes provided.' });

    // Edit the latest deployment embed in the thread to include these notes
    const channel = await interaction.client.channels.fetch(threadId).catch(() => null);
    const thread = channel && channel.isThread?.() ? channel : await (async () => {
      try {
        const c = await interaction.channel?.fetch?.();
        return c?.isThread?.() ? c : null;
      } catch { return null; }
    })();

    if (thread) {
      // Find the most recent deployment embed message in this thread
      const messages = await thread.messages.fetch({ limit: 50 }).catch(() => null);
      const target = messages
        ? messages
            .filter((m: any) => m?.author?.bot && Array.isArray(m.embeds) && m.embeds.length > 0)
            .find((m: any) => {
              // Prefer a message that looks like our deployment card
              const hasDeployTitle = (m.embeds[0]?.title || '').includes('🚀 Deployment:');
              const hasNotesButton = Array.isArray(m.components) && m.components.some((row: any) =>
                Array.isArray(row.components) && row.components.some((c: any) => c?.customId === `deploynotes_add_${thread.id}`)
              );
              return hasDeployTitle || hasNotesButton;
            }) || messages?.find((m: any) => (m.embeds?.[0]?.title || '').includes('🚀 Deployment:'))
        : null;

      if (target && target.embeds && target.embeds[0]) {
        // Build updated embed: add or update a Notes field
        const eb = EmbedBuilder.from(target.embeds[0]);
        const json = eb.toJSON();
        const fields = Array.isArray((json as any).fields) ? [...(json as any).fields] : [];
        const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const mention = interaction?.user?.id ? `<@${interaction.user.id}>` : `${interaction.user}`;
        const headerBase = '📝 Notes';
        const headerWithAuthor = `${headerBase} (by ${mention})`;
        const noteValue = `by ${mention} at ${time}\n> ${notes.replace(/\n/g, '\n> ')}`.slice(0, 1024);
        const idx = fields.findIndex((f: any) => typeof f?.name === 'string' && (f.name.includes('Notes') || f.name.includes('📝')));
        if (idx >= 0) {
          // Append to existing notes block, capping entries kept in the embed
          const existing = String(fields[idx].value || '');
          const entries = existing ? existing.split(/\n\s*\n/).filter(Boolean) : [];
          const combined = [...entries, noteValue];
          const KEEP = Math.max(1, parseInt(process.env.DEPLOY_NOTES_EMBED_KEEP || '3', 10));
          const toKeep = combined.slice(-KEEP);
          const spilled = combined.slice(0, -KEEP);

          // If we have spilled entries, post them as an archived batch to the thread
          if (spilled.length > 0) {
            try {
              const archive = '🗂️ Archived notes moved from card:\n\n' + spilled.map((e) => e).join('\n\n');
              await thread.send({ content: archive });
            } catch {}
          }

          // Compose value with a small archived hint when we spill
          const suffix = spilled.length > 0 ? `\n\n_(${spilled.length} older archived)_` : '';
          let value = toKeep.join('\n\n');
          const MAX = 1024;
          if (suffix && value.length + suffix.length > MAX) {
            value = value.slice(0, MAX - suffix.length);
          }
          fields[idx].value = (value + suffix).slice(0, MAX);
          // Also update the field header to show latest author
          fields[idx].name = headerWithAuthor;
        } else {
          fields.push({ name: headerWithAuthor, value: noteValue, inline: false });
        }
        // Add a footer badge to indicate notes were updated with user + time
        const newFooter = `📝 Notes updated by ${mention} at ${time}`;
        const updated = EmbedBuilder.from({ ...json, fields })
          .setFooter({ text: newFooter })
          .setTimestamp(new Date());

        // Rebuild components and flip the notes button label to "Edit Notes"
        const rebuiltRows = (target.components || []).map((row: any) => {
          try {
            const newRow = new ActionRowBuilder<ButtonBuilder>();
            const comps = Array.isArray(row.components) ? row.components : [];
            comps.forEach((c: any) => {
              // 2 = Button in Discord API
              if ((c?.type || 2) === 2) {
                const b = new ButtonBuilder().setStyle(c.style || ButtonStyle.Secondary);
                const customId = c?.custom_id || c?.customId;
                if (c.style === ButtonStyle.Link) {
                  if (c.url) b.setURL(c.url);
                } else if (customId) {
                  b.setCustomId(customId);
                }
                const isNotes = typeof customId === 'string' && customId === `deploynotes_add_${thread.id}`;
                const label = isNotes ? 'Edit Notes' : (c?.label || '');
                if (label) b.setLabel(label);
                if (c?.emoji) b.setEmoji(c.emoji as any);
                if (c?.disabled) b.setDisabled(true);
                newRow.addComponents(b as any);
              }
            });
            return newRow;
          } catch { return row; }
        });

        await target.edit({ embeds: [updated], components: rebuiltRows as any });
        return await interaction.editReply({ content: '✅ Notes added to deployment card.' });
      }

      // If we couldn't find the embed to edit, acknowledge but do not post a new message
      return await interaction.editReply({ content: '✅ Notes received, but deployment card not found to update.' });
    }

    // Fallback: reply ephemerally if we cannot resolve thread at all
        return await interaction.editReply({ content: '✅ Notes received, but thread could not be resolved.' });
  } catch (e: any) {
    return await interaction.editReply({ content: `❌ Failed to add notes: ${e?.message || e}` });
  }
}

function pickDeploymentTagIds(forum: ForumChannel, env: 'Production'|'Staging'|'Development'): string[] {
  // Extend to support Development treated like preview
  try {
    const tags = (forum.availableTags || []) as any[];
    if (!Array.isArray(tags) || tags.length === 0) return [];
    const nameEq = (want: string[]) => tags.find(t => want.some(w => (t.name || '').toLowerCase() === w));
    const nameMatch = (want: string[]) => tags.find(t => want.some(w => (t.name || '').toLowerCase().includes(w)));
    // Prioritize exact tag names provided by user: Production (prod env) and Preview (staging env)
    const isProd = env === 'Production';
    const exactEnv = isProd ? ['production'] : ['preview'];
    // Synonyms as secondary preference
    const envPref = isProd ? ['prod', 'production', 'release', 'ship'] : ['preview', 'staging', 'preprod', 'qa', 'dev', 'development'];
    const common = ['deploy', 'deployment', 'deployments', 'vercel', 'sre', 'ops', 'release'];
    const pick = nameEq(exactEnv) || nameMatch(envPref) || nameMatch(common) || tags[0];
    return pick ? [pick.id] : [];
  } catch { return []; }
}

// Helper: open the deployments modal with optional defaults
export async function openDeploymentsModal(interaction: any, env: 'Production'|'Staging'|'Development', defaults?: { branch?: string; repoPath?: string; group?: string }) {
  const modal = new ModalBuilder()
    .setCustomId(`deployments_modal_${env}_${interaction.user.id}`)
    .setTitle('Start Deployment Post');

  const repoPathInput = new TextInputBuilder()
    .setCustomId('repo_path')
    .setLabel('Repo path (optional)')
    .setStyle(TextInputStyle.Short)
    // Default visible value points to the app's deploy subdirectory.
    // If a Vercel group is provided in the modal, submission logic switches
    // the default to the standard repo root automatically when empty.
    .setValue(defaults?.repoPath || DEFAULT_REPO_PATH_APP)
    .setRequired(false);

  const branchInput = new TextInputBuilder()
    .setCustomId('branch')
    .setLabel('Branch')
    .setStyle(TextInputStyle.Short)
    .setValue((defaults?.branch || (env === 'Production' ? 'production' : '')))
    .setRequired(false);

  const notesInput = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('Deployment notes (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  const groupInput = new TextInputBuilder()
    .setCustomId('group')
    .setLabel('Vercel group name (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  if (defaults?.group) groupInput.setValue(defaults.group);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(repoPathInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(branchInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(groupInput),
  );

  await interaction.showModal(modal);
}

// Resume the deployment pipeline in-place within an existing thread (no modal)
export async function resumeDeploymentInThread(interaction: any, params: { env: 'Production'|'Staging'|'Development'; repoPath: string; branch: string; groupName?: string }) {
  const env = params.env;
  const repoPath = params.repoPath;
  const branch = params.branch;
  const groupName = params.groupName || '';
  const thread = (interaction.channel || interaction.thread) as any;
  const { logger } = await import('../../logger');
  const { secretsStore } = await import('../../settings/SecretsStore');
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = await import('discord.js');

  // Helpers (send progress/status to thread)
  const progress: string[] = [];
  const pushProgress = async (line: string) => {
    const ts = new Date().toLocaleTimeString();
    const entry = `${ts} • ${line}`;
    progress.push(entry);
    try { await interaction.followUp?.({ content: `Deploy progress:\n${progress.slice(-10).join('\n')}`, flags: MessageFlags.Ephemeral }); } catch {}
    try { logger.info?.(`[deploy:resume] ${line}`); } catch {}
  };
  const setStatus = async (status: string, extraDesc?: string) => {
    const envLabel = env === 'Production' ? 'Production' : `${env} (Preview)`;
    const desc = [
      `Environment: ${envLabel}`,
      branch ? `Branch: ${branch}` : undefined,
      env === 'Production' ? 'Target project: production' : 'Target project: production (preview)',
      extraDesc ? `\n${extraDesc}` : undefined,
      '',
      status,
    ].filter(Boolean).join('\n');
    const updated = new EmbedBuilder()
      .setTitle(`${env === 'Production' ? '🚀' : env === 'Staging' ? '🟡' : '🧪'} Deployment: ${env}`)
      .setDescription(desc)
      .setColor(status.includes('🟢') ? 0x22c55e : status.includes('🔴') ? 0xef4444 : 0xf59e0b)
      .setTimestamp(new Date());
    try { await thread.send({ embeds: [updated] }); } catch {}
  };
  const appendLog = async (title: string, chunk: string) => {
    if (!chunk?.trim()) return;
    const MAX = 1800;
    const text = chunk.length > MAX ? chunk.slice(-MAX) : chunk;
    await thread.send({ content: `**${title}**\n\n\`\`\`\n${text}\n\`\`\`` });
  };
  const streamCmd = (cmd: string, args: string[], name: string) => new Promise<void>((resolve, reject) => {
    const { spawn } = require('node:child_process');
    void pushProgress(`Exec: ${cmd} ${args.join(' ')} (cwd: ${repoPath})`);
    const child = spawn(cmd, args, { cwd: repoPath });
    let buffer = '';
    const flush = async () => { if (buffer) { await appendLog(name, buffer); buffer = ''; } };
    child.stdout.on('data', async (d: Buffer) => { buffer += d.toString(); if (buffer.length > 1200) await flush(); });
    child.stderr.on('data', async (d: Buffer) => { buffer += d.toString(); if (buffer.length > 1200) await flush(); });
    child.on('error', async (e: any) => { const msg = `Spawn error for ${name}: ${e?.code || ''} ${e?.message || e}`.trim(); await appendLog(name, msg); await pushProgress(msg); reject(e); });
    child.on('close', async (code: number|null, signal: NodeJS.Signals|null) => { await flush(); if (code === 0) resolve(); else { const msg = `${name} exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`; await pushProgress(msg); reject(new Error(msg)); } });
  });

  await setStatus('🟡 Status: Preparing');

  // Ensure correct branch and sync
  try {
    const currentBranch = await git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath).catch(() => '');
    if (currentBranch && currentBranch !== branch) {
      await pushProgress(`Checking out '${branch}' from '${currentBranch}'`);
      await streamCmd('git', ['checkout', branch], 'git checkout');
    }
    await setStatus('🟡 Status: Syncing branch…');
    await pushProgress('Fetching origin');
    await streamCmd('git', ['fetch', 'origin', branch], 'git fetch');
    await pushProgress('Pulling latest changes');
    await streamCmd('git', ['pull', 'origin', branch], 'git pull');
  } catch (e: any) {
    await setStatus('🔴 Status: Failed during git sync');
    await pushProgress(`Git sync failed: ${(e?.message || e)}`);
    return;
  }

  // Determine HEAD
  let headShort = '';
  try { await git(['rev-parse', 'HEAD'], repoPath); headShort = await git(['rev-parse', '--short', 'HEAD'], repoPath); await pushProgress(`HEAD now at ${headShort}`); } catch {}

  // Compute changes since last deploy
  let lastCommit = await getLastVercelCommit(repoPath, env, branch).catch(() => '');
  let commitLines: string[] = [];
  try {
    if (lastCommit) {
      const range = `${lastCommit}..HEAD`;
      const out = await git(['log', '--pretty=format:%h %s — %an', range], repoPath).catch(() => '');
      commitLines = out ? out.split('\n').filter(Boolean) : [];
    } else {
      const out = await git(['log', '-n', '10', '--pretty=format:%h %s — %an'], repoPath).catch(() => '');
      commitLines = out ? out.split('\n').filter(Boolean) : [];
    }
  } catch {}
  const changesBlock = commitLines.length ? commitLines.map(l => `• ${l}`).join('\n') : '• No changes';
  await setStatus('🟠 Status: Deploying', ['Changes:', changesBlock].join('\n'));

  // Orchestrated deploy (reuse same provider selection as main flow)
  try {
    const owner = process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || '';
    const repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || '';
    let mapProject: string | undefined = undefined;
    let mapTeam: string | undefined = undefined;
    let mapProjectName: string | undefined = undefined;
    let mapPrefer: 'api'|'cli'|undefined = undefined;
    try {
      const rawEnv = await secretsStore.get(`vercel_map_${owner}_${repo}_${env}`);
      const rawGen = await secretsStore.get(`vercel_map_${owner}_${repo}`);
      const raw = rawEnv || rawGen || '';
      if (raw) { const obj = JSON.parse(raw); mapProject = obj?.projectId || undefined; mapTeam = obj?.teamId || undefined; mapProjectName = obj?.projectName || obj?.projectSlug || undefined; mapPrefer = (obj?.prefer === 'api' || obj?.prefer === 'cli') ? obj.prefer : undefined; }
    } catch {}

    // Derive monorepo subdir
    const deriveSubdir = (absPath: string): string => { try { const parts = absPath.split('/').filter(Boolean); const idx = parts.lastIndexOf('deploy'); if (idx >= 0) return parts.slice(idx).join('/'); } catch {} return ''; };
    const appSubdir = deriveSubdir(repoPath) || '';
    const useLocalPath = repoPath.startsWith('/');
    const repoProvider = useLocalPath ? new LocalPathRepoProvider(appSubdir ? repoPath : repoPath) : new LocalCloneRepoProvider(3);
    const apiProvider = new VercelApiProvider(
      async () => await secretsStore.get('vercel_token'),
      async () => await secretsStore.get('vercel_team_id'),
      async () => { const v = await secretsStore.get('vercel_project_id').catch(()=> ''); return v || mapProject || undefined; },
      async () => { const v = await secretsStore.get('vercel_project_name').catch(()=> '') || await secretsStore.get('vercel_project_slug').catch(()=> ''); return v || mapProjectName || repo; },
    );
    const cliProvider = new VercelCliProvider(true);
    try { const tok = await secretsStore.get('vercel_token'); if (tok) (process.env as any).VERCEL_TOKEN = tok; } catch {}
    const preferApiGlobal = (await secretsStore.get('vercel_prefer_api')) === 'true';
    let preferApi = preferApiGlobal; if (mapPrefer === 'api') preferApi = true; else if (mapPrefer === 'cli') preferApi = false;
    if (!mapPrefer && owner === 'atoms-tech' && repo === 'atoms.tech') preferApi = false;

    const ctx: any = {
      guildId: interaction.guildId as string,
      env,
      repo: { owner, name: repo, branch, baseBranch: 'production', headBranch: 'main' },
      forumThreadId: thread?.id,
      vercel: { projectId: mapProject || (await secretsStore.get('vercel_project_id').catch(()=>'')) || undefined, teamId: (await secretsStore.get('vercel_team_id').catch(()=>'')) || undefined },
      appSubdir: appSubdir || undefined,
      userId: interaction.user?.id,
    };
    const logs = {
      info: async (line: string) => { try { await appendLog('deploy', line); } catch {}; try { logger.info?.(`[deploy] ${line}`); } catch {} },
      error: async (line: string) => { try { await appendLog('deploy', line); } catch {}; try { logger.error?.(`[deploy] ${line}`); } catch {} },
      status: async (line: string) => { try { await thread.send({ content: `Status: ${line}` }); } catch {} },
    };

    const tStart = Date.now();
    const projects: string[] = [ ctx.vercel.projectId || ctx.vercel.projectName || repo ].filter(Boolean) as string[];
    const results: any[] = [];
    const deployOne = async (projectId: string) => {
      const tag = projects.length > 1 ? ` [${projectId}]` : '';
      await logs.info(`Starting deploy${tag}`);
      let result: any;
      if (preferApi) {
        result = await new DeployOrchestrator(repoProvider, apiProvider).run(ctx, logs);
        if (result.status !== 'ready') { await logs.info(`API deploy failed${tag}; attempting CLI`); result = await new DeployOrchestrator(repoProvider, cliProvider).run(ctx, logs); }
      } else {
        result = await new DeployOrchestrator(repoProvider, cliProvider).run(ctx, logs);
        if (result.status !== 'ready') { await logs.info(`CLI deploy failed${tag}; attempting API`); result = await new DeployOrchestrator(repoProvider, apiProvider).run(ctx, logs); }
      }
      const durationSec = Math.max(1, Math.round((Date.now() - tStart) / 1000));
      results.push({ projectId, url: result.url, status: result.status, error: result.error, durationSec });
      if (result.status !== 'ready') { await logs.error(`Deploy failed for project ${projectId}: ${result.error || 'unknown'}`); } else { await logs.status(`Up${tag}: ${result.url || '(no url)'}`); }
    };
    for (const p of projects) await deployOne(p);

    const lastOk = results.slice().reverse().find(r => r.status === 'ready');
    if (!lastOk) throw new Error(results.find(r => r.error)?.error || 'Deploy failed');

    const finalUrl = lastOk.url || '';
    await pushProgress(`Detected deployment URL: ${finalUrl}`);
    const finalEmbed = new EmbedBuilder()
      .setTitle(`${env === 'Production' ? '🚀' : env === 'Staging' ? '🟡' : '🧪'} Deployment: ${env}`)
      .setDescription([
        finalUrl ? `Link: ${finalUrl}` : undefined,
        branch ? `Branch: ${branch}` : undefined,
        headShort ? `Head: ${headShort}` : undefined,
        env === 'Production' ? 'Target project: production' : 'Target project: production (preview)',
        '',
        '🟢 Status: Up',
      ].filter(Boolean).join('\n'))
      .setColor(0x22c55e)
      .setTimestamp(new Date());
    const row = new ActionRowBuilder<ButtonBuilder>();
    if (finalUrl) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(env === 'Production' ? 'Open Prod' : 'Open Preview').setURL(finalUrl));
    row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`deploynotes_add_${thread?.id}`).setLabel('Add Notes'));
    await thread.send({ embeds: [finalEmbed], components: [row as any] });
  } catch (e: any) {
    await setStatus('🔴 Status: Failed', (e?.message || e));
  }
}

// Branch fetch via GitHub API
export async function fetchBranches(owner: string, repo: string): Promise<string[]> {
  try {
    const token = (await (await import('../../settings/SecretsStore')).secretsStore.get('github_access_token')) || process.env.GITHUB_ACCESS_TOKEN || '';
    const { Octokit } = await import('@octokit/rest');
    const octo = token ? new Octokit({ auth: token }) : new Octokit();
    if (!owner || !repo) return [];
    const res = await octo.repos.listBranches({ owner, repo, per_page: 100 });
    const names = (res.data || []).map((b: any) => b.name).filter(Boolean);
    // promote common branches first
    const order = ['production','main','develop','staging'];
    return names.sort((a,b) => (order.indexOf(a) >= 0 ? order.indexOf(a) : 999) - (order.indexOf(b) >= 0 ? order.indexOf(b) : 999));
  } catch { return []; }
}

// Env-aware last commit lookup from Vercel CLI
async function getLastVercelCommit(repoPath: string, env: 'Production'|'Staging'|'Development', branch: string): Promise<string> {
  try {
    const vercelCmd = await whichVercel();
    const isProd = env === 'Production';
    const args = ['list', '--json', '--limit', '50'];
    if (isProd) args.splice(1, 0, '--prod');
    const { spawn } = await import('node:child_process');
    const out = await new Promise<string>((resolve) => {
      const child = spawn(vercelCmd.cmd, vercelCmd.args.concat(args), { cwd: repoPath, env: process.env });
      let buf = '';
      child.stdout.on('data', (d: Buffer) => { buf += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { buf += d.toString(); });
      child.on('error', () => resolve(''));
      child.on('close', () => resolve(buf));
    });
    try {
      const data = JSON.parse(out);
      const arr = Array.isArray(data) ? data : (Array.isArray((data as any)?.deployments) ? (data as any).deployments : []);
      const list: any[] = arr.filter(Boolean);
      const pick = isProd
        ? list[0]
        : list.find((d: any) => {
            const ref = (d?.meta?.githubCommitRef || d?.meta?.gitlabCommitRef || d?.meta?.githubCommitRef || d?.branch || d?.gitSource?.ref || '').toString();
            return ref === branch;
          }) || list[0];
      const commit = (pick?.commit || pick?.meta?.commit || pick?.meta?.githubCommitSha || pick?.gitCommitSha || '').toString();
      if (commit) return commit;
    } catch {}

    // Fallback: parse text
    const txt = await pexec(vercelCmd.cmd, vercelCmd.args.concat(isProd ? ['list','--prod','--limit','1'] : ['list','--limit','10']), { cwd: repoPath, env: process.env })
      .then(r => r.stdout + r.stderr).catch(() => '');
    const m = txt.match(/\b([0-9a-f]{7,40})\b/i);
    return m?.[1] || '';
  } catch { return ''; }
}

// Development branch picker rendering + state helpers
type DevBranchState = { owner: string; repo: string; page: number; filter?: string };
const DEV_KEYS = (guildId: string, userId: string) => ({ list: `dev_branch_list_${guildId}_${userId}`, state: `dev_branch_state_${guildId}_${userId}` });
const PAGE_SIZE = 25;

function applyFilter(list: string[], filter?: string): string[] {
  if (!filter) return list;
  const terms = filter.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return list;
  return list.filter(b => {
    const s = b.toLowerCase();
    return terms.every(t => s.includes(t));
  });
}

function paginate<T>(list: T[], page: number, size: number): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * size;
  return { items: list.slice(start, start + size), page: p, totalPages };
}

function buildBranchSelectRow(branches: string[], userId: string) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`deploybranch_dev_${userId}`)
    .setPlaceholder(branches.length ? 'Select a branch to deploy' : 'No matches — adjust filter')
    .setDisabled(branches.length === 0);
  if (branches.length > 0) {
    select.addOptions(...branches.map(b => ({ label: b, value: b })) as any);
  } else {
    select.addOptions({ label: 'No matches', value: 'no_matches' } as any);
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function buildBranchButtonsRow(page: number, totalPages: number, userId: string, filter?: string) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(new ButtonBuilder().setCustomId(`deploybranch_page_prev_${userId}`).setLabel('Prev').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1));
  row.addComponents(new ButtonBuilder().setCustomId(`deploybranch_page_next_${userId}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages));
  row.addComponents(new ButtonBuilder().setCustomId(`deploybranch_search_${userId}`).setLabel('Search').setStyle(ButtonStyle.Primary));
  row.addComponents(new ButtonBuilder().setCustomId(`deploybranch_refresh_${userId}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary));
  row.addComponents(new ButtonBuilder().setCustomId(`deploybranch_cancel_${userId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger));
  return row;
}

export async function initDevBranchPicker(interaction: any, owner: string, repo: string, opts?: { respondWith?: 'reply'|'update' }) {
  const guildId = interaction.guildId as string;
  const userId = interaction.user.id as string;
  const keys = DEV_KEYS(guildId, userId);
  const branches = await fetchBranches(owner, repo).catch(() => [] as string[]);
  const list = branches.length ? branches : ['main','production','develop'];
  await secretsStore.set(keys.list, JSON.stringify(list));
  const state: DevBranchState = { owner, repo, page: 1 };
  await secretsStore.set(keys.state, JSON.stringify(state));
  const filtered = applyFilter(list, state.filter);
  const { items, page, totalPages } = paginate(filtered, state.page, PAGE_SIZE);
  const selectRow = buildBranchSelectRow(items, userId);
  const btnRow = buildBranchButtonsRow(page, totalPages, userId, state.filter);
  const payload = { content: 'Select a branch for Development deploy:', components: [selectRow as any, btnRow as any], flags: MessageFlags.Ephemeral } as any;
  if ((opts?.respondWith || 'reply') === 'update') {
    await interaction.update(payload);
  } else {
    await interaction.reply(payload);
  }
}

export async function rebuildDevBranchPickerComponents(interaction: any, userId: string) {
  const guildId = interaction.guildId as string;
  const keys = DEV_KEYS(guildId, userId);
  const listRaw = await secretsStore.get(keys.list).catch(()=> '');
  const stateRaw = await secretsStore.get(keys.state).catch(()=> '');
  const list = (() => { try { return JSON.parse(listRaw || '[]'); } catch { return []; } })() as string[];
  const state = (() => { try { return JSON.parse(stateRaw || '{}'); } catch { return {}; } })() as DevBranchState;
  const filtered = applyFilter(list, state.filter);
  const { items, page, totalPages } = paginate(filtered, state.page || 1, PAGE_SIZE);
  const selectRow = buildBranchSelectRow(items, userId);
  const btnRow = buildBranchButtonsRow(page, totalPages, userId, state.filter);
  return { components: [selectRow as any, btnRow as any], page, totalPages };
}

export async function setDevBranchState(interaction: any, userId: string, patch: Partial<DevBranchState>) {
  const guildId = interaction.guildId as string;
  const keys = DEV_KEYS(guildId, userId);
  const prevRaw = await secretsStore.get(keys.state).catch(()=> '');
  const prev = (() => { try { return JSON.parse(prevRaw || '{}'); } catch { return {}; } })() as DevBranchState;
  const next: DevBranchState = { owner: prev.owner, repo: prev.repo, page: prev.page || 1, filter: prev.filter, ...patch } as any;
  await secretsStore.set(keys.state, JSON.stringify(next));
  return next;
}

export async function refreshDevBranchList(interaction: any, userId: string) {
  const guildId = interaction.guildId as string;
  const keys = DEV_KEYS(guildId, userId);
  const stateRaw = await secretsStore.get(keys.state).catch(()=> '');
  const state = (() => { try { return JSON.parse(stateRaw || '{}'); } catch { return {}; } })() as DevBranchState;
  const list = await fetchBranches(state.owner, state.repo).catch(() => [] as string[]);
  await secretsStore.set(keys.list, JSON.stringify(list));
  // reset to first page on refresh
  await setDevBranchState(interaction, userId, { page: 1 });
}

export async function handleDevBranchSearchModalSubmit(interaction: any) {
  const ownerId = (interaction.customId || '').replace('deploybranch_search_modal_', '');
  if (ownerId && ownerId !== interaction.user.id) {
    return await interaction.editReply({ content: '❌ Only the requester can search.', flags: MessageFlags.Ephemeral });
  }
  const query = (interaction.fields.getTextInputValue('query') || '').trim();
  await setDevBranchState(interaction, interaction.user.id, { filter: query || undefined, page: 1 });
  const { components } = await rebuildDevBranchPickerComponents(interaction, interaction.user.id);
  return await interaction.editReply({ content: `Select a branch for Development deploy:${query ? `\nFilter: "${query}"` : ''}`, components });
}

export async function getDevBranchState(interaction: any, userId: string): Promise<DevBranchState> {
  const guildId = interaction.guildId as string;
  const keys = DEV_KEYS(guildId, userId);
  const stateRaw = await secretsStore.get(keys.state).catch(()=> '');
  const state = (() => { try { return JSON.parse(stateRaw || '{}'); } catch { return {}; } })() as DevBranchState;
  return state;
}

// Environment picker (if env not provided)
export async function showEnvPicker(interaction: any, source: 'start'|'alias') {
  const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
  const select = new StringSelectMenuBuilder()
    .setCustomId(`deployenv_pick_${source}_${interaction.user.id}`)
    .setPlaceholder('Select environment to deploy')
    .addOptions(
      { label: 'Development (Preview by branch)', value: 'Development' } as any,
      { label: 'Staging (Preview)', value: 'Staging' } as any,
      { label: 'Production', value: 'Production' } as any,
    );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  const btn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`deployenv_cancel_${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );
  await interaction.reply({ content: 'Pick an environment to deploy (Production → prod; Staging/Development → preview):', components: [row as any, btn as any], flags: MessageFlags.Ephemeral });
}
