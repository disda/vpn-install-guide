import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RateLimit } from "@cloudflare/workers-types";
import { handleChatGptQuery } from "@/lib/chatgpt-query-http";
import { shareResponse } from "@/lib/text-share-http";

export async function POST(request: Request) {
  try {
    let limiter: RateLimit | undefined;
    try {
      const { env } = await getCloudflareContext({ async: true });
      limiter = (
        env as typeof env & { TEXT_SHARE_RATE_LIMITER?: RateLimit }
      ).TEXT_SHARE_RATE_LIMITER;
    } catch {
      limiter = undefined;
    }
    const rateLimit = async () => {
      if (!limiter) return true; // 本地开发无绑定时不拦截
      const key = `chatgpt-query:${request.headers.get("cf-connecting-ip") ?? "local"}`;
      return (await limiter.limit({ key })).success;
    };
    return await handleChatGptQuery(request, rateLimit);
  } catch {
    return shareResponse({ error: "查询服务暂时不可用，请稍后重试。" }, 503);
  }
}
