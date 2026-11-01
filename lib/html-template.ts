// HTML quote layouts learned from an artisan's old quote, and their rendering.
// Shared between server (PDF via Chromium) and browser (preview iframe):
// no server-only imports here.
//
// Template syntax (a tiny, logic-less subset of Mustache):
//   {{field}}                escaped value
//   {{{rows}}}               the table rows we build (only raw field)
//   {{#field}}…{{/field}}    shown when field is non-empty / true
//   {{^field}}…{{/field}}    shown when field is empty / false

import { numberToWords } from "./number-words";
import type { ArtisanProfile, QuoteItem, QuoteTotals } from "./quote";

export interface HtmlLayout {
  html: string; // full A4 document with <style>, containing {{{rows}}}
  item_row: string; // one <tr> for an item
  section_row: string; // one <tr> for a section heading
  thousands: " " | "."; // thousands separator used on the old quote
}

export const DOCUMENT_FIELDS = [
  "company_name", "name", "phone", "email", "address", "legal",
  "title", "number", "date", "date_short",
  "client", "project", "conditions",
  "currency", "total_ht", "tva", "tva_rate", "total_ttc", "total", "total_words",
  "has_tva",
] as const;
export const ITEM_FIELDS = ["num", "designation", "quantity", "unit", "unit_price", "total"] as const;
export const SECTION_FIELDS = ["code", "section", "subtotal"] as const;

const MAX_HTML = 60_000;
const MAX_ROW = 4_000;

