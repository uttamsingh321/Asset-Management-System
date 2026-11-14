import React, { useState, useMemo } from 'react'
import type { Asset } from '@/types/asset'

interface DigitalTwinFacility3DProps {
  assets: Asset[]
  onSelectBuilding?: (building: string) => void
  onOpenAsset?: (asset: Asset) => void
  activeBuildingFilter?: string
}

type ViewMode3D = 'isometric' | 'perspective' | 'exploded' | 'blueprint'

interface BuildingMeta {
  id: string
  name: string
  company: 'IIPL' | 'Padget'
  floors: string[]
  color: string
  accentGlow: string
}

const BUILDINGS: BuildingMeta[] = [
  { id: 'C39', name: 'Building C39', company: 'IIPL', floors: ['Ground Floor', '1F SMT', '2F Engineering', '3F QC'], color: '#3B82F6', accentGlow: 'rgba(59, 130, 246, 0.4)' },
  { id: 'D197', name: 'Unit D197', company: 'Padget', floors: ['Ground Assembly', '1F Production', '2F Testing'], color: '#10B981', accentGlow: 'rgba(16, 185, 129, 0.4)' },
  { id: 'D198', name: 'Unit D198', company: 'Padget', floors: ['Ground Floor', '1F SMT Line 3', '2F Burn-in Lab'], color: '#8B5CF6', accentGlow: 'rgba(139, 92, 246, 0.4)' },
  { id: 'D199', name: 'Unit D199', company: 'Padget', floors: ['Logistics Dock', 'Warehouse Storage', 'Dispatch Hub'], color: '#F59E0B', accentGlow: 'rgba(245, 158, 11, 0.4)' },
]

