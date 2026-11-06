import { NextRequest, NextResponse } from "next/server";
import { getGuide, isPlatform } from "@/lib/catalog";
import { appStoreUrl, clientFor, resolveAsset } from "@/lib/release-source";
import { getRelease } from "@/lib/releases";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
) {
  const { platform } = await context.params;
  if (!isPlatform(platform))
    return NextResponse.json({ error: "不支持的平台" }, { status: 404 });
  const guide = getGuide(platform);
  const arch =
    request.nextUrl.searchParams.get("arch") ?? guide.architectures[0].value;
  const option = guide.architectures.find((item) => item.value === arch);
  if (!option)
    return NextResponse.json({ error: "不支持的芯片类型" }, { status: 400 });
  const headers = { "Cache-Control": "no-store" };
  if (platform === "ios")
    return NextResponse.redirect(appStoreUrl, { status: 307, headers });
  const release = await getRelease(clientFor(platform));
  const url = resolveAsset(platform, option.value, release);
  if (!url) {
    // 不将错误页伪装成安装包下载；用户可直接查看官方发布页。
    return NextResponse.json(
      { error: "官方当前版本未提供该安装包，请前往官方发布页查看。" },
      { status: 503, headers },
    );
  }
  return NextResponse.redirect(url, { status: 307, headers });
}
