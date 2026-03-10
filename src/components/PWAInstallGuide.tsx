'use client'

import { useState } from 'react'
import { Smartphone, Monitor, Download, X, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PWAInstallGuide() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPlatform, setCurrentPlatform] = useState<string>('')

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'ios'
    } else if (/android/.test(userAgent)) {
      return 'android'
    } else if (/chrome/.test(userAgent)) {
      return 'chrome'
    } else if (/firefox/.test(userAgent)) {
      return 'firefox'
    } else if (/safari/.test(userAgent)) {
      return 'safari'
    } else if (/edge/.test(userAgent)) {
      return 'edge'
    }
    return 'desktop'
  }

  const getInstallSteps = (platform: string) => {
    switch (platform) {
      case 'ios':
        return [
          'Toca el botón compartir (📤) en Safari',
          'Desplázate hacia abajo y toca "Añadir a pantalla de inicio"',
          'Toca "Añadir" para confirmar',
          'La aplicación aparecerá en tu pantalla de inicio'
        ]
      case 'android':
        return [
          'Toca el menú de tres puntos (⋮) en Chrome',
          'Selecciona "Instalar aplicación" o "Añadir a pantalla de inicio"',
          'Toca "Instalar" para confirmar',
          'La aplicación se instalará en tu dispositivo'
        ]
      case 'chrome':
        return [
          'Busca el icono de instalación (⬇️) en la barra de direcciones',
          'Toca el icono para abrir el menú de instalación',
          'Toca "Instalar" para confirmar',
          'La aplicación se instalará en tu computadora'
        ]
      case 'firefox':
        return [
          'Toca el icono de instalación (🏠) en la barra de direcciones',
          'Selecciona "Instalar Forma"',
          'Toca "Instalar" para confirmar',
          'La aplicación se instalará en tu computadora'
        ]
      case 'edge':
        return [
          'Busca el icono de instalación (⬇️) en la barra de direcciones',
          'Toca el icono para abrir el menú de instalación',
          'Toca "Instalar" para confirmar',
          'La aplicación se instalará en tu computadora'
        ]
      default:
        return [
          'Usa Chrome, Firefox, Edge o Safari',
          'Busca el icono de instalación en la barra de direcciones',
          'Sigue las instrucciones específicas de tu navegador',
          'La aplicación se instalará en tu dispositivo'
        ]
    }
  }

  const handleOpen = () => {
    setCurrentPlatform(detectPlatform())
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <Button
        onClick={handleOpen}
        variant="outline"
        size="sm"
        className="text-blue-600 border-blue-600 hover:bg-blue-50"
      >
        <Smartphone className="h-4 w-4 mr-2" />
        Guía de Instalación
      </Button>
    )
  }

  const steps = getInstallSteps(currentPlatform)
  const platformNames = {
    ios: 'iOS (iPhone/iPad)',
    android: 'Android',
    chrome: 'Chrome',
    firefox: 'Firefox',
    edge: 'Edge',
    safari: 'Safari',
    desktop: 'Computadora'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Smartphone className="h-5 w-5 mr-2 text-blue-600" />
              Instalar Forma
            </h2>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Detectamos que estás usando: <strong>{platformNames[currentPlatform as keyof typeof platformNames]}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Sigue estos pasos para instalar Forma como aplicación:
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <p className="text-sm text-gray-700">{step}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              Beneficios de la instalación
            </h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Acceso rápido desde la pantalla de inicio</li>
              <li>• Funciona sin conexión a internet</li>
              <li>• Experiencia como aplicación nativa</li>
              <li>• Notificaciones push</li>
              <li>• Mejor rendimiento</li>
            </ul>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
              Entendido
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
