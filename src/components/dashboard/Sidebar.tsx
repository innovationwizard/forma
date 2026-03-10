'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useWorkStore, workStore } from '@/stores/workStore'
import {
  Home,
  Clock,
  Users,
  FolderOpen,
  Building,
  Settings,
  LogOut,
  CheckSquare,
  Package,
  BarChart3,
  Menu,
  X
} from 'lucide-react'

// Vercel logging function
const logToVercel = (action: string, details: any = {}) => {
  console.log(`[VERCEL_LOG] ${action}:`, details)
  // In production, this will show up in Vercel logs
}

interface SidebarProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const { data: session, status } = useSession()
  const wl = useWorkStore((s) => s.currentWorkLog);
  const isClockedIn = !!wl && wl.clockOut === null;
  const pathname = usePathname()
  const router = useRouter()
  
  if (status === 'loading') {
    return (
      <div className="hidden md:flex w-64 bg-white text-gray-900 h-full flex-col border-r border-gray-200">
        <div className="p-4">Cargando...</div>
      </div>
    )
  }
  
  if (status === 'unauthenticated') {
    return null
  }

  const userRole = session?.user?.role || 'WORKER'

  const handleLogout = async () => {
    logToVercel('LOGOUT_ATTEMPTED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
    
    await signOut({ redirect: false })
    router.push('/')
    
    logToVercel('LOGOUT_SUCCESS', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
  }

  const handleMobileClose = () => {
    logToVercel('MOBILE_SIDEBAR_CLOSED', {
      userId: session?.user?.id,
      timestamp: new Date().toISOString()
    })
    
    if (onMobileClose) {
      onMobileClose()
    }
  }

  const handleLinkClick = (href: string, name: string) => {
    logToVercel('SIDEBAR_NAVIGATION_CLICKED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      destination: href,
      linkName: name,
      timestamp: new Date().toISOString()
    })
    
    if (onMobileClose) {
      onMobileClose()
    }
  }

  const menuItems = [
    {
      name: 'Panel Principal',
      href: '/dashboard',
      icon: Home,
      roles: ['WORKER', 'SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Registros de Trabajo',
      href: '/dashboard/work-logs',
      icon: Clock,
      roles: ['WORKER', 'SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Gestión de Tareas',
      href: '/dashboard/tasks',
      icon: CheckSquare,
      roles: ['WORKER', 'SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Gestión de Materiales',
      href: '/dashboard/materials',
      icon: Package,
      roles: ['SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Gestión de Usuarios',
      href: '/dashboard/admin/people',
      icon: Users,
      roles: ['ADMIN', 'SUPERUSER']
    },
    {
      name: 'Gestión de Proyectos',
      href: '/dashboard/projects',
      icon: FolderOpen,
      roles: ['SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Análisis',
      href: '/dashboard/analysis',
      icon: BarChart3,
      roles: ['SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'SuperUser Dashboard',
      href: '/dashboard/superuser',
      icon: Settings,
      roles: ['SUPERUSER']
    }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  )

  return (
    <>
      {/* Mobile Sidebar */}
      <div className={`sidebar-mobile md:hidden ${isMobileOpen ? 'open' : ''}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Forma</h1>
          <button
            onClick={handleMobileClose}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-600 font-medium">{session?.user?.name}</p>
          <p className="text-xs text-gray-500">{userRole}</p>
          
          {/* Active Shift Indicator - Mobile */}
          {isClockedIn && wl && (
            <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-green-600" />
                <div className="text-xs">
                  <div className="font-medium text-green-800">Turno Activo</div>
                  <div className="text-green-600">
                    Desde: {wl.clockIn && new Date(wl.clockIn).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => handleLinkClick(item.href, item.name)}
                    className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-white text-gray-900 h-full flex-col border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Forma</h1>
          <p className="text-sm text-gray-600">{session?.user?.name}</p>
          <p className="text-xs text-gray-500">{userRole}</p>
          
          {/* Active Shift Indicator */}
          {isClockedIn && wl && (
            <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-green-600" />
                <div className="text-xs">
                  <div className="font-medium text-green-800">Turno Activo</div>
                  <div className="text-green-600">
                    Desde: {wl.clockIn && new Date(wl.clockIn).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => handleLinkClick(item.href, item.name)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </>
  )
}