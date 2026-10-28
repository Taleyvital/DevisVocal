import PDFDocument from "pdfkit";
import { formatFCFA, formatNumber, type ArtisanProfile, type QuoteItem } from "./quote";

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function generateQuotePDF(
  artisan: ArtisanProfile,
  quoteNumber: string,
  clientName: string,
  items: QuoteItem[],
  totalHt: number,
  tva: number,
  totalTtc: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const BLUE = "#1a3c5e";
    const LIGHT_BLUE = "#e8f0f8";
    const GRAY = "#666666";
    const pageWidth = doc.page.width - 100; // minus margins

    // ─── Header ───────────────────────────────────────────────
    doc.rect(50, 50, pageWidth, 80).fill(BLUE);
    doc
      .fillColor("white")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(artisan.company_name || artisan.name || "Devis", 60, 65, {
        width: 330,
        ellipsis: true,
      });
    doc.fontSize(10).font("Helvetica");
    const contactLines = [
      artisan.phone && `Tél : ${artisan.phone}`,
      artisan.email && `Email : ${artisan.email}`,
      artisan.address,
    ].filter(Boolean) as string[];
    contactLines.forEach((line, i) =>
      doc.text(line, 60, 95 + i * 13, { width: 330, ellipsis: true })
    );

    // Quote title on right
    doc
      .fillColor("white")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("DEVIS", 400, 65, { width: 145, align: "right" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`N° ${quoteNumber}`, 400, 90, { width: 145, align: "right" })
      .text(`Date : ${formatDate(new Date())}`, 400, 103, {
        width: 145,
        align: "right",
      });

    // ─── Client block ─────────────────────────────────────────
    doc.fillColor(BLUE).fontSize(11).font("Helvetica-Bold").text("CLIENT", 50, 150);
    doc
      .fillColor("black")
      .fontSize(11)
      .font("Helvetica")
      .text(clientName, { indent: 10 });
    doc.moveDown(1.5);

    // ─── Items table header ───────────────────────────────────
    const colX = {
      designation: 50,
      qty: 300,
      unit: 340,
      unitPrice: 390,
      total: 480,
    };
    const tableTop = doc.y;

    doc.rect(50, tableTop, pageWidth, 20).fill(BLUE);
    doc
      .fillColor("white")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("DÉSIGNATION", colX.designation + 2, tableTop + 5)
      .text("QTÉ", colX.qty, tableTop + 5)
      .text("U.", colX.unit, tableTop + 5)
      .text("P.U. FCFA", colX.unitPrice, tableTop + 5)
      .text("TOTAL FCFA", colX.total, tableTop + 5);

    // ─── Items rows ───────────────────────────────────────────
    let rowY = tableTop + 20;

    items.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? "white" : LIGHT_BLUE;
      const rowHeight = 18;
      doc.rect(50, rowY, pageWidth, rowHeight).fill(bg);

      doc
        .fillColor("black")
        .fontSize(9)
        .font("Helvetica")
        .text(item.designation, colX.designation + 2, rowY + 4, {
          width: 240,
          ellipsis: true,
        })
        .text(formatNumber(item.quantity), colX.qty, rowY + 4, { width: 35, align: "right" })
        .text(item.unit, colX.unit, rowY + 4)
        .text(formatNumber(item.unit_price_fcfa), colX.unitPrice, rowY + 4, {
          width: 85,
          align: "right",
        })
        .text(formatNumber(item.total_fcfa), colX.total, rowY + 4, {
          width: 65,
          align: "right",
        });

      rowY += rowHeight;
    });

    // ─── Totals block ─────────────────────────────────────────
    rowY += 10;
    const totalsX = 380;
    const totalsW = pageWidth - (totalsX - 50);

    const totalsRows = [
      { label: "Total HT", value: formatFCFA(totalHt) },
      { label: "TVA (18%)", value: formatFCFA(tva) },
      { label: "TOTAL TTC", value: formatFCFA(totalTtc), bold: true },
    ];

    totalsRows.forEach(({ label, value, bold }) => {
      if (bold) {
        doc.rect(totalsX, rowY, totalsW, 22).fill(BLUE);
        doc
          .fillColor("white")
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(label, totalsX + 4, rowY + 5)
          .text(value, totalsX + 4, rowY + 5, { width: totalsW - 8, align: "right" });
        rowY += 22;
      } else {
        doc.rect(totalsX, rowY, totalsW, 18).fill(LIGHT_BLUE);
        doc
          .fillColor("black")
          .fontSize(9)
          .font("Helvetica")
          .text(label, totalsX + 4, rowY + 4)
          .text(value, totalsX + 4, rowY + 4, { width: totalsW - 8, align: "right" });
        rowY += 18;
      }
    });

    // ─── Footer mentions ──────────────────────────────────────
    rowY += 20;
    doc
      .fillColor(GRAY)
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Devis valable 30 jours à compter de sa date d'émission. " +
          "Un acompte de 30% est demandé à la commande. " +
          "En cas d'accord, veuillez retourner ce devis signé avec la mention « Bon pour accord ».",
        50,
        rowY,
        { width: pageWidth }
      );

    doc.end();
  });
}
