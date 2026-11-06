import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, RateLimit } from "@cloudflare/workers-types";
import type { TextShare, TextShareStore } from "./text-shares";

type TextShareBindings = {
  TEXT_SHARE_DB: D1Database;
  TEXT_SHARE_RATE_LIMITER: RateLimit;
};

export async function textShareServices(request?: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const { TEXT_SHARE_DB: db, TEXT_SHARE_RATE_LIMITER: limiter } =
    env as typeof env & TextShareBindings;
  if (!db || !limiter) throw new Error("Text sharing bindings unavailable");
  const store: TextShareStore = {
    async create(share) {
      await db.batch([
        db
          .prepare("DELETE FROM text_shares WHERE expires_at <= ?")
          .bind(Date.now()),
        db
          .prepare(
            "INSERT INTO text_shares (id, content, format, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            share.id,
            share.text,
            share.format,
            share.createdAt,
            share.expiresAt,
          ),
      ]);
    },
    async get(id) {
      return db
        .prepare(
          "SELECT id, content AS text, format, created_at AS createdAt, expires_at AS expiresAt FROM text_shares WHERE id = ?",
        )
        .bind(id)
        .first<TextShare>();
    },
    async delete(id) {
      await db.prepare("DELETE FROM text_shares WHERE id = ?").bind(id).run();
    },
  };
  return {
    store,
    async rateLimit() {
      const key = `text-share:create:${request?.headers.get("cf-connecting-ip") ?? "local"}`;
      return (await limiter.limit({ key })).success;
    },
  };
}
