import * as React from 'react'
import type { Asset, AssetTypeTemplate } from '@/types/asset'
import { isAssetTaskCompleted } from '@/types/asset'
import { initialAssetTypes } from '@/data/assetLibraryData'
import { AssetIllustration } from '@/components/AssetIllustrations'
import { parseExcelOrCsvFile, type ImportSummary } from '@/lib/excelImporter'
import { logAuditEvent } from '@/lib/deviceTracker'
import { toast } from 'sonner'

const STORAGE_KEY_TYPES = 'meridian_asset_types'
const GALLERY_PAGE_SIZE = 24
const TYPES_PAGE_SIZE = 15

interface AssetLibraryViewProps {
  assets: Asset[]
  activeSubTab: 'gallery' | 'library'
  setActiveSubTab: (tab: 'gallery' | 'library') => void
  onOpenAddAsset: () => void
  onDeleteAsset?: (id: string) => void
  onClearAllAssets?: () => void
  onImportAssets?: (importedAssets: Asset[], importedAssetTypes: AssetTypeTemplate[]) => void
  addAssetButtonRef?: React.RefObject<HTMLButtonElement | null>
}

export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({
  assets,
  activeSubTab,
  setActiveSubTab,
  onOpenAddAsset,
  onDeleteAsset,
  onClearAllAssets,
  onImportAssets,
  addAssetButtonRef,
}) => {
  const [assetTypes, setAssetTypes] = React.useState<AssetTypeTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TYPES)
      return saved ? JSON.parse(saved) : initialAssetTypes
    } catch {
      return initialAssetTypes
    }
  })

  // Sync types to localStorage safely
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TYPES, JSON.stringify(assetTypes.slice(0, 500)))
    } catch (err) {
      console.warn('Failed to sync asset types to storage', err)
    }
  }, [assetTypes])

  // Filter & Search states
  const [filterCategory, setFilterCategory] = React.useState<string | null>(null)
  const [gallerySearch, setGallerySearch] = React.useState('')
  const [galleryPage, setGalleryPage] = React.useState(1)
  const [typesSearch, setTypesSearch] = React.useState('')
  const [typesPage, setTypesPage] = React.useState(1)

  // Quick-add row states
  const [newTypeName, setNewTypeName] = React.useState('')
  const [newCategory, setNewCategory] = React.useState('')
  const [newManufacturer, setNewManufacturer] = React.useState('')

  // Excel / CSV Import states
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = React.useState(false)
  const [importProgress, setImportProgress] = React.useState(0)
  const [importMessage, setImportMessage] = React.useState('')
  const [importFileName, setImportFileName] = React.useState('')
  const [importSummary, setImportSummary] = React.useState<ImportSummary | null>(null)

  // Only completed/filled physical assets count in the Asset Gallery and stats
  const completedAssets = React.useMemo(() => {
    return assets.filter(isAssetTaskCompleted)
  }, [assets])

  const pendingTaskCount = React.useMemo(() => {
    return assets.filter((a) => !isAssetTaskCompleted(a)).length
  }, [assets])

  // Compute category stats
  const categoryStats = React.useMemo(() => {
    const map = new Map<string, { typesCount: number; assetsCount: number }>()

    assetTypes.forEach((t) => {
      const existing = map.get(t.category) || { typesCount: 0, assetsCount: 0 }
      existing.typesCount += 1
      map.set(t.category, existing)
    })

    completedAssets.forEach((a) => {
      const cat = a.currentCategory || a.category || 'General Equipment'
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
  }, [assetTypes, completedAssets])

  // Count specs across all types
  const totalSpecsCount = React.useMemo(() => {
    return assetTypes.reduce((acc, t) => acc + Object.keys(t.specs).length, 0)
  }, [assetTypes])

  // Assets without a matched type
  const unlinkedAssetsCount = React.useMemo(() => {
    const knownNames = new Set(assetTypes.map((t) => t.name.toLowerCase()))
    return assets.filter((a) => !knownNames.has((a.currentDescription || a.name || '').toLowerCase())).length
  }, [assetTypes, assets])

  // Count physical assets matching a type
  const countInGallery = (type: AssetTypeTemplate) => {
    const tName = type.name.toLowerCase()
    return assets.filter((a) => {
      const desc = (a.currentDescription || a.name || '').toLowerCase()
      const cat = (a.currentCategory || a.category || '').toLowerCase()
      return desc.includes(tName) || tName.includes(desc) || cat === type.category.toLowerCase()
    }).length
  }

  // Quick-add new type
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

  const handleDeleteType = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = assetTypes.find((t) => t.id === id)
    setAssetTypes((prev) => prev.filter((t) => t.id !== id))
    logAuditEvent(
      'ASSET_DELETE',
      {
        deletedItemType: 'Asset Type Template',
        typeId: id,
        name: target?.name || 'Asset Type',
        category: target?.category || 'General',
        manufacturer: target?.manufacturer || 'Unknown',
        specs: target?.specs || {},
        deletionTimestamp: new Date().toISOString(),
        deletionReason: 'User deleted asset type template from library',
      },
      target?.name || id,
      'AssetType'
    )
    toast.success(`Asset type "${target?.name || 'template'}" deleted`)
  }

  const handleClearAllTypes = () => {
    if (assetTypes.length === 0) return
    const count = assetTypes.length
    const typeNames = assetTypes.map((t) => t.name).join(', ')
    setAssetTypes([])
    logAuditEvent(
      'ASSET_DELETE',
      {
        deletedItemType: 'Bulk Asset Types Purge',
        count,
        deletedTypes: typeNames,
        deletionTimestamp: new Date().toISOString(),
        deletionReason: 'User removed all asset types from library',
      },
      'ALL-ASSET-TYPES',
      'AssetType'
    )
    toast.success('All asset types removed from library')
  }

  // Trigger file selection for Excel / CSV import
  const handleTriggerFileImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // File import execution (handles up to 10k-100k rows asynchronously)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFileName(file.name)
    setIsImporting(true)
    setImportProgress(5)
    setImportMessage(`Reading spreadsheet ${file.name}...`)
    setImportSummary(null)

    try {
      const result = await parseExcelOrCsvFile(file, (progress, message) => {
        setImportProgress(progress)
        setImportMessage(message)
      })

      // Merge newly extracted types with existing templates
      setAssetTypes((prev) => {
        const existingNames = new Set(prev.map((t) => `${t.name.toLowerCase()}:::${t.category.toLowerCase()}`))
        const fresh = result.assetTypes.filter(
          (t) => !existingNames.has(`${t.name.toLowerCase()}:::${t.category.toLowerCase()}`)
        )
        return [...fresh, ...prev]
      })

      // Notify parent app of new assets
      if (onImportAssets) {
        onImportAssets(result.assets, result.assetTypes)
      }

      setImportSummary(result.summary)
      toast.success(
        `Successfully imported ${result.summary.importedCount.toLocaleString()} assets across ${result.summary.categoriesCount} categories!`
      )
    } catch (err: any) {
      console.error('Import error:', err)
      toast.error(err?.message || 'Failed to import spreadsheet file.')
      setIsImporting(false)
    }
  }

  // Filtered Assets for Gallery (Only completed units)
  const filteredAssets = React.useMemo(() => {
    return completedAssets.filter((asset) => {
      const matchesCategory = !filterCategory || (asset.currentCategory || asset.category) === filterCategory
      if (!matchesCategory) return false

      if (!gallerySearch.trim()) return true
      const q = gallerySearch.toLowerCase()
      return (
        asset.assetCode.toLowerCase().includes(q) ||
        asset.serialNumber.toLowerCase().includes(q) ||
        asset.currentDescription.toLowerCase().includes(q) ||
        (asset.currentCategory || '').toLowerCase().includes(q) ||
        (asset.plant || '').toLowerCase().includes(q) ||
        (asset.currentLocation || '').toLowerCase().includes(q) ||
        (asset.currentDepartment || '').toLowerCase().includes(q) ||
        (asset.submitter || '').toLowerCase().includes(q)
      )
    })
  }, [completedAssets, filterCategory, gallerySearch])

  // Paged Assets
  const totalGalleryPages = Math.max(1, Math.ceil(filteredAssets.length / GALLERY_PAGE_SIZE))
  const pagedAssets = React.useMemo(() => {
    const start = (galleryPage - 1) * GALLERY_PAGE_SIZE
    return filteredAssets.slice(start, start + GALLERY_PAGE_SIZE)
  }, [filteredAssets, galleryPage])

  // Filtered Types for Library
  const filteredTypes = React.useMemo(() => {
    return assetTypes.filter((type) => {
      const matchesCategory = !filterCategory || type.category === filterCategory
      if (!matchesCategory) return false

      if (!typesSearch.trim()) return true
      const q = typesSearch.toLowerCase()
      return (
        type.name.toLowerCase().includes(q) ||
        type.category.toLowerCase().includes(q) ||
        type.manufacturer.toLowerCase().includes(q) ||
        Object.entries(type.specs).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(q))
      )
    })
  }, [assetTypes, filterCategory, typesSearch])

  // Paged Types
  const totalTypesPages = Math.max(1, Math.ceil(filteredTypes.length / TYPES_PAGE_SIZE))
  const pagedTypes = React.useMemo(() => {
    const start = (typesPage - 1) * TYPES_PAGE_SIZE
    return filteredTypes.slice(start, start + TYPES_PAGE_SIZE)
  }, [filteredTypes, typesPage])

  return (
    <div className="space-y-6">
      {/* Hidden file input for Excel / CSV Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import Excel or CSV file"
      />

      {/* Import Progress & Categorization Modal */}
      {isImporting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-title"
        >
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h3 id="import-title" className="text-base font-bold text-[var(--ink)]">
                  {importSummary ? 'Import & Auto-Categorization Complete' : 'Importing & Auto-Categorizing Assets'}
                </h3>
              </div>
              {importSummary && (
                <button
                  onClick={() => setIsImporting(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mute)] hover:bg-[var(--surf2)] transition"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs text-[var(--mute)]">
                <span className="font-medium text-[var(--ink)] truncate max-w-[260px]">{importFileName}</span>
                <span className="font-semibold text-[var(--acc)]">{importProgress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--surf2)] h-3 rounded-full overflow-hidden border border-[var(--line)]">
                <div
                  className="bg-gradient-to-r from-[var(--acc)] to-[#20a39e] h-full rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>

              <div className="text-xs text-[var(--mute)] animate-pulse">{importMessage}</div>
            </div>

            {/* Categorization Breakdown Result */}
            {importSummary && (
              <div className="space-y-3 pt-2 border-t border-[var(--line)]">
                <div className="text-xs font-semibold text-[var(--ink)] flex items-center justify-between">
                  <span>Auto-Sorted Categories</span>
                  <span className="text-[var(--acc)]">
                    {importSummary.importedCount.toLocaleString()} total units
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {Object.entries(importSummary.categoryBreakdown).map(([cat, count]) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--surf2)]/70 border border-[var(--line)]"
                    >
                      <span className="font-medium text-[var(--ink)]">{cat}</span>
                      <span className="font-bold text-[var(--acc)] px-2 py-0.5 rounded bg-[var(--acc2)]">
                        {count.toLocaleString()} assets
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setIsImporting(false)
                      setActiveSubTab('gallery')
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-[var(--acc)] text-white hover:opacity-90 transition"
                  >
                    View in Asset Gallery →
                  </button>
                  <button
                    onClick={() => {
                      setIsImporting(false)
                      setActiveSubTab('library')
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] hover:bg-[var(--line)] transition"
                  >
                    View Asset Types
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'gallery' ? (
        /* ================= PART 1: ASSET GALLERY VIEW ================= */
        <div className="space-y-6">
          <div className="top">
            <div>
              <h1>Asset Gallery</h1>
              <div className="sub">{assets.length.toLocaleString()} assets registered across categories</div>
            </div>
            <div className="btns">
              {assets.length > 0 && (
                <button
                  className="btn"
                  style={{ color: 'var(--bad)', borderColor: 'var(--line)' }}
                  onClick={onClearAllAssets}
                  title="Remove all registered assets"
                  aria-label="Clear all assets"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}
                  >
                    <path
                      d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Clear all
                </button>
              )}
              <button
                className="btn"
                onClick={handleTriggerFileImport}
                title="Import Excel (.xlsx, .xls) or CSV (.csv) file"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Import assets
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
              <div className="v">{completedAssets.length.toLocaleString()}</div>
              <div className="d">
                {pendingTaskCount > 0 ? (
                  <span className="text-amber-500 font-semibold">{pendingTaskCount} codes pending in Task Queue</span>
                ) : (
                  '0 this month'
                )}
              </div>
            </div>
            <div className="card k">
              <div className="l">Assigned</div>
              <div className="v">
                {completedAssets.filter((a) => a.submitter || (a.assignedTo && a.assignedTo !== 'Unassigned')).length.toLocaleString()}
              </div>
              <div className="d">
                {completedAssets.length > 0
                  ? `${Math.round(
                      (completedAssets.filter((a) => a.submitter || (a.assignedTo && a.assignedTo !== 'Unassigned')).length /
                        completedAssets.length) *
                        100
                    )}% in use`
                  : '0% in use'}
              </div>
            </div>
            <div className="card k">
              <div className="l">In storage</div>
              <div className="v">
                {completedAssets.filter((a) => !a.submitter && (!a.assignedTo || a.assignedTo === 'Unassigned')).length.toLocaleString()}
              </div>
              <div className="d">{new Set(completedAssets.map((a) => a.plant).filter(Boolean)).size} sites</div>
            </div>
            <div className="card k">
              <div className="l">Retired this year</div>
              <div className="v">
                {completedAssets.filter((a) => a.status === 'Retired').length.toLocaleString()}
              </div>
              <div className="d">Disposal value $0</div>
            </div>
          </div>

          {/* Search, Filter Bar and Pagination */}
          <div className="card p-3 flex flex-wrap items-center justify-between gap-3 bg-[var(--surf)] border border-[var(--line)]">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={gallerySearch}
                  onChange={(e) => {
                    setGallerySearch(e.target.value)
                    setGalleryPage(1)
                  }}
                  placeholder="Search assets by code, serial, name, category, plant..."
                  className="w-full px-3 py-1.5 pl-8 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
                />
                <span className="absolute left-2.5 top-2 text-xs text-[var(--mute)]">🔍</span>
              </div>
              {gallerySearch && (
                <button
                  onClick={() => {
                    setGallerySearch('')
                    setGalleryPage(1)
                  }}
                  className="text-xs text-[var(--mute)] hover:text-[var(--ink)]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--mute)]">Category:</span>
              <select
                value={filterCategory || ''}
                onChange={(e) => {
                  setFilterCategory(e.target.value ? e.target.value : null)
                  setGalleryPage(1)
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
              >
                <option value="">All Categories ({completedAssets.length})</option>
                {categoryStats.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category} ({c.assetsCount})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsive Grid with Recently Updated & By Category */}
          <div className="grid">
            <section className="card c8">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <h2>Recently updated</h2>
                  <span className="text-xs text-[var(--mute)]">
                    Showing {pagedAssets.length} of {filteredAssets.length.toLocaleString()}
                  </span>
                </div>
                {totalGalleryPages > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => setGalleryPage((p) => Math.max(1, p - 1))}
                      disabled={galleryPage === 1}
                      className="px-2 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span>
                      Page {galleryPage} of {totalGalleryPages}
                    </span>
                    <button
                      onClick={() => setGalleryPage((p) => Math.min(totalGalleryPages, p + 1))}
                      disabled={galleryPage === totalGalleryPages}
                      className="px-2 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              {filteredAssets.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-3xl">📦</div>
                  <div className="text-xs text-[var(--mute)]">
                    {completedAssets.length === 0
                      ? pendingTaskCount > 0
                        ? `0 Physical Assets Deployed (${pendingTaskCount} task codes pending in Task Queue). Complete tasks to register equipment.`
                        : 'No physical assets registered yet. Click "Add asset" or "Import assets" to load inventory.'
                      : 'No assets match the search criteria.'}
                  </div>
                  {completedAssets.length === 0 && pendingTaskCount > 0 && (
                    <a
                      href="#tasks"
                      className="inline-block mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--acc)] text-white hover:opacity-90 transition"
                    >
                      Go to Task Queue ({pendingTaskCount} pending) →
                    </a>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {pagedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="border border-[var(--line)] rounded-xl p-3 bg-[var(--surf2)]/50 hover:bg-[var(--surf2)] transition space-y-2 relative group"
                    >
                      {/* Delete bin button */}
                      {onDeleteAsset && (
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--mute)] hover:text-[var(--bad)] hover:bg-red-500/10 transition z-10"
                          aria-label={`Delete asset ${asset.assetCode}`}
                          title="Delete asset"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}

                      <div className="w-full flex justify-center bg-[var(--surf)] rounded-lg overflow-hidden p-2 border border-[var(--line)]/50">
                        {asset.assetPhoto ? (
                          <img
                            src={asset.assetPhoto}
                            alt={`${asset.name} photo`}
                            className="w-full h-32 object-cover rounded"
                          />
                        ) : (
                          <AssetIllustration
                            name={asset.currentDescription || asset.name}
                            category={asset.currentCategory || asset.category}
                            alt={`${asset.name} illustration`}
                            width={160}
                            height={120}
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[var(--acc)]">{asset.assetCode}</span>
                          <span
                            className={`pill ${
                              asset.status === 'Active'
                                ? 'ok'
                                : asset.status === 'Maintenance'
                                ? 'w'
                                : 'text-[var(--mute)]'
                            }`}
                          >
                            {asset.status || 'Active'}
                          </span>
                        </div>
                        <div className="font-semibold text-xs line-clamp-1 text-[var(--ink)]">
                          {asset.currentDescription || asset.name}
                        </div>
                        <div className="text-[11px] text-[var(--mute)]">
                          SN: {asset.serialNumber || 'N/A'}
                        </div>
                        <div className="text-[11px] text-[var(--mute)]">
                          Loc: {asset.plant} {asset.building ? `· ${asset.building}` : ''}{' '}
                          {asset.currentLocation ? `· ${asset.currentLocation}` : ''}
                        </div>
                        <div className="text-[11px] text-[var(--mute)]">
                          Cond: {asset.assetCondition || 'Good'}
                        </div>
                        <div className="text-[11px] text-[var(--mute)]">
                          Dept: {asset.currentDepartment || 'N/A'}{' '}
                          {asset.submitter ? `(${asset.submitter})` : ''}
                        </div>
                        {(asset.date || asset.purchaseDate) && (
                          <div className="text-[11px] text-[var(--mute)]">
                            Date: {asset.date || asset.purchaseDate}
                          </div>
                        )}
                        {asset.unavailabilityReasons && Object.keys(asset.unavailabilityReasons).length > 0 && (
                          <div className="mt-1 p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-800 dark:text-amber-300">
                            <span className="font-semibold block mb-0.5">⚠️ Missing field justifications:</span>
                            {Object.entries(asset.unavailabilityReasons).map(([key, reason]) => (
                              <div key={key} className="truncate">
                                • <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span> {reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Category breakdown sidebar */}
            <section className="card c4">
              <h2>By category</h2>
              {categoryStats.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--mute)]">
                  No category breakdown data available.
                </div>
              ) : (
                <div className="space-y-2 pt-2">
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
                        <span className="text-[var(--mute)]">{item.assetsCount.toLocaleString()} units</span>
                      </div>
                      <div className="w-full bg-[var(--surf2)] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[var(--acc)] h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              assets.length > 0 ? Math.round((item.assetsCount / assets.length) * 100) : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        /* ================= PART 2: ASSET LIBRARY VIEW ================= */
        <div className="space-y-6">
          <div className="top">
            <div>
              <h1>Asset Library</h1>
              <div className="sub">
                Asset types and templates: categories, models and specifications. Physical assets live in the Asset
                Gallery.
              </div>
            </div>
            <div className="btns">
              {assetTypes.length > 0 && (
                <button
                  className="btn"
                  style={{ color: 'var(--bad)', borderColor: 'var(--line)' }}
                  onClick={handleClearAllTypes}
                  title="Remove all asset types"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}
                  >
                    <path
                      d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Clear all
                </button>
              )}
              <button
                className="btn"
                onClick={handleTriggerFileImport}
                title="Import Excel (.xlsx, .xls) or CSV (.csv) file"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
              <div className="v">{assetTypes.length.toLocaleString()}</div>
              <div className="d">
                <span className="pill ok">Standard</span> models
              </div>
            </div>
            <div className="card k">
              <div className="l">Specification fields</div>
              <div className="v">{totalSpecsCount.toLocaleString()}</div>
              <div className="d">
                <span className="pill ok">Structured</span> parameters
              </div>
            </div>
            <div className="card k">
              <div className="l">Assets without a type</div>
              <div className="v">{unlinkedAssetsCount.toLocaleString()}</div>
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
                {categoryStats.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--mute)]">
                    No categories defined yet. Import a spreadsheet or add a type.
                  </div>
                ) : (
                  categoryStats.map((item) => (
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
                  ))
                )}
              </div>
            </div>

            {/* Right Panel: Asset types as expandable rows (details/summary) */}
            <div className="lg:col-span-8 card space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Asset types</h2>
                  <div className="text-xs text-[var(--mute)]">
                    {filterCategory ? `Filter: ${filterCategory}` : `${assetTypes.length} types registered`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={typesSearch}
                    onChange={(e) => {
                      setTypesSearch(e.target.value)
                      setTypesPage(1)
                    }}
                    placeholder="Search types..."
                    className="px-2.5 py-1 text-xs rounded border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)]"
                  />
                  {totalTypesPages > 1 && (
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => setTypesPage((p) => Math.max(1, p - 1))}
                        disabled={typesPage === 1}
                        className="px-1.5 py-0.5 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40"
                      >
                        ‹
                      </button>
                      <span>
                        {typesPage}/{totalTypesPages}
                      </span>
                      <button
                        onClick={() => setTypesPage((p) => Math.min(totalTypesPages, p + 1))}
                        disabled={typesPage === totalTypesPages}
                        className="px-1.5 py-0.5 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="divide-y divide-[var(--line)]">
                {filteredTypes.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="text-3xl">📚</div>
                    <div className="text-xs text-[var(--mute)]">
                      {assetTypes.length === 0
                        ? 'No asset types defined yet. Click "Import assets" or use the Quick-add form above to register an equipment template.'
                        : 'No asset types match your search filter.'}
                    </div>
                  </div>
                ) : (
                  pagedTypes.map((type) => {
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
                            <button
                              type="button"
                              onClick={(e) => handleDeleteType(type.id, e)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--mute)] hover:text-[var(--bad)] hover:bg-red-500/10 transition"
                              aria-label={`Delete type ${type.name}`}
                              title="Delete type"
                            >
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
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
                                onClick={() => {
                                  setFilterCategory(type.category)
                                  setActiveSubTab('gallery')
                                }}
                                className="text-xs font-semibold text-[var(--acc)] hover:underline flex items-center gap-1"
                              >
                                View {type.category} in Gallery →
                              </button>
                            </div>
                          </div>
                        </div>
                      </details>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
