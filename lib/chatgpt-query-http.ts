import { isAccessTokenShape, queryChatGptAccount } from "./chatgpt-query";
import { sameOrigin, shareResponse } from "./text-share-http";

const MAX_BODY_BYTES = 32 * 1024;

export async function handleChatGptQuery(
  request: Request,
  rateLimit: () => Promise<boolean>,
) {
  if (!sameOrigin(request))
    return shareResponse({ error: "请从本站页面提交查询。" }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return shareResponse({ error: "不支持的提交格式。" }, 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    return shareResponse({ error: "请求内容过大。" }, 413);
  if (!(await rateLimit())) {
    return Response.json(
      { error: "查询过于频繁，请一分钟后再试。" },
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "Retry-After": "60",
        },
      },
    );
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return shareResponse({ error: "请求格式不正确。" }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return shareResponse({ error: "请求格式不正确。" }, 400);
  const value = payload as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) =>
        key !== "accessToken" && key !== "accountId" && key !== "timezoneOffsetMin",
    ) ||
    typeof value.accessToken !== "string" ||
    (value.accountId !== undefined &&
      value.accountId !== null &&
      typeof value.accountId !== "string")
  ) {
    return shareResponse({ error: "请只提交 accessToken 和账号 ID。" }, 400);
  }
  if (!isAccessTokenShape(value.accessToken))
    return shareResponse(
      { error: "accessToken 格式不正确，请粘贴完整的 Session JSON 后再查询。" },
      422,
    );
  const accountId =
    typeof value.accountId === "string" && value.accountId.trim()
      ? value.accountId.trim().slice(0, 128)
      : null;
  const timezoneOffsetMin =
    typeof value.timezoneOffsetMin === "number" &&
    value.timezoneOffsetMin >= -840 &&
    value.timezoneOffsetMin <= 840
      ? Math.trunc(value.timezoneOffsetMin)
      : -480;
  // token 只在本次请求内转发给 chatgpt.com，不落库、不写日志。
  const result = await queryChatGptAccount({
    accessToken: value.accessToken,
    accountId,
    timezoneOffsetMin,
  });
  return shareResponse({ ...result, queriedAt: Date.now() });
}
