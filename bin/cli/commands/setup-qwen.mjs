/**
 * omniroute setup-qwen — configure Qwen Code (QwenLM/qwen-code) for OmniRoute.
 *
 * Qwen Code is a terminal AI agent with a file-based config at
 * ~/.qwen/settings.json. For a custom OpenAI-compatible endpoint it uses a
 * `modelProviders` entry with authType "openai", baseUrl WITH /v1, and an
 * `envKey` naming the env var holding the key (secret stays in the env, never the
 * file). Remote-aware; headless test via `qwen -p "..."`.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  mergeQwenCodeEnv,
  mergeQwenCodeSettings,
  normalizeQwenCodeBaseUrl,
} from "../../../src/shared/services/qwenCodeConfig.ts";
import { resolveActiveContext } from "../contexts.mjs";
import { createPrompt, printError, printHeading, printInfo, printSuccess } from "../io.mjs";

/** Resolve base URL and key from flags, active context, then local defaults. */
export function resolveQwenTarget(opts = {}) {
  let root = opts.remote ? String(opts.remote) : "";
  let context;

  if (!root || !(opts.apiKey ?? opts["api-key"])) {
    try {
      context = resolveActiveContext(opts.context ?? process.env.OMNIROUTE_CONTEXT);
    } catch {
      // An active context is optional for local setup.
    }
  }

/** Merge the OmniRoute modelProvider into Qwen's settings.json (preserve rest). */
export function buildQwenSettings(existing, { baseUrl, model }) {
  const s = existing && typeof existing === "object" ? { ...existing } : {};
  const providers = Array.isArray(s.modelProviders)
    ? s.modelProviders.filter((p) => p?.id !== "omniroute")
    : [];
  providers.push({
    id: "omniroute",
    name: "OmniRoute",
    authType: "openai",
    baseUrl,
    envKey: "OMNIROUTE_API_KEY",
  });
  s.modelProviders = providers;
  if (model) {
    s.selectedProvider = "omniroute";
    s.model = model;
  }

  const apiKey =
    opts.apiKey ??
    opts["api-key"] ??
    context?.accessToken ??
    context?.apiKey ??
    process.env.OMNIROUTE_API_KEY ??
    "sk_omniroute";

  return { baseUrl: normalizeQwenCodeBaseUrl(root), apiKey };
}

const readSettings = (filePath) => {
  if (!existsSync(filePath)) return {};
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Qwen Code settings.json must contain a JSON object");
  }
  return parsed;
};

const readText = (filePath) => (existsSync(filePath) ? readFileSync(filePath, "utf8") : "");

const writeAtomic = (filePath, content, mode) => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, content, { encoding: "utf8", mode });
    if (mode !== undefined) chmodSync(tempPath, mode);
    renameSync(tempPath, filePath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // The temporary file may not have been created.
    }
    throw error;
  }
};

const fetchModelIds = async (baseUrl, apiKey) => {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body.data ?? body.models ?? []);
    return list.map((m) => (typeof m === "string" ? m : m?.id)).filter(Boolean);
  } catch {
    return [];
  }
};

export async function runSetupQwenCommand(opts = {}) {
  const { baseUrl, apiKey } = resolveQwenTarget(opts);
  const dryRun = Boolean(opts.dryRun ?? opts["dry-run"]);
  const configPath =
    opts.configPath ?? opts["config-path"] ?? join(os.homedir(), ".qwen", "settings.json");

  printHeading("OmniRoute → Qwen Code (OpenAI-compatible)");
  printInfo(`baseUrl: ${baseUrl}`);

  let model = String(opts.model || "").trim();
  if (!model && !opts.yes) {
    const modelIds = await fetchModelIds(baseUrl, apiKey);
    if (modelIds.length > 0) {
      printInfo(`Examples: ${modelIds.slice(0, 20).join(", ")}${modelIds.length > 20 ? " …" : ""}`);
    }
    const prompt = createPrompt();
    try {
      model = String(await prompt.ask("Model id for Qwen Code")).trim();
    } finally {
      prompt.close();
    }
  }

  if (!model) {
    printError("A model is required. Pass --model <id>.");
    return 2;
  }

  try {
    const settings = mergeQwenCodeSettings(readSettings(settingsPath), { baseUrl, model });
    const envText = mergeQwenCodeEnv(readText(envPath), apiKey);
    const settingsText = `${JSON.stringify(settings, null, 2)}\n`;

    if (dryRun) {
      console.log(`\n${settingsText}`);
      printInfo(`[dry-run] settings → ${settingsPath}`);
      printInfo(`[dry-run] credential → ${envPath} (OMNIROUTE_API_KEY)`);
      return 0;
    }

    mkdirSync(path.dirname(settingsPath), { recursive: true, mode: 0o700 });
    mkdirSync(path.dirname(envPath), { recursive: true, mode: 0o700 });
    writeAtomic(settingsPath, settingsText);
    writeAtomic(envPath, envText, 0o600);
    printSuccess(`Wrote ${settingsPath}`);
    printSuccess(`Updated ${envPath} (OMNIROUTE_API_KEY only)`);
    printInfo('Run: qwen   (or headless: qwen -p "reply OK")');
    return 0;
  } catch (error) {
    printError(`Failed to configure Qwen Code: ${error?.message || error}`);
    return 1;
  }
  printInfo(
    "\nProvide the key (settings reference OMNIROUTE_API_KEY):  export OMNIROUTE_API_KEY=..."
  );
  printInfo('Then run:  qwen        (or headless: qwen -p "reply OK")');
  return 0;
}

export function registerSetupQwen(program) {
  program
    .command("setup-qwen")
    .description(
      "Configure Qwen Code for OmniRoute: write ~/.qwen/settings.json (openai modelProvider)"
    )
    .option("--port <port>", "Local OmniRoute port (ignored when --remote is set)", "20128")
    .option("--remote <url>", "Remote OmniRoute URL")
    .option("--api-key <key>", "OmniRoute API key")
    .option("--model <id>", "Model id for Qwen Code")
    .option("--config-path <path>", "Qwen Code settings.json path")
    .option("--env-path <path>", "Qwen Code .env path")
    .option("--yes", "Non-interactive; requires --model")
    .option("--dry-run", "Print settings without writing files or secrets")
    .action(async (opts) => {
      const code = await runSetupQwenCommand(opts);
      if (code !== 0) process.exitCode = code;
    });
}
