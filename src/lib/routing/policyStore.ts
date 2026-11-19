/**
 * File-backed routing policy store.
 *
 * Policies live in `<DATA_DIR>/routing-policies.json`, as either an array or
 * `{ "policies": [...] }`. The file is optional: a missing file means no
 * policies and no errors. Malformed entries are reported instead of being
 * silently accepted, so a typo cannot look like an empty rule set.
 */

import fs from "node:fs";
import path from "node:path";

import { resolveDataDir } from "../dataPaths";
import type { Policy } from "@/domain/policyEngine";

export const ROUTING_POLICY_FILE = "routing-policies.json";

const POLICY_TYPES = new Set(["routing", "access", "budget", "cel", "conditional"]);

export interface PolicyLoadResult {
  policies: Policy[];
  errors: string[];
  filePath: string;
  exists: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePolicies(input: unknown): { policies: Policy[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(input)) {
    return { policies: [], errors: ["policies must be an array"] };
  }

  const policies: Policy[] = [];
  input.forEach((raw, index) => {
    const prefix = `policies[${index}]`;
    if (!isPlainObject(raw)) {
      errors.push(`${prefix}: expected an object`);
      return;
    }
    if (typeof raw.id !== "string" || raw.id.trim() === "") {
      errors.push(`${prefix}: id must be a non-empty string`);
      return;
    }
    if (typeof raw.name !== "string" || raw.name.trim() === "") {
      errors.push(`${prefix}: name must be a non-empty string`);
      return;
    }
    if (typeof raw.type !== "string" || !POLICY_TYPES.has(raw.type)) {
      errors.push(`${prefix}: unknown policy type ${JSON.stringify(raw.type)}`);
      return;
    }
    if (typeof raw.enabled !== "boolean") {
      errors.push(`${prefix}: enabled must be a boolean`);
      return;
    }
    if (raw.conditions !== undefined && !isPlainObject(raw.conditions)) {
      errors.push(`${prefix}: conditions must be an object`);
      return;
    }
    if (raw.actions !== undefined && !isPlainObject(raw.actions)) {
      errors.push(`${prefix}: actions must be an object`);
      return;
    }
    if (raw.priority !== undefined && typeof raw.priority !== "number") {
      errors.push(`${prefix}: priority must be a number`);
      return;
    }

    policies.push({
      ...(raw as unknown as Policy),
      priority: typeof raw.priority === "number" ? raw.priority : 100,
    });
  });

  return { policies, errors };
}

export function loadRoutingPolicies(dataDir?: string): PolicyLoadResult {
  const directory = dataDir ?? resolveDataDir();
  const filePath = path.join(directory, ROUTING_POLICY_FILE);

  if (!fs.existsSync(filePath)) {
    return { policies: [], errors: [], filePath, exists: false };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      policies: [],
      errors: [
        `Unable to parse ${ROUTING_POLICY_FILE}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      filePath,
      exists: true,
    };
  }

  const list = Array.isArray(raw)
    ? raw
    : isPlainObject(raw) && Array.isArray(raw.policies)
      ? raw.policies
      : null;
  if (list === null) {
    return {
      policies: [],
      errors: [`${ROUTING_POLICY_FILE} must be an array or an object with a policies array`],
      filePath,
      exists: true,
    };
  }

  const validated = validatePolicies(list);
  return { ...validated, filePath, exists: true };
}
