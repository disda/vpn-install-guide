import type { Metadata } from "next";
import Link from "next/link";
import "../text/text.css";
import "./chatgpt.css";

export const metadata: Metadata = {
  title: "ChatGPT 套餐与额度查询 · 连接指南",
  description: "用自己的 ChatGPT Session 查询套餐过期时间与 Codex 额度，不保存凭证。",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ChatGptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">↗</span>连接指南
            <span className="brand-divider" />
            <span className="brand-caption">PLAN CHECK</span>
          </Link>
          <div className="header-actions">
            <Link className="header-help" href="/text">
              长文本分享 ↗
            </Link>
            <Link className="header-help" href="/">
              返回安装指南 ↗
            </Link>
          </div>
        </div>
      </header>
      <main className="text-container">{children}</main>
      <footer>
        <span>
          套餐与额度查询 <span className="footer-dot">·</span> 凭证不保存、不记录
        </span>
        <span>只查询你自己的账号</span>
      </footer>
    </>
  );
}
