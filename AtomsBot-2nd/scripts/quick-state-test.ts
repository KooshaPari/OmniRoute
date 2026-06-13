import { stateManager } from "../src/discord/framework/StateManager";

async function main() {
  const id = "quick-test-embed";
  stateManager.registerState({
    id,
    channelId: "c1",
    embedData: { title: "t" },
    components: [],
    metadata: {},
    lastUpdated: new Date(),
    version: 1,
    autoUpdate: false,
  } as any);

  const got = stateManager.getState(id);
  console.log("registered?", !!got);
  console.log("global?", (globalThis as any).__SMART_EMBED_STATE_REGISTRY__?.[id] ? true : false);
}

main();

