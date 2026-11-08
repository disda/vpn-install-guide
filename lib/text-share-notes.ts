// 分享备注：只存浏览器本地（localStorage），按分享 ID 区分，不经过服务器。
export const SHARE_NOTE_MAX_LENGTH = 200;

export function shareNoteKey(shareId: string): string {
  return `guide-text-share-note:${shareId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadShareNote(
  storage: StorageLike,
  shareId: string,
): string {
  try {
    return storage.getItem(shareNoteKey(shareId)) ?? "";
  } catch {
    return "";
  }
}

export function saveShareNote(
  storage: StorageLike,
  shareId: string,
  note: string,
): void {
  const value = note.slice(0, SHARE_NOTE_MAX_LENGTH);
  try {
    if (value.trim()) storage.setItem(shareNoteKey(shareId), value);
    else storage.removeItem(shareNoteKey(shareId));
  } catch {
    // 本地存储不可用（隐私模式等）时静默放弃，不影响页面使用。
  }
}
