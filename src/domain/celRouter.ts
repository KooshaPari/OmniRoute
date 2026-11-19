/**
 * CEL-like expression routing.
 *
 * A dependency-free, recursive-descent evaluator for the routing expressions
 * OmniRoute needs. It intentionally implements a small CEL subset:
 *
 *   - comparisons: ==, !=, <, <=, >, >=, in
 *   - boolean logic: &&, ||, !
 *   - dotted attribute access: context.metadata.tier
 *   - literals: strings, numbers, true, false, null, list literals
 *   - string methods: .contains(), .startsWith(), .endsWith()
 *   - ternary: condition ? then : else
 *
 * It does not evaluate JavaScript. No eval, Function, arithmetic, maps, or
 * macros. Missing attributes evaluate to null, and malformed expressions
 * raise a plain Error from compileExpression.
 *
 * Ported from thegent's cel_router.py. See
 * reports/omniroute-cel-port.md for the parity plan.
 */

export interface CelRoute {
  expression: string;
  target: string;
  name?: string;
}

export interface CelEvalResult {
  matched: boolean;
  target: string;
  routeName: string;
  error: string;
}

export type CelNode =
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "list"; items: CelNode[] }
  | { kind: "attr"; path: string[] }
  | { kind: "not"; expr: CelNode }
  | { kind: "and" | "or"; left: CelNode; right: CelNode }
  | {
      kind: "binary";
      op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in";
      left: CelNode;
      right: CelNode;
    }
  | {
      kind: "method";
      method: "contains" | "startsWith" | "endsWith";
      haystack: CelNode;
      needle: CelNode;
    }
  | { kind: "ternary"; cond: CelNode; then: CelNode; else: CelNode };

const MAX_EXPRESSION_LENGTH = 2048;
const MAX_TOKENS = 512;
const MAX_AST_DEPTH = 32;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
const METHOD_NAMES = new Set(["contains", "startsWith", "endsWith"]);

type TokenKind =
  | "ident"
  | "string"
  | "number"
  | "op"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "eof";

interface Token {
  kind: TokenKind;
  value: string | number;
  pos: number;
}

