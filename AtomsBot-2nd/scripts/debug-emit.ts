import { vi } from 'vitest';
import { StateManager } from '../src/discord/framework/StateManager';

async function main() {
  const manager = new StateManager();
  const state: any = {
    id: 'debug-1',
    messageId: 'm1',
    channelId: 'c1',
    embedData: { title: 't' },
    components: [],
    metadata: {},
    lastUpdated: new Date(),
    version: 1,
    autoUpdate: false,
  };

  manager.registerState(state);
  const spy = vi.spyOn(manager as any, 'emit');
  await manager.updateField('debug-1', 'embedData.title', 'X');
  console.log('emit calls:', spy.mock.calls.map((c) => c[0]));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

