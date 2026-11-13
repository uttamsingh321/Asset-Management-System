import * as React from 'react'
import type { Asset, AssetStatus } from '@/types/asset'
import { toast } from 'sonner'

interface AddAssetPanelProps {
  open: boolean
  onClose: () => void
  onSave: (asset: Asset) => void
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

type CameraTarget = 'assetPhoto' | 'assetCodePhoto' | 'idCardPicture'

export const AddAssetPanel: React.FC<AddAssetPanelProps> = ({
  open,
  onClose,
  onSave,
  triggerRef,
}) => {
  // Field States
  const [assetCode, setAssetCode] = React.useState('')
  const [serialNumber, setSerialNumber] = React.useState('')
  const [currentCategory, setCurrentCategory] = React.useState('')
  const [previousCategory, setPreviousCategory] = React.useState('')
  const [currentDescription, setCurrentDescription] = React.useState('')
  const [previousDescription, setPreviousDescription] = React.useState('')

  const [plant, setPlant] = React.useState('')
  const [building, setBuilding] = React.useState('')
  const [floor, setFloor] = React.useState('')
  const [currentLocation, setCurrentLocation] = React.useState('')

  const [currentDepartment, setCurrentDepartment] = React.useState('')
  const [submitter, setSubmitter] = React.useState('')

  const [assetCondition, setAssetCondition] = React.useState('')
  const [movementReason, setMovementReason] = React.useState('')
  const [remarks, setRemarks] = React.useState('')

  // Media States
  const [assetPhoto, setAssetPhoto] = React.useState<string | undefined>()
  const [assetCodePhoto, setAssetCodePhoto] = React.useState<string | undefined>()
  const [idCardPicture, setIdCardPicture] = React.useState<string | undefined>()

  const [date, setDate] = React.useState(() => new Date().toISOString().split('T')[0])
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Camera Modal States
  const [cameraActiveTarget, setCameraActiveTarget] = React.useState<CameraTarget | null>(null)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const firstInputRef = React.useRef<HTMLInputElement>(null)
  const drawerRef = React.useRef<HTMLDivElement>(null)
  const assetPhotoFileRef = React.useRef<HTMLInputElement>(null)
  const idPhotoFileRef = React.useRef<HTMLInputElement>(null)

  // Focus management & Escape key handling
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        firstInputRef.current?.focus()
      }, 50)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (cameraActiveTarget) {
            closeCamera()
          } else {
            handleClose()
          }
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, cameraActiveTarget])

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
        videoRef.current.play()
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
    onClose()
    if (triggerRef && triggerRef.current) {
      triggerRef.current.focus()
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setter(event.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!assetCode.trim()) newErrors.assetCode = 'Asset code is required'
    if (!serialNumber.trim()) newErrors.serialNumber = 'Asset serial number is required'
    if (!plant.trim()) newErrors.plant = 'Plant is required'
    if (!assetCondition.trim()) newErrors.assetCondition = 'Asset condition is required'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      const firstErrorField = Object.keys(newErrors)[0]
      const el = document.getElementById(`field-${firstErrorField}`)
      el?.focus()
      toast.error('Please fill in all required fields.')
      return
    }

    setErrors({})

    const determinedStatus: AssetStatus =
      assetCondition.toLowerCase().includes('scrap') || assetCondition.toLowerCase().includes('retired')
        ? 'Retired'
        : assetCondition.toLowerCase().includes('repair') || assetCondition.toLowerCase().includes('maintenance')
        ? 'Maintenance'
        : 'Active'

    const newAsset: Asset = {
      id: `AST-${Date.now().toString().slice(-6)}`,
      assetCode: assetCode.trim(),
      serialNumber: serialNumber.trim(),
      currentCategory: currentCategory.trim() || 'General Equipment',
      previousCategory: previousCategory.trim(),
      currentDescription: currentDescription.trim() || assetCode.trim(),
      previousDescription: previousDescription.trim(),
      plant: plant.trim(),
      building: building.trim(),
      floor: floor.trim(),
      currentLocation: currentLocation.trim() || plant.trim(),
      currentDepartment: currentDepartment.trim() || 'Operations',
      submitter: submitter.trim() || 'Staff',
      assetCondition: assetCondition.trim(),
      movementReason: movementReason.trim(),
      remarks: remarks.trim(),
      assetPhoto,
      assetCodePhoto,
      idCardPicture,
      date,
      // Compatibility fields
      name: currentDescription.trim() || assetCode.trim(),
      assetTag: assetCode.trim(),
      category: currentCategory.trim() || 'IT Hardware',
      department: currentDepartment.trim() || 'Operations',
      status: determinedStatus,
      purchaseDate: date,
      purchaseCost: 0,
      currentValue: 0,
      assignedTo: submitter.trim() || 'Unassigned',
      location: [plant.trim(), building.trim(), floor.trim()].filter(Boolean).join(' - ') || currentLocation.trim(),
    }

    onSave(newAsset)
    toast.success(`Asset "${newAsset.assetCode}" registered successfully!`)

    // Reset Form
    setAssetCode('')
    setSerialNumber('')
    setCurrentCategory('')
    setPreviousCategory('')
    setCurrentDescription('')
    setPreviousDescription('')
    setPlant('')
    setBuilding('')
    setFloor('')
    setCurrentLocation('')
    setCurrentDepartment('')
    setSubmitter('')
    setAssetCondition('')
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
              Add asset
            </h2>
            <p className="text-xs text-[var(--mute)] mt-0.5">
              Register a physical equipment unit to the enterprise inventory ledger.
            </p>
          </div>
          <button
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
          {/* Basic information */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Basic information
            </h3>
            <div className="space-y-4">
              <div>
                <label style={labelStyle}>
                  Asset code <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  id="field-assetCode"
                  type="text"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  placeholder="e.g. AST-DEL-0492"
                  style={{
                    ...inputStyle,
                    borderColor: errors.assetCode ? 'var(--bad)' : 'var(--line)',
                  }}
                />
                {errors.assetCode && <p className="text-xs text-[var(--bad)] mt-1">{errors.assetCode}</p>}
              </div>

              <div>
                <label style={labelStyle}>
                  Asset serial number <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  id="field-serialNumber"
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. SN-88392104-X"
                  style={{
                    ...inputStyle,
                    borderColor: errors.serialNumber ? 'var(--bad)' : 'var(--line)',
                  }}
                />
                {errors.serialNumber && <p className="text-xs text-[var(--bad)] mt-1">{errors.serialNumber}</p>}
              </div>

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
            </div>
          </section>

          {/* Location */}
          <section className="space-y-4 pt-3 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Location
            </h3>
            <div className="space-y-4">
              <div style={grid2Style}>
                <div>
                  <label style={labelStyle}>
                    Plant <span className="text-[var(--bad)]">*</span>
                  </label>
                  <input
                    id="field-plant"
                    type="text"
                    value={plant}
                    onChange={(e) => setPlant(e.target.value)}
                    placeholder="e.g. Pune Central Plant"
                    style={{
                      ...inputStyle,
                      borderColor: errors.plant ? 'var(--bad)' : 'var(--line)',
                    }}
                  />
                  {errors.plant && <p className="text-xs text-[var(--bad)] mt-1">{errors.plant}</p>}
                </div>

                <div>
                  <label style={labelStyle}>Building</label>
                  <input
                    type="text"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    placeholder="e.g. Block B Tech Wing"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={grid2Style}>
                <div>
                  <label style={labelStyle}>Floor</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. 4th Floor"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Current location</label>
                  <input
                    type="text"
                    value={currentLocation}
                    onChange={(e) => setCurrentLocation(e.target.value)}
                    placeholder="e.g. Bay 14 Desk 4A"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Ownership */}
          <section className="space-y-4 pt-3 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Ownership
            </h3>
            <div style={grid2Style}>
              <div>
                <label style={labelStyle}>Current department</label>
                <input
                  type="text"
                  value={currentDepartment}
                  onChange={(e) => setCurrentDepartment(e.target.value)}
                  placeholder="e.g. Platform Engineering"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Submitter</label>
                <input
                  type="text"
                  value={submitter}
                  onChange={(e) => setSubmitter(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* Asset status */}
          <section className="space-y-4 pt-3 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Asset status
            </h3>
            <div className="space-y-4">
              <div>
                <label style={labelStyle}>
                  Asset condition <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  id="field-assetCondition"
                  type="text"
                  value={assetCondition}
                  onChange={(e) => setAssetCondition(e.target.value)}
                  placeholder="e.g. Operational - Excellent / New"
                  style={{
                    ...inputStyle,
                    borderColor: errors.assetCondition ? 'var(--bad)' : 'var(--line)',
                  }}
                />
                {errors.assetCondition && <p className="text-xs text-[var(--bad)] mt-1">{errors.assetCondition}</p>}
              </div>

              <div>
                <label style={labelStyle}>Movement reason</label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Initial provisioning to staff member"
                  style={inputStyle}
                />
              </div>

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
                Asset code is camera-only; others support camera or file
              </span>
            </div>

            <div style={grid3Style}>
              {/* 1. Asset photo: Camera OR File */}
              <div className="space-y-1.5">
                <label style={labelStyle}>Asset photo</label>
                <div className="border-2 border-dashed border-[var(--line)] rounded-xl p-2.5 text-center bg-[var(--surf2)] hover:border-[var(--acc)] transition min-h-[105px] flex flex-col justify-center items-center">
                  {assetPhoto ? (
                    <div className="relative group w-full">
                      <img
                        src={assetPhoto}
                        alt="Asset preview"
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setAssetPhoto(undefined)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-full py-1 space-y-2">
                      <svg
                        className="mx-auto h-5 w-5 text-[var(--mute)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openCamera('assetPhoto')}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc2)] hover:text-[var(--acc)] transition flex items-center gap-1"
                        >
                          📷 Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => assetPhotoFileRef.current?.click()}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc2)] hover:text-[var(--acc)] transition flex items-center gap-1"
                        >
                          📁 File
                        </button>
                      </div>
                      <input
                        ref={assetPhotoFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setAssetPhoto)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Asset code photo: CAMERA ONLY (NO IMPORT OPTION) */}
              <div className="space-y-1.5">
                <label style={labelStyle}>
                  Asset code photo <span className="text-[10px] text-[var(--acc)] font-normal">(Camera only)</span>
                </label>
                <div
                  onClick={() => !assetCodePhoto && openCamera('assetCodePhoto')}
                  className={`border-2 border-dashed rounded-xl p-2.5 text-center transition min-h-[105px] flex flex-col justify-center items-center ${
                    assetCodePhoto
                      ? 'border-[var(--line)] bg-[var(--surf2)]'
                      : 'border-[var(--acc)] bg-[var(--acc2)]/25 cursor-pointer hover:bg-[var(--acc2)]/40'
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

              {/* 3. ID card picture: Camera OR File */}
              <div className="space-y-1.5">
                <label style={labelStyle}>ID card picture</label>
                <div className="border-2 border-dashed border-[var(--line)] rounded-xl p-2.5 text-center bg-[var(--surf2)] hover:border-[var(--acc)] transition min-h-[105px] flex flex-col justify-center items-center">
                  {idCardPicture ? (
                    <div className="relative group w-full">
                      <img
                        src={idCardPicture}
                        alt="ID badge preview"
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setIdCardPicture(undefined)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-full py-1 space-y-2">
                      <svg
                        className="mx-auto h-5 w-5 text-[var(--mute)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openCamera('idCardPicture')}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc2)] hover:text-[var(--acc)] transition flex items-center gap-1"
                        >
                          📷 Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => idPhotoFileRef.current?.click()}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-[var(--surf)] border border-[var(--line)] hover:bg-[var(--acc2)] hover:text-[var(--acc)] transition flex items-center gap-1"
                        >
                          📁 File
                        </button>
                      </div>
                      <input
                        ref={idPhotoFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setIdCardPicture)}
                      />
                    </div>
                  )}
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
            Save asset
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
