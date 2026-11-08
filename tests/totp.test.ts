import assert from "node:assert/strict";
import test from "node:test";
import {
  base32Decode,
  detectBareSecrets,
  extractTotpEntries,
  extractTotpSecrets,
  formatCode,
  generateTotp,
  maskSecret,
  normalizeSecret,
  totpRemainingSeconds,
} from "../lib/totp";

test("Base32 解码与归一化", () => {
  assert.deepEqual(
    [...base32Decode("JBSWY3DPEHPK3PXP")],
    [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xde, 0xad, 0xbe, 0xef],
  );
  assert.equal(normalizeSecret("jbsw y3dp-ehpk 3pxp"), "JBSWY3DPEHPK3PXP");
  assert.equal(normalizeSecret("JBSWY3DPEHPK3PXP===="), "JBSWY3DPEHPK3PXP");
  assert.equal(normalizeSecret("JBSWY3DPEHPK3PX!"), null);
  assert.equal(normalizeSecret(""), null);
});

test("TOTP 与 RFC 6238 测试向量一致（SHA-1，取 6 位）", async () => {
  // 种子为 ASCII "12345678901234567890" 的 Base32 形式。
  // 期望值经三方对拍一致：本实现、Node crypto 独立实现、pyotp；
  // 其中 59/1234567890/2000000000 三条与 RFC 6238 附录 SHA-1 列逐字相同
  //（94287082/89005924/69279037 的低 6 位）。
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const vectors: Array<[number, string]> = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [timeSec, expected] of vectors) {
    assert.equal(await generateTotp(secret, timeSec * 1000), expected);
  }
});

test("倒计时剩余秒数按真实时间对齐", () => {
  assert.equal(totpRemainingSeconds(0), 30);
  assert.equal(totpRemainingSeconds(29_000), 1);
  assert.equal(totpRemainingSeconds(30_000), 30);
  assert.equal(totpRemainingSeconds(59_500), 1);
});

test("裸密钥检测：一行一个、去重，普通文本与 JSON 不误报", () => {
  assert.deepEqual(detectBareSecrets("JBSWY3DPEHPK3PXP"), [
    "JBSWY3DPEHPK3PXP",
  ]);
  assert.deepEqual(
    detectBareSecrets("jbswy3dpehpk3pxp\nJBSWY3DPEHPK3PXP\nGEZDGNBVGY3TQOJQ"),
    ["JBSWY3DPEHPK3PXP", "GEZDGNBVGY3TQOJQ"],
  );
  assert.deepEqual(detectBareSecrets("hello world, this is a note"), []);
  assert.deepEqual(
    detectBareSecrets('{"user":{"email":"a@b.com"},"accessToken":"eyJhbGci"}'),
    [],
  );
  assert.deepEqual(detectBareSecrets("SHORT"), []);
});

test("工具页提取：完整格式优先取第 3 段，裸密钥逐行取", () => {
  assert.deepEqual(
    extractTotpSecrets(
      "1001|passw0rd|JBSWY3DPEHPK3PXP|a@b.com|mailpass",
    ),
    ["JBSWY3DPEHPK3PXP"],
  );
  // 第 3 段不合法时退回行内第一个合法段
  assert.deepEqual(extractTotpSecrets("1001|GEZDGNBVGY3TQOJQ|not-a-secret"), [
    "GEZDGNBVGY3TQOJQ",
  ]);
  // 裸密钥与完整格式混排、跨格式去重
  assert.deepEqual(
    extractTotpSecrets(
      "JBSWY3DPEHPK3PXP\n1002|pw|jbswy3dpehpk3pxp|a@b.com|x\nGEZDGNBVGY3TQOJQ",
    ),
    ["JBSWY3DPEHPK3PXP", "GEZDGNBVGY3TQOJQ"],
  );
  assert.deepEqual(extractTotpSecrets("just some text\nanother line"), []);
});

test("验证码格式化与密钥脱敏", () => {
  assert.equal(formatCode("287082"), "287 082");
  assert.equal(maskSecret("JBSWY3DPEHPK3PXP"), "JBSW…3PXP");
});

import {
  parseTwoFaStore,
  pushRecent,
  upsertSaved,
  EMPTY_TWO_FA_STORE,
  type RecentEntry,
  type SavedEntry,
} from "../lib/two-fa-storage";

test("2FA 本地存储：解析容错、近期去重置顶、保存同密钥不重复", () => {
  assert.deepEqual(parseTwoFaStore(null), EMPTY_TWO_FA_STORE);
  assert.deepEqual(parseTwoFaStore("{oops"), EMPTY_TWO_FA_STORE);
  assert.deepEqual(parseTwoFaStore('{"saved":[{"bad":1}],"recent":"x"}'), {
    saved: [],
    recent: [],
  });
  const r = (id: string, secrets: string[]): RecentEntry => ({
    id,
    secrets,
    labels: secrets,
    at: 1,
  });
  let recent = pushRecent([], r("a", ["S1"]));
  recent = pushRecent(recent, r("b", ["S2"]));
  recent = pushRecent(recent, r("c", ["S1"]));
  assert.deepEqual(
    recent.map((item) => item.id),
    ["c", "b"],
  );
  const s = (id: string, secret: string): SavedEntry => ({
    id,
    name: id,
    secret,
    createdAt: 1,
  });
  let saved = upsertSaved([], s("a", "S1"));
  saved = upsertSaved(saved, s("b", "S1"));
  assert.equal(saved.length, 1);
  saved = upsertSaved(saved, s("c", "S2"));
  assert.equal(saved.length, 2);
});

test("工具页条目：完整格式带出邮箱标签，裸密钥无标签", () => {
  const entries = extractTotpEntries(
    "1001|passw0rd|JBSWY3DPEHPK3PXP|a@b.com|mailpass\nGEZDGNBVGY3TQOJQ",
  );
  assert.equal(entries[0].label, "a@b.com");
  assert.equal(entries[1].label, "");
});
