import {
  MAX_TEXT_BYTES,
  SHARE_LIFETIME_MS,
  isShareId,
  validateText,
  visibleShare,
  type TextShare,
  type TextShareStore,
} from "./text-shares";

export const shareHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export function shareResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: shareHeaders });
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  const url = new URL(request.url);
  // Next.js 本地请求 URL 可能使用 localhost，Host 则保留浏览器实际访问的地址。
  const host = request.headers.get("host") ?? url.host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    url.protocol.slice(0, -1);
  if (!/^https?$/.test(protocol)) return false;
  try {
    return origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

async function readBody(request: Request): Promise<string | null> {
  // 请求体上限 = 文本上限 + JSON 包装开销余量，否则 128 KB 文本会被误判为请求过大。
  const maxBytes = MAX_TEXT_BYTES + 16 * 1024;
  if (Number(request.headers.get("content-length")) > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function createTextShare(
  request: Request,
  store: TextShareStore,
  rateLimit: () => Promise<boolean>,
) {
  if (!sameOrigin(request))
    return shareResponse({ error: "请从本站页面提交文本。" }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return shareResponse({ error: "不支持的提交格式。" }, 415);
  }
  if (!(await rateLimit())) {
    return Response.json(
      { error: "提交过于频繁，请一分钟后再试。" },
      { status: 429, headers: { ...shareHeaders, "Retry-After": "60" } },
    );
  }
  const body = await readBody(request);
  if (body === null) return shareResponse({ error: "请求内容过大。" }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return shareResponse({ error: "请求格式不正确。" }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return shareResponse({ error: "请求格式不正确。" }, 400);
  const value = payload as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => key !== "text" && key !== "format") ||
    typeof value.text !== "string" ||
    (value.format !== "text" && value.format !== "json")
  ) {
    return shareResponse(
      { error: "请提交文本并选择纯文本或 JSON 格式。" },
      400,
    );
  }
  const validation = validateText(value.text, value.format);
  if (!validation.ok)
    return shareResponse(
      { error: validation.error, code: validation.code },
      validation.code === "too_large" ? 413 : 422,
    );
  const now = Date.now();
  const share: TextShare = {
    id: crypto.randomUUID().replaceAll("-", ""),
    text: value.text,
    format: value.format,
    createdAt: now,
    expiresAt: now + SHARE_LIFETIME_MS,
  };
  await store.create(share);
  // 返回相对路径，客户端使用当前站点 origin 生成链接。
  return shareResponse(
    { path: `/text/${share.id}`, expiresAt: share.expiresAt },
    201,
  );
}

export async function getTextShare(id: string, store: TextShareStore) {
  const share = await visibleShare(id, store);
  return share
    ? shareResponse(share)
    : shareResponse({ error: "这份文本不存在、已过期或已被删除。" }, 404);
}

export async function deleteTextShare(
  request: Request,
  id: string,
  store: TextShareStore,
) {
  if (!sameOrigin(request))
    return shareResponse({ error: "请从本站页面操作。" }, 403);
  if (!isShareId(id)) return shareResponse({ error: "文本不存在。" }, 404);
  await store.delete(id);
  return shareResponse({ deleted: true });
}
