import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAccountCheck,
  parseSessionInput,
  parseUsage,
  queryChatGptAccount,
  type UpstreamFetch,
} from "../lib/chatgpt-query";
import { handleChatGptQuery } from "../lib/chatgpt-query-http";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64url")
      .replace(/=+$/, "");
  return `${b64({ alg: "RS256" })}.${b64(payload)}.signature`;
}

function sessionJson(): string {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    user: { id: "user-1", email: "test@example.com" },
    expires: new Date(Date.now() + 86400000).toISOString(),
    accessToken: jwt({
      iat: now,
      exp: now + 9 * 86400,
      "https://api.openai.com/auth": {
        chatgpt_account_id: "acc-1",
        chatgpt_plan_type: "plus",
      },
    }),
    account: { id: "acc-1", planType: "plus" },
  });
}

test("parseSessionInput 读取邮箱、账号、套餐与两个过期时间", () => {
  const result = parseSessionInput(sessionJson());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.session.email, "test@example.com");
  assert.equal(result.session.accountId, "acc-1");
  assert.equal(result.session.planType, "plus");
  assert.ok(result.session.sessionExpires);
  assert.ok((result.session.tokenExpiresAt ?? 0) > Math.floor(Date.now() / 1000));
});

test("parseSessionInput 对空 {} 给出未登录提示", () => {
  const result = parseSessionInput("{}");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /还没有登录/);
});

test("parseAccountCheck 按账号 ID 选中记录并读 entitlement", () => {
  const info = parseAccountCheck(
    {
      accounts: {
        "acc-1": {
          account: { account_id: "acc-1", is_default: true },
          entitlement: {
            subscription_plan: "chatgptplusplan",
            expires_at: "2026-12-01T00:00:00.000Z",
          },
        },
        "acc-2": {
          account: { account_id: "acc-2" },
          entitlement: { subscription_plan: "free", expires_at: null },
        },
      },
    },
    "acc-1",
  );
  assert.equal(info?.planType, "chatgptplusplan");
  assert.equal(info?.activeUntil, "2026-12-01T00:00:00.000Z");
});

test("parseUsage 计算剩余额度与重置时间", () => {
  const now = 1_700_000_000;
  const usage = parseUsage(
    {
      plan_type: "plus",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 37.2,
          limit_window_seconds: 18000,
          reset_at: now + 3600,
        },
        secondary_window: {
          used_percent: 10,
          limit_window_seconds: 604800,
          reset_after_seconds: 7200,
        },
      },
      rate_limit_reset_credits: { available_count: 2 },
    },
    now,
  );
  assert.equal(usage?.primary?.remainingPercent, 63);
  assert.equal(usage?.primary?.windowMinutes, 300);
  assert.equal(usage?.secondary?.resetAt, now + 7200);
  assert.equal(usage?.resetCreditsAvailable, 2);
});

test("queryChatGptAccount 串起三个上游接口并合并订阅到期", async () => {
  const calls: string[] = [];
  const fetchFn: UpstreamFetch = async (url) => {
    calls.push(url);
    const ok = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });
    if (url.includes("/accounts/check/")) {
      return ok({
        accounts: [
          {
            account: { account_id: "acc-1" },
            entitlement: { subscription_plan: "plus" },
          },
        ],
      });
    }
    if (url.includes("/subscriptions")) {
      return ok({ active_until: "2026-12-15T00:00:00.000Z" });
    }
    if (url.includes("/wham/usage")) {
      return ok({
        plan_type: "plus",
        rate_limit: {
          primary_window: { used_percent: 0, limit_window_seconds: 18000 },
        },
      });
    }
    throw new Error(`unexpected url ${url}`);
  };
  const result = await queryChatGptAccount({
    accessToken: jwt({ exp: 1 }),
    accountId: "acc-1",
    timezoneOffsetMin: -480,
    fetchFn,
  });
  assert.equal(result.subscription?.activeUntil, "2026-12-15T00:00:00.000Z");
  assert.equal(result.subscriptionError, null);
  assert.equal(result.usage?.planType, "plus");
  assert.equal(calls.length, 3);
});

