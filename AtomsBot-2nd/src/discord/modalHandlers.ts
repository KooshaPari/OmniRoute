import { ModalSubmitInteraction, MessageFlags, ThreadChannel } from "discord.js";
// Use the re-exported store to make test module mocks ("../../store") take effect
// Use legacy store path to match test mocks
import { store } from "../store";
import { ensureThreadInStoreById, ensureThreadInStoreFromChannel } from "./utils/threadStore";
import { octokit, getRepoCredentialsForThread } from "../github/githubActions";
import { jiraService } from "../jira/jiraClient";
import { logger } from "../logger";

/**
 * Find the best available "Done/Complete" transition from available transitions
 */
function _findDoneTransition(transitions: Array<{ id: string; name: string }>) {
  console.log(`🔍 Looking for Done transition among: ${transitions.map(t => `"${t.name}"`).join(', ')}`);
  
  // Priority order for "Done" equivalent transitions
  const donePatterns = [
    { pattern: /^done$/i, name: "Done exact match" },
    { pattern: /^complete$/i, name: "Complete exact match" },
    { pattern: /^completed$/i, name: "Completed exact match" },
    { pattern: /^resolve$/i, name: "Resolve exact match" },
    { pattern: /^resolved$/i, name: "Resolved exact match" },
    { pattern: /^finish$/i, name: "Finish exact match" },
    { pattern: /^finished$/i, name: "Finished exact match" },
    { pattern: /^close$/i, name: "Close exact match" },
    { pattern: /^closed$/i, name: "Closed exact match" },
    { pattern: /done/i, name: "Done partial match" },
    { pattern: /complete/i, name: "Complete partial match" },
    { pattern: /resolve/i, name: "Resolve partial match" },
    { pattern: /finish/i, name: "Finish partial match" },
    { pattern: /close/i, name: "Close partial match" },
  ];

  for (const { pattern, name } of donePatterns) {
    const transition = transitions.find(t => pattern.test(t.name));
    if (transition) {
      console.log(`✅ Found Done transition: "${transition.name}" via ${name}`);
      return transition;
    }
  }
  
  console.log(`❌ No Done transition found in available transitions`);
  return null;
}

