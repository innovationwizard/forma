'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Building, Users, Calendar, Target, Building2 } from 'lucide-react'

// Vercel logging function
const logToVercel = (action: string, details: any = {}) => {
  console.log(`[VERCEL_LOG] ${action}:`, details)
  // In production, this will show up in Vercel logs
}

interface Project {
  id: string
  name: string
  description: string
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
  companyId: string
  createdAt: string
  company: {
    id: string
    name: string
  }
  peopleCount: number
  people: Array<{
    id: string
    personId: string
    projectId: string
    startDate: string
    endDate?: string
    status: 'ACTIVE' | 'INACTIVE'
    person: {
      id: string
      name: string
      email: string
      role: string
    }
  }>
  taskAssignments: Array<{
    id: string
    taskId: string
    projectId: string
    assignedAt: string
    assignedBy: string
    task: {
      id: string
      name: string
      description?: string
      progressUnit: string
      category?: {
        id: string
        name: string
        nameEs?: string
      }
    }
  }>
  workerAssignments: Array<{
    id: string
    taskId: string
    projectId: string
    workerId: string
    assignedAt: string
    assignedBy: string
    task: {
      id: string
      name: string
      description?: string
      progressUnit: string
      category?: {
        id: string
        name: string
        nameEs?: string
      }
    }
    worker: {
      id: string
      name: string
      email: string
      role: string
    }
  }>
}

interface Company {
  id: string
  name: string
}

