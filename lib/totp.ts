// 裸 Base32 密钥的 TOTP 生成（RFC 4226/6238），全程浏览器本地计算。
// 本期范围（用户拍板）：只认裸密钥，固定 SHA-1 / 6 位 / 30 秒，不解析 otpauth://。

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** 归一化密钥：去空格与连字符、转大写。返回 null 表示含非法字符。 */
export function normalizeSecret(input: string): string | null {
  const cleaned = input.replace(/[\s-]+/g, "").toUpperCase();
  if (!cleaned || !/^[A-Z2-7]+={0,6}$/.test(cleaned)) return null;
  return cleaned.replace(/=+$/g, "");
}

export function base32Decode(secret: string): Uint8Array {
  const normalized = normalizeSecret(secret);
  if (normalized === null) throw new Error("invalid base32 secret");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of normalized) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function totpCounter(timeMs: number, period = TOTP_PERIOD_SECONDS): number {
  return Math.floor(timeMs / 1000 / period);
}

export function totpRemainingSeconds(
  timeMs: number,
  period = TOTP_PERIOD_SECONDS,
): number {
  return period - (Math.floor(timeMs / 1000) % period);
}

export async function generateTotp(
  secret: string,
  timeMs: number = Date.now(),
): Promise<string> {
  const keyBytes = base32Decode(secret);
  const counter = totpCounter(timeMs);
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter % 2 ** 32);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, message),
  );
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

const MIN_SECRET_LENGTH = 16;
const MAX_SECRET_LENGTH = 128;

function qualifySecret(candidate: string): string | null {
  const normalized = normalizeSecret(candidate.trim());
  if (
    normalized &&
    normalized.length >= MIN_SECRET_LENGTH &&
    normalized.length <= MAX_SECRET_LENGTH
  )
    return normalized;
  return null;
}

/**
 * 从文本里找裸密钥：一行一个密钥（整段只有一行时就是那一行）。
 * 仅当某一行归一化后是合法 Base32 且长度在 16–128 之间才算，避免误报。
 * 返回去重后的归一化密钥列表，最多 20 个。
 */
export function detectBareSecrets(text: string): string[] {
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const normalized = qualifySecret(line);
    if (normalized) seen.add(normalized);
    if (seen.size >= 20) break;
  }
  return [...seen];
}

export interface TotpEntry {
  secret: string;
  /** 账号标签：完整格式时取邮箱字段、否则取首段（UID）；裸密钥为空。 */
  label: string;
}

/**
 * 2FA 工具页的输入提取：一行一个条目。
 * - 整行是裸密钥：直接用。
 * - 「UID|密码|2FA|邮箱|邮箱密码...」完整格式：优先取第 3 段（2FA 位置），
 *   该段不合法时退回取行内第一个合法的段。
 * 返回去重后的条目列表，最多 50 个。
 */
export function extractTotpEntries(text: string): TotpEntry[] {
  const seen = new Map<string, TotpEntry>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let found: string | null = null;
    let label = "";
    if (trimmed.includes("|")) {
      const fields = trimmed.split("|");
      const ordered = [fields[2], ...fields];
      for (const field of ordered) {
        if (field === undefined) continue;
        found = qualifySecret(field);
        if (found) break;
      }
      if (found) {
        const emailField = fields.find((field) => field.includes("@"));
        label = (emailField ?? fields[0] ?? "").trim();
      }
    } else {
      found = qualifySecret(trimmed);
    }
    if (found && !seen.has(found)) seen.set(found, { secret: found, label });
    if (seen.size >= 50) break;
  }
  return [...seen.values()];
}

export function extractTotpSecrets(text: string): string[] {
  return extractTotpEntries(text).map((entry) => entry.secret);
}

export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** 密钥脱敏展示：只留首尾各 4 位。 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return secret;
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}
