import { NextResponse } from "next/server";

// 服务端转发 AIHOT 公开 API（Codex 重置 · 最近 7 天）。
// 上游每 10 分钟采集一次，这里用 s-maxage=600 让边缘缓存同一节奏，
// 避免每个访客都直连上游；响应保留数据来源信息。
const UPSTREAM = "https://aihot.news/api/v1/codex-resets/recent";

export async function GET() {
  try {
    const res = await fetch(UPSTREAM, {
      headers: { "User-Agent": "guide.wepic.top codex-reset page" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "upstream_unavailable" },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=600",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }
}
