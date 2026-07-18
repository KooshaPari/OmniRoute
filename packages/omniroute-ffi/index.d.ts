export type PlatformKey =
  | "darwin:arm64"
  | "darwin:x64"
  | "linux:x64"
  | "linux:arm64"
  | "win32:x64";

export interface DiscoveredCrate {
  readonly platform: PlatformKey | null;
  readonly crates: Readonly<Record<string, string | null>>;
}

export interface PickedPlatform {
  readonly key: PlatformKey;
  readonly pkg: string;
  readonly platform: PlatformKey;
  readonly nativeDir: string;
  readonly listCrates: () => readonly string[];
  readonly resolve: (crateBaseName: string) => string | null;
}

export declare function platformKey(): PlatformKey | null;
export declare function pickPlatform(): PickedPlatform | null;
export declare function discoverCrates(): DiscoveredCrate;
export declare function discoverCrate(crateBaseName: string): string | null;
export declare const PLATFORM_TABLE: Readonly<Record<string, string>>;