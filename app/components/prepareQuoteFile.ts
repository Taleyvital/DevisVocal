"use client";

// Turns an uploaded old quote (photo or PDF) into small JPEG pages
// (+ the PDF text layer) for /api/template.

const MAX_SIDE = 1600;
const MAX_PDF_PAGES = 2;

export interface PreparedQuote {
  pages: Blob[];
  text: string;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.82
    )
  );
}

async function imageToJpeg(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Format d'image non pris en charge. Faites une capture d'écran du devis et réessayez."
    );
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs would turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToJpeg(canvas);
}

async function pdfToPages(file: File): Promise<PreparedQuote> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  }).promise;

  const pages: Blob[] = [];
  const texts: string[] = [];
  try {
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: MAX_SIDE / Math.max(base.width, base.height),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      pages.push(await canvasToJpeg(canvas));

      const content = await page.getTextContent();
      texts.push(
        content.items.map((i) => ("str" in i ? i.str : "")).join(" ")
      );
    }
  } finally {
    await pdf.destroy();
  }
  return { pages, text: texts.join("\n\n").replace(/\s+/g, " ").trim() };
}

export async function prepareQuoteFile(file: File): Promise<PreparedQuote> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    try {
      return await pdfToPages(file);
    } catch (err) {
      console.error("[import] pdf error:", err);
      throw new Error("Impossible de lire ce PDF. Essayez avec une photo du devis.");
    }
  }
  if (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) {
    return { pages: [await imageToJpeg(file)], text: "" };
  }
  throw new Error("Choisissez une photo ou un PDF de votre ancien devis.");
}
