import { ArrowUpRight } from "lucide-react";

export default function Loading() {
  return (
    <main className="loading" role="status">
      <span className="brand-mark"><ArrowUpRight size={18} aria-hidden="true" /></span>
      <p>正在准备安装指南…</p>
    </main>
  );
}
