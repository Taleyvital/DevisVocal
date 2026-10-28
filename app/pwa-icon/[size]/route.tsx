import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

const SIZES = [192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIcon size={size} />, { width: size, height: size });
}
