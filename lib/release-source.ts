import { getGuide, type Architecture, type Platform } from "./catalog";

export const repositories = {
  flclash: "chen08209/FlClash",
  clash: "MetaCubeX/ClashMetaForAndroid",
} as const;
export type Client = keyof typeof repositories;
export type Release = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
};
export type ReleaseResult = { release: Release; source: "live" | "fallback" };
export type DownloadInfo = {
  version: string;
  source: "live" | "fallback" | "store";
  sourceUrl: string;
};
export type Downloads = Record<Platform, DownloadInfo>;
export const appStoreUrl =
  "https://apps.apple.com/us/app/shadowrocket/id932747118";

function snapshot(client: Client): Release {
  const version = client === "flclash" ? "0.9.3" : "2.11.36";
  const names =
    client === "flclash"
      ? [
          "windows-amd64-setup.exe",
          "windows-arm64-setup.exe",
          "macos-arm64.dmg",
          "macos-amd64.dmg",
        ].map((suffix) => `FlClash-${version}-${suffix}`)
      : [`cmfa-${version}-meta-universal-release.apk`];
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: false,
    assets: names.map((name) => ({
      name,
      browser_download_url: `https://github.com/${repositories[client]}/releases/download/v${version}/${name}`,
    })),
  };
}

export function isOfficialAsset(url: string, client: Client): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      parsed.pathname.startsWith(`/${repositories[client]}/releases/download/`)
    );
  } catch {
    return false;
  }
}

export function parseRelease(value: unknown, client: Client): Release {
  if (!value || typeof value !== "object") throw new Error("Invalid release");
  const release = value as Partial<Release>;
  if (
    typeof release.tag_name !== "string" ||
    !release.tag_name ||
    release.draft !== false ||
    release.prerelease !== false ||
    !Array.isArray(release.assets)
  )
    throw new Error("Invalid stable release");
  if (
    !release.assets.every(
      (asset) =>
        asset &&
        typeof asset.name === "string" &&
        typeof asset.browser_download_url === "string" &&
        isOfficialAsset(asset.browser_download_url, client),
    )
  )
    throw new Error("Invalid assets");
  return release as Release;
}

export async function loadRelease(
  client: Client,
  request: () => Promise<unknown>,
): Promise<ReleaseResult> {
  try {
    return { release: parseRelease(await request(), client), source: "live" };
  } catch {
    // 官方 API 不可用时，使用 2026-11-06 核对过的已知版本，而非猜测最新链接。
    return { release: snapshot(client), source: "fallback" };
  }
}

export function clientFor(platform: Exclude<Platform, "ios">): Client {
  return platform === "android" ? "clash" : "flclash";
}

export function resolveAsset(
  platform: Exclude<Platform, "ios">,
  arch: Architecture,
  result: ReleaseResult,
): string | null {
  if (!getGuide(platform).architectures.some((option) => option.value === arch))
    return null;
  const pattern =
    platform === "windows"
      ? new RegExp(`^FlClash-.+-windows-${arch}-setup\\.exe$`, "i")
      : platform === "macos"
        ? new RegExp(`^FlClash-.+-macos-${arch}\\.dmg$`, "i")
        : /^cmfa-.+-meta-universal-release\.apk$/i;
  const asset = result.release.assets.find((item) => pattern.test(item.name));
  return asset &&
    isOfficialAsset(asset.browser_download_url, clientFor(platform))
    ? asset.browser_download_url
    : null;
}
