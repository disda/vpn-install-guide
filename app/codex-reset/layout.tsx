import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "../text/text.css";
import "./codex-reset.css";

export const metadata: Metadata = {
  title: "Codex 额度重置说明 · 连接指南",
  description:
    "Codex 额度重置与重置卡的区别、常见重置时间窗口推算（北京时间），数据以官方宣布为准。",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function CodexResetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark"><ArrowUpRight size={16} /></span>连接指南
            <span className="brand-divider" />
            <span className="brand-caption">CODEX RESET</span>
          </Link>
          <Link className="header-help" href="/">
            返回安装指南 <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main className="text-container">{children}</main>
      <footer>
        <span>
          Codex 额度重置说明 <span className="footer-dot">·</span>{" "}
          窗口为历史习惯推算
        </span>
        <span>以官方宣布为准</span>
      </footer>
    </>
  );
}
