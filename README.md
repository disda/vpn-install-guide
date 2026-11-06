# VPN 客户端安装教程

一个纯静态的单页网站，告诉用户如何在各个系统上安装并配置代理客户端：下载安装包 → 导入订阅 → 开启系统代理 → 测试连接。

所有下载按钮均指向各客户端的官方发布渠道（GitHub 发布页、App Store、项目官网），本站不打包、不分发任何安装包文件。

## 覆盖范围

- **Windows**：Mihomo Party（Clash Party）、FlClash、sing-box、Clash Verge、v2rayN、Clash for Windows（已停更，仅保留步骤）、Netch
- **macOS**：Mihomo Party、ClashMac、FlClash、Clash Verge、sing-box、ClashX（已停更，仅保留步骤）
- **iOS / iPad**：Shadowrocket、Stash、Clash、sing-box、Loon / Quantumult X（有限支持）
- **Android**：FlClash、ClashMetaForAndroid、sing-box（SFA）
- **Linux**：Clash Verge（deb）、FlClash、服务器 / 终端用法
- **其他**：Stash for Apple TV、路由器 OpenClash、常见问题

## 本地预览

直接用浏览器打开 `index.html` 即可，或起一个静态服务器：

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000
```

## 说明

- 页面里的「订阅地址」指用户在服务商处自己账号专属的 Clash 订阅地址，每个账号都不同，请勿分享给他人。
- 客户端软件版权归各自开发者所有；本仓库只做教程整理与官方下载链接汇总。
