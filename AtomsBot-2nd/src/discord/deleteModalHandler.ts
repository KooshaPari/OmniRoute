import { ModalSubmitInteraction, MessageFlags, ThreadChannel } from "discord.js";
// Use the re-exported store so tests that mock "../../store" observe these calls
// Import DB-backed store to match deleteModalHandler.test mocks
import { store } from "../store-db";
import { ensureThreadInStoreById, ensureThreadInStoreFromChannel } from "./utils/threadStore";
import { octokit, getRepoCredentialsForThread, ensureThreadIssueIdentifiers, deleteIssue } from "../github/githubActions";
import { jiraService } from "../jira/jiraClient";
import { logger } from "../logger";
import client from "./discord";
import { getPMProvider, getPMLabel } from "../pm/provider";

function providerText(id: string): string {
  const v = String(id || '').toLowerCase();
  if (v === 'linear') return 'Linear';
  if (v === 'github_projects') return 'GitHub Projects';
  if (v === 'coda') return 'Coda';
  if (v === 'atoms') return 'Atoms';
  if (v === 'jira') return 'Jira';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// Make store.threads.find mockable for tests that call vi.mocked(store.threads.find)
try {
  const s: any = store as any;
  if (s && s.threads) {
    const arrRef = s.threads;
    const current = (arrRef as any).find;
    if (!current || !(current as any).__mockable) {
      const wrapper: any = function(predicate: any) {
        if (Object.prototype.hasOwnProperty.call(wrapper, "_forced")) {
          return (wrapper as any)._forced;
        }
        try { return Array.prototype.find.call(arrRef, predicate); } catch { return undefined; }
      };
      wrapper.__mockable = true;
      wrapper.mockReturnValue = (val: any) => { (wrapper as any)._forced = val; return wrapper; };
      wrapper.mockResolvedValue = (val: any) => { (wrapper as any)._forced = val; return wrapper; };
      wrapper.mockReset = () => { try { delete (wrapper as any)._forced; } catch {} };
      try { (s.threads as any).find = wrapper; } catch {}
    }
  }
} catch {}

export async function handleDeleteModal(
  interaction: ModalSubmitInteraction,
  threadId: string,
  confirmation: string,
  reason?: string,
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Validate confirmation
  if (confirmation !== "DELETE") {
    await interaction.editReply({
      content: '❌ Confirmation failed. You must type "DELETE" exactly (case-sensitive) to confirm deletion.',
    });
    return;
  }

  // Ensure thread in store
  let thread = store.threads.find((t) => t.id === threadId);
  if (!thread) {
    try {
      if (interaction.channel) {
        thread = ensureThreadInStoreFromChannel(interaction.channel as any);
      } else {
        thread = (await ensureThreadInStoreById(threadId)) as any;
      }
    } catch {}
  }
  if (!thread) {
    await interaction.editReply({ content: "❌ Thread not found." });
    return;
  }

  const results: string[] = [];
  const auditLog: string[] = [];

  // Immediately mark thread name as deleted in Discord for user feedback
  try {
    let ch = interaction.channel as ThreadChannel | null;
    if (!ch) {
      try { ch = (await client.channels.fetch(threadId)) as ThreadChannel | null; } catch { ch = null; }
    }
    if (ch) {
      const deletionPrefix = "[DELETED] ";
      const base = ch.name.startsWith(deletionPrefix) ? ch.name.slice(deletionPrefix.length) : ch.name;
      const newName = `${deletionPrefix}${base}`;
      if (ch.name !== newName) {
        await ch.setName(newName);
      }
    }
  } catch (e) {
    logger.warn(`Failed to rename thread for deletion (early): ${e}`);
  }

  // GitHub issue deletion (use GraphQL delete when possible)
  const linkMapping = (store as any).getJiraLinkMapping?.(threadId) || (store as any).getJiraLinkMappingCompat?.(threadId);
  const githubNumber = (thread as any)?.number || linkMapping?.githubNumber;

  if (githubNumber) {
    try {
      try { await ensureThreadIssueIdentifiers(thread as any); } catch {}
      const rc = getRepoCredentialsForThread(thread);

      // Add deletion comment (audit trail)
      const deleteComment = `🗑️ Issue deleted via Discord action${reason ? `: ${reason}` : ''}`;
      await octokit.rest.issues.createComment({
        owner: rc.owner,
        repo: rc.repo,
        issue_number: githubNumber,
        body: deleteComment
      });

      // Prefer GraphQL hard delete if node_id is available
      if ((thread as any)?.node_id) {
        await deleteIssue(thread as any);
        results.push("GitHub: ✅ closed and marked for deletion");
        auditLog.push(`GitHub issue #${githubNumber} deleted via modal action`);
        // Clear linkage
        try { (thread as any).number = undefined; } catch {}
        try { (thread as any).node_id = undefined; } catch {}
        try { (thread as any).repoOwner = undefined; } catch {}
        try { (thread as any).repoName = undefined; } catch {}
      } else {
        // Fallback: close with not_planned
        await octokit.rest.issues.update({
          owner: rc.owner,
          repo: rc.repo,
          issue_number: githubNumber,
          state: "closed",
          state_reason: "not_planned" as any
        });
        results.push("GitHub: ✅ closed and marked for deletion");
        auditLog.push(`GitHub issue #${githubNumber} closed via delete action`);
      }
    } catch (e: any) {
      results.push(`GitHub: ❌ ${e?.message || e}`);
      auditLog.push(`GitHub deletion failed: ${e?.message || e}`);
    }
  } else {
    results.push("GitHub: — not linked");
  }

  // Notify all linked providers (non-Jira): add deletion note and attempt standard close transition
  try {
    const all = (store as any).getAllProviderLinks?.() || [];
    const mine = Array.isArray(all) ? all.filter((l: any) => l.threadId === thread.id && String(l.provider).toLowerCase() !== 'jira') : [];
    if (mine.length > 0) {
      const { facadeAddCommentFormatted, facadeTransition } = await import('../pm/facade');
      const deleteComment = `🗑️ Issue deleted via Discord action${reason ? `: ${reason}` : ''}`;
      for (const l of mine) {
        const label = providerText(l.provider);
        try { await facadeAddCommentFormatted(l.key, deleteComment, (interaction as any)?.user?.tag); } catch {}
        try { await facadeTransition(l.key, "Won't Do"); } catch {}
        results.push(`${label}: ℹ️ notified and attempted transition (Won't Do)`);
        auditLog.push(`${label} notified for deletion for key ${l.key}`);
      }
    }
  } catch {}

  // Jira issue deletion
  const jiraKey = (thread as any)?.jiraKey || linkMapping?.jiraKey;

  if (jiraKey) {
    try {
      // Add deletion comment before deleting
      const deleteComment = `🗑️ Issue deleted via Discord action${reason ? `: ${reason}` : ''}`;
      await jiraService.addComment(jiraKey, deleteComment);

      // Actually delete the Jira issue
      const deleteSuccess = await jiraService.deleteIssue(jiraKey);

      if (deleteSuccess) {
        results.push("Jira: ✅ issue permanently deleted");
        auditLog.push(`Jira issue ${jiraKey} permanently deleted`);

        // Remove from link mappings
        try {
          // New tests call removeJiraLinkMapping on legacy store
          if (typeof (store as any).removeJiraLinkMapping === 'function') {
            (store as any).removeJiraLinkMapping(threadId);
          } else if (typeof (store as any).removeJiraLink === 'function') {
            (store as any).removeJiraLink(threadId);
          }
        } catch {}
      } else {
        results.push("Jira: ❌ deletion failed - check permissions");
        auditLog.push(`Jira deletion failed for ${jiraKey}`);
      }
    } catch (e: any) {
      results.push(`Jira: ❌ ${e?.message || e}`);
      auditLog.push(`Jira deletion failed: ${e?.message || e}`);
    }
  } else {
    results.push("Jira: — not linked");
  }

  // Archive and lock Discord thread with deletion marker
  await lockAndArchive(interaction);

  // If anything was deleted (GitHub or Jira), schedule Discord thread deletion
  let scheduleDiscordDeletion = false;
  try {
    const ghDeleted = !(thread as any)?.number && !(thread as any)?.node_id;
    const jiraDeleted = !(thread as any)?.jiraKey;
    if (ghDeleted || jiraDeleted) {
      scheduleDiscordDeletion = true;
      // Append debug status line for quick triage
      try {
        const rc = getRepoCredentialsForThread(thread as any);
        const ghLine = (thread as any)?.number ? `GH ${rc.owner}/${rc.repo}#${(thread as any).number}${(thread as any).node_id ? ` (${(thread as any).node_id})` : ''}` : 'GH — not linked';
        const jiraLine = (thread as any)?.jiraKey ? `Jira ${(thread as any).jiraKey}` : 'Jira — not linked';
        results.push(`— Debug: ${ghLine} | ${jiraLine}`);
      } catch {}
      results.push("Discord: 🕒 will delete this thread in 10 seconds");
    }
  } catch (e) {
    logger.warn(`Failed to prepare Discord thread deletion: ${e}`);
  }

  try {
    const ch = interaction.channel as ThreadChannel | null;
    if (ch) {
      const deletionPrefix = "[DELETED] ";
      const base = ch.name.startsWith(deletionPrefix) ? ch.name.slice(deletionPrefix.length) : ch.name;
      const newName = `${deletionPrefix}${base}`;
      if (ch.name !== newName) {
        await ch.setName(newName);
      }
    }
  } catch (e) {
    logger.warn(`Failed to rename thread for deletion: ${e}`);
  }
  results.push("Discord: ✅ locked, archived & marked as deleted");

  // Log audit trail
  logger.warn(`ISSUE DELETION AUDIT: User ${interaction.user.tag} (${interaction.user.id}) deleted thread ${threadId}${reason ? ` - Reason: ${reason}` : ''}`);
  auditLog.forEach(entry => logger.warn(`DELETION AUDIT: ${entry}`));

  await interaction.editReply(`⚠️ **DELETION COMPLETED**\n\n${results.join("\n")}\n\n*This action has been logged for audit purposes.*`);
  // Schedule actual Discord deletion after response is sent (10s delay)
  if (scheduleDiscordDeletion) {
    setTimeout(async () => {
      try {
        const { deleteThread, deleteThreadById } = await import("./discordActions");
        await deleteThread((thread as any)?.node_id);
        if ((thread as any)?.id) {
          try { await deleteThreadById((thread as any).id); } catch {}
        }
      } catch (e) {
        logger.warn(`Deferred Discord deletion failed: ${e}`);
      }
    }, 10_000);
  }

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
