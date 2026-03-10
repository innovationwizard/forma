'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function DemoDashboardPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-login with demo credentials
    const loginDemo = async () => {
      try {
        const result = await signIn('credentials', {
          email: 'worker@demo.com',
          password: 'password123',
          redirect: false,
        })

        if (result?.ok) {
          router.push('/dashboard')
        } else {
          // If auto-login fails, redirect to login page
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Demo login error:', error)
        router.push('/auth/login')
      }
    }

    loginDemo()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Cargando Demo...
        </h2>
        <p className="text-gray-600">
          Iniciando sesión con credenciales de demostración
        </p>
      </div>
    </div>
  )
} 