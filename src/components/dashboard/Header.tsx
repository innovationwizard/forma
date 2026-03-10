'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Clock, User, LogOut, Menu } from 'lucide-react'
import { es } from '@/lib/translations/es'

// Vercel logging function
const logToVercel = (action: string, details: any = {}) => {
  console.log(`[VERCEL_LOG] ${action}:`, details)
  // In production, this will show up in Vercel logs
}

interface HeaderProps {
  onMobileMenuClick?: () => void
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()

  const handleLogout = async () => {
    logToVercel('HEADER_LOGOUT_ATTEMPTED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
    
    await signOut({ redirect: false })
    router.push('/')
    
    logToVercel('HEADER_LOGOUT_SUCCESS', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
  }

  const handleMobileMenuClick = () => {
    logToVercel('MOBILE_MENU_BUTTON_CLICKED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
    
    if (onMobileMenuClick) {
      onMobileMenuClick()
    }
  }

  return (
    <header className="md:hidden bg-white shadow-sm border-b sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12 md:h-14">
          {/* Mobile menu button */}
          <div className="flex items-center">
            <button
              onClick={handleMobileMenuClick}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 mr-2"
            >
              <Menu className="h-6 w-6 text-gray-600" />
            </button>
            
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Forma
              </h1>
            </div>
          </div>
          
          {/* Desktop user info and logout */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-700">
                {session?.user?.name}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>{es.auth.logout}</span>
            </button>
          </div>

          {/* Mobile user info */}
          <div className="md:hidden flex items-center space-x-2">
            <User className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-700 truncate max-w-32">
              {session?.user?.name}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
