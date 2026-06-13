import { REST, Routes } from "discord.js";
import { config } from "../src/config";
import { logger } from "../src/logger";

async function main() {
  try {
    const rest = new REST().setToken(config.DISCORD_TOKEN);

    logger.info("Fetching current global application commands...");

    const existing: any = await rest.get(
      Routes.applicationCommands(config.DISCORD_CLIENT_ID),
    );

    logger.info(`Found ${Array.isArray(existing) ? existing.length : 0} global commands.`);

    logger.info("Pruning all global application commands...");

    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
      body: [],
    });

    logger.info("✅ Pruned all global commands.");
    logger.info("You can now re-run the bot to register guild-scoped commands only.");
  } catch (error) {
    logger.error(`Failed to prune global commands: ${error}`);
    process.exitCode = 1;
  }
}

main();

