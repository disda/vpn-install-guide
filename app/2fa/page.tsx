import { TwoFaTool } from "@/components/two-fa-tool";

export default function TwoFaPage() {
  return (
    <>
      <section className="text-hero">
        <p className="eyebrow">
          <span /> 谷歌身份验证器的网页版
        </p>
        <h1>
          在线 2FA 验证工具<span>。</span>
        </h1>
        <p>
          输入 2FA 密钥，生成当前有效的 6 位动态验证码。全程在你的浏览器本地计算，密钥不经过服务器。
        </p>
      </section>
      <TwoFaTool />
      <section className="tfa-usage">
        <h2>使用说明</h2>
        <p>
          2FA 双重验证是保障账户安全的重要机制：登录时除密码外，还要输入一个每
          30 秒变化一次的动态验证码。本工具相当于谷歌身份验证器（Google
          Authenticator）的网页版，通过 2FA 密钥生成同样的 6 位验证码。
        </p>
        <ol>
          <li>在上方输入你的 2FA 密钥（一行一个），或整行粘贴账户完整格式。</li>
          <li>点击「查询」生成当前有效的验证码，点击即可复制使用。</li>
          <li>常用密钥点「保存到列表」存下来，之后打开页面就能在已保存表格里直接看实时动态码。</li>
          <li>验证码每 30 秒自动更新一次，无需重复点击。</li>
        </ol>
      </section>
    </>
  );
}
