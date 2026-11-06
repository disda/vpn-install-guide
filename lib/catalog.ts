export const platformIds = ["windows", "macos", "ios", "android"] as const;
export type Platform = (typeof platformIds)[number];
export type Architecture = "amd64" | "arm64" | "universal";
export type Step = { title: string; description: string };
export type Guide = {
  id: Platform;
  label: string;
  client: string;
  subtitle: string;
  format: string;
  architectures: { value: Architecture; label: string }[];
  architectureHint: string;
  steps: Step[];
  note: string;
};

const desktopSteps: Step[] = [
  {
    title: "下载并安装",
    description: "下载与你的设备匹配的 FlClash 安装包，完成安装后打开应用。",
  },
  {
    title: "添加订阅配置",
    description:
      "打开 Profiles（配置），点击添加，选择 URL / 订阅链接，粘贴你的 Clash 订阅地址并保存。下载完成后选中这份配置。",
  },
  {
    title: "开启系统代理",
    description:
      "进入 Dashboard（仪表盘），开启 System Proxy（系统代理），将出站模式设为 Rule（规则），点击开始按钮。",
  },
  {
    title: "选择节点，测试连接",
    description:
      "在代理面板中选择可用节点或自动选择组，然后用浏览器访问你需要的网站，确认可以正常打开。",
  },
];

export const guides: Guide[] = [
  {
    id: "windows",
    label: "Windows",
    client: "FlClash",
    subtitle: "简单上手，日常连接一步到位",
    format: ".exe 安装包",
    architectures: [
      { value: "amd64", label: "Intel / AMD · x64" },
      { value: "arm64", label: "Windows on ARM · ARM64" },
    ],
    architectureHint:
      "大多数电脑选择 x64。可在「设置 → 系统 → 系统信息」查看系统类型。",
    steps: desktopSteps,
    note: "规则模式会按配置自动分流。如果个别应用不走系统代理，可按需使用 TUN 模式；Windows 上通常需要管理员权限。",
  },
  {
    id: "macos",
    label: "macOS",
    client: "FlClash",
    subtitle: "为你的 Mac 配好每一次连接",
    format: ".dmg 安装包",
    architectures: [
      { value: "arm64", label: "Apple 芯片 · M 系列" },
      { value: "amd64", label: "Intel 芯片" },
    ],
    architectureHint:
      "点击左上角 Apple 菜单 →「关于本机」：显示 M 系列选 Apple 芯片，显示 Intel 选 Intel 芯片。",
    steps: [
      {
        title: "下载并安装",
        description:
          "按芯片类型下载 FlClash 的 DMG，打开后将应用拖入「应用程序」，再启动应用。",
      },
      ...desktopSteps.slice(1),
    ],
    note: "首次打开时按照 macOS 的提示完成授权。如果系统阻止打开，请先核对安装包的官方来源，再在「系统设置 → 隐私与安全性」中查看提示。",
  },
  {
    id: "ios",
    label: "iOS / iPadOS",
    client: "Shadowrocket",
    subtitle: "在 iPhone 和 iPad 上轻松连接",
    format: "App Store 应用",
    architectures: [{ value: "universal", label: "iPhone / iPad" }],
    architectureHint:
      "通过可购买该应用的 App Store 地区账号安装。应用为付费下载，价格与可用性以商店显示为准。",
    steps: [
      {
        title: "安装 Shadowrocket",
        description:
          "点击下方按钮前往 App Store，核对应用名称为 Shadowrocket，完成购买并安装。",
      },
      {
        title: "导入订阅",
        description:
          "准备兼容 Shadowrocket 的订阅链接。在首页点击右上角「+」，类型选择 Subscribe（订阅），粘贴 URL 并保存；也可扫描订阅二维码。",
      },
      {
        title: "选择节点并连接",
        description:
          "更新订阅后选择可用节点，开启首页的连接开关。首次连接时，允许系统添加 VPN 配置并完成设备验证。",
      },
      {
        title: "测试与更新",
        description:
          "打开浏览器测试是否能正常访问所需网站。以后可在订阅项目的菜单中执行更新，获取最新节点。",
      },
    ],
    note: "iOS 的订阅格式可能与 Clash 配置不同，请使用兼容 Shadowrocket 的链接。连接后可在系统状态栏或控制中心查看 VPN 状态。",
  },
  {
    id: "android",
    label: "Android",
    client: "Clash",
    subtitle: "Clash Meta for Android · 一个客户端就够了",
    format: ".apk 安装包",
    architectures: [{ value: "universal", label: "通用版 · Universal" }],
    architectureHint:
      "使用通用 APK，无需判断手机芯片型号。安装时只为本次使用的浏览器或文件管理器允许安装应用。",
    steps: [
      {
        title: "下载并安装 Clash",
        description:
          "下载 Clash Meta for Android 通用 APK，按 Android 的提示完成安装。安装后可关闭本次开启的安装权限。",
      },
      {
        title: "新建订阅配置",
        description:
          "进入「配置」，点击「+」，选择「从 URL 导入」，填写名称并粘贴 Clash 订阅地址，保存并等待下载完成。",
      },
      {
        title: "选中配置，启动服务",
        description:
          "选中刚导入的配置，回到主页点击启动。首次使用时允许系统建立 VPN 连接，代理模式使用规则模式。",
      },
      {
        title: "选择节点，测试连接",
        description:
          "进入「代理」选择可用节点，打开浏览器测试。若后台连接经常中断，可在系统电池设置中允许应用在后台运行。",
      },
    ],
    note: "这里的 Clash 使用 Clash Meta for Android 客户端。Android 同时通常只能运行一个 VPN 连接，启动前请先关闭其他正在连接的 VPN 应用。",
  },
];

export function isPlatform(value: string): value is Platform {
  return platformIds.includes(value as Platform);
}

export function getGuide(platform: Platform): Guide {
  return guides.find((guide) => guide.id === platform)!;
}
