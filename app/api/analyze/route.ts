export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/transcription";
import { extractQuoteData, normalizeDraft } from "@/lib/extraction";
import type { CatalogueItem } from "@/lib/quote";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // Vercel body limit is 4.5 MB

// POST multipart/form-data with either `audio` (voice note) or `text`.
// Optional: `current` (JSON draft — the speech is then a correction to it)
// and `catalogue` (JSON known prices from an old quote).
// Returns { transcription, draft } — the draft is edited in the app before the PDF.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const audio = form.get("audio");
  const text = form.get("text");

  let transcription: string;
  if (audio instanceof Blob) {
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Note vocale trop longue. Essayez en moins de 3 minutes." },
        { status: 413 }
      );
    }
    try {
      transcription = await transcribeAudio(
        Buffer.from(await audio.arrayBuffer())
      );
    } catch (err) {
      console.error("[analyze] transcription error:", err);
      return NextResponse.json(
        { error: "Impossible de transcrire l'audio. Réessayez." },
        { status: 502 }
      );
    }
  } else if (typeof text === "string") {
    transcription = text;
  } else {
    return NextResponse.json(
      { error: "Aucun audio ni texte reçu." },
      { status: 400 }
    );
  }

  if (!transcription.trim()) {
    return NextResponse.json(
      { error: "Je n'ai rien entendu. Parlez plus près du micro et réessayez." },
      { status: 422 }
    );
  }

  const current = parseJSON(form.get("current"));
  const catalogue = parseCatalogue(form.get("catalogue"));

  try {
    const draft = await extractQuoteData(transcription, {
      catalogue,
      current: current ? normalizeDraft(current) : undefined,
    });
    return NextResponse.json({ transcription, draft });
  } catch (err) {
    console.error("[analyze] extraction error:", err);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse du devis. Réessayez.", transcription },
      { status: 502 }
    );
  }
}

function parseJSON(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseCatalogue(value: FormDataEntryValue | null): CatalogueItem[] {
  const raw = parseJSON(value);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c) =>
        c &&
        typeof c.designation === "string" &&
        typeof c.unit_price_fcfa === "number" &&
        Number.isFinite(c.unit_price_fcfa)
    )
    .slice(0, 200)
    .map((c) => ({
      designation: c.designation.slice(0, 200),
      unit: typeof c.unit === "string" ? c.unit.slice(0, 20) : "u",
      unit_price_fcfa: c.unit_price_fcfa,
    }));
}
