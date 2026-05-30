import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tessera — seamless photo collages",
  description:
    "Arrange dozens of event photos into seamless, borderless collages tuned for LinkedIn. Reorder by hand or with AI, add text, export in any ratio.",
};

export const viewport: Viewport = {
  themeColor: "#F4F1EA",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
