import type { Browser } from "puppeteer-core";

// Renders a (sanitized) quote HTML document to an A4 PDF with headless Chromium.
// On Vercel: @sparticuz/chromium. Locally: the installed Chrome, or CHROME_PATH.

const LOCAL_CHROME =
  process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome";

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setGraphicsMode = false;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || LOCAL_CHROME,
    headless: true,
  });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    // The layout comes from a model reading a user image: no scripts, no network
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url === "about:blank") req.continue();
      else req.abort();
    });
    await page.setContent(html, { waitUntil: "load", timeout: 15_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 15_000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
