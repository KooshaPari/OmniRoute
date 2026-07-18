/**
 * Type definitions for `@omniroute/ffi-darwin-arm64`.
 */
export interface OmnirouteFfiDarwinArm64 {
  readonly platform: "darwin-arm64";
  readonly nativeDir: string;
  listCrates(): readonly string[];
  resolve(crateBaseName: string): string | null;
}
declare const _default: OmnirouteFfiDarwinArm64;
export default _default;