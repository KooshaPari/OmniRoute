import { AntigravityExecutor } from "./antigravity.ts";
import { GithubExecutor } from "./github.ts";
import { QoderExecutor } from "./qoder.ts";
import { KiroExecutor } from "./kiro.ts";
import { CodexExecutor } from "./codex.ts";
import { CursorExecutor } from "./cursor.ts";
import { DefaultExecutor } from "./default.ts";
import { PollinationsExecutor } from "./pollinations.ts";
import { CloudflareAIExecutor } from "./cloudflare-ai.ts";
import { OpencodeExecutor } from "./opencode.ts";
import { PuterExecutor } from "./puter.ts";
import { VertexExecutor } from "./vertex.ts";
import { CliproxyapiExecutor } from "./cliproxyapi.ts";
import { PerplexityWebExecutor } from "./perplexity-web.ts";
import { GrokWebExecutor } from "./grok-web.ts";
import { ChatGptWebExecutor } from "./chatgpt-web.ts";
import { BlackboxWebExecutor } from "./blackbox-web.ts";
import { MuseSparkWebExecutor } from "./muse-spark-web.ts";
import { AzureOpenAIExecutor } from "./azure-openai.ts";
import { GitlabExecutor } from "./gitlab.ts";
import { NlpCloudExecutor } from "./nlpcloud.ts";
<<<<<<< Updated upstream
import { WindsurfExecutor } from "./windsurf.ts";
import { DevinCliExecutor } from "./devin-cli.ts";
import { AuggieExecutor } from "./auggie.ts";
import { DeepSeekWebExecutor } from "./deepseek-web.ts";
import { DeepSeekWebWithAutoRefreshExecutor } from "./deepseek-web-with-auto-refresh.ts";
import { AdaptaWebExecutor } from "./adapta-web.ts";
import { ClaudeWebWithAutoRefresh } from "./claude-web-with-auto-refresh.ts";
import { CopilotWebExecutor } from "./copilot-web.ts";
import { CopilotM365WebExecutor } from "./copilot-m365-web.ts";
import { VeoAIFreeWebExecutor } from "./veoaifree-web.ts";
import { DuckDuckGoWebExecutor } from "./duckduckgo-web.ts";
import { T3ChatWebExecutor } from "./t3-chat-web.ts";
import { ClaudeWebExecutor } from "./claude-web.ts";
import { InnerAiExecutor } from "./inner-ai.ts";
import { HuggingChatExecutor } from "./huggingchat.ts";
import { PoeWebExecutor } from "./poe-web.ts";
import { VeniceWebExecutor } from "./venice-web.ts";
import { V0VercelWebExecutor } from "./v0-vercel-web.ts";
import { KimiWebExecutor } from "./kimi-web.ts";
import { DoubaoWebExecutor } from "./doubao-web.ts";
import { QwenWebExecutor } from "./qwen-web.ts";
import { KimiExecutor } from "./kimi.ts";
import { TheOldLlmExecutor } from "./theoldllm.ts";
import { ChipotleExecutor } from "./chipotle.ts";
import { LMArenaExecutor } from "./lmarena.ts";
import { MimocodeExecutor } from "./mimocode.ts";
import { GrokCliExecutor } from "./grok-cli.ts";
import { CodeBuddyCnExecutor } from "./codebuddy-cn.ts";
import { ZenmuxFreeExecutor } from "./zenmux-free.ts";