function fail(message: string): never {
  throw new Error(message);
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let value = "";
      let closed = false;
      while (j < text.length) {
        const current = text[j];
        if (current === '"') {
          closed = true;
          j += 1;
          break;
        }
        if (current === "\\" && j + 1 < text.length) {
          const escaped = text[j + 1];
          if (escaped === "n") value += "\n";
          else if (escaped === "t") value += "\t";
          else if (escaped === "\\") value += "\\";
          else if (escaped === '"') value += '"';
          else value += "\\" + escaped;
          j += 2;
          continue;
        }
        value += current;
        j += 1;
      }
      if (!closed) fail(`Unterminated string at position ${i}`);
      tokens.push({ kind: "string", value, pos: i });
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(text[i + 1] ?? ""))) {
      const rest = text.slice(i);
      const match = /^-?[0-9]+(?:\.[0-9]+)?/.exec(rest);
      if (!match) fail(`Invalid number at position ${i}`);
      const raw = match[0];
      const value = Number(raw);
      if (!raw.includes(".") && !Number.isSafeInteger(value)) {
        fail(`Integer literal exceeds the safe range at position ${i}`);
      }
      tokens.push({ kind: "number", value, pos: i });
      i += raw.length;
      continue;
    }

    const two = text.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=" || two === "&&" || two === "||") {
      tokens.push({ kind: "op", value: two, pos: i });
      i += 2;
      continue;
    }

    if (ch === "<" || ch === ">" || ch === "!" || ch === "?" || ch === ":") {
      tokens.push({ kind: "op", value: ch, pos: i });
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ kind: "lparen", value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen", value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === "[") {
      tokens.push({ kind: "lbracket", value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === "]") {
      tokens.push({ kind: "rbracket", value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma", value: ch, pos: i });
      i += 1;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const rest = text.slice(i);
      const match = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(rest);
      if (!match) fail(`Invalid identifier at position ${i}`);
      const ident = match[0];
      tokens.push({ kind: "ident", value: ident, pos: i });
      i += ident.length;
      continue;
    }

    fail(`Unexpected character ${JSON.stringify(ch)} at position ${i}`);
  }

  tokens.push({ kind: "eof", value: "", pos: text.length });
  if (tokens.length > MAX_TOKENS) {
    fail(`Expression has more than ${MAX_TOKENS} tokens`);
  }
  return tokens;
}

function attrNode(path: string): CelNode {
  const parts = path.split(".");
  for (const part of parts) {
    if (!part) fail(`Invalid attribute path ${JSON.stringify(path)}`);
    if (FORBIDDEN_SEGMENTS.has(part)) {
      fail(`Attribute path contains forbidden segment ${JSON.stringify(part)}`);
    }
  }
  return { kind: "attr", path: parts };
}

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): CelNode {
    const node = this.parseTernary();
    if (this.peek().kind !== "eof") {
      fail(`Unexpected token after expression: ${JSON.stringify(this.peek().value)}`);
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private consume(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private expect(kind: TokenKind, value?: string): Token {
    const token = this.consume();
    if (token.kind !== kind || (value !== undefined && token.value !== value)) {
      fail(
        `Expected ${value ?? kind}, got ${JSON.stringify(token.value)} at position ${token.pos}`
      );
    }
    return token;
  }

  private parseTernary(): CelNode {
    const cond = this.parseOr();
    if (this.peek().kind === "op" && this.peek().value === "?") {
      this.consume();
      const thenExpr = this.parseTernary();
      this.expect("op", ":");
      const elseExpr = this.parseTernary();
      return { kind: "ternary", cond, then: thenExpr, else: elseExpr };
    }
    return cond;
  }

  private parseOr(): CelNode {
    let left = this.parseAnd();
    while (this.peek().kind === "op" && this.peek().value === "||") {
      this.consume();
      left = { kind: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): CelNode {
    let left = this.parseNot();
    while (this.peek().kind === "op" && this.peek().value === "&&") {
      this.consume();
      left = { kind: "and", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): CelNode {
    if (this.peek().kind === "op" && this.peek().value === "!") {
      this.consume();
      return { kind: "not", expr: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): CelNode {
    const left = this.parsePrimary();
    const token = this.peek();

    if (token.kind === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(String(token.value))) {
      this.consume();
      const right = this.parsePrimary();
      const op =
        token.value === "=="
          ? "eq"
          : token.value === "!="
            ? "ne"
            : token.value === "<"
              ? "lt"
              : token.value === "<="
                ? "lte"
                : token.value === ">"
                  ? "gt"
                  : "gte";
      return { kind: "binary", op, left, right };
    }

    if (token.kind === "ident" && token.value === "in") {
      this.consume();
      return { kind: "binary", op: "in", left, right: this.parsePrimary() };
    }

    return left;
  }

  private parsePrimary(): CelNode {
    const token = this.peek();

    if (token.kind === "lparen") {
      this.consume();
      const node = this.parseTernary();
      this.expect("rparen");
      return node;
    }

    if (token.kind === "lbracket") {
      return this.parseList();
    }

    if (token.kind === "string" || token.kind === "number") {
      this.consume();
      return { kind: "literal", value: token.value };
    }

    if (token.kind === "ident") {
      this.consume();
      const ident = String(token.value);

      if (ident === "true") return { kind: "literal", value: true };
      if (ident === "false") return { kind: "literal", value: false };
      if (ident === "null") return { kind: "literal", value: null };
      if (ident === "in") fail("Unexpected 'in' in primary position");

      const lastDot = ident.lastIndexOf(".");
      const method = lastDot >= 0 ? ident.slice(lastDot + 1) : ident;
      const base = lastDot >= 0 ? ident.slice(0, lastDot) : "";

      if (this.peek().kind === "lparen" && METHOD_NAMES.has(method)) {
        this.consume();
        const needle = this.parseTernary();
        this.expect("rparen");
        const haystack: CelNode = base ? attrNode(base) : { kind: "literal", value: ident };
        return {
          kind: "method",
          method: method as "contains" | "startsWith" | "endsWith",
          haystack,
          needle,
        };
      }

      return attrNode(ident);
    }

    fail(`Unexpected token in primary: ${JSON.stringify(token.value)} at position ${token.pos}`);
  }

  private parseList(): CelNode {
    this.expect("lbracket");
    const items: CelNode[] = [];
    if (this.peek().kind === "rbracket") {
      this.consume();
      return { kind: "list", items };
    }

    while (true) {
      items.push(this.parseTernary());
      if (this.peek().kind === "comma") {
        this.consume();
        if (this.peek().kind === "rbracket") {
          this.consume();
          break;
        }
        continue;
      }
      this.expect("rbracket");
      break;
    }
    return { kind: "list", items };
  }
}

function assertDepth(node: CelNode, depth = 1): void {
  if (depth > MAX_AST_DEPTH) {
    fail(`Expression nesting exceeds ${MAX_AST_DEPTH}`);
  }
  switch (node.kind) {
    case "literal":
    case "attr":
      return;
    case "list":
      for (const item of node.items) assertDepth(item, depth + 1);
      return;
    case "not":
      assertDepth(node.expr, depth + 1);
      return;
    case "and":
    case "or":
    case "binary":
      assertDepth(node.left, depth + 1);
      assertDepth(node.right, depth + 1);
      return;
    case "method":
      assertDepth(node.haystack, depth + 1);
      assertDepth(node.needle, depth + 1);
      return;
    case "ternary":
      assertDepth(node.cond, depth + 1);
      assertDepth(node.then, depth + 1);
      assertDepth(node.else, depth + 1);
      return;
  }
}

export function compileExpression(expression: string): CelNode {
  if (typeof expression !== "string") {
    fail("expression must be a string");
  }
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    fail(`Expression exceeds ${MAX_EXPRESSION_LENGTH} characters`);
  }
  const tokens = tokenize(expression);
  const node = new Parser(tokens).parse();
  assertDepth(node);
  return node;
}

function ownAttr(path: string[], context: Record<string, unknown>): unknown {
  let current: unknown = context;
  for (const part of path) {
    if (FORBIDDEN_SEGMENTS.has(part)) return undefined;
    if (current === null || typeof current !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function normalize(value: unknown): unknown {
  return value === undefined ? null : value;
}

function truthy(value: unknown): boolean {
  const normalized = normalize(value);
  if (normalized === null) return false;
  if (typeof normalized === "boolean") return normalized;
  if (typeof normalized === "number") return normalized !== 0;
  if (typeof normalized === "string") return normalized.length > 0;
  if (Array.isArray(normalized)) return normalized.length > 0;
  if (typeof normalized === "object") return Object.keys(normalized as object).length > 0;
  return true;
}

function equals(left: unknown, right: unknown, depth = 0): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (a === null || b === null) return a === b;
  if (
    (typeof a === "boolean" || typeof a === "number") &&
    (typeof b === "boolean" || typeof b === "number")
  ) {
    return Number(a) === Number(b);
  }
  if (typeof a !== typeof b) return false;
  if (depth > 32) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => equals(entry, b[index], depth + 1));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        equals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth + 1)
    );
  }
  return a === b;
}

function ordered(op: "lt" | "lte" | "gt" | "gte", left: unknown, right: unknown): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (a === null || b === null) return false;
  const numericA = typeof a === "number" ? a : typeof a === "boolean" ? Number(a) : null;
  const numericB = typeof b === "number" ? b : typeof b === "boolean" ? Number(b) : null;
  if (numericA !== null && numericB !== null) {
    if (op === "lt") return numericA < numericB;
    if (op === "lte") return numericA <= numericB;
    if (op === "gt") return numericA > numericB;
    return numericA >= numericB;
  }
  if (typeof a === "string" && typeof b === "string") {
    if (op === "lt") return a < b;
    if (op === "lte") return a <= b;
    if (op === "gt") return a > b;
    return a >= b;
  }
  return false;
}

function containsValue(left: unknown, right: unknown): boolean {
  const value = normalize(left);
  const collection = normalize(right);
  if (collection === null) return false;
  if (Array.isArray(collection)) {
    return collection.some((entry) => equals(entry, value));
  }
  if (typeof collection === "string" && typeof value === "string") {
    return collection.includes(value);
  }
  return false;
}

function evalNode(node: CelNode, context: Record<string, unknown>): unknown {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "list":
      return node.items.map((item) => evalNode(item, context));
    case "attr":
      return ownAttr(node.path, context);
    case "not":
      return !truthy(evalNode(node.expr, context));
    case "and":
      return truthy(evalNode(node.left, context)) && truthy(evalNode(node.right, context));
    case "or":
      return truthy(evalNode(node.left, context)) || truthy(evalNode(node.right, context));
    case "binary": {
      const left = evalNode(node.left, context);
      const right = evalNode(node.right, context);
      switch (node.op) {
        case "eq":
          return equals(left, right);
        case "ne":
          return !equals(left, right);
        case "lt":
        case "lte":
        case "gt":
        case "gte":
          return ordered(node.op, left, right);
        case "in":
          return containsValue(left, right);
      }
      return false;
    }
    case "method": {
      const haystack = normalize(evalNode(node.haystack, context));
      const needle = normalize(evalNode(node.needle, context));
      if (haystack === null || needle === null) return false;
      const text = String(haystack);
      const part = String(needle);
      if (node.method === "contains") return text.includes(part);
      if (node.method === "startsWith") return text.startsWith(part);
      return text.endsWith(part);
    }
    case "ternary":
      return truthy(evalNode(node.cond, context))
        ? evalNode(node.then, context)
        : evalNode(node.else, context);
  }
}

export function evalExpression(compiled: CelNode, context: Record<string, unknown>): boolean {
  return truthy(evalNode(compiled, context));
}

interface CompiledRoute {
  route: CelRoute;
  node: CelNode | null;
  error: string;
}

export class CelEvaluator {
  private readonly compiled: CompiledRoute[];

  constructor(routes: CelRoute[]) {
    this.compiled = routes.map((route) => {
      try {
        return { route, node: compileExpression(route.expression), error: "" };
      } catch (error) {
        return {
          route,
          node: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }

  evaluate(context: Record<string, unknown>): CelEvalResult {
    for (const entry of this.compiled) {
      const routeName = entry.route.name ?? "";
      if (!entry.node) {
        return { matched: false, target: "", routeName, error: entry.error };
      }
      try {
        const value = evalNode(entry.node, context);
        if (value === true || (typeof value !== "boolean" && truthy(value))) {
          if (typeof value === "string") {
            return { matched: true, target: value, routeName, error: "" };
          }
          return { matched: true, target: entry.route.target, routeName, error: "" };
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

export function evaluateCelRoutes(
  routes: CelRoute[],
  context: Record<string, unknown>
): CelEvalResult {
  return new CelEvaluator(routes).evaluate(context);
}
