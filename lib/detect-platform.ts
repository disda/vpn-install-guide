import type { Platform } from "./catalog";

/** 首屏在服务端按请求 UA 选择平台，客户端沿用同一初始值。 */
export function detectPlatform(userAgent: string | null): Platform {
  const ua = userAgent ?? "";

  // iOS UA 也包含 Mac OS X；Android UA 通常包含 Linux，先判断移动端。
  if (/iPhone|iPad|iPod/i.test(ua) || /Macintosh.*Mobile\//i.test(ua)) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macos";

  // 未覆盖的设备保留默认入口，用户仍可手动选择。
  return "windows";
}