const executors = {
  antigravity: new AntigravityExecutor(),
  agy: new AntigravityExecutor(),
=======
import { PetalsExecutor } from "./petals.ts";

const executors = {
  antigravity: new AntigravityExecutor(),
  "gemini-cli": new GeminiCLIExecutor(),
>>>>>>> Stashed changes
  github: new GithubExecutor(),
  qoder: new QoderExecutor(),
  kiro: new KiroExecutor(),
  "amazon-q": new KiroExecutor("amazon-q"),
  codex: new CodexExecutor(),
  cursor: new CursorExecutor(),
  cu: new CursorExecutor(), // Alias for cursor
  "azure-openai": new AzureOpenAIExecutor(),
  gitlab: new GitlabExecutor(),
  "gitlab-duo": new GitlabExecutor("gitlab-duo"),
  nlpcloud: new NlpCloudExecutor(),
  petals: new PetalsExecutor(),
  pollinations: new PollinationsExecutor(),
  pol: new PollinationsExecutor(), // Alias
  "cloudflare-ai": new CloudflareAIExecutor(),
  cf: new CloudflareAIExecutor(), // Alias
  "opencode-zen": new OpencodeExecutor("opencode-zen"),
  "opencode-go": new OpencodeExecutor("opencode-go"),
  puter: new PuterExecutor(),
  pu: new PuterExecutor(), // Alias
  vertex: new VertexExecutor(),
  "vertex-partner": new VertexExecutor(),
  cliproxyapi: new CliproxyapiExecutor(),
  cpa: new CliproxyapiExecutor(), // Alias
  "perplexity-web": new PerplexityWebExecutor(),
  "pplx-web": new PerplexityWebExecutor(), // Alias
  "grok-web": new GrokWebExecutor(),
  "chatgpt-web": new ChatGptWebExecutor(),
  "cgpt-web": new ChatGptWebExecutor(), // Alias
  "blackbox-web": new BlackboxWebExecutor(),
  "bb-web": new BlackboxWebExecutor(), // Alias
  "muse-spark-web": new MuseSparkWebExecutor(),
  "ms-web": new MuseSparkWebExecutor(), // Alias
<<<<<<< Updated upstream
  windsurf: new WindsurfExecutor(),
  ws: new WindsurfExecutor(), // Alias
  "devin-cli": new DevinCliExecutor(),
  devin: new DevinCliExecutor(), // Alias
  "deepseek-web": new DeepSeekWebWithAutoRefreshExecutor(),
  "ds-web": new DeepSeekWebWithAutoRefreshExecutor(), // Alias
  "adapta-web": new AdaptaWebExecutor(),
  "adp-web": new AdaptaWebExecutor(), // Alias
  "copilot-web": new CopilotWebExecutor(),
  "copilot-m365-web": new CopilotM365WebExecutor(),
  copilot: new CopilotWebExecutor(), // Alias
  "veoaifree-web": new VeoAIFreeWebExecutor(),
  "veo-free": new VeoAIFreeWebExecutor(), // Alias
  "duckduckgo-web": new DuckDuckGoWebExecutor(),
  ddgw: new DuckDuckGoWebExecutor(), // Alias
  "t3-web": new T3ChatWebExecutor(),
  t3chat: new T3ChatWebExecutor(), // Alias
  "inner-ai": new InnerAiExecutor(),
  "in-ai": new InnerAiExecutor(), // Alias
  huggingchat: new HuggingChatExecutor(),
  hc: new HuggingChatExecutor(), // Alias
  "poe-web": new PoeWebExecutor(),
  poe: new PoeWebExecutor(), // Alias
  "venice-web": new VeniceWebExecutor(),
  ven: new VeniceWebExecutor(), // Alias
  "v0-vercel-web": new V0VercelWebExecutor(),
  v0: new V0VercelWebExecutor(), // Alias
  "kimi-web": new KimiWebExecutor(),
  "kimi-coding-apikey": new KimiExecutor(), // Alias
  "kimi-coding": new KimiExecutor(), // Alias
  "doubao-web": new DoubaoWebExecutor(),
  db: new DoubaoWebExecutor(), // Alias
  "qwen-web": new QwenWebExecutor(),
  qw: new QwenWebExecutor(), // Alias
  theoldllm: new TheOldLlmExecutor(),
  tllm: new TheOldLlmExecutor(), // Alias
  chipotle: new ChipotleExecutor(),
  pepper: new ChipotleExecutor(), // Alias
  lmarena: new LMArenaExecutor(),
  lma: new LMArenaExecutor(), // Alias
  mimocode: new MimocodeExecutor(),
  mcode: new MimocodeExecutor(), // Alias
  "grok-cli": new GrokCliExecutor(),
  gc: new GrokCliExecutor(), // Alias
  "codebuddy-cn": new CodeBuddyCnExecutor(),
  cbcn: new CodeBuddyCnExecutor(), // Alias for codebuddy-cn
  "zenmux-free": new ZenmuxFreeExecutor(),
  zmf: new ZenmuxFreeExecutor(), // Alias for zenmux-free
  auggie: new AuggieExecutor(),
=======
>>>>>>> Stashed changes
};

const defaultCache = new Map();

export function getExecutor(provider) {
  if (executors[provider]) return executors[provider];
  if (!defaultCache.has(provider)) defaultCache.set(provider, new DefaultExecutor(provider));
  return defaultCache.get(provider);
}

export function hasSpecializedExecutor(provider) {
  return !!executors[provider];
}

export { BaseExecutor } from "./base.ts";
export { AntigravityExecutor } from "./antigravity.ts";
export { GithubExecutor } from "./github.ts";
export { QoderExecutor } from "./qoder.ts";
export { KiroExecutor } from "./kiro.ts";
export { CodexExecutor } from "./codex.ts";
export { CursorExecutor } from "./cursor.ts";
export { DefaultExecutor } from "./default.ts";
export { PollinationsExecutor } from "./pollinations.ts";
export { CloudflareAIExecutor } from "./cloudflare-ai.ts";
export { OpencodeExecutor } from "./opencode.ts";
export { PuterExecutor } from "./puter.ts";
export { CliproxyapiExecutor } from "./cliproxyapi.ts";
export { VertexExecutor } from "./vertex.ts";
export { PerplexityWebExecutor } from "./perplexity-web.ts";
export { GrokWebExecutor } from "./grok-web.ts";
export { ChatGptWebExecutor } from "./chatgpt-web.ts";
export { BlackboxWebExecutor } from "./blackbox-web.ts";
export { MuseSparkWebExecutor } from "./muse-spark-web.ts";
export { AzureOpenAIExecutor } from "./azure-openai.ts";
export { GitlabExecutor } from "./gitlab.ts";
export { NlpCloudExecutor } from "./nlpcloud.ts";
<<<<<<< Updated upstream
export { WindsurfExecutor } from "./windsurf.ts";
export { DevinCliExecutor } from "./devin-cli.ts";
export { AuggieExecutor } from "./auggie.ts";
export { CopilotWebExecutor } from "./copilot-web.ts";
export { CopilotM365WebExecutor } from "./copilot-m365-web.ts";
export { VeoAIFreeWebExecutor } from "./veoaifree-web.ts";
export { DuckDuckGoWebExecutor } from "./duckduckgo-web.ts";
export { ClaudeWebExecutor } from "./claude-web.ts";
export { DeepSeekWebExecutor } from "./deepseek-web.ts";
export { DeepSeekWebWithAutoRefreshExecutor } from "./deepseek-web-with-auto-refresh.ts";
export { AdaptaWebExecutor } from "./adapta-web.ts";
export { T3ChatWebExecutor } from "./t3-chat-web.ts";
export { InnerAiExecutor } from "./inner-ai.ts";
export { QwenWebExecutor } from "./qwen-web.ts";
export { TheOldLlmExecutor } from "./theoldllm.ts";
export { ChipotleExecutor } from "./chipotle.ts";
export { LMArenaExecutor } from "./lmarena.ts";
export { MimocodeExecutor } from "./mimocode.ts";
export { GrokCliExecutor } from "./grok-cli.ts";
export { CodeBuddyCnExecutor } from "./codebuddy-cn.ts";
export { ZenmuxFreeExecutor } from "./zenmux-free.ts";
=======
export { PetalsExecutor } from "./petals.ts";
>>>>>>> Stashed changes
