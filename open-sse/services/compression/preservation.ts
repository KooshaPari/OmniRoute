interface PreservedBlock {
  placeholder: string;
  content: string;
}

export function extractPreservedBlocks(text: string): { text: string; blocks: PreservedBlock[] } {
  const blocks: PreservedBlock[] = [];
  let result = text;
  let counter = 0;

  const addBlock = (content: string): string => {
    const placeholder = `[PRESERVED_${counter}]`;
    blocks.push({ placeholder, content });
    counter++;
    return placeholder;
  };

  // Extract fenced code blocks (```lang\n...\n```)
  result = result.replace(/```[a-z]*\n[\s\S]*?\n```/g, (match) => addBlock(match));

  // Extract inline code (`...`)
  result = result.replace(/`[^`\n]+`/g, (match) => addBlock(match));

  // Extract URLs
  result = result.replace(/https?:\/\/[^\s)\]"'>]+/g, (match) => addBlock(match));

  // Extract file paths (Unix and Windows)
  result = result.replace(/(?:\/[a-zA-Z0-9_./-]+|[a-zA-Z]:\\[a-zA-Z0-9_.\\/-]+)/g, (match) => {
    if (match.length < 3) return match;
    if (match.startsWith("[PRESERVED_")) return match;
    return addBlock(match);
  });

  // Extract error-like patterns (TypeError:, Error:, 404, etc.)
  result = result.replace(
    /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|Error):\s*[^\s,;)]+/g,
    (match) => addBlock(match)
  );

  return { text: result, blocks };
}

export function restorePreservedBlocks(text: string, blocks: PreservedBlock[]): string {
  let result = text;
  for (const block of blocks) {
    result = result.replace(block.placeholder, () => block.content);
  }
  return result;
}

export function shouldPreserve(text: string, preservePatterns: RegExp[]): boolean {
  return preservePatterns.some((pattern) => pattern.test(text));
}
