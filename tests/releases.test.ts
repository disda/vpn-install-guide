import assert from "node:assert/strict";
import test from "node:test";
import { getGuide, guides } from "../lib/catalog";
import {
  isOfficialAsset,
  loadRelease,
  resolveAsset,
  type Release,
} from "../lib/release-source";

test("备用版本涵盖全部受支持的系统与芯片", async () => {
  for (const guide of guides.filter((item) => item.id !== "ios")) {
    const platform = guide.id as "windows" | "macos" | "android";
    const client = platform === "android" ? "clash" : "flclash";
    const result = await loadRelease(client, async () => {
      throw new Error("offline");
    });
    assert.equal(result.source, "fallback");
    for (const architecture of guide.architectures) {
      const url = resolveAsset(platform, architecture.value, result);
      assert.ok(url);
      assert.equal(isOfficialAsset(url, client), true);
    }
  }
});
test("新版发布选择对应安装包，不选 zip 或错误芯片", async () => {
  const names = [
    "FlClash-9.0.0-windows-arm64-setup.exe",
    "FlClash-9.0.0-windows-amd64.zip",
    "FlClash-9.0.0-windows-amd64-setup.exe",
    "FlClash-9.0.0-macos-arm64.dmg",
  ];
  const release: Release = {
    tag_name: "v9.0.0",
    draft: false,
    prerelease: false,
    assets: names.map((name) => ({
      name,
      browser_download_url: `https://github.com/chen08209/FlClash/releases/download/v9.0.0/${name}`,
    })),
  };
  const result = await loadRelease("flclash", async () => release);
  assert.equal(result.source, "live");
  assert.ok(
    resolveAsset("windows", "amd64", result)?.endsWith(
      "windows-amd64-setup.exe",
    ),
  );
  assert.ok(
    resolveAsset("macos", "arm64", result)?.endsWith("macos-arm64.dmg"),
  );
  assert.equal(resolveAsset("macos", "amd64", result), null);
  assert.equal(resolveAsset("windows", "universal", result), null);
});
test("拒绝非官方域名、混淆域名和错误仓库", () => {
  for (const url of [
    "https://github.com.evil.test/chen08209/FlClash/releases/download/v1/app.exe",
    "https://evil.test/app.exe",
    "http://github.com/chen08209/FlClash/releases/download/v1/app.exe",
    "https://github.com/other/repo/releases/download/v1/app.exe",
    "https://evil@github.com/chen08209/FlClash/releases/download/v1/app.exe",
    "not-a-url",
  ])
    assert.equal(isOfficialAsset(url, "flclash"), false);
});
test("异常响应、预发布、空数据与恶意资产使用备用版本", async () => {
  for (const value of [
    null,
    {},
    { tag_name: "v1", draft: false, prerelease: true, assets: [] },
    {
      tag_name: "v1",
      draft: false,
      prerelease: false,
      assets: [
        { name: "app.exe", browser_download_url: "https://evil.test/app.exe" },
      ],
    },
  ]) {
    const result = await loadRelease("flclash", async () => value);
    assert.equal(result.source, "fallback");
    assert.equal(result.release.tag_name, "v0.9.3");
  }
});
test("每个平台只保留指定客户端，macOS 默认 Apple，Android 通用包", () => {
  assert.deepEqual(
    guides.map((guide) => guide.client),
    ["FlClash", "FlClash", "Shadowrocket", "Clash"],
  );
  assert.equal(getGuide("macos").architectures[0].value, "arm64");
  assert.equal(getGuide("android").architectures[0].value, "universal");
});
