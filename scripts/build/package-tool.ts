import { execFileSync, type ExecFileSyncOptions } from "node:child_process";

type PackageTool = "npm" | "npx";

const SAFE_SHELL_ARG = /^[A-Za-z0-9@_./:=,+-]+$/;

export function buildPackageToolInvocation(
  platform: NodeJS.Platform,
  tool: PackageTool,
  args: readonly string[]
): { file: string; args: string[]; options: Pick<ExecFileSyncOptions, "shell"> } {
  if (platform === "win32") {
    for (const arg of args) {
      if (!SAFE_SHELL_ARG.test(arg)) {
        throw new Error(`unsafe package-tool argument for Windows shell: ${JSON.stringify(arg)}`);
      }
    }
  }

  return {
    file: platform === "win32" ? `${tool}.cmd` : tool,
    args: [...args],
    options: platform === "win32" ? { shell: true } : {},
  };
}

export function runPackageTool(
  tool: PackageTool,
  args: readonly string[],
  options: ExecFileSyncOptions
): void {
  const invocation = buildPackageToolInvocation(process.platform, tool, args);
  execFileSync(invocation.file, invocation.args, { ...options, ...invocation.options });
}
