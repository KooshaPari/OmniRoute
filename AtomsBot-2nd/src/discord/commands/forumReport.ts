import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { EmbedBuilder } from "discord.js";
// Lazily import heavy modules to avoid circular async init
import { forumManager } from "../components/ForumManager";

// Function to create SlashCommandBuilder when needed (for runtime use)
function _createBuilder() {
  try {
    return new SlashCommandBuilder()
      .setName("forum-report")
      .setDescription(
        "Create a bug report or feature request with forum selection",
      )
      .setDMPermission(false)
      .addSubcommand((sub) =>
        sub
          .setName("bug")
          .setDescription("Report a bug with team-specific forum selection")
          .addStringOption((opt) => {
            const teams = ((forumManager as any)?.getAllTeams?.() || []) as Array<{
              id: string; name: string; emoji?: string;
            }>;
            const choices = teams.map((t) => ({
              name: `${t.emoji ?? ""} ${t.name}`.trim(),
              value: t.id,
            }));
            return opt
              .setName("team")
              .setDescription("Pre-select a team (optional)")
              .setRequired(false)
              .addChoices(...choices);
          }),
      )
      .addSubcommand((sub) =>
        sub
          .setName("feature")
          .setDescription(
            "Request a feature with team-specific forum selection",
          )
          .addStringOption((opt) => {
            const teams = ((forumManager as any)?.getAllTeams?.() || []) as Array<{
              id: string; name: string; emoji?: string;
            }>;
            const choices = teams.map((t) => ({
              name: `${t.emoji ?? ""} ${t.name}`.trim(),
              value: t.id,
            }));
            return opt
              .setName("team")
              .setDescription("Pre-select a team (optional)")
              .setRequired(false)
              .addChoices(...choices);
          }),
      )
      .addSubcommand((sub) =>
        sub.setName("forums").setDescription("View available forums and teams"),
      );
  } catch {
    // Return null in test environments where SlashCommandBuilder might not be available
    return null;
  }
}


export const data = {
  name: "forum-report",
  description: "Create a bug report or feature request with forum selection",
  dm_permission: false,
  options: [
    {
      type: 1,
      name: "bug", 
      description: "Report a bug with team-specific forum selection",
      options: [{
        type: 3,
        name: "team",
        description: "Pre-select a team (optional)",
        required: false,
        choices: [
          { name: "🎨 Frontend Team", value: "frontend" },
          { name: "⚙️ Backend Team", value: "backend" },
          { name: "🔧 DevOps Team", value: "devops" },
          { name: "🧪 QA Team", value: "qa" },
          { name: "❓ Support Team", value: "support" }
        ]
      }]
    },
    {
      type: 1, 
      name: "feature",
      description: "Request a feature with team-specific forum selection", 
      options: [{
        type: 3,
        name: "team",
        description: "Pre-select a team (optional)",
        required: false,
        choices: [
          { name: "🎨 Frontend Team", value: "frontend" },
          { name: "⚙️ Backend Team", value: "backend" },
          { name: "🔧 DevOps Team", value: "devops" },
          { name: "🧪 QA Team", value: "qa" },
          { name: "❓ Support Team", value: "support" }
        ]
      }]
    },
    {
      type: 1,
      name: "forums",
      description: "View available forums and teams",
      options: []
    }
  ]
};

