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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FORMA — Santa Elena",
    template: "%s · FORMA Santa Elena",
  },
  description:
    "Seguimiento presupuestal del Condominio Santa Elena — FORMA Capital Inmobiliario, Antigua Guatemala.",
  applicationName: "FORMA — Santa Elena",
  authors: [{ name: "FORMA Capital Inmobiliario" }],
  creator: "FORMA Capital Inmobiliario",
  publisher: "FORMA Capital Inmobiliario",
  // App Router auto-discovers src/app/icon.svg + apple-icon.png + favicon.ico.
  // Explicit `themeColor` paints the browser chrome / iOS status bar in the
  // brand navy when the app is added to home screen.
  openGraph: {
    type: "website",
    locale: "es_GT",
    url: SITE_URL,
    siteName: "FORMA — Santa Elena",
    title: "FORMA — Santa Elena",
    description:
      "Seguimiento presupuestal del Condominio Santa Elena — FORMA Capital Inmobiliario, Antigua Guatemala.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FORMA — Santa Elena",
    description:
      "Seguimiento presupuestal del Condominio Santa Elena — FORMA Capital Inmobiliario.",
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
