import assert from "node:assert/strict";
import test from "node:test";
import {
  loadShareNote,
  saveShareNote,
  shareNoteKey,
  SHARE_NOTE_MAX_LENGTH,
} from "../lib/text-share-notes";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

test("备注按分享 ID 存取，清空即删除", () => {
  const storage = fakeStorage();
  saveShareNote(storage, "share-a", "这是 A 的备注");
  saveShareNote(storage, "share-b", "这是 B 的备注");
  assert.equal(loadShareNote(storage, "share-a"), "这是 A 的备注");
  assert.equal(loadShareNote(storage, "share-b"), "这是 B 的备注");
  assert.equal(storage.map.has(shareNoteKey("share-a")), true);
  saveShareNote(storage, "share-a", "   ");
  assert.equal(loadShareNote(storage, "share-a"), "");
  assert.equal(storage.map.has(shareNoteKey("share-a")), false);
  assert.equal(loadShareNote(storage, "share-b"), "这是 B 的备注");
});

test("备注超长截断，存储抛错时静默", () => {
  const storage = fakeStorage();
  saveShareNote(storage, "s1", "x".repeat(SHARE_NOTE_MAX_LENGTH + 50));
  assert.equal(loadShareNote(storage, "s1").length, SHARE_NOTE_MAX_LENGTH);
  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
  assert.equal(loadShareNote(broken, "s1"), "");
  saveShareNote(broken, "s1", "anything");
});
