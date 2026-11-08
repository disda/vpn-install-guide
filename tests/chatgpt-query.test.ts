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

