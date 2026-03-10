'use client'

import { useState, useEffect } from 'react'
import { Smartphone, Download, CheckCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PWAInstallGuide from './PWAInstallGuide'

export default function PWAStatus() {
  const [isPWA, setIsPWA] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [canInstall, setCanInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Check if running as PWA
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true
      setIsPWA(isStandalone)
    }

    // Check online status
    const checkOnline = () => {
      setIsOnline(navigator.onLine)
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }

    checkPWA()
    checkOnline()

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('online', checkOnline)
    window.addEventListener('offline', checkOnline)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('online', checkOnline)
      window.removeEventListener('offline', checkOnline)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
      setCanInstall(false)
    } else {
      console.log('User dismissed the install prompt')
    }

    setDeferredPrompt(null)
  }

  if (isPWA) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <h3 className="text-sm font-medium text-green-800">
              Aplicación Instalada
            </h3>
            <p className="text-sm text-green-700">
              Forma está funcionando como aplicación nativa
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Instalar Forma
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            Para una mejor experiencia, instala Forma como aplicación en tu dispositivo
          </p>
          
                      <div className="space-y-2">
              {canInstall && (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Instalar Ahora
                </Button>
              )}
              
              <div className="flex space-x-2">
                <PWAInstallGuide />
                {!canInstall && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Ver Instrucciones
                  </Button>
                )}
              </div>
            </div>
        </div>
      </div>
    </div>
  )
}
