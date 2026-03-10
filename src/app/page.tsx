'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { HardHat } from 'lucide-react'

export default function LandingPage() {
  const { data: session, status } = useSession()

  const handleClearSession = () => {
    signOut({ redirect: false })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {session && (
          <div className="pt-4 text-center">
            <div className="inline-flex items-center space-x-2 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded">
              <span className="text-sm">
                Sesión activa: {session.user?.name} ({session.user?.role})
              </span>
              <button
                onClick={handleClearSession}
                className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}
        
        <div className="pt-20 pb-16 text-center lg:pt-32">
          <div className="flex justify-center mb-4">
            <HardHat className="h-24 w-24 text-yellow-500 sm:h-40 sm:w-40" />
          </div>
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-medium tracking-tight text-slate-900 sm:text-7xl">
            <span className="text-blue-600">Forma</span>
            <br />
            <span className="text-black-400 text-4xl">Gestión de Productividad en Construcción</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-slate-700">
            Controla la productividad de tus trabajadores, gestiona materiales y 
            automatiza reportes para cobrar más rápido.
          </p>
          <div className="mt-10 flex justify-center gap-x-6">
            {/* Crear Empresa - hidden for single tenant */}
            {/* <Link
              href="/signup"
              className="group inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500"
            >
              Crear Empresa
            </Link> */}
            <Link
              href="/auth/login"
              className="group inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
            >
              Iniciar Sesión
            </Link>
            {/* <Link
                              href="/empresa-ejemplo/dashboard"
              className="group inline-flex ring-1 items-center justify-center rounded-full py-2 px-4 text-sm ring-slate-200 text-slate-700 hover:text-slate-900"
            >
              Ver Demo
            </Link> */}
          </div>
        </div>
      </div>
    </div>
  )
}