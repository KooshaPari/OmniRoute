import { framework } from "../src/discord/framework/index";
import { SmartEmbedBuilder } from "../src/discord/framework/SmartEmbedBuilder";

async function run() {
  await framework.initialize({ persistence: false });
  const sm: any = (framework as any).stateManager;
  const embedBuilder = new SmartEmbedBuilder({ id: 'integration-embed', title: 'Integration Test' });

  // Simulate test cleanup without await
  try { sm.cleanup(); } catch {}

  const embedState = embedBuilder.getState();
  const compatibleState = {
    id: embedState.id,
    channelId: 'test-channel-789',
    embedData: embedState.embedData,
    components: embedState.components,
    metadata: embedState.metadata,
    lastUpdated: embedState.lastUpdated,
    version: embedState.version,
    autoUpdate: false
  };

  sm.registerState(compatibleState);
  const registeredState = sm.getState(embedState.id);
  console.log('registered?', !!registeredState, registeredState?.embedData?.title);
}

run();