function providerLabel(id: string): string {
  const v = String(id || '').toLowerCase();
  if (v === 'jira') return 'Jira';
  if (v === 'linear') return 'Linear';
  if (v === 'github_projects') return 'GitHub Projects';
  if (v === 'coda') return 'Coda';
  if (v === 'atoms') return 'Atoms';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * Find the best available "Won't Do/Declined" transition from available transitions
 */
function _findWontDoTransition(transitions: Array<{ id: string; name: string }>) {
  console.log(`🔍 Looking for Won't Do transition among: ${transitions.map(t => `"${t.name}"`).join(', ')}`);
  
  // Priority order for "Won't Do" equivalent transitions
  const wontDoPatterns = [
    { pattern: /^won'?t\s*do$/i, name: "Won't Do exact match" },
    { pattern: /^declined?$/i, name: "Decline exact match" },
    { pattern: /^reject(ed)?$/i, name: "Reject exact match" },
    { pattern: /^cancel(l?ed)?$/i, name: "Cancel exact match" },
    { pattern: /^abandon(ed)?$/i, name: "Abandon exact match" },
    { pattern: /^close$/i, name: "Close exact match" },
    { pattern: /^closed$/i, name: "Closed exact match" },
    { pattern: /^to\s*do$/i, name: "To Do (revert to backlog)" },
    { pattern: /^backlog$/i, name: "Backlog (revert)" },
    { pattern: /won'?t\s*do/i, name: "Won't Do partial match" },
    { pattern: /decline/i, name: "Decline partial match" },
    { pattern: /reject/i, name: "Reject partial match" },
    { pattern: /cancel/i, name: "Cancel partial match" },
    { pattern: /abandon/i, name: "Abandon partial match" },
    { pattern: /close/i, name: "Close partial match" },
  ];

  for (const { pattern, name } of wontDoPatterns) {
    const transition = transitions.find(t => pattern.test(t.name));
    if (transition) {
      console.log(`✅ Found Won't Do transition: "${transition.name}" via ${name}`);
      return transition;
    }
  }
  
  console.log(`❌ No Won't Do transition found in available transitions`);
  return null;
}

async function lockAndArchive(interaction: ModalSubmitInteraction) {
  try {
    const ch = interaction.channel as ThreadChannel | null;
    if (ch) {
      if (!ch.locked) await ch.setLocked(true, "Closed via modal");
      if (!ch.archived) await ch.setArchived(true, "Closed via modal");
    }
  } catch (e) {
    logger.warn(`Failed to lock/archive thread: ${e}`);
  }
}

export async function handleResolveModal(
  interaction: ModalSubmitInteraction,
  threadId: string,
  comment: string,
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Ensure thread in store
  let thread = store.threads.find((t) => t.id === threadId);
  if (!thread) {
    if ((interaction as any).channel) {
      thread = ensureThreadInStoreFromChannel((interaction as any).channel as any);
    } else {
      thread = (await ensureThreadInStoreById(threadId)) as any;
    }
  }
  if (!thread) {
    await interaction.editReply({ content: "❌ Thread not found." });
    return;
  }

  const results: string[] = [];

  // Post resolution comment to GH - check both thread.number and stored mapping
  const linkMapping = (store as any).getJiraLinkMapping?.(threadId) || (store as any).getJiraLinkMappingCompat?.(threadId);
  const githubNumber = thread.number || linkMapping?.githubNumber;
  
  if (githubNumber) {
    try {
      const rc = getRepoCredentialsForThread(thread);
      await octokit.rest.issues.createComment({ owner: rc.owner, repo: rc.repo, issue_number: githubNumber, body: `✅ Resolve: ${comment}` });
      await octokit.rest.issues.update({ owner: rc.owner, repo: rc.repo, issue_number: githubNumber, state: "closed", state_reason: "completed" as any });
      results.push("GitHub: ✅ closed (completed)");
    } catch (e: any) {
      results.push(`GitHub: ❌ ${e?.message || e}`);
    }
  } else {
    results.push("GitHub: — not linked");
  }

  // Providers: operate on all linked providers (enabled), fallback to jiraKey if present
  try {
    const all = (store as any).getAllProviderLinks?.() || [];
    let mine: any[] = Array.isArray(all) ? all.filter((l: any) => l.threadId === thread.id) : [];
    const jiraKey = thread.jiraKey || linkMapping?.jiraKey;
    const hasJiraLink = mine.some((l: any) => String(l.provider).toLowerCase() === 'jira');
    if (jiraKey && !hasJiraLink) {
      mine = mine.concat([{ provider: 'jira', key: jiraKey }]);
    }
    if (mine.length > 0) {
      const { facadeAddCommentFormatted, facadeTransition } = await import('../pm/facade');
      for (const l of mine) {
        const label = providerLabel(l.provider);
        let commented = false;
        try { if (comment) { await facadeAddCommentFormatted(l.key, `✅ Resolve: ${comment}`, (interaction as any)?.user?.tag); commented = true; } } catch {}
        try { await facadeTransition(l.key, 'Done'); } catch {}
        results.push(`${label}: ${commented ? '💬 noted; ' : ''}🔀 attempted transition (Done)`);
      }
    } else {
      results.push(`Providers: — not linked`);
    }
  } catch (e: any) {
    results.push(`Providers: ❌ ${e?.message || e}`);
  }

  await lockAndArchive(interaction);
  results.push("Discord: ✅ locked & archived");

  await interaction.editReply({ content: results.join("\n") });
}

export async function handleWontDoModal(
  interaction: ModalSubmitInteraction,
  threadId: string,
  comment?: string,
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Ensure thread in store
  let thread = store.threads.find((t) => t.id === threadId);
  if (!thread) {
    if ((interaction as any).channel) {
      thread = ensureThreadInStoreFromChannel((interaction as any).channel as any);
    } else {
      thread = (await ensureThreadInStoreById(threadId)) as any;
    }
  }
  if (!thread) {
    await interaction.editReply({ content: "❌ Thread not found." });
    return;
  }

  const results: string[] = [];

  // Optional comment to GH then close with not_planned - check both thread.number and stored mapping
  const linkMapping2 = (store as any).getJiraLinkMapping?.(threadId) || (store as any).getJiraLinkMappingCompat?.(threadId);
  const githubNumber2 = thread.number || linkMapping2?.githubNumber;
  
  if (githubNumber2) {
    try {
      const rc = getRepoCredentialsForThread(thread);
      if (comment) {
        await octokit.rest.issues.createComment({ owner: rc.owner, repo: rc.repo, issue_number: githubNumber2, body: `🚫 Won't Do: ${comment}` });
      }
      await octokit.rest.issues.update({ owner: rc.owner, repo: rc.repo, issue_number: githubNumber2, state: "closed", state_reason: "not_planned" as any });
      results.push("GitHub: ✅ closed (not_planned)");
    } catch (e: any) {
      results.push(`GitHub: ❌ ${e?.message || e}`);
    }
  } else {
    results.push("GitHub: — not linked");
  }

  // Providers: operate on all linked providers (enabled), fallback to jiraKey if present
  try {
    const all = (store as any).getAllProviderLinks?.() || [];
    let mine: any[] = Array.isArray(all) ? all.filter((l: any) => l.threadId === thread.id) : [];
    const jiraKey = thread.jiraKey || linkMapping2?.jiraKey;
    const hasJiraLink = mine.some((l: any) => String(l.provider).toLowerCase() === 'jira');
    if (jiraKey && !hasJiraLink) {
      mine = mine.concat([{ provider: 'jira', key: jiraKey }]);
    }
    if (mine.length > 0) {
      const { facadeAddCommentFormatted, facadeTransition } = await import('../pm/facade');
      for (const l of mine) {
        const label = providerLabel(l.provider);
        let commented = false;
        try { if (comment) { await facadeAddCommentFormatted(l.key, `🚫 Close: ${comment}`, (interaction as any)?.user?.tag); commented = true; } } catch {}
        try { await facadeTransition(l.key, "Won't Do"); } catch {}
        results.push(`${label}: ${commented ? '💬 noted; ' : ''}🔀 attempted transition (Won't Do)`);
      }
    } else {
      results.push(`Providers: — not linked`);
    }
  } catch (e: any) {
    results.push(`Providers: ❌ ${e?.message || e}`);
  }

  await lockAndArchive(interaction);
  results.push("Discord: ✅ locked & archived");

  await interaction.editReply({ content: results.join("\n") });
}

// Re-export deletion handler for test compatibility
export { handleDeleteModal } from "./deleteModalHandler";
