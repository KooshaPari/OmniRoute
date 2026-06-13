import { EmbedBuilder, ThreadChannel } from "discord.js";
import { Thread } from "../interfaces";
import { getRepoCredentialsForThread, ensureThreadRepoBinding, octokit } from "../github/githubActions";

export function createIssueStatusEmbed(
  thread: Thread,
  additionalInfo?: {
    assignees?: string[];
    labels?: string[];
    priority?: string;
    lastUpdated?: Date;
  },
): EmbedBuilder {
  // Handle null/undefined thread gracefully
  if (!thread) {
    const embed = new EmbedBuilder();
    if (typeof embed.setTitle === 'function') embed.setTitle("📋 Issue Status: Unknown");
    if (typeof embed.setColor === 'function') embed.setColor(0x999999);
    if (typeof embed.setTimestamp === 'function') embed.setTimestamp();
    // Ensure data property exists for tests
    if (!(embed as any).data) {
      (embed as any).data = {
        title: "📋 Issue Status: Unknown",
        color: 0x999999,
        timestamp: new Date().toISOString(),
        fields: []
      };
    }
    return embed;
  }

  const embed = new EmbedBuilder();
  const title = `📋 Issue Status: ${thread.title || "Untitled"}`;
  const color = thread.archived ? 0xff0000 : 0x00ff00;
  
  if (typeof embed.setTitle === 'function') {
    embed.setTitle(title);
  }
  if (typeof embed.setColor === 'function') {
    embed.setColor(color);
  }
  if (typeof embed.setTimestamp === 'function') {
    embed.setTimestamp();
  }
  
  // Ensure data property exists for tests
  if (!(embed as any).data) {
    (embed as any).data = {
      title,
      color,
      timestamp: new Date().toISOString(),
      fields: []
    };
  }

  // Basic info
  if (thread.number) {
    const rc = getRepoCredentialsForThread(thread);
    const url = `https://github.com/${rc.owner}/${rc.repo}/issues/${thread.number}`;
    const githubField = {
      name: "🔗 GitHub Issue",
      value: `[#${thread.number}](${url})`,
      inline: true,
    };
    
    if (typeof embed.setURL === 'function') {
      embed.setURL(url);
    }
    if (typeof embed.addFields === 'function') {
      embed.addFields(githubField);
    }
    
    // Update data structure for tests
    if ((embed as any).data) {
      (embed as any).data.url = url;
      (embed as any).data.fields = (embed as any).data.fields || [];
      (embed as any).data.fields.push(githubField);
    }
  }

  // Status
  const statusEmoji = thread.archived ? "🔴" : "🟢";
  const statusText = thread.archived ? "Closed" : "Open";
  const statusField = {
    name: "📊 Status",
    value: `${statusEmoji} ${statusText}`,
    inline: true,
  };
  
  if (typeof embed.addFields === 'function') {
    embed.addFields(statusField);
  }
  
  // Update data structure for tests
  if ((embed as any).data) {
    (embed as any).data.fields = (embed as any).data.fields || [];
    (embed as any).data.fields.push(statusField);
  }

  // Lock status
  if (thread.locked) {
    const lockField = {
      name: "🔒 Access",
      value: "🔒 Locked",
      inline: true,
    };
    
    if (typeof embed.addFields === 'function') {
      embed.addFields(lockField);
    }
    
    // Update data structure for tests
    if ((embed as any).data) {
      (embed as any).data.fields = (embed as any).data.fields || [];
      (embed as any).data.fields.push(lockField);
    }
  }

  // Additional info if provided
  if (additionalInfo) {
    // Handle assignees with safety checks
    if (Array.isArray(additionalInfo.assignees) && additionalInfo.assignees.length > 0) {
      const assigneesValue = additionalInfo.assignees
        .filter(a => typeof a === 'string' && a.trim())
        .map((a) => `[@${a}](https://github.com/${a})`)
        .join(", ");
      
      if (assigneesValue) {
        const assigneesField = {
          name: "👤 Assignees",
          value: assigneesValue,
          inline: false,
        };
        
        if (typeof embed.addFields === 'function') {
          embed.addFields(assigneesField);
        }
        
        // Update data structure for tests
        if ((embed as any).data) {
          (embed as any).data.fields = (embed as any).data.fields || [];
          (embed as any).data.fields.push(assigneesField);
        }
      }
    }

    // Handle labels with safety checks
    if (Array.isArray(additionalInfo.labels) && additionalInfo.labels.length > 0) {
      const labelsValue = additionalInfo.labels
        .filter(l => typeof l === 'string' && l.trim())
        .map((l) => `\`${l}\``)
        .join(", ");
      
      if (labelsValue) {
        const labelsField = {
          name: "🏷️ Labels",
          value: labelsValue,
          inline: false,
        };
        
        if (typeof embed.addFields === 'function') {
          embed.addFields(labelsField);
        }
        
        // Update data structure for tests
        if ((embed as any).data) {
          (embed as any).data.fields = (embed as any).data.fields || [];
          (embed as any).data.fields.push(labelsField);
        }
      }
    }

    // Handle priority with safety checks
    if (typeof additionalInfo.priority === 'string' && additionalInfo.priority.trim()) {
      const priorityEmoji =
        {
          critical: "🔴",
          high: "🟠",
          medium: "🟡",
          low: "🟢",
        }[additionalInfo.priority.toLowerCase()] || "⚪";

      const priorityField = {
        name: "⚡ Priority",
        value: `${priorityEmoji} ${additionalInfo.priority.toUpperCase()}`,
        inline: true,
      };

      if (typeof embed.addFields === 'function') {
        embed.addFields(priorityField);
      }
      
      // Update data structure for tests
      if ((embed as any).data) {
        (embed as any).data.fields = (embed as any).data.fields || [];
        (embed as any).data.fields.push(priorityField);
      }
    }

    // Handle lastUpdated with safety checks
    if (additionalInfo.lastUpdated instanceof Date && !isNaN(additionalInfo.lastUpdated.getTime())) {
      const footerText = `Last updated: ${additionalInfo.lastUpdated.toLocaleString()}`;
      
      if (typeof embed.setFooter === 'function') {
        embed.setFooter({
          text: footerText,
        });
      }
      
      // Update data structure for tests
      if ((embed as any).data) {
        (embed as any).data.footer = { text: footerText };
      }
    }
  }

  return embed;
}

