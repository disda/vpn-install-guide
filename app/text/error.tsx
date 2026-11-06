"use client";

export default function TextError({ reset }: { reset: () => void }) {
  return (
    <section className="text-empty">
      <h1>暂时无法打开文本</h1>
      <p>请检查网络，稍后重试。</p>
      <button className="primary-button" onClick={reset}>
        重新加载
      </button>
    </section>
  );
}
