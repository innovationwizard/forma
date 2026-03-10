'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Calendar, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  Clock, 
  XCircle,
  Download,
  FileText,
  BarChart3,
  FileDown
} from 'lucide-react'
import { generateProgressHistoryPDF, PDFExportOptions } from '@/lib/pdfExport'

interface Project {
  id: string
  name: string
  nameEs?: string
}

interface Task {
  id: string
  name: string
  category?: {
    id: string
    name: string
    nameEs?: string
  } | null
}

interface Worker {
  id: string
  name: string
  email?: string
}

interface Material {
  id: string
  name: string
  nameEs?: string
  unit: string
}

interface MaterialConsumption {
  id: string
  quantity: number
  material: Material
}

interface MaterialLoss {
  id: string
  quantity: number
  material: Material
}

interface ProgressUpdate {
  id: string
  task: Task
  project: Project
  worker: Worker
  amountCompleted: number
  status: string
  additionalAttributes?: string
  validationStatus: string
  validationComments?: string
  validatedBy?: string
  validatedAt?: string
  createdAt: string
  materialConsumptions: MaterialConsumption[]
  materialLosses: MaterialLoss[]
  totalConsumption: number
  totalLoss: number
}

interface ProgressHistoryProps {
  projects: Project[]
  tasks: Task[]
  personRole: string
  companyName?: string
}

