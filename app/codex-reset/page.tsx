import { CodexResetLive } from "@/components/codex-reset-live";
import { CodexResetWindow } from "@/components/codex-reset-window";

export default function CodexResetPage() {
  return (
    <>
      <section className="text-hero">
        <p className="eyebrow">
          <span /> Codex 额度什么时候恢复
        </p>
        <h1>
          Codex 额度重置<span>。</span>
        </h1>
        <p>
          OpenAI
          会不定期重置 Codex 用量额度、发放重置卡。这一页说明两者区别，并按历史习惯推算今天的常见重置窗口。
        </p>
      </section>

      <CodexResetLive />

      <CodexResetWindow />

      <section className="cr-grid">
        <article className="cr-card">
          <h2>额度重置</h2>
          <p>
            官方直接把 Codex 的用量窗口清零：5 小时窗口和周窗口的已用量恢复为
            0，不需要你做任何操作，到账后立刻能继续用。通常由 OpenAI
            员工发帖宣布，帖子确认后陆续到账。
          </p>
        </article>
        <article className="cr-card">
          <h2>重置卡</h2>
          <p>
            发放到账户里的重置次数（banked
            resets），不会自动生效，需要你在 Codex
            里手动使用，用一张把当前窗口用量清零一次。发卡不代表额度已经恢复，余额在
            Codex 内查看。
          </p>
        </article>
      </section>

      <section className="cr-rules">
        <h2>时间是怎么推算的</h2>
        <ul>
          <li>
            <strong>有原话就按原话。</strong>
            原帖写了时间（如 “6pm PST”“next hour”），按太平洋时间换算成北京时间，并多留一两个小时缓冲，确认帖通常比说的时间晚一点。只写日期的，按以往按下重置的时段推算。
          </li>
          <li>
            <strong>没写时间就按习惯。</strong>
            重置多在太平洋时间 16:30–21:30 按下，也就是北京时间第二天
            08:30–13:30。据 AIHOT 对近 35 次确认的统计，有 15
            次落在这个时段。
          </li>
          <li>
            <strong>推算只是参考。</strong>
            不预测尚未宣布的下一次重置；是否已生效，以发帖确认和你 Codex
            里的用量为准。
          </li>
        </ul>
      </section>

      <section className="cr-sources">
        <h2>去哪看实时动态</h2>
        <a
          className="cr-source"
          href="https://aihot.news/codex-reset"
          target="_blank"
          rel="noreferrer"
        >
          <span>
            <strong>AIHOT · Codex 额度重置监控</strong>
            <small>持续跟踪官方发帖，含重置日历与原帖链接，每 10 分钟更新</small>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
        <a
          className="cr-source"
          href="https://x.com/thsottiaux"
          target="_blank"
          rel="noreferrer"
        >
          <span>
            <strong>Tibo（@thsottiaux）· X</strong>
            <small>OpenAI Codex 负责人，重置与发卡多由他发帖确认</small>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      </section>
    </>
  );
}
