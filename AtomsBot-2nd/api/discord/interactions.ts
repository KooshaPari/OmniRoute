import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} from "discord-interactions";

// Discord interactions handler for Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify Discord interaction signature
    const signature = req.headers["x-signature-ed25519"] as string;
    const timestamp = req.headers["x-signature-timestamp"] as string;
    const body = JSON.stringify(req.body);
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!publicKey) {
      return res
        .status(500)
        .json({ error: "Discord public key not configured" });
    }

    const isValidRequest = verifyKey(body, signature, timestamp, publicKey);
    if (!isValidRequest) {
      return res.status(401).json({ error: "Invalid request signature" });
    }

    const interaction = req.body;

    // Handle ping from Discord
    if (interaction.type === InteractionType.PING) {
      return res.status(200).json({
        type: InteractionResponseType.PONG,
      });
    }

    // Handle application commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      return await handleApplicationCommand(interaction, res);
    }

    // Handle message components (buttons, select menus)
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      return await handleMessageComponent(interaction, res);
    }

    // Handle modal submissions
    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      return await handleModalSubmit(interaction, res);
    }

    return res.status(400).json({ error: "Unknown interaction type" });
  } catch (error) {
    console.error("Discord interaction error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleApplicationCommand(interaction: any, res: VercelResponse) {
  const { data } = interaction;

  console.log(`Received command: ${data.name}`);

  // Route to appropriate command handler
  switch (data.name) {
    case "bug-report":
      return await handleBugReportCommand(interaction, res);
    case "feature-request":
      return await handleFeatureRequestCommand(interaction, res);
    case "jira-link":
      return await handleJiraLinkCommand(interaction, res);
    case "jira":
      return await handleJiraCommand(interaction, res);
    case "dashboard":
      return await handleDashboardCommand(interaction, res);
    case "issue":
      return await handleIssueCommand(interaction, res);
    default:
      return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ Unknown command: ${data.name}`,
          flags: 64, // Ephemeral
        },
      });
  }
}

async function handleMessageComponent(interaction: any, res: VercelResponse) {
  const { data } = interaction;

  console.log(`Received component interaction: ${data.custom_id}`);

  // Handle button clicks and select menu interactions
  // This would route to your button handlers

  return res.status(200).json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

async function handleModalSubmit(interaction: any, res: VercelResponse) {
  const { data } = interaction;

  console.log(`Received modal submission: ${data.custom_id}`);

  // Handle modal form submissions
  // This would route to your modal handlers

  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "✅ Form submitted successfully!",
      flags: 64, // Ephemeral
    },
  });
}

// Command handlers (simplified versions for serverless)
async function handleBugReportCommand(interaction: any, res: VercelResponse) {
  // Return a modal for bug report
  return res.status(200).json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: "bug-report-modal",
      title: "Bug Report",
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: "bug_title",
              label: "Bug Title",
              style: 1, // Short
              placeholder: "Brief description of the bug",
              required: true,
              max_length: 100,
            },
          ],
        },
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: "bug_description",
              label: "Description",
              style: 2, // Paragraph
              placeholder: "Detailed description of the bug...",
              required: true,
              max_length: 2000,
            },
          ],
        },
      ],
    },
  });
}

async function handleFeatureRequestCommand(
  interaction: any,
  res: VercelResponse,
) {
  // Similar to bug report but for features
  return res.status(200).json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: "feature-request-modal",
      title: "Feature Request",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "feature_title",
              label: "Feature Title",
              style: 1,
              placeholder: "Brief description of the feature",
              required: true,
              max_length: 100,
            },
          ],
        },
      ],
    },
  });
}

async function handleJiraLinkCommand(interaction: any, res: VercelResponse) {
  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content:
        "🔷 Jira integration commands are available! Use the subcommands to link, create, or manage Jira issues.",
      flags: 64,
    },
  });
}

async function handleJiraCommand(interaction: any, res: VercelResponse) {
  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content:
        "🔷 Jira management commands are available! Use the subcommands to search, view, or manage Jira issues.",
      flags: 64,
    },
  });
}

async function handleDashboardCommand(interaction: any, res: VercelResponse) {
  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "📊 Loading dashboard...",
      flags: 64,
    },
  });
}

async function handleIssueCommand(interaction: any, res: VercelResponse) {
  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "📋 Loading issue details...",
      flags: 64,
    },
  });
}
