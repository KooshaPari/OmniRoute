/**
 * Policy Engine — FASE-06 Architecture Refactoring
 *
 * Centralized policy evaluation that combines domain decisions from
 * fallback, cost, lockout, and circuit-breaker modules into a single
 * verdict before forwarding a request to a provider.
 *
 * @module domain/policyEngine
 */

import { checkLockout } from "./lockoutPolicy";
import { checkBudget } from "./costRules";
import { resolveFallbackChain } from "./fallbackPolicy";
import { compileExpression, evalExpression, type CelNode } from "./celRouter";
import { buildRoutingContext, evaluateCondition } from "./conditionalRouter";

interface PolicyRequest {
  model: string;
  apiKeyId?: string;
  clientIp?: string;
  provider?: string;
}

interface PolicyVerdict {
  allowed: boolean;
  reason: string | null;
  adjustments: Record<string, unknown>;
  policyPhase: string;
}

export interface Policy {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  priority: number;
  conditions?: {
    model_pattern?: string;
    expression?: string;
    condition?: Record<string, unknown>;
    [key: string]: unknown;
  };
  actions?: {
    prefer_provider?: string[];
    block_model?: string[];
    max_tokens?: number;
    [key: string]: unknown;
  };
}

export interface PolicyEngineOptions {
  /** Enables the "cel" policy type. Defaults to false. */
  celEnabled?: boolean;
}

export interface PolicyEngineResult {
  allowed: boolean;
  reason: string | undefined;
  preferredProviders: string[];
  appliedPolicies: string[];
  maxTokens: number | undefined;
}

export function evaluateRequest(request: PolicyRequest): PolicyVerdict {
  const { model, apiKeyId, clientIp } = request;

  // ── 1. Lockout Policy ──────────────────────────────
  if (clientIp) {
    const lockout = checkLockout(clientIp);
    if (lockout.locked) {
      return {
        allowed: false,
        reason: `Client locked out (${lockout.remainingMs}ms remaining)`,
        adjustments: {},
        policyPhase: "lockout",
      };
    }
  }

  // ── 2. Budget Policy ───────────────────────────────
  if (apiKeyId) {
    const budget = checkBudget(apiKeyId);
    if (budget && !budget.allowed) {
      return {
        allowed: false,
        reason: `Budget exceeded: ${budget.reason || "daily limit reached"}`,
        adjustments: {},
        policyPhase: "budget",
      };
    }
  }

  // ── 3. Fallback Chain Resolution ───────────────────
  const fallbackChain = resolveFallbackChain(model);

  return {
    allowed: true,
    reason: null,
    adjustments: {
      model,
      fallbackChain: fallbackChain || [],
    },
    policyPhase: "passed",
  };
}

export function evaluateFirstAllowed(models: string[], baseRequest: Omit<PolicyRequest, "model">) {
  for (const model of models) {
    const verdict = evaluateRequest({ ...baseRequest, model });
    if (verdict.allowed) {
      return { model, verdict };
    }
  }

  // All models denied — return last denial
  const lastVerdict = evaluateRequest({ ...baseRequest, model: models[models.length - 1] });
  return { model: null, verdict: lastVerdict };
}

// ─── Class-Based Policy Engine ───────────────────────────────────────────────

function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

export class PolicyEngine {
  _policies: Policy[];
  private _celEnabled: boolean;
  private _celCompiled: Map<string, { expression: string; node: CelNode }>;
  private _celErrors: Map<string, string>;
  private _conditionalErrors: Map<string, string>;

  constructor(options: PolicyEngineOptions = {}) {
    this._policies = [];
    this._celEnabled = options.celEnabled === true;
    this._celCompiled = new Map();
    this._celErrors = new Map();
    this._conditionalErrors = new Map();
  }

  loadPolicies(policies: Policy[]) {
    this._policies = [...policies];
    this._recompileCel();
    this._conditionalErrors.clear();
  }

  addPolicy(policy: Policy) {
    this._policies.push(policy);
    this._compileCel(policy);
    this._conditionalErrors.delete(policy.id);
  }

  removePolicy(id: string) {
    this._policies = this._policies.filter((p) => p.id !== id);
    this._celCompiled.delete(id);
    this._celErrors.delete(id);
    this._conditionalErrors.delete(id);
  }

  getPolicies(): Policy[] {
    return [...this._policies];
  }

  getCelErrors(): Record<string, string> {
    return Object.fromEntries(this._celErrors);
  }

