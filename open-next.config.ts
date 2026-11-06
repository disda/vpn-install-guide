import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// 版本元数据允许短暂的最终一致性，使用 KV 持久化 Next.js Fetch Cache。
// 页面本身按 UA 动态渲染，不对不同用户共享 HTML 缓存。
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
