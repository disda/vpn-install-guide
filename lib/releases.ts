import "server-only";
import {
  clientFor,
  loadRelease,
  repositories,
  appStoreUrl,
  type Client,
  type Downloads,
} from "./release-source";
import { platformIds } from "./catalog";

export async function getRelease(client: Client) {
  return loadRelease(client, async () => {
    const response = await fetch(
      `https://api.github.com/repos/${repositories[client]}/releases/latest`,
      {
        headers: {
          "User-Agent": "vpn-install-guide",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        cache: "force-cache",
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok)
      throw new Error(`GitHub release status ${response.status}`);
    return response.json();
  });
}

export async function getDownloads(): Promise<Downloads> {
  const [flclash, clash] = await Promise.all([
    getRelease("flclash"),
    getRelease("clash"),
  ]);
  return Object.fromEntries(
    platformIds.map((platform) => {
      if (platform === "ios")
        return [
          platform,
          { version: "App Store", source: "store", sourceUrl: appStoreUrl },
        ];
      const result = platform === "android" ? clash : flclash;
      return [
        platform,
        {
          version: result.release.tag_name,
          source: result.source,
          sourceUrl: `https://github.com/${repositories[clientFor(platform)]}/releases/latest`,
        },
      ];
    }),
  ) as Downloads;
}
