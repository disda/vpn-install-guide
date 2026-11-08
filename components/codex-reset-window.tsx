"use client";

import { useSyncExternalStore } from "react";

// 按 AIHOT 统计的习惯：重置多在太平洋时间 16:30–21:30 按下，
// 约等于北京时间次日 08:30–13:30。本组件只按北京时间推算「常见窗口」，不代表官方宣布。
const WINDOW_START = 8 * 60 + 30; // 08:30
const WINDOW_END = 13 * 60 + 30; // 13:30

function beijingText(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function subscribe(callback: () => void) {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
}

function fmtDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分钟`;
}

export function CodexResetWindow() {
  const text = useSyncExternalStore(subscribe, beijingText, () => "");

  if (!text) {
    return (
      <section className="cr-window" aria-label="今日重置窗口">
        <p className="cr-window-label">常见重置窗口推算（北京时间）</p>
        <p className="cr-window-status">读取当前时间中…</p>
      </section>
    );
  }

  const [hh, mm] = text.split(":").map(Number);
  const minutes = (hh % 24) * 60 + mm;

  let status: string;
  let detail: string;
  let tone: "before" | "in" | "after";
  if (minutes < WINDOW_START) {
    status = "今日窗口尚未开始";
    detail = `距窗口开始还有约 ${fmtDuration(WINDOW_START - minutes)}`;
    tone = "before";
  } else if (minutes <= WINDOW_END) {
    status = "正处在常见重置窗口内";
    detail = `窗口还剩约 ${fmtDuration(WINDOW_END - minutes)}，官方若在今天重置，多半会在这段时间宣布并生效`;
    tone = "in";
  } else {
    status = "今日窗口已过";
    detail = `下一个常见窗口是明天 08:30–13:30（约 ${fmtDuration(24 * 60 - minutes + WINDOW_START)} 后）`;
    tone = "after";
  }

  return (
    <section className="cr-window" aria-label="今日重置窗口">
      <div className="cr-window-top">
        <p className="cr-window-label">常见重置窗口推算（北京时间）</p>
        <p className="cr-clock">
          现在 <strong>{text}</strong>
        </p>
      </div>
      <p className={`cr-window-status tone-${tone}`}>{status}</p>
      <p className="cr-window-range">
        每日窗口 <strong>08:30 – 13:30</strong>
        <span>对应太平洋时间前一日 16:30 – 21:30</span>
      </p>
      <p className="cr-window-detail">{detail}</p>
      <p className="cr-window-note">
        这是按历史习惯推算的时段，不是官方宣布。是否重置、何时到账，以 OpenAI
        员工的发帖确认和你 Codex 内的实际用量为准。
      </p>
    </section>
  );
}
