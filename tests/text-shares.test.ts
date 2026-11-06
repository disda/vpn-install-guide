import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TEXT_BYTES,
  validateText,
  type TextShare,
  type TextShareStore,
} from "../lib/text-shares";
import {
  createTextShare,
  deleteTextShare,
  getTextShare,
  sameOrigin,
} from "../lib/text-share-http";

test("同源检查兼容本地代理，并拒绝缺失或外站 Origin", () => {
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3000/api/text", {
        headers: {
          Host: "127.0.0.1:3000",
          Origin: "http://127.0.0.1:3000",
          "X-Forwarded-Proto": "http",
        },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://localhost/api/text", {
        headers: {
          Host: "guide.wepic.top",
          Origin: "https://guide.wepic.top",
          "X-Forwarded-Proto": "https",
        },
      }),
    ),
    true,
  );
  for (const origin of [
    "null",
    "https://guide.wepic.top.other.example",
    "https://other.example",
  ]) {
    assert.equal(
      sameOrigin(
        new Request("https://guide.wepic.top/api/text", {
          headers: { Origin: origin },
        }),
      ),
      false,
    );
  }
});

function memoryStore() {
  const entries = new Map<string, TextShare>();
  const store: TextShareStore = {
    async create(share) {
      entries.set(share.id, share);
    },
    async get(id) {
      return entries.get(id) ?? null;
    },
    async delete(id) {
      entries.delete(id);
    },
  };
  return { entries, store };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://guide.wepic.top/api/text", {
    method: "POST",
    headers: {
      Origin: "https://guide.wepic.top",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("纯文本与合法 JSON 校验，不改写原文", () => {
  assert.deepEqual(
    validateText("  一段普通的长文本\r\n第二行保留空格  ", "text"),
    { ok: true },
  );
  assert.deepEqual(
    validateText(' {\n  "message": "你好", "items": [1, 2]\n} ', "json"),
    { ok: true },
  );
  assert.equal(validateText('{"message":}', "json").ok, false);
  assert.deepEqual(validateText('{"message":}', "text"), { ok: true });
  assert.equal(validateText(" \r\n ", "text").ok, false);
  assert.equal(
    validateText("中".repeat(MAX_TEXT_BYTES / 3 + 1), "text").ok,
    false,
  );
});

test("两种格式均拒绝凭证字段、Cookie、密钥和长编码串", () => {
  const examples = [
    '{"accessToken":"example-only"}',
    '{"nested":[{"refresh_token":"example-only"}]}',
    '{"ACCESS_TOKEN":"example-only"}',
    '{"password":"example-only"}',
    '{"session":{"user":"example-only"}}',
    '{"cookie":"example-only"}',
    '{"api_key":"example-only"}',
    "Authorization: Bearer example-only",
    "Set-Cookie: example-only",
    "-----BEGIN PRIVATE KEY-----\nexample-only",
    "Abc123def456".repeat(20),
    "abcde.fghij.klmno",
    '{"access\\u0054oken":"example-only"}',
    '{"access%54oken":"example-only"}',
    '{"ａｃｃｅｓｓＴｏｋｅｎ":"example-only"}',
    '{"access\u200bToken":"example-only"}',
  ];
  for (const text of examples) {
    for (const format of ["text", "json"] as const) {
      const result = validateText(text, format);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "credentials");
    }
  }
});

test("创建后读取原文完全一致，链接为随机 ID，不包含内容", async () => {
  const { entries, store } = memoryStore();
  const text = '  {\r\n  "message": "保留空格、引号与换行"\r\n}  ';
  const response = await createTextShare(
    request({ text, format: "json" }),
    store,
    async () => true,
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const result = await response.json();
  assert.match(result.path, /^\/text\/[a-f0-9]{32}$/);
  assert.ok(result.expiresAt > Date.now() + 23 * 60 * 60 * 1000);
  const id = result.path.split("/").at(-1);
  assert.equal(entries.size, 1);
  assert.equal(entries.get(id)?.text, text);
  const read = await getTextShare(id, store);
  assert.equal(read.status, 200);
  assert.equal((await read.json()).text, text);
});

test("客户端被绕过时，服务端仍拒绝凭证，且不写入存储", async () => {
  const { entries, store } = memoryStore();
  for (const format of ["text", "json"]) {
    const response = await createTextShare(
      request({ text: '{"accessToken":"example-only"}', format }),
      store,
      async () => true,
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "credentials");
    assert.equal(entries.size, 0);
  }
});

test("非法 JSON、错误模式、额外字段、空文本和过大文本均不入库", async () => {
  const { entries, store } = memoryStore();
  for (const [payload, status] of [
    [{ text: '{"broken":}', format: "json" }, 422],
    [{ text: "", format: "text" }, 422],
    [{ text: "你好", format: "invalid" }, 400],
    [{ text: "你好", format: "text", extra: "unexpected" }, 400],
    [{ text: "中".repeat(MAX_TEXT_BYTES / 3 + 1), format: "text" }, 413],
    [{ text: "中".repeat(128 * 1024), format: "text" }, 413],
  ] as const) {
    assert.equal(
      (await createTextShare(request(payload), store, async () => true)).status,
      status,
    );
  }
  assert.equal(entries.size, 0);
});

test("跨站请求、不支持的请求格式和限流不会写入", async () => {
  const { entries, store } = memoryStore();
  const payload = { text: "普通文本", format: "text" };
  assert.equal(
    (
      await createTextShare(
        request(payload, { Origin: "https://other.example" }),
        store,
        async () => true,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await createTextShare(
        request(payload, { "Content-Type": "text/plain" }),
        store,
        async () => true,
      )
    ).status,
    415,
  );
  const response = await createTextShare(
    request(payload),
    store,
    async () => false,
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(entries.size, 0);
});

test("过期、未知和旧规则下可能保存的凭证文本均无法读取", async () => {
  const { entries, store } = memoryStore();
  const id = "a".repeat(32);
  assert.equal((await getTextShare("invalid", store)).status, 404);
  assert.equal((await getTextShare(id, store)).status, 404);
  entries.set(id, {
    id,
    text: "普通文本",
    format: "text",
    createdAt: 0,
    expiresAt: Date.now() - 1,
  });
  assert.equal((await getTextShare(id, store)).status, 404);
  assert.equal(entries.size, 0);
  entries.set(id, {
    id,
    text: '{"cookie":"example-only"}',
    format: "json",
    createdAt: Date.now(),
    expiresAt: Date.now() + 10000,
  });
  assert.equal((await getTextShare(id, store)).status, 404);
  assert.equal(entries.size, 0);
});

test("删除需要同站请求，删除后原链接失效", async () => {
  const { entries, store } = memoryStore();
  const response = await createTextShare(
    request({ text: "普通文本", format: "text" }),
    store,
    async () => true,
  );
  const { path } = await response.json();
  const id = path.split("/").at(-1);
  assert.equal(
    (
      await deleteTextShare(
        new Request(`https://guide.wepic.top/api/text/${id}`, {
          method: "DELETE",
        }),
        id,
        store,
      )
    ).status,
    403,
  );
  assert.equal(entries.size, 1);
  const deletion = await deleteTextShare(
    new Request(`https://guide.wepic.top/api/text/${id}`, {
      method: "DELETE",
      headers: { Origin: "https://guide.wepic.top" },
    }),
    id,
    store,
  );
  assert.equal(deletion.status, 200);
  assert.equal((await getTextShare(id, store)).status, 404);
  assert.equal(entries.size, 0);
});
