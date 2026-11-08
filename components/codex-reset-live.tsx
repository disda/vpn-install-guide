"use client";

import { useEffect, useState } from "react";

// 数据来源：AIHOT 公开 API（/api/v1/codex-resets/recent），匿名只读。
// 对方每 10 分钟采集一次，本组件按同一节奏刷新。
const API_URL = "https://aihot.news/api/v1/codex-resets/recent";
const SOURCE_URL = "https://aihot.news/codex-reset";

interface ResetPost {
  author: string;
  publishedAt: string;
  text: string;
  url: string;
}

interface ResetEvent {
  id: string;
  type: string; // direct_reset=额度重置，reset_credit=发重置卡
  displayLabel: string;
  title: string;
  status: string; // confirmed | announced
  confirmedAt: string | null;
  createdAt: string;
  schedule: { label: string } | null;
  posts: ResetPost[];
}

interface RecentPayload {
  checkedAt: string;
  events: ResetEvent[];
}

function eventTime(event: ResetEvent): string {
  return event.confirmedAt ?? event.createdAt;
}

function fmtTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}`;
}

export function CodexResetLive() {
  const [data, setData] = useState<RecentPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as RecentPayload;
        if (!cancelled) {
          setData(json);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (failed) {
    return (
      <section className="cr-live" aria-label="实时重置状态">
        <p className="cr-window-label">实时状态 · AIHOT</p>
        <p className="cr-live-fallback">
          实时数据暂时拉不到，去{" "}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            AIHOT 重置监控页
          </a>{" "}
          看最新状态。
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="cr-live" aria-label="实时重置状态">
        <p className="cr-window-label">实时状态 · AIHOT</p>
        <p className="cr-live-fallback">正在读取最近 7 天的重置动态…</p>
      </section>
    );
  }

  const events = [...data.events].sort((a, b) =>
    eventTime(b).localeCompare(eventTime(a)),
  );
  const pending = events.filter((event) => event.status !== "confirmed");
  const lastConfirmed = events.find((event) => event.status === "confirmed");

  return (
    <section className="cr-live" aria-label="实时重置状态">
      <div className="cr-window-top">
        <p className="cr-window-label">实时状态 · 最近 7 天</p>
        <p className="cr-clock">
          数据更新于 <strong>{fmtTime(data.checkedAt)}</strong>
        </p>
      </div>
      <p className="cr-live-headline">
        {pending.length > 0
          ? `已宣布 ${pending.length} 次，等待生效`
          : "当前没有等待生效的重置"}
      </p>
      {lastConfirmed ? (
        <p className="cr-live-last">
          上一次{lastConfirmed.displayLabel}：{fmtTime(eventTime(lastConfirmed))}{" "}
          确认
          {lastConfirmed.posts[0] ? (
            <>
              {" · "}
              <a href={lastConfirmed.posts[0].url} target="_blank" rel="noreferrer">
                看原帖
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="cr-live-last">最近 7 天没有已确认的重置记录。</p>
      )}
      {events.length > 0 && (
        <ul className="cr-events">
          {events.map((event) => (
            <li key={event.id} className="cr-event">
              <span
                className={`cr-chip${event.type === "direct_reset" ? " is-reset" : ""}`}
              >
                {event.displayLabel}
              </span>
              <span className="cr-event-main">
                <strong>{event.title}</strong>
                <small>
                  {fmtTime(eventTime(event))}
                  {event.schedule ? ` · ${event.schedule.label}` : ""}
                  {" · "}
                  {event.status === "confirmed" ? "已确认" : "已宣布，待生效"}
                </small>
              </span>
              {event.posts[0] ? (
                <a
                  className="cr-event-link"
                  href={event.posts[0].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  原帖
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="cr-attr">
        数据来源：
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">
          AIHOT · Codex 额度重置监控
        </a>
        （经其公开 API 读取，每 10 分钟更新）
      </p>
    </section>
  );
}
