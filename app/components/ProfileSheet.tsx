"use client";

import { useEffect, useRef, useState } from "react";
import type { ArtisanProfile } from "@/lib/quote";
import {
  DEFAULT_TEMPLATE,
  sanitizeBusiness,
  sanitizeTemplate,
  type BusinessInfo,
  type QuoteTemplate,
} from "@/lib/template";
import { prepareQuoteFile } from "./prepareQuoteFile";
import { useStored } from "./useStored";

export const EMPTY_PROFILE: ArtisanProfile = {
  company_name: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  legal: "",
};

// The artisan profile and quote template live on the device; they're sent with each quote.
export function useProfile() {
  return useStored<ArtisanProfile>("devisvocal.profile", EMPTY_PROFILE, (raw) => ({
    ...EMPTY_PROFILE,
    ...sanitizeBusiness(raw),
  }));
}

export function useTemplate() {
  return useStored<QuoteTemplate>("devisvocal.template", DEFAULT_TEMPLATE, sanitizeTemplate);
}

const FIELDS: {
  key: keyof ArtisanProfile;
  label: string;
  type?: string;
  autoComplete: string;
  placeholder?: string;
  multiline?: boolean;
}[] = [
  { key: "company_name", label: "Nom de l'entreprise", autoComplete: "organization", placeholder: "Ex : Kouassi BTP" },
  { key: "name", label: "Votre nom", autoComplete: "name" },
  { key: "phone", label: "Téléphone", type: "tel", autoComplete: "tel", placeholder: "+225 07 00 00 00 00" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "address", label: "Adresse", autoComplete: "street-address" },
  {
    key: "legal",
    label: "Mentions en bas de page (RCCM, NCC, banque…)",
    autoComplete: "off",
    placeholder: "RCCM CI-ABJ-2020-B-12345 · NCC 1234567 A",
    multiline: true,
  },
];

export function ProfileSheet({
  profile,
  onSave,
  template,
  onTemplateChange,
  onClose,
}: {
  profile: ArtisanProfile;
  onSave: (p: ArtisanProfile) => void;
  template: QuoteTemplate;
  onTemplateChange: (t: QuoteTemplate) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [tpl, setTpl] = useState(template);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !importing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, importing]);

  async function importQuote(file: File) {
    setImportError(null);
    setImportNote(null);
    setImporting(true);
    try {
      const { pages, text } = await prepareQuoteFile(file);
      const form = new FormData();
      pages.forEach((p, i) => form.append("pages", p, `page-${i + 1}.jpg`));
      if (text) form.append("text", text);
      form.append("source", file.name);

      const res = await fetch("/api/template", { method: "POST", body: form });
      const data = (await res.json()) as {
        error?: string;
        template?: QuoteTemplate;
        business?: BusinessInfo;
      };
      if (!res.ok || !data.template) {
        setImportError(data.error ?? "Une erreur est survenue. Réessayez.");
        return;
      }

      const learned = sanitizeTemplate(data.template);
      setTpl(learned);
      onTemplateChange(learned); // saved right away: importing costs an API call

      // Only fill the fields the artisan left empty
      const business = data.business ?? {};
      const filled: string[] = [];
      const next = { ...draft };
      for (const f of FIELDS) {
        const value = business[f.key];
        if (!next[f.key].trim() && value) {
          next[f.key] = value;
          filled.push(f.label.split(" (")[0].toLowerCase());
        }
      }
      setDraft(next);
      setImportNote(
        filled.length
          ? `Modèle importé. J'ai aussi rempli : ${filled.join(", ")}. Vérifiez puis enregistrez.`
          : "Modèle importé. Vos prochains devis reprendront cette présentation."
      );
    } catch (err) {
      setImportError(
        err instanceof Error && err.message
          ? err.message
          : "Pas de connexion. Vérifiez votre réseau et réessayez."
      );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const hasTemplate = Boolean(tpl.source);

  return (
    <div className="sheet-backdrop" onClick={() => !importing && onClose()}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          onTemplateChange(tpl);
          onClose();
        }}
      >
        <h2 id="profile-title">Mon entreprise</h2>

        <section className="template-box" aria-labelledby="template-title">
          <h3 id="template-title">Modèle de devis</h3>
          <p className="muted">
            Importez un ancien devis (photo ou PDF) : les nouveaux reprendront ses
            couleurs, ses conditions, sa TVA et vos prix habituels.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importQuote(file);
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <>
                <span className="spinner spinner-sm spinner-dark" aria-hidden /> Lecture du devis…
              </>
            ) : hasTemplate ? (
              "Importer un autre devis"
            ) : (
              "Importer un ancien devis"
            )}
          </button>

          {importError && (
            <div className="alert" role="alert">
              {importError}
            </div>
          )}
          {importNote && (
            <div className="notice notice-info" role="status">
              {importNote}
            </div>
          )}

          {hasTemplate && (
            <div className="template-summary">
              <div className="template-preview" aria-hidden>
                <span
                  className="swatch-head"
                  style={{
                    background: tpl.header_style === "band" ? tpl.primary_color : "#fff",
                    color: tpl.header_style === "band" ? "#fff" : tpl.primary_color,
                    fontFamily: tpl.font === "serif" ? "Georgia, serif" : undefined,
                  }}
                >
                  {tpl.title}
                </span>
                <span className="swatch-row" style={{ background: tpl.accent_color }} />
                <span className="swatch-row" />
                <span className="swatch-row" style={{ background: tpl.accent_color }} />
              </div>
              <ul className="template-facts">
                <li>D&apos;après : {tpl.source}</li>
                <li>
                  {tpl.apply_tva
                    ? `TVA ${Math.round(tpl.tva_rate * 1000) / 10} %`
                    : "Sans TVA"}
                </li>
                <li>
                  {tpl.catalogue.length
                    ? `${tpl.catalogue.length} prix retenus`
                    : "Aucun prix retenu"}
                </li>
              </ul>
            </div>
          )}

          {hasTemplate && (
            <>
              <label className="field">
                <span>Titre du document</span>
                <input
                  value={tpl.title}
                  onChange={(e) => setTpl({ ...tpl, title: e.target.value.toUpperCase() })}
                />
              </label>
              <label className="field">
                <span>Conditions</span>
                <textarea
                  rows={3}
                  value={tpl.conditions}
                  onChange={(e) => setTpl({ ...tpl, conditions: e.target.value })}
                />
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={tpl.apply_tva}
                  onChange={(e) => setTpl({ ...tpl, apply_tva: e.target.checked })}
                />
                <span>TVA par défaut</span>
              </label>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setTpl(DEFAULT_TEMPLATE);
                  onTemplateChange(DEFAULT_TEMPLATE);
                  setImportNote(null);
                }}
              >
                Revenir au modèle standard
              </button>
            </>
          )}
        </section>

        <p className="muted">Ces informations apparaissent en haut de vos devis.</p>
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            {f.multiline ? (
              <textarea
                rows={2}
                placeholder={f.placeholder}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            ) : (
              <input
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={importing}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={importing}>
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
