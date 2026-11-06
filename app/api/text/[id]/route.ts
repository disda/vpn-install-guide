import {
  deleteTextShare,
  getTextShare,
  shareResponse,
} from "@/lib/text-share-http";
import { textShareServices } from "@/lib/text-share-store";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { store } = await textShareServices();
    return await getTextShare(id, store);
  } catch {
    return shareResponse({ error: "暂时无法读取，请稍后重试。" }, 503);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { store } = await textShareServices();
    return await deleteTextShare(request, id, store);
  } catch {
    return shareResponse({ error: "暂时无法删除，请稍后重试。" }, 503);
  }
}
