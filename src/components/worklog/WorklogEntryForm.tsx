'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Clock, 
  Camera, 
  FileText, 
  Package, 
  Target, 
  Plus, 
  X, 
  CheckCircle,
  AlertCircle,
  Upload,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { es } from '@/lib/translations/es'

// Vercel logging function
const logToVercel = (action: string, details: any = {}) => {
  console.log(`[VERCEL_LOG] ${action}:`, details)
}

interface Task {
  id: string
  name: string
  progressUnit: string
  status: string
}

interface Material {
  id: string
  name: string
  unit: string
  currentStock: number
}

interface WorklogEntry {
  id?: string
  taskId?: string
  description: string
  timeSpent: number // minutes
  materialsUsed: Array<{
    materialId: string
    materialName: string
    quantity: number
    unit: string
  }>
  photos: Array<{
    id: string
    url: string
    caption?: string
    timestamp: string
  }>
  notes: string
  location?: {
    latitude: number
    longitude: number
    accuracy: number
  }
}

interface WorklogEntryFormProps {
  isOpen: boolean
  onClose: () => void
  onEntrySaved: () => void
  currentWorklogId: string
  projectId: string
  projectName: string
}

export default function WorklogEntryForm({ 
  isOpen, 
  onClose, 
  onEntrySaved, 
  currentWorklogId, 
  projectId, 
  projectName 
}: WorklogEntryFormProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'work' | 'materials' | 'photos' | 'summary'>('work')
  
  // Form data
  const [entry, setEntry] = useState<WorklogEntry>({
    description: '',
    timeSpent: 0,
    materialsUsed: [],
    photos: [],
    notes: ''
  })
  
  // Available data
  const [tasks, setTasks] = useState<Task[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  
  // UI state
  const [showTaskSelector, setShowTaskSelector] = useState(false)
  const [showMaterialSelector, setShowMaterialSelector] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLVideoElement>(null)

  // Load available tasks and materials
  useEffect(() => {
    if (isOpen) {
      loadProjectData()
    }
  }, [isOpen, projectId])

  const loadProjectData = async () => {
    setIsLoadingData(true)
    try {
      // Load tasks
      const tasksResponse = await fetch(`/api/tasks?projectId=${projectId}`)
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        setTasks(tasksData.tasks || [])
      }

      // Load materials
      const materialsResponse = await fetch(`/api/materials?projectId=${projectId}`)
      if (materialsResponse.ok) {
        const materialsData = await materialsResponse.json()
        setMaterials(materialsData.materials || [])
      }
    } catch (error) {
      console.error('Error loading project data:', error)
      toast.error('Error cargando datos del proyecto')
    } finally {
      setIsLoadingData(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry.description.trim()) {
      toast.error('Por favor describe el trabajo realizado')
      return
    }

    setIsSubmitting(true)
    try {
      // Get current location
      let location = null
      try {
        const currentLocation = await getCurrentLocation()
        location = currentLocation
      } catch (error) {
        console.warn('Could not get location:', error)
      }

      const response = await fetch(`/api/worklog/${currentWorklogId}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...entry,
          location
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al guardar el registro')
      }

      logToVercel('WORKLOG_ENTRY_SAVED', {
        userId: session?.user?.id,
        worklogId: currentWorklogId,
        projectId,
        entryType: 'work',
        timestamp: new Date().toISOString()
      })

      toast.success('Registro de trabajo guardado exitosamente')
      onEntrySaved()
      onClose()
      resetForm()
    } catch (error) {
      console.error('Error saving worklog entry:', error)
      toast.error(error instanceof Error ? error.message : 'Error al guardar el registro')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setEntry({
      description: '',
      timeSpent: 0,
      materialsUsed: [],
      photos: [],
      notes: ''
    })
    setSelectedTask(null)
    setActiveTab('work')
  }

  // Task selection
  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task)
    setEntry(prev => ({ ...prev, taskId: task.id }))
    setShowTaskSelector(false)
  }

  // Material management
  const addMaterial = (material: Material, quantity: number) => {
    if (quantity <= 0) return
    
    const existingIndex = entry.materialsUsed.findIndex(m => m.materialId === material.id)
    if (existingIndex >= 0) {
      // Update existing material
      const updated = [...entry.materialsUsed]
      updated[existingIndex].quantity += quantity
      setEntry(prev => ({ ...prev, materialsUsed: updated }))
    } else {
      // Add new material
      setEntry(prev => ({
        ...prev,
        materialsUsed: [...prev.materialsUsed, {
          materialId: material.id,
          materialName: material.name,
          quantity,
          unit: material.unit
        }]
      }))
    }
    setShowMaterialSelector(false)
  }

  const removeMaterial = (index: number) => {
    setEntry(prev => ({
      ...prev,
      materialsUsed: prev.materialsUsed.filter((_, i) => i !== index)
    }))
  }

  // Photo management
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        try {
          // In a real app, you'd upload to Supabase Storage
          // For now, we'll create a local URL
          const url = URL.createObjectURL(file)
          const photo = {
            id: Date.now().toString() + i,
            url,
            caption: '',
            timestamp: new Date().toISOString()
          }
          
          setEntry(prev => ({
            ...prev,
            photos: [...prev.photos, photo]
          }))
        } catch (error) {
          console.error('Error processing photo:', error)
          toast.error('Error al procesar la foto')
        }
      }
    }
  }

  const removePhoto = (photoId: string) => {
    setEntry(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== photoId)
    }))
  }

  const updatePhotoCaption = (photoId: string, caption: string) => {
    setEntry(prev => ({
      ...prev,
      photos: prev.photos.map(p => 
        p.id === photoId ? { ...p, caption } : p
      )
    }))
  }

  // Camera functionality
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      })
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast.error('No se pudo acceder a la cámara')
    }
  }

  const capturePhoto = () => {
    if (!cameraRef.current) return
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return
    
    canvas.width = cameraRef.current.videoWidth
    canvas.height = cameraRef.current.videoHeight
    context.drawImage(cameraRef.current, 0, 0)
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        const photo = {
          id: Date.now().toString(),
          url,
          caption: '',
          timestamp: new Date().toISOString()
        }
        
        setEntry(prev => ({
          ...prev,
          photos: [...prev.photos, photo]
        }))
      }
    }, 'image/jpeg')
  }

  // Navigation
  const nextTab = () => {
    const tabs: Array<'work' | 'materials' | 'photos' | 'summary'> = ['work', 'materials', 'photos', 'summary']
    const currentIndex = tabs.indexOf(activeTab)
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1])
    }
  }

  const prevTab = () => {
    const tabs: Array<'work' | 'materials' | 'photos' | 'summary'> = ['work', 'materials', 'photos', 'summary']
    const currentIndex = tabs.indexOf(activeTab)
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1])
    }
  }

  const canProceed = () => {
    switch (activeTab) {
      case 'work':
        return entry.description.trim().length > 0
      case 'materials':
        return true // Materials are optional
      case 'photos':
        return true // Photos are optional
      case 'summary':
        return true
      default:
        return false
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full w-full h-full max-h-[95vh] p-0 sm:max-w-2xl sm:h-auto">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registrar Trabajo - {projectName}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between text-sm">
            {['work', 'materials', 'photos', 'summary'].map((tab, index) => (
              <div key={tab} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  activeTab === tab 
                    ? 'bg-blue-600 text-white' 
                    : index < ['work', 'materials', 'photos', 'summary'].indexOf(activeTab)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {index < ['work', 'materials', 'photos', 'summary'].indexOf(activeTab) ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div className={`w-8 h-1 mx-1 ${
                    index < ['work', 'materials', 'photos', 'summary'].indexOf(activeTab)
                      ? 'bg-green-600'
                      : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Trabajo</span>
            <span>Materiales</span>
            <span>Fotos</span>
            <span>Resumen</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Work Tab */}
          {activeTab === 'work' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Tarea Relacionada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedTask ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium">{selectedTask.name}</p>
                        <p className="text-sm text-gray-600">Unidad: {selectedTask.progressUnit}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTask(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowTaskSelector(true)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Seleccionar Tarea
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Descripción del Trabajo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Describe detalladamente el trabajo realizado..."
                    value={entry.description}
                    onChange={(e) => setEntry(prev => ({ ...prev, description: e.target.value }))}
                    className="min-h-[100px]"
                    required
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Tiempo Dedicado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Horas
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        value={Math.floor(entry.timeSpent / 60)}
                        onChange={(e) => {
                          const hours = parseInt(e.target.value) || 0
                          const minutes = entry.timeSpent % 60
                          setEntry(prev => ({ ...prev, timeSpent: hours * 60 + minutes }))
                        }}
                        className="text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minutos
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={entry.timeSpent % 60}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value) || 0
                          const hours = Math.floor(entry.timeSpent / 60)
                          setEntry(prev => ({ ...prev, timeSpent: hours * 60 + minutes }))
                        }}
                        className="text-center"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Total: {Math.floor(entry.timeSpent / 60)}h {entry.timeSpent % 60}m
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notas Adicionales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Notas adicionales, observaciones, problemas encontrados..."
                    value={entry.notes}
                    onChange={(e) => setEntry(prev => ({ ...prev, notes: e.target.value }))}
                    className="min-h-[80px]"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Materials Tab */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Materiales Utilizados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={() => setShowMaterialSelector(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Material
                  </Button>

                  {entry.materialsUsed.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {entry.materialsUsed.map((material, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{material.materialName}</p>
                            <p className="text-sm text-gray-600">
                              {material.quantity} {material.unit}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMaterial(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Documentación Fotográfica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Subir Fotos
                    </Button>
                    <Button
                      variant="outline"
                      onClick={startCamera}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Tomar Foto
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e.target.files)}
                    className="hidden"
                  />

                  {/* Camera View */}
                  <div className="mb-4">
                    <video
                      ref={cameraRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg hidden"
                      style={{ display: cameraRef.current?.srcObject ? 'block' : 'none' }}
                    />
                    {cameraRef.current?.srcObject && (
                      <Button
                        onClick={capturePhoto}
                        className="w-full mt-2"
                        variant="secondary"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Capturar Foto
                      </Button>
                    )}
                  </div>

                  {/* Photo Grid */}
                  {entry.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {entry.photos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.url}
                            alt="Work documentation"
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePhoto(photo.id)}
                              className="text-white hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Descripción..."
                            value={photo.caption || ''}
                            onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                            className="mt-2 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Resumen del Registro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedTask && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="font-medium text-blue-900">Tarea: {selectedTask.name}</p>
                        <p className="text-sm text-blue-700">Unidad: {selectedTask.progressUnit}</p>
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">Descripción:</p>
                      <p className="text-sm text-gray-700">{entry.description || 'Sin descripción'}</p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">Tiempo:</p>
                      <p className="text-sm text-gray-700">
                        {Math.floor(entry.timeSpent / 60)}h {entry.timeSpent % 60}m
                      </p>
                    </div>

                    {entry.materialsUsed.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium">Materiales:</p>
                        <div className="space-y-1">
                          {entry.materialsUsed.map((material, index) => (
                            <p key={index} className="text-sm text-gray-700">
                              • {material.materialName}: {material.quantity} {material.unit}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {entry.photos.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium">Fotos:</p>
                        <p className="text-sm text-gray-700">{entry.photos.length} foto(s) capturada(s)</p>
                      </div>
                    )}

                    {entry.notes && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium">Notas:</p>
                        <p className="text-sm text-gray-700">{entry.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between">
            {activeTab !== 'work' && (
              <Button
                variant="outline"
                onClick={prevTab}
                disabled={isSubmitting}
              >
                Anterior
              </Button>
            )}
            
            <div className="flex gap-2">
              {activeTab !== 'summary' ? (
                <Button
                  onClick={nextTab}
                  disabled={!canProceed() || isSubmitting}
                  className="ml-auto"
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                  className="ml-auto"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Task Selector Modal */}
        <Dialog open={showTaskSelector} onOpenChange={setShowTaskSelector}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Seleccionar Tarea</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Buscar tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="max-h-60 overflow-y-auto space-y-2">
                {tasks
                  .filter(task => 
                    task.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(task => (
                    <div
                      key={task.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => handleTaskSelect(task)}
                    >
                      <p className="font-medium">{task.name}</p>
                      <p className="text-sm text-gray-600">Unidad: {task.progressUnit}</p>
                    </div>
                  ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Material Selector Modal */}
        <Dialog open={showMaterialSelector} onOpenChange={setShowMaterialSelector}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agregar Material</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Buscar materiales..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="max-h-60 overflow-y-auto space-y-2">
                {materials
                  .filter(material => 
                    material.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(material => (
                    <MaterialSelectorItem
                      key={material.id}
                      material={material}
                      onAdd={addMaterial}
                    />
                  ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

// Material selector item component
function MaterialSelectorItem({ 
  material, 
  onAdd 
}: { 
  material: Material
  onAdd: (material: Material, quantity: number) => void 
}) {
  const [quantity, setQuantity] = useState(0)

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium">{material.name}</p>
          <p className="text-sm text-gray-600">
            Stock: {material.currentStock} {material.unit}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => onAdd(material, quantity)}
          disabled={quantity <= 0 || quantity > material.currentStock}
        >
          Agregar
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          max={material.currentStock}
          value={quantity || ''}
          onChange={(e) => {
            const value = e.target.value
            if (value === '') {
              setQuantity(0)
            } else {
              const num = parseInt(value)
              if (!isNaN(num)) {
                setQuantity(num)
              }
            }
          }}
          className="w-20"
        />
        <span className="text-sm text-gray-600">{material.unit}</span>
      </div>
    </div>
  )
}

// Helper function to get current location
async function getCurrentLocation(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    )
  })
}