interface PersonProject {
  id: string;
  personId: string;
  projectId: string;
  role: 'WORKER' | 'SUPERVISOR';
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'INACTIVE';
  person: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export default function ProjectsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    companyId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
  })
  const [availablePeople, setAvailablePeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<'WORKER' | 'SUPERVISOR'>('WORKER');

  // Check if user is authenticated
  if (!session) {
    router.push('/auth/login')
    return null
  }

  // Check if user has permission
  if (!['ADMIN', 'SUPERUSER', 'SUPERVISOR'].includes(session.user?.role || '')) {
    router.push('/dashboard')
    return null
  }

  const fetchProjects = async () => {
    logToVercel('PROJECTS_FETCH_ATTEMPTED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
    
    try {
      console.log('Fetching projects and stats...')
      const [projectsRes, statsRes] = await Promise.all([
        fetch('/api/projects', { credentials: 'include' }),
        fetch('/api/projects/stats', { credentials: 'include' })
      ])
      
      if (projectsRes.ok && statsRes.ok) {
        const [projectsData, statsData] = await Promise.all([
          projectsRes.json(),
          statsRes.json()
        ])
        
        console.log('Projects data received:', projectsData)
        console.log('Stats data received:', statsData)
        
        // Merge projects with their stats
        const projectsWithStats = projectsData.projects.map((project: any) => {
          const projectStats = statsData.projectStats.find((stats: any) => stats.id === project.id)
          return {
            ...project,
            peopleCount: projectStats?.peopleCount || 0
          }
        })
        
        setProjects(projectsWithStats || [])
        
        logToVercel('PROJECTS_FETCH_SUCCESS', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          projectsCount: projectsWithStats?.length || 0,
          timestamp: new Date().toISOString()
        })
      } else {
        logToVercel('PROJECTS_FETCH_FAILED', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          projectsStatus: projectsRes.status,
          statsStatus: statsRes.status,
          timestamp: new Date().toISOString()
        })
        console.error('Error fetching data:', projectsRes.status, statsRes.status)
        setProjects([]) // Set empty array on error
      }
    } catch (error) {
      logToVercel('PROJECTS_FETCH_ERROR', {
        userId: session?.user?.id,
        userRole: session?.user?.role,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
      console.error('Error fetching projects:', error)
      setProjects([]) // Set empty array on error
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCompanies = async () => {
    logToVercel('PROJECTS_COMPANIES_FETCH_ATTEMPTED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
    
    try {
      const response = await fetch('/api/companies', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setCompanies(data.companies || [])
        
        logToVercel('PROJECTS_COMPANIES_FETCH_SUCCESS', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          companiesCount: data.companies?.length || 0,
          timestamp: new Date().toISOString()
        })
      } else {
        logToVercel('PROJECTS_COMPANIES_FETCH_FAILED', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          status: response.status,
          timestamp: new Date().toISOString()
        })
        console.error('Error fetching companies')
      }
    } catch (error) {
      logToVercel('PROJECTS_COMPANIES_FETCH_ERROR', {
        userId: session?.user?.id,
        userRole: session?.user?.role,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
      console.error('Error fetching companies:', error)
    }
  }

  const fetchAvailablePeople = async (companyId: string) => {
    logToVercel('PROJECTS_AVAILABLE_PEOPLE_FETCH_ATTEMPTED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      companyId,
      timestamp: new Date().toISOString()
    })
    
    try {
      const response = await fetch(`/api/people?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter people based on role permissions
        if (session?.user?.role === 'SUPERVISOR') {
          // Supervisors can only assign workers
          setAvailablePeople((data.people || []).filter((person: Person) => person.role === 'WORKER'));
        } else {
          // Admins can assign both workers and supervisors
          setAvailablePeople((data.people || []).filter((person: Person) => 
            person.role === 'WORKER' || person.role === 'SUPERVISOR'
          ));
        }
        
        logToVercel('PROJECTS_AVAILABLE_PEOPLE_FETCH_SUCCESS', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          companyId,
          availablePeopleCount: data.people?.length || 0,
          timestamp: new Date().toISOString()
        })
      } else {
        logToVercel('PROJECTS_AVAILABLE_PEOPLE_FETCH_FAILED', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          companyId,
          status: response.status,
          timestamp: new Date().toISOString()
        })
        console.error('Error fetching available people:', error);
      }
    } catch (error) {
      logToVercel('PROJECTS_AVAILABLE_PEOPLE_FETCH_ERROR', {
        userId: session?.user?.id,
        userRole: session?.user?.role,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
      console.error('Error fetching available people:', error);
    }
  };

  const handleOpenAssignmentModal = (project: Project) => {
    logToVercel('PROJECTS_ASSIGNMENT_MODAL_OPENED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      projectId: project.id,
      projectName: project.name,
      companyId: project.companyId,
      timestamp: new Date().toISOString()
    })
    
    setSelectedProject(project);
    setSelectedPeople([]);
    setSelectedRole('WORKER');
    fetchAvailablePeople(project.companyId);
    setIsAssignmentModalOpen(true);
  };

  const handleAssignPeople = async () => {
    if (!selectedProject || selectedPeople.length === 0) return;

    logToVercel('PROJECTS_ASSIGN_PEOPLE_ATTEMPTED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      selectedPeopleCount: selectedPeople.length,
      selectedRole,
      timestamp: new Date().toISOString()
    })

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/assign-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          personIds: selectedPeople,
          role: selectedRole
        })
      });

      if (response.ok) {
        logToVercel('PROJECTS_ASSIGN_PEOPLE_SUCCESS', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          selectedPeopleCount: selectedPeople.length,
          selectedRole,
          timestamp: new Date().toISOString()
        })
        
        setMessage('Personas asignadas exitosamente');
        setIsAssignmentModalOpen(false);
        // Refresh projects to show updated people counts
        setTimeout(() => fetchProjects(), 100);
      } else {
        const error = await response.json();
        logToVercel('PROJECTS_ASSIGN_PEOPLE_FAILED', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          error: error.message,
          status: response.status,
          timestamp: new Date().toISOString()
        })
        setMessage(`Error: ${error.message}`);
      }
    } catch (error) {
      logToVercel('PROJECTS_ASSIGN_PEOPLE_ERROR', {
        userId: session?.user?.id,
        userRole: session?.user?.role,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
      setMessage('Error al asignar personas');
    }
  };

  const handleUnassignPerson = async (projectId: string, personId: string) => {
    logToVercel('PROJECTS_UNASSIGN_PERSON_ATTEMPTED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      projectId,
      personId,
      timestamp: new Date().toISOString()
    })

    try {
      const response = await fetch(`/api/projects/${projectId}/unassign-user`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ personId })
      });

      if (response.ok) {
        logToVercel('PROJECTS_UNASSIGN_PERSON_SUCCESS', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          projectId,
          personId,
          timestamp: new Date().toISOString()
        })
        
        setMessage('Persona desasignada exitosamente');
        // Refresh projects to show updated people counts
        setTimeout(() => fetchProjects(), 100);
      } else {
        const error = await response.json();
        logToVercel('PROJECTS_UNASSIGN_PERSON_FAILED', {
          userId: session?.user?.id,
          userRole: session?.user?.role,
          projectId,
          personId,
          error: error.message,
          status: response.status,
          timestamp: new Date().toISOString()
        })
        setMessage(`Error: ${error.message}`);
      }
    } catch (error) {
      logToVercel('PROJECTS_UNASSIGN_PERSON_ERROR', {
        userId: session?.user?.id,
        userRole: session?.user?.role,
        projectId,
        personId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
      setMessage('Error al desasignar persona');
    }
  };

  useEffect(() => {
    fetchProjects()
    fetchCompanies()
  }, [])

  const handleCreateProject = () => {
    logToVercel('PROJECTS_CREATE_MODAL_OPENED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      timestamp: new Date().toISOString()
    })
    
    setIsEditMode(false)
    // Single tenant: auto-use first (only) company
    const defaultCompanyId = companies?.length > 0 ? companies[0].id : ''
    setFormData({
      id: '',
      name: '',
      description: '',
      companyId: defaultCompanyId,
      status: 'ACTIVE'
    })
    setIsModalOpen(true)
  }

  const handleEditProject = (project: Project) => {
    logToVercel('PROJECTS_EDIT_MODAL_OPENED', {
      userId: session?.user?.id,
      userRole: session?.user?.role,
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      timestamp: new Date().toISOString()
    })
    
    setIsEditMode(true)
    setFormData({
      id: project.id,
      name: project.name,
      description: project.description,
      companyId: project.company.id,
      status: project.status
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const url = isEditMode ? '/api/projects' : '/api/projects'
      const method = isEditMode ? 'PUT' : 'POST'
      const body = isEditMode ? { ...formData } : { ...formData, id: undefined }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        setIsModalOpen(false)
        setFormData({
          id: '',
          name: '',
          description: '',
          companyId: '',
          status: 'ACTIVE'
        })
        
        // Add the new project to the local state immediately
        if (data.project && !isEditMode) {
          setProjects(prevProjects => [data.project, ...prevProjects])
        }
        
        // Also refresh from server to ensure consistency
        setTimeout(() => {
          fetchProjects()
        }, 500)
      } else {
        setMessage(data.error || 'Error al procesar el proyecto')
      }
    } catch (error) {
      console.error('Error saving project:', error)
      setMessage('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800'
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo'
      case 'INACTIVE':
        return 'Inactivo'
      case 'COMPLETED':
        return 'Completado'
      default:
        return status
    }
  }

  if (isLoading && projects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Proyectos</h1>
          <p className="text-gray-600">Gestión y seguimiento de proyectos</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Proyectos</h1>
        {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERUSER') && (
          <button
            onClick={() => {
              setIsEditMode(false);
              setFormData({ id: '', name: '', description: '', companyId: '', status: 'ACTIVE' });
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Crear Proyecto
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                </div>
                {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERUSER') && (
                  <button
                    onClick={() => {
                      setIsEditMode(true);
                      setFormData({
                        id: project.id,
                        name: project.name,
                        description: project.description,
                        companyId: project.company.id,
                        status: project.status
                      });
                      setSelectedProject(project);
                      setIsModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Target className="w-4 h-4 mr-2" />
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    project.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    project.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusText(project.status)}
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  {project.peopleCount || 0} usuario{(project.peopleCount || 0) !== 1 ? 's' : ''} asignado{(project.peopleCount || 0) !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  Creado: {new Date(project.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Project Members */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Miembros del Proyecto:</h4>
                {project.people && project.people.length > 0 ? (
                  <div className="space-y-1">
                    {project.people.map((personProject) => (
                      <div key={personProject.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <span className="text-gray-600">{personProject.person.name}</span>
                          <span className="ml-2 px-1 py-0.5 bg-gray-100 rounded text-gray-500">
                            {personProject.person.role}
                          </span>
                        </div>
                        {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERUSER' || 
                          (session?.user?.role === 'SUPERVISOR' && personProject.person.role === 'WORKER')) && (
                          <button
                            onClick={() => handleUnassignPerson(project.id, personProject.person.id)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            Desasignar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No hay usuarios asignados</p>
                )}
              </div>

              {/* Project Tasks */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Tareas Asignadas:</h4>
                {(() => {
                  // Combine task assignments and worker assignments to show all tasks with their worker assignments
                  const allTasks = new Map();
                  
                  // Add tasks assigned to project (without worker assignment)
                  project.taskAssignments?.forEach(taskAssignment => {
                    allTasks.set(taskAssignment.taskId, {
                      task: taskAssignment.task,
                      worker: null, // No worker assigned
                      assignmentType: 'project'
                    });
                  });
                  
                  // Add tasks assigned to workers (override project assignments if they exist)
                  project.workerAssignments?.forEach(workerAssignment => {
                    allTasks.set(workerAssignment.taskId, {
                      task: workerAssignment.task,
                      worker: workerAssignment.worker,
                      assignmentType: 'worker'
                    });
                  });
                  
                  const tasksArray = Array.from(allTasks.values());
                  
                  return tasksArray.length > 0 ? (
                    <div className="space-y-1">
                      {tasksArray.map((taskData, index) => (
                        <div key={`${taskData.task.id}-${index}`} className="flex items-center justify-between text-xs">
                          <div className="flex items-center flex-wrap">
                            <span className="text-gray-600">{taskData.task.name}</span>
                            {taskData.task.category && (
                              <span className="ml-2 px-1 py-0.5 bg-blue-100 rounded text-blue-600">
                                {taskData.task.category.nameEs || taskData.task.category.name}
                              </span>
                            )}
                            <span className="ml-2 px-1 py-0.5 bg-gray-100 rounded text-gray-500">
                              {taskData.task.progressUnit}
                            </span>
                            <span className="ml-2 px-1 py-0.5 bg-green-100 rounded text-green-600">
                              {taskData.worker ? taskData.worker.name : 'Sin asignar'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No hay tareas asignadas</p>
                  );
                })()}
              </div>

              {/* Assignment Button */}
              {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERUSER' || 
                session?.user?.role === 'SUPERVISOR') && (
                <button
                  onClick={() => handleOpenAssignmentModal(project)}
                  className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Gestionar Asignaciones
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay proyectos</h3>
          <p className="text-gray-600">Crea tu primer proyecto para comenzar.</p>
        </div>
      )}

      {/* Project Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {isEditMode ? 'Editar Proyecto' : 'Crear Proyecto'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="hidden">
                  <input type="hidden" value={formData.companyId} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estado</label>
                  <select
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                    <option value="COMPLETED">Completado</option>
                  </select>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {isAssignmentModalOpen && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Asignar Usuarios a: {selectedProject.name}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rol de Asignación
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'WORKER' | 'SUPERVISOR')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="WORKER">Trabajador</option>
                {session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERUSER' ? (
                  <option value="SUPERVISOR">Supervisor</option>
                ) : null}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Usuarios
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                {availablePeople.map((user) => (
                  <label key={user.id} className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      value={user.id}
                      checked={selectedPeople.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPeople([...(selectedPeople || []), user.id]);
                        } else {
                          setSelectedPeople((selectedPeople || []).filter(id => id !== user.id));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      {user.name} ({user.email}) - {user.role}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAssignmentModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignPeople}
                disabled={selectedPeople.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Asignar Usuarios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 