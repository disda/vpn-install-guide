// 从分享原文里提取可快速识别的账号邮箱（纯本地解析，不发请求）。
// 目前识别 ChatGPT Session JSON 一类结构：user.email / email / 被 session 包一层的同名字段。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function emailFromRecord(record: Record<string, unknown>): string | null {
  const user = asRecord(record.user);
  const candidates: unknown[] = [user?.email, record.email, record.user_email];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && EMAIL_PATTERN.test(candidate.trim()))
      return candidate.trim();
  }
  return null;
}

export function extractSharedEmail(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const root = asRecord(parsed);
  if (!root) return null;
  const direct = emailFromRecord(root);
  if (direct) return direct;
  // 兼容被 { session: {...} } / { session_json: {...} } 包一层的导出格式
  for (const key of ["session", "session_json", "sessionJson"]) {
    const nested = asRecord(root[key]);
    if (nested) {
      const email = emailFromRecord(nested);
      if (email) return email;
    }
  }
  return null;
}
