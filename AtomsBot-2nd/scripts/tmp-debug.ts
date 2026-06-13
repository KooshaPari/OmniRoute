import { priorityCommand } from '../src/discord/commands/priority';

async function run() {
  const interaction: any = {
    channelId: 'validation_thread',
    channel: { id: 'chan', name: 'x', isThread: undefined },
    options: {
      getString: (opt: string) => (opt === 'level' ? 'invalid_priority' : null),
    },
    replied: false,
    deferred: false,
    reply: function (this: any, opts: any) { this.replied = true; console.log('reply called', opts); return Promise.resolve(); },
    deferReply: function (this: any, _opts: any) { this.deferred = true; console.log('defer called'); return Promise.resolve(); },
    editReply: function (this: any, opts: any) { console.log('edit called', opts); return Promise.resolve(); },
  };
  // minimal store
  const storeMod = await import('../src/store');
  (storeMod as any).store.threads.push({ id: 'validation_thread', number: 1, repoOwner: 'test', repoName: 'repo' });

  await priorityCommand.execute(interaction as any);
  console.log('done; replied?', interaction.replied, 'deferred?', interaction.deferred);
}
run().catch(e => { console.error('ERR', e); process.exit(1); });
