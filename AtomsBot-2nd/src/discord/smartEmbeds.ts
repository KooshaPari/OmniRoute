import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Thread } from "../interfaces";
import { getRepoCredentialsForThread } from "../github/githubActions";
import type { JiraIssue } from "../jira/jiraClient";
import { getPMEmoji, getEnabledProviderDisplay, getProviderLabelFor } from "../pm/provider";
import { facadeGetIssue } from "../pm/facade";

export interface IssueMetadata {
  // GitHub data
  number?: number;
  state?: "open" | "closed";
  assignees?: Array<{ login: string; avatar_url: string }>;
  labels?: Array<{ name: string; color: string }>;
  milestone?: { title: string; due_on?: string };
  created_at?: string;
  updated_at?: string;
  comments?: number;
  reactions?: { total_count: number };
  priority?: string;
  complexity?: number;
  sprint?: string;

  // Jira data
  jiraIssue?: JiraIssue;
  jiraKey?: string;
  jiraStatus?: string;
  jiraPriority?: string;
  jiraAssignee?: string;
  jiraComponents?: string[];
  jiraLabels?: string[];
}

export function createSmartIssueEmbed(
  thread: Thread,
  metadata: IssueMetadata,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<any>[];
} {
  const embed = new EmbedBuilder()
    .setTitle(`${getIssueTypeEmoji(thread.title)} ${thread.title}`)
    .setColor(getIssueColor(metadata))
    .setTimestamp();

  // Add GitHub link if available
  if (metadata.number) {
    embed.setURL(
      (() => {
        const rc = getRepoCredentialsForThread(thread);
        return `https://github.com/${rc.owner}/${rc.repo}/issues/${metadata.number}`;
      })(),
    );
  }

  // Status and Priority Section with GitHub and PM provider
  const githubStatus = metadata.state === "closed" ? "🔴 CLOSED" : "🟢 OPEN";
  const pmEmoji = getPMEmoji();
  let jiraStatus = metadata.jiraIssue ? `${pmEmoji} ${metadata.jiraIssue.status.name.toUpperCase()}` : "";
  // If provider is not Jira and we have a PM key, we could enrich asynchronously elsewhere
  // Here we keep synchronous rendering to maintain ESM build safety
  const priorityEmoji = getPriorityEmoji(
    metadata.priority || metadata.jiraPriority,
  );
  const priority = metadata.priority || metadata.jiraPriority || "NONE";

  const statusLine = jiraStatus
    ? `${githubStatus} | ${jiraStatus}`
    : githubStatus;

  embed.addFields({
    name: "📊 Status & Priority",
    value: `${statusLine}\n${priorityEmoji} **${priority.toUpperCase()}**`,
    inline: false,
  });

  // PM Providers list (multi-provider)
  try {
    const lines: string[] = [];
    if (metadata.jiraIssue) {
      const url = (metadata.jiraIssue as any).url || `https://your-domain.atlassian.net/browse/${metadata.jiraIssue.key}`;
      lines.push(`• Jira: [${metadata.jiraIssue.key}](${url})`);
    }
    // Try to include other provider links from the JSON store
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const js = require('../store') as any;
      const all = js?.store?.getAllProviderLinks?.() || [];
      const mine = Array.isArray(all) ? all.filter((l: any) => l.threadId === thread.id) : [];
      for (const l of mine) {
        const id = String(l.provider || '').toLowerCase();
        if (id === 'jira') continue;
        const label = getProviderLabelFor(id as any);
        const url = l.url ? ` (${l.url})` : '';
        lines.push(`• ${label}: ${l.key}${url}`);
      }
    } catch {}
    if (lines.length) {
      embed.addFields({
        name: `🔗 PM Providers (${getEnabledProviderDisplay()})` as any,
        value: lines.join('\n'),
        inline: true,
      });
    }
  } catch {}

  // Assignees Section
  if (metadata.assignees && metadata.assignees.length > 0) {
    const assigneeText = metadata.assignees
      .map((a) => `[@${a.login}](https://github.com/${a.login})`)
      .join(", ");
    embed.addFields({
      name: "👥 Assignees",
      value: assigneeText,
      inline: true,
    });
  }

  // Labels Section
  if (metadata.labels && metadata.labels.length > 0) {
    const labelText = metadata.labels.map((l) => `\`${l.name}\``).join(" ");
    embed.addFields({
      name: "🏷️ Labels",
      value: labelText,
      inline: true,
    });
  }

  // Milestone/Sprint Section
  if (metadata.milestone) {
    const dueDate = metadata.milestone.due_on
      ? new Date(metadata.milestone.due_on).toLocaleDateString()
      : "No due date";
    embed.addFields({
      name: "🎯 Milestone",
      value: `**${metadata.milestone.title}**\nDue: ${dueDate}`,
      inline: true,
    });
  }

  // Activity Section
  if (metadata.comments !== undefined || metadata.reactions) {
    const activity = [];
    if (metadata.comments) activity.push(`💬 ${metadata.comments} comments`);
    if (metadata.reactions?.total_count)
      activity.push(`👍 ${metadata.reactions.total_count} reactions`);

    if (activity.length > 0) {
      embed.addFields({
        name: "📈 Activity",
        value: activity.join(" • "),
        inline: true,
      });
    }
  }

  // Timestamps
  if (metadata.created_at && metadata.updated_at) {
    const created = new Date(metadata.created_at).toLocaleDateString();
    const updated = new Date(metadata.updated_at).toLocaleDateString();
    embed.setFooter({
      text: `Created: ${created} • Updated: ${updated}`,
    });
  }

  // Create action buttons (fallback to plain JSON when builders are mocked)
  const ab1: any = new (ButtonBuilder as any)();
  const ab2: any = new (ButtonBuilder as any)();
  const ab3: any = new (ButtonBuilder as any)();
  const ab4: any = new (ButtonBuilder as any)();
  const ab5: any = new (ButtonBuilder as any)();
  const compsA: any[] = [];
  if (typeof ab1?.setCustomId === 'function') {
    compsA.push(
      ab1.setCustomId(`assign_${thread.id}`).setLabel("Assign").setEmoji("👤").setStyle(ButtonStyle.Secondary),
      ab2.setCustomId(`priority_${thread.id}`).setLabel("Priority").setEmoji("⚡").setStyle(ButtonStyle.Secondary),
      ab3.setCustomId(`status_${thread.id}`).setLabel("Status").setEmoji("📊").setStyle(ButtonStyle.Secondary),
      ab4.setCustomId(`labels_${thread.id}`).setLabel("Labels").setEmoji("🏷️").setStyle(ButtonStyle.Secondary),
      ab5.setCustomId(`triage_${thread.id}`).setLabel("Triage").setEmoji("🔎").setStyle(ButtonStyle.Secondary),
    );
  } else {
    compsA.push(
      { type:2, custom_id:`assign_${thread.id}`, label:'Assign', emoji:'👤', style: ButtonStyle.Secondary },
      { type:2, custom_id:`priority_${thread.id}`, label:'Priority', emoji:'⚡', style: ButtonStyle.Secondary },
      { type:2, custom_id:`status_${thread.id}`, label:'Status', emoji:'📊', style: ButtonStyle.Secondary },
      { type:2, custom_id:`labels_${thread.id}`, label:'Labels', emoji:'🏷️', style: ButtonStyle.Secondary },
      { type:2, custom_id:`triage_${thread.id}`, label:'Triage', emoji:'🔎', style: ButtonStyle.Secondary },
    );
  }
  const arA: any = new (ActionRowBuilder as any)();
  const actionRow1: any = typeof arA?.addComponents === 'function' ? arA.addComponents(...compsA) : { type:1, components: compsA };

  const ac1: any = new (ButtonBuilder as any)();
  const ac2: any = new (ButtonBuilder as any)();
  const ac3: any = new (ButtonBuilder as any)();
  const ac4: any = new (ButtonBuilder as any)();
  const ac5: any = new (ButtonBuilder as any)();
  const compsB: any[] = [];
  if (typeof ac1?.setCustomId === 'function') {
    compsB.push(
      ac1.setCustomId(`comment_${thread.id}`).setLabel("Add Comment").setEmoji("💬").setStyle(ButtonStyle.Primary),
      ac2.setCustomId(`resolve_${thread.id}`).setLabel("Resolve").setEmoji("✅").setStyle(ButtonStyle.Success),
      ac3.setCustomId(`closeissue_${thread.id}`).setLabel("Close").setEmoji("🚫").setStyle(ButtonStyle.Danger),
      ac4.setCustomId(`reopen_${thread.id}`).setLabel("Reopen").setEmoji("🟢").setStyle(ButtonStyle.Secondary),
      ac5.setCustomId(`refresh_${thread.id}`).setLabel("Refresh").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
    );
  } else {
    compsB.push(
      { type:2, custom_id:`comment_${thread.id}`, label:'Add Comment', emoji:'💬', style: ButtonStyle.Primary },
      { type:2, custom_id:`resolve_${thread.id}`, label:'Resolve', emoji:'✅', style: ButtonStyle.Success },
      { type:2, custom_id:`closeissue_${thread.id}`, label:'Close', emoji:'🚫', style: ButtonStyle.Danger },
      { type:2, custom_id:`reopen_${thread.id}`, label:'Reopen', emoji:'🟢', style: ButtonStyle.Secondary },
      { type:2, custom_id:`refresh_${thread.id}`, label:'Refresh', emoji:'🔄', style: ButtonStyle.Secondary },
    );
  }
  const arB: any = new (ActionRowBuilder as any)();
  const actionRow2: any = typeof arB?.addComponents === 'function' ? arB.addComponents(...compsB) : { type:1, components: compsB };

  // Add GitHub link button if available (separate row to keep per-row <= 5)
  let linkRow: any = null;
  if (metadata.number) {
    const lb: any = new (ButtonBuilder as any)();
    const btn = typeof lb?.setURL === 'function'
      ? lb.setURL((() => { const rc = getRepoCredentialsForThread(thread); return `https://github.com/${rc.owner}/${rc.repo}/issues/${metadata.number}`; })()).setLabel('View on GitHub').setEmoji('🔗').setStyle(ButtonStyle.Link)
      : { type:2, url: (() => { const rc = getRepoCredentialsForThread(thread); return `https://github.com/${rc.owner}/${rc.repo}/issues/${metadata.number}`; })(), label: 'View on GitHub', emoji: '🔗', style: ButtonStyle.Link };
    const arL: any = new (ActionRowBuilder as any)();
    linkRow = typeof arL?.addComponents === 'function' ? arL.addComponents(btn) : { type:1, components: [btn] };
  }

  // PM-provider specific action row
  const _jr: any = new (ActionRowBuilder as any)();
  const jiraActionRow: any = typeof _jr?.addComponents === 'function' ? _jr : { type:1, components: [] as any[] };

  if (metadata.jiraIssue) {
    const j1: any = new (ButtonBuilder as any)();
    const j2: any = new (ButtonBuilder as any)();
    const j3: any = new (ButtonBuilder as any)();
    const items = (typeof j1?.setCustomId === 'function')
      ? [
          j1.setCustomId(`jira_transition_${thread.id}`).setLabel(`PM Transition`).setEmoji('🔄').setStyle(ButtonStyle.Secondary),
          j2.setCustomId(`jira_assign_${thread.id}`).setLabel(`PM Assign`).setEmoji('👥').setStyle(ButtonStyle.Secondary),
          j3.setURL(`${metadata.jiraIssue.url || `https://your-domain.atlassian.net/browse/${metadata.jiraIssue.key}`}`).setLabel(`View in PM`).setEmoji('🔷').setStyle(ButtonStyle.Link),
        ]
      : [
          { type:2, custom_id:`jira_transition_${thread.id}`, label:`PM Transition`, emoji:'🔄', style: ButtonStyle.Secondary },
          { type:2, custom_id:`jira_assign_${thread.id}`, label:`PM Assign`, emoji:'👥', style: ButtonStyle.Secondary },
          { type:2, url:`${metadata.jiraIssue.url || `https://your-domain.atlassian.net/browse/${metadata.jiraIssue.key}`}`, label:`View in PM`, emoji:'🔷', style: ButtonStyle.Link },
        ];
    if (typeof _jr?.addComponents === 'function') jiraActionRow.addComponents(...items);
    else (jiraActionRow.components as any[]).push(...items);
  } else {
    const j1: any = new (ButtonBuilder as any)();
    const j2: any = new (ButtonBuilder as any)();
    const items = (typeof j1?.setCustomId === 'function')
      ? [
          j1.setCustomId(`jira_create_${thread.id}`).setLabel(`Create PM Item`).setEmoji('➕').setStyle(ButtonStyle.Success),
          j2.setCustomId(`jira_link_${thread.id}`).setLabel(`Link PM Item`).setEmoji('🔗').setStyle(ButtonStyle.Secondary),
        ]
      : [
          { type:2, custom_id:`jira_create_${thread.id}`, label:`Create PM Item`, emoji:'➕', style: ButtonStyle.Success },
          { type:2, custom_id:`jira_link_${thread.id}`, label:`Link PM Item`, emoji:'🔗', style: ButtonStyle.Secondary },
        ];
    if (typeof _jr?.addComponents === 'function') jiraActionRow.addComponents(...items);
    else (jiraActionRow.components as any[]).push(...items);
  }

  const components = [actionRow1, actionRow2];
  if (jiraActionRow.components.length > 0) {
    components.push(jiraActionRow);
  }
  if (linkRow) {
    components.push(linkRow);
  }

  // Add a dedicated Delete action row to avoid exceeding per-row limits
  const dbtn: any = new (ButtonBuilder as any)();
  const d = typeof dbtn?.setCustomId === 'function' ? dbtn.setCustomId(`delete_${thread.id}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    : { type:2, custom_id:`delete_${thread.id}`, label:'Delete', emoji:'🗑️', style: ButtonStyle.Danger };
  const drow: any = new (ActionRowBuilder as any)();
  components.push(typeof drow?.addComponents === 'function' ? drow.addComponents(d) : { type:1, components: [d] });

  return {
    embeds: [embed],
    components,
  };
}

export function createProjectDashboardEmbed(
  issues: Array<Thread & IssueMetadata>,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<any>[];
} {
  const embed = new EmbedBuilder()
    .setTitle("📊 Project Dashboard")
    .setColor(0x0099ff)
    .setTimestamp();

  // Issue Statistics
  const totalIssues = issues.length;
  const openIssues = issues.filter((i) => i.state === "open").length;
  const closedIssues = issues.filter((i) => i.state === "closed").length;
  const bugCount = issues.filter((i) => i.title.includes("🐛")).length;
  const featureCount = issues.filter((i) => i.title.includes("✨")).length;

  embed.addFields({
    name: "📈 Overview",
    value: `**Total Issues:** ${totalIssues}\n**Open:** ${openIssues} | **Closed:** ${closedIssues}\n**Bugs:** ${bugCount} | **Features:** ${featureCount}`,
    inline: true,
  });

  // Priority Breakdown
  const priorities = {
    critical: issues.filter((i) => i.priority === "critical").length,
    high: issues.filter((i) => i.priority === "high").length,
    medium: issues.filter((i) => i.priority === "medium").length,
    low: issues.filter((i) => i.priority === "low").length,
  };

  embed.addFields({
    name: "⚡ Priority Breakdown",
    value: `🔴 Critical: ${priorities.critical}\n🟠 High: ${priorities.high}\n🟡 Medium: ${priorities.medium}\n🟢 Low: ${priorities.low}`,
    inline: true,
  });

  // Team Workload
  const assigneeWorkload = new Map<string, number>();
  issues.forEach((issue) => {
    if (issue.assignees) {
      issue.assignees.forEach((assignee) => {
        assigneeWorkload.set(
          assignee.login,
          (assigneeWorkload.get(assignee.login) || 0) + 1,
        );
      });
    }
  });

  if (assigneeWorkload.size > 0) {
    const workloadText = Array.from(assigneeWorkload.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(
        ([user, count]) => `[@${user}](https://github.com/${user}): ${count}`,
      )
      .join("\n");

    embed.addFields({
      name: "👥 Team Workload",
      value: workloadText,
      inline: true,
    });
  }

  // Progress Bar
  const progress =
    totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;
  const progressBar = createProgressBar(progress);

  embed.addFields({
    name: "🎯 Progress",
    value: `${progressBar} ${progress}% Complete`,
    inline: false,
  });

  // Action buttons for dashboard
  const db1: any = new (ButtonBuilder as any)();
  const db2: any = new (ButtonBuilder as any)();
  const db3: any = new (ButtonBuilder as any)();
  const db4: any = new (ButtonBuilder as any)();
  const compsDash: any[] = [];
  if (typeof db1?.setCustomId === 'function') {
    compsDash.push(
      db1.setCustomId('create_issue').setLabel('New Issue').setEmoji('➕').setStyle(ButtonStyle.Success),
      db2.setCustomId('sprint_view').setLabel('Sprint View').setEmoji('🏃').setStyle(ButtonStyle.Primary),
      db3.setCustomId('team_view').setLabel('Team View').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      db4.setCustomId('refresh_dashboard').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    );
  } else {
    compsDash.push(
      { type:2, custom_id:'create_issue', label:'New Issue', emoji:'➕', style: ButtonStyle.Success },
      { type:2, custom_id:'sprint_view', label:'Sprint View', emoji:'🏃', style: ButtonStyle.Primary },
      { type:2, custom_id:'team_view', label:'Team View', emoji:'👥', style: ButtonStyle.Secondary },
      { type:2, custom_id:'refresh_dashboard', label:'Refresh', emoji:'🔄', style: ButtonStyle.Secondary },
    );
  }
  const dar: any = new (ActionRowBuilder as any)();
  const dashboardActions: any = typeof dar?.addComponents === 'function' ? dar.addComponents(...compsDash) : { type:1, components: compsDash };

  return {
    embeds: [embed],
    components: [dashboardActions],
  };
}

// Helper functions
function getIssueTypeEmoji(title: string): string {
  if (title.includes("🐛")) return "🐛";
  if (title.includes("✨")) return "✨";
  if (title.includes("🔧")) return "🔧";
  if (title.includes("📚")) return "📚";
  return "📋";
}

function getIssueColor(metadata: IssueMetadata): number {
  if (metadata.state === "closed") return 0x6f42c1; // Purple for closed
  if (metadata.priority === "critical") return 0xff0000; // Red for critical
  if (metadata.priority === "high") return 0xff8800; // Orange for high
  if (metadata.priority === "medium") return 0xffff00; // Yellow for medium
  if (metadata.priority === "low") return 0x00ff00; // Green for low
  return 0x0099ff; // Blue for default
}

function getPriorityEmoji(priority?: string): string {
  switch (priority) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
    default:
      return "⚪";
  }
}

function createProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}