test("handleChatGptQuery 拒绝跨源与多余字段，且不回显 token", async () => {
  const parsed = parseSessionInput(sessionJson());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const cross = await handleChatGptQuery(
    new Request("https://guide.wepic.top/api/chatgpt/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ accessToken: parsed.session.accessToken }),
    }),
    async () => true,
  );
  assert.equal(cross.status, 403);

  const extra = await handleChatGptQuery(
    new Request("https://guide.wepic.top/api/chatgpt/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://guide.wepic.top",
      },
      body: JSON.stringify({
        accessToken: parsed.session.accessToken,
        sessionToken: "should-not-be-sent",
      }),
    }),
    async () => true,
  );
  assert.equal(extra.status, 400);
  const text = await extra.text();
  assert.equal(text.includes(parsed.session.accessToken), false);
});

test("parseResultBundle 解析书签脚本的结果包并合并订阅与额度", async () => {
  const { parseResultBundle } = await import("../lib/chatgpt-query");
  const bundle = JSON.stringify({
    kind: "chatgpt-check-result-v1",
    fetchedAt: Date.now(),
    session: {
      email: "test@example.com",
      accountId: "acc-1",
      planType: "plus",
      expires: "2027-02-06T01:22:53.969Z",
      tokenExpiresAt: 1794134463,
    },
    accountCheck: {
      accounts: {
        "acc-1": {
          account: { account_id: "acc-1" },
          entitlement: {
            subscription_plan: "chatgptplusplan",
            expires_at: "2026-11-26T08:22:45+00:00",
          },
        },
      },
    },
    subscriptions: { active_until: "2026-11-26T02:22:45Z" },
    usage: {
      plan_type: "plus",
      rate_limit: {
        primary_window: { used_percent: 0, limit_window_seconds: 18000 },
        secondary_window: { used_percent: 10, limit_window_seconds: 604800 },
      },
      rate_limit_reset_credits: { available_count: 2 },
    },
  });
  const result = parseResultBundle(bundle);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.subscription?.planType, "chatgptplusplan");
  // accounts/check 的到期优先于 subscriptions 的 active_until
  assert.equal(result.subscription?.activeUntil, "2026-11-26T08:22:45+00:00");
  assert.equal(result.usage?.secondary?.remainingPercent, 90);
  assert.equal(result.session.tokenExpiresAt, 1794134463);
  // Session 原文不是结果包，应被拒绝并提示
  const bad = parseResultBundle(sessionJson());
  assert.equal(bad.ok, false);
});

test("书签脚本只请求 chatgpt.com 同源接口且结果包不带凭证", async () => {
  const { BOOKMARKLET_CODE, BOOKMARKLET_SOURCE } = await import(
    "../lib/chatgpt-bookmarklet"
  );
  assert.ok(BOOKMARKLET_CODE.startsWith("javascript:"));
  assert.match(BOOKMARKLET_SOURCE, /\/api\/auth\/session/);
  assert.match(BOOKMARKLET_SOURCE, /\/backend-api\/wham\/usage/);
  assert.match(BOOKMARKLET_SOURCE, /\/backend-api\/accounts\/check\//);
  // 脚本里所有 fetch 都是相对路径，没有向第三方域名发请求的写法
  assert.equal(/fetch\(['"]https?:/.test(BOOKMARKLET_SOURCE), false);
  assert.equal(BOOKMARKLET_SOURCE.includes("wepic.top"), false);
  // 结果包构造里不包含 accessToken / sessionToken 字段
  const outSegment = BOOKMARKLET_SOURCE.slice(
    BOOKMARKLET_SOURCE.indexOf("var out="),
  );
  assert.equal(outSegment.includes("accessToken:"), false);
  assert.equal(outSegment.includes("sessionToken"), false);
  // 脚本本身语法合法（只编译不执行）
  assert.doesNotThrow(() => new Function(BOOKMARKLET_SOURCE));
});
