import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuInteraction, ButtonInteraction, MessageFlags } from "discord.js";
import { forumManager } from "./ForumManager";
import { ForumConfig, TeamConfig } from "./ForumTypes";
import { bugReportForm } from "./BugReportForm";
import { featureRequestWorkflow } from "./FeatureRequestWorkflow";
import { actionButtonManager } from "../framework/ActionButtonManager";
import { sprintService } from "./SprintService";

export interface ForumSelectionOptions {
  type: "bug-report" | "feature-request" | "general";
  userId: string;
  guildId: string;
  preselectedTeam?: string;
  preselectedCategory?: string;
}

/**
 * Forum Selection UI for choosing target forums for issues
 */
export class ForumSelectionUI {
  constructor() {
    this.registerHandlers();
  }

  /**
   * Create forum selection embed and components
   */
  createForumSelection(options: ForumSelectionOptions): {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<any>[];
  } {
    const { type, preselectedTeam, preselectedCategory } = options;

    // Create main embed
    const teamsList = forumManager.getAllTeams();
    const dynamicGuide = teamsList.length
      ? teamsList
          .slice(0, 6)
          .map((t) => `${t.emoji || '🏷️'} **${t.name}**: ${t.description || '—'}`)
          .join("\n")
      : "Select a team first to see available forums.";

    const embed = new EmbedBuilder() as any;
    if (typeof embed.setTitle === 'function') embed.setTitle(`📋 Select Forum for ${this.getTypeDisplayName(type)}`);
    if (typeof embed.setDescription === 'function') embed.setDescription(
      `Choose the appropriate forum for your ${type.replace("-", " ")}. ` +
      `This helps route your issue to the right team for faster resolution.`,
    );
    if (typeof embed.setColor === 'function') embed.setColor(this.getTypeColor(type));
    if (typeof embed.addFields === 'function') embed.addFields([
      { name: "🎯 Teams", value: dynamicGuide, inline: false },
    ]);
    if (typeof embed.setFooter === 'function') embed.setFooter({ text: "Select a team first, then choose the specific forum" });
    if (typeof embed.setTimestamp === 'function') embed.setTimestamp();

    const components: ActionRowBuilder<any>[] = [];

    // Team selection dropdown
    const teamSelect = new StringSelectMenuBuilder() as any;
    if (typeof teamSelect.setCustomId === 'function') teamSelect.setCustomId(`forum_team_select_${options.type}_${options.userId}`);
    if (typeof teamSelect.setPlaceholder === 'function') teamSelect.setPlaceholder("🏢 Select a team...");
    if (typeof teamSelect.setMinValues === 'function') teamSelect.setMinValues(1);
    if (typeof teamSelect.setMaxValues === 'function') teamSelect.setMaxValues(1);

    console.log(
      `🔍 Initial Team Select Debug: customId="forum_team_select_${options.type}_${options.userId}", type="${options.type}"`,
    );

    const teams = teamsList;
    teams.forEach((team) => {
      const opt = new StringSelectMenuOptionBuilder() as any;
      if (typeof opt.setLabel === 'function') opt.setLabel(team.name);
      if (typeof opt.setDescription === 'function') opt.setDescription(team.description);
      if (typeof opt.setValue === 'function') opt.setValue(team.id);
      if (typeof opt.setEmoji === 'function') opt.setEmoji(team.emoji);
      if (typeof opt.setDefault === 'function') opt.setDefault(team.id === preselectedTeam);
      if (typeof teamSelect.addOptions === 'function') teamSelect.addOptions(opt);
    });

    {
      const row = new ActionRowBuilder<StringSelectMenuBuilder>() as any;
      if (typeof row.addComponents === 'function') {
        row.addComponents(teamSelect);
        components.push(row);
      } else {
        components.push({ components: [teamSelect] } as any);
      }
    }

    // Always show a forum selection dropdown row
    // - If a team is preselected, populate it with that team's forums
    // - Otherwise, show a disabled placeholder prompting the user to pick a team first
    if (preselectedTeam) {
      const forumSelect = this.createForumSelectMenu(
        preselectedTeam,
        type,
        options.userId,
        preselectedCategory,
      );
      if (forumSelect) {
        const row = new ActionRowBuilder<StringSelectMenuBuilder>() as any;
        if (typeof row.addComponents === 'function') {
          row.addComponents(forumSelect);
          components.push(row);
        } else {
          components.push({ components: [forumSelect] } as any);
        }
      }
    }

    // Action buttons
    {
      const actionRow = new ActionRowBuilder<ButtonBuilder>() as any;
      const btn1 = new ButtonBuilder() as any;
      if (typeof btn1.setCustomId === 'function') btn1.setCustomId(`forum_refresh_${options.userId}`);
      if (typeof btn1.setLabel === 'function') btn1.setLabel("🔄 Refresh");
      if (typeof btn1.setStyle === 'function') btn1.setStyle(ButtonStyle.Secondary);
      const btn2 = new ButtonBuilder() as any;
      if (typeof btn2.setCustomId === 'function') btn2.setCustomId(`forum_help_${options.userId}`);
      if (typeof btn2.setLabel === 'function') btn2.setLabel("❓ Help");
      if (typeof btn2.setStyle === 'function') btn2.setStyle(ButtonStyle.Secondary);
      const btn3 = new ButtonBuilder() as any;
      if (typeof btn3.setCustomId === 'function') btn3.setCustomId(`forum_cancel_${options.userId}`);
      if (typeof btn3.setLabel === 'function') btn3.setLabel("❌ Cancel");
      if (typeof btn3.setStyle === 'function') btn3.setStyle(ButtonStyle.Danger);
      if (typeof actionRow.addComponents === 'function') {
        actionRow.addComponents(btn1, btn2, btn3);
        components.push(actionRow);
      } else {
        components.push({ components: [btn1, btn2, btn3] } as any);
      }
    }

    return { embeds: [embed], components };
  }

