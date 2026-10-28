// Quote layout learned from an artisan's old quote.
// Shared between server and browser — no server-only imports here.
import { TVA_RATE, type ArtisanProfile, type CatalogueItem } from "./quote";

export interface QuoteTemplate {
  title: string; // "DEVIS", "DEVIS ESTIMATIF", "FACTURE PROFORMA"…
  primary_color: string; // hex, headers and totals
  accent_color: string; // hex, light background for alternate rows
  header_style: "band" | "light"; // filled color band, or white with colored text
  font: "sans" | "serif";
  currency: string; // "FCFA", "F CFA"
  tva_rate: number; // 0.18
  apply_tva: boolean; // default for new quotes
  conditions: string; // validity, deposit, payment terms…
  signature: string; // label above the client's signature box, "" for none
  catalogue: CatalogueItem[];
  source: string; // file it was learned from, "" for the default
}

export const DEFAULT_CONDITIONS =
  "Devis valable 30 jours à compter de sa date d'émission. " +
  "Un acompte de 30% est demandé à la commande. " +
  "En cas d'accord, veuillez retourner ce devis signé avec la mention « Bon pour accord ».";

export const DEFAULT_TEMPLATE: QuoteTemplate = {
  title: "DEVIS",
  primary_color: "#1a3c5e",
  accent_color: "#e8f0f8",
  header_style: "band",
  font: "sans",
  currency: "FCFA",
  tva_rate: TVA_RATE,
  apply_tva: true,
  conditions: DEFAULT_CONDITIONS,
  signature: "",
  catalogue: [],
  source: "",
};

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function hex(v: unknown): string | null {
  const s = str(v, 9);
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return ("#" + [...s.slice(1)].map((c) => c + c).join("")).toLowerCase();
  }
  return null;
}

// Relative luminance, to reject colors that would make white text unreadable
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function sanitizeCatalogue(raw: unknown): CatalogueItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c) =>
        c &&
        str(c.designation, 200) &&
        typeof c.unit_price_fcfa === "number" &&
        Number.isFinite(c.unit_price_fcfa) &&
        c.unit_price_fcfa >= 0
    )
    .slice(0, 200)
    .map((c) => ({
      designation: str(c.designation, 200),
      unit: str(c.unit, 20) || "u",
      unit_price_fcfa: c.unit_price_fcfa,
    }));
}

// Model output and client input both go through here; anything invalid
// falls back to the default look.
export function sanitizeTemplate(raw: unknown): QuoteTemplate {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_TEMPLATE;

  let primary = hex(r.primary_color) ?? d.primary_color;
  if (luminance(primary) > 0.4) primary = d.primary_color; // too light for white text
  let accent = hex(r.accent_color) ?? d.accent_color;
  if (luminance(accent) < 0.6) accent = d.accent_color; // too dark behind black text

  const rate = typeof r.tva_rate === "number" ? r.tva_rate : NaN;
  return {
    title: str(r.title, 40).toUpperCase() || d.title,
    primary_color: primary,
    accent_color: accent,
    header_style: r.header_style === "light" ? "light" : "band",
    font: r.font === "serif" ? "serif" : "sans",
    currency: str(r.currency, 10) || d.currency,
    tva_rate: rate > 0 && rate <= 0.5 ? rate : d.tva_rate,
    apply_tva: typeof r.apply_tva === "boolean" ? r.apply_tva : d.apply_tva,
    conditions: typeof r.conditions === "string" ? str(r.conditions, 1500) : d.conditions,
    signature: str(r.signature, 80),
    catalogue: sanitizeCatalogue(r.catalogue),
    source: str(r.source, 120),
  };
}

// Business details read on the old quote, used to pre-fill the profile
export type BusinessInfo = Partial<ArtisanProfile>;

export function sanitizeBusiness(raw: unknown): BusinessInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    company_name: str(r.company_name, 200),
    name: str(r.name, 200),
    phone: str(r.phone, 30),
    email: str(r.email, 200),
    address: str(r.address, 300),
    legal: str(r.legal, 600),
  };
}