export const DigitalTwinFacility3D: React.FC<DigitalTwinFacility3DProps> = ({
  assets,
  onSelectBuilding,
  onOpenAsset,
  activeBuildingFilter = 'All',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode3D>('isometric')
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    activeBuildingFilter !== 'All' ? activeBuildingFilter : 'C39'
  )
  const [activeNode, setActiveNode] = useState<Asset | null>(null)
  const [autoRotate, setAutoRotate] = useState(false)
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0)

  // Map assets to buildings
  const buildingAssetCounts = useMemo(() => {
    const counts: Record<string, number> = { C39: 0, D197: 0, D198: 0, D199: 0 }
    assets.forEach(a => {
      const bldg = a.building?.toUpperCase() || ''
      if (counts[bldg] !== undefined) {
        counts[bldg]++
      } else if (bldg.includes('197')) counts['D197']++
      else if (bldg.includes('198')) counts['D198']++
      else if (bldg.includes('199')) counts['D199']++
      else counts['C39']++
    })
    return counts
  }, [assets])

  const selectedBuilding = useMemo(() => {
    return BUILDINGS.find(b => b.id === selectedBuildingId) || BUILDINGS[0]
  }, [selectedBuildingId])

  const buildingAssets = useMemo(() => {
    return assets.filter(a => {
      const b = (a.building || '').toUpperCase()
      return b === selectedBuildingId || b.includes(selectedBuildingId)
    })
  }, [assets, selectedBuildingId])

  // Compute 3D container transform based on viewMode
  const transformStyle = useMemo(() => {
    switch (viewMode) {
      case 'isometric':
        return 'rotateX(58deg) rotateZ(-38deg) scale3d(0.9, 0.9, 0.9)'
      case 'perspective':
        return 'rotateX(36deg) rotateZ(-18deg) scale3d(0.95, 0.95, 0.95)'
      case 'exploded':
        return 'rotateX(62deg) rotateZ(-40deg) scale3d(0.85, 0.85, 0.85)'
      case 'blueprint':
        return 'rotateX(0deg) rotateZ(0deg) scale3d(0.95, 0.95, 0.95)'
      default:
        return 'rotateX(58deg) rotateZ(-38deg)'
    }
  }, [viewMode])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-[#0B0F17] dark:via-[#0F172A] dark:to-[#0B0F17] p-5 shadow-xl transition-all duration-300">
      {/* Ambient background mesh glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-30 dark:opacity-25"
        style={{ background: selectedBuilding.color }}
      />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      {/* Header bar: Title & 3D Controls */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <span className="text-lg">🧊</span>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                3D Digital Twin Facility Visualizer
              </h2>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                Live 60fps Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Interactive spatial digital twin across IIPL & Padget manufacturing complexes
            </p>
          </div>
        </div>

        {/* 3D Camera Controls & View Mode Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Building Switcher Pills */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60 text-xs">
            {BUILDINGS.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBuildingId(b.id)
                  if (onSelectBuilding) onSelectBuilding(b.id)
                }}
                className={`relative px-3 py-1.5 rounded-lg font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  selectedBuildingId === b.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: b.color }}
                />
                <span>{b.id}</span>
                <span className="text-[10px] opacity-75 font-mono">({buildingAssetCounts[b.id] || 0})</span>
              </button>
            ))}
          </div>

          {/* Perspective Modes */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60 text-xs">
            {(
              [
                { id: 'isometric', label: 'Isometric 3D', icon: '📐' },
                { id: 'perspective', label: 'Perspective', icon: '🔭' },
                { id: 'exploded', label: 'Floor Split', icon: '🥞' },
                { id: 'blueprint', label: 'Blueprint', icon: '🗺️' },
              ] as const
            ).map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewMode(m.id)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                  viewMode === m.id
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={`Switch camera to ${m.label}`}
              >
                <span>{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Auto Rotate Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Toggle automated 3D rotation animation"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">Spin</span>
          </button>
        </div>
      </div>

      {/* 3D Visual Stage Container */}
      <div
        className="relative my-4 flex h-[340px] md:h-[400px] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-900/90 dark:bg-[#070B12] border border-slate-800 shadow-inner"
        style={{ perspective: '1100px' }}
      >
        {/* Subtle holographic 3D grid lines on the ground plane */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, #3B82F6 1px, transparent 1px), linear-gradient(to bottom, #3B82F6 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transform: 'perspective(600px) rotateX(60deg) translateY(120px) scale(2.4)',
          }}
        />

        {/* Live HUD Overlay details */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 text-[11px] font-mono text-slate-400 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-slate-800/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold">{selectedBuilding.name} ({selectedBuilding.company})</span>
            <span>·</span>
            <span>{buildingAssetCounts[selectedBuildingId] || 0} Assets Deployed</span>
          </div>
          <div className="text-[10px] text-slate-500 pl-1">
            GRID: 28.5355° N, 77.3910° E · Noida Tech Zone · Floor Levels: {selectedBuilding.floors.length}
          </div>
        </div>

        {/* 3D Isometric Building Core */}
        <div
          className={`relative flex items-center justify-center transition-all duration-700 ${
            autoRotate ? 'animate-[spin_24s_linear_infinite]' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: transformStyle,
            width: '460px',
            height: '460px',
          }}
        >
          {/* Base Foundation Slab */}
          <div
            className="absolute rounded-3xl border-2 border-blue-500/30 bg-blue-950/40 shadow-2xl backdrop-blur-xs transition-transform duration-500"
            style={{
              width: '380px',
              height: '380px',
              transform: 'translateZ(-40px)',
              boxShadow: '0 0 60px rgba(59, 130, 246, 0.25)',
            }}
          />

          {/* Render Multi-tier 3D Floors */}
          {selectedBuilding.floors.map((floorName, idx) => {
            const zOffset = viewMode === 'exploded' ? idx * 75 : idx * 28
            const isFloorActive = activeFloorIndex === idx

            return (
              <div
                key={floorName}
                onClick={() => setActiveFloorIndex(idx)}
                className={`group absolute cursor-pointer rounded-2xl border transition-all duration-500 ${
                  isFloorActive
                    ? 'border-blue-400/80 bg-blue-900/35 shadow-lg shadow-blue-500/20'
                    : 'border-slate-600/40 bg-slate-800/25 hover:border-blue-400/50 hover:bg-slate-800/40'
                }`}
                style={{
                  width: `${340 - idx * 16}px`,
                  height: `${340 - idx * 16}px`,
                  transform: `translateZ(${zOffset}px)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Structural Grid lines on the slab */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-15"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, #60A5FA 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />

                {/* Floor Label Badge in 3D */}
                <div
                  className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-200 border border-slate-700 shadow-sm"
                  style={{ transform: 'translateZ(12px)' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span>{floorName}</span>
                </div>

                {/* Hotspot Nodes on this floor */}
                <div className="absolute inset-0 p-6 flex flex-wrap items-center justify-around gap-6">
                  {buildingAssets
                    .filter((_, aIdx) => aIdx % selectedBuilding.floors.length === idx)
                    .slice(0, 6)
                    .map((asset, nodeIdx) => {
                      const isHealthy = asset.status === 'Active' || asset.status === 'Completed'
                      const isMaintenance = asset.status === 'Maintenance'
                      const nodeColor = isHealthy ? '#10B981' : isMaintenance ? '#F59E0B' : '#3B82F6'

                      return (
                        <div
                          key={asset.id || nodeIdx}
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveNode(asset)
                          }}
                          className="relative flex items-center justify-center group/node cursor-pointer"
                          style={{
                            transform: 'translateZ(18px)',
                          }}
                        >
                          {/* Pulsing Beacon Ring */}
                          <span
                            className="absolute h-8 w-8 rounded-full animate-ping opacity-60 pointer-events-none"
                            style={{ background: nodeColor }}
                          />
                          {/* Inner Beacon Core */}
                          <div
                            className="relative flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg transition-transform group-hover/node:scale-130"
                            style={{
                              background: nodeColor,
                              boxShadow: `0 0 16px ${nodeColor}`,
                            }}
                          >
                            ⚙️
                          </div>

                          {/* Hover Tooltip in 3D Space */}
                          <div
                            className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/node:opacity-100 transition-all duration-200 z-30 whitespace-nowrap rounded-lg bg-slate-950/95 px-2.5 py-1.5 text-center text-xs border border-slate-700 shadow-xl"
                            style={{ transform: 'translateZ(24px)' }}
                          >
                            <div className="font-mono font-bold text-white">Unit #{asset.assetCode}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                              {asset.currentDescription || asset.name}
                            </div>
                            <div className="mt-0.5 text-[9px] font-semibold text-emerald-400">
                              ● {asset.status || 'Active'} · {asset.department || 'Operations'}
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

        {/* Interactive Hologram Modal / Bottom Sheet when a node is clicked */}
        {activeNode && (
          <div className="absolute bottom-4 left-4 right-4 z-40 flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-slate-950/90 p-3.5 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-xl border border-blue-500/40">
                📦
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">
                    Unit #{activeNode.assetCode}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {activeNode.currentDescription || activeNode.name}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.2 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    {activeNode.status || 'Operational'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                  <span>🏛️ {activeNode.building || selectedBuildingId} ({activeNode.floor || 'Ground'})</span>
                  <span>⚙️ Dept: {activeNode.currentDepartment || activeNode.department || 'Operations'}</span>
                  <span>👤 In-Charge: {activeNode.inChargeName || activeNode.whoInCharge || 'Assigned Staff'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenAsset && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAsset(activeNode)
                    setActiveNode(null)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition shadow-sm"
                >
                  View Details & Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveNode(null)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer transition"
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Facility Floor Level Quick-Tabs */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold">Active Floor Level:</span>
          {selectedBuilding.floors.map((floor, fIdx) => (
            <button
              key={floor}
              type="button"
              onClick={() => setActiveFloorIndex(fIdx)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                activeFloorIndex === fIdx
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {floor}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Operational
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Service Due
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Reserved
          </span>
        </div>
      </div>
    </div>
  )
}
