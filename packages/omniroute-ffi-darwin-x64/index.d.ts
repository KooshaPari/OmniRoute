export interface OmnirouteFfiDarwinX64 {
  readonly platform: "darwin-x64";
  readonly nativeDir: string;
  listCrates(): readonly string[];
  resolve(crateBaseName: string): string | null;
}
declare const _default: OmnirouteFfiDarwinX64;
export default _default;