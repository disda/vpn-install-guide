"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  extractTotpEntries,
  formatCode,
  generateTotp,
  maskSecret,
  totpCounter,
  totpRemainingSeconds,
  type TotpEntry,
} from "@/lib/totp";
import {
  EMPTY_TWO_FA_STORE,
  parseTwoFaStore,
  pushRecent,
  TWO_FA_STORE_KEY,
  upsertSaved,
  type TwoFaStoreData,
} from "@/lib/two-fa-storage";

const STORE_EVENT = "guide-two-fa-store-changed";

let snapshotCache: { raw: string | null; data: TwoFaStoreData } = {
  raw: null,
  data: EMPTY_TWO_FA_STORE,
};

function getSnapshot(): TwoFaStoreData {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TWO_FA_STORE_KEY);
  } catch {
    raw = null;
  }
  if (snapshotCache.raw !== raw) {
    snapshotCache = { raw, data: parseTwoFaStore(raw) };
  }
  return snapshotCache.data;
}

function getServerSnapshot(): TwoFaStoreData {
  return EMPTY_TWO_FA_STORE;
}

function subscribe(callback: () => void) {
  window.addEventListener(STORE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function writeStore(next: TwoFaStoreData) {
  try {
    localStorage.setItem(TWO_FA_STORE_KEY, JSON.stringify(next));
  } catch {
    // 存储不可用时静默失败，不影响取码
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}

function currentTimeMs(): number {
  return Date.now();
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 在线 2FA 验证工具（逻辑对齐 2fa.fun，计算方式不同）：
 * 输入密钥后点按钮出码；已保存与近期查询存 localStorage，只存密钥与标签，
 * 不存完整格式里的密码字段；验证码全程浏览器本地计算。
 */
export function TwoFaTool() {
  const store = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<TotpEntry[] | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(() =>
    totpRemainingSeconds(Date.now()),
  );
  const [error, setError] = useState("");
  const [copiedSecret, setCopiedSecret] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draftName, setDraftName] = useState("");
  const lastCounter = useRef(-1);
  const toolRef = useRef<HTMLElement>(null);

  const secrets = entries?.map((entry) => entry.secret) ?? null;
  const secretsKey = secrets?.join("\n") ?? "";

  useEffect(() => {
    if (!secretsKey) return;
    const list = secretsKey.split("\n");
    let alive = true;
    async function refresh(now: number) {
      const results = await Promise.all(
        list.map(
          async (secret) =>
            [secret, await generateTotp(secret, now)] as const,
        ),
      );
      if (alive) setCodes(Object.fromEntries(results));
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
  }, [secretsKey]);

  function generateFrom(text: string): boolean {
    const found = extractTotpEntries(text);
    if (found.length === 0) {
      setError(
        "没有识别到有效的 2FA 密钥。请粘贴 Base32 密钥（一行一个），或 UID|密码|2FA|邮箱... 格式（一行一个账户）。",
      );
      return false;
    }
    setError("");
    setInput(text);
    setRemaining(totpRemainingSeconds(currentTimeMs()));
    setEntries(found);
    const current = getSnapshot();
    writeStore({
      ...current,
      recent: pushRecent(current.recent, {
        id: newId(),
        secrets: found.map((entry) => entry.secret),
        labels: found.map(
          (entry) => entry.label || maskSecret(entry.secret),
        ),
        at: currentTimeMs(),
      }),
    });
    return true;
  }

  function handleInput(value: string) {
    setInput(value);
    setError("");
    if (entries) {
      setEntries(null);
      setCodes({});
    }
  }

  function loadAndScroll(text: string) {
    if (generateFrom(text)) {
      toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  function saveEntry(entry: TotpEntry) {
    const current = getSnapshot();
    writeStore({
      ...current,
      saved: upsertSaved(current.saved, {
        id: newId(),
        name: entry.label || maskSecret(entry.secret),
        secret: entry.secret,
        createdAt: Date.now(),
      }),
    });
  }

  function removeSaved(id: string) {
    const current = getSnapshot();
    writeStore({
      ...current,
      saved: current.saved.filter((item) => item.id !== id),
    });
  }

  function renameSaved(id: string) {
    const name = draftName.trim();
    if (!name) return;
    const current = getSnapshot();
    writeStore({
      ...current,
      saved: current.saved.map((item) =>
        item.id === id ? { ...item, name } : item,
      ),
    });
    setEditingId("");
  }

  function removeRecent(id: string) {
    const current = getSnapshot();
    writeStore({
      ...current,
      recent: current.recent.filter((item) => item.id !== id),
    });
  }

  function clearRecent() {
    const current = getSnapshot();
    writeStore({ ...current, recent: [] });
  }

  const savedSecrets = new Set(store.saved.map((item) => item.secret));

  return (
    <>
      <section className="text-editor tfa-tool" ref={toolRef}>
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
          onClick={() => generateFrom(input)}
          disabled={!input.trim()}
        >
          获取验证码
        </button>
        {error && (
          <p className="text-error" role="alert">
            {error}
          </p>
        )}
        {entries && (
          <div className="tfa-results">
            <h3>来自 2FA 的信息</h3>
            <div className="tfa-table-head" aria-hidden="true">
              <span>验证码</span>
              <span>时间</span>
              <span>2FA</span>
            </div>
            {entries.map((entry) => {
              const code = codes[entry.secret];
              const isSaved = savedSecrets.has(entry.secret);
              return (
                <div className="tfa-row" key={entry.secret}>
                  <div className="tfa-code-cell">
                    <span className="tfa-code">
                      {code ? formatCode(code) : "··· ···"}
                    </span>
                    <button
                      type="button"
                      className="tfa-copy"
                      disabled={!code}
                      onClick={() => code && copyCode(entry.secret, code)}
                    >
                      {copiedSecret === entry.secret ? "已复制" : "复制"}
                    </button>
                  </div>
                  <span className="tfa-time">◷ {remaining}</span>
                  <div className="tfa-secret-cell">
                    <span className="tfa-secret" title={entry.secret}>
                      {entry.secret}
                    </span>
                    <button
                      type="button"
                      className="tfa-save"
                      disabled={isSaved}
                      onClick={() => saveEntry(entry)}
                    >
                      {isSaved ? "已保存" : "保存"}
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="tfa-local-note">
              验证码每 30 秒自动更新。所有计算都在你的浏览器本地完成，密钥不会上传到服务器。
            </p>
          </div>
        )}
      </section>

      {store.saved.length > 0 && (
        <section className="tfa-store-card">
          <div className="tfa-store-heading">
            <h2>已保存</h2>
            <span>只保存在本机浏览器</span>
          </div>
          {store.saved.map((item) => (
            <div className="tfa-store-row" key={item.id}>
              {editingId === item.id ? (
                <span className="tfa-rename">
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    maxLength={60}
                    autoFocus
                  />
                  <button type="button" onClick={() => renameSaved(item.id)}>
                    确定
                  </button>
                  <button type="button" onClick={() => setEditingId("")}>
                    取消
                  </button>
                </span>
              ) : (
                <span className="tfa-store-name">{item.name}</span>
              )}
              <span className="tfa-store-secret">
                {maskSecret(item.secret)}
              </span>
              <span className="tfa-store-actions">
                <button
                  type="button"
                  onClick={() => loadAndScroll(item.secret)}
                >
                  查看
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id);
                    setDraftName(item.name);
                  }}
                >
                  改名
                </button>
                <button type="button" onClick={() => removeSaved(item.id)}>
                  删除
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      {store.recent.length > 0 && (
        <section className="tfa-store-card">
          <div className="tfa-store-heading">
            <h2>近期查询</h2>
            <span>只保存在本机浏览器 · 最多 10 条</span>
            <button type="button" className="tfa-clear" onClick={clearRecent}>
              清空
            </button>
          </div>
          {store.recent.map((item) => (
            <div className="tfa-store-row" key={item.id}>
              <span className="tfa-store-name">
                {item.labels.join("、")}
                {item.secrets.length > 1
                  ? `（共 ${item.secrets.length} 个）`
                  : ""}
              </span>
              <span className="tfa-store-secret">{formatTime(item.at)}</span>
              <span className="tfa-store-actions">
                <button
                  type="button"
                  onClick={() => loadAndScroll(item.secrets.join("\n"))}
                >
                  载入
                </button>
                <button type="button" onClick={() => removeRecent(item.id)}>
                  删除
                </button>
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
