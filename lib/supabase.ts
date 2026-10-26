import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export interface Artisan {
  id: string;
  phone_number: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  address: string | null;
}

export interface QuoteItem {
  designation: string;
  quantity: number;
  unit: string;
  unit_price_fcfa: number;
  total_fcfa: number;
}

export interface Quote {
  id: string;
  artisan_id: string;
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

export async function getOrCreateArtisan(phoneNumber: string): Promise<Artisan> {
  const { data, error } = await supabase
    .from("artisans")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (error && error.code === "PGRST116") {
    const { data: created, error: createError } = await supabase
      .from("artisans")
      .insert({ phone_number: phoneNumber })
      .select()
      .single();
    if (createError) throw createError;
    return created as Artisan;
  }
  if (error) throw error;
  return data as Artisan;
}

export async function getNextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01`);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `DEV-${year}-${seq}`;
}

export async function saveQuote(
  artisanId: string,
  quoteNumber: string,
  clientName: string,
  items: QuoteItem[],
  totalHt: number,
  tva: number,
  totalTtc: number,
  rawTranscription: string,
  pdfUrl: string | null
): Promise<Quote> {
  const { data, error } = await supabase
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
