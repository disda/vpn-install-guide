import { GuidePage } from "@/components/guide-page";
import { getDownloads } from "@/lib/releases";
import { detectPlatform } from "@/lib/detect-platform";
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const initialPlatform = detectPlatform(requestHeaders.get("user-agent"));
  return (
    <GuidePage
      downloads={await getDownloads()}
      initialPlatform={initialPlatform}
    />
  );
}
