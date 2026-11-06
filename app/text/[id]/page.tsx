import { connection } from "next/server";
import { notFound } from "next/navigation";
import { visibleShare } from "@/lib/text-shares";
import { textShareServices } from "@/lib/text-share-store";
import { TextShareViewer } from "@/components/text-share-viewer";

export default async function SharedTextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const { store } = await textShareServices();
  const share = await visibleShare(id, store);
  if (!share) notFound();
  return <TextShareViewer share={share} />;
}
