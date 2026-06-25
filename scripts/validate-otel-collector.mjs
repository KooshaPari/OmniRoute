#!/usr/bin/env node
// scripts/validate-otel-collector.mjs
// =============================================================================
// PR-010 — OpenTelemetry Collector config validator.
// =============================================================================
// Parses collector.yaml and enforces the hard rules that PR-010 introduces:
//   - every receiver declared at top level MUST be referenced by a pipeline
//   - every exporter declared at top level MUST be referenced by a pipeline
//   - `memory_limiter` MUST appear in every pipeline (OOM protection)
//   - `batch` MUST appear in every pipeline
//   - `attributes/redact` MUST strip cookie / authorization / x-api-key
//   - `tail_sampling` MUST be present in the traces pipeline with a 100% errors
//     policy and a 10% probabilistic baseline (overridable via env override)
//   - `.env.example` MUST document all env vars referenced in the config
//
// Exit codes:
//   0 — all checks pass
//   1 — one or more checks failed (printed to stderr)
//   2 — file not found / parse error
//
// CLI usage:
//   node scripts/validate-otel-collector.mjs --config deploy/otel-collector/collector.yaml
//
// Programmatic usage (from tests):
//   import { validateCollectorConfig, REQUIRED_REDACT_HEADERS } from "./scripts/validate-otel-collector.mjs";
//   const { ok, errors } = validateCollectorConfig(yamlString, envExampleString);
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Headers that `attributes/redact` MUST delete by default (PR-010 hard rule). */
export const REQUIRED_REDACT_HEADERS = [
  "http.request.header.cookie",
  "http.request.header.authorization",
  "http.request.header.x-api-key",
];

/** Env vars that collector.yaml references via ${env:NAME} — MUST be in .env.example. */
export const REQUIRED_ENV_VARS = [
  "OTEL_AUTH_TOKEN",
  "DEPLOYMENT_ENV",
  "JAEGER_ENDPOINT",
  "TEMPO_ENDPOINT",
  "HONEYCOMB_API_KEY",
  "HONEYCOMB_DATASET",
  "DATADOG_API_KEY",
  "PROMETHEUS_REMOTE_WRITE_URL",
  "SAMPLING_PROBABILITY",
  "REDACT_HEADERS",
  "LOG_LEVEL",
  "COLLECTOR_PORT",
  "OTEL_RESOURCE_ATTRIBUTES",
];

/**
 * Shell-provided / platform env vars that the collector may legitimately read
 * (HOSTNAME from k8s, PATH for entrypoint discovery, etc.). These are not
 * configuration knobs and don't need to be documented in .env.example.
 */
export const PLATFORM_ENV_VARS = new Set([
  "HOSTNAME",
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "PWD",
  "LANG",
  "TERM",
  "HOSTTYPE",
  "OSTYPE",
  "MACHTYPE",
]);

/** Pipeline signals validated. The traces signal is mandatory; metrics/logs optional. */
const PIPELINE_SIGNALS = ["traces", "metrics", "logs"];

/** Required processors in EVERY pipeline (PR-010 hard rule). */
const REQUIRED_IN_EVERY_PIPELINE = ["memory_limiter", "batch"];

// -----------------------------------------------------------------------------
// YAML helpers
// -----------------------------------------------------------------------------

/**
 * Extract all env-var references of the form `${env:NAME}` from a string.
 * Returns a deduplicated array preserving first-seen order.
 */
