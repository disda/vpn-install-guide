import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowUpRight } from "@/components/icons";
import "./text.css";

export const metadata: Metadata = {
  title: "长文本分享 · 连接指南",
  description: "分享长文本或 JSON，原样保存，24 小时后失效。",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function TextLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark"><IconArrowUpRight size={19} /></span>连接指南
            <span className="brand-divider" />
            <span className="brand-caption">TEXT SHARE</span>
          </Link>
          <Link className="header-help" href="/">
            返回安装指南 <IconArrowUpRight size={12} />
          </Link>
        </div>
      </header>
      <main className="text-container">{children}</main>
      <footer>
        <span>
          长文本分享 <span className="footer-dot">·</span> 链接 24 小时后失效
        </span>
        <span>链接持有者可查看、复制或删除文本</span>
      </footer>
    </>
  );
}
