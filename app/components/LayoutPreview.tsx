"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderQuoteHtml } from "@/lib/html-template";
import { computeTotals, type ArtisanProfile } from "@/lib/quote";
import type { QuoteTemplate } from "@/lib/template";
import { CloseIcon } from "./icons";

const A4_WIDTH = 794; // px at 96 dpi
const A4_HEIGHT = 1123;

const SAMPLE_ITEMS = [
  { section: "Gros œuvre", designation: "Agglos de 15", quantity: 500, unit: "u", unit_price_fcfa: 450 },
  { section: "Gros œuvre", designation: "Ciment CPJ 45", quantity: 10, unit: "sac", unit_price_fcfa: 5500 },
  { section: "Finitions", designation: "Carrelage 60x60 (fourniture et pose)", quantity: 20, unit: "m2", unit_price_fcfa: 12500 },
];

// ─── First page of the imported quote, kept on the device only ──
const ORIGINAL_KEY = "devisvocal.template-original";

export function saveOriginalPage(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(ORIGINAL_KEY, dataUrl);
    else localStorage.removeItem(ORIGINAL_KEY);
  } catch {
    // quota or private mode: the viewer just won't show the original
  }
}

function loadOriginalPage(): string | null {
  try {
    return localStorage.getItem(ORIGINAL_KEY);
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// A sample quote rendered in the learned layout
function useSampleHtml(template: QuoteTemplate, profile: ArtisanProfile) {
  return useMemo(() => {
    if (!template.layout) return "";
    const tvaRate = template.apply_tva ? template.tva_rate : 0;
    return renderQuoteHtml({
      layout: template.layout,
      artisan: { ...profile, company_name: profile.company_name || "Votre entreprise" },
      title: template.title,
      quoteNumber: "DEV-2026-0001",
      client: "M. Konan",
      project: "Construction villa, Bingerville",
      conditions: template.conditions,
      currency: template.currency,
      totals: computeTotals(SAMPLE_ITEMS, tvaRate),
      tvaRate,
    });
  }, [template, profile]);
}

// A4 page in a sandboxed, script-free iframe, scaled to its container width.
// The document also carries a strict CSP.
function A4Frame({ html, crop = 1 }: { html: string; crop?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(box.clientWidth / A4_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="a4-frame" style={{ height: A4_HEIGHT * scale * crop }}>
      <iframe
        title="Votre modèle de devis en HTML"
        sandbox=""
        srcDoc={html}
        tabIndex={-1}
        style={{ width: A4_WIDTH, height: A4_HEIGHT, transform: `scale(${scale})` }}
      />
    </div>
  );
}

export function LayoutPreview({
  template,
  profile,
}: {
  template: QuoteTemplate;
  profile: ArtisanProfile;
}) {
  const html = useSampleHtml(template, profile);
  const [open, setOpen] = useState(false);
  if (!html) return null;

  return (
    <>
      <button
        type="button"
        className="layout-preview"
        onClick={() => setOpen(true)}
        aria-label="Voir la version HTML en grand"
      >
        <A4Frame html={html} crop={0.62} />
        <span className="layout-preview-cta">Voir en grand</span>
      </button>
      {open && (
        <LayoutViewer html={html} template={template} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

type Tab = "html" | "original" | "code";

function LayoutViewer({
  html,
  template,
  onClose,
}: {
  html: string;
  template: QuoteTemplate;
  onClose: () => void;
}) {
  const [original] = useState(loadOriginalPage);
  const [tab, setTab] = useState<Tab>("html");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const layout = template.layout!;
  const code = [
    "<!-- Gabarit -->",
    layout.html,
    "",
    "<!-- Ligne d'article -->",
    layout.item_row,
    ...(layout.section_row ? ["", "<!-- Ligne de section -->", layout.section_row] : []),
  ]
    .join("\n")
    // The model writes minified HTML/CSS: one rule / one tag per line to read it
    .replace(/\}(?=\S)/g, "}\n")
    .replace(/>\s*</g, ">\n<");

  const tabs: { key: Tab; label: string }[] = [
    { key: "original", label: "Original" },
    { key: "html", label: "HTML" },
    { key: "code", label: "Code" },
  ];

  return (
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Version HTML de votre ancien devis"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="viewer-bar">
        <div className="viewer-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className="viewer-tab"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button ref={closeRef} type="button" className="viewer-close" onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>
      </header>

      <div className="viewer-body" role="tabpanel">
        {tab === "html" && <A4Frame html={html} />}

        {tab === "original" &&
          (original ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="viewer-original" src={original} alt={`Ancien devis : ${template.source}`} />
          ) : (
            <p className="viewer-empty">
              L&apos;original n&apos;est plus disponible sur ce téléphone. Réimportez le devis pour
              le comparer.
            </p>
          ))}

        {tab === "code" && (
          <div className="viewer-code">
            <div className="viewer-code-bar">
              <span>Gabarit généré depuis {template.source}</span>
            <button
              type="button"
              className="btn btn-ink btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copié ✓" : "Copier"}
            </button>
            </div>
            <pre>
              <code>{code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
