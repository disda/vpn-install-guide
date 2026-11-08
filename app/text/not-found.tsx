import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <section className="text-empty">
      <span className="brand-mark"><ArrowUpRight size={18} aria-hidden="true" /></span>
      <h1>这份文本无法打开</h1>
      <p>链接可能不正确，或文本已过期、已被删除。</p>
      <Link className="primary-button" href="/text">
        创建新的分享
      </Link>
    </section>
  );
}
