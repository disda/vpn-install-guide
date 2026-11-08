// ChatGPT 套餐与额度查询：Session 解析 + 上游接口响应解析。
// 本模块只做纯解析与经注入 fetch 的请求，不保存、不记录任何 token。

export type SessionInfo = {
  email: string | null;
  userId: string | null;
  accountId: string | null;
  planType: string | null;
  sessionExpires: string | null;
  tokenIssuedAt: number | null; // 秒
  tokenExpiresAt: number | null; // 秒
  accessToken: string;
};

export type SessionParse =
  | { ok: true; session: SessionInfo }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstStr(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = str(record[key]);
    if (value) return value;
  }
  return null;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    let text: string;
    const buf = (
      globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } }
    ).Buffer;
    if (buf) {
      text = buf.from(padded, "base64").toString("utf-8");
    } else {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      text = new TextDecoder().decode(bytes);
    }
    const parsed: unknown = JSON.parse(text);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function jwtAuthClaims(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) return null;
  return (
    asRecord(payload["https://api.openai.com/auth"]) ??
    asRecord(payload.auth) ??
    payload
  );
}

function unwrapSession(value: unknown, depth = 0): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record || depth > 4) return record;
  for (const key of ["session", "session_json", "sessionJson"]) {
    const nested = record[key];
    if (typeof nested === "string") {
      try {
        const inner = unwrapSession(JSON.parse(nested), depth + 1);
        if (inner) return inner;
      } catch {
        // 继续尝试其它包裹形式
      }
    } else if (asRecord(nested)) {
      const inner = unwrapSession(nested, depth + 1);
      if (inner) return inner;
    }
  }
  return record;
}

export function parseSessionInput(input: string): SessionParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return {
      ok: false,
      error:
        "JSON 格式不正确。请确认复制的是 /api/auth/session 返回的整段内容（Ctrl+A 全选再复制）。",
    };
  }
  const record = unwrapSession(parsed);
  if (!record) return { ok: false, error: "没有识别到 Session 内容。" };
  const accessToken =
    str(record.accessToken) ?? str(record.access_token) ?? null;
  if (!accessToken) {
    if (Object.keys(record).length === 0) {
      return {
        ok: false,
        error:
          "返回的是空 {}，说明这个浏览器还没有登录 ChatGPT。先登录 chatgpt.com，再打开那个链接刷新。",
      };
    }
    return {
      ok: false,
      error: "这段 JSON 里没有 accessToken，可能复制不完整，请重新全选复制整段。",
    };
  }
  const payload = decodeJwtPayload(accessToken);
  const auth = jwtAuthClaims(payload);
  const profile = payload ? asRecord(payload["https://api.openai.com/profile"]) : null;
  const user = asRecord(record.user);
  const account = asRecord(record.account);
  const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    ok: true,
    session: {
      email:
        firstStr(user, ["email"]) ??
        firstStr(profile, ["email"]) ??
        firstStr(auth, ["email"]),
      userId:
        firstStr(user, ["id"]) ??
        firstStr(auth, ["chatgpt_user_id", "user_id"]),
      accountId:
        firstStr(account, ["id", "account_id", "accountId"]) ??
        firstStr(auth, ["chatgpt_account_id", "account_id"]),
      planType:
        firstStr(account, ["planType", "plan_type"]) ??
        firstStr(auth, ["chatgpt_plan_type", "plan_type"]),
      sessionExpires: str(record.expires),
      tokenIssuedAt: num(payload?.iat),
      tokenExpiresAt: num(payload?.exp),
      accessToken,
    },
  };
}

export function isAccessTokenShape(token: string): boolean {
  return (
    token.length >= 50 &&
    token.length <= 10000 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  );
}

// ---------- 订阅（accounts/check + subscriptions） ----------

export type SubscriptionInfo = {
  accountId: string | null;
  planType: string | null;
  activeUntil: string | null;
};

function collectAccountRecords(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const records: Record<string, unknown>[] = [];
  const accounts = root?.accounts;
  if (Array.isArray(accounts)) {
    for (const item of accounts) {
      const rec = asRecord(item);
      if (rec) records.push(rec);
    }
  } else if (asRecord(accounts)) {
    for (const item of Object.values(asRecord(accounts)!)) {
      const rec = asRecord(item);
      if (rec) records.push(rec);
    }
  }
  if (records.length === 0 && Array.isArray(payload)) {
    for (const item of payload) {
      const rec = asRecord(item);
      if (rec) records.push(rec);
    }
  }
  return records;
}

