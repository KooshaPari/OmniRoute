export interface OmnirouteFfiWin32X64 {
  readonly platform: "win32-x64";
  readonly nativeDir: string;
  listCrates(): readonly string[];
  resolve(crateBaseName: string): string | null;
}
declare const _default: OmnirouteFfiWin32X64;
export default _default;