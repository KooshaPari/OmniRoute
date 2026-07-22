// @vitest-environment node
/**
 * Code Stripper — removes comments, JSDoc, and type annotations from TypeScript
 * for deployment/runtime use. Uses TypeScript's own AST for reliable stripping.
 *
 * Updated for TypeScript 7: API moved to `typescript/unstable/ast`.
 */
import * as ts from "typescript/unstable/ast";

interface StripOptions {
  removeComments?: boolean;
  removeJsDoc?: boolean;
  removeTypeAnnotations?: boolean;
}

const DEFAULT_OPTIONS: StripOptions = {
  removeComments: true,
  removeJsDoc: true,
  removeTypeAnnotations: true,
};

/**
 * Parse source code into a TypeScript SourceFile.
 */
function createSource(source: string, fileName: string = "input.ts"): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/**
 * Walk the AST and collect nodes to remove (comments, JSDoc, type annotations).
 */
function collectNodesToRemove(sourceFile: ts.SourceFile, options: StripOptions): Set<ts.Node> {
  const nodesToRemove = new Set<ts.Node>();

  function visit(node: ts.Node) {
    // Remove JSDoc comments
    if (options.removeJsDoc || options.removeComments) {
      const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
      if (ranges) {
        for (const range of ranges) {
          const commentText = sourceFile.text.substring(range.pos, range.end);
          if (commentText.startsWith("/**")) {
            nodesToRemove.add(sourceFile);
          }
        }
      }
    }

    // Remove type annotations
    if (options.removeTypeAnnotations) {
      if (ts.isTypeReferenceNode(node)) {
        nodesToRemove.add(node);
      }
      if (ts.isTypeLiteralNode(node)) {
        nodesToRemove.add(node);
      }
      if (ts.isInterfaceDeclaration(node)) {
        nodesToRemove.add(node);
      }
      if (ts.isTypeAliasDeclaration(node)) {
        nodesToRemove.add(node);
      }
      if (ts.isEnumDeclaration(node)) {
        nodesToRemove.add(node);
      }
      if (ts.isPropertySignature(node)) {
        nodesToRemove.add(node);
      }
      if (ts.isMethodSignature(node)) {
        nodesToRemove.add(node);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return nodesToRemove;
}

/**
 * Strip comments, JSDoc, and optionally type annotations from TypeScript source.
 */
export function stripCode(source: string, options: StripOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sourceFile = createSource(source);

  // Simple approach: use the printer with removal options
  const result = ts.createPrinter({
    removeComments: opts.removeComments,
    omitTrailingSemicolon: false,
  });

  // For type annotation removal, we need a transformer
  const transformers: ts.TransformerFactory<ts.SourceFile>[] = [];

  if (opts.removeTypeAnnotations) {
    transformers.push((context) => (rootNode) => {
      function visit(node: ts.Node): ts.Node {
        // Remove type annotations
        if (ts.isTypeReferenceNode(node)) {
          return undefined as unknown as ts.Node;
        }
        if (ts.isTypeLiteralNode(node)) {
          return undefined as unknown as ts.Node;
        }
        if (ts.isInterfaceDeclaration(node)) {
          return undefined as unknown as ts.Node;
        }
        if (ts.isTypeAliasDeclaration(node)) {
          return undefined as unknown as ts.Node;
        }
        if (ts.isEnumDeclaration(node)) {
          return undefined as unknown as ts.Node;
        }
        return ts.visitEachChild(node, visit, context);
      }
      return ts.visitNode(rootNode, visit) as ts.SourceFile;
    });
  }

  let output = result.printFile(sourceFile);

  // Apply transformers if any
  if (transformers.length > 0) {
    const result = ts.transform(sourceFile, transformers);
    output = result.printer.printFile(result.transformed[0] as ts.SourceFile);
    result.dispose();
  }

  return output;
}

/**
 * Strip only comments (preserve types) — fastest path.
 */
export function stripComments(source: string): string {
  return stripCode(source, { removeComments: true, removeJsDoc: true, removeTypeAnnotations: false });
}

/**
 * Strip only type annotations (preserve comments) — for documentation.
 */
export function stripTypes(source: string): string {
  return stripCode(source, { removeComments: false, removeJsDoc: false, removeTypeAnnotations: true });
}

/**
 * Get TypeScript version being used.
 */
export function getTsVersion(): string {
  return ts.version ?? "unknown";
}
