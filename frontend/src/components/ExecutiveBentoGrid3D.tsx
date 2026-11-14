import React from 'react'
import type { Asset } from '@/types/asset'

interface ExecutiveBentoGrid3DProps {
  assets: Asset[]
  pendingTaskCount: number
  onNavigate: (hash: string) => void
  onAddAsset: () => void
}

export const ExecutiveBentoGrid3D: React.FC<ExecutiveBentoGrid3DProps> = ({
  assets,
  pendingTaskCount,
  onNavigate,
  onAddAsset,
}) => {
  const totalAssets = assets.length
  const healthyCount = assets.filter(a => a.status === 'Active' || a.status === 'Completed').length
  const maintenanceCount = assets.filter(a => a.status === 'Maintenance').length
  const reservedCount = assets.filter(a => a.status === 'Reserved').length
  const retiredCount = assets.filter(a => a.status === 'Retired').length

  const healthPercent = totalAssets > 0 ? Math.round((healthyCount / totalAssets) * 100) : 100

  // Calculate total inventory capital value
  const totalValueINR = React.useMemo(() => {
    const sum = assets.reduce((acc, a) => acc + (a.currentValue || a.purchaseCost || 0), 0)
    if (sum >= 10000000) return `₹${(sum / 10000000).toFixed(2)} Cr`
    if (sum >= 100000) return `₹${(sum / 100000).toFixed(2)} Lakh`
    return `₹${sum.toLocaleString('en-IN')}`
  }, [assets])

  // Count by building
  const buildingBreakdown = React.useMemo(() => {
    const res = { C39: 0, D197: 0, D198: 0, D199: 0 }
    assets.forEach(a => {
      const b = (a.building || '').toUpperCase()
      if (b.includes('197')) res.D197++
      else if (b.includes('198')) res.D198++
      else if (b.includes('199')) res.D199++
      else res.C39++
    })
    return res
  }, [assets])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Bento Card 1: Active Fleet & Capital Valuation */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/40 dark:from-[#111827] dark:via-[#0F172A] dark:to-[#0B0F17] p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500/40">
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-colors" />
        
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Fleet Size
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-base shadow-xs">
            🏢
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {totalAssets}
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
            <span>●</span> Live In-Service
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
          <span>Enterprise Capital:</span>
          <span className="font-bold font-mono text-slate-900 dark:text-slate-200">{totalValueINR}</span>
        </div>
      </div>

      {/* Bento Card 2: Operational Health & OEE */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 dark:from-[#111827] dark:via-[#0F172A] dark:to-[#0B0F17] p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-emerald-500/40">
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-colors" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fleet Health Index
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-base shadow-xs">
            ⚡
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {healthPercent}%
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {healthyCount} of {totalAssets} Operational
            </div>
          </div>

          {/* Mini 3D Progress Ring */}
          <div className="relative h-12 w-12 flex items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 transition-all duration-700 ease-out"
                strokeDasharray={`${healthPercent}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-slate-700 dark:text-slate-300">
              {healthyCount}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {reservedCount > 0 ? `${reservedCount} reserved · ` : ''}{retiredCount > 0 ? `${retiredCount} retired · ` : ''}Service Due:
          </span>
          <span className={`font-bold ${maintenanceCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {maintenanceCount} units
          </span>
        </div>
      </div>

      {/* Bento Card 3: Facility Spatial Deployment (C39, D197, D198, D199) */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50 to-purple-50/40 dark:from-[#111827] dark:via-[#0F172A] dark:to-[#0B0F17] p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-purple-500/40">
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-colors" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Building Distribution
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-base shadow-xs">
            📍
          </div>
        </div>

        {/* 3D Vertical Bar Matrix */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center items-end h-12">
          {(
            [
              { id: 'C39', count: buildingBreakdown.C39, color: 'bg-blue-500' },
              { id: 'D197', count: buildingBreakdown.D197, color: 'bg-emerald-500' },
              { id: 'D198', count: buildingBreakdown.D198, color: 'bg-purple-500' },
              { id: 'D199', count: buildingBreakdown.D199, color: 'bg-amber-500' },
            ] as const
          ).map(b => {
            const maxVal = Math.max(...Object.values(buildingBreakdown), 1)
            const heightPercent = Math.max(Math.round((b.count / maxVal) * 100), 15)

            return (
              <div key={b.id} className="flex flex-col items-center gap-1 group/bar">
                <span className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300">
                  {b.count}
                </span>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-sm h-8 flex items-end overflow-hidden p-0.5">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-xs ${b.color} transition-all duration-500 group-hover/bar:brightness-125`}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {b.id}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
          <span>IIPL (C39): <b>{buildingBreakdown.C39}</b></span>
          <span>Padget (D-Units): <b>{buildingBreakdown.D197 + buildingBreakdown.D198 + buildingBreakdown.D199}</b></span>
        </div>
      </div>

      {/* Bento Card 4: Quick Launch & Queue Action Hub */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50 to-amber-50/40 dark:from-[#111827] dark:via-[#0F172A] dark:to-[#0B0F17] p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-amber-500/40 flex flex-col justify-between">
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-colors" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Quick Operations
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-base shadow-xs">
            ⚡
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="my-3 grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={onAddAsset}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold hover:opacity-90 transition cursor-pointer shadow-sm text-center"
          >
            <span>+</span>
            <span>Add Asset</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border font-bold transition cursor-pointer text-center ${
              pendingTaskCount > 0
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span>📋</span>
            <span>Queue ({pendingTaskCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('transfer')}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold transition cursor-pointer text-center"
          >
            <span>⇄</span>
            <span>Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('labels')}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold transition cursor-pointer text-center"
          >
            <span>🏷️</span>
            <span>Print QR</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Active Status:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">All Systems Nominal</span>
        </div>
      </div>
    </div>
  )
}
