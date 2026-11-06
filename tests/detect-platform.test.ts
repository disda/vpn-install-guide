import assert from "node:assert/strict";
import test from "node:test";
import { detectPlatform } from "../lib/detect-platform";

test("根据桌面与移动端 UA 选择平台，避免 iOS 的 Mac OS X 被误判", () => {
  const cases = [
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
      "windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      "macos",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      "ios",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      "ios",
    ],
    [
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      "ios",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      "ios",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36",
      "android",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
      "android",
    ],
  ] as const;
  for (const [ua, expected] of cases)
    assert.equal(detectPlatform(ua), expected, ua);
});

test("空 UA 与未支持平台保留默认入口", () => {
  for (const ua of [null, "", "curl/8.0", "Mozilla/5.0 (X11; Linux x86_64)"]) {
    assert.equal(detectPlatform(ua), "windows");
  }
});
