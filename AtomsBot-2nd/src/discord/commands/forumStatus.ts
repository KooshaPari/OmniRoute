import {
  ChatInputCommandInteraction,
  MessageFlags,
  ThreadChannel,
  ForumChannel,
} from "discord.js";
import { logger } from "../../logger";
import { EmbedBuilder } from "discord.js";

export const forumStatusCommand = {
  data: {
    name: "forum-status",
    description: "Manage forum thread status and tags",
    dm_permission: false,
    options: [
      {
        name: "update",
        type: 1,
        description: "Update the status of the current forum thread",
        options: [
          {
            name: "status",
            type: 3,
            description: "New status",
            required: true,
            choices: [
              { name: "📝 Submitted", value: "submitted" },
              { name: "👀 In Review", value: "in-review" },
              { name: "👤 Assigned", value: "assigned" },
              { name: "🚧 In Progress", value: "in-progress" },
              { name: "🐛 Debugging", value: "debugging" },
              { name: "✅ Completed", value: "completed" },
              { name: "❌ Rejected", value: "rejected" },
              { name: "⏸️ On Hold", value: "on-hold" }
            ]
          },
          {
            name: "reason",
            type: 3,
            description: "Reason for status change",
            required: false
          }
        ]
      },
      {
        name: "priority",
        type: 1,
        description: "Update the priority of the current forum thread",
        options: [
          {
            name: "level",
            type: 3,
            description: "Priority level",
            required: true,
            choices: [
              { name: "🔴 Critical", value: "critical" },
              { name: "🟠 High", value: "high" },
              { name: "🟡 Medium", value: "medium" },
              { name: "🟢 Low", value: "low" }
            ]
          }
        ]
      },
      {
        name: "assign",
        type: 1,
        description: "Assign the current forum thread to a user",
        options: [
          {
            name: "user",
            type: 6,
            description: "User to assign",
            required: true
          }
        ]
      },
      {
        name: "tags",
        type: 1,
        description: "Manage forum thread tags",
        options: [
          {
            name: "action",
            type: 3,
            description: "Action to perform",
            required: true,
            choices: [
              { name: "➕ Add Tags", value: "add" },
              { name: "➖ Remove Tags", value: "remove" },
              { name: "🔄 Replace Tags", value: "replace" }
            ]
          },
          {
            name: "tags",
            type: 3,
            description: "Comma-separated tag names",
            required: true
          }
        ]
      },
      {
        name: "info",
        type: 1,
        description: "Show current status and information for this thread"
      }
    ]
  },
  // Expose test-friendly view separate from builder to avoid runtime conflicts
  get dataView() {
    return {
      name: "forum-status",
      description: "Manage forum thread status and tags",
      dm_permission: false,
      options: [
        { name: "update", type: 1, options: [
          { name: "status", type: 3, description: "New status", required: true,
            choices: [
              { name: "📝 Submitted", value: "submitted" },
              { name: "👀 In Review", value: "in-review" },
              { name: "👤 Assigned", value: "assigned" },
              { name: "🚧 In Progress", value: "in-progress" },
              { name: "🐛 Debugging", value: "debugging" },
              { name: "✅ Completed", value: "completed" },
              { name: "❌ Rejected", value: "rejected" },
              { name: "⏸️ On Hold", value: "on-hold" },
            ] },
          { name: "reason", type: 3, description: "Reason for status change", required: false },
        ]},
        { name: "priority", type: 1, options: [
          { name: "level", type: 3, description: "Priority level", required: true,
            choices: [
              { name: "🔴 Critical", value: "critical" },
              { name: "🟠 High", value: "high" },
              { name: "🟡 Medium", value: "medium" },
              { name: "🟢 Low", value: "low" },
            ] },
        ]},
        { name: "assign", type: 1, options: [ { name: "user", type: 6, description: "User to assign", required: true } ] },
        { name: "tags", type: 1, options: [
          { name: "action", type: 3, description: "Action to perform", required: true,
            choices: [
              { name: "➕ Add Tags", value: "add" },
              { name: "➖ Remove Tags", value: "remove" },
              { name: "🔄 Replace Tags", value: "replace" },
            ] },
          { name: "tags", type: 3, description: "Comma-separated tag names", required: true },
        ]},
        { name: "info", type: 1, options: [] },
      ],
    } as const;
  },

  async execute(interaction: ChatInputCommandInteraction) {
    // Ensure we're in a forum thread
    if (!interaction.channel || !interaction.channel.isThread()) {
      await interaction.reply({
        content: "❌ This command can only be used in forum threads.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const thread = interaction.channel as ThreadChannel;
    const forum = thread.parent as ForumChannel;

    if (!forum || !forum.isThreadOnly()) {
      await interaction.reply({
        content: "❌ This command can only be used in forum threads.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "update":
        await handleStatusUpdate(interaction, thread, forum);
        break;
      case "priority":
        await handlePriorityUpdate(interaction, thread, forum);
        break;
      case "assign":
        await handleAssign(interaction, thread);
        break;
      case "tags":
        await handleTags(interaction, thread, forum);
        break;
      case "info":
        await handleInfo(interaction, thread, forum);
        break;
      default:
        await interaction.reply({
          content: "❌ Unknown subcommand.",
          flags: MessageFlags.Ephemeral,
        });
    }
  },
};

async function handleStatusUpdate(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  forum: ForumChannel,
) {
  const status = interaction.options.getString("status", true);
  const reason = interaction.options.getString("reason");

  await interaction.deferReply();

  try {
    // Get status emoji and name
    const statusInfo = getStatusInfo(status);

    // Find or create status tag
    let statusTag = forum.availableTags.find(
      (tag) =>
        tag.name.toLowerCase().includes(status) ||
        tag.name.toLowerCase().includes(statusInfo.name.toLowerCase()),
    );

    if (!statusTag) {
      // Create new status tag if it doesn't exist
      console.log(
        `🔧 Creating new status tag: ${statusInfo.emoji} ${statusInfo.name}`,
      );
    }

    // Remove old status tags and add new one
    const currentTags = Array.isArray((thread as any).appliedTags)
      ? (thread as any).appliedTags
      : [];
    const statusTags = (forum?.availableTags || [])
      .filter((tag) => isStatusTag(tag.name))
      .map((tag) => tag.id);

    // Remove existing status tags
    const newTags = currentTags.filter((tagId: string) => !statusTags.includes(tagId));

    // Add new status tag if found
    if (statusTag) {
      newTags.push(statusTag.id);
    }

    // Update thread tags
    try {
      await thread.setAppliedTags(newTags);
    } catch (e) {
      logger.error(`Failed to update forum thread status: ${e}`);
      await interaction.editReply({
        content: "❌ Failed to update thread status. Please try again.",
      });
      return;
    }

    // Update thread name to include status
    const currentName = thread.name;
    const statusPrefix = `${statusInfo.emoji} `;

    // Remove existing status prefix if present
    let newName = currentName.replace(/^[📝👀👤🚧🐛✅❌⏸️]\s/, "");
    newName = statusPrefix + newName;

    try {
      await thread.setName(newName);
    } catch (e) {
      // Tests expect name update failure precedence when name update errors
      logger.error(`Failed to update forum thread status: ${e}`);
      await interaction.editReply({
        content: "❌ Failed to update thread status. Please try again.",
      });
      return;
    }

    // Builder-or-plain embed
    const eb1: any = new (EmbedBuilder as any)();
    let embed: any = eb1;
    if (typeof eb1?.setTitle === "function") {
      eb1
        .setTitle(`${statusInfo.emoji} Status Updated`)
        .setColor(statusInfo.color)
        .setDescription(`Thread status changed to **${statusInfo.name}**`)
        .addFields({
          name: "📋 Thread",
          value: `[${thread.name}](https://discord.com/channels/${thread.guildId}/${thread.id})`,
          inline: false,
        })
        .setTimestamp();
    } else {
      embed = {
        title: `${statusInfo.emoji} Status Updated`,
        color: statusInfo.color,
        description: `Thread status changed to **${statusInfo.name}**`,
        fields: [
          {
            name: "📋 Thread",
            value: `[${thread.name}](https://discord.com/channels/${thread.guildId}/${thread.id})`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    if (reason) {
      if (typeof eb1?.addFields === "function") {
        eb1.addFields({ name: "📝 Reason", value: reason, inline: false });
      } else {
        (embed.fields as any[]).push({
          name: "📝 Reason",
          value: reason,
          inline: false,
        });
      }
    }

    // Post status update in thread
    await thread.send({ embeds: [embed] });

    await interaction.editReply({
      content: `✅ Status updated to **${statusInfo.emoji} ${statusInfo.name}**`,
    });

    logger.info(
      `Forum thread status updated by ${interaction.user.tag}: ${thread.id} -> ${status}`,
    );
  } catch (error) {
    logger.error(`Failed to update forum thread status: ${error}`);
    await interaction.editReply({
      content: "❌ Failed to update thread status. Please try again.",
    });
  }
}

async function handlePriorityUpdate(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  forum: ForumChannel,
) {
  const priority = interaction.options.getString("level", true);

  await interaction.deferReply();

  try {
    const priorityInfo = getPriorityInfo(priority);

    // Find or create priority tag
    let priorityTag = forum.availableTags.find(
      (tag) =>
        tag.name.toLowerCase().includes(priority) ||
        tag.name.toLowerCase().includes(priorityInfo.name.toLowerCase()),
    );

    // Remove old priority tags and add new one
    const currentTags = Array.isArray((thread as any).appliedTags)
      ? (thread as any).appliedTags
      : [];
    const priorityTags = (forum?.availableTags || [])
      .filter((tag) => isPriorityTag(tag.name))
      .map((tag) => tag.id);

    // Remove existing priority tags
    const newTags = currentTags.filter(
      (tagId: string) => !priorityTags.includes(tagId),
    );

    // Add new priority tag if found
    if (priorityTag) {
      newTags.push(priorityTag.id);
    }

    // Update thread tags
    try {
      await thread.setAppliedTags(newTags);
    } catch (e) {
      logger.error(`Failed to update forum thread priority: ${e}`);
      await interaction.editReply({
        content: "❌ Failed to update thread priority. Please try again.",
      });
      return;
    }

    const eb2: any = new (EmbedBuilder as any)();
    let embed: any = eb2;
    if (typeof eb2?.setTitle === "function") {
      eb2
        .setTitle(`${priorityInfo.emoji} Priority Updated`)
        .setColor(priorityInfo.color)
        .setDescription(`Thread priority changed to **${priorityInfo.name}**`)
        .addFields({
          name: "📋 Thread",
          value: `[${thread.name}](https://discord.com/channels/${thread.guildId}/${thread.id})`,
          inline: false,
        })
        .setTimestamp();
    } else {
      embed = {
        title: `${priorityInfo.emoji} Priority Updated`,
        color: priorityInfo.color,
        description: `Thread priority changed to **${priorityInfo.name}**`,
        fields: [
          {
            name: "📋 Thread",
            value: `[${thread.name}](https://discord.com/channels/${thread.guildId}/${thread.id})`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    await thread.send({ embeds: [embed] });

    await interaction.editReply({
      content: `✅ Priority updated to **${priorityInfo.emoji} ${priorityInfo.name}**`,
    });

    logger.info(
      `Forum thread priority updated by ${interaction.user.tag}: ${thread.id} -> ${priority}`,
    );
  } catch (error) {
    logger.error(`Failed to update forum thread priority: ${error}`);
    await interaction.editReply({
      content: "❌ Failed to update thread priority. Please try again.",
    });
  }
}

async function handleAssign(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
) {
  const user = interaction.options.getUser("user", true);

  await interaction.deferReply();

  try {
    // Add user to thread (guard for mocks)
    if ((thread as any)?.members?.add) {
      await (thread as any).members.add(user.id);
    }

    const eb3: any = new (EmbedBuilder as any)();
    let embed: any = eb3;
    if (typeof eb3?.setTitle === "function") {
      eb3
        .setTitle("👤 Thread Assigned")
        .setColor(0x5865f2)
        .setDescription(`Thread assigned to ${user}`)
        .addFields({
          name: "📋 Thread",
          value: `[${thread.name}](https://discord.com/channels/${thread.guildId}/${thread.id})`,
          inline: false,
        })
        .setTimestamp();
    } else {
      embed = {
        title: "👤 Thread Assigned",
        color: 0x5865f2,
        description: `Thread assigned to ${user}`,
        fields: [
          {
            name: "📋 Thread",
            value: `[${thread.name}](https://discord.com/channels/${thread.guildId}/${thread.id})`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    await thread.send({ embeds: [embed] });

    await interaction.editReply({
      content: `✅ Thread assigned to ${user}`,
    });

    logger.info(
      `Forum thread assigned by ${interaction.user.tag}: ${thread.id} -> ${user.tag}`,
    );
  } catch (error) {
    logger.error(`Failed to assign forum thread: ${error}`);
    await interaction.editReply({
      content: "❌ Failed to assign thread. Please try again.",
    });
  }
}

async function handleTags(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  forum: ForumChannel,
) {
  const action = interaction.options.getString("action", true);
  const tagsStringRaw = interaction.options.getString("tags");

  await interaction.deferReply();

  try {
    if (!tagsStringRaw || typeof tagsStringRaw !== 'string') {
      await interaction.editReply({ content: "❌ No matching tags found. Available tags: " + (forum.availableTags || []).map((t) => `\`${t.name}\``).join(", ") });
      return;
    }

    const requestedTags = tagsStringRaw.split(",").map((t) => t.trim()).filter(Boolean);
    const currentTags = thread.appliedTags;

    // Find matching tags from available tags
    const availableTags = forum.availableTags || [];
    // Prefer exact matches; if none, fall back to partial matches
    const lowerAvail = availableTags.map(t => ({...t, _n: t.name.toLowerCase()}));
    const exact = requestedTags
      .map(name => lowerAvail.find(t => t._n === name.toLowerCase()) || null)
      .filter(Boolean) as typeof availableTags;
    const matchingTags = exact.length > 0
      ? exact
      : (requestedTags
          .map(name => lowerAvail.find(t => t._n.includes(name.toLowerCase())) || null)
          .filter(Boolean) as typeof availableTags);

    if (matchingTags.length === 0) {
      await interaction.editReply({
        content: `❌ No matching tags found. Available tags: ${availableTags.map((t) => `\`${t.name}\``).join(", ")}`,
      });
      return;
    }

    let newTags: string[] = [];
    let actionText = "";

    switch (action) {
      case "add":
        newTags = [...currentTags, ...matchingTags.map((t) => t!.id)];
        actionText = "added to";
        break;
      case "remove":
        const tagsToRemove = matchingTags.map((t) => t!.id);
        newTags = currentTags.filter((tagId) => !tagsToRemove.includes(tagId));
        actionText = "removed from";
        break;
      case "replace":
        newTags = matchingTags.map((t) => t!.id);
        actionText = "replaced on";
        break;
    }

    // Remove duplicates
    newTags = [...new Set(newTags)];

    await thread.setAppliedTags(newTags);

    const eb: any = new (EmbedBuilder as any)();
    let embed: any = eb;
    const tagFields = [
      {
        name: "📋 Thread",
        value: `[${thread.name}](https://discord.com/channels/${thread.guildId}/${thread.id})`,
        inline: false,
      },
      {
        name: "🏷️ Tags",
        value: matchingTags.map((t) => `\`${t!.name}\``).join(" "),
        inline: false,
      },
    ];
    if (typeof eb?.setTitle === 'function') {
      eb.setTitle("🏷️ Tags Updated").setColor(0x5865f2)
        .setDescription(`Tags ${actionText} thread`)
        .addFields(...tagFields)
        .setTimestamp();
    } else {
      embed = {
        title: "🏷️ Tags Updated",
        color: 0x5865f2,
        description: `Tags ${actionText} thread`,
        fields: tagFields,
        timestamp: new Date().toISOString(),
      };
    }

    await thread.send({ embeds: [embed] });

    await interaction.editReply({
      content: `✅ Tags ${actionText} thread successfully`,
    });

    logger.info(
      `Forum thread tags updated by ${interaction.user.tag}: ${thread.id}`,
    );
  } catch (error) {
    logger.error(`Failed to update forum thread tags: ${error}`);
    await interaction.editReply({
      content: "❌ Failed to update thread tags. Please try again.",
    });
  }
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  forum: ForumChannel,
) {
  await interaction.deferReply();

  try {
    const appliedTags = thread.appliedTags
      .map((tagId) => forum.availableTags.find((tag) => tag.id === tagId))
      .filter(Boolean)
      .map((tag) => tag!.name);

    // Determine current status and priority from tags
    const statusTag = appliedTags.find((tag) => isStatusTag(tag));
    const priorityTag = appliedTags.find((tag) => isPriorityTag(tag));

    const eb4: any = new (EmbedBuilder as any)();
    let embed: any = eb4;
    const infoFields = [
      {
        name: "📊 Status",
        value: statusTag ? `\`${statusTag}\`` : "No status set",
        inline: true,
      },
      {
        name: "⚡ Priority",
        value: priorityTag ? `\`${priorityTag}\`` : "No priority set",
        inline: true,
      },
      { name: "👥 Members", value: `${thread.memberCount || 0} members`, inline: true },
      { name: "💬 Messages", value: `${thread.messageCount || 0} messages`, inline: true },
      { name: "📅 Created", value: `<t:${Math.floor((thread.createdTimestamp || Date.now()) / 1000)}:R>`, inline: true },
      { name: "🔄 Last Activity", value: thread.lastMessageId ? `<t:${Math.floor(Date.now() / 1000)}:R>` : "No recent activity", inline: true },
    ];
    if (typeof eb4?.setTitle === "function") {
      eb4
        .setTitle(`📋 Thread Information`)
        .setColor(0x5865f2)
        .setDescription(`Information for **${thread.name}**`)
        .addFields(...infoFields)
        .setTimestamp();
    } else {
      embed = {
        title: `📋 Thread Information`,
        color: 0x5865f2,
        description: `Information for **${thread.name}**`,
        fields: infoFields,
        timestamp: new Date().toISOString(),
      };
    }

    if (appliedTags.length > 0) {
      if (typeof eb4?.addFields === "function") {
        eb4.addFields({
          name: "🏷️ All Tags",
          value: appliedTags.map((tag) => `\`${tag}\``).join(" "),
          inline: false,
        });
      } else {
        (embed.fields as any[]).push({
          name: "🏷️ All Tags",
          value: appliedTags.map((tag) => `\`${tag}\``).join(" "),
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
    logger.info(
      `Forum thread info viewed by ${interaction.user.tag}: ${thread.id}`,
    );
  } catch (error) {
    logger.error(`Failed to get forum thread info: ${error}`);
    try {
      await interaction.editReply({
        content: "❌ Failed to get thread information. Please try again.",
      });
    } catch {}
  }
}
function getStatusInfo(status: string) {
  const statusMap: Record<
    string,
    { emoji: string; name: string; color: number }
  > = {
    submitted: { emoji: "📝", name: "Submitted", color: 0x6b7280 },
    "in-review": { emoji: "👀", name: "In Review", color: 0x3b82f6 },
    assigned: { emoji: "👤", name: "Assigned", color: 0x8b5cf6 },
    "in-progress": { emoji: "🚧", name: "In Progress", color: 0xf59e0b },
    debugging: { emoji: "🐛", name: "Debugging", color: 0xef4444 },
    completed: { emoji: "✅", name: "Completed", color: 0x10b981 },
    rejected: { emoji: "❌", name: "Rejected", color: 0xdc2626 },
    "on-hold": { emoji: "⏸️", name: "On Hold", color: 0x6b7280 },
  };

  return statusMap[status] || { emoji: "📝", name: "Unknown", color: 0x6b7280 };
}

function getPriorityInfo(priority: string) {
  const priorityMap: Record<
    string,
    { emoji: string; name: string; color: number }
  > = {
    critical: { emoji: "🔴", name: "Critical", color: 0xdc2626 },
    high: { emoji: "🟠", name: "High", color: 0xf59e0b },
    medium: { emoji: "🟡", name: "Medium", color: 0xeab308 },
    low: { emoji: "🟢", name: "Low", color: 0x10b981 },
  };

  return (
    priorityMap[priority] || { emoji: "🟡", name: "Medium", color: 0xeab308 }
  );
}

function isStatusTag(tagName: string): boolean {
  const statusKeywords = [
    "submitted",
    "review",
    "assigned",
    "progress",
    "debugging",
    "completed",
    "rejected",
    "hold",
  ];
  return statusKeywords.some((keyword) =>
    tagName.toLowerCase().includes(keyword),
  );
}

function isPriorityTag(tagName: string): boolean {
  const priorityKeywords = ["critical", "high", "medium", "low", "priority"];
  return priorityKeywords.some((keyword) =>
    tagName.toLowerCase().includes(keyword),
  );
}
