const MAX_ERROR_LEN = 4096;
const SOURCE_EXT = ["ts", "tsx", "js", "jsx", "mjs", "cjs"] as const;

function looksLikeAbsolutePath(tok: string): boolean {
  if (tok.length < 4 || tok.length > 2048) return false;
  const isPosix = tok.charCodeAt(0) === 0x2f;
  const isWindows = tok.length > 2 && tok.charCodeAt(1) === 0x3a && /[A-Za-z]/.test(tok[0]);
  if (!isPosix && !isWindows) return false;
  const dot = tok.lastIndexOf(".");
  if (dot <= 0 || dot === tok.length - 1) return false;
  const ext = tok
    .slice(dot + 1)
    .split(":", 1)[0]
    .toLowerCase();
  return (SOURCE_EXT as readonly string[]).includes(ext);
}

/**
 * Strip stack-trace tail and absolute source paths from error messages.
 */
export function sanitizeErrorMessage(message: unknown): string {
  let str = typeof message === "string" ? message : String(message ?? "");
  if (str.length > MAX_ERROR_LEN) str = str.slice(0, MAX_ERROR_LEN);
  const nl = str.indexOf("\n");
  const firstLine = nl >= 0 ? str.slice(0, nl) : str;
  const parts = firstLine.split(/(\s+)/);
  for (let i = 0; i < parts.length; i++) {
    if (looksLikeAbsolutePath(parts[i])) parts[i] = "<path>";
  }
  return parts.join("");
}
