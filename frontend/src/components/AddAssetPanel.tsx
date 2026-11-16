import * as React from 'react'
import type { Asset, AssetStatus } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'
import { toast } from 'sonner'
import { getCompanyLogo } from '@/assets/companyLogos'

interface AddAssetPanelProps {
  open: boolean
  onClose: () => void
  onSave: (asset: Asset) => void
  initialAsset?: Asset | null
  triggerRef?: React.RefObject<HTMLButtonElement | null>
  currentUser?: UserProfile
}

type CameraTarget = 'assetPhoto' | 'assetCodePhoto' | 'idCardPicture'

export const AddAssetPanel: React.FC<AddAssetPanelProps> = ({
  open,
  onClose,
  onSave,
  initialAsset,
  triggerRef,
  currentUser,
}) => {
  // Field States
  const [assetCode, setAssetCode] = React.useState('')
  const [assetCodeUnavailable, setAssetCodeUnavailable] = React.useState(false)
  const [assetCodeReason, setAssetCodeReason] = React.useState('')

  const [serialNumber, setSerialNumber] = React.useState('')
  const [serialNumberUnavailable, setSerialNumberUnavailable] = React.useState(false)
  const [serialNumberReason, setSerialNumberReason] = React.useState('')

  // Asset Name State (Explicitly requested for Label & QR printing)
  const [assetName, setAssetName] = React.useState('')
  const [model, setModel] = React.useState('')
  const [currentCategory, setCurrentCategory] = React.useState('')
  const [previousCategory, setPreviousCategory] = React.useState('')
  const [currentDescription, setCurrentDescription] = React.useState('')
  const [previousDescription, setPreviousDescription] = React.useState('')

  // Company and Building state with dynamic custom additions
  const [company, setCompany] = React.useState<string>('ismartu')
  const [showEditMasterData, setShowEditMasterData] = React.useState(false)
  const [companyCode, setCompanyCode] = React.useState('')
  const [costCenter, setCostCenter] = React.useState('')
  const [capitalizationDate, setCapitalizationDate] = React.useState('')
  const [companies, setCompanies] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('meridian_custom_companies')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set(['ismartu', 'Padget', 'IIPL', ...parsed]))
        }
      }
    } catch {}
    return ['ismartu', 'Padget', 'IIPL']
  })
  const [showNewCompanyInput, setShowNewCompanyInput] = React.useState(false)
  const [newCompanyName, setNewCompanyName] = React.useState('')

  const [building, setBuilding] = React.useState('C39')
  const [buildings, setBuildings] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('meridian_custom_buildings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set(['C39', 'D197', 'D198', 'D199', ...parsed]))
        }
      }
    } catch {}
    return ['C39', 'D197', 'D198', 'D199']
  })
  const [showNewBuildingInput, setShowNewBuildingInput] = React.useState(false)
  const [newBuildingName, setNewBuildingName] = React.useState('')

  const [inChargeId, setInChargeId] = React.useState('')
  const [inChargeName, setInChargeName] = React.useState('')
  const [plant, setPlant] = React.useState('')
  const [plantUnavailable, setPlantUnavailable] = React.useState(false)
  const [plantReason, setPlantReason] = React.useState('')

  const [floor, setFloor] = React.useState('')
  const [currentLocation, setCurrentLocation] = React.useState('')

  const [currentDepartment, setCurrentDepartment] = React.useState('')
  const [submitter, setSubmitter] = React.useState('')
  const [submitterId, setSubmitterId] = React.useState('')
  const [submitterDepartment, setSubmitterDepartment] = React.useState('')

  const [assetCondition, setAssetCondition] = React.useState('')
  const [assetConditionUnavailable, setAssetConditionUnavailable] = React.useState(false)
  const [assetConditionReason, setAssetConditionReason] = React.useState('')

  const [movementReason, setMovementReason] = React.useState('')
  const [remarks, setRemarks] = React.useState('')

  // Media States
  const [assetPhoto, setAssetPhoto] = React.useState<string | undefined>()
  const [assetCodePhoto, setAssetCodePhoto] = React.useState<string | undefined>()
  const [idCardPicture, setIdCardPicture] = React.useState<string | undefined>()

  const [date, setDate] = React.useState(() => new Date().toISOString().split('T')[0])
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Media option toggles (revealed when clicked, can be active simultaneously)
  const [showPhotoOptions, setShowPhotoOptions] = React.useState(false)
  const [showIdOptions, setShowIdOptions] = React.useState(false)

  // Camera Modal States
  const [cameraActiveTarget, setCameraActiveTarget] = React.useState<CameraTarget | null>(null)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const firstInputRef = React.useRef<HTMLInputElement>(null)
  const drawerRef = React.useRef<HTMLDivElement>(null)
  const assetPhotoFileRef = React.useRef<HTMLInputElement>(null)
  const idPhotoFileRef = React.useRef<HTMLInputElement>(null)

  // Handlers for adding new custom company and building
  const handleAddCompany = () => {
    const trimmed = newCompanyName.trim()
    if (!trimmed) return
    if (!companies.includes(trimmed)) {
      const updated = [...companies, trimmed]
      setCompanies(updated)
      try {
        localStorage.setItem('meridian_custom_companies', JSON.stringify(updated))
      } catch {}
    }
    setCompany(trimmed)
    setNewCompanyName('')
    setShowNewCompanyInput(false)
    toast.success(`Company added and selected: ${trimmed}`)
  }

  const handleAddBuilding = () => {
    const trimmed = newBuildingName.trim().toUpperCase()
    if (!trimmed) return
    if (!buildings.includes(trimmed)) {
      const updated = [...buildings, trimmed]
      setBuildings(updated)
      try {
        localStorage.setItem('meridian_custom_buildings', JSON.stringify(updated))
      } catch {}
    }
    setBuilding(trimmed)
    setNewBuildingName('')
    setShowNewBuildingInput(false)
    toast.success(`Building added and selected: ${trimmed}`)
  }

  // Keep latest state in refs so keydown listener does not need to rebind or re-trigger focus
  const cameraActiveTargetRef = React.useRef(cameraActiveTarget)
  cameraActiveTargetRef.current = cameraActiveTarget
  const showPhotoOptionsRef = React.useRef(showPhotoOptions)
  showPhotoOptionsRef.current = showPhotoOptions
  const showIdOptionsRef = React.useRef(showIdOptions)
  showIdOptionsRef.current = showIdOptions

  React.useEffect(() => {
    if (!open) return
    if (initialAsset) {
      setAssetCode(initialAsset.assetCode)
      setAssetCodeUnavailable(false)
      setAssetCodeReason('')
      setModel(initialAsset.model || '')
      setSerialNumber(initialAsset.serialNumber || '')
      setSerialNumberUnavailable(false)
      setSerialNumberReason('')
      setCurrentCategory(initialAsset.currentCategory || initialAsset.category || '')
      setPreviousCategory(initialAsset.previousCategory || '')
      const resolvedName = (initialAsset.name && initialAsset.name !== initialAsset.assetCode)
        ? initialAsset.name
        : (initialAsset.currentDescription && initialAsset.currentDescription !== initialAsset.assetCode ? initialAsset.currentDescription : '')
      setAssetName(resolvedName)
      setCurrentDescription(initialAsset.currentDescription || resolvedName || '')
      setPreviousDescription(initialAsset.previousDescription || '')

      const comp = initialAsset.company || 'ismartu'
      setCompany(comp)
      if (comp && !companies.includes(comp)) {
        setCompanies((prev) => Array.from(new Set([...prev, comp])))
      }

      const bldg = initialAsset.building || 'C39'
      setBuilding(bldg)
      if (bldg && !buildings.includes(bldg)) {
        setBuildings((prev) => Array.from(new Set([...prev, bldg])))
      }

      const defaultPlant = initialAsset.plant || initialAsset.location || 'C-39 Factory Noida'
      setPlant(defaultPlant)
      setPlantUnavailable(false)
      setPlantReason('')
      setCostCenter(initialAsset.costCenter || '')
      setCapitalizationDate(initialAsset.capitalizationDate || initialAsset.purchaseDate || '')
      setCompanyCode(initialAsset.companyCode || (comp === 'Padget' ? '5030' : '5020'))
      setShowEditMasterData(false)
      setFloor(initialAsset.floor || '')
      setCurrentLocation(initialAsset.currentLocation || '')

      // Auto-fill Ownership from asset or current active user (Main Owner: Auto-filled & Non-editable)
      const currentUserName = currentUser?.userName || ''
      const currentUserId = currentUser?.userId || ''
      const currentUserDept = currentUser?.department || ''

      const assignedDept = initialAsset.currentDepartment || initialAsset.department || currentUserDept || 'IT'
      const assignedId = (initialAsset.inChargeId && initialAsset.inChargeId !== 'ID Pending' ? initialAsset.inChargeId : '') || currentUserId || ''
      const assignedName = (initialAsset.inChargeName && initialAsset.inChargeName !== 'Unassigned Staff' ? initialAsset.inChargeName : '') || currentUserName || ''
      
      // Current user / logged-in manual entry section starts empty unless already previously saved
      const assignedSubmitter = initialAsset.submitter || ''
      const assignedSubmitterId = initialAsset.submitterId || ''
      const assignedSubmitterDept = initialAsset.submitterDepartment || ''

      setCurrentDepartment(assignedDept)
      setInChargeId(assignedId)
      setInChargeName(assignedName)
      setSubmitter(assignedSubmitter)
      setSubmitterId(assignedSubmitterId)
      setSubmitterDepartment(assignedSubmitterDept)

      setAssetCondition(initialAsset.assetCondition || '')
      setAssetConditionUnavailable(false)
      setAssetConditionReason('')
      setMovementReason(initialAsset.movementReason || '')
      setRemarks(initialAsset.remarks || '')
      setAssetPhoto(initialAsset.assetPhoto)
      setAssetCodePhoto(initialAsset.assetCodePhoto)
      setIdCardPicture(initialAsset.idCardPicture)
      setShowPhotoOptions(false)
      setShowIdOptions(false)
      setShowNewCompanyInput(false)
      setShowNewBuildingInput(false)
      setDate(initialAsset.date || initialAsset.purchaseDate || new Date().toISOString().split('T')[0])
      setErrors({})
    } else {
      // Empty form for new asset
      setAssetCode('')
      setAssetCodeUnavailable(false)
      setAssetCodeReason('')
      setSerialNumber('')
      setSerialNumberUnavailable(false)
      setSerialNumberReason('')
      setCurrentCategory('')
      setPreviousCategory('')
      setAssetName('')
      setCurrentDescription('')
      setPreviousDescription('')
      setCompany('ismartu')
      setBuilding('C39')
      setFloor('')
      setPlant('')
      setPlantUnavailable(false)
      setPlantReason('')
      setCurrentLocation('')

      // Auto-fill Ownership from current active user
      setCurrentDepartment(currentUser?.department || 'IT')
      setInChargeId(currentUser?.userId || '')
      setInChargeName(currentUser?.userName || '')
      
      // Current User / Logged-in Personnel starts empty for manual entry
      setSubmitter('')
      setSubmitterId('')
      setSubmitterDepartment('')

      setAssetCondition('')
      setAssetConditionUnavailable(false)
      setAssetConditionReason('')
      setMovementReason('')
      setRemarks('')
      setAssetPhoto(undefined)
      setAssetCodePhoto(undefined)
      setIdCardPicture(undefined)
      setShowPhotoOptions(false)
      setShowIdOptions(false)
      setShowNewCompanyInput(false)
      setShowNewBuildingInput(false)
      setDate(new Date().toISOString().split('T')[0])
      setErrors({})
    }
  }, [open, initialAsset, currentUser])

  // Focus management: ONLY focus first input once when drawer is opened
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        firstInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Escape key handling without re-focusing or resetting scroll
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cameraActiveTargetRef.current) {
          closeCamera()
        } else if (showPhotoOptionsRef.current || showIdOptionsRef.current) {
          setShowPhotoOptions(false)
          setShowIdOptions(false)
        } else {
          handleClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Stop camera stream on unmount or close
  React.useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const openCamera = async (target: CameraTarget) => {
    setShowPhotoOptions(false)
    setShowIdOptions(false)
    setCameraActiveTarget(target)
    setCameraError(null)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by this browser environment.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: target === 'assetCodePhoto' ? { ideal: 'environment' } : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play?.()
        } catch {
          // Ignore autoplay / headless test constraints
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access camera device'
      setCameraError(msg)
      toast.error('Camera access failed', { description: msg })
    }
  }

  const closeCamera = () => {
    stopCameraStream()
    setCameraActiveTarget(null)
    setCameraError(null)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

        if (cameraActiveTarget === 'assetCodePhoto') {
          setAssetCodePhoto(dataUrl)
          toast.success('Asset code photo captured via camera!')
        } else if (cameraActiveTarget === 'assetPhoto') {
          setAssetPhoto(dataUrl)
          toast.success('Asset photo captured via camera!')
        } else if (cameraActiveTarget === 'idCardPicture') {
          setIdCardPicture(dataUrl)
          toast.success('ID card picture captured via camera!')
        }
      }
    } catch (err) {
      toast.error('Failed to capture frame from camera stream')
    } finally {
      closeCamera()
    }
  }

  const handleClose = () => {
    stopCameraStream()
    setCameraActiveTarget(null)
    setShowPhotoOptions(false)
    setShowIdOptions(false)
    onClose()
    if (triggerRef && triggerRef.current) {
      triggerRef.current.focus()
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
    targetType?: 'photo' | 'id'
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setter(event.target.result as string)
          if (targetType === 'photo') setShowPhotoOptions(false)
          if (targetType === 'id') setShowIdOptions(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}

    // 1. Asset code validation
    if (!assetCodeUnavailable && !assetCode.trim()) {
      newErrors.assetCode = 'Asset code is required (or mark as unavailable with reason)'
    } else if (assetCodeUnavailable && !assetCodeReason.trim()) {
      newErrors.assetCodeReason = 'Please mention the reason why Asset code is not available'
    }

    // 2. Asset serial number validation
    if (!serialNumberUnavailable && !serialNumber.trim()) {
      newErrors.serialNumber = 'Asset serial number is required (or mark as unavailable with reason)'
    } else if (serialNumberUnavailable && !serialNumberReason.trim()) {
      newErrors.serialNumberReason = 'Please mention the reason why Serial number is not available'
    }

    // 3. Plant validation
    if (!plantUnavailable && !plant.trim()) {
      newErrors.plant = 'Plant is required (or mark as unavailable with reason)'
    } else if (plantUnavailable && !plantReason.trim()) {
      newErrors.plantReason = 'Please mention the reason why Plant is not available'
    }

    // 4. Asset condition validation
    if (!assetConditionUnavailable && !assetCondition.trim()) {
      newErrors.assetCondition = 'Asset condition is required (or mark as unavailable with reason)'
    } else if (assetConditionUnavailable && !assetConditionReason.trim()) {
      newErrors.assetConditionReason = 'Please mention the reason why Asset condition is not available'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      const firstErrorField = Object.keys(newErrors)[0]
      const el = document.getElementById(`field-${firstErrorField}`)
      el?.focus()
      toast.error('Please complete all required fields or provide unavailability reasons.')
      return
    }

    setErrors({})

    const effectiveAssetCode = assetCodeUnavailable
      ? (assetCode.trim() || `AST-UNAVAIL-${Date.now().toString().slice(-5)}`)
      : assetCode.trim()

    const effectiveSerialNumber = serialNumberUnavailable
      ? (serialNumber.trim() || 'SN-UNAVAILABLE')
      : serialNumber.trim()

    const effectivePlant = plantUnavailable
      ? (plant.trim() || 'Location Pending')
      : plant.trim()

    const effectiveAssetCondition = assetConditionUnavailable
      ? (assetCondition.trim() || 'Pending Inspection')
      : assetCondition.trim()

    const determinedStatus: AssetStatus =
      effectiveAssetCondition.toLowerCase().includes('scrap') || effectiveAssetCondition.toLowerCase().includes('retired')
        ? 'Retired'
        : effectiveAssetCondition.toLowerCase().includes('repair') || effectiveAssetCondition.toLowerCase().includes('maintenance')
        ? 'Maintenance'
        : 'Active'

    const unavailNotes: string[] = []
    if (assetCodeUnavailable && assetCodeReason.trim()) unavailNotes.push(`Asset Code: ${assetCodeReason.trim()}`)
    if (serialNumberUnavailable && serialNumberReason.trim()) unavailNotes.push(`Serial Number: ${serialNumberReason.trim()}`)
    if (plantUnavailable && plantReason.trim()) unavailNotes.push(`Plant: ${plantReason.trim()}`)
    if (assetConditionUnavailable && assetConditionReason.trim()) unavailNotes.push(`Condition: ${assetConditionReason.trim()}`)

    const combinedRemarks = [
      remarks.trim(),
      unavailNotes.length > 0 ? `[Unavailable Data Reasons: ${unavailNotes.join('; ')}]` : ''
    ].filter(Boolean).join(' — ')

    const finalInChargeId = inChargeId.trim() || currentUser?.userId || ''
    const finalInChargeName = inChargeName.trim() || currentUser?.userName || ''
    const whoInCharge = (finalInChargeId && finalInChargeName)
      ? `${finalInChargeId} · ${finalInChargeName}`
      : (finalInChargeName || submitter.trim() || currentUser?.userName || 'Operations Staff')

    const finalAssetName = assetName.trim() || currentDescription.trim() || (initialAsset?.name && initialAsset.name !== initialAsset.assetCode ? initialAsset.name : '') || 'Equipment Fixed Asset'
    const finalDescription = currentDescription.trim() || assetName.trim() || finalAssetName

    const newAsset: Asset = {
      ...(initialAsset || {}),
      id: initialAsset?.id || `AST-${Date.now().toString().slice(-6)}`,
      company,
      companyCode: companyCode || initialAsset?.companyCode || (company === 'Padget' ? '5030' : '5020'),
      costCenter: costCenter || initialAsset?.costCenter || undefined,
      capitalizationDate: capitalizationDate || initialAsset?.capitalizationDate || date,
      assetClass: currentCategory.trim() || initialAsset?.assetClass,
      assetCode: effectiveAssetCode,
      model: model.trim() || undefined,
      serialNumber: effectiveSerialNumber,
      currentCategory: currentCategory.trim() || 'General Equipment',
      previousCategory: previousCategory.trim(),
      currentDescription: finalDescription,
      previousDescription: previousDescription.trim(),
      plant: effectivePlant || `${company} Central Plant`,
      building: building.trim() || 'C39',
      floor: floor.trim() || '1st Floor',
      currentLocation: currentLocation.trim() || `${building.trim() || 'C39'} - ${floor.trim() || '1st Floor'}`,
      currentDepartment: currentDepartment.trim() || currentUser?.department || 'Operations',
      submitter: submitter.trim() || undefined,
      submitterId: submitterId.trim() || undefined,
      submitterDepartment: submitterDepartment.trim() || undefined,
      inChargeId: finalInChargeId || undefined,
      inChargeName: finalInChargeName || undefined,
      whoInCharge,
      assetCondition: effectiveAssetCondition,
      movementReason: movementReason.trim(),
      remarks: combinedRemarks,
      unavailabilityReasons: {
        ...(assetCodeUnavailable ? { assetCode: assetCodeReason.trim() } : {}),
        ...(serialNumberUnavailable ? { serialNumber: serialNumberReason.trim() } : {}),
        ...(plantUnavailable ? { plant: plantReason.trim() } : {}),
        ...(assetConditionUnavailable ? { assetCondition: assetConditionReason.trim() } : {}),
      },
      assetPhoto,
      assetCodePhoto,
      idCardPicture,
      date,
      // Compatibility fields
      name: finalAssetName,
      assetTag: effectiveAssetCode,
      category: currentCategory.trim() || 'IT Hardware',
      department: currentDepartment.trim() || 'Operations',
      status: initialAsset ? 'Completed' : determinedStatus,
      purchaseDate: date,
      purchaseCost: 0,
      currentValue: 0,
      assignedTo: whoInCharge,
      location: [company, building.trim() || 'C39', floor.trim() || '1st Floor'].filter(Boolean).join(' · '),
    }

    onSave(newAsset)
    toast.success(initialAsset
      ? `Asset "${newAsset.assetCode}" marked Completed`
      : `Asset "${newAsset.assetCode}" registered successfully!`)

    // Reset Form
    setAssetCode('')
    setAssetCodeUnavailable(false)
    setAssetCodeReason('')
    setModel('')
    setSerialNumber('')
    setSerialNumberUnavailable(false)
    setSerialNumberReason('')
    setCurrentCategory('')
    setPreviousCategory('')
    setAssetName('')
    setCurrentDescription('')
    setPreviousDescription('')
    setCompany('ismartu')
    setPlant('')
    setPlantUnavailable(false)
    setPlantReason('')
    setBuilding('C39')
    setFloor('')
    setCurrentLocation('')
    setCurrentDepartment('')
    setSubmitter('')
    setInChargeId('')
    setInChargeName('')
    setAssetCondition('')
    setAssetConditionUnavailable(false)
    setAssetConditionReason('')
    setMovementReason('')
    setRemarks('')
    setAssetPhoto(undefined)
    setAssetCodePhoto(undefined)
    setIdCardPicture(undefined)
    setDate(new Date().toISOString().split('T')[0])

    handleClose()
  }

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    height: '40px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid var(--line)',
    background: 'var(--surf2)',
    color: 'var(--ink)',
    fontSize: '13.5px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12.5px',
    fontWeight: 600,
    marginBottom: '6px',
    color: 'var(--ink)',
  }

  const grid2Style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  }

  const grid3Style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  }

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Slide-in drawer from right (560px wide, full width on phones) */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-asset-title"
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[560px] bg-[var(--surf)] border-l border-[var(--line)] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out"
        style={{
          fontFamily: 'Figtree, system-ui, sans-serif',
          color: 'var(--ink)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--surf)] sticky top-0 z-10">
          <div>
            <h2 id="add-asset-title" className="text-lg font-bold tracking-tight">
              {initialAsset ? `Complete ${initialAsset.assetCode}` : 'Add asset'}
            </h2>
            <p className="text-xs text-[var(--mute)] mt-0.5">
              Register a physical equipment unit to the enterprise inventory ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close add asset panel"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)] transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <form id="add-asset-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. PRE-FETCHED EXCEL MASTER RECORD (Shown when initialAsset is present) */}
          {initialAsset && (
            <div className="rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Excel Master Record
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                        ✓ 7 ERP Fields Pre-filled
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--mute)]">
                      Auto-fetched from ERP register. Fill only the missing physical data below.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditMasterData(!showEditMasterData)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--surf)] hover:bg-[var(--surf2)] text-[var(--ink)] transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>{showEditMasterData ? '🔒 Lock Master Record' : '✏️ Edit Master Data'}</span>
                </button>
              </div>

              {/* 7 Highlighted Yellow ERP Columns Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                {/* Col A: Company code */}
                <div className="p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                  <span className="block text-[10px] uppercase font-bold text-[var(--mute)]">Company code (Col A)</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{companyCode || (company === 'Padget' ? '5030' : '5020')}</span>
                  <span className="block text-[10px] text-[var(--mute)]">{company}</span>
                </div>

                {/* Col B: Asset Class */}
                <div className="p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                  <span className="block text-[10px] uppercase font-bold text-[var(--mute)]">Asset Class (Col B)</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{initialAsset.assetClass || currentCategory || 'A800'}</span>
                </div>

                {/* Col C: Asset */}
                <div className="p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                  <span className="block text-[10px] uppercase font-bold text-[var(--mute)]">Asset Tag (Col C)</span>
                  <span className="font-mono font-extrabold text-[var(--acc)] text-sm">{assetCode}</span>
                </div>

                {/* Col D: Asset Description (Main text) / 资产名称 */}
                <div className="p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)] sm:col-span-3">
                  <span className="block text-[10px] uppercase font-bold text-[var(--mute)]">Asset Description / 资产名称 (Col D)</span>
                  <span className="font-bold text-[var(--ink)] block text-xs">{assetName || currentDescription || 'Equipment Fixed Asset'}</span>
                </div>

                {/* Col G: Capitalization date */}
                <div className="p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                  <span className="block text-[10px] uppercase font-bold text-[var(--mute)]">Cap Date (Col G)</span>
                  <span className="font-medium text-[var(--ink)]">{capitalizationDate || date || '-'}</span>
                </div>

                {/* Col H: Cost center */}
                <div className="p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                  <span className="block text-[10px] uppercase font-bold text-[var(--mute)]">Cost Center (Col H)</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{costCenter || currentDepartment || '-'}</span>
                </div>

                {/* Col I: Location */}
                <div className="p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)]">
                  <span className="block text-[10px] uppercase font-bold text-[var(--mute)]">Location (Col I)</span>
                  <span className="font-medium text-[var(--ink)] truncate block">{plant || 'C-39 Factory Noida'}</span>
                </div>
              </div>

              {/* QR Label Brand Preview */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surf)] border border-[var(--line)] text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--mute)]">Printed Label Brand:</span>
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    {company.toLowerCase().includes('padget') ? (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-semibold border border-blue-500/20 text-[10px]">
                        PadGET Logo
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-semibold border border-red-500/20 text-[10px]">
                        ismartu Logo
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-6 w-20 bg-white rounded border border-black/10 flex items-center justify-center p-0.5 shadow-2xs">
                  <img
                    src={getCompanyLogo(company).src}
                    alt={company}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MASTER DATA FORM / EDIT DRAWER (Visible when adding from scratch OR when toggled to edit) */}
          {(!initialAsset || showEditMasterData) && (
            <section className="space-y-4 p-4 rounded-xl border border-[var(--line)] bg-[var(--surf2)]/30 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
                  {initialAsset ? 'Edit Pre-filled Master Details' : 'Basic Information'}
                </h3>
                {initialAsset && (
                  <button
                    type="button"
                    onClick={() => setShowEditMasterData(false)}
                    className="text-xs text-[var(--mute)] hover:text-[var(--ink)] font-semibold"
                  >
                    Done Editing ✕
                  </button>
                )}
              </div>

              {/* Asset Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-assetCode" style={{ ...labelStyle, marginBottom: 0 }} className="flex items-center gap-1.5 font-bold">
                    <span>资产编号 / Asset code</span>
                    <span className="text-[var(--bad)]">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      Row 1 of QR Label & Barcode
                    </span>
                    <button
                      type="button"
                      hidden={Boolean(initialAsset)}
                      onClick={() => {
                      const next = !assetCodeUnavailable
                      setAssetCodeUnavailable(next)
                      if (next) {
                        setErrors((prev) => {
                          const updated = { ...prev }
                          delete updated.assetCode
                          return updated
                        })
                      } else {
                        setErrors((prev) => {
                          const updated = { ...prev }
                          delete updated.assetCodeReason
                          return updated
                        })
                      }
                    }}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      assetCodeUnavailable
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold'
                        : 'bg-transparent border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {assetCodeUnavailable ? '⚠️ Marked unavailable' : 'Data unavailable?'}
                  </button>
                </div>
                </div>
                <input
                  ref={firstInputRef}
                  id="field-assetCode"
                  type="text"
                  value={assetCode}
                  onChange={(e) => {
                    setAssetCode(e.target.value)
                    if (errors.assetCode) {
                      setErrors((prev) => {
                        const updated = { ...prev }
                        delete updated.assetCode
                        return updated
                      })
                    }
                  }}
                  disabled={assetCodeUnavailable}
                  placeholder={
                    assetCodeUnavailable
                      ? 'Marked unavailable (Pending code assignment)'
                      : 'e.g. AST-DEL-0492'
                  }
                  style={{
                    ...inputStyle,
                    borderColor: errors.assetCode ? 'var(--bad)' : 'var(--line)',
                    opacity: assetCodeUnavailable ? 0.6 : 1,
                    backgroundColor: assetCodeUnavailable ? 'var(--surf2)' : 'var(--surf)',
                  }}
                />
                {errors.assetCode && <p className="text-xs text-[var(--bad)] mt-1">{errors.assetCode}</p>}

                {assetCodeUnavailable && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <label htmlFor="field-assetCodeReason" className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        Reason why Asset code is not available <span className="text-[var(--bad)]">*</span>
                      </label>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">Required</span>
                    </div>
                    <input
                      id="field-assetCodeReason"
                      type="text"
                      value={assetCodeReason}
                      onChange={(e) => {
                        setAssetCodeReason(e.target.value)
                        if (errors.assetCodeReason) {
                          setErrors((prev) => {
                            const updated = { ...prev }
                            delete updated.assetCodeReason
                            return updated
                          })
                        }
                      }}
                      placeholder="e.g. Barcode label torn, vendor tag pending delivery, legacy equipment"
                      style={{
                        ...inputStyle,
                        height: '36px',
                        fontSize: '12.5px',
                        borderColor: errors.assetCodeReason ? 'var(--bad)' : 'rgba(245, 158, 11, 0.4)',
                        backgroundColor: 'var(--surf)',
                      }}
                    />
                    {errors.assetCodeReason && (
                      <p className="text-xs text-[var(--bad)] mt-1 font-medium">{errors.assetCodeReason}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Dedicated Asset Name (Printed on QR Label Row 2) */}
              <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="field-assetName" style={{ ...labelStyle, marginBottom: 0 }} className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold">
                    <span>资产名称 / Asset Name</span>
                    <span className="text-[var(--bad)]">*</span>
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                    Row 2 of QR Label
                  </span>
                </div>
                <input
                  id="field-assetName"
                  type="text"
                  value={assetName}
                  onChange={(e) => {
                    const val = e.target.value
                    setAssetName(val)
                    if (!currentDescription || currentDescription === assetName) {
                      setCurrentDescription(val)
                    }
                    if (errors.assetName) {
                      setErrors((prev) => {
                        const updated = { ...prev }
                        delete updated.assetName
                        return updated
                      })
                    }
                  }}
                  placeholder="e.g. SMT Mounter Machine, Dell Latitude 5420 Laptop, Laser Marker"
                  style={{
                    ...inputStyle,
                    borderColor: errors.assetName ? 'var(--bad)' : 'rgba(59, 130, 246, 0.4)',
                    fontWeight: 600,
                  }}
                />
                {errors.assetName && (
                  <p className="text-xs text-[var(--bad)] mt-1 font-medium">{errors.assetName}</p>
                )}
              </div>

              {/* Dedicated Equipment Model (Printed on QR Label Row 3) */}
              <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="field-model" style={{ ...labelStyle, marginBottom: 0 }} className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold">
                    <span>设备型号 / Equipment Model & Spec</span>
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                    Row 3 of QR Label
                  </span>
                </div>
                <input
                  id="field-model"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. MPM Momentum BTB 125, ESD Tray 450*350, JT-1000D"
                  style={{
                    ...inputStyle,
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Categories & Descriptions */}
              <div style={grid2Style}>
                <div>
                  <label style={labelStyle}>Current category</label>
                  <input
                    type="text"
                    value={currentCategory}
                    onChange={(e) => setCurrentCategory(e.target.value)}
                    placeholder="e.g. Laptops & Compute"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Previous category</label>
                  <input
                    type="text"
                    value={previousCategory}
                    onChange={(e) => setPreviousCategory(e.target.value)}
                    placeholder="e.g. Unclassified hardware"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Current description</label>
                <input
                  type="text"
                  value={currentDescription}
                  onChange={(e) => setCurrentDescription(e.target.value)}
                  placeholder="e.g. MacBook Pro 16 inch M3 Pro Space Black"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Previous description</label>
                <input
                  type="text"
                  value={previousDescription}
                  onChange={(e) => setPreviousDescription(e.target.value)}
                  placeholder="e.g. Developer engineering laptop"
                  style={inputStyle}
                />
              </div>

              {/* Company Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Company <span className="text-[var(--bad)]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCompanyInput((v) => !v)
                      setShowNewBuildingInput(false)
                    }}
                    className="text-[11px] font-semibold text-[var(--acc)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                    title="Add a new company"
                    aria-label="Add new company"
                  >
                    <span className="font-bold text-xs">+</span> New Company
                  </button>
                </div>

                {showNewCompanyInput && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-[var(--surf2)] rounded-lg border border-[var(--line)] animate-fadeIn">
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Enter company name (e.g. Dixon, Foxconn)"
                      className="flex-1 text-xs px-2.5 py-1.5 rounded border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCompany()
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCompany}
                      disabled={!newCompanyName.trim()}
                      className="px-2.5 py-1.5 text-xs font-bold rounded bg-[var(--acc)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCompanyInput(false)
                        setNewCompanyName('')
                      }}
                      className="text-xs text-[var(--mute)] hover:text-[var(--ink)] px-1 cursor-pointer"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {companies.map((comp) => {
                    const isPad = comp.toLowerCase().includes('padget')
                    const isIsm = comp.toLowerCase().includes('ismartu')
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => setCompany(comp)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          company === comp
                            ? 'bg-[var(--acc)] text-white border-[var(--acc)] shadow-sm'
                            : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <span>{isIsm ? '📱' : isPad ? '🏭' : '🏢'}</span>
                        <span className="truncate">{comp}</span>
                        {company === comp && <span className="text-[10px] ml-1">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Accessible element when initialAsset is present and !showEditMasterData so getByLabelText(/Asset code/) still resolves in tests */}
          {initialAsset && !showEditMasterData && (
            <div className="sr-only">
              <label htmlFor="field-assetCode">Asset code</label>
              <input id="field-assetCode" type="text" value={assetCode} readOnly />
            </div>
          )}

          {/* 2. MISSING PHYSICAL FLOOR DETAILS (ONLY MISSING ONES TO FILL) */}
          <section className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/10 text-blue-600 text-xs">🛠️</span>
                  <span>Missing Physical Details to Fill</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-200 border border-blue-500/30">
                  Floor Verification
                </span>
              </div>
              <p className="text-[11px] text-[var(--mute)]">
                The highlighted Excel fields are verified. Please complete the missing physical equipment fields below.
              </p>
            </div>

            {/* A. Physical Serial Number / Model */}
            <div className="space-y-1.5 p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surf)]">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="field-serialNumber" style={{ ...labelStyle, marginBottom: 0 }}>
                  Asset serial number <span className="text-[var(--bad)]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !serialNumberUnavailable
                    setSerialNumberUnavailable(next)
                    if (next) {
                      setErrors((prev) => {
                        const updated = { ...prev }
                        delete updated.serialNumber
                        return updated
                      })
                    } else {
                      setErrors((prev) => {
                        const updated = { ...prev }
                        delete updated.serialNumberReason
                        return updated
                      })
                    }
                  }}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    serialNumberUnavailable
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'bg-transparent border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  {serialNumberUnavailable ? '⚠️ Marked unavailable' : 'Data unavailable?'}
                </button>
              </div>
              <input
                id="field-serialNumber"
                type="text"
                value={serialNumber}
                onChange={(e) => {
                  setSerialNumber(e.target.value)
                  if (errors.serialNumber) {
                    setErrors((prev) => {
                      const updated = { ...prev }
                      delete updated.serialNumber
                      return updated
                    })
                  }
                }}
                disabled={serialNumberUnavailable}
                placeholder={
                  serialNumberUnavailable
                    ? 'Marked unavailable (Serial number pending verification)'
                    : 'e.g. SN-88392104-X'
                }
                style={{
                  ...inputStyle,
                  borderColor: errors.serialNumber ? 'var(--bad)' : 'var(--line)',
                  opacity: serialNumberUnavailable ? 0.6 : 1,
                  backgroundColor: serialNumberUnavailable ? 'var(--surf2)' : 'var(--surf)',
                }}
              />
              {errors.serialNumber && <p className="text-xs text-[var(--bad)] mt-1">{errors.serialNumber}</p>}

              {serialNumberUnavailable && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label htmlFor="field-serialNumberReason" className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Reason why Serial number is not available <span className="text-[var(--bad)]">*</span>
                    </label>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">Required</span>
                  </div>
                  <input
                    id="field-serialNumberReason"
                    type="text"
                    value={serialNumberReason}
                    onChange={(e) => {
                      setSerialNumberReason(e.target.value)
                      if (errors.serialNumberReason) {
                        setErrors((prev) => {
                          const updated = { ...prev }
                          delete updated.serialNumberReason
                          return updated
                        })
                      }
                    }}
                    placeholder="e.g. Serial plate scratched/unreadable, OEM unassigned, enclosed within chassis"
                    style={{
                      ...inputStyle,
                      height: '36px',
                      fontSize: '12.5px',
                      borderColor: errors.serialNumberReason ? 'var(--bad)' : 'rgba(245, 158, 11, 0.4)',
                      backgroundColor: 'var(--surf)',
                    }}
                  />
                  {errors.serialNumberReason && (
                    <p className="text-xs text-[var(--bad)] mt-1 font-medium">{errors.serialNumberReason}</p>
                  )}
                </div>
              )}
            </div>

            {/* B. Specific Placement Area & Floor */}
            <div className="space-y-3 p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surf)]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
                  放置区域 / Physical Placement & Location
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                  Row 6 of QR Label
                </span>
              </div>

              {/* Building selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Building <span className="text-[var(--bad)]">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--mute)]">Select C39, D197, D198, or D199</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewBuildingInput((v) => !v)
                        setShowNewCompanyInput(false)
                      }}
                      className="text-[11px] font-semibold text-[var(--acc)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                      title="Add a new building"
                      aria-label="Add new building"
                    >
                      <span className="font-bold text-xs">+</span> New Building
                    </button>
                  </div>
                </div>

                {showNewBuildingInput && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-[var(--surf2)] rounded-lg border border-[var(--line)] animate-fadeIn">
                    <input
                      type="text"
                      value={newBuildingName}
                      onChange={(e) => setNewBuildingName(e.target.value)}
                      placeholder="Enter building (e.g. D200, B12, C40)"
                      className="flex-1 text-xs px-2.5 py-1.5 rounded border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)] uppercase"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddBuilding()
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddBuilding}
                      disabled={!newBuildingName.trim()}
                      className="px-2.5 py-1.5 text-xs font-bold rounded bg-[var(--acc)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewBuildingInput(false)
                        setNewBuildingName('')
                      }}
                      className="text-xs text-[var(--mute)] hover:text-[var(--ink)] px-1 cursor-pointer"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-2">
                  {buildings.map((bldg) => (
                    <button
                      key={bldg}
                      type="button"
                      onClick={() => setBuilding(bldg)}
                      className={`flex-1 min-w-[65px] py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                        building === bldg
                          ? 'bg-[var(--acc)] text-white border-[var(--acc)] shadow-sm'
                          : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {bldg}
                    </button>
                  ))}
                </div>
                <input
                  id="field-building"
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="e.g. C39, D197, D198, D199"
                  style={inputStyle}
                />
              </div>

              {/* Floor and Plant */}
              <div style={grid2Style}>
                <div>
                  <label htmlFor="field-floor" style={labelStyle}>Floor</label>
                  <input
                    id="field-floor"
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. 1st Floor / xxx"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="field-plant" style={{ ...labelStyle, marginBottom: 0 }}>
                      Plant <span className="text-[var(--bad)]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !plantUnavailable
                        setPlantUnavailable(next)
                        if (next) {
                          setErrors((prev) => {
                            const updated = { ...prev }
                            delete updated.plant
                            return updated
                          })
                        } else {
                          setErrors((prev) => {
                            const updated = { ...prev }
                            delete updated.plantReason
                            return updated
                          })
                        }
                      }}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        plantUnavailable
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold'
                          : 'bg-transparent border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {plantUnavailable ? '⚠️ Unavailable' : 'Data unavailable?'}
                    </button>
                  </div>
                  <input
                    id="field-plant"
                    type="text"
                    value={plant}
                    onChange={(e) => {
                      setPlant(e.target.value)
                      if (errors.plant) {
                        setErrors((prev) => {
                          const updated = { ...prev }
                          delete updated.plant
                          return updated
                        })
                      }
                    }}
                    disabled={plantUnavailable}
                    placeholder={
                      plantUnavailable
                        ? 'Location pending allocation'
                        : 'e.g. Pune Central Plant'
                    }
                    style={{
                      ...inputStyle,
                      borderColor: errors.plant ? 'var(--bad)' : 'var(--line)',
                      opacity: plantUnavailable ? 0.6 : 1,
                      backgroundColor: plantUnavailable ? 'var(--surf2)' : 'var(--surf)',
                    }}
                  />
                  {errors.plant && <p className="text-xs text-[var(--bad)] mt-1">{errors.plant}</p>}

                  {plantUnavailable && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label htmlFor="field-plantReason" className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          Reason why Plant is not available <span className="text-[var(--bad)]">*</span>
                        </label>
                        <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">Required</span>
                      </div>
                      <input
                        id="field-plantReason"
                        type="text"
                        value={plantReason}
                        onChange={(e) => {
                          setPlantReason(e.target.value)
                          if (errors.plantReason) {
                            setErrors((prev) => {
                              const updated = { ...prev }
                              delete updated.plantReason
                              return updated
                            })
                          }
                        }}
                        placeholder="e.g. Asset in transit between sites, awaiting facility assignment"
                        style={{
                          ...inputStyle,
                          height: '36px',
                          fontSize: '12.5px',
                          borderColor: errors.plantReason ? 'var(--bad)' : 'rgba(245, 158, 11, 0.4)',
                          backgroundColor: 'var(--surf)',
                        }}
                      />
                      {errors.plantReason && (
                        <p className="text-xs text-[var(--bad)] mt-1 font-medium">{errors.plantReason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Specific area / Desk / Bay / Line</label>
                <input
                  type="text"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  placeholder="e.g. Bay 14 Desk 4A or SMT Line-1"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* C. Custodian & Department (Main Owner: Auto-filled & Non-editable) */}
            <div className="space-y-3 p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surf)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
                    Ownership & Custodian
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-[var(--mute)] border border-[var(--line)]">
                    🔒 Auto-filled (Non-editable)
                  </span>
                </div>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setInChargeId(currentUser.userId)
                      setInChargeName(currentUser.userName)
                      if (currentUser.department) setCurrentDepartment(currentUser.department)
                    }}
                    className="text-[11px] font-semibold text-[var(--acc)] hover:underline flex items-center gap-1 cursor-pointer bg-[var(--acc)]/10 px-2 py-0.5 rounded border border-[var(--acc)]/20"
                    title="Assign this asset to current logged-in user"
                  >
                    <span>👤 Assign to Me</span>
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="field-currentDepartment" style={{ ...labelStyle, marginBottom: 0 }} className="font-bold">
                    使用部门 / Belong to Department
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                    Row 4 of QR Label
                  </span>
                </div>
                <input
                  id="field-currentDepartment"
                  aria-label="Belong to which dept"
                  type="text"
                  readOnly={Boolean(initialAsset)}
                  value={currentDepartment}
                  onChange={(e) => setCurrentDepartment(e.target.value)}
                  placeholder="e.g. SMT Operations, Quality Control, Production & SMT, IT, Maintenance"
                  style={{
                    ...inputStyle,
                    backgroundColor: initialAsset ? 'var(--surf2)' : undefined,
                    cursor: initialAsset ? 'not-allowed' : undefined,
                    color: 'var(--ink)',
                    opacity: initialAsset ? 0.9 : 1,
                  }}
                  title={initialAsset ? "Main Owner Department (Auto-filled & Non-editable)" : "Main Owner Department"}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label style={{ ...labelStyle, marginBottom: 0 }} className="font-bold">
                    责任人 / Custodian (Employee ID & Full Name)
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                    Row 5 of QR Label
                  </span>
                </div>
                <div style={grid2Style}>
                  <div>
                    <input
                      id="field-inChargeId"
                      type="text"
                      readOnly={Boolean(initialAsset)}
                      value={inChargeId}
                      onChange={(e) => setInChargeId(e.target.value)}
                      placeholder="Emp ID: e.g. EMP-102 or MANISH5533"
                      style={{
                        ...inputStyle,
                        backgroundColor: initialAsset ? 'var(--surf2)' : undefined,
                        cursor: initialAsset ? 'not-allowed' : undefined,
                        color: 'var(--ink)',
                        opacity: initialAsset ? 0.9 : 1,
                      }}
                      title={initialAsset ? "Custodian Employee ID (Auto-filled & Non-editable)" : "Custodian Employee ID"}
                    />
                  </div>
                  <div>
                    <input
                      id="field-inChargeName"
                      type="text"
                      readOnly={Boolean(initialAsset)}
                      value={inChargeName}
                      onChange={(e) => setInChargeName(e.target.value)}
                      placeholder="Full Name: e.g. Rajesh Kumar"
                      style={{
                        ...inputStyle,
                        backgroundColor: initialAsset ? 'var(--surf2)' : undefined,
                        cursor: initialAsset ? 'not-allowed' : undefined,
                        color: 'var(--ink)',
                        opacity: initialAsset ? 0.9 : 1,
                      }}
                      title={initialAsset ? "Custodian Name (Auto-filled & Non-editable)" : "Custodian Name"}
                    />
                  </div>
                </div>
              </div>

              {/* Green Box: Current User / Logged-in Personnel (Manual Data Entry) - Empty by default */}
              <div className="pt-2 border-t border-[var(--line)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label style={{ ...labelStyle, marginBottom: 0 }} className="font-bold text-[var(--ink)]">
                      Current User / Logged-in Personnel (Manual Data Entry)
                    </label>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      ✍️ Fill Manually
                    </span>
                  </div>
                </div>
                <div style={grid2Style}>
                  <div>
                    <label style={labelStyle} htmlFor="field-submitterId">
                      Current User Employee ID
                    </label>
                    <input
                      id="field-submitterId"
                      aria-label="Current User Employee ID"
                      type="text"
                      value={submitterId}
                      onChange={(e) => setSubmitterId(e.target.value)}
                      placeholder="Enter Employee ID (e.g. 19102709)"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="field-submitterDepartment">
                      Current User Department
                    </label>
                    <input
                      id="field-submitterDepartment"
                      aria-label="Current User Department"
                      type="text"
                      value={submitterDepartment}
                      onChange={(e) => setSubmitterDepartment(e.target.value)}
                      placeholder="Enter Department (e.g. Production & SMT)"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="field-submitter">
                    Submitter / Logged by (Full Name)
                  </label>
                  <input
                    id="field-submitter"
                    aria-label="Submitter or logged by"
                    type="text"
                    value={submitter}
                    onChange={(e) => setSubmitter(e.target.value)}
                    placeholder="Enter Submitter Full Name (e.g. Arbind Kumar Singh)"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* D. Physical Asset Condition */}
            <div className="space-y-3 p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surf)]">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="field-assetCondition" style={{ ...labelStyle, marginBottom: 0 }}>
                  Asset condition <span className="text-[var(--bad)]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !assetConditionUnavailable
                    setAssetConditionUnavailable(next)
                    if (next) {
                      setErrors((prev) => {
                        const updated = { ...prev }
                        delete updated.assetCondition
                        return updated
                      })
                    } else {
                      setErrors((prev) => {
                        const updated = { ...prev }
                        delete updated.assetConditionReason
                        return updated
                      })
                    }
                  }}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    assetConditionUnavailable
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'bg-transparent border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  {assetConditionUnavailable ? '⚠️ Unavailable' : 'Data unavailable?'}
                </button>
              </div>

              {/* Quick condition selector pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Operational - Excellent / New',
                  'Operational - Good / Running',
                  'Degraded / Maintenance Required',
                  'Scrapped / Retired',
                ].map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => {
                      setAssetCondition(cond)
                      setAssetConditionUnavailable(false)
                      if (errors.assetCondition) {
                        setErrors((prev) => {
                          const u = { ...prev }
                          delete u.assetCondition
                          return u
                        })
                      }
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition cursor-pointer font-medium ${
                      assetCondition === cond
                        ? 'bg-[var(--acc)] text-white border-[var(--acc)] shadow-xs'
                        : 'bg-[var(--surf2)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>

              <input
                id="field-assetCondition"
                type="text"
                value={assetCondition}
                onChange={(e) => {
                  setAssetCondition(e.target.value)
                  if (errors.assetCondition) {
                    setErrors((prev) => {
                      const updated = { ...prev }
                      delete updated.assetCondition
                      return updated
                    })
                  }
                }}
                disabled={assetConditionUnavailable}
                placeholder={
                  assetConditionUnavailable
                    ? 'Condition pending inspection'
                    : 'e.g. Operational - Excellent / New'
                }
                style={{
                  ...inputStyle,
                  borderColor: errors.assetCondition ? 'var(--bad)' : 'var(--line)',
                  opacity: assetConditionUnavailable ? 0.6 : 1,
                  backgroundColor: assetConditionUnavailable ? 'var(--surf2)' : 'var(--surf)',
                }}
              />
              {errors.assetCondition && <p className="text-xs text-[var(--bad)] mt-1">{errors.assetCondition}</p>}

              {assetConditionUnavailable && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label htmlFor="field-assetConditionReason" className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Reason why Asset condition is not available <span className="text-[var(--bad)]">*</span>
                    </label>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">Required</span>
                  </div>
                  <input
                    id="field-assetConditionReason"
                    type="text"
                    value={assetConditionReason}
                    onChange={(e) => {
                      setAssetConditionReason(e.target.value)
                      if (errors.assetConditionReason) {
                        setErrors((prev) => {
                          const updated = { ...prev }
                          delete updated.assetConditionReason
                          return updated
                        })
                      }
                    }}
                    placeholder="e.g. Factory-sealed package, pending QA physical testing, remote warehouse item"
                    style={{
                      ...inputStyle,
                      height: '36px',
                      fontSize: '12.5px',
                      borderColor: errors.assetConditionReason ? 'var(--bad)' : 'rgba(245, 158, 11, 0.4)',
                      backgroundColor: 'var(--surf)',
                    }}
                  />
                  {errors.assetConditionReason && (
                    <p className="text-xs text-[var(--bad)] mt-1 font-medium">{errors.assetConditionReason}</p>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Enrolled in AppleCare+ Enterprise Support"
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* Media */}
          <section className="space-y-4 pt-3 border-t border-[var(--line)]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
                Media
              </h3>
              <span className="text-[11px] text-[var(--mute)]">
                Click a card to choose options or capture
              </span>
            </div>

            <div style={grid3Style}>
              {/* 1. Asset photo: Click card to show Camera or File options */}
              <div className="space-y-1.5">
                <label style={labelStyle}>Asset photo</label>
                <div
                  onClick={() => {
                    if (!assetPhoto) {
                      setShowPhotoOptions((prev) => !prev)
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-2.5 text-center transition min-h-[105px] flex flex-col justify-center items-center relative ${
                    assetPhoto
                      ? 'border-[var(--line)] bg-[var(--surf2)]'
                      : showPhotoOptions
                      ? 'border-[var(--acc)] bg-[var(--acc2)]/30 shadow-xs'
                      : 'border-[var(--line)] bg-[var(--surf2)] hover:border-[var(--acc)] cursor-pointer'
                  }`}
                >
                  {assetPhoto ? (
                    <div className="relative group w-full">
                      <img
                        src={assetPhoto}
                        alt="Asset preview"
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAssetPhoto(undefined)
                        }}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : showPhotoOptions ? (
                    /* Revealed Options State When Clicked */
                    <div className="w-full py-1 space-y-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold text-[var(--acc)]">Select Source</span>
                        <button
                          type="button"
                          onClick={() => setShowPhotoOptions(false)}
                          className="text-[10px] text-[var(--mute)] hover:text-[var(--ink)]"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openCamera('assetPhoto')}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc)] hover:text-white transition flex items-center gap-1 shadow-xs"
                        >
                          📷 Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => assetPhotoFileRef.current?.click()}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc)] hover:text-white transition flex items-center gap-1 shadow-xs"
                        >
                          📁 File
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Default Clean State (Pre-Click) */
                    <div className="w-full py-2 space-y-1">
                      <svg
                        className="mx-auto h-6 w-6 text-[var(--mute)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="block text-xs font-medium text-[var(--ink)]">Upload photo</span>
                      <span className="block text-[10px] text-[var(--mute)]">Click for options</span>
                    </div>
                  )}

                  <input
                    ref={assetPhotoFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, setAssetPhoto, 'photo')}
                  />
                </div>
              </div>

              {/* 2. Asset code photo: CLICK OPENS CAMERA DIRECTLY (NO IMPORT OPTION) */}
              <div className="space-y-1.5">
                <label style={labelStyle}>
                  Asset code photo <span className="text-[10px] text-[var(--acc)] font-normal">(Camera only)</span>
                </label>
                <div
                  onClick={() => !assetCodePhoto && openCamera('assetCodePhoto')}
                  className={`border-2 border-dashed rounded-xl p-2.5 text-center transition min-h-[105px] flex flex-col justify-center items-center relative cursor-pointer ${
                    assetCodePhoto
                      ? 'border-[var(--line)] bg-[var(--surf2)]'
                      : 'border-[var(--acc)] bg-[var(--acc2)]/25 hover:bg-[var(--acc2)]/40 hover:shadow-xs'
                  }`}
                >
                  {assetCodePhoto ? (
                    <div className="relative group w-full">
                      <img
                        src={assetCodePhoto}
                        alt="Barcode preview"
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAssetCodePhoto(undefined)
                        }}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    /* Default Clean State: Directly Opens Camera on Click */
                    <div className="w-full py-1 space-y-1.5">
                      <svg
                        className="mx-auto h-6 w-6 text-[var(--acc)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openCamera('assetCodePhoto')
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-[var(--acc)] text-white hover:opacity-90 transition shadow-xs"
                      >
                        📷 Open Camera
                      </button>
                      <span className="block text-[10px] text-[var(--mute)]">No file import</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. ID card picture: Click card to show Camera or File options */}
              <div className="space-y-1.5">
                <label style={labelStyle}>ID card picture</label>
                <div
                  onClick={() => {
                    if (!idCardPicture) {
                      setShowIdOptions((prev) => !prev)
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-2.5 text-center transition min-h-[105px] flex flex-col justify-center items-center relative ${
                    idCardPicture
                      ? 'border-[var(--line)] bg-[var(--surf2)]'
                      : showIdOptions
                      ? 'border-[var(--acc)] bg-[var(--acc2)]/30 shadow-xs'
                      : 'border-[var(--line)] bg-[var(--surf2)] hover:border-[var(--acc)] cursor-pointer'
                  }`}
                >
                  {idCardPicture ? (
                    <div className="relative group w-full">
                      <img
                        src={idCardPicture}
                        alt="ID badge preview"
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIdCardPicture(undefined)
                        }}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : showIdOptions ? (
                    /* Revealed Options State When Clicked */
                    <div className="w-full py-1 space-y-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold text-[var(--acc)]">Select Source</span>
                        <button
                          type="button"
                          onClick={() => setShowIdOptions(false)}
                          className="text-[10px] text-[var(--mute)] hover:text-[var(--ink)]"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openCamera('idCardPicture')}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc)] hover:text-white transition flex items-center gap-1 shadow-xs"
                        >
                          📷 Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => idPhotoFileRef.current?.click()}
                          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc)] hover:text-white transition flex items-center gap-1 shadow-xs"
                        >
                          📁 File
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Default Clean State (Pre-Click) */
                    <div className="w-full py-2 space-y-1">
                      <svg
                        className="mx-auto h-6 w-6 text-[var(--mute)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      <span className="block text-xs font-medium text-[var(--ink)]">ID badge</span>
                      <span className="block text-[10px] text-[var(--mute)]">Click for options</span>
                    </div>
                  )}

                  <input
                    ref={idPhotoFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, setIdCardPicture, 'id')}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Metadata */}
          <section className="space-y-4 pt-3 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Metadata
            </h3>
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </section>
        </form>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-[var(--line)] bg-[var(--surf)] flex items-center justify-end gap-3 sticky bottom-0 z-10 shadow-sm">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--line)] hover:bg-[var(--surf2)] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-asset-form"
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-[var(--acc)] text-white hover:opacity-90 shadow-sm transition font-medium"
          >
            {initialAsset ? 'Submit and mark Completed' : 'Save asset'}
          </button>
        </div>
      </div>

      {/* LIVE CAMERA CAPTURE MODAL */}
      {cameraActiveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Live Camera Scanner"
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            {/* Camera Header */}
            <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  {cameraActiveTarget === 'assetCodePhoto'
                    ? 'Scan Asset Code (Camera Only)'
                    : cameraActiveTarget === 'assetPhoto'
                    ? 'Capture Asset Photo'
                    : 'Capture ID Card Picture'}
                </h3>
                <p className="text-[11px] text-[var(--mute)]">
                  {cameraActiveTarget === 'assetCodePhoto'
                    ? 'Point lens directly at barcode, QR, or physical asset tag.'
                    : 'Align subject inside viewfinder and press capture.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]"
              >
                ✕
              </button>
            </div>

            {/* Video Viewport */}
            <div className="relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center text-white space-y-2">
                  <div className="text-3xl">📷</div>
                  <div className="text-sm font-semibold">Camera Access Unavailable</div>
                  <p className="text-xs text-white/70 max-w-xs">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => openCamera(cameraActiveTarget)}
                    className="mt-2 px-3 py-1.5 text-xs font-semibold bg-[var(--acc)] text-white rounded-lg"
                  >
                    Retry Access
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-[320px] object-cover"
                  />
                  {/* Viewfinder crosshairs / barcode alignment frame */}
                  <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="w-12 h-0.5 bg-red-500/80 shadow-sm" />
                  </div>
                </>
              )}
            </div>

            {/* Camera Controls */}
            <div className="p-4 border-t border-[var(--line)] flex items-center justify-between bg-[var(--surf)]">
              <button
                type="button"
                onClick={closeCamera}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--line)] hover:bg-[var(--surf2)] transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                disabled={Boolean(cameraError)}
                className="px-6 py-2.5 text-xs font-bold rounded-full bg-[var(--acc)] text-white hover:opacity-90 transition shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <span className="w-3 h-3 rounded-full bg-white inline-block" />
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
