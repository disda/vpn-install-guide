"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  parseSessionInput,
  type QueryResult,
  type SessionInfo,
} from "@/lib/chatgpt-query";

type LocalInfo = Omit<SessionInfo, "accessToken">;

function formatTime(
  value: string | number | null,
  isSeconds = false,
): string {
  if (value === null || value === "") return "—";
  const ms =
    typeof value === "number"
      ? value * (isSeconds ? 1000 : 1)
      : Date.parse(value);
  if (!Number.isFinite(ms)) return String(value);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ms);
}

function remainingText(value: string | number | null, isSeconds = false): string {
  if (value === null || value === "") return "";
  const ms =
    typeof value === "number"
      ? value * (isSeconds ? 1000 : 1)
      : Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const diff = ms - Date.now();
  if (diff <= 0) return "已过期";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `还剩 ${days} 天 ${hours} 小时` : `还剩 ${hours} 小时`;
}

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

function QuotaBar({
  label,
  used,
  remaining,
  resetAt,
  windowMinutes,
}: {
  label: string;
  used: number | null;
  remaining: number | null;
  resetAt: number | null;
  windowMinutes: number | null;
}) {
  if (used === null || remaining === null)
    return (
      <div className="gpt-quota-row">
        <div className="gpt-quota-head">
          <span>{label}</span>
          <span>无数据</span>
        </div>
      </div>
    );
  return (
    <div className="gpt-quota-row">
      <div className="gpt-quota-head">
        <span>
          {label}
          {windowMinutes ? `（${windowMinutes >= 1440 ? `${Math.round(windowMinutes / 1440)} 天` : `${windowMinutes / 60} 小时`}窗口）` : ""}
        </span>
        <strong>剩余 {remaining}%</strong>
      </div>
      <div
        className="gpt-quota-bar"
        role="progressbar"
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, remaining))}%` }} />
      </div>
      <p className="gpt-quota-sub">
        已用 {used}% · 重置时间 {formatTime(resetAt, true)}
        {resetAt ? `（${remainingText(resetAt, true)}）` : ""}
      </p>
    </div>
  );
}

export function ChatGptQueryForm() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [resultLocal, setResultLocal] = useState<LocalInfo | null>(null);

  const parsed = useMemo(
    () => (text.trim() ? parseSessionInput(text) : null),
    [text],
  );
  const local: LocalInfo | null = parsed?.ok
    ? {
        email: parsed.session.email,
        userId: parsed.session.userId,
        accountId: parsed.session.accountId,
        planType: parsed.session.planType,
        sessionExpires: parsed.session.sessionExpires,
        tokenIssuedAt: parsed.session.tokenIssuedAt,
        tokenExpiresAt: parsed.session.tokenExpiresAt,
      }
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!parsed) return;
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/chatgpt/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: parsed.session.accessToken,
          accountId: parsed.session.accountId,
          timezoneOffsetMin: new Date().getTimezoneOffset(),
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "查询失败，请稍后重试。");
        return;
      }
      setResult(data as QueryResult);
      setResultLocal(local);
      setText(""); // 查完立即清空输入框里的凭证
    } catch {
      setError("查询请求失败，请检查网络后重试。");
    } finally {
      setPending(false);
    }
  }

  const subscription = result?.subscription;
  const usage = result?.usage;

  return (
    <>
      <form className="text-editor" onSubmit={submit}>
        <div className="text-editor-heading">
          <div>
            <h2>粘贴 Session JSON</h2>
            <p>先在浏览器登录 ChatGPT，再打开下面的链接复制整段内容</p>
          </div>
          <span className="text-expiry-badge">不保存</span>
        </div>
        <p className="gpt-session-link">
          <a
            href="https://chatgpt.com/api/auth/session"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开 chatgpt.com/api/auth/session ↗
          </a>
          <span>必须在已登录的同一个浏览器里打开；只显示 {"{}"} 就是还没登录。</span>
        </p>
        <label className="text-area-label" htmlFor="gpt-session">
          Session 内容
        </label>
        <textarea
          id="gpt-session"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
            setResult(null);
            setResultLocal(null);
          }}
          disabled={pending}
          placeholder={'{\n  "user": { ... },\n  "expires": "...",\n  "accessToken": "eyJ..."\n}'}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
        <div className="text-editor-status">
          <span
            className={
              parsed
                ? parsed.ok
                  ? "text-status-ok"
                  : "text-status-error"
                : ""
            }
            role="status"
          >
            {parsed
              ? parsed.ok
                ? `✓ 已识别账号 ${maskEmail(parsed.session.email)}，可以查询`
                : parsed.error
              : "粘贴后先在本地识别账号，不会上传"}
          </span>
        </div>

        {local && (
          <dl className="gpt-local-grid" aria-label="本地解析结果">
            <div>
              <dt>账号</dt>
              <dd>{maskEmail(local.email)}</dd>
            </div>
            <div>
              <dt>Session 里的套餐</dt>
              <dd>{local.planType ?? "未提供"}</dd>
            </div>
            <div>
              <dt>登录会话过期</dt>
              <dd>
                {formatTime(local.sessionExpires)}{" "}
                <small>{remainingText(local.sessionExpires)}</small>
              </dd>
            </div>
            <div>
              <dt>accessToken 过期</dt>
              <dd>
                {formatTime(local.tokenExpiresAt, true)}{" "}
                <small>{remainingText(local.tokenExpiresAt, true)}</small>
              </dd>
            </div>
          </dl>
        )}

        {error && (
          <p className="text-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button text-submit"
          type="submit"
          disabled={pending || !parsed?.ok}
        >
          {pending ? "正在查询…" : "查询套餐过期时间与额度"}
        </button>
        <p className="text-under-button">
          只查询你自己的账号。查询时凭证仅经本站转发给 chatgpt.com，本站不保存、不记录；查完自动清空输入框。
        </p>
      </form>

      {result && (
        <section className="gpt-result" aria-label="查询结果">
          <h2>查询结果</h2>
          <dl className="gpt-result-grid">
            <div>
              <dt>套餐</dt>
              <dd>
                {subscription?.planType ?? usage?.planType ?? resultLocal?.planType ?? "未查到"}
              </dd>
            </div>
            <div className="gpt-result-highlight">
              <dt>订阅到期（套餐过期时间）</dt>
              <dd>
                {subscription?.activeUntil
                  ? `${formatTime(subscription.activeUntil)}`
                  : "未查到"}
                {subscription?.activeUntil && (
                  <small> {remainingText(subscription.activeUntil)}</small>
                )}
              </dd>
            </div>
            <div>
              <dt>accessToken 过期</dt>
              <dd>
                {formatTime(resultLocal?.tokenExpiresAt ?? null, true)}{" "}
                <small>{remainingText(resultLocal?.tokenExpiresAt ?? null, true)}</small>
              </dd>
            </div>
            <div>
              <dt>重置额度次数</dt>
              <dd>
                {usage?.resetCreditsAvailable !== null &&
                usage?.resetCreditsAvailable !== undefined
                  ? `${usage.resetCreditsAvailable} 次可用`
                  : "未提供"}
              </dd>
            </div>
          </dl>
          {result.subscriptionError && (
            <p className="text-error" role="alert">
              套餐查询：{result.subscriptionError}
            </p>
          )}
          <h3>Codex 额度</h3>
          {usage ? (
            <>
              <QuotaBar
                label="短窗口额度"
                used={usage.primary?.usedPercent ?? null}
                remaining={usage.primary?.remainingPercent ?? null}
                resetAt={usage.primary?.resetAt ?? null}
                windowMinutes={usage.primary?.windowMinutes ?? null}
              />
              <QuotaBar
                label="长窗口额度"
                used={usage.secondary?.usedPercent ?? null}
                remaining={usage.secondary?.remainingPercent ?? null}
                resetAt={usage.secondary?.resetAt ?? null}
                windowMinutes={usage.secondary?.windowMinutes ?? null}
              />
              {usage.codeReview?.primary && (
                <QuotaBar
                  label="代码审查额度"
                  used={usage.codeReview.primary.usedPercent}
                  remaining={usage.codeReview.primary.remainingPercent}
                  resetAt={usage.codeReview.primary.resetAt}
                  windowMinutes={usage.codeReview.primary.windowMinutes}
                />
              )}
              {usage.limitReached && (
                <p className="text-error" role="alert">
                  当前额度已达上限，等重置时间到后再用。
                </p>
              )}
            </>
          ) : (
            <p className="text-error" role="alert">
              额度查询：{result.usageError ?? "没有返回额度数据。"}
            </p>
          )}
          {result.usageError && usage && (
            <p className="gpt-partial-note">{result.usageError}</p>
          )}
        </section>
      )}
    </>
  );
}
