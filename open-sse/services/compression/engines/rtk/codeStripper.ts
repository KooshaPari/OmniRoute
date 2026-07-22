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
}

const DEFAULT_OPTIONS: StripOptions = {
  removeComments: true,
  removeJsDoc: true,
  removeTypeAnnotations: true,
};

function isJsxElement(node: ts.Node): node is ts.JsxElement {
  return ts.isJsxElement(node);
}

function removeJsxChildren(node: ts.JsxElement): ts.JsxSelfClosingElement {
  return ts.factory.createJsxSelfClosingElement(
    node.openingElement.tagName,
    node.openingElement.attributes,
    undefined
  );
}

export function stripCode(
  source: string,
  filename = "input.ts",
  options: StripOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);

  const result: string[] = [];

  function processNode(node: ts.Node) {
    if (opts.removeComments || opts.removeJsDoc) {
      const ranges = ts.getLeadingCommentRanges(source, node.getFullStart());
      if (ranges) {
        for (const range of ranges) {
          if (opts.removeJsDoc && source.slice(range.pos, range.pos + 3) === "/**") {
            continue;
          }
          if (opts.removeComments) {
            continue;
          }
        }
      }
    }

    if (opts.removeTypeAnnotations) {
      if (ts.isTypeAliasDeclaration(node)) return;
      if (ts.isInterfaceDeclaration(node)) return;
      if (ts.isTypeParameterDeclaration(node)) return;
      if (ts.isPropertySignature(node)) return;
      if (ts.isMethodSignature(node)) return;
      if (ts.isParameter(node) && node.type) {
        node = ts.factory.updateParameterDeclaration(
          node, undefined, undefined, node.name, node.questionToken, undefined, node.initializer
        );
      }
    }

    if (isJsxElement(node)) {
      node = removeJsxChildren(node);
    }

    ts.forEachChild(node, processNode);
  }

  ts.forEachChild(sf, processNode);

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: opts.removeComments,
    omitTrailingSemicolon: true,
  });

  return printer.printFile(sf);
}

export function stripCodeWithDefaults(source: string): string {
  return stripCode(source);
}
