import {
  Client,
  Events,
  GatewayIntentBits,
  SimpleShardingStrategy,
} from "discord.js";
import { config } from "../config";
import { secretsStore } from "../settings/SecretsStore";
import {
  handleChannelUpdate,
  handleClientReady,
  handleMessageCreate,
  handleMessageDelete,
  handleThreadCreate,
  handleThreadDelete,
  handleThreadUpdate,
  handleInteractionCreate,
} from "./discordHandlers";

// Import forum selection UI to ensure handlers are registered
import "./components/ForumSelectionUI";
import { framework } from "./framework";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  ws: {
    buildStrategy: (manager) => {
      return new (class CompressionSimpleShardingStrategy extends SimpleShardingStrategy {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(manager: any) {
          manager.options.compression = null;
          super(manager);
        }
      })(manager);
    },
  },
});

export async function initDiscord() {
  // Initialize Smart Embed Framework (non-blocking). If SMART_EMBED_REFRESH_INTERVAL is set,
  // framework will auto-enable background refresh of smart embeds.
  try { void framework.initialize(); } catch {}
  client.once(Events.ClientReady, handleClientReady);
  client.on(Events.ThreadCreate, handleThreadCreate);
  client.on(Events.ThreadUpdate, handleThreadUpdate);
  client.on(Events.ChannelUpdate, handleChannelUpdate);
  client.on(Events.MessageCreate, handleMessageCreate);
  client.on(Events.ThreadDelete, handleThreadDelete);
  client.on(Events.MessageDelete, handleMessageDelete);
  client.on(Events.InteractionCreate, handleInteractionCreate);

  const token = (await secretsStore.get('discord_token')) || config.DISCORD_TOKEN;
  client.login(token);
}

export default client;
