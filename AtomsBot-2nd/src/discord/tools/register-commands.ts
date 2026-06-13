import { registerCommands } from "../registerCommands";

async function main() {
  const guildId = process.env.GUILD_ID || process.argv[2];
  await registerCommands(guildId);
  console.log(`Registered slash commands ${guildId ? `for guild ${guildId}` : 'globally'}`);
}

main().catch((e) => {
  console.error('Failed to register commands:', e);
  process.exit(1);
});

