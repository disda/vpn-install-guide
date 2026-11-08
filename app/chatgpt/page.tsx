import { ChatGptQueryForm } from "@/components/chatgpt-query-form";

export default function ChatGptPage() {
  return (
    <>
      <section className="text-hero">
        <p className="eyebrow">
          <span /> ChatGPT 账号自查
        </p>
        <h1>
          套餐什么时候过期，额度还剩多少<span>。</span>
        </h1>
        <p>
          粘贴你自己账号的 Session，查订阅到期时间、登录凭证过期时间和 Codex
          额度（短窗口 / 长窗口）。
        </p>
      </section>
      <div className="text-workspace">
        <ChatGptQueryForm />
        <aside className="text-help">
          <h2>三步查询</h2>
          <ol>
            <li>
              <b>01</b>
              <div>
                <h3>先登录 ChatGPT</h3>
                <p>在电脑浏览器打开 chatgpt.com，确认已登录你要查的账号。</p>
              </div>
            </li>
            <li>
              <b>02</b>
              <div>
                <h3>打开 Session 链接</h3>
                <p>
                  在同一个浏览器新开标签，打开
                  chatgpt.com/api/auth/session，全选复制整段 JSON。只显示{" "}
                  {"{}"} 说明还没登录。
                </p>
              </div>
            </li>
            <li>
              <b>03</b>
              <div>
                <h3>粘贴并查询</h3>
                <p>
                  邮箱、套餐和凭证过期时间先在本地解析；点查询后才向
                  ChatGPT 查订阅到期和额度。
                </p>
              </div>
            </li>
          </ol>
          <div className="text-help-note">
            <strong>关于安全，先说清楚</strong>
            <p>
              Session 等同于登录凭证，只能查你自己的账号，不要把别人的、也不要把自己的发给任何人。
            </p>
            <p>
              浏览器直连 ChatGPT 会被跨域拦截，所以查询时凭证会经本站服务器转发给
              chatgpt.com。本站不保存、不记录凭证与结果，查完自动清空输入框。
            </p>
            <p>
              订阅到期看「订阅到期」一行；凭证过期是另一回事，过期后重新获取
              Session 即可。
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
