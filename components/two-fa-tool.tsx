"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  extractTotpEntries,
  formatCode,
  generateTotp,
  normalizeSecret,
  totpCounter,
  totpRemainingSeconds,
  type TotpEntry,
} from "@/lib/totp";
import {
  IconCheck,
  IconArrowDown,
  IconArrowUp,
  IconArrowUpDown,
  IconClock,
  IconCopy,
  IconDownload,
  IconHistory,
  IconKey,
  IconPencil,
  IconSearch,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUpload,
} from "@/components/icons";
import {
  EMPTY_TWO_FA_STORE,
  isRealLabel,
  parseTwoFaStore,
  pushRecent,
  savedNameFor,
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
  return `${currentTimeMs().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDateTime(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDateTimeSec(at: number): string {
  const date = new Date(at);
  return `${formatDateTime(at)}:${pad2(date.getSeconds())}`;
}

/** 订阅一组密钥的实时验证码：到点自动换码，返回 {codes, remaining}。 */
function useLiveCodes(secretsKey: string) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(() =>
    totpRemainingSeconds(currentTimeMs()),
  );
  const lastCounter = useRef(-1);
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
    const now = currentTimeMs();
    lastCounter.current = totpCounter(now);
    void refresh(now);
    const timer = setInterval(() => {
      const current = currentTimeMs();
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
  return { codes, remaining, setRemaining };
}

type SortState = { by: "time" | "name"; dir: 1 | -1 };

interface RecentRow {
  key: string;
  recentId: string;
  secret: string;
  label: string;
  name: string;
  at: number;
}

export function TwoFaTool() {
  const store = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<TotpEntry[] | null>(null);
  const [error, setError] = useState("");
  const [panelMsg, setPanelMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [activeTab, setActiveTab] = useState<"saved" | "recent">("saved");
  const [editingId, setEditingId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [ioMsg, setIoMsg] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ by: "time", dir: -1 });
  const toolRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const savedSecrets = useMemo(
    () => new Set(store.saved.map((item) => item.secret)),
    [store.saved],
  );

  const recentRowsAll = useMemo<RecentRow[]>(
    () =>
      store.recent.flatMap((item) =>
        item.secrets.map((secret, index) => {
          const label = item.labels[index] ?? "";
          return {
            key: `${item.id}:${secret}`,
            recentId: item.id,
            secret,
            label,
            name: isRealLabel(label, secret) ? label : "--",
            at: item.at,
          };
        }),
      ),
    [store.recent],
  );

  const resultCodes = useLiveCodes(
    entries?.map((entry) => entry.secret).join("\n") ?? "",
  );
  const savedLive = useLiveCodes(
    store.saved.map((item) => item.secret).join("\n"),
  );
  const recentLive = useLiveCodes(
    [...new Set(recentRowsAll.map((row) => row.secret))].join("\n"),
  );

  const searchNeedle = search.trim().toLowerCase();
  const matchesSearch = (name: string, secret: string, label = "") =>
    !searchNeedle ||
    name.toLowerCase().includes(searchNeedle) ||
    secret.toLowerCase().includes(searchNeedle) ||
    label.toLowerCase().includes(searchNeedle);

  const applySort = <T extends { at: number; name: string }>(rows: T[]) => {
    const sorted = [...rows];
    sorted.sort((a, b) =>
      sort.by === "time"
        ? (a.at - b.at) * sort.dir
        : a.name.localeCompare(b.name) * sort.dir,
    );
    return sorted;
  };

  const savedRows = applySort(
    store.saved
      .filter((item) => matchesSearch(item.name, item.secret))
      .map((item) => ({ ...item, at: item.createdAt, name: item.name })),
  );
  const recentRows = applySort(
    recentRowsAll.filter((row) =>
      matchesSearch(row.name, row.secret, row.label),
    ),
  );

  function toggleSort(by: SortState["by"]) {
    setSort((current) =>
      current.by === by
        ? { by, dir: current.dir === 1 ? -1 : 1 }
        : { by, dir: by === "time" ? -1 : 1 },
    );
  }

  function sortIcon(by: SortState["by"]) {
    if (sort.by !== by) return <IconArrowUpDown size={16} />;
    return sort.dir === 1 ? (
      <IconArrowUp size={16} />
    ) : (
      <IconArrowDown size={16} />
    );
  }

  function flashCopied(key: string) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1500);
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(key);
    } catch {
      setCopiedKey("");
    }
  }

  function recordRecent(found: TotpEntry[]) {
    const current = getSnapshot();
    writeStore({
      ...current,
      recent: pushRecent(current.recent, {
        id: newId(),
        secrets: found.map((entry) => entry.secret),
        labels: found.map((entry) => entry.label || entry.secret),
        at: currentTimeMs(),
      }),
    });
  }

  function generateFrom(text: string): boolean {
    const found = extractTotpEntries(text);
    if (found.length === 0) {
      setError(
        "没有识别到有效的 2FA 密钥。请粘贴 Base32 密钥（一行一个），或 UID|密码|2FA|邮箱... 格式（一行一个账户）。",
      );
      return false;
    }
    setError("");
    setPanelMsg("");
    setInput(text);
    resultCodes.setRemaining(totpRemainingSeconds(currentTimeMs()));
    setEntries(found);
    recordRecent(found);
    return true;
  }

  function handleInput(value: string) {
    setInput(value);
    setError("");
    setPanelMsg("");
    if (entries) {
      setEntries(null);
    }
  }

  function loadAndScroll(text: string) {
    if (generateFrom(text)) {
      toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function saveEntries(list: TotpEntry[]): number {
    const current = getSnapshot();
    let saved = current.saved;
    let added = 0;
    for (const entry of list) {
      const next = upsertSaved(saved, {
        id: newId(),
        name: savedNameFor(entry.label, entry.secret),
        secret: entry.secret,
        createdAt: currentTimeMs(),
      });
      if (next !== saved) added += 1;
      saved = next;
    }
    if (added > 0) writeStore({ ...current, saved });
    return added;
  }

  function saveFromPanel() {
    const found = extractTotpEntries(input);
    if (found.length === 0) {
      setError(
        "没有识别到有效的 2FA 密钥。请粘贴 Base32 密钥（一行一个），或 UID|密码|2FA|邮箱... 格式（一行一个账户）。",
      );
      return;
    }
    setError("");
    const added = saveEntries(found);
    setPanelMsg(
      added > 0
        ? `已保存 ${added} 个到列表`
        : "这些密钥已经在已保存列表里了",
    );
    if (added > 0) setActiveTab("saved");
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

  function removeRecentEntry(id: string) {
    const current = getSnapshot();
    writeStore({
      ...current,
      recent: current.recent.filter((item) => item.id !== id),
    });
  }

  function removeRecentSecret(recentId: string, secret: string) {
    const current = getSnapshot();
    const recent = current.recent
      .map((item) => {
        if (item.id !== recentId) return item;
        const index = item.secrets.indexOf(secret);
        if (index < 0) return item;
        return {
          ...item,
          secrets: item.secrets.filter((_, i) => i !== index),
          labels: item.labels.filter((_, i) => i !== index),
        };
      })
      .filter((item) => item.secrets.length > 0);
    writeStore({ ...current, recent });
  }

  function clearRecent() {
    const current = getSnapshot();
    writeStore({ ...current, recent: [] });
  }

  function exportSaved() {
    const payload = {
      type: "guide-2fa-saved",
      version: 1,
      items: store.saved.map((item) => ({
        name: item.name,
        secret: item.secret,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `2fa-saved-${formatDateTime(currentTimeMs()).slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setIoMsg(`已导出 ${store.saved.length} 个到 JSON 文件`);
  }

  async function importSaved(file: File) {
    const text = await file.text();
    let candidates: Array<{ name: string; secret: string }> = [];
    try {
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { items?: unknown }).items)
      ) {
        for (const raw of (parsed as { items: unknown[] }).items) {
          if (typeof raw !== "object" || raw === null) continue;
          const record = raw as Record<string, unknown>;
          if (typeof record.secret !== "string") continue;
          const normalized = normalizeSecret(record.secret);
          if (
            normalized &&
            normalized.length >= 16 &&
            normalized.length <= 128
          ) {
            candidates.push({
              name:
                typeof record.name === "string" && record.name
                  ? record.name
                  : savedNameFor("", normalized),
              secret: normalized,
            });
          }
        }
      }
    } catch {
      // 不是 JSON 就按文本行解析
    }
    if (candidates.length === 0) {
      candidates = extractTotpEntries(text).map((entry) => ({
        name: savedNameFor(entry.label, entry.secret),
        secret: entry.secret,
      }));
    }
    if (candidates.length === 0) {
      setIoMsg("文件里没有识别到有效的密钥");
      return;
    }
    const added = saveEntries(
      candidates.map((candidate) => ({
        secret: candidate.secret,
        label:
          candidate.name === savedNameFor("", candidate.secret)
            ? ""
            : candidate.name,
      })),
    );
    const current = getSnapshot();
    const bySecret = new Map(
      candidates.map((candidate) => [candidate.secret, candidate.name]),
    );
    writeStore({
      ...current,
      saved: current.saved.map((item) =>
        bySecret.has(item.secret)
          ? { ...item, name: bySecret.get(item.secret)! }
          : item,
      ),
    });
    setIoMsg(
      `导入 ${added} 个${candidates.length - added > 0 ? `，跳过 ${candidates.length - added} 个（已存在）` : ""}`,
    );
  }

  return (
    <>
      <section className="text-editor tfa-tool" ref={toolRef}>
        <label className="text-area-label" htmlFor="tfa-input">
          功能区（查询面板）
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
        <div className="tfa-panel-actions">
          <button
            type="button"
            className="primary-button tfa-submit"
            onClick={() => generateFrom(input)}
            disabled={!input.trim()}
          >
            查询
          </button>
          <button
            type="button"
            className="secondary-button tfa-submit"
            onClick={saveFromPanel}
            disabled={!input.trim()}
          >
            保存到列表
          </button>
          {panelMsg && <span className="tfa-panel-msg">{panelMsg}</span>}
        </div>
        {error && (
          <p className="text-error" role="alert">
            {error}
          </p>
        )}
        {entries && (
          <div className="tfa-results">
            <h3>查询结果</h3>
            <div className="tfa-table-head" aria-hidden="true">
              <span>验证码</span>
              <span>时间</span>
              <span>2FA</span>
            </div>
            {entries.map((entry) => {
              const code = resultCodes.codes[entry.secret];
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
                      onClick={() =>
                        code && copyText(`code:${entry.secret}`, code)
                      }
                    >
                      {copiedKey === `code:${entry.secret}`
                        ? "已复制"
                        : "复制"}
                    </button>
                  </div>
                  <span className="tfa-time"><IconClock size={16} /> {resultCodes.remaining}</span>
                  <div className="tfa-secret-cell">
                    <span className="tfa-secret" title={entry.secret}>
                      {entry.secret}
                    </span>
                    <button
                      type="button"
                      className="tfa-save"
                      disabled={isSaved}
                      onClick={() => saveEntries([entry])}
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

      <section className="tfa-store-card">
        <div className="tfa-tabs" role="tablist" aria-label="已保存与近期查询">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "saved"}
            className={activeTab === "saved" ? "active" : ""}
            onClick={() => setActiveTab("saved")}
          >
            <IconStar size={16} /> 已保存（{store.saved.length}）
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "recent"}
            className={activeTab === "recent" ? "active" : ""}
            onClick={() => setActiveTab("recent")}
          >
            <IconClock size={16} /> 近期查询（{recentRowsAll.length}）
          </button>
          <span className="tfa-tabs-spacer" />
          {activeTab === "saved" && store.saved.length > 0 && (
            <>
              <button
                type="button"
                className="tfa-io-btn"
                onClick={() => fileRef.current?.click()}
              >
                <IconUpload size={16} /> 导入
              </button>
              <button
                type="button"
                className="tfa-io-btn"
                onClick={exportSaved}
              >
                <IconDownload size={16} /> 导出
              </button>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importSaved(file);
          }}
        />
        {(store.saved.length > 0 || store.recent.length > 0) && (
          <div className="tfa-search-row">
            <span className="tfa-search-wrap">
              <IconSearch size={16} className="tfa-search-icon" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索账号名或秘钥"
                aria-label="搜索账号名或秘钥"
              />
            </span>
            {activeTab === "recent" && store.recent.length > 0 && (
              <button
                type="button"
                className="tfa-io-btn"
                onClick={clearRecent}
              >
                清空
              </button>
            )}
          </div>
        )}
        <p className="tfa-store-note">只保存在本机浏览器</p>
        {ioMsg && <p className="tfa-io-msg">{ioMsg}</p>}

        {activeTab === "saved" &&
          (store.saved.length === 0 ? (
            <p className="tfa-empty">
              还没有保存的密钥。在上方输入密钥后点「保存到列表」，或在查询结果、近期查询里保存。
            </p>
          ) : savedRows.length === 0 ? (
            <p className="tfa-empty">没有匹配「{search}」的已保存条目。</p>
          ) : (
            <>
              <div className="tfa-saved-head">
                <button
                  type="button"
                  className={`tfa-head-btn${sort.by === "name" ? " is-sorted" : ""}`}
                  onClick={() => toggleSort("name")}
                >
                  账号名 {sortIcon("name")}
                </button>
                <span>秘钥</span>
                <span>
                  动态码{" "}
                  <span className="tfa-badge">{savedLive.remaining}s</span>
                </span>
                <button
                  type="button"
                  className={`tfa-head-btn${sort.by === "time" ? " is-sorted" : ""}`}
                  onClick={() => toggleSort("time")}
                >
                  保存时间 {sortIcon("time")}
                </button>
                <span>操作</span>
              </div>
              {savedRows.map((item) => {
                const code = savedLive.codes[item.secret];
                return (
                  <div className="tfa-saved-row" key={item.id}>
                    <span className="tfa-saved-name">
                      {editingId === item.id ? (
                        <span className="tfa-rename">
                          <input
                            value={draftName}
                            onChange={(event) =>
                              setDraftName(event.target.value)
                            }
                            maxLength={60}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => renameSaved(item.id)}
                          >
                            确定
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId("")}
                          >
                            取消
                          </button>
                        </span>
                      ) : (
                        <>
                          {item.name}
                          <button
                            type="button"
                            className="tfa-icon-btn"
                            title="改名"
                            onClick={() => {
                              setEditingId(item.id);
                              setDraftName(item.name);
                            }}
                          >
                            <IconPencil size={16} />
                          </button>
                        </>
                      )}
                    </span>
                    <span className="tfa-saved-secret">
                      {item.secret}
                      <button
                        type="button"
                        className="tfa-icon-btn"
                        title="复制秘钥"
                        onClick={() =>
                          copyText(`secret:${item.id}`, item.secret)
                        }
                      >
                        {copiedKey === `secret:${item.id}` ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </button>
                    </span>
                    <span className="tfa-saved-code">
                      <span className="tfa-live-code">
                        {code ?? "······"}
                      </span>
                      <button
                        type="button"
                        className="tfa-icon-btn"
                        title="复制动态码"
                        disabled={!code}
                        onClick={() =>
                          code && copyText(`savedcode:${item.id}`, code)
                        }
                      >
                        {copiedKey === `savedcode:${item.id}` ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </button>
                    </span>
                    <span className="tfa-saved-time">
                      {formatDateTime(item.createdAt)}
                    </span>
                    <span className="tfa-saved-actions">
                      <button
                        type="button"
                        className="tfa-icon-btn tfa-action-icon tfa-action-delete"
                        title="删除"
                        aria-label="删除"
                        onClick={() => removeSaved(item.id)}
                      >
                        <IconTrash size={16} />
                      </button>
                    </span>
                  </div>
                );
              })}
              <p className="tfa-local-note">
                动态码实时刷新，点秘钥或动态码旁的图标即可复制。
              </p>
            </>
          ))}

        {activeTab === "recent" &&
          (recentRowsAll.length === 0 ? (
            <p className="tfa-empty">
              还没有查询记录。在上方输入密钥点「查询」后会自动记到这里（最多
              10 次查询）。
            </p>
          ) : recentRows.length === 0 ? (
            <p className="tfa-empty">没有匹配「{search}」的近期查询。</p>
          ) : (
            <>
              <div className="tfa-saved-head tfa-recent-head">
                <button
                  type="button"
                  className={`tfa-head-btn${sort.by === "name" ? " is-sorted" : ""}`}
                  onClick={() => toggleSort("name")}
                >
                  账号名 {sortIcon("name")}
                </button>
                <span>秘钥</span>
                <span>
                  动态码{" "}
                  <span className="tfa-badge">{recentLive.remaining}s</span>
                </span>
                <button
                  type="button"
                  className={`tfa-head-btn${sort.by === "time" ? " is-sorted" : ""}`}
                  onClick={() => toggleSort("time")}
                >
                  时间 {sortIcon("time")}
                </button>
                <span>操作</span>
              </div>
              {recentRows.map((row) => {
                const code = recentLive.codes[row.secret];
                const isSaved = savedSecrets.has(row.secret);
                return (
                  <div
                    className="tfa-saved-row tfa-recent-row"
                    key={row.key}
                  >
                    <span className="tfa-saved-name">
                      <span className="tfa-key-tile">
                        <IconKey size={16} />
                      </span>
                      {row.name}
                    </span>
                    <span className="tfa-saved-secret">
                      {row.secret}
                      <button
                        type="button"
                        className="tfa-icon-btn"
                        title="复制秘钥"
                        onClick={() =>
                          copyText(`rsecret:${row.key}`, row.secret)
                        }
                      >
                        {copiedKey === `rsecret:${row.key}` ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </button>
                    </span>
                    <span className="tfa-saved-code">
                      <span className="tfa-live-code">
                        {code ?? "······"}
                      </span>
                      <button
                        type="button"
                        className="tfa-icon-btn"
                        title="复制动态码"
                        disabled={!code}
                        onClick={() =>
                          code && copyText(`rcode:${row.key}`, code)
                        }
                      >
                        {copiedKey === `rcode:${row.key}` ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </button>
                    </span>
                    <span className="tfa-saved-time">
                      {formatDateTimeSec(row.at)}
                    </span>
                    <span className="tfa-recent-actions">
                      <button
                        type="button"
                        className="tfa-icon-btn tfa-action-icon"
                        title="载入重新查询"
                        aria-label="载入重新查询"
                        onClick={() => loadAndScroll(row.secret)}
                      >
                        <IconHistory size={16} />
                      </button>
                      <button
                        type="button"
                        className={
                          isSaved
                            ? "tfa-icon-btn tfa-action-icon is-saved"
                            : "tfa-icon-btn tfa-action-icon"
                        }
                        disabled={isSaved}
                        title={isSaved ? "已保存" : "保存到列表"}
                        aria-label={isSaved ? "已保存" : "保存到列表"}
                        onClick={() => {
                          saveEntries([
                            { secret: row.secret, label: row.label },
                          ]);
                        }}
                      >
                        {isSaved ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                      </button>
                      <button
                        type="button"
                        className="tfa-icon-btn tfa-action-icon tfa-action-delete"
                        title="删除这条记录"
                        aria-label="删除这条记录"
                        onClick={() =>
                          recentRowsAll.filter(
                            (r) => r.recentId === row.recentId,
                          ).length > 1
                            ? removeRecentSecret(row.recentId, row.secret)
                            : removeRecentEntry(row.recentId)
                        }
                      >
                        <IconTrash size={16} />
                      </button>
                    </span>
                  </div>
                );
              })}
              <p className="tfa-local-note">
                近期查询按密钥逐行显示，动态码同样实时刷新；最多保留最近 10 次查询。
              </p>
            </>
          ))}
      </section>
    </>
  );
}
