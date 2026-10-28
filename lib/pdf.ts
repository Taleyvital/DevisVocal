import PDFDocument from "pdfkit";
import {
  formatFCFA,
  formatNumber,
  type ArtisanProfile,
  type QuoteItem,
  type QuoteTotals,
} from "./quote";
import type { QuoteTemplate } from "./template";

export interface QuotePDFInput {
  artisan: ArtisanProfile;
  quoteNumber: string;
  client: string;
  project: string;
  totals: QuoteTotals;
  tvaRate: number;
  template: QuoteTemplate;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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

export async function generateQuotePDF({
  artisan,
  quoteNumber,
  client,
  project,
  totals,
  tvaRate,
  template,
}: QuotePDFInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PRIMARY = template.primary_color;
    const ACCENT = template.accent_color;
    const GRAY = "#666666";
    const serif = template.font === "serif";
    const FONT = serif ? "Times-Roman" : "Helvetica";
    const BOLD = serif ? "Times-Bold" : "Helvetica-Bold";
    const money = (n: number) => formatFCFA(n, template.currency);
    // Header text: white on the color band, or the color on white
    const band = template.header_style === "band";
    const HEADER_TEXT = band ? "white" : PRIMARY;
    const left = 50;
    const pageWidth = doc.page.width - 100; // minus margins
    const bottomLimit = () => doc.page.height - 70;

    // ─── Header ───────────────────────────────────────────────
    if (band) {
      doc.rect(left, 50, pageWidth, 80).fill(PRIMARY);
    } else {
      doc.rect(left, 128, pageWidth, 2).fill(PRIMARY);
    }
    doc
      .fillColor(HEADER_TEXT)
      .fontSize(22)
      .font(BOLD)
      .text(artisan.company_name || artisan.name || "Devis", 60, 65, {
        width: 330,
        ellipsis: true,
        lineBreak: false,
      });
    doc.fontSize(10).font(FONT).fillColor(band ? "white" : "#333333");
    const contactLines = [
      artisan.phone && `Tél : ${artisan.phone}`,
      artisan.email && `Email : ${artisan.email}`,
      artisan.address,
    ].filter(Boolean) as string[];
    contactLines.forEach((line, i) =>
      doc.text(line, 60, 95 + i * 11, { width: 330, ellipsis: true, lineBreak: false })
    );

    doc
      .fillColor(HEADER_TEXT)
      .fontSize(template.title.length > 10 ? 13 : 18)
      .font(BOLD)
      .text(template.title, 330, 65, { width: 215, align: "right", lineBreak: false });
    doc
      .fillColor(band ? "white" : "#333333")
      .fontSize(10)
      .font(FONT)
      .text(`N° ${quoteNumber}`, 400, 90, { width: 145, align: "right" })
      .text(`Date : ${formatDate(new Date())}`, 400, 103, { width: 145, align: "right" });

    // ─── Client / project ─────────────────────────────────────
    doc.fillColor(PRIMARY).fontSize(11).font(BOLD).text("CLIENT", left, 150);
    doc.fillColor("black").fontSize(11).font(FONT).text(client, left + 10);
    if (project) {
      doc.moveDown(0.5);
      doc.fillColor(PRIMARY).font(BOLD).text("OBJET", left);
      doc.fillColor("black").font(FONT).text(project, left + 10, doc.y, {
        width: pageWidth - 10,
      });
    }
    doc.moveDown(1.5);

    // ─── Items table ──────────────────────────────────────────
    const col = {
      designation: { x: left + 4, w: 236 },
      qty: { x: 292, w: 40 },
      unit: { x: 338, w: 40 },
      unitPrice: { x: 380, w: 75 },
      total: { x: 460, w: 81 },
    };

    const drawTableHeader = (y: number) => {
      doc.rect(left, y, pageWidth, 20).fill(PRIMARY);
      doc
        .fillColor("white")
        .fontSize(9)
        .font(BOLD)
        .text("DÉSIGNATION", col.designation.x, y + 6)
        .text("QTÉ", col.qty.x, y + 6, { width: col.qty.w, align: "right" })
        .text("U.", col.unit.x, y + 6)
        .text(`P.U. ${template.currency}`, col.unitPrice.x, y + 6, { width: col.unitPrice.w, align: "right" })
        .text(`TOTAL ${template.currency}`, col.total.x, y + 6, { width: col.total.w, align: "right" });
      return y + 20;
    };

    let rowY = drawTableHeader(doc.y);
    let rowIndex = 0;

    // Start a new page (with the table header again) if `height` doesn't fit
    const ensureSpace = (height: number) => {
      if (rowY + height > bottomLimit()) {
        doc.addPage();
        rowY = drawTableHeader(50);
      }
    };

    const groups = groupBySection(totals.items);
    const showSections = groups.some((g) => g.section);

    for (const group of groups) {
      if (showSections) {
        ensureSpace(20 + 18);
        doc.rect(left, rowY, pageWidth, 20).fill("#d9e3ee");
        doc
          .fillColor(PRIMARY)
          .fontSize(9.5)
          .font(BOLD)
          .text((group.section ?? "Divers").toUpperCase(), col.designation.x, rowY + 6, {
            width: pageWidth - 8,
            lineBreak: false,
            ellipsis: true,
          });
        rowY += 20;
      }

      for (const item of group.items) {
        doc.fontSize(9).font(FONT);
        const textHeight = doc.heightOfString(item.designation, {
          width: col.designation.w,
        });
        const rowHeight = Math.max(18, textHeight + 8);
        ensureSpace(rowHeight);

        doc.rect(left, rowY, pageWidth, rowHeight).fill(rowIndex % 2 ? ACCENT : "white");
        doc
          .fillColor("black")
          .text(item.designation, col.designation.x, rowY + 4, { width: col.designation.w })
          .text(formatNumber(item.quantity), col.qty.x, rowY + 4, {
            width: col.qty.w,
            align: "right",
          })
          .text(item.unit, col.unit.x + 6, rowY + 4, { width: col.unit.w - 6 })
          .text(formatNumber(item.unit_price_fcfa), col.unitPrice.x, rowY + 4, {
            width: col.unitPrice.w,
            align: "right",
          })
          .text(formatNumber(item.total_fcfa), col.total.x, rowY + 4, {
            width: col.total.w,
            align: "right",
          });

        rowY += rowHeight;
        rowIndex++;
      }

      if (showSections && groups.length > 1) {
        const subtotal = group.items.reduce((s, i) => s + i.total_fcfa, 0);
        ensureSpace(18);
        doc
          .fillColor(PRIMARY)
          .fontSize(9)
          .font(BOLD)
          .text(`Sous-total ${group.section ?? "Divers"}`, col.designation.x, rowY + 4, {
            width: 300,
            lineBreak: false,
            ellipsis: true,
          })
          .text(formatNumber(subtotal), col.total.x, rowY + 4, {
            width: col.total.w,
            align: "right",
          });
        rowY += 18;
      }
    }

    // ─── Totals block ─────────────────────────────────────────
    rowY += 10;
    const totalsX = 340;
    const totalsW = pageWidth - (totalsX - left);
    const withTva = tvaRate > 0;
    const totalsRows = withTva
      ? [
          { label: "Total HT", value: money(totals.total_ht) },
          { label: `TVA (${Math.round(tvaRate * 1000) / 10} %)`, value: money(totals.tva) },
          { label: "TOTAL TTC", value: money(totals.total_ttc), bold: true },
        ]
      : [{ label: "TOTAL", value: money(totals.total_ttc), bold: true }];

    ensureSpace(totalsRows.length * 22 + (withTva ? 0 : 16));
    for (const { label, value, bold } of totalsRows) {
      const h = bold ? 22 : 18;
      doc.rect(totalsX, rowY, totalsW, h).fill(bold ? PRIMARY : ACCENT);
      doc
        .fillColor(bold ? "white" : "black")
        .fontSize(bold ? 11 : 9)
        .font(bold ? BOLD : FONT)
        .text(label, totalsX + 6, rowY + (bold ? 6 : 5))
        .text(value, totalsX + 6, rowY + (bold ? 6 : 5), {
          width: totalsW - 12,
          align: "right",
        });
      rowY += h;
    }
    if (!withTva) {
      doc
        .fillColor(GRAY)
        .fontSize(8)
        .font(FONT)
        .text("TVA non applicable", totalsX, rowY + 4, { width: totalsW, align: "right" });
      rowY += 16;
    }

    // ─── Conditions ───────────────────────────────────────────
    const conditions = template.conditions;
    rowY += 20;
    if (conditions) {
      doc.fontSize(8).font(FONT);
      const h = doc.heightOfString(conditions, { width: pageWidth });
      ensureSpace(h);
      doc.fillColor(GRAY).text(conditions, left, rowY, { width: pageWidth });
      rowY += h + 16;
    }

    // ─── Signature boxes ──────────────────────────────────────
    if (template.signature) {
      const boxW = 200;
      ensureSpace(90);
      doc.fontSize(9).font(BOLD).fillColor(PRIMARY);
      doc.text("L'entreprise", left, rowY, { width: boxW });
      doc.text(template.signature, left + pageWidth - boxW, rowY, { width: boxW });
      doc.lineWidth(0.5).strokeColor("#999999");
      doc.rect(left, rowY + 16, boxW, 60).stroke();
      doc.rect(left + pageWidth - boxW, rowY + 16, boxW, 60).stroke();
      rowY += 80;
    }

    // ─── Footer: legal mentions + page numbers on every page ──
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Writing inside the bottom margin would otherwise add a page
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 50;
      doc.fillColor(GRAY).fontSize(7).font(FONT);
      if (artisan.legal) {
        doc.text(artisan.legal.replace(/\s*\n\s*/g, " · "), left, footerY - 6, {
          width: pageWidth - 50,
          height: 20,
          ellipsis: true,
          lineBreak: true,
        });
      }
      if (range.count > 1) {
        doc.text(`${i + 1}/${range.count}`, left + pageWidth - 40, footerY, {
          width: 40,
          align: "right",
          lineBreak: false,
        });
      }
    }

    doc.end();
  });
}
