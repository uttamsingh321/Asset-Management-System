import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { Asset } from '@/types/asset'

export interface DigitalTwinFacility3DProps {
  assets: Asset[]
  completedAssets?: Asset[]
  activeBuildingFilter?: string
  onSelectBuilding?: (building: string) => void
  onOpenAsset?: (asset: Asset) => void
  onNavigate?: (hash: string, assetCode?: string) => void
  onAddNewAssetOnFloor?: (building: string, floor: string) => void
}

type ViewMode3D = 'isometric' | 'perspective' | 'exploded' | 'blueprint'
type AssetScope = 'all' | 'completed' | 'pending'

interface BuildingMeta {
  id: string
  name: string
  company: 'IIPL' | 'Padget'
  floors: { id: string; name: string; zones: string[] }[]
  color: string
  accentGlow: string
  address: string
  plant: string
}

const BUILDINGS: BuildingMeta[] = [
  {
    id: 'C39',
    name: 'Building C39',
    company: 'IIPL',
    address: 'C-39, Sector 57, Noida Tech Zone',
    plant: 'C-39 Factory, Noida',
    color: '#3B82F6',
    accentGlow: 'rgba(59, 130, 246, 0.4)',
    floors: [
      { id: 'Ground', name: 'Ground Floor', zones: ['Inbound Logistics', 'SMT Feeder Prep', 'Heavy Machining', 'Maintenance Bay'] },
      { id: '1F', name: '1st Floor (SMT)', zones: ['SMT Line 1-2', 'SMT Line 3-4', 'Reflow Ovens', 'Optical Inspection (AOI)'] },
      { id: '2F', name: '2F Engineering', zones: ['In-Circuit Testing (ICT)', 'Burn-In Lab', 'Calibration Room', 'IT & Infrastructure'] },
      { id: '3F', name: '3F QC & Assembly', zones: ['Final Box Assembly', 'Quality Control (QC)', 'Cleanroom Packing', 'Dispatch Dock'] },
    ],
  },
  {
    id: 'D197',
    name: 'Unit D197',
    company: 'Padget',
    address: 'D-197, Sector 63, Noida Manufacturing Complex',
    plant: 'Padget Electronics, Noida',
    color: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.4)',
    floors: [
      { id: 'Ground', name: 'Ground Assembly', zones: ['Chassis Build', 'Sub-Assembly Stations', 'Material Receiving'] },
      { id: '1F', name: '1F Production', zones: ['SMT Production Line A', 'SMT Line B', 'Automated Screwing'] },
      { id: '2F', name: '2F Testing Lab', zones: ['RF Wireless Chamber', 'Environmental Testing', 'Quality Assurance'] },
    ],
  },
  {
    id: 'D198',
    name: 'Unit D198',
    company: 'Padget',
    address: 'D-198, Sector 63, Noida',
    plant: 'Padget Unit 2, Noida',
    color: '#8B5CF6',
    accentGlow: 'rgba(139, 92, 246, 0.4)',
    floors: [
      { id: 'Ground', name: 'Ground Floor', zones: ['Component Store', 'High-Bay Staging', 'Power Infrastructure'] },
      { id: '1F', name: '1F SMT Line 3', zones: ['SMT Line 3 & 4', 'Solder Paste Inspection', 'Wave Soldering'] },
      { id: '2F', name: '2F Burn-in Lab', zones: ['High Temp Aging Racks', 'Stress Testing Cells', 'Final Inspection'] },
    ],
  },
  {
    id: 'D199',
    name: 'Unit D199',
    company: 'Padget',
    address: 'D-199, Sector 63, Noida',
    plant: 'Padget Logistics Hub',
    color: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.4)',
    floors: [
      { id: 'Dock', name: 'Logistics Dock', zones: ['Truck Unloading Bay', 'Inbound Staging', 'Cross-Docking Area'] },
      { id: 'Warehouse', name: 'Warehouse Storage', zones: ['Aisle A-D Pallet Racks', 'Aisle E-H High-Bay', 'Inventory Audit Zone'] },
      { id: 'Dispatch', name: 'Dispatch Hub', zones: ['Outbound Staging', 'Security Scanning Hub', 'Transport Fleet Loading'] },
    ],
  },
]