export function extractEnvRefs(text) {
  const out = [];
  const seen = new Set();
  const re = /\$\{env:([A-Z_][A-Z0-9_]*)\b[^}]*\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * Pull all attribute keys referenced in `attributes/<name>` processors
 * (looking for `key:` entries under `actions:`).
 */
function collectAttributeKeys(processor) {
  const keys = new Set();
  if (!processor || typeof processor !== "object") return keys;
  const actions = Array.isArray(processor.actions) ? processor.actions : [];
  for (const a of actions) {
    if (a && typeof a.key === "string") keys.add(a.key);
  }
  return keys;
}

// -----------------------------------------------------------------------------
// Core validator
// -----------------------------------------------------------------------------

/**
 * Validate a collector.yaml string + a .env.example string against PR-010 rules.
 *
 * @param {string} yamlText      — full contents of collector.yaml
 * @param {string} [envText]     — full contents of .env.example (optional; if
 *                                 omitted, env-var documentation is skipped)
 * @returns {{ ok: boolean, errors: string[], warnings: string[], summary: object }}
 */
export function validateCollectorConfig(yamlText, envText) {
  const errors = [];
  const warnings = [];

  let doc;
  try {
    doc = yaml.load(yamlText);
  } catch (e) {
    return {
      ok: false,
      errors: [`YAML parse error: ${e.message}`],
      warnings: [],
      summary: {},
    };
  }
  if (!doc || typeof doc !== "object") {
    return {
      ok: false,
      errors: ["collector.yaml is empty or not a mapping at the root"],
      warnings: [],
      summary: {},
    };
  }

  const receivers = doc.receivers || {};
  const processors = doc.processors || {};
  const exporters = doc.exporters || {};
  const pipelines = (doc.service && doc.service.pipelines) || {};

  const receiverNames = Object.keys(receivers);
  const processorNames = Object.keys(processors);
  const exporterNames = Object.keys(exporters);

  const summary = {
    receivers: receiverNames.length,
    processors: processorNames.length,
    exporters: exporterNames.length,
    pipelines: Object.keys(pipelines).length,
  };

  // ---- Rule 1: every receiver is referenced in a pipeline ------------------
  const usedReceivers = new Set();
  for (const signal of Object.keys(pipelines)) {
    for (const r of pipelines[signal].receivers || []) usedReceivers.add(r);
  }
  for (const name of receiverNames) {
    if (!usedReceivers.has(name)) {
      errors.push(
        `receiver "${name}" is declared but never used by any pipeline`,
      );
    }
  }

  // ---- Rule 2: every exporter is referenced in a pipeline ------------------
  const usedExporters = new Set();
  for (const signal of Object.keys(pipelines)) {
    for (const e of pipelines[signal].exporters || []) usedExporters.add(e);
  }
  for (const name of exporterNames) {
    if (!usedExporters.has(name)) {
      errors.push(
        `exporter "${name}" is declared but never used by any pipeline`,
      );
    }
  }

  // ---- Rule 3 + 4: memory_limiter + batch in every pipeline -----------------
  for (const signal of Object.keys(pipelines)) {
    const procs = new Set(pipelines[signal].processors || []);
    for (const required of REQUIRED_IN_EVERY_PIPELINE) {
      if (!procs.has(required)) {
        // Some processors use slash-namespacing (e.g. "memory_limiter/egress").
        // The PR-010 rule allows either the bare name or any variant beginning
        // with `<bare>/`. Check the family prefix as well.
        const familyOk = [...procs].some(
          (p) => p === required || p.startsWith(`${required}/`),
        );
        if (!familyOk) {
          errors.push(
            `pipeline "${signal}" is missing required processor "${required}" (every pipeline must include memory_limiter + batch)`,
          );
        }
      }
    }
  }

  // ---- Rule 5: attributes/redact strips cookie / authorization / x-api-key -
  const redactProc = processors["attributes/redact"];
  if (!redactProc) {
    errors.push(
      'processor "attributes/redact" is not defined (MANDATORY for PR-010)',
    );
  } else {
    const keys = collectAttributeKeys(redactProc);
    for (const required of REQUIRED_REDACT_HEADERS) {
      if (!keys.has(required)) {
        errors.push(
          `attributes/redact must delete "${required}" (PR-010 hard rule: strip PII / secrets)`,
        );
      }
    }
  }

  // ---- Rule 6: tail_sampling configured correctly in traces -----------------
  const traces = pipelines.traces;
  if (!traces) {
    errors.push('pipeline "traces" is missing (MANDATORY)');
  } else {
    const procs = traces.processors || [];
    if (!procs.includes("tail_sampling")) {
      errors.push(
        'pipeline "traces" must include "tail_sampling" (PR-010 hard rule)',
      );
    } else {
      const ts = processors["tail_sampling"];
      if (!ts || !Array.isArray(ts.policies) || ts.policies.length === 0) {
        errors.push("tail_sampling is configured without any policies");
      } else {
        const hasErrorsPolicy = ts.policies.some(
          (p) =>
            p &&
            p.type === "status_code" &&
            p.status_code &&
            Array.isArray(p.status_code.status_codes) &&
            p.status_code.status_codes.includes("ERROR"),
        );
        if (!hasErrorsPolicy) {
          errors.push(
            "tail_sampling must include a status_code policy that captures ERROR (100% on errors)",
          );
        }
        const hasProbabilistic = ts.policies.some(
          (p) => p && p.type === "probabilistic",
        );
        if (!hasProbabilistic) {
          errors.push(
            "tail_sampling must include a probabilistic baseline policy (10% default)",
          );
        } else {
          // Warn if baseline is way off (operator can override via env)
          const baseline = ts.policies.find((p) => p.type === "probabilistic");
          const pct =
            baseline && baseline.probabilistic
              ? baseline.probabilistic.sampling_percentage
              : null;
          if (pct !== null && pct !== 10 && pct !== 100) {
            warnings.push(
              `tail_sampling probabilistic baseline is ${pct}% (PR-010 default: 10%)`,
            );
          }
        }
      }
    }
  }

  // ---- Rule 7: every env var referenced is documented in .env.example -----
  if (envText !== undefined) {
    const referenced = extractEnvRefs(yamlText).filter(
      (n) => !PLATFORM_ENV_VARS.has(n),
    );
    const documented = new Set();
    for (const line of envText.split(/\r?\n/)) {
      // Accept both active (`FOO=bar`) and commented (`# FOO=bar` / `#FOO=bar`)
      // declarations — the commented form is intentional documentation when
      // the operator hasn't filled in a real value yet.
      const m = line.match(/^\s*#?\s*([A-Z_][A-Z0-9_]*)\s*=/);
      if (m) documented.add(m[1]);
    }
    for (const name of referenced) {
      if (!documented.has(name)) {
        errors.push(
          `env var "${name}" is referenced in collector.yaml but not documented in .env.example`,
        );
      }
    }
    // Also warn on documented-but-unused (less critical)
    const referencedSet = new Set(referenced);
    for (const name of REQUIRED_ENV_VARS) {
      if (!referencedSet.has(name) && !documented.has(name)) {
        warnings.push(
          `REQUIRED env var "${name}" is not documented in .env.example (consider adding it)`,
        );
      }
    }
  }

  // ---- Soft warnings -------------------------------------------------------
  if (receiverNames.length === 0) {
    errors.push("collector.yaml declares zero receivers (useless collector)");
  }
  if (Object.keys(pipelines).length === 0) {
    errors.push("collector.yaml has no pipelines defined under service.pipelines");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}

// -----------------------------------------------------------------------------
// CLI entry
// -----------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { config: null, env: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config" || a === "-c") {
      out.config = argv[++i];
    } else if (a === "--env" || a === "-e") {
      out.env = argv[++i];
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/validate-otel-collector.mjs [options]",
      "",
      "Options:",
      "  -c, --config <path>   path to collector.yaml (default: deploy/otel-collector/collector.yaml)",
      "  -e, --env    <path>   path to .env.example (default: deploy/otel-collector/.env.example)",
      "  -h, --help            show this help",
      "",
      "Exit codes: 0 = ok, 1 = validation failed, 2 = parse error / missing file",
    ].join("\n"),
  );
}

