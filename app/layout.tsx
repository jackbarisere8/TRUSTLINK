import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1526",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "TrustLink — Turn any deal into a trusted transaction",
    template: "%s | TrustLink",
  },
  description:
    "TrustLink helps Nigerian service providers and clients turn informal agreements into clear, structured, accountable transactions — shareable from anywhere, no app required.",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName: "TrustLink",
    title: "TrustLink — Turn any deal into a trusted transaction",
    description:
      "Structure the deal. Share one link. Work with clarity. TrustLink turns informal Nigerian service agreements into clear, shareable transactions.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-surface-50 text-navy-900 antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
