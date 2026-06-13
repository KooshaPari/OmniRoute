import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  ThreadChannel,
} from "discord.js";
import { store } from "../store-db";
import {
  octokit,
  repoCredentials,
  getRepoCredentialsForThread,
  ensureThreadRepoBinding,
} from "../github/githubActions";
import { createSmartIssueEmbed, IssueMetadata } from "./smartEmbeds";
import { jiraService } from "../jira/jiraClient";
import { logger } from "../logger";
import { rebuildDevBranchPickerComponents, setDevBranchState, refreshDevBranchList, getDevBranchState, openDeploymentsModal } from './commands/deployments';
import { secretsStore } from "../settings/SecretsStore";
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const pexec = promisify(execFile);

export async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId || "";
  const parts = customId.split("_");
  const action = parts[0] || "";
  const subAction = parts.length > 1 ? parts[1] : "";
  // Thread ID may contain underscores; join everything after action + subAction
  const threadId = parts.length > 2 ? parts.slice(2).join("_") : (parts[1] ?? "");

  // Ack rule: if this handler will showModal, do NOT defer first; else defer early to avoid 10062/40060
  const willSelfAckOrModal = [
    // These open modals and must not be pre-acked with deferUpdate
    'assign', 'labels', 'comment', 'resolve', 'wontdo', 'closeissue', 'delete', 'jira', 'deploynotes',
    // Proceed opens a modal (bug/feature forms)
    'proceed',
    // These handlers explicitly deferReply themselves
    'close', 'reopen',
    // These reply directly (no pre-defer)
    'priority', 'status',
    // Branch picker supports modal search; avoid pre-defer to allow showModal
    'deploybranch'
  ].includes(action);
  try {
    if (!willSelfAckOrModal) {
      try { await interaction.deferUpdate(); } catch {}
    }
  } catch {}

  // Validate threadId for actions that require a thread context
  const requiresThread = [
    "close", "reopen", "status", "triage", "labels", "comment", "resolve", "wontdo", "closeissue", "delete", "jira"
  ];
  if (!threadId && requiresThread.includes(action)) {
    try {
      await interaction.reply({ content: "❌ Thread not found.", flags: MessageFlags.Ephemeral });
    } catch {}
    return;
  }

  switch (action) {
    case 'deployresume_auto': {
      try {
        const ownerId = parts[2]; // deployresume_auto_<threadId>_<ownerId>
        const threadIdOnly = parts[1];
        if (ownerId && ownerId !== interaction.user.id) {
          return await interaction.reply({ content: '❌ Only the requester can resume this deploy.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const raw = await secretsStore.get(`deploy_resume_ctx_${threadIdOnly}`).catch(()=> '');
        if (!raw) return await interaction.editReply({ content: 'ℹ️ Resume context not found. Please run /deploy again.' });
        const ctx = (() => { try { return JSON.parse(raw); } catch { return {}; } })() as any;
        const repoPath = ctx.repoPath as string;
        const env = ctx.env as any;
        const branch = ctx.branch as string;
        if (!repoPath || !env) return await interaction.editReply({ content: 'ℹ️ Incomplete context. Please run /deploy again.' });
        // Re-check cleanliness
        const statusShort = await pexec('git', ['status', '-sb'], { cwd: repoPath }).then(r => r.stdout.trim()).catch(() => '');
        const porcelain = await pexec('git', ['status', '--porcelain=v1'], { cwd: repoPath }).then(r => r.stdout.trim()).catch(() => '');
        const upstream = await pexec('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: repoPath }).then(r => r.stdout.trim()).catch(() => '');
        let unpushed = 0; if (upstream) { unpushed = await pexec('git', ['rev-list', '--count', '@{u}..HEAD'], { cwd: repoPath }).then(r => parseInt(r.stdout.trim()||'0',10)||0).catch(()=>0); }
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
        const hasIssues = (staged + unstaged + untracked) > 0 || unpushed > 0;
        if (hasIssues) {
          const msg = [
            '🔴 Still blocked by local changes.',
            staged ? `Staged: ${staged}` : undefined,
            unstaged ? `Unstaged: ${unstaged}` : undefined,
            untracked ? `Untracked: ${untracked}` : undefined,
            unpushed ? `Unpushed commits: ${unpushed}` : undefined,
            statusShort ? `\n\`\`\`\n${statusShort}\n\`\`\`` : undefined,
          ].filter(Boolean).join('\n');
          return await interaction.editReply({ content: msg });
        }
        const { resumeDeploymentInThread } = await import('./commands/deployments');
        await interaction.editReply({ content: '🟢 Local repo is clean. Resuming deployment…' });
        return await resumeDeploymentInThread(interaction, { env, repoPath, branch, groupName: ctx.groupName });
      } catch (e) {
        return await interaction.reply({ content: `❌ Failed to resume: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    break;
    case 'deployresume': {
      try {
        const ownerId = parts[2]; // deployresume_<threadId>_<ownerId>
        const threadIdOnly = parts[1];
        if (ownerId && ownerId !== interaction.user.id) {
          return await interaction.reply({ content: '❌ Only the requester can resume this deploy.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const raw = await secretsStore.get(`deploy_resume_ctx_${threadIdOnly}`).catch(()=> '');
        if (!raw) return await interaction.editReply({ content: 'ℹ️ Resume context not found. Please run /deploy again.' });
        const ctx = (() => { try { return JSON.parse(raw); } catch { return {}; } })() as any;
        const repoPath = ctx.repoPath as string;
        const env = ctx.env as 'Production'|'Staging'|'Development' | undefined;
        const branch = ctx.branch as string | undefined;
        const group = ctx.groupName as string | undefined;
        if (!repoPath || !env) return await interaction.editReply({ content: 'ℹ️ Incomplete context. Please run /deploy again.' });
        // Re-check cleanliness
        const statusShort = await pexec('git', ['status', '-sb'], { cwd: repoPath }).then(r => r.stdout.trim()).catch(() => '');
        const porcelain = await pexec('git', ['status', '--porcelain=v1'], { cwd: repoPath }).then(r => r.stdout.trim()).catch(() => '');
        const upstream = await pexec('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: repoPath }).then(r => r.stdout.trim()).catch(() => '');
        let unpushed = 0; if (upstream) { unpushed = await pexec('git', ['rev-list', '--count', '@{u}..HEAD'], { cwd: repoPath }).then(r => parseInt(r.stdout.trim()||'0',10)||0).catch(()=>0); }
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
        const hasIssues = (staged + unstaged + untracked) > 0 || unpushed > 0;
        if (hasIssues) {
          const msg = [
            '🔴 Still blocked by local changes.',
            staged ? `Staged: ${staged}` : undefined,
            unstaged ? `Unstaged: ${unstaged}` : undefined,
            untracked ? `Untracked: ${untracked}` : undefined,
            unpushed ? `Unpushed commits: ${unpushed}` : undefined,
            statusShort ? `\n\`\`\`\n${statusShort}\n\`\`\`` : undefined,
          ].filter(Boolean).join('\n');
          return await interaction.editReply({ content: msg });
        }
        // Clean now → open prefilled modal to quickly resume
        await interaction.editReply({ content: '🟢 Local repo is clean. Opening deployment modal to resume…' });
        return await openDeploymentsModal(interaction as any, env, { branch, repoPath, group });
      } catch (e) {
        return await interaction.reply({ content: `❌ Failed to resume: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    break;
    case 'deployenv':
      if (subAction === 'cancel') {
        try {
          const ownerId = parts[2];
          if (ownerId && ownerId !== interaction.user.id) {
            return await interaction.reply({ content: '❌ Only the requester can cancel.', flags: MessageFlags.Ephemeral });
          }
          return await interaction.update({ content: '❎ Canceled.', components: [] });
        } catch (e) {
          return await interaction.reply({ content: `❌ Failed to cancel: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
        }
      }
      break;
    case 'deploybranch':
      if (subAction === 'page') {
        try {
          // deploybranch_page_<prev|next>_<userId>
          const dir = parts[2];
          const ownerId = parts[3];
          if (ownerId && ownerId !== interaction.user.id) {
            return await interaction.reply({ content: '❌ Only the requester can page their list.', flags: MessageFlags.Ephemeral });
          }
          const state = await getDevBranchState(interaction, interaction.user.id);
          const nextPage = Math.max(1, (state.page || 1) + (dir === 'prev' ? -1 : 1));
          await setDevBranchState(interaction, interaction.user.id, { page: nextPage });
          const { components } = await rebuildDevBranchPickerComponents(interaction, interaction.user.id);
          return await interaction.update({ components });
        } catch (e) {
          return await interaction.reply({ content: `❌ Failed to change page: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
        }
      } else if (subAction === 'search') {
        try {
          // deploybranch_search_<userId>
          const ownerId = parts[2];
          if (ownerId && ownerId !== interaction.user.id) {
            return await interaction.reply({ content: '❌ Only the requester can search.', flags: MessageFlags.Ephemeral });
          }
          const modal = new ModalBuilder()
            .setCustomId(`deploybranch_search_modal_${interaction.user.id}`)
            .setTitle('Search branches');
          const input = new TextInputBuilder()
            .setCustomId('query')
            .setLabel('Filter')
            .setPlaceholder('e.g. feature checkout v2')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
          return await interaction.showModal(modal);
        } catch (e) {
          return await interaction.reply({ content: `❌ Failed to open search: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
        }
      } else if (subAction === 'refresh') {
        try {
          // deploybranch_refresh_<userId>
          const ownerId = parts[2];
          if (ownerId && ownerId !== interaction.user.id) {
            return await interaction.reply({ content: '❌ Only the requester can refresh.', flags: MessageFlags.Ephemeral });
          }
          await refreshDevBranchList(interaction, interaction.user.id);
          const { components } = await rebuildDevBranchPickerComponents(interaction, interaction.user.id);
          return await interaction.update({ components });
        } catch (e) {
          return await interaction.reply({ content: `❌ Failed to refresh: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
        }
      } else if (subAction === 'cancel') {
        try {
          const ownerId = parts[2];
          if (ownerId && ownerId !== interaction.user.id) {
            return await interaction.reply({ content: '❌ Only the requester can cancel.', flags: MessageFlags.Ephemeral });
          }
          return await interaction.update({ content: '❎ Canceled.', components: [] });
        } catch (e) {
          return await interaction.reply({ content: `❌ Failed to cancel: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
        }
      }
      break;
    case "deploynotes":
      if (subAction === "add") {
        await handleDeployNotesButton(interaction, threadId);
      }
      break;
    case "assign":
      if (subAction === "issue") {
        await handleAssignButton(interaction, threadId);
      }
      break;
    case "priority":
      if (subAction === "set") {
        await handlePriorityButton(interaction, threadId);
      }
      break;
    case "status":
      if (subAction === "change") {
        await handleStatusButton(interaction, threadId);
      }
      break;
    case "labels":
      if (subAction === "manage") {
        await handleLabelsButton(interaction, threadId);
      }
      break;
    case "comment":
      if (subAction === "add") {
        await handleCommentButton(interaction, threadId);
      }
      break;
    case "resolve":
      if (subAction === "issue") {
        await handleResolveButton(interaction, threadId);
      }
      break;
    case "wontdo":
      if (subAction === "issue") {
        await handleWontDoButton(interaction, threadId);
      }
      break;
    case "closeissue":
      await handleWontDoButton(interaction, threadId);
      break;
    case "close":
      if (subAction === "issue") {
        await handleCloseButton(interaction, threadId);
      }
      break;
    case "refresh":
      await handleRefreshButton(interaction, threadId);
      break;
    case "triage":
      await handleTriageButton(interaction, threadId);
      break;
    case "reopen":
      await handleReopenButton(interaction, threadId);
      break;
    case "create":
      if (subAction === "issue") {
        await handleCreateIssueButton(interaction);
      }
      break;
    case "delete":
      await handleDeleteButton(interaction, threadId);
      break;
    case "demo":
      const { handleDemoButtons } = await import(
        "./handlers/smartForumHandlers"
      );
      await handleDemoButtons(interaction);
      break;
    case "proceed":
    case "forum":
      // Handle forum-related buttons through ActionButtonManager
      const { actionButtonManager } = await import(
        "./framework/ActionButtonManager"
      );

      // Extract the base action ID for forum buttons (remove user ID suffix)
      let actionId = interaction.customId;
      if (actionId.startsWith("forum_") || actionId.startsWith("proceed_")) {
        const parts = actionId.split("_");
        if (parts.length > 2) {
          // For forum buttons like "forum_back_userId" -> "forum_back"
          // For proceed buttons like "proceed_type_forumId_userId" -> "proceed"
          actionId =
            parts[0] === "proceed" ? "proceed" : `${parts[0]}_${parts[1]}`;
        }
      }

      const actionsRef: any = (actionButtonManager as any).actions;
      // Support both Map and plain object for tests
      const getRegistered = (id: string) => {
        if (!actionsRef) return undefined;
        if (typeof actionsRef.get === "function") return actionsRef.get(id);
        return actionsRef[id];
      };
      const listActions = () => {
        try {
          if (typeof actionsRef?.keys === "function") {
            return Array.from(actionsRef.keys());
          }
          return Object.keys(actionsRef || {});
        } catch {
          return [] as string[];
        }
      };

      const registeredAction = getRegistered(actionId);

      try {
        console.log(
          `🔍 Button Debug: customId="${interaction.customId}", extracted actionId="${actionId}"`,
        );
        console.log(`🔍 Available actions: [${listActions().join(", ")}]`);
        console.log(`🔍 Action found: ${!!registeredAction}`);
      } catch {}

      if (registeredAction && registeredAction.handler) {
        await registeredAction.handler(interaction);
      } else {
      await interaction.reply({
        content: `❌ Unknown action: "${actionId}". Available: ${listActions().join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
      }
      break;
    case "sprint":
      if (subAction === "view") {
        await handleSprintViewButton(interaction);
      }
      break;
    case "team":
      if (subAction === "view") {
        await handleTeamViewButton(interaction);
      }
      break;
    case "jira":
      await handleJiraButton(interaction, subAction, threadId);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown action.",
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handleAssignButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  const modal = new ModalBuilder()
    .setCustomId(`assign_modal_${threadId}`)
    .setTitle("Assign Issue");

  const usernameInput = new TextInputBuilder()
    .setCustomId("github_username")
    .setLabel("GitHub Username")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter GitHub username to assign")
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    usernameInput,
  );
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

async function handleDeployNotesButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  const modal = new ModalBuilder()
    .setCustomId(`deploynotes_modal_${threadId}`)
    .setTitle('Add Deployment Notes');

  const notes = new TextInputBuilder()
    .setCustomId('notes_input')
    .setLabel('Notes / feedback / changelog')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(notes);
  modal.addComponents(row);
  await interaction.showModal(modal);
}

async function handlePriorityButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`priority_select_${threadId}`)
    .setPlaceholder("Select priority level")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("🔴 Critical")
        .setValue("critical")
        .setDescription("Urgent issues requiring immediate attention"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🟠 High")
        .setValue("high")
        .setDescription("Important issues to be addressed soon"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🟡 Medium")
        .setValue("medium")
        .setDescription("Standard priority issues"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🟢 Low")
        .setValue("low")
        .setDescription("Nice-to-have improvements"),
      new StringSelectMenuOptionBuilder()
        .setLabel("⚪ None")
        .setValue("none")
        .setDescription("Remove priority label"),
    );

  const actionRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: "Select the priority level:",
    components: [actionRow],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleStatusButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread?.number) {
    try { const gh = await (store as any).getGitHubNumber?.(threadId); if (gh && thread) (thread as any).number = gh as any; } catch {}
  }
  if (!thread?.number) {
    await interaction.reply({
      content: "❌ This thread is not linked to a GitHub issue.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`status_select_${threadId}`)
    .setPlaceholder("Select status action")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("🟢 Open")
        .setValue("open")
        .setDescription("Reopen the issue"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🔴 Close")
        .setValue("closed")
        .setDescription("Close the issue"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🔒 Lock")
        .setValue("lock")
        .setDescription("Lock the issue conversation"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🔓 Unlock")
        .setValue("unlock")
        .setDescription("Unlock the issue conversation"),
    );

  const actionRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: "Select the status action:",
    components: [actionRow],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleLabelsButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  const modal = new ModalBuilder()
    .setCustomId(`labels_modal_${threadId}`)
    .setTitle("Manage Labels");

  const labelsInput = new TextInputBuilder()
    .setCustomId("labels_input")
    .setLabel("Labels (comma-separated)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      "bug, enhancement, documentation\n\nPrefix with + to add, - to remove:\n+bug, -wontfix",
    )
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    labelsInput,
  );
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

async function handleCommentButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  const modal = new ModalBuilder()
    .setCustomId(`comment_modal_${threadId}`)
    .setTitle("Add Comment");

  const commentInput = new TextInputBuilder()
    .setCustomId("comment_text")
    .setLabel("Comment")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter your comment...")
    .setRequired(true)
    .setMaxLength(2000);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    commentInput,
  );
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

export async function handleCloseButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  let thread = store.threads.find((t) => t.id === threadId);
  if (!thread) {
    // Try both strategies: by ID first, then by channel; don't rely on ThreadChannel instanceof in tests
    const { ensureThreadInStoreFromChannel, ensureThreadInStoreById } = await import(
      "./utils/threadStore"
    );
    try { thread = await ensureThreadInStoreById(threadId); } catch {}
    if (!thread && interaction.channel) {
      try { thread = ensureThreadInStoreFromChannel(interaction.channel as any); } catch {}
    }
  }
  if (!thread) {
    await interaction.reply({
      content: "❌ Thread not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Best-effort resolution before failing
  if (!thread.number) {
    try {
      // Try auto-linking by scanning thread messages for URLs/#number
      const { resolveGitHubLinkage } = await import("../github/autoLinker");
      await resolveGitHubLinkage(thread);
      // Attempt repo binding regardless of resolve outcome
      await ensureThreadRepoBinding(thread);
    } catch {
      // ignore and fall through
    }

    if (!thread.number) {
      // Legacy fallback: old "close" button should act as "Resolve" (completed)
      if (!(interaction.deferred || interaction.replied)) {
        try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
      }
      const { closeAll } = await import("./closeActions");
      const channel = interaction.channel as ThreadChannel | null;
      const results = await closeAll(thread, "resolved", {
        channel: channel || undefined,
        userTag: (interaction as any)?.user?.tag,
      });
      await interaction.editReply({ content: results.join("\n") });
      return;
    }
  }

  // Ensure legacy threads have repo binding
  await ensureThreadRepoBinding(thread);

  try {
    if (!(interaction.deferred || interaction.replied)) {
      try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
    }

    // Get current issue state to toggle it
    const issueResponse = await octokit.rest.issues.get({
      ...getRepoCredentialsForThread(thread),
      issue_number: thread.number,
    });

    const currentState = issueResponse.data.state;
    const newState: "open" | "closed" = currentState === "open" ? "closed" : "open";

    // Update issue state
    await octokit.rest.issues.update({
      ...getRepoCredentialsForThread(thread),
      issue_number: thread.number,
      state: newState,
    });

    if (newState === "closed") {
      // Apply thread close presentation for closed issues
      const { closeAll } = await import("./closeActions");
      const channel = interaction.channel as ThreadChannel | null;
      await closeAll(thread, "resolved", {
        channel: channel || undefined,
        userTag: (interaction as any)?.user?.tag,
      });

      await interaction.editReply({
        content: "✅ Issue closed successfully.",
      });
    } else {
      await interaction.editReply({
        content: "✅ Issue reopened successfully.",
      });
    }

    // Refresh the embed
    await handleRefreshButton(interaction, threadId, false);

    logger.info(
      `Issue #${thread.number} ${newState} by ${interaction.user.tag}`,
    );
  } catch (error: any) {
    // Provide clearer diagnostics for common failure modes
    const status = error?.status;
    const message = error instanceof Error ? error.message : String(error);

    logger.error(
      `Failed to update issue state (issue #${thread?.number}) [status=${status}]: ${message}`,
    );

    if (status === 404 || /not found/i.test(message)) {
      await interaction.editReply({
        content: `❌ GitHub issue #${thread?.number} not found in ${repoCredentials.owner}/${repoCredentials.repo}. The link may be stale or the repo is misconfigured. Try refreshing the embed or verify the repository settings.`,
      });
    } else if (status === 403) {
      await interaction.editReply({
        content:
          "❌ Permission denied when updating the issue. Check the GitHub token scopes (repo) and repository access.",
      });
    } else {
      await interaction.editReply({
        content: "❌ Failed to update issue state.",
      });
    }
  }
}

export async function handleRefreshButton(
  interaction: ButtonInteraction,
  threadId: string,
  reply: boolean = true,
) {
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread?.number) {
    try {
      const gh = await store.getGitHubNumber(threadId);
      if (gh && thread) (thread as any).number = gh as any;
    } catch {}
  }
  if (!thread?.number) {
    if (reply) {
      await interaction.reply({
        content: "❌ This thread is not linked to a GitHub issue.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  try {
    if (reply) {
      try { await interaction.deferUpdate(); } catch {}
    }

    // Fetch latest issue data
    const issue = await octokit.rest.issues.get({
      ...getRepoCredentialsForThread(thread),
      issue_number: thread.number,
    });

    const metadata: IssueMetadata = {
      number: issue.data.number,
      state: issue.data.state as "open" | "closed",
      assignees: issue.data.assignees?.map((a) => ({
        login: a.login,
        avatar_url: a.avatar_url,
      })),
      labels: issue.data.labels?.map((l) => ({
        name: typeof l === "string" ? l : l.name || "",
        color: typeof l === "string" ? "cccccc" : l.color || "cccccc",
      })),
      milestone: issue.data.milestone
        ? {
            title: issue.data.milestone.title,
            due_on: issue.data.milestone.due_on || undefined,
          }
        : undefined,
      created_at: issue.data.created_at,
      updated_at: issue.data.updated_at,
      comments: issue.data.comments,
      reactions: issue.data.reactions,
      priority: extractPriorityFromLabels(issue.data.labels),
    };

    const smartEmbed = createSmartIssueEmbed(thread, metadata);

    await interaction.editReply({
      embeds: smartEmbed.embeds,
      components: smartEmbed.components,
    });

    const userTag = (interaction as any)?.user?.tag ?? null;
    logger.info(`Issue #${thread.number} refreshed by ${userTag}`);
  } catch (error) {
    logger.error(`Failed to refresh issue: ${error}`);
    if (reply) {
      await interaction.editReply({
        content: "❌ Failed to refresh issue data.",
      });
    }
  }
}

// Dashboard button handlers
async function handleCreateIssueButton(interaction: ButtonInteraction) {
  await interaction.reply({
    content: "Use `/bug-report` or `/feature-request` to create new issues!",
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSprintViewButton(interaction: ButtonInteraction) {
  await interaction.reply({
    content:
      "🏃 Sprint view coming soon! Use `/dashboard view:sprint` for now.",
    flags: MessageFlags.Ephemeral,
  });
}

async function handleTeamViewButton(interaction: ButtonInteraction) {
  await interaction.reply({
    content: "👥 Team view coming soon! Use `/dashboard view:team` for now.",
    flags: MessageFlags.Ephemeral,
  });
}

// removed unused handleRefreshDashboardButton to satisfy linter

async function handleJiraButton(
  interaction: ButtonInteraction,
  subAction: string,
  threadId: string,
) {
  // Allow provider UI whenever Jira is enabled
  try {
    const { isProviderEnabled } = await import('../pm/provider');
    if (!isProviderEnabled('jira')) {
      await interaction.reply({ content: `❌ Provider UI is not enabled.`, flags: MessageFlags.Ephemeral });
      return;
    }
  } catch {}
  if (!jiraService.isConfigured()) {
      await interaction.reply({
        content: `❌ PM providers are not configured.`,
        flags: MessageFlags.Ephemeral,
      });
    return;
  }

  let thread = store.threads.find((t) => t.id === threadId);
  if (!thread) {
    if (interaction.channel) {
      const { ensureThreadInStoreFromChannel } = await import(
        "./utils/threadStore"
      );
      thread = ensureThreadInStoreFromChannel(
        interaction.channel as any,
      );
    } else {
      const { ensureThreadInStoreById } = await import("./utils/threadStore");
      thread = await ensureThreadInStoreById(threadId);
    }
  }
  if (!thread) {
    await interaction.reply({
      content: "❌ Thread not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (subAction) {
    case "create":
      await handleJiraCreateButton(interaction, thread);
      break;
    case "link":
      await handleJiraLinkButton(interaction, thread);
      break;
    case "transition":
      await handleJiraTransitionButton(interaction, thread);
      break;
    case "assign":
      await handleJiraAssignButton(interaction, thread);
      break;
    default:
      await interaction.reply({
        content: `❌ Unknown provider action.`,
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handleJiraCreateButton(
  interaction: ButtonInteraction,
  thread: any,
) {
  const modal = new ModalBuilder()
    .setCustomId(`jira_create_modal_${thread.id}`)
    .setTitle(`Create Items (Enabled Providers)`);

  const issueTypeInput = new TextInputBuilder()
    .setCustomId("issue_type")
    .setLabel("Issue Type")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Bug, Story, Task, Epic, etc.")
    .setValue("Task")
    .setRequired(true);

  const priorityInput = new TextInputBuilder()
    .setCustomId("priority")
    .setLabel("Priority")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Critical, High, Medium, Low")
    .setValue("Medium")
    .setRequired(false);

  const actionRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(
    issueTypeInput,
  );
  const actionRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(
    priorityInput,
  );

  modal.addComponents(actionRow1, actionRow2);
  await interaction.showModal(modal);
}

async function handleJiraLinkButton(
  interaction: ButtonInteraction,
  thread: any,
) {
  const modal = new ModalBuilder()
    .setCustomId(`jira_link_modal_${thread.id}`)
    .setTitle(`Link to Existing Provider Item`);

  const prov = await import('../pm/provider');
  const isJira = (prov as any).isProviderEnabled ? prov.isProviderEnabled('jira') : prov.getPMProvider() === 'jira';
  const issueKeyInput = new TextInputBuilder()
    .setCustomId("issue_key")
    .setLabel(isJira ? 'Issue Number/Key (e.g., ASRE-123)' : 'Provider Key or URL (optional)') 
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(isJira ? 'e.g., ASRE-123' : 'Identifier or URL')
    .setRequired(false);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    issueKeyInput,
  );
  modal.addComponents(actionRow);
  await interaction.showModal(modal);
}

async function handleJiraTransitionButton(
  interaction: ButtonInteraction,
  thread: any,
) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Gather provider links for this thread; include Jira fallback if present
    const all = (store as any).getAllProviderLinks?.() || [];
    let links: any[] = Array.isArray(all) ? all.filter((l: any) => l.threadId === thread.id) : [];
    if (thread.jiraKey && !links.some((l: any) => String(l.provider).toLowerCase() === 'jira')) {
      links = links.concat([{ provider: 'jira', key: thread.jiraKey }]);
    }
    if (links.length === 0) {
      await interaction.editReply({ content: '❌ No linked provider items for this thread.' });
      return;
    }

    // Fetch transitions per provider
    const { facadeGetTransitionsForProvider } = await import('../pm/facade');
    const provideOptions: Array<{ label: string; value: string; description: string }> = [];
    for (const l of links) {
      let trans: Array<{ id: string; name: string }> = [];
      try { trans = await facadeGetTransitionsForProvider(String(l.provider), l.key); } catch {}
      for (const t of trans) {
        const label = `${String(l.provider).toLowerCase() === 'github_projects' ? 'GitHub Projects' : String(l.provider)[0].toUpperCase() + String(l.provider).slice(1)}: ${t.name}`;
        const value = `${l.provider}|${t.name}`;
        provideOptions.push({ label, value, description: `Transition ${l.key} → ${t.name}` });
      }
    }

    if (provideOptions.length === 0) {
      await interaction.editReply({ content: '❌ No transitions available for linked providers.' });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`prov_transition_select_${thread.id}`)
      .setPlaceholder('Select a transition (provider: name)')
      .setMinValues(1)
      .setMaxValues(Math.min(10, provideOptions.length))
      .addOptions(
        provideOptions.map((o) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(o.label)
            .setValue(o.value)
            .setDescription(o.description),
        ),
      );

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({
      content: `🔄 Select a transition for linked provider items:`,
      components: [actionRow],
    });
  } catch (error) {
    logger.error(`Failed to get transitions: ${error}`);
    await interaction.editReply({ content: '❌ Failed to get available transitions.' });
  }
}

async function handleJiraAssignButton(
  interaction: ButtonInteraction,
  thread: any,
) {
  if (!thread.jiraKey) {
    await interaction.reply({
      content: `❌ This thread has no linked PM item.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`jira_assign_modal_${thread.id}`)
    .setTitle(`Assign PM Item`);

  const assigneeInput = new TextInputBuilder()
    .setCustomId("assignee_id")
    .setLabel("Assignee (email/login/id)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("user@example.com")
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    assigneeInput,
  );
  modal.addComponents(actionRow);
  await interaction.showModal(modal);
}

export function extractPriorityFromLabels(labels: any[]): string | undefined {
  if (!labels) return undefined;

  const priorityLabel = labels.find((label) => {
    const name = typeof label === "string" ? label : label.name;
    return name?.toLowerCase().includes("priority:");
  });

  if (priorityLabel) {
    const name =
      typeof priorityLabel === "string" ? priorityLabel : priorityLabel.name;
    return name?.split(":")[1]?.toLowerCase();
  }
}

async function handleTriageButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  try {
    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) {
      await interaction.reply({ content: "❌ Thread not found.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!thread.number) {
      await interaction.reply({ content: "❌ No linked GitHub issue.", flags: MessageFlags.Ephemeral });
      return;
    }

    await ensureThreadRepoBinding(thread);
    const rc = getRepoCredentialsForThread(thread);

    // Apply standard triage labels: bug + needs-triage (idempotent)
    await octokit.rest.issues.addLabels({
      owner: rc.owner,
      repo: rc.repo,
      issue_number: thread.number,
      labels: ["bug", "needs-triage"],
    } as any);

    // Leave a triage comment
    await octokit.rest.issues.createComment({
      owner: rc.owner,
      repo: rc.repo,
      issue_number: thread.number,
      body: `🔎 Triage requested by ${interaction.user.tag}.`,
    });

    // Refresh embed
    const issue = await octokit.rest.issues.get({ owner: rc.owner, repo: rc.repo, issue_number: thread.number });
    const metadata: IssueMetadata = {
      number: issue.data.number,
      state: issue.data.state as any,
      assignees: issue.data.assignees?.map((a) => ({ login: a.login, avatar_url: a.avatar_url })),
      labels: issue.data.labels?.map((l: any) => ({ name: typeof l === 'string' ? l : l.name || '', color: typeof l === 'string' ? 'cccccc' : l.color || 'cccccc' })),
      milestone: issue.data.milestone ? { title: issue.data.milestone.title, due_on: issue.data.milestone.due_on || undefined } : undefined,
      created_at: issue.data.created_at,
      updated_at: issue.data.updated_at,
      comments: issue.data.comments,
      reactions: issue.data.reactions as any,
      priority: extractPriorityFromLabels(issue.data.labels as any[]),
    };
    const smartEmbed = createSmartIssueEmbed(thread, metadata);
    await interaction.editReply({ embeds: smartEmbed.embeds, components: smartEmbed.components });

    logger.info(`Issue #${thread.number} triaged by ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Failed to triage issue: ${error}`);
    try {
      await interaction.editReply({ content: "❌ Failed to triage issue." });
    } catch {}
  }
}

async function handleResolveButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  // Require a resolution comment via modal
  const modal = new ModalBuilder()
    .setCustomId(`resolve_modal_${threadId}`)
    .setTitle("Resolve Issue");
  const input = new TextInputBuilder()
    .setCustomId("resolution_comment")
    .setLabel("Resolution comment (required)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);
  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  modal.addComponents(row);
  await interaction.showModal(modal);
}

async function handleWontDoButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  // Optional comment modal (can be skipped by closing modal)
  const modal = new ModalBuilder()
    .setCustomId(`wontdo_modal_${threadId}`)
    .setTitle("Close Issue");
  const input = new TextInputBuilder()
    .setCustomId("wontdo_comment")
    .setLabel("Optional comment")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(2000);
  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  modal.addComponents(row);
  await interaction.showModal(modal);
}

async function handleDeleteButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  // Require confirmation via modal
  const modal = new ModalBuilder()
    .setCustomId(`delete_modal_${threadId}`)
    .setTitle("⚠️ Delete Issue - Confirmation Required");
  const input = new TextInputBuilder()
    .setCustomId("delete_confirmation")
    .setLabel('Type "DELETE" to confirm (case-sensitive)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10)
    .setPlaceholder("DELETE");
  const reasonInput = new TextInputBuilder()
    .setCustomId("delete_reason")
    .setLabel("Reason for deletion (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);
  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  modal.addComponents(row1, row2);
  await interaction.showModal(modal);
}

async function handleReopenButton(
  interaction: ButtonInteraction,
  threadId: string,
) {
  if (!(interaction.deferred || interaction.replied)) {
    try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
  }
  // Ensure thread in store
  let thread = store.threads.find((t) => t.id === threadId);
  if (!thread) {
    if (interaction.channel) {
      const { ensureThreadInStoreFromChannel } = await import(
        "./utils/threadStore"
      );
      thread = ensureThreadInStoreFromChannel(
        interaction.channel as any,
      );
    } else {
      const { ensureThreadInStoreById } = await import(
        "./utils/threadStore"
      );
      thread = await ensureThreadInStoreById(threadId);
    }
  }
  if (!thread) {
    await interaction.editReply({
      content: "❌ Thread not found.",
    });
    return;
  }
  const { reopenAll } = await import("./closeActions");
  const results = await reopenAll(thread, {
    channel: interaction.channel as ThreadChannel,
  });
  await interaction.editReply({ content: results.join("\n") });
}