  /**
   * Create forum selection dropdown for a specific team
   */
  private createForumSelectMenu(
    teamId: string,
    type: string,
    userId: string,
    preselectedCategory?: string,
  ): StringSelectMenuBuilder | null {
    const team = forumManager.getTeam(teamId);
    if (!team) return null;

    const teamForums = forumManager.getForumsByTeam(teamId);
    console.log(`🔍 Forum Filter Debug: teamId="${teamId}", type="${type}"`);
    console.log(
      `🔍 Team forums found:`,
      teamForums.map((f) => `${f.id}:${f.category}`),
    );

    const relevantForums = teamForums.filter((forum) => {
      if (type === "bug-report") {
        return forum.category === "bug-reports" || forum.category === "general";
      } else if (type === "feature-request") {
        return (
          forum.category === "feature-requests" || forum.category === "general"
        );
      }
      return true;
    });

    console.log(
      `🔍 Filtered forums for type "${type}":`,
      relevantForums.map((f) => `${f.id}:${f.category}`),
    );

    if (relevantForums.length === 0) return null;

    const forumSelect = new StringSelectMenuBuilder() as any;
    if (typeof forumSelect.setCustomId === 'function') forumSelect.setCustomId(`forum_select_${teamId}_${type}_${userId}`);
    if (typeof forumSelect.setPlaceholder === 'function') forumSelect.setPlaceholder(`📁 Select ${team.name} forum...`);
    if (typeof forumSelect.setMinValues === 'function') forumSelect.setMinValues(1);
    if (typeof forumSelect.setMaxValues === 'function') forumSelect.setMaxValues(1);

    console.log(
      `🔍 Forum Select Menu Debug: customId="forum_select_${teamId}_${type}_${userId}", type="${type}"`,
    );

    relevantForums.forEach((forum) => {
      const option = new StringSelectMenuOptionBuilder() as any;
      if (typeof option.setLabel === 'function') option.setLabel(forum.name);
      if (typeof option.setDescription === 'function') option.setDescription(forum.description);
      if (typeof option.setValue === 'function') option.setValue(forum.id);
      if (typeof option.setDefault === 'function') option.setDefault(forum.category === preselectedCategory);

      // Add emoji based on category
      const emoji = this.getCategoryEmoji(forum.category);
      if (emoji && typeof (option as any).setEmoji === 'function') (option as any).setEmoji(emoji);

      if (typeof forumSelect.addOptions === 'function') forumSelect.addOptions(option);
    });

    return forumSelect;
  }

