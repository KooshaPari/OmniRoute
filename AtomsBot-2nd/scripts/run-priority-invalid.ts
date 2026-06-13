import { priorityCommand } from '../src/discord/commands/priority';

const interaction: any = {
  channelId: 'thread_invalid_priority',
  options: { getString: (name: string) => name === 'level' ? 'invalid' : null },
  reply: (opts: any) => { console.log('reply called', opts); return Promise.resolve(); },
};

(async () => {
  process.env.NODE_ENV = 'test';
  await priorityCommand.execute(interaction);
})();
