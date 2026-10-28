import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ArtisanProfile, QuoteItem } from "./quote";

let client: SupabaseClient | null = null;

// Server-only: uses the service role key, which bypasses RLS.
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export interface Artisan {
  id: string;
  phone_number: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  address: string | null;
}

export interface Quote {
  id: string;
  artisan_id: string | null;
  quote_number: string;
  client_name: string;
  items: QuoteItem[];
  total_ht: number;
  tva: number;
  total_ttc: number;
  pdf_url: string | null;
  status: string;
  raw_transcription: string;
  created_at: string;
}

// The artisan is identified by phone number (no accounts yet).
export async function upsertArtisan(profile: ArtisanProfile): Promise<Artisan> {
  const { data, error } = await getSupabase()
    .from("artisans")
    .upsert(
      {
        phone_number: profile.phone,
        name: profile.name || null,
        company_name: profile.company_name || null,
        email: profile.email || null,
        address: profile.address || null,
      },
      { onConflict: "phone_number" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Artisan;
}

export async function getNextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await getSupabase()
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01`);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `DEV-${year}-${seq}`;
}

export async function uploadQuotePDF(
  quoteNumber: string,
  pdf: Buffer
): Promise<string> {
  // Random suffix so public URLs can't be guessed from the quote number
  const path = `${quoteNumber}-${crypto.randomUUID()}.pdf`;
  const storage = getSupabase().storage.from("quotes");
  const { data, error } = await storage.upload(path, pdf, {
    contentType: "application/pdf",
  });
  if (error) throw error;
  return storage.getPublicUrl(data.path).data.publicUrl;
}

export async function saveQuote(
  artisanId: string | null,
  quoteNumber: string,
  clientName: string,
  items: QuoteItem[],
  totalHt: number,
  tva: number,
  totalTtc: number,
  rawTranscription: string,
  pdfUrl: string | null
): Promise<Quote> {
  const { data, error } = await getSupabase()
    .from("quotes")
    .insert({
      artisan_id: artisanId,
      quote_number: quoteNumber,
      client_name: clientName,
      items,
      total_ht: totalHt,
      tva,
      total_ttc: totalTtc,
      raw_transcription: rawTranscription,
      pdf_url: pdfUrl,
      status: "sent",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Quote;
}