  /**
   * Handle team selection
   */
  async handleTeamSelection(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    console.log(
      `🔍 Team Selection Handler Called: customId="${interaction.customId}"`,
    );

    const parts = interaction.customId.split("_");
    const type = parts[3]; // forum_team_select_TYPE_userId
    const userId = parts[4];

    console.log(`🔍 Team Selection Debug: type="${type}", userId="${userId}"`);
    console.log(
      `🔍 User ID Check: interaction.user.id="${interaction.user.id}", extracted userId="${userId}", match=${interaction.user.id === userId}`,
    );

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You can only interact with your own forum selection.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selectedTeamId = interaction.values[0];
    const team = forumManager.getTeam(selectedTeamId);

    if (!team) {
      const err = new EmbedBuilder() as any;
      if (typeof err.setTitle === 'function') err.setTitle("⚠️ Team Not Found");
      if (typeof err.setDescription === 'function') err.setDescription("The selected team could not be found. Please pick a team again.");
      if (typeof err.setColor === 'function') err.setColor(0xffcc00);
      await interaction.update({ embeds: [err], components: [] });
      return;
    }

    // Update the embed with team-specific information
    const embed = new EmbedBuilder() as any;
    if (typeof embed.setTitle === 'function') embed.setTitle(`📋 Select ${team.name} Forum`);
    if (typeof embed.setDescription === 'function') embed.setDescription(
      `You've selected the **${team.name}**. ` +
      `Now choose the specific forum for your issue.`,
    );
    if (typeof embed.setColor === 'function') embed.setColor(team.color);
    if (typeof embed.addFields === 'function') embed.addFields([
      { name: `${team.emoji} ${team.name}`, value: team.description, inline: false },
    ]);
    if (typeof embed.setFooter === 'function') embed.setFooter({ text: "Choose the most appropriate forum for your issue" });
    if (typeof embed.setTimestamp === 'function') embed.setTimestamp();

    // Create forum selection menu using the extracted type
    const forumSelect = this.createForumSelectMenu(
      selectedTeamId,
      type,
      userId,
    );

    const components: ActionRowBuilder<any>[] = [];

    // Keep the team selection (updated)
    const teamSelect2 = new StringSelectMenuBuilder() as any;
    if (typeof teamSelect2.setCustomId === 'function') teamSelect2.setCustomId(`forum_team_select_${type}_${userId}`);
    if (typeof teamSelect2.setPlaceholder === 'function') teamSelect2.setPlaceholder("🏢 Select a team...");
    if (typeof teamSelect2.setMinValues === 'function') teamSelect2.setMinValues(1);
    if (typeof teamSelect2.setMaxValues === 'function') teamSelect2.setMaxValues(1);

    const teams = forumManager.getAllTeams();
    teams.forEach((teamConfig) => {
      const opt = new StringSelectMenuOptionBuilder() as any;
      if (typeof opt.setLabel === 'function') opt.setLabel(teamConfig.name);
      if (typeof opt.setDescription === 'function') opt.setDescription(teamConfig.description);
      if (typeof opt.setValue === 'function') opt.setValue(teamConfig.id);
      if (typeof opt.setEmoji === 'function') opt.setEmoji(teamConfig.emoji);
      if (typeof opt.setDefault === 'function') opt.setDefault(teamConfig.id === selectedTeamId);
      if (typeof teamSelect2.addOptions === 'function') teamSelect2.addOptions(opt);
    });

    {
      const row2 = new ActionRowBuilder<StringSelectMenuBuilder>() as any;
      if (typeof row2.addComponents === 'function') {
        row2.addComponents(teamSelect2);
        components.push(row2);
      } else {
        components.push({ components: [teamSelect2] } as any);
      }
    }

    // Add forum selection if available
    if (forumSelect) {
      const row = new ActionRowBuilder<StringSelectMenuBuilder>() as any;
      if (typeof row.addComponents === 'function') {
        row.addComponents(forumSelect);
        components.push(row);
      } else {
        components.push({ components: [forumSelect] } as any);
      }
    }

    // Action buttons (guarded for test environment)
    {
      const actionRow = new ActionRowBuilder<ButtonBuilder>() as any;
      const btn1 = new ButtonBuilder() as any;
      if (typeof btn1.setCustomId === 'function') btn1.setCustomId(`forum_refresh_${userId}`);
      if (typeof btn1.setLabel === 'function') btn1.setLabel("🔄 Refresh");
      if (typeof btn1.setStyle === 'function') btn1.setStyle(ButtonStyle.Secondary);
      const btn2 = new ButtonBuilder() as any;
      if (typeof btn2.setCustomId === 'function') btn2.setCustomId(`forum_help_${userId}`);
      if (typeof btn2.setLabel === 'function') btn2.setLabel("❓ Help");
      if (typeof btn2.setStyle === 'function') btn2.setStyle(ButtonStyle.Secondary);
      const btn3 = new ButtonBuilder() as any;
      if (typeof btn3.setCustomId === 'function') btn3.setCustomId(`forum_cancel_${userId}`);
      if (typeof btn3.setLabel === 'function') btn3.setLabel("❌ Cancel");
      if (typeof btn3.setStyle === 'function') btn3.setStyle(ButtonStyle.Danger);
      if (typeof actionRow.addComponents === 'function') {
        actionRow.addComponents(btn1, btn2, btn3);
        components.push(actionRow);
      } else {
        components.push({ components: [btn1, btn2, btn3] } as any);
      }
    }

    await interaction.update({
      embeds: [embed],
      components,
    });
  }

