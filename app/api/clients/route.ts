import { NextResponse } from "next/server";
import { guides } from "@/lib/catalog";
import { getDownloads } from "@/lib/releases";

export async function GET() {
  return NextResponse.json(
    { clients: guides, downloads: await getDownloads() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