export async function execute(interaction: ChatInputCommandInteraction) {
  // Ensure command is used in a guild
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const rawTeam = interaction.options.getString("team");
  const preselectedTeam = (rawTeam ?? "").trim();

  switch (subcommand) {
    case "bug":
      await handleBugReport(interaction, preselectedTeam);
      break;
    case "feature":
      await handleFeatureRequest(interaction, preselectedTeam);
      break;
    case "forums":
      await handleForumsList(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown subcommand.",
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handleBugReport(
  interaction: ChatInputCommandInteraction,
  preselectedTeam?: string | null,
): Promise<void> {
  if (preselectedTeam && preselectedTeam.trim()) {
    // If team is preselected, show forum selection for that team
    const team = forumManager.getTeam(preselectedTeam);
    if (!team) {
      await interaction.reply({
        content: "❌ Selected team not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const teamForums = forumManager
      .getForumsByTeam(preselectedTeam)
      .filter(
        (forum) =>
          forum.category === "bug-reports" || forum.category === "general",
      );

    if (teamForums.length === 1) {
      // If only one forum, go directly to bug report form
      const { bugReportForm } = await import("../components/BugReportForm");
      await bugReportForm.showTemplateSelection(interaction as any, {
        targetForum: teamForums[0],
      });
      return;
    }
  }

  // Show full forum selection interface
  const { bugReportForm } = await import("../components/BugReportForm");
  await bugReportForm.showForumSelection(interaction);
}

async function handleFeatureRequest(
  interaction: ChatInputCommandInteraction,
  preselectedTeam?: string | null,
): Promise<void> {
  if (preselectedTeam && preselectedTeam.trim()) {
    // If team is preselected, show forum selection for that team
    const team = forumManager.getTeam(preselectedTeam);
    if (!team) {
      await interaction.reply({
        content: "❌ Selected team not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const teamForums = forumManager
      .getForumsByTeam(preselectedTeam)
      .filter(
        (forum) =>
          forum.category === "feature-requests" || forum.category === "general",
      );

    if (teamForums.length === 1) {
      // If only one forum, go directly to feature request form
      const { featureRequestWorkflow } = await import("../components/FeatureRequestWorkflow");
      await featureRequestWorkflow.showFeatureRequestForm(interaction as any, {
        targetForum: teamForums[0],
        preselectedCategory: "feature-requests",
      });
      return;
    }
  }

  // Show full forum selection interface
  const { featureRequestWorkflow } = await import("../components/FeatureRequestWorkflow");
  await featureRequestWorkflow.showForumSelection(interaction);
}

async function handleForumsList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  let teams: any[] = [];
  let _forums: any[] = [];
  try {
    teams = forumManager.getAllTeams();
    _forums = forumManager.getAllForums();
  } catch (_e) {
    await interaction.reply({
      content: "❌ Failed to load forum configuration.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Prefer EmbedBuilder when available so tests can inspect builder calls
  const embedBuilder: any = new (EmbedBuilder as any)();
  let embed: any = embedBuilder;
  if (typeof embedBuilder?.setTitle === "function") {
    embedBuilder
      .setTitle("📋 Available Forums & Teams")
      .setDescription(
        "Here are all the available teams and their forums for issue reporting:",
      )
      .setColor(0x5865f2)
      .setTimestamp();
  } else {
    embed = {
      title: "📋 Available Forums & Teams",
      description:
        "Here are all the available teams and their forums for issue reporting:",
      color: 0x5865f2,
      fields: [] as any[],
      timestamp: new Date().toISOString(),
    };
  }

  // Add team information
  teams.forEach((team) => {
    const teamForums = (forumManager.getForumsByTeam(team.id) || []) as any[];
    const forumList = teamForums
      .map((forum) => {
        const categoryEmoji = getCategoryEmoji(forum.category);
        return `${categoryEmoji} **${forum.name}**\n*${forum.description}*`;
      })
      .join("\n\n");

    const field = {
      name: `${team.emoji} ${team.name}`,
      value: forumList || "No forums configured",
      inline: false,
    };
    if (typeof embedBuilder?.addFields === "function") {
      embedBuilder.addFields(field);
    } else {
      (embed.fields as any[]).push(field);
    }
  });

  // Add usage instructions
  const usageField = {
    name: "📝 How to Use",
    value:
      "• Use `/forum-report bug` to report bugs\n" +
      "• Use `/forum-report feature` to request features\n" +
      "• Optionally specify a team to skip team selection\n" +
      "• Each team has specialized forums for different types of issues",
    inline: false,
  };
  if (typeof embedBuilder?.addFields === "function") {
    embedBuilder.addFields(usageField);
  } else {
    (embed.fields as any[]).push(usageField);
  }

  // Build buttons with builder if methods exist, else populate plain objects
  const b1: any = new (ButtonBuilder as any)();
  const b2: any = new (ButtonBuilder as any)();
  const b3: any = new (ButtonBuilder as any)();
  if (typeof b1?.setCustomId === "function") {
    b1.setCustomId(`start_bug_report_${interaction.user.id}`)
      .setLabel("🐛 Report Bug").setStyle(ButtonStyle.Danger);
    b2.setCustomId(`start_feature_request_${interaction.user.id}`)
      .setLabel("✨ Request Feature").setStyle(ButtonStyle.Primary);
    b3.setCustomId(`refresh_forums_${interaction.user.id}`)
      .setLabel("🔄 Refresh").setStyle(ButtonStyle.Secondary);
  } else {
    b1.custom_id = `start_bug_report_${interaction.user.id}`;
    b1.label = "🐛 Report Bug";
    b1.style = ButtonStyle.Danger;
    b2.custom_id = `start_feature_request_${interaction.user.id}`;
    b2.label = "✨ Request Feature";
    b2.style = ButtonStyle.Primary;
    b3.custom_id = `refresh_forums_${interaction.user.id}`;
    b3.label = "🔄 Refresh";
    b3.style = ButtonStyle.Secondary;
  }

  const actionRow: any = new (ActionRowBuilder as any)();
  if (typeof actionRow?.addComponents === "function") {
    actionRow.addComponents(b1, b2, b3);
  }

  await interaction.reply({
    embeds: [embed],
    // Always send components array so tests can assert length
    components: [
      typeof actionRow?.addComponents === "function"
        ? actionRow
        : { type: 1, components: [b1, b2, b3] },
    ],
    flags: MessageFlags.Ephemeral,
  });
}

function getCategoryEmoji(category: string): string {
  switch (category) {
    case "bug-reports":
      return "🐛";
    case "feature-requests":
      return "✨";
    case "support":
      return "❓";
    case "general":
      return "💬";
    case "feedback":
      return "💭";
    default:
      return "📁";
  }
}

// Note: Button handlers are registered in ForumSelectionUI.ts
