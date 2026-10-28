// Shared between server and browser — no server-only imports here.

export const TVA_RATE = 0.18;

export interface ArtisanProfile {
  company_name: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  legal: string; // RCCM, NCC, compte bancaire… printed in the PDF footer
}

// A line as extracted from the voice note: quantity / price may be missing
export interface DraftItem {
  section: string | null;
  designation: string;
  quantity: number | null;
  unit: string;
  unit_price_fcfa: number | null;
  hint: string | null; // how a value was worked out, for the artisan to check
}

export interface QuoteDraft {
  client: string;
  project: string; // objet / lieu du chantier
  items: DraftItem[];
  tva: boolean | null; // null = not mentioned
  assumptions: string[];
  questions: string[];
}

// Known prices, learned from an old quote
export interface CatalogueItem {
  designation: string;
  unit: string;
  unit_price_fcfa: number;
}

export interface QuoteItem {
  section: string | null;
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
  items: Omit<QuoteItem, "total_fcfa">[],
  tvaRate: number = TVA_RATE
): QuoteTotals {
  const withTotals = items.map((item) => ({
    ...item,
    total_fcfa: Math.round(item.quantity * item.unit_price_fcfa),
  }));
  const total_ht = withTotals.reduce((sum, i) => sum + i.total_fcfa, 0);
  const tva = Math.round(total_ht * tvaRate);
  return { items: withTotals, total_ht, tva, total_ttc: total_ht + tva };
}

// fr-FR groups thousands with U+202F, which PDF standard fonts can't draw
export function formatNumber(amount: number): string {
  return amount.toLocaleString("fr-FR").replace(/ /g, " ");
}

export function formatFCFA(amount: number, currency = "FCFA"): string {
  return formatNumber(amount) + " " + currency;
}