// ─── Sanitizing ────────────────────────────────────────────────
// The layout is written by a model from a user-supplied image, so it is
// untrusted. Chromium also renders it with JavaScript disabled and every
// network request blocked; this is the first line of defense.
export function sanitizeLayoutHtml(input: string, max = MAX_HTML): string {
  let html = input.slice(0, max);
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  // Elements removed with their content…
  html = html.replace(
    /<\s*(script|iframe|object|embed|frameset|applet|noscript|template|svg|math|form|select|textarea|button|video|audio|picture)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  // …then any leftover opening/closing/void tag of those or other unsafe kinds
  html = html.replace(
    /<\s*\/?\s*(script|iframe|object|embed|frame|frameset|applet|noscript|template|svg|math|form|input|button|textarea|select|option|video|audio|source|track|picture|img|image|link|meta|base)\b[^>]*>/gi,
    ""
  );
  // Event handlers and javascript:/external URLs in attributes
  html = html.replace(/\s(on\w+|srcset|src|href|action|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // CSS: no imports, no external resources, no legacy script hooks
  html = html.replace(/@import[^;]*;?/gi, "");
  html = html.replace(/url\s*\(\s*(['"]?)(?!data:)[^)]*\1\s*\)/gi, "none");
  html = html.replace(/expression\s*\(/gi, "(");
  html = html.replace(/javascript\s*:/gi, "");
  return html;
}

export function sanitizeLayout(raw: unknown): HtmlLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.html !== "string" || !r.html.includes("{{{rows}}}")) return null;
  const html = sanitizeLayoutHtml(r.html);
  const item = typeof r.item_row === "string" ? sanitizeLayoutHtml(r.item_row, MAX_ROW) : "";
  if (!html.includes("{{{rows}}}") || !/<tr[\s>]/i.test(item)) return null;
  const section = typeof r.section_row === "string" ? sanitizeLayoutHtml(r.section_row, MAX_ROW) : "";
  return {
    html,
    item_row: item,
    section_row: /<tr[\s>]/i.test(section) ? section : "",
    thousands: r.thousands === "." ? "." : " ",
  };
}

// ─── Rendering ─────────────────────────────────────────────────
type Vars = Record<string, string | boolean>;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function fill(template: string, vars: Vars, raw: Record<string, string> = {}): string {
  // Sections first (non-nested, matched by name)
  let out = template.replace(
    /\{\{([#^])\s*(\w+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g,
    (_, kind: string, key: string, inner: string) => {
      const value = vars[key] ?? raw[key];
      const truthy = typeof value === "boolean" ? value : Boolean(value && String(value).trim());
      return (kind === "#") === truthy ? inner : "";
    }
  );
  out = out.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_, key: string) => raw[key] ?? "");
  out = out.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (typeof value !== "string") return "";
    return escapeHtml(value).replace(/\n/g, "<br>");
  });
  return out;
}

function formatNumber(n: number, thousands: " " | "."): string {
  const [int, dec] = String(Math.round(n * 100) / 100).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, thousands === "." ? "." : " ");
  return dec ? `${grouped},${dec}` : grouped;
}

function formatDate(date: Date) {
  return {
    long: date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    short: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
  };
}

export interface RenderInput {
  layout: HtmlLayout;
  artisan: ArtisanProfile;
  title: string;
  quoteNumber: string;
  client: string;
  project: string;
  conditions: string;
  currency: string;
  totals: QuoteTotals;
  tvaRate: number;
  date?: Date;
}

// Items grouped by section, in order of first appearance
function groupBySection(items: QuoteItem[]) {
  const groups: { section: string | null; items: QuoteItem[] }[] = [];
  for (const item of items) {
    const group = groups.find((g) => g.section === item.section);
    if (group) group.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

// Base print rules appended after the layout's own CSS
const PRINT_CSS = `
<style>
  @page { size: A4; margin: 0; }
  html { margin: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
</style>`;

const CSP =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`;

export function renderQuoteHtml(input: RenderInput): string {
  const { layout, totals, tvaRate } = input;
  const n = (v: number) => formatNumber(v, layout.thousands);
  const date = formatDate(input.date ?? new Date());

  let num = 0;
  let sectionIndex = 0;
  const rows = groupBySection(totals.items)
    .map((group) => {
      const heading =
        group.section && layout.section_row
          ? fill(layout.section_row, {
              code: `A${++sectionIndex}`,
              section: group.section,
              subtotal: n(group.items.reduce((s, i) => s + i.total_fcfa, 0)),
            })
          : "";
      const items = group.items
        .map((item) =>
          fill(layout.item_row, {
            num: String(++num),
            designation: item.designation,
            quantity: n(item.quantity),
            unit: item.unit,
            unit_price: n(item.unit_price_fcfa),
            total: n(item.total_fcfa),
          })
        )
        .join("");
      return heading + items;
    })
    .join("");

  const words = numberToWords(totals.total_ttc);
  const a = input.artisan;
  const body = fill(
    layout.html,
    {
      company_name: a.company_name || a.name,
      name: a.name,
      phone: a.phone,
      email: a.email,
      address: a.address,
      legal: a.legal,
      title: input.title,
      number: input.quoteNumber,
      date: date.long,
      date_short: date.short,
      client: input.client,
      project: input.project,
      conditions: input.conditions,
      currency: input.currency,
      total_ht: n(totals.total_ht),
      tva: n(totals.tva),
      tva_rate: `${Math.round(tvaRate * 1000) / 10} %`,
      total_ttc: n(totals.total_ttc),
      total: n(totals.total_ttc),
      total_words: words ? `${words} ${input.currency === "FCFA" ? "francs CFA" : input.currency}` : "",
      has_tva: tvaRate > 0,
    },
    { rows }
  );

  // Make it a complete document with our CSP and print rules
  const doc = /<html[\s>]/i.test(body) ? body : `<!DOCTYPE html><html lang="fr"><head></head><body>${body}</body></html>`;
  const withHead = /<head[\s>]/i.test(doc)
    ? doc
    : doc.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head></head>`);
  return withHead
    .replace(/<head(\s[^>]*)?>/i, (m) => `${m}<meta charset="utf-8">${CSP}`)
    .replace(/<\/head>/i, `${PRINT_CSS}</head>`);
}