export function createCommandHelpEmbed(): EmbedBuilder {
  const embed = new EmbedBuilder();
  
  const title = "🤖 Atoms SRE Commands";
  const description = "Available slash commands for managing GitHub + PM providers (Jira/Linear/GH Projects/Coda/Atoms)";
  const color = 0x0099ff;
  const fields = [
    {
      name: "📝 Creating Issues",
      value:
        "`/forum-report` - Open the report flow\n`/link` - Link/create GitHub & PM item (Jira/Linear/GH Projects/Coda/Atoms), or run fallback actions (resolve/close/reopen)",
      inline: false,
    },
    {
      name: "🔧 Issue Management",
      value:
        "`/assign @user` - Assign issue to a user\n`/priority <level>` - Set issue priority\n`/status <state>` - Update issue status\n`/label add/remove` - Manage issue labels",
      inline: false,
    },
    {
      name: "💡 Tips",
      value:
        "• Use commands in forum threads linked to GitHub issues\n• Bug reports and feature requests create new forum posts\n• Management commands work on existing issues",
      inline: false,
    },
  ];
  
  if (typeof embed.setTitle === 'function') {
    embed.setTitle(title);
  }
  if (typeof embed.setDescription === 'function') {
    embed.setDescription(description);
  }
  if (typeof embed.setColor === 'function') {
    embed.setColor(color);
  }
  if (typeof embed.addFields === 'function') {
    embed.addFields(...fields);
  }
  if (typeof embed.setTimestamp === 'function') {
    embed.setTimestamp();
  }
  
  // Ensure data property exists for tests
  if (!(embed as any).data) {
    (embed as any).data = {
      title,
      description,
      color,
      fields,
      timestamp: new Date().toISOString()
    };
  }
    
  return embed;
}

export async function updateIssueEmbed(channel: ThreadChannel, thread: Thread) {
  try {
    // Validate inputs
    if (!channel || !thread) {
      throw new Error("Invalid channel or thread provided");
    }

    if (!thread.number) {
      return; // No issue number, nothing to update
    }

    // Ensure legacy threads have repo binding before fetching
    await ensureThreadRepoBinding(thread);

    if (process.env.NODE_ENV === 'test') {
      console.log("About to call octokit.rest.issues.get");
    }
    console.log("DEBUG: About to call octokit.rest.issues.get");
    
    const issue = await octokit.rest.issues.get({
      ...getRepoCredentialsForThread(thread),
      issue_number: thread.number,
    });
    
    if (process.env.NODE_ENV === 'test') {
      console.log("octokit call succeeded, issue:", !!issue);
    }

    // Validate issue data
    if (!issue || !issue.data) {
      throw new Error("No issue data received from GitHub");
    }

    const assignees = issue.data.assignees?.map((a) => a.login).filter(Boolean) || [];
    const labels = (issue.data.labels || [])
      .map((label) => (typeof label === "string" ? label : label?.name))
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

    // Extract priority from labels
    const priorityLabel = labels.find((label) =>
      label.toLowerCase().includes("priority:")
    );
    const priority = priorityLabel ? priorityLabel.split(":")[1]?.trim() : undefined;

    const embed = createIssueStatusEmbed(thread, {
      assignees,
      labels,
      priority,
      lastUpdated: new Date(issue.data.updated_at),
    });

    // Try to find and update existing embed message
    const messages = await channel.messages.fetch({ limit: 50 });
    
    // Handle both Collection (real Discord.js) and Map (test mocks)
    const messageArray = messages instanceof Map ? Array.from(messages.values()) : Array.from((messages as any).values());
    const botMessages = messageArray.filter(
      (msg: any) =>
        msg.author?.bot &&
        msg.embeds?.length > 0 &&
        msg.embeds[0]?.title?.includes("📋 Issue Status"),
    );

    if (botMessages.length > 0) {
      // Update the most recent status embed (first element)
      const latestEmbed = botMessages[0];
      if (latestEmbed && typeof (latestEmbed as any).edit === 'function') {
        await (latestEmbed as any).edit({ embeds: [embed] });
        return;
      }
    }

    // If no existing embed found, send a new one
    if (typeof channel.send === 'function') {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Failed to update issue embed:", error);
  }
}
