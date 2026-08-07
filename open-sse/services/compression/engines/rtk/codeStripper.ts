import ts from "typescript";

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
<<<<<<< Updated upstream
  removeEmptyLines?: boolean;
  collapseWhitespace?: boolean;
  preserveDocstrings?: boolean;
=======
  removeJsDoc?: boolean;
  removeTypeAnnotations?: boolean;
  preserveDocstrings?: boolean;
}

export interface CodeStripResult {
  text: string;
  strippedLines: number;
  language: string;
>>>>>>> Stashed changes
}

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  js: "javascript",
  jsx: "javascript",
  javascript: "javascript",
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  go: "go",
  rb: "ruby",
  ruby: "ruby",
  java: "java",
};

<<<<<<< Updated upstream
export function normalizeCodeLanguage(language?: string | null): CodeLanguage {
  if (!language) return "unknown";
  return LANGUAGE_ALIASES[language.trim().toLowerCase()] ?? "unknown";
}

export function detectCodeLanguage(text: string): CodeLanguage {
  if (/\b(?:interface|type)\s+\w+\s*=|:\s*(?:string|number|boolean)\b/.test(text)) {
    return "typescript";
  }
  if (/\b(?:const|let|function|import|export)\b|=>/.test(text)) return "javascript";
  if (/\bdef\s+\w+\(|\bimport\s+\w+|print\(/.test(text)) return "python";
  if (/\bfn\s+\w+\(|\blet\s+mut\b|println!\(/.test(text)) return "rust";
  if (/\bfunc\s+\w+\(|package\s+\w+/.test(text)) return "go";
  if (/\bclass\s+\w+|System\.out\.println/.test(text)) return "java";
  if (/\bdef\s+\w+|puts\s+|end\s*$/.test(text)) return "ruby";
  return "unknown";
}

/** Remove JS/TS comments without treating literals or JSX expression comments as comments. */
function stripJsTsComments(text: string, preserveDocstrings: boolean): string {
  const source = ts.createSourceFile(
    "snippet.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let hasJsx = false;
  const detectJsx = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      hasJsx = true;
      return;
    }
    if (!hasJsx) ts.forEachChild(node, detectJsx);
  };
  detectJsx(source);
  if (hasJsx) return text;

  const ranges = new Map<number, ts.CommentRange>();
  const collect = (node: ts.Node): void => {
    for (const range of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
      ranges.set(range.pos, range);
    }
    for (const range of ts.getTrailingCommentRanges(text, node.getEnd()) ?? []) {
      ranges.set(range.pos, range);
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  if (ranges.size === 0) return text;

  let result = text;
  for (const range of [...ranges.values()].sort((a, b) => b.pos - a.pos)) {
    if (preserveDocstrings && text.startsWith("/**", range.pos)) continue;
    result = result.slice(0, range.pos) + result.slice(range.end);
  }
  return result;
}

export function stripCode(
  text: string,
  language: CodeLanguage = "unknown",
  options: CodeStripperOptions = {}
): { text: string; strippedLines: number; language: CodeLanguage } {
  const resolvedLanguage = language === "unknown" ? detectCodeLanguage(text) : language;
  const opts: Required<CodeStripperOptions> = {
    removeComments: options.removeComments === true,
    removeEmptyLines: options.removeEmptyLines !== false,
    collapseWhitespace: options.collapseWhitespace !== false,
    preserveDocstrings: options.preserveDocstrings === true,
  };
  const originalLines = text.split(/\r?\n/).length;
  let result = text;
  if (
    opts.removeComments &&
    (resolvedLanguage === "javascript" || resolvedLanguage === "typescript")
  ) {
    result = stripJsTsComments(result, opts.preserveDocstrings);
  }
  if (opts.removeEmptyLines) result = result.replace(/^\s*$(?:\r?\n)?/gm, "");
  if (opts.collapseWhitespace) {
    result = result
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n");
  }
  result = result.replace(/^\s*\n/, "").replace(/\n\s*$/, "");
  const strippedLines = Math.max(0, originalLines - (result ? result.split(/\r?\n/).length : 0));
  return { text: result, strippedLines, language: resolvedLanguage };
}

export function stripCodeWithDefaults(source: string): string {
  return stripCode(source).text;
=======
const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "tsx",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  yml: "yaml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  dockerfile: "docker",
};

export function normalizeCodeLanguage(hint: string): string {
  const lower = hint.trim().toLowerCase();
  return LANGUAGE_MAP[lower] || lower;
}

export function stripCode(
  source: string,
  languageHint = "typescript",
  options: StripOptions = {},
): CodeStripResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (options.preserveDocstrings) opts.removeJsDoc = false;

  const filename = `input.${languageHint || "ts"}`;
  const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);

  let strippedLines = 0;

  // Walk the AST and strip type annotations
  function stripTypes(node: ts.Node): ts.Node {
    if (opts.removeTypeAnnotations) {
      if (ts.isTypeAliasDeclaration(node)) { strippedLines++; return ts.factory.createNotEmittedStatement(undefined); }
      if (ts.isInterfaceDeclaration(node)) { strippedLines++; return ts.factory.createNotEmittedStatement(undefined); }
      if (ts.isTypeParameterDeclaration(node)) { strippedLines++; return ts.factory.createNotEmittedStatement(undefined); }
      if (ts.isPropertySignature(node)) { strippedLines++; return ts.factory.createNotEmittedStatement(undefined); }
      if (ts.isMethodSignature(node)) { strippedLines++; return ts.factory.createNotEmittedStatement(undefined); }
      if (ts.isParameter(node) && node.type) {
        strippedLines++;
        node = ts.factory.updateParameterDeclaration(
          node, undefined, node.modifiers, node.name, node.questionToken, undefined, node.initializer,
        );
      }
      if (ts.isAsExpression(node)) {
        strippedLines++;
        return stripTypes(node.expression);
      }
      if (ts.isNonNullExpression(node)) {
        strippedLines++;
        return stripTypes(node.expression);
      }
    }
    return ts.visitEachChild(node, stripTypes, ts.factory);
  }

  // Strip comments from source text directly (AST comment stripping via printer is not reliable in all cases)
  let text = source;
  if (opts.removeComments || opts.removeJsDoc) {
    // Remove single-line comments
    text = text.replace(/\/\/(?!\/).*$/gm, "");
    // Remove multi-line comments
    text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  }
  if (opts.removeJsDoc) {
    // Remove JSDoc blocks specifically (already handled above)
  }

  // Count lines removed by type stripping
  const originalLineCount = source.split("\n").length;

  const strippedSf = ts.factory.updateSourceFile(sf, [stripTypes(sf)]);

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
    omitTrailingSemicolon: true,
  });

  const resultText = printer.printFile(strippedSf);
  const finalLineCount = resultText.split("\n").length;
  strippedLines = Math.max(0, originalLineCount - finalLineCount);

  return {
    text: resultText,
    strippedLines,
    language: normalizeCodeLanguage(languageHint),
  };
}

export function stripCodeWithDefaults(source: string): CodeStripResult {
  return stripCode(source);
>>>>>>> Stashed changes
}
