'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, Building2, Target } from 'lucide-react'

interface Task {
  id: string
  name: string
  description?: string
  category?: {
    id: string
    name: string
  } | null
  progressUnit: string
  status: string
}

interface Project {
  id: string
  name: string
  nameEs?: string
  description?: string
  company: {
    id: string
    name: string
  }
}

interface Person {
  id: string
  name: string
  email: string
  role: string
}

interface TaskProjectAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function TaskProjectAssignmentModal({ 
  open, 
  onOpenChange, 
  onSuccess 
}: TaskProjectAssignmentModalProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [workers, setWorkers] = useState<Person[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch tasks, projects, and workers in parallel
      const [tasksResponse, projectsResponse, workersResponse] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/projects'),
        fetch('/api/people')
      ])

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        setTasks(tasksData.tasks || [])
      }

      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setProjects(projectsData.projects || [])
      }

      if (workersResponse.ok) {
        const workersData = await workersResponse.json()
        // Filter to only show WORKER role people
        const workerPeople = (workersData.people || []).filter((person: Person) => person.role === 'WORKER')
        setWorkers(workerPeople)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedTaskId || !selectedProjectId) {
      alert('Por favor selecciona una tarea y un proyecto')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/tasks/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: selectedTaskId,
          projectId: selectedProjectId,
          workerIds: selectedWorkerIds.length > 0 ? selectedWorkerIds : undefined,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Task assigned successfully:', result)
        onSuccess()
        onOpenChange(false)
        // Reset form
        setSelectedTaskId('')
        setSelectedProjectId('')
        setSelectedWorkerIds([])
        setSearchTerm('')
      } else {
        const error = await response.json()
        console.error('Error assigning task:', error)
        alert(error.error || 'Error al asignar la tarea')
      }
    } catch (error) {
      console.error('Error assigning task:', error)
      alert('Error al asignar la tarea')
    } finally {
      setLoading(false)
    }
  }

  const handleWorkerToggle = (workerId: string) => {
    setSelectedWorkerIds(prev => 
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    )
  }

  const filteredWorkers = (workers || []).filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedTask = tasks.find(task => task.id === selectedTaskId)
  const selectedProject = projects.find(project => project.id === selectedProjectId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Asignar Tarea a Proyecto
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Task Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Seleccionar Tarea
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona una tarea..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg">
                    {tasks.map((task) => (
                      <SelectItem 
                        key={task.id} 
                        value={task.id} 
                        className="py-3 px-3 hover:bg-gray-50"
                      >
                        <div className="flex flex-col items-start w-full">
                          <span className="font-medium text-sm text-gray-900 leading-tight">
                            {task.name}
                          </span>
                          <span className="text-xs text-gray-500 mt-1 leading-tight">
                            {task.category?.name || 'Sin categoría'} • {task.progressUnit}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedTask && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Información de la Tarea</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Categoría:</span>
                        <p>{selectedTask.category?.name || 'Sin categoría'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Unidad:</span>
                        <p>{selectedTask.progressUnit}</p>
                      </div>
                      {selectedTask.description && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Descripción:</span>
                          <p>{selectedTask.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Project Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Seleccionar Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona un proyecto..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg">
                    {projects.map((project) => (
                      <SelectItem 
                        key={project.id} 
                        value={project.id} 
                        className="py-3 px-3 hover:bg-gray-50"
                      >
                        <div className="flex flex-col items-start w-full">
                          <span className="font-medium text-sm text-gray-900 leading-tight">
                            {project.name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedProject && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Información del Proyecto</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Nombre:</span>
                        <p>{selectedProject.nameEs || selectedProject.name}</p>
                      </div>
                      {selectedProject.description && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Descripción:</span>
                          <p>{selectedProject.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Worker Selection (Optional) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Asignar a Trabajadores (Opcional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="text"
                  placeholder="Buscar trabajadores..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-4"
                />
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredWorkers.map((worker) => {
                    const isSelected = selectedWorkerIds.includes(worker.id)
                    
                    return (
                      <div
                        key={worker.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleWorkerToggle(worker.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{worker.name}</p>
                            <p className="text-xs text-gray-500">{worker.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {filteredWorkers.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    {searchTerm ? 'No se encontraron trabajadores' : 'No hay trabajadores disponibles'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            {selectedTaskId && selectedProjectId && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Resumen de Asignación</h4>
                <p className="text-sm text-gray-600">
                  La tarea <strong>{selectedTask?.name}</strong> será asignada al proyecto{' '}
                  <strong>{selectedProject?.name}</strong>
                  {selectedWorkerIds.length > 0 && (
                    <span>
                      {' '}y a {selectedWorkerIds.length} trabajador{selectedWorkerIds.length !== 1 ? 'es' : ''}.
                    </span>
                  )}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || !selectedTaskId || !selectedProjectId}
            onClick={handleSubmit}
          >
            {loading ? 'Asignando...' : 'Asignar Tarea'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
