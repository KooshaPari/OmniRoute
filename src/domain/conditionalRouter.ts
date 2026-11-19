/**
 * Conditional routing rules.
 *
 * A small, dependency-free evaluator for Portkey-style conditions:
 *
 *   { "metadata.tier": "premium" }
 *   { "params.stream": { "$eq": true } }
 *   { "$or": [{ "metadata.tier": "premium" }, { "params.priority": { "$in": [10, 20] } }] }
 *
 * Supported operators: $eq, $ne, $in, $nin, $regex, $exists, $and, $or.
 * Field values are looked up as own properties of a flat context, exactly like
 * the thegent oracle. All fields in one condition are AND-combined; $and and
 * $or can nest arbitrarily.
 *
 * Ported from thegent-routing's conditional.py. The port fixes the oracle's
 * plain-equality shorthand, which returned after the first scalar field
 * instead of combining every field.
 */

export interface ConditionalRoute {
  condition: Record<string, unknown>;
  target: string;
  name?: string;
}

export interface ConditionalEvalResult {
  matched: boolean;
  target: string;
  routeName: string;
  error: string;
}

const MAX_CONDITION_DEPTH = 16;
const FIELD_OPERATORS = new Set(["$eq", "$ne", "$in", "$nin", "$regex", "$exists"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function equal(left: unknown, right: unknown, depth = 0): boolean {
  if (left === right) return true;
  if (left === null || right === null || left === undefined || right === undefined) return false;
  if (typeof left !== typeof right) return false;
  if (depth > MAX_CONDITION_DEPTH) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => equal(entry, right[index], depth + 1))
    );
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(right, key) && equal(left[key], right[key], depth + 1)
    );
  }
  return false;
}

function contextValue(context: Record<string, unknown>, field: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(context, field)) return undefined;
  return context[field];
}

function memberOf(value: unknown, operand: unknown, field: string): boolean {
  if (Array.isArray(operand)) return operand.some((entry) => equal(entry, value));
  if (typeof operand === "string") return typeof value === "string" && operand.includes(value);
  throw new Error(`Operator $in/$nin on "${field}" expects an array or string`);
}

export function evaluateCondition(
  condition: Record<string, unknown>,
  context: Record<string, unknown>,
  depth = 0
): boolean {
  if (depth > MAX_CONDITION_DEPTH) {
    throw new Error(`Condition nesting exceeds ${MAX_CONDITION_DEPTH}`);
  }

  for (const [key, value] of Object.entries(condition)) {
    if (key === "$and") {
      if (!Array.isArray(value)) throw new Error("$and expects an array");
      if (!value.every((entry) => isPlainObject(entry) && evaluateCondition(entry, context, depth + 1))) {
        return false;
      }
      continue;
    }
    if (key === "$or") {
      if (!Array.isArray(value)) throw new Error("$or expects an array");
      if (!value.some((entry) => isPlainObject(entry) && evaluateCondition(entry, context, depth + 1))) {
        return false;
      }
      continue;
    }

    const fieldValue = contextValue(context, key);
    if (!isPlainObject(value)) {
      if (!equal(fieldValue, value, depth + 1)) return false;
      continue;
    }

    for (const [op, operand] of Object.entries(value)) {
      if (!FIELD_OPERATORS.has(op)) {
        throw new Error(`Unknown operator: ${op}`);
      }
      switch (op) {
        case "$eq":
          if (!equal(fieldValue, operand, depth + 1)) return false;
          break;
        case "$ne":
          if (equal(fieldValue, operand, depth + 1)) return false;
          break;
        case "$in":
          if (!memberOf(fieldValue, operand, key)) return false;
          break;
        case "$nin":
          if (memberOf(fieldValue, operand, key)) return false;
          break;
        case "$regex": {
          if (fieldValue === null || fieldValue === undefined) return false;
          if (typeof operand !== "string") {
            throw new Error(`Operator $regex on "${key}" expects a string`);
          }
          const re = new RegExp(operand, "i");
          if (!re.test(String(fieldValue))) return false;
          break;
        }
        case "$exists":
          if (Boolean(operand) !== Object.prototype.hasOwnProperty.call(context, key)) return false;
          break;
      }
    }
  }

  return true;
}

export function matchConditionalRoute(
  routes: readonly ConditionalRoute[],
  context: Record<string, unknown>
): ConditionalRoute | null {
  for (const route of routes) {
    if (evaluateCondition(route.condition, context)) return route;
  }
  return null;
}

export function buildRoutingContext(
  requestBody: Record<string, unknown>,
  metadata?: Record<string, unknown> | null
): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(requestBody)) {
    context[`params.${key}`] = value;
  }
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      context[`metadata.${key}`] = value;
    }
  }
  return context;
}

export class ConditionalEvaluator {
  private readonly routes: readonly ConditionalRoute[];

  constructor(routes: readonly ConditionalRoute[]) {
    this.routes = [...routes];
  }

  evaluate(context: Record<string, unknown>): ConditionalEvalResult {
    for (const route of this.routes) {
      const routeName = route.name ?? "";
      try {
        if (evaluateCondition(route.condition, context)) {
          return { matched: true, target: route.target, routeName, error: "" };
        }
      } catch (error) {
        return {
          matched: false,
          target: "",
          routeName,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return { matched: false, target: "", routeName: "", error: "" };
  }
}

export function evaluateConditionalRoutes(
  routes: readonly ConditionalRoute[],
  context: Record<string, unknown>
): ConditionalEvalResult {
  return new ConditionalEvaluator(routes).evaluate(context);
}
