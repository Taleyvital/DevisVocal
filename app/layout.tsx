import "./globals.css";
import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "./components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "DevisVocal",
  description: "Dictez vos devis, partagez-les sur WhatsApp.",
  appleWebApp: { capable: true, title: "DevisVocal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a3c5e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
