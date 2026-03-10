'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Clock,
  CheckSquare,
  Package,
  Users,
  FolderOpen,
  BarChart3,
  Settings
} from 'lucide-react'

// Vercel logging function
const logToVercel = (action: string, details: any = {}) => {
  console.log(`[VERCEL_LOG] ${action}:`, details)
  // In production, this will show up in Vercel logs
}

export function MobileNavigation() {
  const { data: session } = useSession()
  const pathname = usePathname()
  
  if (!session) return null

  const userRole = session?.user?.role || 'WORKER'

  const menuItems = [
    {
      name: 'Inicio',
      href: '/dashboard',
      icon: Home,
      roles: ['WORKER', 'SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Trabajo',
      href: '/dashboard/work-logs',
      icon: Clock,
      roles: ['WORKER', 'SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Tareas',
      href: '/dashboard/tasks',
      icon: CheckSquare,
      roles: ['WORKER', 'SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Materiales',
      href: '/dashboard/materials',
      icon: Package,
      roles: ['SUPERVISOR', 'ADMIN', 'SUPERUSER']
    },
    {
      name: 'Usuarios',
      href: '/dashboard/admin/people',
      icon: Users,
      roles: ['ADMIN', 'SUPERUSER']
    },
    {
      name: 'Proyectos',
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
      name: 'SuperUser',
      href: '/dashboard/superuser',
      icon: Settings,
      roles: ['SUPERUSER']
    }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  )

  // Show only the first 4 items for mobile navigation
  const visibleItems = filteredMenuItems.slice(0, 4)

  const handleNavigationClick = (href: string, name: string) => {
    logToVercel('MOBILE_NAVIGATION_CLICKED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      destination: href,
      linkName: name,
      timestamp: new Date().toISOString()
    })
  }

  return (
    <nav className="mobile-nav">
      <div className="flex justify-around">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleNavigationClick(item.href, item.name)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
