'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HardHat } from 'lucide-react'
import { es } from '@/lib/translations/es'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Don't automatically clear session - let the user stay logged in if they are
    // Only redirect if they're already authenticated
    if (status === 'authenticated' && session) {
      console.log('User already authenticated, redirecting:', session.user?.role)
      
      // Add a small delay to ensure session is fully established
      setTimeout(() => {
        // Check if it's a superuser and redirect accordingly
        if (session.user?.role === 'SUPERUSER') {
          console.log('Superuser detected, redirecting to superuser dashboard')
          router.push('/dashboard/superuser')
        } else {
          router.push('/dashboard')
        }
      }, 100)
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (session) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      console.log('Attempting login with:', email)
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      console.log('Login result:', result)

      if (result?.error) {
        console.error('Login error:', result.error)
        alert(es.auth.invalidCredentials)
      } else {
        console.log('Login successful, waiting for session...')
        // Don't redirect here - let the useEffect handle it after session is established
      }
    } catch (error) {
      console.error('Login error:', error)
      alert(es.auth.loginError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="pt-8 pb-4">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700">
            <span className="text-md font-light">← Volver al Inicio</span>
          </Link>
        </div>

        <div className="pt-8 pb-8 text-center lg:pt-12">
          <div className="flex justify-center mb-4">
            <HardHat className="h-24 w-24 text-yellow-500 sm:h-40 sm:w-40" />
          </div>
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-medium tracking-tight text-slate-900 sm:text-7xl">
            <span className="text-blue-600">Forma</span>
            <br />
            <span className="text-black-400 text-4xl">Iniciar Sesión</span>
          </h1>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white/80 backdrop-blur-sm py-8 px-6 shadow-xl rounded-2xl border border-white/20">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    {es.auth.email}
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="email@empresa.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                    {es.auth.password}
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Contraseña"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? es.auth.signingIn : es.auth.signIn}
                  </button>
                </div>
              </form>

              {/* <div className="mt-6">
                <div className="text-xs text-slate-500 space-y-1">
                  <div><strong>Demo:</strong> worker@demo.com / password123</div>
                </div>
              </div> */}

              <div className="mt-6 text-center">
                <Link
                  href="/auth/login/admin/reset-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Crear Empresa - hidden for single tenant */}
              {/* <div className="mt-4 text-center">
                <p className="text-sm text-slate-600">
                  ¿No tienes una cuenta? <br />
                  <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-700">
                    Crear Empresa
                  </Link>
                </p>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
