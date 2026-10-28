export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/transcription";
import { extractQuoteData } from "@/lib/extraction";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // Vercel body limit is 4.5 MB

// POST multipart/form-data with either `audio` (voice note) or `text`.
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

  try {
    const draft = await extractQuoteData(transcription);
    return NextResponse.json({ transcription, draft });
  } catch (err) {
    console.error("[analyze] extraction error:", err);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse du devis. Réessayez.", transcription },
      { status: 502 }
    );
  }
}
