// 2FA 工具页的本地存储（localStorage）：已保存条目 + 近期查询。
// 只存密钥本身与名称/标签，不存完整格式里的密码等字段；数据不出本机浏览器。

export interface SavedEntry {
  id: string;
  name: string;
  secret: string;
  createdAt: number;
}

export interface RecentEntry {
  id: string;
  secrets: string[];
  labels: string[];
  at: number;
}

export interface TwoFaStoreData {
  saved: SavedEntry[];
  recent: RecentEntry[];
}

export const EMPTY_TWO_FA_STORE: TwoFaStoreData = { saved: [], recent: [] };

export const TWO_FA_STORE_KEY = "guide-two-fa-store";
export const MAX_SAVED = 100;
export const MAX_RECENT = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseTwoFaStore(raw: string | null): TwoFaStoreData {
  if (!raw) return EMPTY_TWO_FA_STORE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_TWO_FA_STORE;
    const saved: SavedEntry[] = Array.isArray(parsed.saved)
      ? parsed.saved.filter(
          (item): item is SavedEntry =>
            isRecord(item) &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.secret === "string" &&
            typeof item.createdAt === "number",
        )
      : [];
    const recent: RecentEntry[] = Array.isArray(parsed.recent)
      ? parsed.recent.filter(
          (item): item is RecentEntry =>
            isRecord(item) &&
            typeof item.id === "string" &&
            Array.isArray(item.secrets) &&
            item.secrets.every((s) => typeof s === "string") &&
            Array.isArray(item.labels) &&
            typeof item.at === "number",
        )
      : [];
    return { saved, recent };
  } catch {
    return EMPTY_TWO_FA_STORE;
  }
}

/** 记一次近期查询：同样的密钥组合只保留最新一条，最多 MAX_RECENT 条。 */
export function pushRecent(
  list: RecentEntry[],
  entry: RecentEntry,
): RecentEntry[] {
  const signature = entry.secrets.join("\n");
  const rest = list.filter((item) => item.secrets.join("\n") !== signature);
  return [entry, ...rest].slice(0, MAX_RECENT);
}

/** 保存一个密钥：同密钥已存在则原样返回（不重复存）。 */
export function upsertSaved(
  list: SavedEntry[],
  entry: SavedEntry,
): SavedEntry[] {
  if (list.some((item) => item.secret === entry.secret)) return list;
  return [entry, ...list].slice(0, MAX_SAVED);
}