export default function ProgressHistory({ projects, tasks, personRole }: ProgressHistoryProps) {
  const [loading, setLoading] = useState(false)
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [projectSummary, setProjectSummary] = useState<any[]>([])
  const [isAnonymized, setIsAnonymized] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: 'all',
    taskId: 'all',
    workerId: 'all',
    startDate: '',
    endDate: '',
    status: 'all',
    validationStatus: 'all'
  })

  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchProgressHistory()
  }, [filters])

  const fetchProgressHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.projectId !== 'all') params.append('projectId', filters.projectId)
      if (filters.taskId !== 'all') params.append('taskId', filters.taskId)
      if (filters.workerId !== 'all') params.append('workerId', filters.workerId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.validationStatus !== 'all') params.append('validationStatus', filters.validationStatus)

      const response = await fetch(`/api/tasks/progress/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setProgressUpdates(data.progressUpdates)
        setSummary(data.summary)
        setProjectSummary(data.projectSummary)
        setIsAnonymized(data.isAnonymized)
      }
    } catch (error) {
      console.error('Error fetching progress history:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!progressUpdates.length) return

    const headers = [
      'ID',
      'Tarea',
      'Categoría',
      'Proyecto',
      'Trabajador',
      'Cantidad Completada',
      'Estado',
      'Estado de Validación',
      'Fecha',
      'Consumo de Materiales',
      'Pérdida de Materiales',
      'Comentarios'
    ]

    const csvContent = [
      headers.join(','),
      ...progressUpdates.map(update => [
        update.id,
        `"${update.task.name}"`,
        `"${update.task.category?.nameEs || update.task.category?.name || 'Sin categoría'}"`,
        `"${update.project.nameEs || update.project.name}"`,
        `"${update.worker.name}"`,
        update.amountCompleted,
        update.status,
        update.validationStatus,
        new Date(update.createdAt).toLocaleDateString(),
        update.totalConsumption,
        update.totalLoss,
        `"${update.additionalAttributes || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `progress_history_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToPDF = () => {
    if (!progressUpdates.length || !summary) return

    // Prepare data for PDF export
    const pdfProgressUpdates = progressUpdates.map(update => ({
      id: update.id,
      task: {
        name: update.task.nameEs || update.task.name,
        category: {
          name: update.task.category?.nameEs || update.task.category?.name || 'Sin categoría'
        }
      },
      project: {
        name: update.project.nameEs || update.project.name
      },
      worker: {
        name: update.worker.name,
        id: update.worker.id
      },
      amountCompleted: update.amountCompleted,
      status: update.status,
      validationStatus: update.validationStatus,
      createdAt: update.createdAt,
      additionalAttributes: update.additionalAttributes,
      materialConsumptions: update.materialConsumptions.map(mc => ({
        material: {
          name: mc.material.nameEs || mc.material.name,
          unit: mc.material.unit
        },
        quantity: mc.quantity
      })),
      materialLosses: update.materialLosses.map(ml => ({
        material: {
          name: ml.material.nameEs || ml.material.name,
          unit: ml.material.unit
        },
        quantity: ml.quantity
      })),
      totalConsumption: update.totalConsumption,
      totalLoss: update.totalLoss
    }))

    const pdfSummary = {
      totalUpdates: summary.totalUpdates,
      totalAmountCompleted: summary.totalAmountCompleted,
      totalConsumption: summary.totalConsumption,
      totalLoss: summary.totalLoss,
      pendingValidation: summary.pendingValidation,
      validatedUpdates: summary.validatedUpdates,
      rejectedUpdates: summary.rejectedUpdates
    }

    const pdfProjectSummaries = projectSummary.map(project => ({
      project: {
        name: project.project.nameEs || project.project.name
      },
      totalUpdates: project.totalUpdates,
      totalAmount: project.totalAmount,
      totalConsumption: project.totalConsumption,
      totalLoss: project.totalLoss,
      pendingValidation: project.pendingValidation,
      validatedUpdates: project.validatedUpdates,
      rejectedUpdates: project.rejectedUpdates
    }))

    // Create date range string
    let dateRange = ''
    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate).toLocaleDateString() : 'Inicio'
      const end = filters.endDate ? new Date(filters.endDate).toLocaleDateString() : 'Actual'
      dateRange = `${start} - ${end}`
    }

    const pdfOptions: PDFExportOptions = {
      title: 'Reporte de Historial de Progreso',
      subtitle: 'Seguimiento de Tareas y Materiales',
      companyName: companyName || 'Forma - Gestión de Construcción',
      dateRange: dateRange || undefined,
      isAnonymized: isAnonymized
    }

    generateProgressHistoryPDF(pdfProgressUpdates, pdfSummary, pdfProjectSummaries, pdfOptions)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NOT_STARTED': return 'bg-gray-100 text-gray-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'ON_HOLD': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getValidationStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'VALIDATED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg">Cargando historial...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Historial de Progreso</h3>
          <p className="text-sm text-gray-600">
            {isAnonymized 
              ? 'Vista de Supervisor - Datos anonimizados para facturación'
              : 'Vista de Administrador - Información completa para rendición de cuentas'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proyecto
              </label>
              <Select 
                value={filters.projectId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los proyectos" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  <SelectItem 
                    value="all" 
                    className="py-2 px-3 hover:bg-gray-50"
                  >
                    Todos los proyectos
                  </SelectItem>
                  {projects.map((project) => (
                    <SelectItem 
                      key={project.id} 
                      value={project.id}
                      className="py-2 px-3 hover:bg-gray-50"
                    >
                      {project.nameEs || project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarea
              </label>
              <Select 
                value={filters.taskId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, taskId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las tareas" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  <SelectItem 
                    value="all" 
                    className="py-2 px-3 hover:bg-gray-50"
                  >
                    Todas las tareas
                  </SelectItem>
                  {tasks.map((task) => (
                    <SelectItem 
                      key={task.id} 
                      value={task.id}
                      className="py-2 px-3 hover:bg-gray-50"
                    >
                      {task.nameEs || task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado de Validación
              </label>
              <Select 
                value={filters.validationStatus} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, validationStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  <SelectItem 
                    value="all" 
                    className="py-2 px-3 hover:bg-gray-50"
                  >
                    Todos los estados
                  </SelectItem>
                  <SelectItem 
                    value="PENDING" 
                    className="py-2 px-3 hover:bg-gray-50"
                  >
                    Pendiente
                  </SelectItem>
                  <SelectItem 
                    value="VALIDATED" 
                    className="py-2 px-3 hover:bg-gray-50"
                  >
                    Validado
                  </SelectItem>
                  <SelectItem 
                    value="REJECTED" 
                    className="py-2 px-3 hover:bg-gray-50"
                  >
                    Rechazado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Inicio
              </label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen General</TabsTrigger>
          <TabsTrigger value="projects">Por Proyecto</TabsTrigger>
          <TabsTrigger value="details">Detalles</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Actualizaciones</p>
                      <p className="text-2xl font-bold text-blue-600">{summary.totalUpdates}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Cantidad Total</p>
                      <p className="text-2xl font-bold text-green-600">{summary.totalAmountCompleted.toFixed(2)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pendientes</p>
                      <p className="text-2xl font-bold text-yellow-600">{summary.pendingValidation}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Validados</p>
                      <p className="text-2xl font-bold text-green-600">{summary.validatedUpdates}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Material Summary */}
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen de Materiales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Consumo Total</p>
                      <p className="text-xl font-bold text-blue-700">{summary.totalConsumption.toFixed(2)}</p>
                    </div>
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-red-600">Pérdida Total</p>
                      <p className="text-xl font-bold text-red-700">{summary.totalLoss.toFixed(2)}</p>
                    </div>
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen por Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectSummary.map((project) => (
                  <div key={project.project.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-lg">
                        {project.project.nameEs || project.project.name}
                      </h4>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total: {project.totalAmount.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">Actualizaciones: {project.totalUpdates}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Pendientes</p>
                        <p className="font-medium text-yellow-600">{project.pendingValidation}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Validados</p>
                        <p className="font-medium text-green-600">{project.validatedUpdates}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Consumo</p>
                        <p className="font-medium text-blue-600">{project.totalConsumption.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Pérdida</p>
                        <p className="font-medium text-red-600">{project.totalLoss.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalles de Actualizaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {progressUpdates.map((update) => (
                  <div key={update.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">
                            {update.task.nameEs || update.task.name}
                          </h4>
                          <Badge variant="outline" className={getStatusColor(update.status)}>
                            {update.status}
                          </Badge>
                          <Badge variant="outline" className={getValidationStatusColor(update.validationStatus)}>
                            {update.validationStatus}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {update.project.nameEs || update.project.name} • {update.worker.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(update.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-blue-600">
                          {update.amountCompleted}
                        </p>
                        <p className="text-sm text-gray-600">
                          {update.task.category?.nameEs || update.task.category?.name || 'Sin categoría'}
                        </p>
                      </div>
                    </div>

                    {update.additionalAttributes && (
                      <p className="text-sm text-gray-700 mb-3">
                        <strong>Comentarios:</strong> {update.additionalAttributes}
                      </p>
                    )}

                    {(update.materialConsumptions.length > 0 || update.materialLosses.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {update.materialConsumptions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-2">Consumo de Materiales</p>
                            <div className="space-y-1">
                              {update.materialConsumptions.map((consumption) => (
                                <div key={consumption.id} className="text-sm">
                                  {consumption.material.nameEs || consumption.material.name}: {consumption.quantity} {consumption.material.unit}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {update.materialLosses.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-2">Pérdida de Materiales</p>
                            <div className="space-y-1">
                              {update.materialLosses.map((loss) => (
                                <div key={loss.id} className="text-sm">
                                  {loss.material.nameEs || loss.material.name}: {loss.quantity} {loss.material.unit}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {update.validationComments && (
                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-700">
                          <strong>Comentarios de Validación:</strong> {update.validationComments}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
