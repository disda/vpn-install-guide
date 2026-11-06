import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "连接指南 · 客户端安装与配置",
  description:
    "Windows 和 macOS 使用 FlClash，iOS 使用 Shadowrocket，Android 使用 Clash。选择设备，下载客户端，按照步骤完成配置。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
