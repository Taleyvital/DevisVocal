// Shared between server and browser — no server-only imports here.

export const TVA_RATE = 0.18;

export interface ArtisanProfile {
  company_name: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

// A line as extracted from the voice note: quantity / price may be missing
export interface DraftItem {
  designation: string;
  quantity: number | null;
  unit: string;
  unit_price_fcfa: number | null;
}

export interface QuoteDraft {
  client: string;
  items: DraftItem[];
  questions: string[];
}

export interface QuoteItem {
  designation: string;
  quantity: number;
  unit: string;
  unit_price_fcfa: number;
  total_fcfa: number;
}

export interface QuoteTotals {
  items: QuoteItem[];
  total_ht: number;
  tva: number;
  total_ttc: number;
}

export function computeTotals(
  items: Omit<QuoteItem, "total_fcfa">[]
): QuoteTotals {
  const withTotals = items.map((item) => ({
    ...item,
    total_fcfa: Math.round(item.quantity * item.unit_price_fcfa),
  }));
  const total_ht = withTotals.reduce((sum, i) => sum + i.total_fcfa, 0);
  const tva = Math.round(total_ht * TVA_RATE);
  return { items: withTotals, total_ht, tva, total_ttc: total_ht + tva };
}

// fr-FR groups thousands with U+202F, which PDF standard fonts can't draw
export function formatNumber(amount: number): string {
  return amount.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");
}

export function formatFCFA(amount: number): string {
  return formatNumber(amount) + "\u00a0FCFA";
}
