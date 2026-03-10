'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar, CheckCircle, XCircle } from 'lucide-react'
import { es } from '@/lib/translations/es'
import { useSession } from 'next-auth/react'

// Vercel logging function
const logToVercel = (action: string, details: any = {}) => {
  console.log(`[VERCEL_LOG] ${action}:`, details)
  // In production, this will show up in Vercel logs
}

interface WorkLog {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  status: 'ACTIVE' | 'COMPLETED'
  createdAt: string
  person: {
    id: string
    name: string
  }
  project?: {
    id: string
    name: string
    company: {
      name: string
    }
  }
}

export function RecentWorkLogs() {
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { data: session } = useSession()

  useEffect(() => {
    const fetchRecentWorkLogs = async () => {
      if (!session) return
      
      logToVercel('RECENT_WORKLOGS_FETCH_ATTEMPTED', {
        userId: session.user?.id,
        timestamp: new Date().toISOString()
      })
      
      try {
        setIsLoading(true)
        const response = await fetch('/api/worklog?limit=5')
        if (response.ok) {
          const data = await response.json()
          setWorkLogs(data.workLogs || [])
          
          logToVercel('RECENT_WORKLOGS_FETCH_SUCCESS', {
            userId: session.user?.id,
            worklogCount: data.workLogs?.length || 0,
            timestamp: new Date().toISOString()
          })
        } else {
          logToVercel('RECENT_WORKLOGS_FETCH_FAILED', {
            userId: session.user?.id,
            status: response.status,
            timestamp: new Date().toISOString()
          })
          console.error('Error fetching work logs')
        }
      } catch (error) {
        logToVercel('RECENT_WORKLOGS_FETCH_ERROR', {
          userId: session.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
        console.error('Error fetching work logs:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecentWorkLogs()
  }, [session])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES')
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'En progreso'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  if (isLoading) {
    return (
      <div className="mobile-card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{es.workLogs.recentWorkLogs}</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{es.workLogs.recentWorkLogs}</h2>
      
      <div className="space-y-3">
        {workLogs.length > 0 ? (
          workLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors space-y-2 sm:space-y-0"
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{formatDate(log.startTime)}</div>
                  <div className="text-sm text-gray-500">
                    {formatTime(log.startTime)} - {log.endTime ? formatTime(log.endTime) : 'En progreso'}
                  </div>
                  {log.project && (
                    <div className="text-xs text-gray-400 truncate">
                      {log.project.name}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 flex-shrink-0">
                {log.status === 'COMPLETED' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-xs text-gray-500">
                  {log.status === 'COMPLETED' ? 'Completado' : 'En progreso'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4">
            <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No hay registros recientes</p>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button 
          onClick={() => {
            logToVercel('VIEW_ALL_WORKLOGS_CLICKED', {
              userId: session?.user?.id,
              timestamp: new Date().toISOString()
            })
            window.location.href = '/dashboard/work-logs'
          }}
          className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {es.workLogs.viewAllWorkLogs}
        </button>
      </div>
    </div>
  )
}
