import assert from "node:assert/strict";
import test from "node:test";
import { extractSharedEmail } from "../lib/text-share-insights";

test("从 ChatGPT Session JSON 里提取 user.email", () => {
  const text = JSON.stringify({
    WARNING_BANNER: "DO NOT SHARE",
    accessToken: "eyJhbGciOiJIUzI1NiJ9.payload.signature",
    user: { email: "someone@example.com", name: "Someone" },
    account: { planType: "plus" },
  });
  assert.equal(extractSharedEmail(text), "someone@example.com");
});

test("兼容被 session 包一层与顶层 email 字段", () => {
  assert.equal(
    extractSharedEmail(
      JSON.stringify({ session: { user: { email: "wrap@example.com" } } }),
    ),
    "wrap@example.com",
  );
  assert.equal(
    extractSharedEmail(JSON.stringify({ email: "top@example.com" })),
    "top@example.com",
  );
});

test("非 JSON、无邮箱或邮箱格式不对时返回 null", () => {
  assert.equal(extractSharedEmail("just some plain text"), null);
  assert.equal(extractSharedEmail(JSON.stringify({ hello: "world" })), null);
  assert.equal(
    extractSharedEmail(JSON.stringify({ user: { email: "not-an-email" } })),
    null,
  );
  assert.equal(extractSharedEmail("[1,2,3]"), null);
});