function resolveDefaultConfig() {
  const candidates = [
    "deploy/otel-collector/collector.yaml",
    "../deploy/otel-collector/collector.yaml",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  return null;
}

function resolveDefaultEnv() {
  const candidates = [
    "deploy/otel-collector/.env.example",
    "../deploy/otel-collector/.env.example",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const configPath = args.config
    ? path.resolve(args.config)
    : resolveDefaultConfig();
  if (!configPath || !fs.existsSync(configPath)) {
    console.error(
      `[validate-otel-collector] FAIL — collector.yaml not found (looked in deploy/otel-collector/collector.yaml). Pass --config <path>.`,
    );
    return 2;
  }
  const envPath = args.env ? path.resolve(args.env) : resolveDefaultEnv();

  const yamlText = fs.readFileSync(configPath, "utf8");
  const envText = envPath && fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : undefined;

  const result = validateCollectorConfig(yamlText, envText);

  console.log(
    `[validate-otel-collector] ${configPath}` +
      (envPath ? ` + ${envPath}` : " (no .env.example supplied)"),
  );
  console.log(
    `[validate-otel-collector] summary: ${result.summary.receivers ?? 0} receivers, ${result.summary.processors ?? 0} processors, ${result.summary.exporters ?? 0} exporters, ${result.summary.pipelines ?? 0} pipelines`,
  );

  for (const w of result.warnings) console.warn(`  ! ${w}`);
  for (const e of result.errors) console.error(`  ✗ ${e}`);

  if (!result.ok) {
    console.error(
      `[validate-otel-collector] FAIL — ${result.errors.length} error(s)`,
    );
    return 1;
  }
  console.log(`[validate-otel-collector] OK`);
  return 0;
}

// Run main() only when invoked directly (not when imported by tests).
const __filename = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename)
) {
  const code = main();
  process.exit(code);
}