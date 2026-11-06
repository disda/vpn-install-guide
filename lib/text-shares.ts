export const MAX_TEXT_BYTES = 128 * 1024;
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
      code: "empty" | "too_large" | "json";
      error: string;
    };

export function validateText(text: string, format: TextFormat): TextValidation {
  if (!text.trim())
    return { ok: false, code: "empty", error: "请先粘贴要分享的文本。" };
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT_BYTES) {
    return {
      ok: false,
      code: "too_large",
      error: "文本超过 128 KB，请缩短后重试。",
    };
  }
  if (format === "json") {
    try {
      JSON.parse(text);
    } catch {
      return {
        ok: false,
        code: "json",
        error: "JSON 格式不正确，请检查双引号、逗号和括号。内容尚未保存。",
      };
    }
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
