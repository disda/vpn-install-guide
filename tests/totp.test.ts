import assert from "node:assert/strict";
import test from "node:test";
import {
  base32Decode,
  detectBareSecrets,
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

test("验证码格式化与密钥脱敏", () => {
  assert.equal(formatCode("287082"), "287 082");
  assert.equal(maskSecret("JBSWY3DPEHPK3PXP"), "JBSW…3PXP");
});
