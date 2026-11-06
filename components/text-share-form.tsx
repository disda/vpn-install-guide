"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  MAX_TEXT_BYTES,
  validateText,
  type TextFormat,
} from "@/lib/text-shares";

type ShareResult = { url: string; path: string; expiresAt: number };

export function TextShareForm() {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<TextFormat>("json");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const validation = useMemo(
    () => (text ? validateText(text, format) : null),
    [text, format],
  );
  const bytes = new TextEncoder().encode(text).byteLength;

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("链接已复制，可直接粘贴发送。");
    } catch {
      setCopyStatus(
        "浏览器未允许自动复制。请点击下方按钮，或选中链接手动复制。",
      );
      // 等待新生成的链接写入输入框，再选中完整链接。
      requestAnimationFrame(() => {
        if (!dialog.current?.open) return;
        linkInput.current?.focus();
        linkInput.current?.select();
      });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const check = validateText(text, format);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, format }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "暂时无法保存，请稍后重试。");
        return;
      }
      const url = new URL(data.path, window.location.origin).href;
      setResult({ url, path: data.path, expiresAt: data.expiresAt });
      setCopyStatus("正在复制链接…");
      dialog.current?.showModal();
      await copyLink(url);
    } catch {
      setError("暂时无法保存，请检查网络后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="text-editor" onSubmit={submit}>
        <div className="text-editor-heading">
          <div>
            <h2>粘贴你的文本</h2>
            <p>保留换行、空格和原始内容</p>
          </div>
          <span className="text-expiry-badge">24 小时有效</span>
        </div>
        <fieldset className="text-mode" disabled={pending}>
          <legend>内容格式</legend>
          <label className={format === "json" ? "selected" : ""}>
            <input
              type="radio"
              name="format"
              value="json"
              checked={format === "json"}
              onChange={() => {
                setFormat("json");
                setError("");
              }}
            />
            JSON
          </label>
          <label className={format === "text" ? "selected" : ""}>
            <input
              type="radio"
              name="format"
              value="text"
              checked={format === "text"}
              onChange={() => {
                setFormat("text");
                setError("");
              }}
            />
            纯文本
          </label>
        </fieldset>
        <label className="text-area-label" htmlFor="share-content">
          要分享的内容
        </label>
        <textarea
          id="share-content"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          disabled={pending}
          placeholder={
            format === "json"
              ? '{\n  "message": "在这里粘贴 JSON"\n}'
              : "在这里粘贴长文本…"
          }
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-describedby="text-validation text-size"
        />
        <div className="text-editor-status">
          <span
            id="text-validation"
            className={
              validation && !validation.ok
                ? "text-status-error"
                : validation?.ok
                  ? "text-status-ok"
                  : ""
            }
            role="status"
          >
            {validation
              ? validation.ok
                ? format === "json"
                  ? "✓ JSON 格式正确"
                  : "✓ 文本检查通过"
                : validation.error
              : format === "json"
                ? "粘贴后自动校验 JSON"
                : "粘贴后检查文本"}
          </span>
          <span
            id="text-size"
            className={bytes > MAX_TEXT_BYTES ? "text-status-error" : ""}
          >
            {(bytes / 1024).toFixed(1)} / {MAX_TEXT_BYTES / 1024} KB
          </span>
        </div>
        {error && (
          <p className="text-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button text-submit"
          type="submit"
          disabled={pending || !validation?.ok}
        >
          {pending ? "正在保存…" : "生成分享链接"}
          <span aria-hidden="true">↗</span>
        </button>
        <p className="text-under-button">
          只发送链接即可。持有链接的人可查看、复制或删除这份文本。
        </p>
      </form>
      <dialog
        ref={dialog}
        className="text-share-dialog"
        aria-labelledby="share-dialog-title"
      >
        <div className="text-dialog-check" aria-hidden="true">
          ✓
        </div>
        <h2 id="share-dialog-title">分享链接已生成</h2>
        <p>把下面的链接发给对方，就能查看完整文本。</p>
        <label htmlFor="share-link">分享链接</label>
        <input
          ref={linkInput}
          id="share-link"
          readOnly
          value={result?.url ?? ""}
          onFocus={(event) => event.currentTarget.select()}
        />
        <p className="text-copy-status" role="status">
          {copyStatus}
        </p>
        <div className="text-dialog-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => result && copyLink(result.url)}
          >
            复制链接
          </button>
          {result && (
            <Link className="text-secondary-button" href={result.path}>
              打开分享
            </Link>
          )}
        </div>
        <p className="text-dialog-footnote">
          链接有效期为 24 小时，请只发送给需要的人。
        </p>
        <button
          className="text-dialog-close"
          type="button"
          aria-label="关闭弹窗"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </dialog>
    </>
  );
}
