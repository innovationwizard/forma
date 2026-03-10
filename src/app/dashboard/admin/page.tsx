'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Settings, BarChart3 } from 'lucide-react'

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()

  // Check if user is admin
  if (session?.user?.role !== 'ADMIN') {
    router.push('/dashboard')
    return null
  }

  const adminFeatures = [
    {
      title: 'Gestión de Usuarios',
      description: 'Crear, editar y eliminar usuarios del sistema',
      icon: Users,
      href: '/dashboard/admin/people',
      color: 'bg-blue-500',
    },
    {
      title: 'Configuración del Sistema',
      description: 'Configurar parámetros generales del sistema',
      icon: Settings,
      href: '/dashboard/admin/settings',
      color: 'bg-purple-500',
    },
    {
      title: 'Reportes Avanzados',
      description: 'Reportes detallados y análisis de datos',
      icon: BarChart3,
      href: '/dashboard/admin/reports',
      color: 'bg-orange-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600">Gestionar el sistema y usuarios</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {adminFeatures.map((feature) => {
          const IconComponent = feature.icon
          return (
            <div
              key={feature.title}
              className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(feature.href)}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-lg ${feature.color}`}>
                  <IconComponent className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acceso Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/dashboard/admin/people')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Gestión de Usuarios</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/admin/settings')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings className="h-5 w-5 text-purple-600" />
            <span className="font-medium">Configuración</span>
          </button>
        </div>
      </div>
    </div>
  )
}
