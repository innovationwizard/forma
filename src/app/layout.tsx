import type { Metadata } from "next";
import { Archivo, Montserrat } from "next/font/google";
import "./globals.css";

// Body face per brand manual ("Tipografía para textos: Montserrat").
const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Heading face — Archivo as a free-font substitute for Archia, which is
// the brand manual's titles face but ships under a paid license. Archivo
// shares the geometric character + open apertures Archia uses; if/when
// licensed Archia .woff2 files are dropped into public/fonts/, swap to
// next/font/local. See PROGRESS.md "Brand implementation" entry.
const archivo = Archivo({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const SITE_URL =
  process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://forma-santa-elena.vercel.app";

// Title + descriptive strings here are limited to SSOT-faithful tokens only:
//   - "FORMA Capital Inmobiliario" — verbatim from Manual de Marca_Forma.pdf
//   - "Santa Elena" — project name per [[project_naming_truth]]
// No marketing copy is authored without Jorge's sign-off. Per _THE_RULES.MD
// Rule 1 (no fabrications) + Rule 5 (no placeholders).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Santa Elena — FORMA Capital Inmobiliario",
    template: "%s · Santa Elena",
  },
  applicationName: "Santa Elena",
  authors: [{ name: "FORMA Capital Inmobiliario" }],
  creator: "FORMA Capital Inmobiliario",
  publisher: "FORMA Capital Inmobiliario",
  openGraph: {
    type: "website",
    locale: "es_GT",
    url: SITE_URL,
    siteName: "Santa Elena — FORMA Capital Inmobiliario",
    title: "Santa Elena — FORMA Capital Inmobiliario",
  },
  twitter: {
    card: "summary_large_image",
    title: "Santa Elena — FORMA Capital Inmobiliario",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const viewport = {
  themeColor: "#0c2530",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
