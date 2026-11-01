import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "fluent-ffmpeg",
    "@ffmpeg-installer/ffmpeg",
    "pdfkit",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  // Chromium's compressed binaries are read at runtime, not imported
  outputFileTracingIncludes: {
    "/api/quotes": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  async headers() {
    return [
      {
        // Always fetch the latest service worker
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