  getConditionalErrors(): Record<string, string> {
    return Object.fromEntries(this._conditionalErrors);
  }

  private _applyMatchedActions(
    policy: Policy,
    result: PolicyEngineResult,
    model: string
  ): boolean {
    if (policy.actions?.prefer_provider) {
      result.preferredProviders.push(...policy.actions.prefer_provider);
    }
    if (policy.actions?.max_tokens != null) {
      result.maxTokens = policy.actions.max_tokens;
    }
    if (policy.actions?.block_model) {
      const blocked = policy.actions.block_model.some((pattern) => globMatch(pattern, model));
      if (blocked) {
        result.allowed = false;
        result.reason = `Model "${model}" blocked by policy "${policy.name}"`;
        result.appliedPolicies.push(policy.name);
        return true;
      }
    }
    result.appliedPolicies.push(policy.name);
    return false;
  }

  private _compileCel(policy: Policy): void {
    if (policy.type !== "cel") return;
    const expression = policy.conditions?.expression;
    if (typeof expression !== "string" || expression.trim() === "") {
      this._celCompiled.delete(policy.id);
      this._celErrors.set(policy.id, "missing expression");
      return;
    }
    try {
      this._celCompiled.set(policy.id, {
        expression,
        node: compileExpression(expression),
      });
      this._celErrors.delete(policy.id);
    } catch (error) {
      this._celCompiled.delete(policy.id);
      this._celErrors.set(policy.id, error instanceof Error ? error.message : String(error));
    }
  }

  private _recompileCel(): void {
    this._celCompiled.clear();
    this._celErrors.clear();
    for (const policy of this._policies) {
      this._compileCel(policy);
    }
  }

  evaluate(context: { model: string; [key: string]: unknown }): PolicyEngineResult {
    const result: PolicyEngineResult = {
      allowed: true,
      reason: undefined,
      preferredProviders: [],
      appliedPolicies: [],
      maxTokens: undefined,
    };

    const sorted = [...this._policies]
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const policy of sorted) {
      // Check model condition
      if (policy.conditions?.model_pattern) {
        if (!globMatch(policy.conditions.model_pattern, context.model)) {
          continue; // Model doesn't match — skip this policy
        }
      }

      // Apply actions based on policy type
      switch (policy.type) {
        case "routing":
          if (policy.actions?.prefer_provider) {
            result.preferredProviders.push(...policy.actions.prefer_provider);
          }
          result.appliedPolicies.push(policy.name);
          break;

        case "access":
          if (policy.actions?.block_model) {
            const blocked = policy.actions.block_model.some((pattern) =>
              globMatch(pattern, context.model)
            );
            if (blocked) {
              result.allowed = false;
              result.reason = `Model "${context.model}" blocked by policy "${policy.name}"`;
              result.appliedPolicies.push(policy.name);
              return result;
            }
          }
          result.appliedPolicies.push(policy.name);
          break;

        case "budget":
          if (policy.actions?.max_tokens != null) {
            result.maxTokens = policy.actions.max_tokens;
          }
          result.appliedPolicies.push(policy.name);
          break;

        case "cel": {
          if (!this._celEnabled) break;
          const cached = this._celCompiled.get(policy.id);
          if (!cached || cached.expression !== policy.conditions?.expression) {
            this._compileCel(policy);
            if (this._celErrors.has(policy.id)) break;
          }
          const compiled = this._celCompiled.get(policy.id)?.node;
          if (!compiled) break;

          let matched = false;
          try {
            matched = evalExpression(compiled, { context });
          } catch {
            matched = false;
          }
          if (!matched) break;

          if (this._applyMatchedActions(policy, result, context.model)) return result;
          break;
        }

        case "conditional": {
          const condition = policy.conditions?.condition;
          if (!condition || typeof condition !== "object" || Array.isArray(condition)) break;

          const metadata =
            context.metadata &&
            typeof context.metadata === "object" &&
            !Array.isArray(context.metadata)
              ? (context.metadata as Record<string, unknown>)
              : undefined;
          const conditionalContext = buildRoutingContext(context, metadata);

          let matched = false;
          try {
            matched = evaluateCondition(condition, conditionalContext);
            this._conditionalErrors.delete(policy.id);
          } catch (error) {
            this._conditionalErrors.set(
              policy.id,
              error instanceof Error ? error.message : String(error)
            );
            break;
          }
          if (!matched) break;

          if (this._applyMatchedActions(policy, result, context.model)) return result;
          break;
        }
      }
    }

    return result;
  }
}
