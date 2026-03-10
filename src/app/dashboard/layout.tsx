'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'
import { MobileNavigation } from '@/components/dashboard/MobileNavigation'


export default function DashboardLayout({ children, }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
  }, [session, status])

  useEffect(() => {
    // Only redirect if we're sure the user is not authenticated
    // AND we're not in a loading state
    if (status === 'unauthenticated' && !session) {
      console.log('Dashboard Layout - Unauthenticated, redirecting to login')
      router.push('/auth/login')
    }
  }, [status, session, router])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [router])

  // Show loading while checking authentication
  if (status === 'loading') {
    console.log('Dashboard Layout - Loading...')
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Don't render anything if not authenticated (will redirect)
  if (status === 'unauthenticated' || !session) {
    console.log('Dashboard Layout - Unauthenticated or no session, not rendering')
    return null
  }

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false)
  }

  console.log('Dashboard Layout - Rendering dashboard with session:', session.user?.name)
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <Header onMobileMenuClick={handleMobileMenuToggle} />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="sidebar-overlay md:hidden"
          onClick={handleMobileMenuClose}
        />
      )}
      
      {/* Sidebar */}
      <Sidebar 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={handleMobileMenuClose}
      />
      
      {/* Main Content */}
      <main className="md:ml-64 min-h-screen-safe pb-20 md:pb-0">
        <div className="pt-2 md:pt-4 px-4 md:px-6 pb-4 md:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNavigation />
    </div>
  )
}