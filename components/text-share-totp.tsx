"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCode,
  generateTotp,
  maskSecret,
  totpCounter,
  totpRemainingSeconds,
  TOTP_PERIOD_SECONDS,
} from "@/lib/totp";

/** 分享文本里检测到裸 2FA 密钥时，在本地生成验证码（密钥不发任何请求）。 */
export function TextShareTotp({ secrets }: { secrets: string[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(() =>
    totpRemainingSeconds(Date.now()),
  );
  const [copiedSecret, setCopiedSecret] = useState("");
  const lastCounter = useRef(-1);

  useEffect(() => {
    let alive = true;
    async function refresh(now: number) {
      const entries = await Promise.all(
        secrets.map(
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
    <section className="text-totp" aria-label="2FA 验证码">
      <div className="text-totp-heading">
        <h3>2FA 验证码</h3>
        <span>
          本地计算 · {remaining} 秒后刷新
        </span>
      </div>
      <div
        className="text-totp-progress"
        style={{ width: `${(remaining / TOTP_PERIOD_SECONDS) * 100}%` }}
      />
      {secrets.map((secret) => {
        const code = codes[secret];
        return (
          <div className="text-totp-row" key={secret}>
            <span className="text-totp-secret">{maskSecret(secret)}</span>
            <button
              type="button"
              className="text-totp-code"
              disabled={!code}
              onClick={() => code && copyCode(secret, code)}
              title="点击复制验证码"
            >
              {code ? formatCode(code) : "··· ···"}
            </button>
            <span className="text-totp-copied">
              {copiedSecret === secret ? "已复制" : ""}
            </span>
          </div>
        );
      })}
    </section>
  );
}
