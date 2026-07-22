/**
 * Code stripper — uses TypeScript's AST to remove comments, collapse whitespace,
 * and produce compact code output for each supported language.
 *
 * TypeScript 7+ API: import from "typescript/unstable/ast" (synchronous AST helpers).
 */
import * as ast from "typescript/unstable/ast";
import { ScriptTarget, ScriptKind } from "typescript/unstable/sync";

export type CodeLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "rust"
  | "go"
  | "ruby"
  | "java"
  | "unknown";

export interface CodeStripperOptions {
  removeComments?: boolean;
  removeEmptyLines?: boolean;
  collapseWhitespace?: boolean;
  preserveDocstrings?: boolean;
  maxLineLength?: number;
}

export interface CodeStripResult {
  code: string;
  language: CodeLanguage;
  originalLength: number;
  strippedLength: number;
  compressionRatio: number;
}

function detectLanguage(filename: string): CodeLanguage {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "rb":
      return "ruby";
    case "java":
      return "java";
    default:
      return "unknown";
  }
}

function stripTsComments(source: string): string {
  // Use TS AST to strip comments from TypeScript/JavaScript
  const sf = ast.createSourceFile("temp.ts", source, ScriptTarget.ESNext, true, ScriptKind.TSX);
  let result = source;

  ast.forEachChild(sf, (node) => {
    ast.getLeadingCommentRanges(source, node.pos)?.forEach((range) => {
      const comment = source.substring(range.pos, range.end);
      // Preserve docstrings (/** ... */) if preserveDocstrings is set
      if (!comment.startsWith("/**")) {
        result = result.substring(0, range.pos) + result.substring(range.end);
      }
    });
  });

  return result;
}

function stripGenericComments(
  source: string,
  language: CodeLanguage,
  opts: CodeStripperOptions,
): string {
  let result = source;

  // Language-specific comment patterns
  const commentPatterns: Record<CodeLanguage, RegExp[]> = {
    typescript: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
    javascript: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
    python: [/#.*$/gm],
    rust: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
    go: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
    ruby: [/#.*$/gm],
    java: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
    unknown: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g, /#.*$/gm],
  };

  const patterns = commentPatterns[language] ?? commentPatterns.unknown;

  for (const pattern of patterns) {
    if (opts.preserveDocstrings) {
      // Skip docstrings — only remove non-doc comments
      result = result.replace(pattern, (match) => {
        if (match.startsWith("/**")) return match;
        return "";
      });
    } else {
      result = result.replace(pattern, "");
    }
  }

  return result;
}

function collapseWhitespace(source: string, opts: CodeStripperOptions): string {
  let result = source;

  // Remove empty lines
  if (opts.removeEmptyLines) {
    result = result.replace(/\n\s*\n/g, "\n");
  }

  // Collapse multiple spaces/tabs to single space
  if (opts.collapseWhitespace) {
    result = result.replace(/[^\S\n]+/g, " ");
    // Remove leading/trailing whitespace on each line
    result = result.replace(/^[ \t]+|[ \t]+$/gm, "");
  }

  // Trim final newlines
  result = result.trimEnd() + "\n";

  return result;
}

function truncateLongLines(source: string, maxLineLength: number): string {
  return source
    .split("\n")
    .map((line) => (line.length > maxLineLength ? line.substring(0, maxLineLength) + "// ..." : line))
    .join("\n");
}

export function stripCode(
  source: string,
  filename: string,
  opts: CodeStripperOptions = {},
): CodeStripResult {
  const language = detectLanguage(filename);
  const options: CodeStripperOptions = {
    removeComments: opts.removeComments ?? true,
    removeEmptyLines: opts.removeEmptyLines ?? true,
    collapseWhitespace: opts.collapseWhitespace ?? false,
    preserveDocstrings: opts.preserveDocstrings ?? false,
    maxLineLength: opts.maxLineLength ?? 200,
  };

  let stripped = source;

  // Strip comments using language-appropriate method
  if (options.removeComments) {
    if (language === "typescript" || language === "javascript") {
      stripped = stripTsComments(stripped);
    }
    stripped = stripGenericComments(stripped, language, options);
  }

  // Collapse whitespace
  stripped = collapseWhitespace(stripped, options);

  // Truncate long lines
  if (options.maxLineLength && options.maxLineLength > 0) {
    stripped = truncateLongLines(stripped, options.maxLineLength);
  }

  return {
    code: stripped,
    language,
    originalLength: source.length,
    strippedLength: stripped.length,
    compressionRatio: source.length > 0 ? stripped.length / source.length : 1,
  };
}
