import { framework } from "../src/discord/framework/index";

async function main() {
  await framework.initialize({ persistence: false });
  const sm: any = (framework as any).stateManager;
  const id = "quick-fw-test";
  sm.registerState({
    id,
    channelId: "c2",
    embedData: { title: "z" },
    components: [],
    metadata: {},
    lastUpdated: new Date(),
    version: 1,
    autoUpdate: false,
  });
  const got = sm.getState(id);
  console.log("fw registered?", !!got);
}

main();

