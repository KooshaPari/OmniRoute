export interface OmnirouteFfiLinuxArm64Gnu {
  readonly platform: "linux-arm64-gnu";
  readonly nativeDir: string;
  listCrates(): readonly string[];
  resolve(crateBaseName: string): string | null;
}
declare const _default: OmnirouteFfiLinuxArm64Gnu;
export default _default;