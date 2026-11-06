import { createTextShare, shareResponse } from "@/lib/text-share-http";
import { textShareServices } from "@/lib/text-share-store";

export async function POST(request: Request) {
  try {
    const { store, rateLimit } = await textShareServices(request);
    return await createTextShare(request, store, rateLimit);
  } catch {
    return shareResponse({ error: "暂时无法保存，请稍后重试。" }, 503);
  }
}
