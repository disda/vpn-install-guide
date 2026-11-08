"use client";
import { IconArrowUpRight } from "@/components/icons";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { getGuide, guides, type Platform } from "@/lib/catalog";
import type { Downloads } from "@/lib/release-source";

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === "windows")
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="m3 5 8-1v8H3V5Zm10-1 8-1v9h-8V4ZM3 14h8v7l-8-1v-6Zm10 0h8v9l-8-1v-8Z" />
      </svg>
    );
  if (platform === "macos")
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-5v5M3 12h18" />
      </svg>
    );
  if (platform === "ios")
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <path d="M10 5h4m-3 14h2" />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m7 3 2 3m8-3-2 3M5 12a7 7 0 0 1 14 0v6H5v-6Zm-2 0v5m18-5v5M8 18v3m8-3v3" />
      <path d="M9 10h.01M15 10h.01" strokeWidth="2.4" />
    </svg>
  );
}

const faqs = [
  {
    title: "订阅链接应该填在哪里？",
    description:
      "在客户端中添加，按上方「添加订阅」步骤操作即可。本页不需要填写订阅地址，也不会接收或保存你的订阅凭证。桌面端和 Android 使用 Clash 订阅，iOS 使用兼容 Shadowrocket 的订阅。",
  },
  {
    title: "导入订阅失败，怎么办？",
    description:
      "检查是否完整复制链接、是否仍在有效期内，以及订阅格式是否与客户端兼容。尝试暂时关闭客户端的代理后重新导入；仍然失败时，联系订阅的提供者核对链接。",
  },
  {
    title: "已经连接，为什么网页打不开？",
    description:
      "确认已选中刚导入的配置和可用节点，模式为规则模式。Windows 和 macOS 需要开启系统代理；手机需要允许 VPN 权限。尝试切换节点，并检查订阅是否过期。",
  },
  {
    title: "规则、全局、直连，应该选哪个？",
    description:
      "日常使用选择规则模式，由订阅配置决定流量如何分流。全局模式会让流量统一走代理，直连模式则不使用代理。通常保持规则模式即可。",
  },
];