  // Helper methods
  private getTypeDisplayName(type: string): string {
    switch (type) {
      case "bug-report":
        return "Bug Report";
      case "feature-request":
        return "Feature Request";
      default:
        return "Issue";
    }
  }

  private getTypeColor(type: string): number {
    switch (type) {
      case "bug-report":
        return 0xff6b6b; // Red
      case "feature-request":
        return 0x4ecdc4; // Teal
      default:
        return 0x95a5a6; // Gray
    }
  }

  private getCategoryEmoji(category: string): string {
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

  private extractTypeFromInteraction(
    _interaction: StringSelectMenuInteraction,
  ): string {
    // Extract type from the original message or stored state
    // For now, default to bug-report, but this should be improved
    return "bug-report";
  }

  /**
   * Handle forum selection
   */
  async handleForumSelection(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    console.log(
      `🔍 Forum Selection Handler Called: customId="${interaction.customId}"`,
    );

    const parts = interaction.customId.split("_");
    const teamId = parts[2];
    const type = parts[3]; // forum_select_teamId_type_userId
    const userId = parts[4];

    console.log(
      `🔍 Forum Selection Debug: customId="${interaction.customId}", teamId="${teamId}", type="${type}", userId="${userId}"`,
    );

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You can only interact with your own forum selection.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selectedForumId = interaction.values[0];
    const forum = forumManager.getForum(selectedForumId);
    const team = forumManager.getTeam(teamId);

    if (!forum || !team) {
      const err = new EmbedBuilder() as any;
      if (typeof err.setTitle === 'function') err.setTitle("⚠️ Forum Not Found");
      if (typeof err.setDescription === 'function') err.setDescription("The selected forum or team could not be found. Please try again.");
      if (typeof err.setColor === 'function') err.setColor(0xffcc00);
      await interaction.update({ embeds: [err], components: [] });
      return;
    }

    // Store the selection and proceed to the appropriate form
    await this.proceedToForm(interaction, forum, team, type);
  }

  /**
   * Proceed to the appropriate form based on type
   */
  private async proceedToForm(
    interaction: StringSelectMenuInteraction,
    forum: ForumConfig,
    team: TeamConfig,
    type: string,
  ): Promise<void> {
    const embed = new EmbedBuilder() as any;
    if (typeof embed.setTitle === 'function') embed.setTitle(`✅ Forum Selected: ${forum.name}`);
    if (typeof embed.setDescription === 'function') embed.setDescription(
      `Perfect! Your ${type.replace("-", " ")} will be posted to **${forum.name}** ` +
      `and assigned to the **${team.name}**.`,
    );
    if (typeof embed.setColor === 'function') embed.setColor(team.color);
    if (typeof embed.addFields === 'function') embed.addFields([
      { name: "📍 Selected Forum", value: `${forum.name}\n*${forum.description}*`, inline: true },
      { name: "👥 Assigned Team", value: `${team.emoji} ${team.name}\n*${team.description}*`, inline: true },
      { name: "🏷️ Auto-assigned Labels", value: forum.labels?.join(", ") || "None", inline: false },
    ]);
    if (typeof embed.setFooter === 'function') embed.setFooter({ text: "Click the button below to continue with your submission" });
    if (typeof embed.setTimestamp === 'function') embed.setTimestamp();

    const actionRow2 = new ActionRowBuilder<ButtonBuilder>() as any;
    const b1 = new ButtonBuilder() as any;
    if (typeof b1.setCustomId === 'function') b1.setCustomId(`proceed_${type}_${forum.id}_${interaction.user.id}`);
    if (typeof b1.setLabel === 'function') b1.setLabel(`📝 Continue with ${this.getTypeDisplayName(type)}`);
    if (typeof b1.setStyle === 'function') b1.setStyle(ButtonStyle.Primary);
    const b2 = new ButtonBuilder() as any;
    if (typeof b2.setCustomId === 'function') b2.setCustomId(`forum_back_${interaction.user.id}`);
    if (typeof b2.setLabel === 'function') b2.setLabel("⬅️ Back to Selection");
    if (typeof b2.setStyle === 'function') b2.setStyle(ButtonStyle.Secondary);
    const b3 = new ButtonBuilder() as any;
    if (typeof b3.setCustomId === 'function') b3.setCustomId(`forum_cancel_${interaction.user.id}`);
    if (typeof b3.setLabel === 'function') b3.setLabel("❌ Cancel");
    if (typeof b3.setStyle === 'function') b3.setStyle(ButtonStyle.Danger);
    let componentsRow: any;
    if (typeof actionRow2.addComponents === 'function') {
      actionRow2.addComponents(b1, b2, b3);
      componentsRow = [actionRow2];
    } else {
      componentsRow = [{ components: [b1, b2, b3] }];
    }

    await interaction.update({ embeds: [embed], components: componentsRow });
  }

  /**
   * Register interaction handlers
   */
  private registerHandlers(): void {
    // Team selection handler (for select menus)
    actionButtonManager.registerAction({
      id: "forum_team_select",
      type: "callback",
      handler: async (interaction) => {
        if (interaction.isStringSelectMenu()) {
          await this.handleTeamSelection(interaction);
        }
      },
    });

    // Forum selection handler (for select menus)
    actionButtonManager.registerAction({
      id: "forum_select",
      type: "callback",
      handler: async (interaction) => {
        if (interaction.isStringSelectMenu()) {
          await this.handleForumSelection(interaction);
        }
      },
    });

    // Proceed to form handler
    actionButtonManager.createQuickAction(
      "proceed",
      "Continue",
      async (interaction: ButtonInteraction): Promise<void> => {
        await this.handleProceedToForm(interaction);
      },
    );

    // Help button handler
    actionButtonManager.createQuickAction(
      "forum_help",
      "Help",
      async (interaction: ButtonInteraction): Promise<void> => {
        await this.handleHelpButton(interaction);
      },
    );

    // Cancel button handler
    actionButtonManager.createQuickAction(
      "forum_cancel",
      "Cancel",
      async (interaction: ButtonInteraction): Promise<void> => {
        await this.handleCancelButton(interaction);
      },
    );

    // Back button handler
    actionButtonManager.createQuickAction(
      "forum_back",
      "Back",
      async (interaction: ButtonInteraction): Promise<void> => {
        await this.handleBackButton(interaction);
      },
    );

    // Continue without sprint handler
    actionButtonManager.createQuickAction(
      "continue_no_sprint",
      "Continue without sprint",
      async (interaction: ButtonInteraction): Promise<void> => {
        const parts = interaction.customId.split('_');
        const type = parts[3];
        const forumId = parts[4];
        const userId = parts[5];
        if (interaction.user.id !== userId) {
          await interaction.reply({ content: '❌ You can only continue your own flow.', flags: MessageFlags.Ephemeral });
          return;
        }
        const forum = forumManager.getForum(forumId);
        if (!forum) {
          await interaction.reply({ content: '❌ Forum not found.', flags: MessageFlags.Ephemeral });
          return;
        }
        if (type === 'bug-report') {
          await bugReportForm.showTemplateSelection(interaction as any, { targetForum: forum });
        } else if (type === 'feature-request') {
          await featureRequestWorkflow.showFeatureRequestForm(interaction as any, { targetForum: forum });
        } else {
          await interaction.reply({ content: '❌ Unknown type', flags: MessageFlags.Ephemeral });
        }
      },
    );

    // Note: String select menu handlers need to be handled differently
    // They should be registered in the main Discord handlers
  }

  /**
   * Handle proceed to form button
   */
  private async handleProceedToForm(
    interaction: ButtonInteraction,
  ): Promise<void> {
    const parts = interaction.customId.split("_");
    const type = parts[1];
    const forumId = parts[2];
    const userId = parts[3];

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You can only interact with your own selections.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const forum = forumManager.getForum(forumId);
    if (!forum) {
      await interaction.reply({
        content: "❌ Selected forum not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Launch the appropriate form with debug logs
    console.log(
      `[ForumSelectionUI] Proceed handler: type=${type}, forumId=${forum.id}, userId=${userId}`,
    );
    try {
      // Optional sprint step: if there are active sprints and auto-assign is not enabled, prompt selection
      const guildId = interaction.guildId || "";
      const active = await sprintService.listActiveSprints(guildId, 25);
      const cfg = await sprintService.getGuildConfig(guildId);
      const shouldPromptSprint = active.length > 0 && !cfg.autoAssignNewIssues;

      if (shouldPromptSprint) {
        const sprintSelect = new StringSelectMenuBuilder()
          .setCustomId(`sprint_pick_${type}_${forum.id}_${interaction.user.id}`)
          .setPlaceholder("🏃 Select a sprint (optional)…")
          .setMinValues(1)
          .setMaxValues(1);
        active.forEach((s) =>
          sprintSelect.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(s.name)
              .setValue(s.id)
              .setDescription(s.goal?.slice(0, 90) || ""),
          ),
        );

        const embed = new EmbedBuilder()
          .setTitle("🏃 Optional: Select Sprint")
          .setDescription(
            "Choose a sprint to assign this issue to before submitting. You can also set it later with `/sprint set`.",
          )
          .setColor(0x5865f2);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          sprintSelect,
        );
        const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`continue_no_sprint_${type}_${forum.id}_${interaction.user.id}`)
            .setLabel("Continue without sprint")
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.update({ embeds: [embed], components: [row, actions] });
        return;
      }

      if (type === "bug-report") {
        await bugReportForm.showTemplateSelection(interaction, {
          targetForum: forum,
        });
      } else if (type === "feature-request") {
        await featureRequestWorkflow.showFeatureRequestForm(interaction, {
          targetForum: forum,
          preselectedCategory: forum.category,
        });
      } else {
        console.warn(`[ForumSelectionUI] Unknown type: ${type}`);
        await interaction.reply({
          content: `❌ Unknown type: ${type}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("[ForumSelectionUI] Proceed handler error:", error);
      try {
        const msg = error instanceof Error ? error.message : String(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: `❌ Failed to proceed: ${msg}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: `❌ Failed to proceed: ${msg}`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyErr) {
        console.error(
          "[ForumSelectionUI] Failed to send proceed error message:",
          replyErr,
        );
      }
    }
  }

  private async handleHelpButton(
    interaction: ButtonInteraction,
  ): Promise<void> {
    const helpEmbed = new EmbedBuilder()
      .setTitle("📚 Forum Selection Help")
      .setDescription("Guide to choosing the right forum for your issue")
      .setColor(0x5865f2)
      .addFields([
        {
          name: "🎨 Frontend Team",
          value:
            "Choose for:\n• UI/UX bugs and visual issues\n• Responsive design problems\n• Browser compatibility issues\n• Frontend feature requests",
          inline: true,
        },
        {
          name: "⚙️ Backend Team",
          value:
            "Choose for:\n• API bugs and server errors\n• Database issues\n• Performance problems\n• Backend feature requests",
          inline: true,
        },
        {
          name: "🔧 DevOps Team",
          value:
            "Choose for:\n• Deployment issues\n• CI/CD problems\n• Infrastructure concerns\n• Monitoring and alerts",
          inline: true,
        },
        {
          name: "🧪 QA Team",
          value:
            "Choose for:\n• Test failures\n• Regression bugs\n• Quality assurance issues\n• Testing automation",
          inline: true,
        },
        {
          name: "❓ Support Team",
          value:
            "Choose for:\n• General questions\n• Documentation issues\n• User support requests\n• How-to questions",
          inline: true,
        },
        {
          name: "💭 Product Team",
          value:
            "Choose for:\n• Product feedback\n• User experience suggestions\n• Feature prioritization\n• Product strategy input",
          inline: true,
        },
      ])
      .setFooter({
        text: "Still unsure? Choose Support Team for general questions.",
      });

    await interaction.reply({
      embeds: [helpEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleCancelButton(
    interaction: ButtonInteraction,
  ): Promise<void> {
    await interaction.update({
      content: "❌ Forum selection cancelled.",
      embeds: [],
      components: [],
    });
  }

  private async handleBackButton(
    interaction: ButtonInteraction,
  ): Promise<void> {
    // Go back to team selection
    const userId = interaction.customId.split("_")[2];
    const options: ForumSelectionOptions = {
      type: "bug-report", // This should be extracted from context
      userId,
      guildId: interaction.guildId || "",
    };

    const { embeds, components } = this.createForumSelection(options);
    await interaction.update({ embeds, components });
  }
}

// Global instance
export const forumSelectionUI = new ForumSelectionUI();
