import * as React from 'react'
import type { Asset, AssetStatus } from '@/types/asset'
import { toast } from 'sonner'

interface AddAssetPanelProps {
  open: boolean
  onClose: () => void
  onSave: (asset: Asset) => void
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

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

  const [assetPhoto, setAssetPhoto] = React.useState<string | undefined>()
  const [assetCodePhoto, setAssetCodePhoto] = React.useState<string | undefined>()
  const [idCardPicture, setIdCardPicture] = React.useState<string | undefined>()

  const [date, setDate] = React.useState(() => new Date().toISOString().split('T')[0])
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const firstInputRef = React.useRef<HTMLInputElement>(null)
  const drawerRef = React.useRef<HTMLDivElement>(null)

  // Focus management & Escape key handling
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        firstInputRef.current?.focus()
      }, 50)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleClose = () => {
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
            <p className="text-xs text-[var(--mute)]">
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
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Basic information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Asset code <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  id="field-assetCode"
                  type="text"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  placeholder="e.g. AST-DEL-0492"
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)] ${
                    errors.assetCode ? 'border-[var(--bad)]' : 'border-[var(--line)]'
                  }`}
                />
                {errors.assetCode && <p className="text-xs text-[var(--bad)] mt-1">{errors.assetCode}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Asset serial number <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  id="field-serialNumber"
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. SN-88392104-X"
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)] ${
                    errors.serialNumber ? 'border-[var(--bad)]' : 'border-[var(--line)]'
                  }`}
                />
                {errors.serialNumber && <p className="text-xs text-[var(--bad)] mt-1">{errors.serialNumber}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Current category</label>
                  <input
                    type="text"
                    value={currentCategory}
                    onChange={(e) => setCurrentCategory(e.target.value)}
                    placeholder="e.g. Laptops & Compute"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Previous category</label>
                  <input
                    type="text"
                    value={previousCategory}
                    onChange={(e) => setPreviousCategory(e.target.value)}
                    placeholder="e.g. Unclassified hardware"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Current description</label>
                <input
                  type="text"
                  value={currentDescription}
                  onChange={(e) => setCurrentDescription(e.target.value)}
                  placeholder="e.g. MacBook Pro 16 inch M3 Pro Space Black"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Previous description</label>
                <input
                  type="text"
                  value={previousDescription}
                  onChange={(e) => setPreviousDescription(e.target.value)}
                  placeholder="e.g. Developer engineering laptop"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="space-y-3 pt-2 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Plant <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  id="field-plant"
                  type="text"
                  value={plant}
                  onChange={(e) => setPlant(e.target.value)}
                  placeholder="e.g. Pune Central Plant"
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)] ${
                    errors.plant ? 'border-[var(--bad)]' : 'border-[var(--line)]'
                  }`}
                />
                {errors.plant && <p className="text-xs text-[var(--bad)] mt-1">{errors.plant}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Building</label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="e.g. Block B Tech Wing"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Floor</label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="e.g. 4th Floor"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Current location</label>
                <input
                  type="text"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  placeholder="e.g. Bay 14 Desk 4A"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>
            </div>
          </section>

          {/* Ownership */}
          <section className="space-y-3 pt-2 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Ownership
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Current department</label>
                <input
                  type="text"
                  value={currentDepartment}
                  onChange={(e) => setCurrentDepartment(e.target.value)}
                  placeholder="e.g. Platform Engineering"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Submitter</label>
                <input
                  type="text"
                  value={submitter}
                  onChange={(e) => setSubmitter(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>
            </div>
          </section>

          {/* Asset status */}
          <section className="space-y-3 pt-2 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Asset status
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Asset condition <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  id="field-assetCondition"
                  type="text"
                  value={assetCondition}
                  onChange={(e) => setAssetCondition(e.target.value)}
                  placeholder="e.g. Operational - Excellent / New"
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)] ${
                    errors.assetCondition ? 'border-[var(--bad)]' : 'border-[var(--line)]'
                  }`}
                />
                {errors.assetCondition && <p className="text-xs text-[var(--bad)] mt-1">{errors.assetCondition}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Movement reason</label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Initial provisioning to staff member"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Enrolled in AppleCare+ Enterprise Support"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
              </div>
            </div>
          </section>

          {/* Media */}
          <section className="space-y-3 pt-2 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Media
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Asset photo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Asset photo</label>
                <div className="border border-dashed border-[var(--line)] rounded-lg p-2 text-center bg-[var(--surf2)] hover:border-[var(--acc)] transition">
                  {assetPhoto ? (
                    <div className="relative group">
                      <img
                        src={assetPhoto}
                        alt="Asset preview"
                        className="w-full h-20 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setAssetPhoto(undefined)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-3">
                      <svg
                        className="mx-auto h-6 w-6 text-[var(--mute)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="block text-[11px] text-[var(--mute)] mt-1">Upload photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setAssetPhoto)}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Asset code photo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Asset code photo</label>
                <div className="border border-dashed border-[var(--line)] rounded-lg p-2 text-center bg-[var(--surf2)] hover:border-[var(--acc)] transition">
                  {assetCodePhoto ? (
                    <div className="relative group">
                      <img
                        src={assetCodePhoto}
                        alt="Barcode preview"
                        className="w-full h-20 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setAssetCodePhoto(undefined)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-3">
                      <svg
                        className="mx-auto h-6 w-6 text-[var(--mute)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span className="block text-[11px] text-[var(--mute)] mt-1">Barcode / QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setAssetCodePhoto)}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* ID card picture */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">ID card picture</label>
                <div className="border border-dashed border-[var(--line)] rounded-lg p-2 text-center bg-[var(--surf2)] hover:border-[var(--acc)] transition">
                  {idCardPicture ? (
                    <div className="relative group">
                      <img
                        src={idCardPicture}
                        alt="ID badge preview"
                        className="w-full h-20 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setIdCardPicture(undefined)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-3">
                      <svg
                        className="mx-auto h-6 w-6 text-[var(--mute)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      <span className="block text-[11px] text-[var(--mute)] mt-1">ID card</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setIdCardPicture)}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Metadata */}
          <section className="space-y-3 pt-2 border-t border-[var(--line)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--acc)]">
              Metadata
            </h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
              />
            </div>
          </section>
        </form>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-[var(--line)] bg-[var(--surf)] flex items-center justify-end gap-3 sticky bottom-0 z-10">
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
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-[var(--acc)] text-white hover:opacity-90 shadow-sm transition"
          >
            Save asset
          </button>
        </div>
      </div>
    </>
  )
}