function recordParts(record: Record<string, unknown>) {
  const account = asRecord(record.account) ?? record;
  const entitlement = asRecord(record.entitlement);
  return { account, entitlement };
}

function recordPlan(record: Record<string, unknown>): string | null {
  const { account, entitlement } = recordParts(record);
  return (
    firstStr(entitlement, ["subscription_plan"]) ??
    firstStr(account, ["plan_type", "planType"])
  );
}

export function parseAccountCheck(
  payload: unknown,
  preferredAccountId: string | null,
): SubscriptionInfo | null {
  const records = collectAccountRecords(payload);
  if (records.length === 0) return null;
  const selected =
    records.find((record) => {
      if (!preferredAccountId) return false;
      const { account } = recordParts(record);
      return (
        firstStr(account, ["account_id", "id", "chatgpt_account_id", "workspace_id"]) ===
        preferredAccountId
      );
    }) ??
    records.find((record) => recordParts(record).account.is_default === true) ??
    records.find((record) => {
      const plan = recordPlan(record);
      return plan !== null && plan.toLowerCase() !== "free";
    }) ??
    records[0];
  const { account, entitlement } = recordParts(selected);
  return {
    accountId:
      firstStr(account, ["account_id", "id", "chatgpt_account_id", "workspace_id"]) ??
      preferredAccountId,
    planType: recordPlan(selected),
    activeUntil:
      firstStr(entitlement, ["expires_at"]) ??
      firstStr(account, ["expires_at"]),
  };
}

export function parseSubscriptions(
  payload: unknown,
  fallbackAccountId: string | null,
): SubscriptionInfo | null {
  const root = asRecord(payload);
  if (!root) return null;
  const planType =
    firstStr(root, ["subscription_plan", "plan_type", "planType"]) ?? null;
  const activeUntil =
    firstStr(root, ["active_until", "expires_at", "expiresAt"]) ?? null;
  if (!planType && !activeUntil) return null;
  return { accountId: fallbackAccountId, planType, activeUntil };
}

// ---------- 额度（wham/usage） ----------

export type QuotaWindow = {
  usedPercent: number | null;
  remainingPercent: number | null;
  windowMinutes: number | null;
  resetAt: number | null; // 秒
};

export type UsageInfo = {
  planType: string | null;
  allowed: boolean | null;
  limitReached: boolean | null;
  primary: QuotaWindow | null;
  secondary: QuotaWindow | null;
  codeReview: { primary: QuotaWindow | null; secondary: QuotaWindow | null } | null;
  resetCreditsAvailable: number | null;
};

function parseWindow(value: unknown, nowSec: number): QuotaWindow | null {
  const record = asRecord(value);
  if (!record) return null;
  const used =
    typeof record.used_percent === "number" && Number.isFinite(record.used_percent)
      ? record.used_percent
      : null;
  const windowSeconds =
    typeof record.limit_window_seconds === "number"
      ? record.limit_window_seconds
      : null;
  let resetAt: number | null =
    typeof record.reset_at === "number" ? record.reset_at : null;
  if (
    resetAt === null &&
    typeof record.reset_after_seconds === "number" &&
    record.reset_after_seconds >= 0
  ) {
    resetAt = nowSec + record.reset_after_seconds;
  }
  return {
    usedPercent: used,
    remainingPercent: used === null ? null : Math.ceil(100 - used),
    windowMinutes: windowSeconds ? Math.ceil(windowSeconds / 60) : null,
    resetAt,
  };
}

function parseRateLimit(value: unknown, nowSec: number) {
  const record = asRecord(value);
  if (!record) return null;
  return {
    allowed: typeof record.allowed === "boolean" ? record.allowed : null,
    limitReached:
      typeof record.limit_reached === "boolean" ? record.limit_reached : null,
    primary: parseWindow(record.primary_window, nowSec),
    secondary: parseWindow(record.secondary_window, nowSec),
  };
}

export function parseUsage(payload: unknown, nowSec = Math.floor(Date.now() / 1000)): UsageInfo | null {
  const root = asRecord(payload);
  if (!root) return null;
  const main = parseRateLimit(root.rate_limit, nowSec);
  const review = parseRateLimit(root.code_review_rate_limit, nowSec);
  const credits = asRecord(root.rate_limit_reset_credits);
  return {
    planType: firstStr(root, ["plan_type", "planType"]),
    allowed: main?.allowed ?? null,
    limitReached: main?.limitReached ?? null,
    primary: main?.primary ?? null,
    secondary: main?.secondary ?? null,
    codeReview: review
      ? { primary: review.primary, secondary: review.secondary }
      : null,
    resetCreditsAvailable:
      credits && typeof credits.available_count === "number"
        ? credits.available_count
        : null,
  };
}

