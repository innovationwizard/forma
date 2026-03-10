import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Toaster } from '@/components/ui/Toaster'
import { TenantProvider } from '@/contexts/TenantContext'
import { getTenantSlug } from '@/lib/db-tenant'
import PWAServiceWorker from '@/components/PWAServiceWorker'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://forma.app'),
  title: 'Forma - Gestión de Productividad en Construcción',
  description: 'Plataforma integral de gestión de productividad para el sector de la construcción, con seguimiento de tiempo, gestión de usuarios y colaboración en tiempo real.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  keywords: ['construcción', 'productividad', 'gestión', 'proyectos', 'seguimiento de tiempo', 'Forma', 'PWA', 'app'],
  authors: [{ name: 'Forma' }],
  applicationName: 'Forma',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Forma',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Forma - Gestión de Productividad en Construcción',
    description: 'Plataforma integral de gestión de productividad para el sector de la construcción, con seguimiento de tiempo, gestión de usuarios y colaboración en tiempo real.',
    url: 'https://forma.app',
    siteName: 'Forma',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Forma',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forma - Gestión de Productividad en Construcción',
    description: 'Plataforma integral de gestión de productividad para el sector de la construcción, con seguimiento de tiempo, gestión de usuarios y colaboración en tiempo real.',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  userScalable: true,
  minimumScale: 1,
}

// Force dynamic rendering to prevent static generation issues in Next.js 15
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
        <PWAServiceWorker />
        <PWAInstallPrompt />
      </body>
    </html>
  )
}
