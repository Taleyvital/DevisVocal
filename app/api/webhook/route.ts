export const runtime = "nodejs";

import { NextRequest, NextResponse, after } from "next/server";
import {
  downloadMedia,
  sendTextMessage,
  sendDocument,
} from "@/lib/whatsapp";
import { transcribeAudio } from "@/lib/transcription";
import { extractQuoteData } from "@/lib/extraction";
import { generateQuotePDF } from "@/lib/pdf";
import {
  getOrCreateArtisan,
  getNextQuoteNumber,
  saveQuote,
  supabase,
} from "@/lib/supabase";

// ─── GET — WhatsApp webhook verification ──────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — Incoming messages ─────────────────────────────────
export async function POST(req: NextRequest) {
  let body: WhatsAppPayload;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // after() runs after the 200 is sent — keeps the function alive on Vercel
  after(() =>
    processMessage(body).catch((err) =>
      console.error("[webhook] processing error:", err)
    )
  );

  return new NextResponse("OK", { status: 200 });
}

// ─── Message processing (async, after 200 response) ──────────
async function processMessage(payload: WhatsAppPayload) {
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const messages = value?.messages;

  if (!messages?.length) return;

  const message = messages[0];
  const from = message.from;

  if (message.type === "audio") {
    await handleAudioMessage(from, message.audio.id, message.audio.mime_type);
  } else if (message.type === "text") {
    await handleTextMessage(from, message.text.body);
  }
}

async function handleAudioMessage(
  from: string,
  mediaId: string,
  mimeType: string
) {
  await sendTextMessage(from, "🎙️ Note vocale reçue, je génère votre devis...");

  let transcription: string;
  try {
    const audioBuffer = await downloadMedia(mediaId);
    transcription = await transcribeAudio(audioBuffer, mimeType);
  } catch (err) {
    console.error("[audio] transcription error:", err);
    await sendTextMessage(
      from,
      "❌ Impossible de transcrire l'audio. Veuillez réessayer ou envoyer le devis en texte."
    );
    return;
  }

  await buildAndSendQuote(from, transcription);
}

async function handleTextMessage(from: string, text: string) {
  await buildAndSendQuote(from, text);
}

async function buildAndSendQuote(from: string, transcription: string) {
  const artisan = await getOrCreateArtisan(from);

  let extracted;
  try {
    extracted = await extractQuoteData(transcription);
  } catch (err) {
    console.error("[extract] error:", err);
    await sendTextMessage(
      from,
      "❌ Erreur lors de l'analyse. Veuillez réessayer."
    );
    return;
  }

  // Missing info — ask the artisan
  if ("missing" in extracted) {
    const questions = extracted.questions.join("\n• ");
    await sendTextMessage(
      from,
      `📝 J'ai besoin de quelques informations supplémentaires :\n\n• ${questions}\n\nMerci de répondre et je génèrerai votre devis.`
    );
    return;
  }

  // TypeScript: after the return above, extracted is ExtractedQuote
  const quote = extracted;

  // Generate PDF
  const quoteNumber = await getNextQuoteNumber();
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateQuotePDF(
      artisan,
      quoteNumber,
      quote.client,
      quote.items,
      quote.total_ht,
      quote.tva,
      quote.total_ttc
    );
  } catch (err) {
    console.error("[pdf] generation error:", err);
    await sendTextMessage(from, "❌ Erreur lors de la génération du PDF.");
    return;
  }

  // Upload PDF to Supabase Storage
  let pdfUrl: string | null = null;
  try {
    const filename = `${quoteNumber}.pdf`;
    const { data, error } = await supabase.storage
      .from("quotes")
      .upload(filename, pdfBuffer, { contentType: "application/pdf" });
    if (!error && data) {
      const { data: publicData } = supabase.storage
        .from("quotes")
        .getPublicUrl(data.path);
      pdfUrl = publicData.publicUrl;
    }
  } catch (err) {
    console.error("[storage] upload error (non-fatal):", err);
  }

  // Save to DB
  try {
    await saveQuote(
      artisan.id,
      quoteNumber,
      quote.client,
      quote.items,
      quote.total_ht,
      quote.tva,
      quote.total_ttc,
      transcription,
      pdfUrl
    );
  } catch (err) {
    console.error("[db] save error (non-fatal):", err);
  }

  // Send PDF on WhatsApp
  try {
    const caption =
      `✅ Devis ${quoteNumber}\n` +
      `Client : ${quote.client}\n` +
      `Total TTC : ${quote.total_ttc.toLocaleString("fr-FR")} FCFA`;

    await sendDocument(from, pdfBuffer, `${quoteNumber}.pdf`, caption);
  } catch (err) {
    console.error("[whatsapp] send error:", err);
    await sendTextMessage(
      from,
      `✅ Devis ${quoteNumber} généré.\nTotal TTC : ${quote.total_ttc.toLocaleString("fr-FR")} FCFA\n(Envoi du PDF échoué — réessayez.)`
    );
  }
}

// ─── Types ────────────────────────────────────────────────────
interface WhatsAppPayload {
  object: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<WhatsAppMessage>;
      };
    }>;
  }>;
}

type WhatsAppMessage =
  | {
      from: string;
      type: "audio";
      audio: { id: string; mime_type: string };
    }
  | {
      from: string;
      type: "text";
      text: { body: string };
    };