// ---------- 上游查询（与 Cockpit Tools 相同的三个接口） ----------

const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";
const ACCOUNTS_CHECK_URL =
  "https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27";
const SUBSCRIPTIONS_URL = "https://chatgpt.com/backend-api/subscriptions";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

export type UpstreamFetch = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type QueryResult = {
  subscription: SubscriptionInfo | null;
  subscriptionError: string | null;
  usage: UsageInfo | null;
  usageError: string | null;
};

function upstreamError(status: number): string {
  if (status === 401 || status === 403)
    return "登录凭证已过期或已被失效（上游返回 " + status + "）。请重新登录 ChatGPT 后再获取一次 Session。";
  if (status === 429) return "查询太频繁，上游限流了（429），请过一会儿再试。";
  return `上游接口返回错误 ${status}，请稍后重试。`;
}

export async function queryChatGptAccount(options: {
  accessToken: string;
  accountId: string | null;
  timezoneOffsetMin: number;
  fetchFn?: UpstreamFetch;
}): Promise<QueryResult> {
  const fetchFn: UpstreamFetch =
    options.fetchFn ??
    (async (url, init) => {
      const response = await fetch(url, {
        method: "GET",
        headers: init.headers,
        signal: init.signal ?? AbortSignal.timeout(15000),
        cache: "no-store",
      });
      return {
        ok: response.ok,
        status: response.status,
        json: async () => (await response.json()) as unknown,
      };
    });
  const webHeaders = (path: string): Record<string, string> => ({
    Authorization: `Bearer ${options.accessToken}`,
    Accept: "application/json",
    Referer: "https://chatgpt.com/",
    "User-Agent": WEB_UA,
    "x-openai-target-path": path,
    "x-openai-target-route": path,
  });

  let subscription: SubscriptionInfo | null = null;
  let subscriptionError: string | null = null;
  let accountId = options.accountId;

  // 1) accounts/check：套餐与订阅过期时间的主来源
  try {
    const url = `${ACCOUNTS_CHECK_URL}?timezone_offset_min=${encodeURIComponent(String(options.timezoneOffsetMin))}`;
    const response = await fetchFn(url, {
      headers: webHeaders("/backend-api/accounts/check/v4-2023-04-27"),
    });
    if (!response.ok) {
      subscriptionError = upstreamError(response.status);
    } else {
      subscription = parseAccountCheck(await response.json(), accountId);
      if (subscription?.accountId) accountId = subscription.accountId;
      if (!subscription) subscriptionError = "账号信息接口没有返回可用账号记录。";
    }
  } catch {
    subscriptionError = "账号信息接口请求失败，请稍后重试。";
  }

  // 2) subscriptions：补齐 active_until（有账号 ID 时）
  if (accountId && (!subscription?.activeUntil || subscriptionError)) {
    try {
      const url = `${SUBSCRIPTIONS_URL}?account_id=${encodeURIComponent(accountId)}`;
      const response = await fetchFn(url, {
        headers: webHeaders("/backend-api/subscriptions"),
      });
      if (response.ok) {
        const extra = parseSubscriptions(await response.json(), accountId);
        if (extra) {
          subscription = {
            accountId: subscription?.accountId ?? extra.accountId,
            planType: subscription?.planType ?? extra.planType,
            activeUntil: subscription?.activeUntil ?? extra.activeUntil,
          };
          if (subscription.activeUntil) subscriptionError = null;
        }
      }
    } catch {
      // 订阅补充接口失败不覆盖主结果
    }
  }

  // 3) wham/usage：Codex 额度（5 小时 / 周窗口）
  let usage: UsageInfo | null = null;
  let usageError: string | null = null;
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.accessToken}`,
      Accept: "application/json",
      "User-Agent": "Codex Desktop/0.0.0 (Mac OS; arm64)",
      originator: "Codex Desktop",
    };
    if (accountId) headers["ChatGPT-Account-Id"] = accountId;
    const response = await fetchFn(USAGE_URL, { headers });
    if (!response.ok) {
      usageError = upstreamError(response.status);
    } else {
      usage = parseUsage(await response.json());
      if (!usage) usageError = "额度接口返回格式无法识别。";
    }
  } catch {
    usageError = "额度接口请求失败，请稍后重试。";
  }

  return { subscription, subscriptionError, usage, usageError };
}
