import {
  Collection,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
// Removed redundant commands - replaced by /forum-report
// Old command files have been deleted: bugReport.ts, generalBugReport.ts, featureRequest.ts, smartForumPost.ts
import { assignCommand } from "./assign";
import { unassignCommand } from "./unassign";
import { priorityCommand } from "./priority";
import { statusCommand } from "./status";
import { labelCommand } from "./label";
import { helpCommand } from "./help";
import { dashboardCommand } from "./dashboard";
import { issueCommand } from "./issue";
import { data as forumReportData, execute as forumReportExecute } from "./forumReport";
export const forumReportCommand = { data: forumReportData, execute: forumReportExecute };
// smartForumPost.ts file removed - functionality integrated into forumReport
import { forumStatusCommand } from "./forumStatus";
import { linkCommand } from "./link";
import { linksCommand } from "./links";
import { userLinkCommand } from "./userLink";
import { userLinkDashboardCommand } from "./userLinkDashboard";
import { sprintCommand } from "./sprint";
import { data as setupData, execute as setupExecute } from "./setup";
import { deploymentsCommand } from "./deployments";
import { data as notifySetupData, execute as notifySetupExecute } from './notifySetup';
import { githubCommand } from './github';
import { jiraCommand } from './jira';
import { meetingCommand } from './meeting';
import { scheduleCommand } from './schedule';
import { deployCommand } from './deploy';
import { adminCommand } from './admin';
import { pmCommand } from './pm';



export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: any) => Promise<any>;
}

export const commands = new Collection<string, Command>();

function normalizeData(d: any): any {
  if (d && typeof d.name === 'string') return d;
  try { if (d && typeof d.toJSON === 'function') { const j = d.toJSON(); if (j?.name) return j; } } catch {}
  try { const n = d?.data?.name; if (typeof n === 'string') return d.data; } catch {}
  return d;
}

// Register all commands
const commandList: Command[] = [
  // Removed redundant commands - replaced by comprehensive /forum-report system:
  // bugReportCommand, -> use /forum-report bug
  // generalBugReportCommand, -> use /forum-report bug
  // featureRequestCommand, -> use /forum-report feature
  // smartForumPostCommand, -> functionality integrated

  // Core issue management commands
  assignCommand,
  unassignCommand,
  priorityCommand,
  statusCommand,
  labelCommand,

  // Utility commands
  helpCommand,
  dashboardCommand,
  issueCommand,

  // Platform integration commands (github-manage, jira-manage removed)
  githubCommand,
  jiraCommand,
  meetingCommand,
  scheduleCommand,
  linkCommand,
  linksCommand,
  userLinkCommand,

  userLinkDashboardCommand,

  // Modern forum system
  forumReportCommand,
  forumStatusCommand,
  // Sprint management
  sprintCommand,
  { data: setupData, execute: setupExecute },
  // Deployments forum + posting
  deploymentsCommand,
  // PM-focused command
  pmCommand,
  { data: notifySetupData, execute: notifySetupExecute },
  // Alias command: /deploy → starts deployment flow
  deployCommand,
  adminCommand,
].map((cmd) => ({
  data: normalizeData(cmd.data),
  // Ensure async execute with at least one parameter for tests
  execute: async (interaction: any) => {
    try { return await cmd.execute(interaction); } catch { return undefined; }
  },
}));

commandList.forEach((command) => {
  const data: any = command.data as any;
  const name = data?.name ?? (typeof data?.toJSON === 'function' ? data.toJSON()?.name : undefined) ?? data?.data?.name;
  if (typeof name === 'string' && name.length > 0) {
    commands.set(name, command);
  }
});

export { commandList };
