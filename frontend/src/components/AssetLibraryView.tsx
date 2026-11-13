import * as React from 'react'
import type { Asset, AssetTypeTemplate } from '@/types/asset'
import { initialAssetTypes } from '@/data/assetLibraryData'
import { AssetIllustration } from '@/components/AssetIllustrations'
import { toast } from 'sonner'

interface AssetLibraryViewProps {
  assets: Asset[]
  activeSubTab: 'gallery' | 'library'
  setActiveSubTab: (tab: 'gallery' | 'library') => void
  onOpenAddAsset: () => void
  addAssetButtonRef?: React.RefObject<HTMLButtonElement | null>
}

export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({
  assets,
  activeSubTab,
  setActiveSubTab,
  onOpenAddAsset,
  addAssetButtonRef,
}) => {
  const [assetTypes, setAssetTypes] = React.useState<AssetTypeTemplate[]>(initialAssetTypes)
  const [filterCategory, setFilterCategory] = React.useState<string | null>(null)

  // Quick-add row states
  const [newTypeName, setNewTypeName] = React.useState('')
  const [newCategory, setNewCategory] = React.useState('')
  const [newManufacturer, setNewManufacturer] = React.useState('')

  // Compute category stats
  const categoryStats = React.useMemo(() => {
    const map = new Map<string, { typesCount: number; assetsCount: number }>()

    assetTypes.forEach((t) => {
      const existing = map.get(t.category) || { typesCount: 0, assetsCount: 0 }
      existing.typesCount += 1
      map.set(t.category, existing)
    })

    assets.forEach((a) => {
      const cat = a.currentCategory || 'General'
      const existing = map.get(cat) || { typesCount: 0, assetsCount: 0 }
      existing.assetsCount += 1
      map.set(cat, existing)
    })

    const totalTypes = assetTypes.length || 1
    return Array.from(map.entries()).map(([category, stats]) => ({
      category,
      typesCount: stats.typesCount,
      assetsCount: stats.assetsCount,
      percentage: Math.min(100, Math.round((stats.typesCount / totalTypes) * 100)),
    }))
  }, [assetTypes, assets])

  // Count specs across all types
  const totalSpecsCount = React.useMemo(() => {
    return assetTypes.reduce((acc, t) => acc + Object.keys(t.specs).length, 0)
  }, [assetTypes])

  // Assets without a matched type
  const unlinkedAssetsCount = React.useMemo(() => {
    const knownNames = new Set(assetTypes.map((t) => t.name.toLowerCase()))
    return assets.filter((a) => !knownNames.has(a.currentDescription.toLowerCase())).length
  }, [assetTypes, assets])

  // Count physical assets matching a type
  const countInGallery = (type: AssetTypeTemplate) => {
    const tName = type.name.toLowerCase()
    return assets.filter(
      (a) =>
        a.currentDescription.toLowerCase().includes(tName) ||
        tName.includes(a.currentDescription.toLowerCase()) ||
        a.currentCategory.toLowerCase() === type.category.toLowerCase()
    ).length
  }

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTypeName.trim()) {
      toast.error('Type name is required')
      return
    }

    const createdType: AssetTypeTemplate = {
      id: `type-${Date.now()}`,
      name: newTypeName.trim(),
      category: newCategory.trim() || 'General Equipment',
      manufacturer: newManufacturer.trim() || 'Generic',
      specs: {
        Status: 'Active specification',
        'Created on': new Date().toLocaleDateString(),
      },
    }

    setAssetTypes((prev) => [createdType, ...prev])
    toast.success(`Asset type "${createdType.name}" added to library!`)
    setNewTypeName('')
    setNewCategory('')
    setNewManufacturer('')
  }

  return (
    <div className="space-y-6">
      {activeSubTab === 'gallery' ? (
        /* ================= PART 1: ASSET GALLERY VIEW ================= */
        <div className="space-y-6">
          <div className="top">
            <div>
              <h1>Asset Gallery</h1>
              <div className="sub">{assets.length} assets registered across categories</div>
            </div>
            <div className="btns">
              <button
                className="btn"
                onClick={() => {
                  if (assets.length === 0) {
                    toast.warning('No assets recorded to export.')
                    return
                  }
                  toast.success('Exporting physical asset registry')
                }}
              >
                Export
              </button>
              <button
                ref={addAssetButtonRef}
                className="btn p"
                onClick={onOpenAddAsset}
              >
                Add asset
              </button>
            </div>
          </div>

          {/* 4 KPIs */}
          <div className="kpis">
            <div className="card k">
              <div className="l">Total assets</div>
              <div className="v">{assets.length}</div>
              <div className="d">0 this month</div>
            </div>
            <div className="card k">
              <div className="l">Assigned</div>
              <div className="v">
                {assets.filter((a) => a.assignedTo && a.assignedTo !== 'Unassigned').length}
              </div>
              <div className="d">0% in use</div>
            </div>
            <div className="card k">
              <div className="l">In storage</div>
              <div className="v">
                {assets.filter((a) => !a.assignedTo || a.assignedTo === 'Unassigned').length}
              </div>
              <div className="d">0 sites</div>
            </div>
            <div className="card k">
              <div className="l">Retired this year</div>
              <div className="v">
                {assets.filter((a) => a.status === 'Retired').length}
              </div>
              <div className="d">Disposal value $0</div>
            </div>
          </div>

          {/* Responsive Grid with Recently Updated & By Category */}
          <div className="grid">
            <section className="card c8">
              <h2>Recently updated</h2>
              {assets.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-3xl">📦</div>
                  <div className="text-xs text-[var(--mute)]">
                    No physical assets registered yet. Click "Add asset" to record equipment.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="border border-[var(--line)] rounded-xl p-3 bg-[var(--surf2)]/50 hover:bg-[var(--surf2)] transition space-y-2"
                    >
                      <div className="w-full flex justify-center bg-[var(--surf)] rounded-lg overflow-hidden p-2 border border-[var(--line)]/50">
                        <AssetIllustration
                          name={asset.currentDescription || asset.name}
                          category={asset.currentCategory}
                          photoUrl={asset.assetPhoto}
                          alt={`${asset.assetCode} image`}
                          width="100%"
                          height={110}
                        />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-[var(--acc)]">
                            {asset.assetCode}
                          </span>
                          <h4 className="text-sm font-semibold line-clamp-1">
                            {asset.currentDescription || asset.name}
                          </h4>
                        </div>
                        <span className="pill ok shrink-0">{asset.status}</span>
                      </div>

                      <div className="text-xs text-[var(--mute)] space-y-0.5">
                        <div><strong>SN:</strong> {asset.serialNumber}</div>
                        <div><strong>Loc:</strong> {asset.location || asset.plant}</div>
                        <div><strong>Cond:</strong> {asset.assetCondition}</div>
                        <div><strong>Dept:</strong> {asset.currentDepartment} ({asset.submitter})</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card c4">
              <h2>By category</h2>
              {categoryStats.length > 0 && assets.length > 0 ? (
                categoryStats.map((item) => (
                  <div key={item.category} className="row" style={{ display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="t">{item.category}</span>
                      <span>{item.assetsCount}</span>
                    </div>
                    <div className="bar">
                      <i style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs" style={{ color: 'var(--mute)' }}>
                  No category breakdown data available.
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        /* ================= PART 2: ASSET LIBRARY ================= */
        <div className="space-y-6">
          {/* Header */}
          <div className="top mb-0">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Asset Library</h1>
              <div className="sub">
                Asset types and templates: categories, models and specifications. Physical assets live in the Asset Gallery.
              </div>
            </div>
            <div className="btns">
              <button
                className="btn"
                onClick={() => toast.info('Import assets template dialog opened')}
              >
                Import assets
              </button>
              <button
                className="btn p"
                onClick={() => setActiveSubTab('gallery')}
              >
                Open Asset Gallery
              </button>
            </div>
          </div>

          {/* Flow Strip (1, 2, 3) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[var(--surf)] border border-[var(--line)] rounded-xl p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--acc)] text-white font-bold flex items-center justify-center text-xs shrink-0">
                1
              </div>
              <div className="text-xs">
                <span className="font-bold block">Import or register assets</span>
                <span className="text-[var(--mute)]">Log units into the physical register</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--acc2)] text-[var(--acc)] font-bold flex items-center justify-center text-xs shrink-0">
                2
              </div>
              <div className="text-xs">
                <span className="font-bold block">Match each model to a type</span>
                <span className="text-[var(--mute)]">Or create one here with technical specs</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--acc2)] text-[var(--acc)] font-bold flex items-center justify-center text-xs shrink-0">
                3
              </div>
              <div className="text-xs">
                <span className="font-bold block">Each asset appears in the Gallery</span>
                <span className="text-[var(--mute)]">Linked to its type with vector artwork</span>
              </div>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="kpis">
            <div className="card k">
              <div className="l">Categories</div>
              <div className="v">{categoryStats.length}</div>
              <div className="d">
                <span className="pill ok">Active</span> across org
              </div>
            </div>
            <div className="card k">
              <div className="l">Asset types</div>
              <div className="v">{assetTypes.length}</div>
              <div className="d">
                <span className="pill ok">Standard</span> models
              </div>
            </div>
            <div className="card k">
              <div className="l">Specification fields</div>
              <div className="v">{totalSpecsCount}</div>
              <div className="d">
                <span className="pill ok">Structured</span> parameters
              </div>
            </div>
            <div className="card k">
              <div className="l">Assets without a type</div>
              <div className="v">{unlinkedAssetsCount}</div>
              <div className="d">
                <span className="pill w">{unlinkedAssetsCount === 0 ? 'All linked' : 'Pending match'}</span>
              </div>
            </div>
          </div>

          {/* Quick-Add Row */}
          <form
            onSubmit={handleAddType}
            className="card p-4 flex flex-wrap items-center gap-3 bg-[var(--surf)] border border-[var(--line)]"
          >
            <div className="text-xs font-bold text-[var(--ink)] shrink-0">
              Quick-add type:
            </div>
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="Type name (e.g. MacBook Pro 16)"
              className="flex-1 min-w-[170px] px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category (e.g. Laptops & Compute)"
              className="flex-1 min-w-[150px] px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
            />
            <input
              type="text"
              value={newManufacturer}
              onChange={(e) => setNewManufacturer(e.target.value)}
              placeholder="Manufacturer (e.g. Apple)"
              className="flex-1 min-w-[150px] px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[var(--acc)] text-white hover:opacity-90 transition shrink-0"
            >
              Add type
            </button>
          </form>

          {/* Left / Right Split Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel: Categories with number of types, assets and proportional bar */}
            <div className="lg:col-span-4 card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Categories</h2>
                {filterCategory && (
                  <button
                    onClick={() => setFilterCategory(null)}
                    className="text-xs text-[var(--acc)] hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {categoryStats.map((item) => (
                  <div
                    key={item.category}
                    onClick={() =>
                      setFilterCategory((prev) => (prev === item.category ? null : item.category))
                    }
                    className={`p-2 rounded-lg cursor-pointer transition ${
                      filterCategory === item.category ? 'bg-[var(--acc2)]' : 'hover:bg-[var(--surf2)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold">{item.category}</span>
                      <span className="text-[var(--mute)]">
                        {item.typesCount} types · {item.assetsCount} in gallery
                      </span>
                    </div>
                    <div className="w-full bg-[var(--surf2)] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[var(--acc)] h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Asset types as expandable rows (details/summary) */}
            <div className="lg:col-span-8 card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Asset types</h2>
                <span className="text-xs text-[var(--mute)]">
                  {filterCategory ? `Filter: ${filterCategory}` : `${assetTypes.length} types registered`}
                </span>
              </div>

              <div className="divide-y divide-[var(--line)]">
                {assetTypes
                  .filter((t) => (!filterCategory ? true : t.category === filterCategory))
                  .map((type) => {
                    const galleryCount = countInGallery(type)

                    return (
                      <details
                        key={type.id}
                        className="group py-3 cursor-pointer outline-none transition"
                      >
                        {/* Collapsed Row Summary */}
                        <summary className="flex items-center justify-between gap-4 list-none select-none">
                          <div className="flex items-center gap-3">
                            {/* 56px thumbnail */}
                            <div className="w-14 h-11 shrink-0 overflow-hidden rounded bg-[var(--surf2)] flex items-center justify-center">
                              <AssetIllustration
                                name={type.name}
                                category={type.category}
                                alt={`${type.name} thumbnail`}
                                width={56}
                                height={44}
                              />
                            </div>
                            <div>
                              <div className="text-sm font-semibold group-hover:text-[var(--acc)] transition">
                                {type.name}
                              </div>
                              <div className="text-xs text-[var(--mute)]">
                                {type.manufacturer} · {type.category} · {Object.keys(type.specs).length} specs
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="pill ok">
                              {galleryCount} in Gallery
                            </span>
                            <span className="text-xs text-[var(--mute)] transition-transform group-open:rotate-180">
                              ▼
                            </span>
                          </div>
                        </summary>

                        {/* Expanded Content with 150x112 larger image and spec chips */}
                        <div className="pt-4 pl-3 flex flex-col sm:flex-row gap-4 items-start border-t border-[var(--line)]/50 mt-3">
                          <div className="w-[150px] h-[112px] shrink-0 rounded-lg overflow-hidden bg-[var(--surf2)] flex items-center justify-center border border-[var(--line)]">
                            <AssetIllustration
                              name={type.name}
                              category={type.category}
                              alt={`${type.name} full illustration`}
                              width={150}
                              height={112}
                            />
                          </div>

                          <div className="flex-1 space-y-3">
                            <div className="text-xs font-semibold text-[var(--mute)] uppercase tracking-wider">
                              Technical Specifications
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(type.specs).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)]"
                                >
                                  <strong className="mr-1">{k}:</strong> {v}
                                </span>
                              ))}
                            </div>

                            <div>
                              <button
                                onClick={() => setActiveSubTab('gallery')}
                                className="text-xs font-semibold text-[var(--acc)] hover:underline flex items-center gap-1"
                              >
                                View assets in Gallery →
                              </button>
                            </div>
                          </div>
                        </div>
                      </details>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
