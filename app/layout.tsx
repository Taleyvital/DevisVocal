import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Doto } from "next/font/google";
import { RegisterServiceWorker } from "./components/RegisterServiceWorker";

// Dot-matrix digits for timers and totals
const doto = Doto({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-doto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevisVocal",
  description: "Dictez vos devis, partagez-les sur WhatsApp.",
  appleWebApp: { capable: true, title: "DevisVocal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ececea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={doto.variable}>
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
