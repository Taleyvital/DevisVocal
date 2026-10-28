"use client";

import {
  computeTotals,
  formatFCFA,
  type DraftItem,
  type QuoteDraft,
} from "@/lib/quote";
import { PlusIcon, TrashIcon } from "./icons";

// Numbers are kept as typed strings so "12," or "1 500" stay editable
export interface EditLine {
  id: string;
  section: string;
  designation: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  hint: string | null;
}

export interface EditQuote {
  client: string;
  project: string;
  lines: EditLine[];
  tva: boolean;
  assumptions: string[];
  questions: string[];
}

export function toEditLine(item?: DraftItem): EditLine {
  return {
    id: Math.random().toString(36).slice(2),
    section: item?.section ?? "",
    designation: item?.designation ?? "",
    quantity: item?.quantity != null ? String(item.quantity) : "",
    unit: item?.unit ?? "u",
    unitPrice: item?.unit_price_fcfa != null ? String(item.unit_price_fcfa) : "",
    hint: item?.hint ?? null,
  };
}

export function fromDraft(draft: QuoteDraft, defaultTva: boolean): EditQuote {
  return {
    client: draft.client === "À définir" ? "" : draft.client,
    project: draft.project,
    lines: draft.items.length ? draft.items.map(toEditLine) : [toEditLine()],
    tva: draft.tva ?? defaultTva,
    assumptions: draft.assumptions,
    questions: draft.questions,
  };
}

// Current editor state, sent back to the model for voice corrections
export function toDraft(q: EditQuote): QuoteDraft {
  return {
    client: q.client || "À définir",
    project: q.project,
    items: q.lines.map((l) => ({
      section: l.section.trim() || null,
      designation: l.designation,
      quantity: parseAmount(l.quantity),
      unit: l.unit,
      unit_price_fcfa: parseAmount(l.unitPrice),
      hint: l.hint,
    })),
    tva: q.tva,
    assumptions: [],
    questions: [],
  };
}

export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[\s  ]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Lines ready for the API, or null if any field is missing
export function completeItems(lines: EditLine[]) {
  if (lines.length === 0) return null;
  const items = [];
  for (const l of lines) {
    const quantity = parseAmount(l.quantity);
    const unit_price_fcfa = parseAmount(l.unitPrice);
    if (!l.designation.trim() || quantity === null || unit_price_fcfa === null) {
      return null;
    }
    items.push({
      section: l.section.trim() || null,
      designation: l.designation.trim(),
      quantity,
      unit: l.unit.trim() || "u",
      unit_price_fcfa,
    });
  }
  return items;
}

const UNITS = ["u", "m2", "m3", "ml", "m", "kg", "sac", "forfait", "jour"];

export function QuoteEditor({
  quote,
  onChange,
  tvaRate,
  disabled,
}: {
  quote: EditQuote;
  onChange: (q: EditQuote) => void;
  tvaRate: number;
  disabled?: boolean;
}) {
  const { lines } = quote;
  const set = (patch: Partial<EditQuote>) => onChange({ ...quote, ...patch });
  const setLines = (next: EditLine[]) => set({ lines: next });
  const update = (id: string, patch: Partial<EditLine>) =>
    setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const showSections = lines.some((l) => l.section.trim());
  const ratePct = Math.round(tvaRate * 1000) / 10;

  // Totals over the lines that are filled in so far
  const totals = computeTotals(
    lines.flatMap((l) => {
      const quantity = parseAmount(l.quantity);
      const unit_price_fcfa = parseAmount(l.unitPrice);
      return quantity !== null && unit_price_fcfa !== null
        ? [{ section: null, designation: l.designation, unit: l.unit, quantity, unit_price_fcfa }]
        : [];
    }),
    quote.tva ? tvaRate : 0
  );

  return (
    <fieldset className="editor" disabled={disabled}>
      {quote.questions.length > 0 && (
        <div className="notice" role="status">
          <strong>À compléter</strong>
          <ul>
            {quote.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      {quote.assumptions.length > 0 && (
        <div className="notice notice-info" role="status">
          <strong>J&apos;ai interprété — vérifiez</strong>
          <ul>
            {quote.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="field">
        <span>Client</span>
        <input
          value={quote.client}
          onChange={(e) => set({ client: e.target.value })}
          placeholder="Nom du client"
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>Objet / chantier (facultatif)</span>
        <input
          value={quote.project}
          onChange={(e) => set({ project: e.target.value })}
          placeholder="Ex : Rénovation salle de bain, Cocody"
          autoComplete="off"
        />
      </label>

      <h2 className="section-title">Prestations</h2>
      <ol className="lines">
        {lines.map((l, i) => {
          const qty = parseAmount(l.quantity);
          const price = parseAmount(l.unitPrice);
          const lineTotal =
            qty !== null && price !== null ? Math.round(qty * price) : null;
          return (
            <li key={l.id} className="line">
              {showSections && (
                <label className="field">
                  <span>Section</span>
                  <input
                    value={l.section}
                    onChange={(e) => update(l.id, { section: e.target.value })}
                    placeholder="Ex : Gros œuvre"
                  />
                </label>
              )}
              <label className="field">
                <span>Désignation {i + 1}</span>
                <input
                  value={l.designation}
                  onChange={(e) => update(l.id, { designation: e.target.value })}
                  aria-invalid={!l.designation.trim()}
                  placeholder="Ex : Pose de carrelage"
                />
              </label>
              <div className="line-grid">
                <label className="field">
                  <span>Quantité</span>
                  <input
                    inputMode="decimal"
                    value={l.quantity}
                    onChange={(e) => update(l.id, { quantity: e.target.value, hint: null })}
                    aria-invalid={qty === null}
                    placeholder="?"
                  />
                </label>
                <label className="field">
                  <span>Unité</span>
                  <input
                    list="units"
                    value={l.unit}
                    onChange={(e) => update(l.id, { unit: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Prix unit. (F)</span>
                  <input
                    inputMode="decimal"
                    value={l.unitPrice}
                    onChange={(e) => update(l.id, { unitPrice: e.target.value, hint: null })}
                    aria-invalid={price === null}
                    placeholder="?"
                  />
                </label>
              </div>
              {l.hint && <p className="line-hint">{l.hint}</p>}
              <div className="line-footer">
                <span className={lineTotal === null ? "muted" : "line-total"}>
                  {lineTotal === null ? "Total : à compléter" : formatFCFA(lineTotal)}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setLines(lines.filter((x) => x.id !== l.id))}
                  aria-label={`Supprimer la ligne ${i + 1}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <datalist id="units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => {
          const last = lines[lines.length - 1];
          setLines([...lines, { ...toEditLine(), section: last?.section ?? "" }]);
        }}
      >
        <PlusIcon /> Ajouter une ligne
      </button>

      <label className="toggle">
        <input
          type="checkbox"
          checked={quote.tva}
          onChange={(e) => set({ tva: e.target.checked })}
        />
        <span>Appliquer la TVA ({ratePct} %)</span>
      </label>

      <dl className="totals">
        {quote.tva && (
          <>
            <div>
              <dt>Total HT</dt>
              <dd>{formatFCFA(totals.total_ht)}</dd>
            </div>
            <div>
              <dt>TVA ({ratePct} %)</dt>
              <dd>{formatFCFA(totals.tva)}</dd>
            </div>
          </>
        )}
        <div className="grand">
          <dt>{quote.tva ? "Total TTC" : "Total"}</dt>
          <dd>{formatFCFA(totals.total_ttc)}</dd>
        </div>
      </dl>
    </fieldset>
  );
}
