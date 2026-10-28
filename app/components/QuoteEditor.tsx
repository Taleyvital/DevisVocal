"use client";

import { computeTotals, formatFCFA, TVA_RATE, type DraftItem } from "@/lib/quote";
import { PlusIcon, TrashIcon } from "./icons";

// Numbers are kept as typed strings so "12," or "1 500" stay editable
export interface EditLine {
  id: string;
  designation: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export function toEditLine(item?: DraftItem): EditLine {
  return {
    id: Math.random().toString(36).slice(2),
    designation: item?.designation ?? "",
    quantity: item?.quantity != null ? String(item.quantity) : "",
    unit: item?.unit ?? "u",
    unitPrice: item?.unit_price_fcfa != null ? String(item.unit_price_fcfa) : "",
  };
}

export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[\s  ]/g, "").replace(",", ".");
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
      designation: l.designation.trim(),
      quantity,
      unit: l.unit.trim() || "u",
      unit_price_fcfa,
    });
  }
  return items;
}

const UNITS = ["u", "m2", "m3", "ml", "m", "kg", "sac", "forfait"];

export function QuoteEditor({
  client,
  onClientChange,
  lines,
  onLinesChange,
  questions,
  disabled,
}: {
  client: string;
  onClientChange: (v: string) => void;
  lines: EditLine[];
  onLinesChange: (lines: EditLine[]) => void;
  questions: string[];
  disabled?: boolean;
}) {
  const update = (id: string, patch: Partial<EditLine>) =>
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  // Totals over the lines that are filled in so far
  const totals = computeTotals(
    lines.flatMap((l) => {
      const quantity = parseAmount(l.quantity);
      const unit_price_fcfa = parseAmount(l.unitPrice);
      return quantity !== null && unit_price_fcfa !== null
        ? [{ designation: l.designation, unit: l.unit, quantity, unit_price_fcfa }]
        : [];
    })
  );

  return (
    <fieldset className="editor" disabled={disabled}>
      {questions.length > 0 && (
        <div className="notice" role="status">
          <strong>À compléter</strong>
          <ul>
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="field">
        <span>Client</span>
        <input
          value={client}
          onChange={(e) => onClientChange(e.target.value)}
          placeholder="Nom du client"
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
                    onChange={(e) => update(l.id, { quantity: e.target.value })}
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
                    onChange={(e) => update(l.id, { unitPrice: e.target.value })}
                    aria-invalid={price === null}
                    placeholder="?"
                  />
                </label>
              </div>
              <div className="line-footer">
                <span className={lineTotal === null ? "muted" : "line-total"}>
                  {lineTotal === null ? "Total : à compléter" : formatFCFA(lineTotal)}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onLinesChange(lines.filter((x) => x.id !== l.id))}
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
        onClick={() => onLinesChange([...lines, toEditLine()])}
      >
        <PlusIcon /> Ajouter une ligne
      </button>

      <dl className="totals">
        <div>
          <dt>Total HT</dt>
          <dd>{formatFCFA(totals.total_ht)}</dd>
        </div>
        <div>
          <dt>TVA ({Math.round(TVA_RATE * 100)} %)</dt>
          <dd>{formatFCFA(totals.tva)}</dd>
        </div>
        <div className="grand">
          <dt>Total TTC</dt>
          <dd>{formatFCFA(totals.total_ttc)}</dd>
        </div>
      </dl>
    </fieldset>
  );
}
