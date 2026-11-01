"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderQuoteHtml } from "@/lib/html-template";
import { computeTotals, type ArtisanProfile } from "@/lib/quote";
import type { QuoteTemplate } from "@/lib/template";

const A4_WIDTH = 794; // px at 96 dpi
const A4_HEIGHT = 1123;

const SAMPLE_ITEMS = [
  { section: "Gros œuvre", designation: "Agglos de 15", quantity: 500, unit: "u", unit_price_fcfa: 450 },
  { section: "Gros œuvre", designation: "Ciment CPJ 45", quantity: 10, unit: "sac", unit_price_fcfa: 5500 },
  { section: "Finitions", designation: "Carrelage 60x60 (fourniture et pose)", quantity: 20, unit: "m2", unit_price_fcfa: 12500 },
];

// Miniature of a sample quote in the learned layout. Sandboxed iframe:
// no scripts, no same-origin access; the document also carries a strict CSP.
export function LayoutPreview({
  template,
  profile,
}: {
  template: QuoteTemplate;
  profile: ArtisanProfile;
}) {
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

  const html = useMemo(() => {
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

  if (!html) return null;

  return (
    <div ref={boxRef} className="layout-preview" style={{ height: A4_HEIGHT * scale * 0.62 }}>
      <iframe
        title="Aperçu de votre modèle de devis"
        sandbox=""
        srcDoc={html}
        tabIndex={-1}
        style={{
          width: A4_WIDTH,
          height: A4_HEIGHT,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