export function GuidePage({
  downloads,
  initialPlatform,
}: {
  downloads: Downloads;
  initialPlatform: Platform;
}) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [architecture, setArchitecture] = useState<string>(
    getGuide(initialPlatform).architectures[0].value,
  );
  const guide = getGuide(platform);
  const download = downloads[platform];

  function selectPlatform(id: Platform) {
    setPlatform(id);
    setArchitecture(getGuide(id).architectures[0].value);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % guides.length;
    else if (event.key === "ArrowLeft")
      next = (index + guides.length - 1) % guides.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = guides.length - 1;
    else return;
    event.preventDefault();
    selectPlatform(guides[next].id);
    document.getElementById(`tab-${guides[next].id}`)?.focus();
  }

  return (
    <>
      <a className="skip-link" href="#main">
        跳到安装指南
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="连接指南首页">
            <span className="brand-mark"><IconArrowUpRight size={19} /></span>连接指南
            <span className="brand-divider" />
            <span className="brand-caption">SETUP GUIDE</span>
          </Link>
          <div className="header-actions">
            <Link className="header-help" href="/2fa">
              2FA 验证 <IconArrowUpRight size={12} />
            </Link>
            <Link className="header-help" href="/text">
              长文本分享 <IconArrowUpRight size={12} />
            </Link>
            <a className="header-help" href="#faq">
              遇到问题？<IconArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </header>
      <main id="main" className="container">
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">
            <span /> 从安装到连接，只需几步
          </p>
          <h1 id="page-title">
            连接，从这里开始<span>。</span>
          </h1>
          <p className="hero-description">
            选好你的设备，下载客户端，跟着指南完成配置。
          </p>
          <div className="journey" aria-label="配置流程">
            <span>
              <b>01</b> 下载客户端
            </span>
            <i>→</i>
            <span>
              <b>02</b> 导入订阅
            </span>
            <i>→</i>
            <span>
              <b>03</b> 开始连接
            </span>
          </div>
        </section>
        <div className="section-heading">
          <h2>选择你的设备</h2>
          <span>每个平台，一个清晰的选择</span>
        </div>
        <div className="platform-tabs" role="tablist" aria-label="设备平台">
          {guides.map((item, index) => (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              role="tab"
              aria-selected={platform === item.id}
              aria-controls="guide-panel"
              tabIndex={platform === item.id ? 0 : -1}
              className={`platform-tab ${platform === item.id ? "selected" : ""}`}
              onClick={() => selectPlatform(item.id)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              <PlatformIcon platform={item.id} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.client}</small>
              </span>
              <span className="tab-check" aria-hidden="true">
                {platform === item.id ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
        <section
          key={platform}
          role="tabpanel"
          id="guide-panel"
          aria-labelledby={`tab-${platform}`}
          tabIndex={0}
          className="guide-panel"
        >
          <div className="download-card">
            <div className="client-heading">
              <div
                className={`client-icon ${platform === "ios" ? "rocket" : ""}`}
                aria-hidden="true"
              >
                {platform === "ios" ? "↗" : platform === "android" ? "C" : "F"}
              </div>
              <div>
                <div className="client-title">
                  <h2>{guide.client}</h2>
                  <span className="platform-badge">{guide.label}</span>
                </div>
                <p>{guide.subtitle}</p>
              </div>
            </div>
            <div className="download-meta">
              <span>{download.version}</span>
              <span>{guide.format}</span>
              <span>官方来源</span>
            </div>
            <div className="download-actions">
              {guide.architectures.length > 1 && (
                <div className="architecture">
                  <label htmlFor="architecture">选择芯片类型</label>
                  <select
                    id="architecture"
                    value={architecture}
                    onChange={(event) => setArchitecture(event.target.value)}
                  >
                    {guide.architectures.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <a
                className="primary-button"
                href={`/api/download/${platform}?arch=${architecture}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span aria-hidden="true">{platform === "ios" ? "↗" : "↓"}</span>
                {platform === "ios" ? "前往 App Store" : `下载 ${guide.client}`}
                <span className="button-platform">
                  {platform === "ios"
                    ? "iOS"
                    : platform === "macos"
                      ? "macOS"
                      : guide.label}
                </span>
              </a>
            </div>
            <p className="architecture-hint">{guide.architectureHint}</p>
            <div className="source-row">
              <span
                className={
                  download.source === "fallback"
                    ? "fallback-status"
                    : "source-status"
                }
              >
                <span />
                {download.source === "fallback"
                  ? "版本查询暂不可用 · 提供已核对的备用版本"
                  : download.source === "store"
                    ? "价格与版本以 App Store 为准"
                    : "已同步官方稳定版"}
              </span>
              <a
                href={download.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {platform === "ios" ? "查看应用详情" : "查看官方发布页"} ↗
              </a>
            </div>
          </div>
          <div className="setup-layout">
            <div className="steps-section">
              <div className="section-heading">
                <h2>安装与配置</h2>
                <span>跟着步骤，即可开始</span>
              </div>
              <ol className="steps">
                {guide.steps.map((step, index) => (
                  <li key={step.title}>
                    <span className="step-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <aside className="tips">
              <div className="tip-card">
                <span className="tip-symbol" aria-hidden="true">
                  ✦
                </span>
                <h3>先准备好订阅</h3>
                <p>安装客户端后，还需要一条与你的客户端兼容的有效订阅地址。</p>
                <p>复制好链接，在应用里添加即可。</p>
                <div className="privacy-note">
                  订阅地址是私人凭证，请妥善保管。本页不会收集。
                </div>
              </div>
              <div className="small-tip">
                <h3>
                  <span aria-hidden="true">ⓘ</span> 使用小提示
                </h3>
                <p>{guide.note}</p>
              </div>
            </aside>
          </div>
        </section>
        <section id="faq" className="faq" aria-labelledby="faq-title">
          <div className="section-heading">
            <h2 id="faq-title">常见问题</h2>
            <span>连接路上的小疑问</span>
          </div>
          {faqs.map((faq) => (
            <details key={faq.title}>
              <summary>
                {faq.title}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{faq.description}</p>
            </details>
          ))}
        </section>
        <div className="finish-note">
          <span aria-hidden="true">✓</span>
          <p>设置完成后，下次打开客户端即可连接。</p>
        </div>
      </main>
      <footer>
        <span>
          连接指南 <span className="footer-dot">·</span> 让配置简单一点
        </span>
        <span>客户端版权归各自开发者所有</span>
      </footer>
    </>
  );
}
