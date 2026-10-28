export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { extractTemplate } from "@/lib/template-extraction";

const MAX_PAGES = 3;
const MAX_PAGE_BYTES = 1.5 * 1024 * 1024;

// POST multipart/form-data: `pages` (1-3 JPEG/PNG images of the old quote,
// PDFs are rendered to images on the phone), optional `text` (PDF text layer)
// and `source` (file name). Returns { template, business }.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const files = form.getAll("pages").filter((p): p is File => p instanceof Blob);
  if (files.length === 0 || files.length > MAX_PAGES) {
    return NextResponse.json(
      { error: "Envoyez une photo ou un PDF de votre ancien devis." },
      { status: 400 }
    );
  }

  const pages: string[] = [];
  for (const file of files) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_PAGE_BYTES) {
      return NextResponse.json({ error: "Image invalide ou trop lourde." }, { status: 400 });
    }
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    pages.push(`data:${file.type};base64,${base64}`);
  }

  const text = form.get("text");
  const source = form.get("source");

  try {
    const result = await extractTemplate(
      pages,
      typeof text === "string" ? text : "",
      typeof source === "string" ? source : ""
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[template] extraction error:", err);
    return NextResponse.json(
      { error: "Je n'ai pas réussi à lire ce devis. Essayez une photo plus nette." },
      { status: 502 }
    );
  }
}
