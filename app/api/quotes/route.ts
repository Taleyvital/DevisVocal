export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateQuotePDF } from "@/lib/pdf";
import { computeTotals, type ArtisanProfile, type QuoteItem } from "@/lib/quote";
import { sanitizeTemplate, type QuoteTemplate } from "@/lib/template";
import {
  getNextQuoteNumber,
  saveQuote,
  uploadQuotePDF,
  upsertArtisan,
} from "@/lib/supabase";

interface QuoteRequest {
  profile: ArtisanProfile;
  client: string;
  project: string;
  items: Omit<QuoteItem, "total_fcfa">[];
  tvaRate: number;
  template: QuoteTemplate;
  transcription: string;
}

const str = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const amount = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

function parseRequest(body: unknown): QuoteRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 100) {
    return null;
  }

  const items: QuoteRequest["items"] = [];
  for (const raw of b.items as Record<string, unknown>[]) {
    const quantity = amount(raw?.quantity);
    const unitPrice = amount(raw?.unit_price_fcfa);
    const designation = str(raw?.designation, 300);
    if (quantity === null || unitPrice === null || !designation) return null;
    items.push({
      section: str(raw.section, 100) || null,
      designation,
      quantity,
      unit: str(raw.unit, 20) || "u",
      unit_price_fcfa: unitPrice,
    });
  }

  const rate = amount(b.tva_rate);
  const p = (b.profile ?? {}) as Record<string, unknown>;
  return {
    profile: {
      company_name: str(p.company_name),
      name: str(p.name),
      phone: str(p.phone, 30),
      email: str(p.email),
      address: str(p.address, 300),
      legal: str(p.legal, 600),
    },
    client: str(b.client) || "À définir",
    project: str(b.project, 300),
    items,
    tvaRate: rate !== null && rate <= 0.5 ? rate : 0.18,
    template: sanitizeTemplate(b.template),
    transcription: str(b.transcription, 20000),
  };
}

// POST JSON quote → returns the PDF (quote number in X-Quote-Number).
export async function POST(req: NextRequest) {
  let request: QuoteRequest | null = null;
  try {
    request = parseRequest(await req.json());
  } catch {
    // fall through
  }
  if (!request) {
    return NextResponse.json(
      { error: "Devis incomplet : chaque ligne doit avoir une quantité et un prix." },
      { status: 400 }
    );
  }

  const { profile, client, project, tvaRate, template, transcription } = request;
  // Totals are always recomputed server-side
  const totals = computeTotals(request.items, tvaRate);
  const { items, total_ht, tva, total_ttc } = totals;

  let quoteNumber: string;
  try {
    quoteNumber = await getNextQuoteNumber();
  } catch (err) {
    console.error("[quotes] numbering error (fallback):", err);
    quoteNumber = `DEV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
  }

  let pdf: Buffer;
  try {
    pdf = await generateQuotePDF({
      artisan: profile,
      quoteNumber,
      client,
      project,
      totals,
      tvaRate,
      template,
    });
  } catch (err) {
    console.error("[quotes] generation error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF." },
      { status: 500 }
    );
  }

  // Persisting is best-effort: the artisan still gets their PDF
  try {
    const artisanId = profile.phone ? (await upsertArtisan(profile)).id : null;
    let pdfUrl: string | null = null;
    try {
      pdfUrl = await uploadQuotePDF(quoteNumber, pdf);
    } catch (err) {
      console.error("[quotes] storage upload error (non-fatal):", err);
    }
    await saveQuote(
      artisanId,
      quoteNumber,
      client,
      items,
      total_ht,
      tva,
      total_ttc,
      transcription,
      pdfUrl
    );
  } catch (err) {
    console.error("[quotes] db save error (non-fatal):", err);
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quoteNumber}.pdf"`,
      "X-Quote-Number": quoteNumber,
    },
  });
}
