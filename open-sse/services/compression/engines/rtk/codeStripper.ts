// @vitest-environment node
/**
 * Code Stripper — removes comments, JSDoc, and type annotations from TypeScript
 * for deployment/runtime use. Uses TypeScript's own AST for reliable stripping.
 */
import * as ts from "typescript";

interface StripOptions {
  removeComments?: boolean;
  removeJsDoc?: boolean;
  removeTypeAnnotations?: boolean;
  preserveDocstrings?: boolean;
}

export interface CodeStripResult {
  text: string;
  strippedLines: number;
  language: string;
}

const DEFAULT_OPTIONS: StripOptions = {
  removeComments: true,
  removeJsDoc: true,
  removeTypeAnnotations: true,
};

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
}
