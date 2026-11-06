export const MAX_TEXT_BYTES = 48 * 1024;
export const SHARE_LIFETIME_MS = 24 * 60 * 60 * 1000;
export type TextFormat = "text" | "json";
export type TextShare = {
  id: string;
  text: string;
  format: TextFormat;
  createdAt: number;
  expiresAt: number;
};
export type TextValidation =
  | { ok: true }
  | {
      ok: false;
      code: "empty" | "too_large" | "credentials" | "json";
      error: string;
    };

const sensitiveKey =
  /token|cookie|password|passwd|secret|apikey|privatekey|authorization|credential|session|bearer/i;
const sensitiveText =
  /\b(?:token|cookies?|authorization|bearer|password|passwd|credentials?|access[\s_-]*token|refresh[\s_-]*token|id[\s_-]*token|api[\s_-]*key|client[\s_-]*secret|session(?:[\s_-]*(?:id|key|token))?)\b|api\/auth\/session|-----BEGIN [\w ]*PRIVATE KEY-----|\b(?:sk-proj-|ghp_|github_pat_)/i;
const opaqueValue =
  /[a-z0-9+/_=-]{40,}|[a-z0-9_-]{5,}\.[a-z0-9_-]{5,}\.[a-z0-9_-]{5,}/i;

function normalized(value: string): string {
  let result = value
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "");
  for (let pass = 0; pass < 2; pass++) {
    result = result.replace(/\\u([0-9a-f]{4})/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    );
    try {
      result = decodeURIComponent(result);
    } catch {
      /* 普通文本可能包含独立百分号。 */
    }
  }
  return result;
}

function containsCredentials(text: string, parsed: unknown): boolean {
  const source = normalized(text);
  if (sensitiveText.test(source) || opaqueValue.test(source)) return true;
  const values: unknown[] = [parsed];
  while (values.length) {
    const value = values.pop();
    if (typeof value === "string") {
      const item = normalized(value);
      if (sensitiveText.test(item) || opaqueValue.test(item)) return true;
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (sensitiveKey.test(normalized(key).replace(/[^a-z]/gi, "")))
          return true;
        values.push(child);
      }
    }
  }
  return false;
}

export function validateText(text: string, format: TextFormat): TextValidation {
  if (!text.trim())
    return { ok: false, code: "empty", error: "请先粘贴要分享的文本。" };
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT_BYTES) {
    return {
      ok: false,
      code: "too_large",
      error: "文本超过 48 KB，请缩短后重试。",
    };
  }
  let parsed: unknown;
  let validJson = false;
  try {
    parsed = JSON.parse(text);
    validJson = true;
  } catch {
    /* 校验结果不回显用户内容。 */
  }
  if (containsCredentials(text, parsed)) {
    return {
      ok: false,
      code: "credentials",
      error:
        "检测到登录凭证、密钥或疑似凭证的编码串，无法保存。请勿粘贴 token、Cookie、密码或会话信息。",
    };
  }
  if (format === "json" && !validJson) {
    return {
      ok: false,
      code: "json",
      error: "JSON 格式不正确，请检查双引号、逗号和括号。内容尚未保存。",
    };
  }
  return { ok: true };
}

export function isShareId(id: string): boolean {
  return /^[a-f0-9]{32}$/.test(id);
}

export interface TextShareStore {
  create(share: TextShare): Promise<void>;
  get(id: string): Promise<TextShare | null>;
  delete(id: string): Promise<void>;
}

export async function visibleShare(
  id: string,
  store: TextShareStore,
  now = Date.now(),
): Promise<TextShare | null> {
  if (!isShareId(id)) return null;
  const share = await store.get(id);
  if (!share) return null;
  if (share.expiresAt <= now || !validateText(share.text, share.format).ok) {
    await store.delete(id);
    return null;
  }
  return share;
}
