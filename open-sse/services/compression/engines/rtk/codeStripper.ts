/**
 * codeStripper.ts — TypeScript code transformer that removes comments, JSDoc,
 * and type annotations for runtime/deployment use. Uses the TypeScript compiler
 * API directly (typescript@^6.0.3 in this codebase).
 *
 * Future-proofing: when microsoft/typescript-go (vendored at vendor/typescript-go/tsgo)
 * ships a stable public API for AST manipulation, the low-level functions
 * (createSourceFile, forEachChild, createPrinter, printNode, getLeadingCommentRanges)
 * can be swapped to call the tsgo binary via a JSON-RPC adapter — see
 * docs/TS7_MIGRATION.md and the compiler-adapter pattern documented there.
 *
 * Public surface preserved for compatibility with the rest of the compression engine:
 *   - stripCode(source, languageHint?, options?) → CodeStripResult
 *   - normalizeCodeLanguage(hint) → canonical language id
 */
import * as ts from "typescript";

/** Configuration for stripCode(). All fields optional with sensible defaults. */
export interface StripOptions {
  /** Remove /** ... *\/ block comments. Default: true */
  removeJsDoc?: boolean;
  /** Remove TypeScript type annotations (`: T`, `as T`, `<T>`, `: T = ...`). Default: true */
  removeTypeAnnotations?: boolean;
<<<<<<< Updated upstream
  /** If true, JsDoc is preserved (overrides removeJsDoc). Default: false */
  preserveDocstrings?: boolean;
=======
  preserveDocstrings?: boolean;
}

export interface CodeStripResult {
  text: string;
  strippedLines: number;
  language: string;
>>>>>>> Stashed changes
}

const DEFAULT_OPTIONS: Required<StripOptions> = {
  removeJsDoc: true,
  removeTypeAnnotations: true,
  preserveDocstrings: false,
};

<<<<<<< Updated upstream
export interface CodeStripResult {
  text: string;
  strippedLines: number;
  language: string;
}

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
  java: "java",
  rs: "rust",
  go: "go",
  rb_alt: "ruby",
};

/** Canonicalize a file extension / language hint to a uniform identifier. */
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

>>>>>>> Stashed changes
export function normalizeCodeLanguage(hint: string): string {
  const lower = hint.trim().toLowerCase();
  return LANGUAGE_MAP[lower] || lower;
}

/**
 * Strip comments, JSDoc, and type annotations from source code.
 *
 * Pure function — does not read files, make network calls, or maintain state.
 * Returns the stripped source plus metadata for downstream callers.
 */
export function stripCode(
  source: string,
  languageHint = "typescript",
  options: StripOptions = {},
): CodeStripResult {
<<<<<<< Updated upstream
  const opts: Required<StripOptions> = { ...DEFAULT_OPTIONS, ...options };
  if (opts.preserveDocstrings) opts.removeJsDoc = false;
=======
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (options.preserveDocstrings) opts.removeJsDoc = false;
>>>>>>> Stashed changes

  const filename = `input.${languageHint || "ts"}`;
  const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);

<<<<<<< Updated upstream
  const originalLineCount = source.split("\n").length;

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => (rootNode) => {
    const visit: ts.Visitor = (node) => {
      // Drop leading line + block comments before each statement
      if (opts.removeJsDoc && ts.isJSDoc(node)) return undefined;

      // Remove type annotations from variable / parameter declarations
      if (opts.removeTypeAnnotations) {
        if (ts.isVariableDeclaration(node) && node.type) {
          return ts.factory.updateVariableDeclaration(
            node,
            node.name,
            node.exclamationToken,
            undefined,
            node.initializer,
          );
        }
        if (ts.isParameter(node) && node.type) {
          return ts.factory.updateParameterDeclaration(
            node,
            node.modifiers,
            node.dotDotDotToken,
            node.name,
            node.questionToken,
            undefined,
            node.initializer,
          );
        }
        if (ts.isTypeAliasDeclaration(node)) return undefined;
        if (ts.isInterfaceDeclaration(node)) return undefined;
      }

      return ts.visitEachChild(node, visit, context);
    };

    return ts.visitNode(rootNode, visit) as ts.SourceFile;
  };

  const result = ts.transform(sf, [transformer]);
  const transformedSourceFile = result.transformed[0];
  const printer = ts.createPrinter({ removeComments: opts.removeJsDoc });
  const out = printer.printFile(transformedSourceFile);
  result.dispose();

  const strippedLines = originalLineCount - out.split("\n").length;
  return {
    text: out,
    strippedLines,
    language: languageHint || "typescript",
  };
}

/** Test-only: re-export DEFAULT_OPTIONS for unit tests. */
export const __test__ = { DEFAULT_OPTIONS, LANGUAGE_MAP };
=======
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
>>>>>>> Stashed changes
