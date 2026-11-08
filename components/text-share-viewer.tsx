"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import type { TextShare } from "@/lib/text-shares";
import { extractSharedEmail } from "@/lib/text-share-insights";
import {
  loadShareNote,
  saveShareNote,
  SHARE_NOTE_MAX_LENGTH,
} from "@/lib/text-share-notes";

const SHARE_NOTE_EVENT = "guide-share-note-changed";

function subscribeShareNote(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SHARE_NOTE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SHARE_NOTE_EVENT, onStoreChange);
  };
}

export function TextShareViewer({ share }: { share: TextShare }) {
  const [message, setMessage] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const content = useRef<HTMLTextAreaElement>(null);
  const accountEmail = useMemo(() => extractSharedEmail(share.text), [share.text]);
  const getNoteSnapshot = useCallback(
    () => loadShareNote(window.localStorage, share.id),
    [share.id],
  );
  const note = useSyncExternalStore(
    subscribeShareNote,
    getNoteSnapshot,
    () => "",
  );

  function updateNote(value: string) {
    saveShareNote(window.localStorage, share.id, value);
    window.dispatchEvent(new Event(SHARE_NOTE_EVENT));
  }

  const noteEditor = (
    <div className="text-note-row">
      <label htmlFor="share-note">备注</label>
      <input
        id="share-note"
        type="text"
        value={note}
        maxLength={SHARE_NOTE_MAX_LENGTH}
        placeholder="给这段分享加个备注"
        onChange={(event) => updateNote(event.target.value)}
        autoComplete="off"
      />
      <span className="text-note-hint">
        {note ? "已保存在本机" : "仅保存在本机浏览器"}
      </span>
    </div>
  );

  async function copyEmail() {
    if (!accountEmail) return;
    try {
      await navigator.clipboard.writeText(accountEmail);
      setMessage("邮箱已复制。");
    } catch {
      setMessage("复制失败，请长按邮箱手动复制。");
    }
  }
  const expiration = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(share.expiresAt);

  async function copyText() {
    if (Date.now() >= share.expiresAt) {
      setMessage("这份文本已过期，请重新打开页面。");
      return;
    }
    try {
      await navigator.clipboard.writeText(share.text);
      setMessage("完整原文已复制。");
    } catch {
      content.current?.focus();
      content.current?.select();
      setMessage(
        "文本已选中，请手动复制（电脑可按 Ctrl + C，Mac 可按 ⌘ + C）。",
      );
    }
  }

  function downloadText() {
    if (Date.now() >= share.expiresAt) {
      setMessage("这份文本已过期，请重新打开页面。");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([share.text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      share.format === "json" ? "shared-text.json" : "shared-text.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function removeText() {
    if (
      !window.confirm("删除后，所有持有这个链接的人都将无法再读取。确认删除？")
    )
      return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/text/${share.id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        setMessage("删除失败，请稍后重试。");
        return;
      }
      setDeleted(true);
    } catch {
      setMessage("删除失败，请检查网络后重试。");
    } finally {
      setDeleting(false);
    }
  }

  if (deleted)
    return (
      <section className="text-empty">
        <div className="text-dialog-check" aria-hidden="true"><Check size={22} /></div>
        <h1>这份文本已删除</h1>
        <p>原链接已无法读取。</p>
        <Link className="primary-button" href="/text">
          创建新的分享
        </Link>
      </section>
    );

  return (
    <>
      <section className="text-hero">
        <p className="eyebrow">
          <span /> 一份分享给你的文本
        </p>
        <h1>
          完整原文，在这里<span>。</span>
        </h1>
        <p>内容保持原样，可以一键复制或下载。</p>
      </section>
      <section className="text-editor text-viewer">
        <div className="text-editor-heading">
          <div>
            <h2>{share.format === "json" ? "JSON 文本" : "纯文本"}</h2>
            <p>{expiration} 到期（北京时间）</p>
          </div>
          <span className="text-expiry-badge">
            {new TextEncoder()
              .encode(share.text)
              .byteLength.toLocaleString("zh-CN")}{" "}
            字节
          </span>
        </div>
        <div className="text-view-actions">
          <button type="button" className="primary-button" onClick={copyText}>
            复制完整原文
          </button>
          <button
            type="button"
            className="text-secondary-button"
            onClick={downloadText}
          >
            下载文件 ↓
          </button>
          <button
            type="button"
            className="text-delete-button"
            disabled={deleting}
            onClick={removeText}
          >
            {deleting ? "正在删除…" : "删除分享"}
          </button>
        </div>
        <p className="text-view-message" role="status">
          {message || "点击下方文本也可自行选择复制。"}
        </p>
        {accountEmail ? (
          <div className="text-email-banner">
            <div className="text-email-row">
              <div>
                <span className="text-email-label">账号邮箱</span>
                <span className="text-email-value">{accountEmail}</span>
              </div>
              <button
                type="button"
                className="text-secondary-button"
                onClick={copyEmail}
              >
                复制邮箱
              </button>
            </div>
            {noteEditor}
          </div>
        ) : (
          <div className="text-note-banner">{noteEditor}</div>
        )}
        <label className="text-area-label" htmlFor="shared-content">
          分享的原文
        </label>
        <textarea
          ref={content}
          id="shared-content"
          value={share.text}
          readOnly
          spellCheck={false}
          autoComplete="off"
        />
      </section>
      <p className="text-new-share">
        <Link href="/text">我也要分享一段文本 <ArrowUpRight size={14} aria-hidden="true" /></Link>
      </p>
    </>
  );
}
