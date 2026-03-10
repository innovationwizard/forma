'use client'

import { useState, useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { Building2, ChevronDown } from 'lucide-react'
import { es } from '@/lib/translations/es'
import { useSession } from 'next-auth/react'

// Vercel logging function
const logToVercel = (action: string, details: any = {}) => {
  console.log(`[VERCEL_LOG] ${action}:`, details)
  // In production, this will show up in Vercel logs
}

interface Project {
  id: string
  name: string
  description: string
  company: {
    id: string
    name: string
  }
  createdAt: string
}

export function ProjectSelector() {
  const { projects, currentProject, setProjects, setCurrentProject } = useProjectStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const { data: session } = useSession()

  useEffect(() => {
    const fetchProjects = async () => {
      if (!session?.user?.id) return
      
      // Prevent duplicate calls if projects already exist or if we fetched recently
      const now = Date.now()
      if (projects.length > 0 || (now - lastFetchTime) < 5000) { // 5 second rate limit
        setIsLoading(false)
        return
      }
      
      setLastFetchTime(now)
      
      logToVercel('PROJECTS_FETCH_ATTEMPTED', {
        userId: session.user?.id,
        timestamp: new Date().toISOString()
      })
      
      try {
        setIsLoading(true)
        const response = await fetch('/api/projects')
        if (response.ok) {
          const data = await response.json()
          setProjects(data.projects || [])
          
          logToVercel('PROJECTS_FETCH_SUCCESS', {
            userId: session.user?.id,
            projectCount: data.projects?.length || 0,
            timestamp: new Date().toISOString()
          })
        } else {
          logToVercel('PROJECTS_FETCH_FAILED', {
            userId: session.user?.id,
            status: response.status,
            timestamp: new Date().toISOString()
          })
          console.error('Error fetching projects')
        }
      } catch (error) {
        logToVercel('PROJECTS_FETCH_ERROR', {
          userId: session.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
        console.error('Error fetching projects:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [session?.user?.id]) // Removed setProjects from dependencies to prevent infinite loops

  const handleDropdownToggle = () => {
    logToVercel('PROJECT_DROPDOWN_TOGGLED', {
      userId: session?.user?.id,
      isOpen: !isOpen,
      timestamp: new Date().toISOString()
    })
    setIsOpen(!isOpen)
  }

  const handleProjectSelection = (project: Project) => {
    logToVercel('PROJECT_SELECTED', {
      userId: session?.user?.id,
      projectId: project.id,
      projectName: project.name,
      companyName: project.company.name,
      timestamp: new Date().toISOString()
    })
    
    setCurrentProject(project)
    setIsOpen(false)
  }

  if (isLoading) {
    return (
      <div className="mobile-card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{es.projects.currentProject}</h2>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{es.projects.currentProject}</h2>
      
      <div className="relative">
        <button
          onClick={handleDropdownToggle}
          className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
        >
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <Building2 className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="text-left min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">
                {currentProject?.name || es.projects.selectProject}
              </div>
              {currentProject?.description && (
                <div className="text-sm text-gray-500 truncate">
                  {currentProject.description}
                </div>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {projects.length > 0 ? (
              projects.map((project: Project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelection(project)}
                  className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-900 truncate">{project.name}</div>
                  {project.description && (
                    <div className="text-sm text-gray-500 truncate">{project.description}</div>
                  )}
                </button>
              ))
            ) : (
              <div className="p-3 text-sm text-gray-500">
                No hay proyectos disponibles
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
