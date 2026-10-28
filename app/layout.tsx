import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Doto, Poppins } from "next/font/google";
import { RegisterServiceWorker } from "./components/RegisterServiceWorker";
import { Splash } from "./components/Splash";

// Dot-matrix digits for timers and totals
const doto = Doto({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-doto",
  display: "swap",
});

// Heavy geometric face for the DEVISVOCAL wordmark (splash only)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-brand",
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
    <html lang="fr" className={`${doto.variable} ${poppins.variable}`}>
      <body>
        <Splash />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