export const DigitalTwinFacility3D: React.FC<DigitalTwinFacility3DProps> = ({
  assets,
  completedAssets = [],
  activeBuildingFilter = 'All',
  onSelectBuilding,
  onOpenAsset,
  onNavigate,
  onAddNewAssetOnFloor,
}) => {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    activeBuildingFilter !== 'All' ? activeBuildingFilter : 'C39'
  )
  const [viewMode, setViewMode] = useState<ViewMode3D>('isometric')
  const [assetScope, setAssetScope] = useState<AssetScope>('all')
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(1) // default to 1st Floor / SMT
  const [activeNode, setActiveNode] = useState<Asset | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFloorLedger, setShowFloorLedger] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)

  // Interactive 3D Orbiting & Zoom State
  const [rotX, setRotX] = useState<number>(58)
  const [rotY, setRotY] = useState<number>(-38)
  const [zoom, setZoom] = useState<number>(1.0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; rotX: number; rotY: number }>({ x: 0, y: 0, rotX: 58, rotY: -38 })
  const stageRef = useRef<HTMLDivElement>(null)

  // Sync with external activeBuildingFilter if changed
  useEffect(() => {
    if (activeBuildingFilter && activeBuildingFilter !== 'All' && activeBuildingFilter !== selectedBuildingId) {
      setSelectedBuildingId(activeBuildingFilter)
    }
  }, [activeBuildingFilter])

  // Filter scoped assets (All vs Completed vs Pending)
  const scopedAssets = useMemo(() => {
    if (assetScope === 'completed') {
      return assets.filter(
        (a) => a.status === 'Completed' || a.status === 'Active' || a.status === 'In Use'
      )
    }
    if (assetScope === 'pending') {
      return assets.filter(
        (a) => a.status !== 'Completed' && a.status !== 'Active' && a.status !== 'In Use'
      )
    }
    return assets
  }, [assets, assetScope])

  // Count assets per building based on current scope
  const buildingAssetCounts = useMemo(() => {
    const counts: Record<string, { total: number; completed: number; pending: number }> = {
      C39: { total: 0, completed: 0, pending: 0 },
      D197: { total: 0, completed: 0, pending: 0 },
      D198: { total: 0, completed: 0, pending: 0 },
      D199: { total: 0, completed: 0, pending: 0 },
    }

    assets.forEach((a) => {
      const bldgRaw = (a.building || '').toUpperCase()
      let key = 'C39'
      if (bldgRaw.includes('197')) key = 'D197'
      else if (bldgRaw.includes('198')) key = 'D198'
      else if (bldgRaw.includes('199')) key = 'D199'
      else if (bldgRaw.includes('C39') || bldgRaw.includes('C-39')) key = 'C39'

      if (counts[key]) {
        counts[key].total++
        if (a.status === 'Completed' || a.status === 'Active' || a.status === 'In Use') {
          counts[key].completed++
        } else {
          counts[key].pending++
        }
      }
    })
    return counts
  }, [assets])

  const selectedBuilding = useMemo(() => {
    return BUILDINGS.find((b) => b.id === selectedBuildingId) || BUILDINGS[0]
  }, [selectedBuildingId])

  // All assets in the selected building
  const buildingAssets = useMemo(() => {
    return scopedAssets.filter((a) => {
      const b = (a.building || '').toUpperCase()
      if (selectedBuildingId === 'C39') {
        return b === 'C39' || b.includes('C39') || b.includes('C-39') || (!b.includes('197') && !b.includes('198') && !b.includes('199'))
      }
      return b === selectedBuildingId || b.includes(selectedBuildingId)
    })
  }, [scopedAssets, selectedBuildingId])

  // Map building assets to floors
  const floorAssetsMap = useMemo(() => {
    const map = new Map<number, Asset[]>()
    selectedBuilding.floors.forEach((_, idx) => map.set(idx, []))

    buildingAssets.forEach((asset, idx) => {
      const flr = (asset.floor || '').toLowerCase()
      let assignedIndex = -1

      if (flr.includes('ground')) assignedIndex = 0
      else if (flr.includes('1st') || flr.includes('1f') || flr.includes('first') || flr.includes('smt')) assignedIndex = 1
      else if (flr.includes('2nd') || flr.includes('2f') || flr.includes('second') || flr.includes('engineering') || flr.includes('burn')) assignedIndex = 2
      else if (flr.includes('3rd') || flr.includes('3f') || flr.includes('third') || flr.includes('qc') || flr.includes('dispatch')) assignedIndex = 3

      // Bound to available floors or spread evenly if undefined
      if (assignedIndex < 0 || assignedIndex >= selectedBuilding.floors.length) {
        assignedIndex = idx % selectedBuilding.floors.length
      }

      const list = map.get(assignedIndex) || []
      list.push(asset)
      map.set(assignedIndex, list)
    })

    return map
  }, [buildingAssets, selectedBuilding])

  const activeFloor = selectedBuilding.floors[activeFloorIndex] || selectedBuilding.floors[0]
  const activeFloorAssets = useMemo(() => {
    return floorAssetsMap.get(activeFloorIndex) || []
  }, [floorAssetsMap, activeFloorIndex])

  // Camera preset handlers
  const setCameraPreset = useCallback((mode: ViewMode3D) => {
    setViewMode(mode)
    setAutoRotate(false)
    switch (mode) {
      case 'isometric':
        setRotX(58)
        setRotY(-38)
        setZoom(0.95)
        break
      case 'perspective':
        setRotX(35)
        setRotY(-20)
        setZoom(1.05)
        break
      case 'exploded':
        setRotX(64)
        setRotY(-42)
        setZoom(0.9)
        break
      case 'blueprint':
        setRotX(0)
        setRotY(0)
        setZoom(1.0)
        break
    }
  }, [])

  // Mouse / Touch Drag Orbit handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setAutoRotate(false)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX,
      rotY,
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    // Invert deltaY for natural orbit feel
    const newRotX = Math.max(0, Math.min(85, dragStartRef.current.rotX - deltaY * 0.4))
    const newRotY = (dragStartRef.current.rotY + deltaX * 0.4) % 360

    setRotX(newRotX)
    setRotY(newRotY)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Window-level mouse move and mouse up listeners so dragging doesn't break when cursor exits container
  useEffect(() => {
    if (!isDragging) return

    const onWindowMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      const newRotX = Math.max(0, Math.min(85, dragStartRef.current.rotX - deltaY * 0.4))
      const newRotY = (dragStartRef.current.rotY + deltaX * 0.4) % 360

      setRotX(newRotX)
      setRotY(newRotY)
    }

    const onWindowMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [isDragging])

  // Touch gesture handlers for mobile / touchscreen orbit & pinch zoom
  const touchStartRef = useRef<{ dist: number; zoom: number; x: number; y: number; rotX: number; rotY: number }>({
    dist: 0,
    zoom: 1.0,
    x: 0,
    y: 0,
    rotX: 58,
    rotY: -38,
  })

  const handleTouchStart = (e: React.TouchEvent) => {
    setAutoRotate(false)
    if (e.touches.length === 1) {
      setIsDragging(true)
      touchStartRef.current = {
        dist: 0,
        zoom,
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        rotX,
        rotY,
      }
    } else if (e.touches.length === 2) {
      setIsDragging(false)
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchStartRef.current = {
        dist,
        zoom,
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        rotX,
        rotY,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const deltaX = e.touches[0].clientX - touchStartRef.current.x
      const deltaY = e.touches[0].clientY - touchStartRef.current.y
      const newRotX = Math.max(0, Math.min(85, touchStartRef.current.rotX - deltaY * 0.4))
      const newRotY = (touchStartRef.current.rotY + deltaX * 0.4) % 360
      setRotX(newRotX)
      setRotY(newRotY)
    } else if (e.touches.length === 2 && touchStartRef.current.dist > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const factor = currentDist / touchStartRef.current.dist
      const newZoom = Math.max(0.6, Math.min(2.2, touchStartRef.current.zoom * factor))
      setZoom(Number(newZoom.toFixed(3)))
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Non-passive Native Wheel Zoom Handler
  // CRITICAL FIX: React onWheel is treated as passive in modern browsers.
  // Attaching a native listener with { passive: false } allows e.preventDefault()
  // to completely block outer page scrolling while smoothly zooming the 3D facility.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const handleNativeWheel = (e: WheelEvent) => {
      // Prevent browser default window scrolling completely!
      e.preventDefault()
      e.stopPropagation()

      const zoomDelta = e.deltaY * -0.0015
      setZoom((prev) => Math.max(0.6, Math.min(2.2, Number((prev + zoomDelta).toFixed(3)))))
    }

    stage.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      stage.removeEventListener('wheel', handleNativeWheel)
    }
  }, [])

  // Auto-rotate tick effect
  useEffect(() => {
    if (!autoRotate) return
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 0.5) % 360)
    }, 30)
    return () => clearInterval(interval)
  }, [autoRotate])

  // In-Visualizer Search & Locate Asset
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return assets.filter(
      (a) =>
        (a.assetCode && a.assetCode.toLowerCase().includes(q)) ||
        (a.assetTag && a.assetTag.toLowerCase().includes(q)) ||
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.currentDescription && a.currentDescription.toLowerCase().includes(q)) ||
        (a.whoInCharge && a.whoInCharge.toLowerCase().includes(q)) ||
        (a.inChargeName && a.inChargeName.toLowerCase().includes(q))
    ).slice(0, 5)
  }, [assets, searchQuery])

  const handleSelectSearchResult = (target: Asset) => {
    // Determine target building
    const bldg = (target.building || '').toUpperCase()
    let targetBuildingId = 'C39'
    if (bldg.includes('197')) targetBuildingId = 'D197'
    else if (bldg.includes('198')) targetBuildingId = 'D198'
    else if (bldg.includes('199')) targetBuildingId = 'D199'

    setSelectedBuildingId(targetBuildingId)
    if (onSelectBuilding) onSelectBuilding(targetBuildingId)

    // Determine target floor index
    const flr = (target.floor || '').toLowerCase()
    let flrIdx = 1
    if (flr.includes('ground')) flrIdx = 0
    else if (flr.includes('1st') || flr.includes('1f') || flr.includes('smt')) flrIdx = 1
    else if (flr.includes('2nd') || flr.includes('2f') || flr.includes('engineering') || flr.includes('burn')) flrIdx = 2
    else if (flr.includes('3rd') || flr.includes('3f') || flr.includes('qc') || flr.includes('dispatch')) flrIdx = 3

    setActiveFloorIndex(flrIdx)
    setActiveNode(target)
    setSearchQuery('')
  }

  const transform3D = useMemo(() => {
    return `rotateX(${rotX}deg) rotateZ(${rotY}deg) scale3d(${zoom}, ${zoom}, ${zoom})`
  }, [rotX, rotY, zoom])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surf)] p-5 shadow-xl transition-all duration-300">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-20"
        style={{ background: selectedBuilding.color }}
      />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      {/* Header bar: Title, Scope Switcher, Search & Controls */}
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/25">
            <span className="text-xl">🧊</span>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[var(--ink)] tracking-tight">
                3D Digital Twin Facility Visualizer
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                ● Live Telemetry Active
              </span>
              <span className="text-xs text-[var(--mute)] font-mono">
                {buildingAssets.length} Units in {selectedBuilding.name}
              </span>
            </div>
            <p className="text-xs text-[var(--mute)] mt-0.5">
              Spatial IoT layout & operational equipment placement across IIPL & Padget manufacturing complexes
            </p>
          </div>
        </div>

        {/* Global Asset Scope Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-[var(--surf2)] p-1 border border-[var(--line)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAssetScope('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                assetScope === 'all'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              All Assets ({assets.length.toLocaleString()})
            </button>
            <button
              type="button"
              onClick={() => setAssetScope('completed')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                assetScope === 'completed'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              <span>✅</span>
              <span>Deployed ({completedAssets.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAssetScope('pending')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                assetScope === 'pending'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              <span>⏳</span>
              <span>Pending</span>
            </button>
          </div>

          {/* In-Visualizer Search & Locate Equipment */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Locate code (e.g. 2005941)..."
              className="text-xs py-1.5 pl-7 pr-3 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-blue-500 w-44 sm:w-52 shadow-xs transition"
            />
            <span className="absolute left-2.5 top-2 text-xs text-[var(--mute)]">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1.5 text-xs text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
              >
                ×
              </button>
            )}

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-[var(--line)] bg-[var(--surf)] shadow-2xl z-50 overflow-hidden divide-y divide-[var(--line)]">
                <div className="px-3 py-1.5 bg-[var(--surf2)] text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider">
                  Target Locations Found ({searchResults.length})
                </div>
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(result)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-500/10 transition-colors flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {result.assetCode}
                      </div>
                      <div className="text-[11px] text-[var(--ink)] truncate max-w-[160px]">
                        {result.currentDescription || result.name}
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-[var(--mute)]">
                      <div>🏛️ {result.building || 'C39'}</div>
                      <div>{result.floor || '1st Floor'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Building Navigation Bar & 3D Camera Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-3 pb-2">
        {/* Building Selector with Real Counts */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--mute)]">Complex:</span>
          <div className="flex items-center rounded-xl bg-[var(--surf2)] p-1 border border-[var(--line)] text-xs">
            {BUILDINGS.map((b) => {
              const counts = buildingAssetCounts[b.id] || { total: 0, completed: 0, pending: 0 }
              const displayCount =
                assetScope === 'completed'
                  ? counts.completed
                  : assetScope === 'pending'
                  ? counts.pending
                  : counts.total

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBuildingId(b.id)
                    setActiveFloorIndex(0)
                    setActiveNode(null)
                    if (onSelectBuilding) onSelectBuilding(b.id)
                  }}
                  className={`relative px-3 py-1.5 rounded-lg font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                    selectedBuildingId === b.id
                      ? 'bg-[var(--surf)] text-[var(--ink)] shadow-sm border border-[var(--line)]'
                      : 'text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                  <span>{b.id}</span>
                  <span className="text-[11px] opacity-75 font-mono">({displayCount})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3D Camera Modes & Orbit Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center rounded-xl bg-[var(--surf2)] p-1 border border-[var(--line)] text-xs">
            {(
              [
                { id: 'isometric', label: 'Isometric 3D', icon: '📐' },
                { id: 'perspective', label: 'Perspective', icon: '🔭' },
                { id: 'exploded', label: 'Floor Split', icon: '🥞' },
                { id: 'blueprint', label: 'Blueprint', icon: '🗺️' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCameraPreset(m.id)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                  viewMode === m.id
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
                title={`Switch camera to ${m.label}`}
              >
                <span>{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Zoom Buttons & Reset */}
          <div className="flex items-center rounded-xl bg-[var(--surf2)] p-1 border border-[var(--line)] text-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
              className="px-2 py-1 hover:text-blue-500 transition font-bold"
              title="Zoom In (+)"
            >
              ＋
            </button>
            <span className="px-1 text-[10px] font-mono text-[var(--mute)]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="px-2 py-1 hover:text-blue-500 transition font-bold"
              title="Zoom Out (-)"
            >
              －
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('isometric')}
              className="px-1.5 py-1 text-[10px] hover:text-blue-500 transition font-mono border-l border-[var(--line)] ml-1"
              title="Reset 3D Camera Angles"
            >
              Reset
            </button>
          </div>

          {/* Auto Rotate Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 font-bold'
                : 'border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] bg-[var(--surf2)]'
            }`}
            title="Toggle automated 3D rotation"
          >
            <span className={autoRotate ? 'animate-spin' : ''}>🔄</span>
            <span className="hidden sm:inline">Spin</span>
          </button>
        </div>
      </div>

      {/* 3D Visual Stage Container with Interactive Drag Orbiting */}
      <div
        ref={stageRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`relative my-3 flex h-[420px] md:h-[480px] w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#0B0F19] via-[#0D1322] to-[#080B13] border border-slate-800 shadow-2xl select-none touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ perspective: '1200px', touchAction: 'none', overscrollBehavior: 'contain' }}
      >
        {/* Holographic 3D Industrial Ground Grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, #3B82F6 1px, transparent 1px), linear-gradient(to bottom, #3B82F6 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            transform: 'perspective(600px) rotateX(60deg) translateY(140px) scale(2.6)',
          }}
        />

        {/* Radar / Telemetry Compass in Corner */}
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1 pointer-events-none font-mono text-[10px] text-slate-400">
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 shadow-md">
            <span>ROT X: {Math.round(rotX)}°</span>
            <span>·</span>
            <span>ROT Z: {Math.round(rotY)}°</span>
            <span>·</span>
            <span>SCALE: {Math.round(zoom * 100)}%</span>
          </div>
          <span className="text-[9px] text-slate-500">Tip: Click & Drag to Orbit · Scroll to Zoom</span>
        </div>

        {/* Live HUD Overlay details in Top-Left */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 pointer-events-none text-xs font-mono">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-lg">
            <span
              className="h-2.5 w-2.5 rounded-full animate-pulse shadow-sm"
              style={{ background: selectedBuilding.color }}
            />
            <span className="text-white font-bold">
              {selectedBuilding.name} ({selectedBuilding.company})
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-bold">
              {activeFloorAssets.length} Units on {activeFloor.name}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 bg-slate-900/70 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-800 max-w-md">
            📍 {selectedBuilding.address} · {selectedBuilding.floors.length} Floors Total
          </div>
        </div>

        {/* 3D Isometric / Orthogonal Building Core with Preservation of 3D */}
        <div
          className="relative flex items-center justify-center transition-transform duration-100 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: transform3D,
            width: '480px',
            height: '480px',
          }}
        >
          {/* Foundation Heavy Slab */}
          <div
            className="absolute rounded-3xl border-2 shadow-2xl backdrop-blur-xs transition-transform duration-500"
            style={{
              width: '420px',
              height: '420px',
              transform: 'translateZ(-50px)',
              borderColor: selectedBuilding.color,
              backgroundColor: 'rgba(11, 15, 25, 0.75)',
              boxShadow: `0 0 80px ${selectedBuilding.accentGlow}`,
            }}
          >
            {/* Concrete Foundation Perimeter marking */}
            <div className="absolute inset-3 rounded-2xl border border-dashed border-slate-700/60" />
            <div className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              BASE LEVEL FOUNDATION · {selectedBuilding.id}
            </div>
          </div>

          {/* Corner Structural Pillars in Exploded Mode */}
          {viewMode === 'exploded' && (
            <>
              {[-190, 190].map((cx) =>
                [-190, 190].map((cy) => (
                  <div
                    key={`pillar-${cx}-${cy}`}
                    className="absolute w-2 bg-gradient-to-t from-blue-500/40 via-cyan-400/40 to-blue-500/40 rounded-full"
                    style={{
                      left: `calc(50% + ${cx}px)`,
                      top: `calc(50% + ${cy}px)`,
                      height: `${selectedBuilding.floors.length * 85}px`,
                      transform: 'translateZ(-40px) rotateX(-90deg)',
                      transformOrigin: 'bottom center',
                      boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)',
                    }}
                  />
                ))
              )}
            </>
          )}

          {/* Render Multi-tier 3D Floor Planes */}
          {selectedBuilding.floors.map((floor, fIdx) => {
            const zDistance = viewMode === 'exploded' ? fIdx * 90 : fIdx * 34
            const isFloorActive = activeFloorIndex === fIdx
            const floorAssets = floorAssetsMap.get(fIdx) || []

            return (
              <div
                key={floor.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveFloorIndex(fIdx)
                }}
                className={`group absolute cursor-pointer rounded-2xl border transition-all duration-500 ${
                  isFloorActive
                    ? 'border-blue-400 bg-blue-950/50 shadow-2xl shadow-blue-500/30'
                    : 'border-slate-700/50 bg-slate-900/35 hover:border-slate-500 hover:bg-slate-800/40 opacity-70'
                }`}
                style={{
                  width: `${380 - fIdx * 14}px`,
                  height: `${380 - fIdx * 14}px`,
                  transform: `translateZ(${zDistance}px)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Structural CAD Grid on Floor Slab */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-20"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, #60A5FA 1.2px, transparent 1.2px)',
                    backgroundSize: '24px 24px',
                  }}
                />

                {/* Floor Label Badge in 3D */}
                <div
                  className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold border shadow-lg transition-transform ${
                    isFloorActive
                      ? 'bg-blue-600 text-white border-blue-400 scale-105'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700'
                  }`}
                  style={{ transform: 'translateZ(16px)' }}
                >
                  <span className={`h-2 w-2 rounded-full ${isFloorActive ? 'bg-white' : 'bg-blue-400'}`} />
                  <span>{floor.name}</span>
                  <span className="text-[10px] opacity-80 font-normal">({floorAssets.length})</span>
                </div>

                {/* Industrial Zones Markings on Floor */}
                <div className="absolute inset-0 p-8 grid grid-cols-2 gap-4 pointer-events-none opacity-40">
                  {floor.zones.slice(0, 4).map((zoneName) => (
                    <div
                      key={zoneName}
                      className="rounded-xl border border-dashed border-blue-400/40 p-2 flex flex-col justify-between"
                      style={{ transform: 'translateZ(4px)' }}
                    >
                      <span className="text-[9px] font-mono font-bold text-blue-300/80 uppercase tracking-wider">
                        {zoneName}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Equipment Hotspot Nodes on this Floor */}
                <div className="absolute inset-0 p-6 flex flex-wrap items-center justify-around gap-4">
                  {floorAssets.slice(0, 8).map((asset, nodeIdx) => {
                    const isOperational = asset.status === 'Completed' || asset.status === 'Active' || asset.status === 'In Use'
                    const isMaintenance = asset.status === 'Maintenance' || asset.status === 'Under Repair'
                    const nodeColor = isOperational ? '#10B981' : isMaintenance ? '#EF4444' : '#F59E0B'
                    const isSelectedNode = activeNode?.assetCode === asset.assetCode

                    return (
                      <div
                        key={asset.id || asset.assetCode || nodeIdx}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveFloorIndex(fIdx)
                          setActiveNode(asset)
                        }}
                        className="relative flex items-center justify-center group/node cursor-pointer transition-transform"
                        style={{
                          transform: `translateZ(${isSelectedNode ? '28px' : '18px'}) scale(${isSelectedNode ? 1.3 : 1})`,
                        }}
                      >
                        {/* Outer Pulsing Beacon */}
                        <span
                          className={`absolute h-9 w-9 rounded-full ${isSelectedNode ? 'animate-ping opacity-80' : 'animate-pulse opacity-40'} pointer-events-none`}
                          style={{ background: nodeColor }}
                        />

                        {/* Machine Core Icon */}
                        <div
                          className="relative flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg transition-transform group-hover/node:scale-130 border border-white/40"
                          style={{
                            background: nodeColor,
                            boxShadow: `0 0 16px ${nodeColor}`,
                          }}
                        >
                          {asset.category === 'Vehicles' ? '🚗' : asset.category === 'IT Hardware' ? '💻' : '⚙️'}
                        </div>

                        {/* Asset Code Tag in 3D */}
                        <div
                          className="absolute -bottom-4 whitespace-nowrap rounded px-1.5 py-0.2 text-[9px] font-mono font-bold bg-slate-950/90 text-white border border-slate-700 pointer-events-none"
                          style={{ transform: 'translateZ(10px)' }}
                        >
                          {asset.assetCode}
                        </div>

                        {/* Hover Telemetry Card */}
                        <div
                          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/node:opacity-100 transition-all duration-200 z-40 whitespace-nowrap rounded-xl bg-slate-950/95 px-3 py-2 text-center text-xs border border-blue-500/40 shadow-2xl backdrop-blur-md"
                          style={{ transform: 'translateZ(30px)' }}
                        >
                          <div className="font-mono font-bold text-white flex items-center justify-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: nodeColor }} />
                            <span>Unit #{asset.assetCode}</span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-semibold truncate max-w-[160px] mt-0.5">
                            {asset.currentDescription || asset.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {asset.department || 'Production'} · {asset.whoInCharge || 'Unassigned'}
                          </div>
                          <div className="mt-1 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                            Click to Inspect Telemetry
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected Asset Telemetry & Operations HUD Modal */}
        {activeNode && (
          <div className="absolute bottom-4 left-4 right-4 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-blue-500/50 bg-slate-950/95 p-4 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-start md:items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-2xl text-white shadow-lg border border-blue-400/40">
                📦
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-blue-400">
                    Unit #{activeNode.assetCode}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {activeNode.currentDescription || activeNode.name}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      activeNode.status === 'Completed' || activeNode.status === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    ● {activeNode.status || 'Active'}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                  <span>
                    🏛️ <b>Building:</b> {activeNode.building || selectedBuildingId} ({activeNode.floor || activeFloor.name})
                  </span>
                  <span>
                    ⚙️ <b>Dept:</b> {activeNode.currentDepartment || activeNode.department || 'Production'}
                  </span>
                  <span>
                    👤 <b>Custodian:</b> {activeNode.whoInCharge || activeNode.inChargeName || 'Not Assigned'}
                  </span>
                  {activeNode.submitter && (
                    <span className="text-slate-400">
                      📝 <b>Current User:</b> {activeNode.submitter}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Workable Operations Action Hub */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenAsset && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAsset(activeNode)
                    setActiveNode(null)
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition shadow-md flex items-center gap-1.5"
                >
                  <span>✏️</span>
                  <span>View Details & Edit</span>
                </button>
              )}

              {onNavigate && (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('labels', activeNode.assetCode)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                    title="Print QR label for this unit"
                  >
                    <span>🖨️</span>
                    <span>Print QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('transfers', activeNode.assetCode)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                    title="Initiate transfer request"
                  >
                    <span>🔄</span>
                    <span>Transfer</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setActiveNode(null)}
                className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer transition"
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Facility Floor Level Quick Tabs & Floor Operations Bar */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[var(--mute)] font-semibold">Active Floor Level:</span>
          {selectedBuilding.floors.map((flr, fIdx) => {
            const count = (floorAssetsMap.get(fIdx) || []).length
            const isActive = activeFloorIndex === fIdx

            return (
              <button
                key={flr.id}
                type="button"
                onClick={() => {
                  setActiveFloorIndex(fIdx)
                  setActiveNode(null)
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[var(--surf2)] text-[var(--ink)] border border-[var(--line)] hover:border-blue-400'
                }`}
              >
                <span>{flr.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[var(--line)] text-[var(--mute)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Floor Quick Operations */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFloorLedger(!showFloorLedger)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              showFloorLedger
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] hover:border-blue-400'
            }`}
          >
            <span>📋</span>
            <span>Floor Ledger ({activeFloorAssets.length})</span>
          </button>

          {onAddNewAssetOnFloor && (
            <button
              type="button"
              onClick={() => onAddNewAssetOnFloor(selectedBuildingId, activeFloor.name)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              title={`Register and deploy new equipment directly onto ${selectedBuilding.name} ${activeFloor.name}`}
            >
              <span>➕</span>
              <span>Deploy on this Floor</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Floor Equipment Ledger Table */}
      {showFloorLedger && (
        <div className="relative z-10 mt-4 rounded-xl border border-[var(--line)] bg-[var(--surf2)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[var(--ink)]">
                Equipment Ledger: {selectedBuilding.name} — {activeFloor.name}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-bold">
                {activeFloorAssets.length} Units Deployed
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowFloorLedger(false)}
              className="text-xs text-[var(--mute)] hover:text-[var(--ink)] font-bold cursor-pointer"
            >
              ✕ Close Ledger
            </button>
          </div>

          <div className="mt-3 overflow-x-auto max-h-60 overflow-y-auto">
            {activeFloorAssets.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--mute)]">
                No equipment currently deployed on {activeFloor.name}. Click "+ Deploy on this Floor" to add machines.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[11px] font-bold text-[var(--mute)] uppercase">
                    <th className="py-2 px-3">Asset Code</th>
                    <th className="py-2 px-3">Equipment Name</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3">Custodian</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] font-medium">
                  {activeFloorAssets.slice(0, 50).map((asset) => (
                    <tr
                      key={asset.id || asset.assetCode}
                      className="hover:bg-[var(--surf)] transition-colors cursor-pointer"
                      onClick={() => setActiveNode(asset)}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {asset.assetCode}
                      </td>
                      <td className="py-2 px-3 text-[var(--ink)]">
                        {asset.currentDescription || asset.name}
                      </td>
                      <td className="py-2 px-3 text-[var(--mute)]">
                        {asset.department || 'Production'}
                      </td>
                      <td className="py-2 px-3 text-[var(--mute)]">
                        {asset.whoInCharge || asset.inChargeName || '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            asset.status === 'Completed' || asset.status === 'Active'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {asset.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onOpenAsset) onOpenAsset(asset)
                          }}
                          className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
