'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Clock, Calendar, User, Building, Target, Filter, Download, FileText, Package, Camera, MapPin } from 'lucide-react'

interface WorkLogEntry {
  id: string
  description: string
  timeSpent: number
  notes: string
  createdAt: string
  task?: {
    id: string
    name: string
    progressUnit: string
  }
  materialUsage: Array<{
    material: {
      name: string
      unit: string
    }
    quantity: number
  }>
  photos: Array<{
    url: string
    caption: string
    timestamp: string
  }>
  locationLatitude?: number
  locationLongitude?: number
  locationAccuracy?: number
}

interface WorkLog {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  description: string
  status: 'ACTIVE' | 'COMPLETED'
  createdAt: string
  person: {
    id: string
    name: string
    email: string
  }
  project?: {
    id: string
    name: string
    company: {
      id: string
      name: string
    }
  }
  entries?: WorkLogEntry[]
}

export default function WorkLogsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: ''
  })
  const [expandedWorklogs, setExpandedWorklogs] = useState<Set<string>>(new Set())

  // Check if person is authenticated
  if (!session) {
    router.push('/auth/login')
    return null
  }

  const fetchWorkLogs = async () => {
    try {
      const response = await fetch('/api/worklog')
      if (response.ok) {
        const data = await response.json()
        setWorkLogs(data.workLogs || [])
      } else {
        console.error('Error fetching work logs')
      }
    } catch (error) {
      console.error('Error fetching work logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkLogs()
  }, [])

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'En progreso'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    return status === 'ACTIVE' 
      ? 'bg-yellow-100 text-yellow-800' 
      : 'bg-green-100 text-green-800'
  }

  const getStatusText = (status: string) => {
    return status === 'ACTIVE' ? 'En Progreso' : 'Completado'
  }

  const toggleWorklogExpansion = async (worklogId: string) => {
    const newExpanded = new Set(expandedWorklogs)
    
    if (newExpanded.has(worklogId)) {
      newExpanded.delete(worklogId)
    } else {
      newExpanded.add(worklogId)
      // Fetch entries if not already loaded
      const worklog = workLogs.find(w => w.id === worklogId)
      if (worklog && !worklog.entries) {
        await fetchWorklogEntries(worklogId)
      }
    }
    
    setExpandedWorklogs(newExpanded)
  }

  const fetchWorklogEntries = async (worklogId: string) => {
    try {
      const response = await fetch(`/api/worklog/${worklogId}/entries`)
      if (response.ok) {
        const data = await response.json()
        setWorkLogs(prev => prev.map(w => 
          w.id === worklogId ? { ...w, entries: data.entries } : w
        ))
      }
    } catch (error) {
      console.error('Error fetching worklog entries:', error)
    }
  }

  const filteredWorkLogs = workLogs.filter(log => {
    if (filter.status !== 'all' && log.status !== filter.status) return false
    if (filter.dateFrom && new Date(log.startTime) < new Date(filter.dateFrom)) return false
    if (filter.dateTo && new Date(log.startTime) > new Date(filter.dateTo)) return false
    return true
  })

  const totalHours = filteredWorkLogs.reduce((total, log) => {
    return total + (log.duration || 0)
  }, 0)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registros de Trabajo</h1>
          <p className="text-gray-600">Historial de registros de tiempo y actividad</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registros de Trabajo</h1>
          <p className="text-gray-600">Historial de registros de tiempo y actividad</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Horas</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.floor(totalHours / 60)}h {totalHours % 60}m
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Registros</p>
              <p className="text-2xl font-bold text-gray-900">{filteredWorkLogs.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <User className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">En Progreso</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredWorkLogs.filter(log => log.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 mr-2 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="all">Todos</option>
              <option value="ACTIVE">En Progreso</option>
              <option value="COMPLETED">Completado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filter.dateTo}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilter({ status: 'all', dateFrom: '', dateTo: '' })}
              className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Work Logs Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Registros de Tiempo</h3>
          <span className="text-sm text-gray-500">
            {filteredWorkLogs.length} registro(s) encontrado(s)
          </span>
        </div>
        
        {filteredWorkLogs.length > 0 ? (
          <div className="space-y-4">
            {filteredWorkLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-lg shadow-sm border">
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(log.status)}`}></div>
                      <div>
                        <p className="font-medium text-gray-900">{log.person.name}</p>
                        <p className="text-sm text-gray-500">{log.person.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDateTime(log.startTime)}</span>
                      </div>
                      {log.endTime && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDateTime(log.endTime)}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <Target className="h-4 w-4" />
                        <span>{formatDuration(log.duration)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {log.project && (
                    <div className="mt-3 flex items-center space-x-2 text-sm text-gray-600">
                      <Building className="h-4 w-4" />
                      <span>{log.project.name}</span>
                    </div>
                  )}
                  
                  {log.description && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{log.description}</p>
                    </div>
                  )}

                  {/* Expand/Collapse Button */}
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => toggleWorklogExpansion(log.id)}
                      className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      <span>
                        {expandedWorklogs.has(log.id) ? 'Ocultar Detalles' : 'Ver Detalles del Trabajo'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Expanded Entries Section */}
                {expandedWorklogs.has(log.id) && (
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Detalles del Trabajo</h4>
                    
                    {log.entries && log.entries.length > 0 ? (
                      <div className="space-y-4">
                        {log.entries.map((entry) => (
                          <div key={entry.id} className="bg-white rounded-lg border p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{entry.description}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {formatDateTime(entry.createdAt)}
                                </p>
                                {entry.task && (
                                  <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Target className="h-3 w-3 mr-1" />
                                    {entry.task.name} ({entry.task.progressUnit})
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">
                                  {Math.floor(entry.timeSpent / 60)}h {entry.timeSpent % 60}m
                                </p>
                              </div>
                            </div>

                            {/* Materials Used */}
                            {entry.materialUsage && entry.materialUsage.length > 0 && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Package className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-900">Materiales Utilizados</span>
                                </div>
                                <div className="space-y-1">
                                  {entry.materialUsage.map((usage, index) => (
                                    <p key={index} className="text-sm text-blue-700">
                                      • {usage.material.name}: {usage.quantity} {usage.material.unit}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Photos */}
                            {entry.photos && entry.photos.length > 0 && (
                              <div className="mt-3 p-3 bg-green-50 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Camera className="h-4 w-4 text-green-600" />
                                  <span className="text-sm font-medium text-green-900">Documentación Fotográfica</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {entry.photos.map((photo, index) => (
                                    <div key={index} className="relative">
                                      <img
                                        src={photo.url}
                                        alt={photo.caption || 'Work documentation'}
                                        className="w-full h-20 object-cover rounded-lg"
                                      />
                                      {photo.caption && (
                                        <p className="text-xs text-green-700 mt-1">{photo.caption}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Location */}
                            {entry.locationLatitude && entry.locationLongitude && (
                              <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-purple-600" />
                                  <span className="text-sm font-medium text-purple-900">Ubicación</span>
                                </div>
                                <p className="text-xs text-purple-700 mt-1">
                                  Lat: {entry.locationLatitude.toFixed(6)}, 
                                  Long: {entry.locationLongitude.toFixed(6)}
                                  {entry.locationAccuracy && ` (Precisión: ±${Math.round(entry.locationAccuracy)}m)`}
                                </p>
                              </div>
                            )}

                            {/* Notes */}
                            {entry.notes && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-700">{entry.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No hay detalles de trabajo registrados</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay registros</h3>
            <p className="mt-1 text-sm text-gray-500">
              No se encontraron registros de trabajo con los filtros aplicados.
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 