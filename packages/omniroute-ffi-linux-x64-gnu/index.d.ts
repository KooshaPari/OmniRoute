export interface OmnirouteFfiLinuxX64Gnu {
  readonly platform: "linux-x64-gnu";
  readonly nativeDir: string;
  listCrates(): readonly string[];
  resolve(crateBaseName: string): string | null;
}
declare const _default: OmnirouteFfiLinuxX64Gnu;
export default _default;