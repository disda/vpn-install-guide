"use client";

import { useEffect, useRef, useState } from "react";
import {
  extractTotpSecrets,
  formatCode,
  generateTotp,
  totpCounter,
  totpRemainingSeconds,
} from "@/lib/totp";

/**
 * 在线 2FA 验证工具（逻辑对齐 2fa.fun，计算方式不同）：
 * 输入密钥后点按钮出码，结果含验证码、剩余秒数与原始密钥；
 * 全部在浏览器本地计算，密钥不发任何请求。
 */
export function TwoFaTool() {
  const [input, setInput] = useState("");
  const [secrets, setSecrets] = useState<string[] | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(() =>
    totpRemainingSeconds(Date.now()),
  );
  const [error, setError] = useState("");
  const [copiedSecret, setCopiedSecret] = useState("");
  const lastCounter = useRef(-1);

  useEffect(() => {
    if (!secrets) return;
    let alive = true;
    async function refresh(now: number) {
      const entries = await Promise.all(
        secrets!.map(
          async (secret) =>
            [secret, await generateTotp(secret, now)] as const,
        ),
      );
      if (alive) setCodes(Object.fromEntries(entries));
    }
    const now = Date.now();
    lastCounter.current = totpCounter(now);
    void refresh(now);
    const timer = setInterval(() => {
      const current = Date.now();
      setRemaining(totpRemainingSeconds(current));
      const counter = totpCounter(current);
      if (counter !== lastCounter.current) {
        lastCounter.current = counter;
        void refresh(current);
      }
    }, 500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [secrets]);

  function handleInput(value: string) {
    setInput(value);
    setError("");
    if (secrets) {
      setSecrets(null);
      setCodes({});
    }
  }

  function generate() {
    const found = extractTotpSecrets(input);
    if (found.length === 0) {
      setError(
        "没有识别到有效的 2FA 密钥。请粘贴 Base32 密钥（一行一个），或 UID|密码|2FA|邮箱... 格式（一行一个账户）。",
      );
      return;
    }
    setError("");
    setRemaining(totpRemainingSeconds(Date.now()));
    setSecrets(found);
  }

  async function copyCode(secret: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSecret(secret);
      setTimeout(() => setCopiedSecret(""), 1500);
    } catch {
      setCopiedSecret("");
    }
  }

  return (
    <section className="text-editor tfa-tool">
      <label className="text-area-label" htmlFor="tfa-input">
        2FA 密钥
      </label>
      <textarea
        id="tfa-input"
        value={input}
        onChange={(event) => handleInput(event.target.value)}
        placeholder="在此粘贴 2FA 密钥，一行一个"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        rows={5}
      />
      <p className="tfa-format-hint">
        也可以输入完整格式：UID|密码|2FA|邮箱|邮箱密码... 每行 1 个账户
      </p>
      <button
        type="button"
        className="primary-button tfa-submit"
        onClick={generate}
        disabled={!input.trim()}
      >
        获取验证码
      </button>
      {error && (
        <p className="text-error" role="alert">
          {error}
        </p>
      )}
      {secrets && (
        <div className="tfa-results">
          <h3>来自 2FA 的信息</h3>
          <div className="tfa-table-head" aria-hidden="true">
            <span>验证码</span>
            <span>时间</span>
            <span>2FA</span>
          </div>
          {secrets.map((secret) => {
            const code = codes[secret];
            return (
              <div className="tfa-row" key={secret}>
                <div className="tfa-code-cell">
                  <span className="tfa-code">
                    {code ? formatCode(code) : "··· ···"}
                  </span>
                  <button
                    type="button"
                    className="tfa-copy"
                    disabled={!code}
                    onClick={() => code && copyCode(secret, code)}
                  >
                    {copiedSecret === secret ? "已复制" : "复制"}
                  </button>
                </div>
                <span className="tfa-time">◷ {remaining}</span>
                <span className="tfa-secret" title={secret}>
                  {secret}
                </span>
              </div>
            );
          })}
          <p className="tfa-local-note">
            验证码每 30 秒自动更新。所有计算都在你的浏览器本地完成，密钥不会上传到服务器。
          </p>
        </div>
      )}
    </section>
  );
}
