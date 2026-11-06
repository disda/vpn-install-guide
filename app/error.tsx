"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading">
      <h1>指南暂时无法打开</h1>
      <p>请稍后重试。</p>
      <button className="primary-button" onClick={reset}>
        重新加载
      </button>
    </main>
  );
}
