import { REST, Routes } from "discord.js";
import { config } from "../config";
import { secretsStore } from "../settings/SecretsStore";
import { commandList } from "./commands";
import { logger } from "../logger";

export async function registerCommands(guildId?: string) {
  try {
    // Construct REST client per invocation so tests can observe calls
    const rest = new REST();
    const token = (await secretsStore.get('discord_token')) || (config.DISCORD_TOKEN as any);
    rest.setToken(token);
    logger.info("Started refreshing application (/) commands.");

    // Serialize command data robustly; log errors for invalid definitions
    let hadError = false;
    const truncate = (s: any, n: number) => {
      try { return (typeof s === 'string' && s.length > n) ? s.slice(0, n) : s; } catch { return s; }
    };
    const sanitize = (node: any): any => {
      try {
        if (!node || typeof node !== 'object') return node;
        // Clamp description to Discord's 100-char limit on any node
        if (typeof node.description === 'string') {
          node.description = truncate(node.description, 100);
        }
        const t = node.type;
        // Subcommand group (2): only allow subcommands (1) inside
        if (t === 2 && Array.isArray(node.options)) {
          node.options = node.options.filter((o: any) => o && o.type === 1).map((o: any) => sanitize(o));
        }
        // Subcommand (1): its options must not contain nested subcommands/groups
        if (t === 1 && Array.isArray(node.options)) {
          node.options = node.options.filter((o: any) => o && o.type !== 1 && o.type !== 2).map((o: any) => sanitize(o));
        }
        // Options: drop invalid choices/autocomplete combos
        if (typeof t === 'number' && Array.isArray(node.choices)) {
          if (![3,4,10].includes(t)) {
            delete node.choices;
          }
        }
        if (node.autocomplete && Array.isArray(node.choices) && node.choices.length > 0) {
          delete node.choices;
        }
        if (Array.isArray(node.options)) node.options = node.options.map((o: any) => sanitize(o));
        // Also clamp nested choice descriptions/names
        if (Array.isArray(node.choices)) {
          node.choices = node.choices.map((c: any) => ({
            ...c,
            name: truncate(c?.name, 100),
            description: truncate(c?.description, 100),
          }));
        }
      } catch {}
      return node;
    };

    const commandData = (commandList as any[]).map((command: any, idx: number) => {
      try {
        const d = command?.data;
        if (!d) throw new Error('Command data missing');
        if (typeof d.toJSON === 'function') {
          const json = d.toJSON();
          return sanitize(json);
        }
        if (typeof d === 'object') {
          const isJsonLike = 'name' in d && (('description' in d) || ('type' in d));
          if (isJsonLike) return sanitize({ ...(d as any) });
          throw new Error('Invalid command JSON shape');
        }
        throw new Error('Invalid command definition');
    } catch {
      hadError = true;
        try { (logger as any).error?.(`registerCommands: failed to serialize command at index ${idx}`); } catch {}
        return undefined;
      }
    }).filter((x) => x !== undefined);

    if (hadError) {
      logger.error(`Failed to register commands: One or more command definitions are invalid`);
    }

    // Treat empty string as an explicit guild registration (per tests)
    // Log command indexes and names to help debug field path errors
    try {
      (commandData as any[]).forEach((c: any, i: number) => {
        const name = c?.name || '(unknown)';
        (logger as any).info?.(`(/) idx=${i} name=${name}`);
      });
    } catch {}

    if (guildId !== undefined) {
      // Register commands for a specific guild (faster for development)
      const appId = (await secretsStore.get('discord_client_id')) || config.DISCORD_CLIENT_ID;
      await rest.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: commandData },
      );
      logger.info(
        `Successfully reloaded ${commandData.length} application (/) commands for guild ${guildId}.`,
      );
    } else {
      // Register commands globally (takes up to 1 hour to propagate)
      const appId2 = (await secretsStore.get('discord_client_id')) || config.DISCORD_CLIENT_ID;
      await rest.put(Routes.applicationCommands(appId2), {
        body: commandData,
      });
      logger.info(
        `Successfully reloaded ${commandData.length} application (/) commands globally.`,
      );
    }
  } catch (error) {
    logger.error(`Failed to register commands: ${error}`);
  }
}

// Note: Do not auto-run here to remain ESM-safe. Use registerCommands() from application startup.
