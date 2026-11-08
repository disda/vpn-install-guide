import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowUpRight } from "@/components/icons";
import "../text/text.css";
import "./2fa.css";

export const metadata: Metadata = {
  title: "在线 2FA 验证工具 · 连接指南",
  description:
    "谷歌身份验证器网页版：输入 2FA 密钥生成 6 位动态验证码，全程浏览器本地计算。",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function TwoFaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark"><IconArrowUpRight size={16} /></span>连接指南
            <span className="brand-divider" />
            <span className="brand-caption">2FA TOOL</span>
          </Link>
          <Link className="header-help" href="/">
            返回安装指南 <IconArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main className="text-container">{children}</main>
      <footer>
        <span>
          在线 2FA 验证工具 <span className="footer-dot">·</span>{" "}
          密钥只在本地计算
        </span>
        <span>验证码每 30 秒自动更新</span>
      </footer>
    </>
  );
}
