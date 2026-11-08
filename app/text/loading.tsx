import { ArrowUpRight } from "lucide-react";

export default function TextLoading() {
  return (
    <section className="text-empty" role="status">
      <span className="brand-mark"><ArrowUpRight size={18} aria-hidden="true" /></span>
      <p>正在打开文本…</p>
    </section>
  );
}
