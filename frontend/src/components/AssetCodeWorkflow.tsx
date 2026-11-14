import * as React from 'react'
import * as XLSX from 'xlsx'
import type { UserProfile } from '@/lib/deviceTracker'
import type { Asset } from '@/types/asset'
import { toast } from 'sonner'

const DEPARTMENTS = [
  'IT',
  'Production',
  'Maintenance',
  'Store',
  'Finance',
  'Quality',
  'Operations',
  'Administration',
  'HR',
  'Engineering',
  'Warehouse',
]

interface AssetCodeWorkflowProps {
  assets: Asset[]
  user: UserProfile
  onImportCodes: (codes: string[]) => void
  onAssign: (assetId: string, department: string) => void
  onSelectAsset: (asset: Asset) => void
}

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const CODE_HEADER_ALIASES = new Set([
  'assetcode', 'code', 'assettag', 'tag', 'assetid', 'barcode', 'qrcode',
  'assetnumber', 'assetno', 'assetnum', 'sno', 'slno', '资产编号', '资产条码', '固定资产编号', '设备编号',
  'itemcode', 'equipmentcode', 'department', 'dept', 'model', 'category', 'plant', 'location', 'name', 'status', 'description'
])

export function parsePastedAssetCodes(raw: string): string[] {
  if (!raw || !raw.trim()) return []
  const lines = raw.split(/\r?\n/)
  const results: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    // If first row is a header row (e.g. "Asset Code \t Department \t Model"), skip the entire line
    if (i === 0) {
      const lower = trimmed.toLowerCase()
      if (
        (lower.includes('code') && (lower.includes('asset') || lower.includes('dept') || lower.includes('tag'))) ||
        lower.includes('资产编号') || lower.includes('资产条码') || lower.startsWith('s.no') || lower.startsWith('sno')
      ) {
        continue
      }
    }

    // Comma-delimited list of codes (e.g. "AST-001, AST-002, AST-003")
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map((p) => p.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      for (const p of parts) {
        if (p && !CODE_HEADER_ALIASES.has(normalized(p))) {
          results.push(p)
        }
      }
      continue
    }

    // Tab-delimited (copied table columns from Excel/Sheets) -> extract code column
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t').map((p) => p.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      const candidate = parts.find((p) => !CODE_HEADER_ALIASES.has(normalized(p))) || parts[0]
      if (candidate && !CODE_HEADER_ALIASES.has(normalized(candidate))) {
        results.push(candidate)
      }
      continue
    }

    const clean = trimmed.replace(/^["']|["']$/g, '').trim()
    if (clean && !CODE_HEADER_ALIASES.has(normalized(clean))) {
      results.push(clean)
    }
  }

  // Fallback if user pasted comma-separated codes all on one line without newlines
  if (results.length === 0 && raw.includes(',')) {
    return raw
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((p) => Boolean(p) && !CODE_HEADER_ALIASES.has(normalized(p)))
  }

  return [...new Set(results)]
}

function readCodesFromFile(file: File): Promise<string[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array', dense: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) return []

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
    if (rows.length === 0) return []

    // Find header row in first 5 rows
    let codeColumn = -1
    let headerRowIdx = 0

    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const row = (rows[r] || []).map((v) => String(v ?? '').trim())
      const colIdx = row.findIndex(
        (val) => CODE_HEADER_ALIASES.has(normalized(val)) || normalized(val).includes('assetcode') || normalized(val).includes('assetno')
      )
      if (colIdx >= 0) {
        codeColumn = colIdx
        headerRowIdx = r
        break
      }
    }

    const startRow = codeColumn >= 0 ? headerRowIdx + 1 : 0
    const column = codeColumn >= 0 ? codeColumn : 0

    const extracted: string[] = []
    for (let r = startRow; r < rows.length; r++) {
      const val = String(rows[r]?.[column] ?? '').trim().replace(/^["']|["']$/g, '')
      if (val && !CODE_HEADER_ALIASES.has(normalized(val))) {
        extracted.push(val)
      }
    }

    return [...new Set(extracted)]
  })
}

export const AssetCodeWorkflow: React.FC<AssetCodeWorkflowProps> = ({
  assets,
  user,
  onImportCodes,
  onAssign,
  onSelectAsset,
}) => {
  const isAdmin = user.role === 'Administrator' || user.role === 'Admin' || user.userId === 'USR-ADMIN'
  const userDepartment = user.department || 'IT'

  const [activeTab, setActiveTab] = React.useState<'tasks' | 'import'>('tasks')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'completed'>('all')
  const [departmentFilter, setDepartmentFilter] = React.useState<string>(isAdmin ? 'All' : userDepartment)
  const [pastedCodes, setPastedCodes] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [isImporting, setIsImporting] = React.useState(false)
  const [importProgressMessage, setImportProgressMessage] = React.useState('')

  // High-performance pagination state
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(50)

  // Reset to page 1 on filter or search changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, departmentFilter, query])

  // Categorize Assets
  const unassignedAssets = assets.filter((asset) => asset.status === 'Imported')
  const pendingAssets = assets.filter(
    (asset) => asset.status === 'Pending Verification' || asset.status === 'Imported'
  )
  const completedAssets = assets.filter(
    (asset) => asset.status === 'Completed' || asset.status === 'Active'
  )

  const departmentAssets = assets.filter(
    (asset) => asset.currentDepartment === userDepartment && asset.status === 'Pending Verification'
  )

  // Filtered task assets
  const filteredTaskAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      // Status filter
      if (statusFilter === 'pending') {
        if (asset.status !== 'Pending Verification' && asset.status !== 'Imported') return false
      } else if (statusFilter === 'completed') {
        if (asset.status !== 'Completed' && asset.status !== 'Active') return false
      }

      // Department scoping: If asset is already tagged to another department, scope by filter; unassigned codes are open to all
      const effectiveDept = !isAdmin && userDepartment ? userDepartment : departmentFilter
      if (effectiveDept !== 'All') {
        const d = (asset.currentDepartment || asset.department || '').toLowerCase()
        if (d && !d.includes(effectiveDept.toLowerCase())) return false
      }

      // Query filter
      if (query.trim()) {
        const q = query.toLowerCase()
        const text = [
          asset.assetCode,
          asset.name,
          asset.currentDescription,
          asset.serialNumber,
          asset.company,
          asset.building,
          asset.floor,
          asset.currentDepartment,
          asset.inChargeName,
          asset.inChargeId,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }

      return true
    })
  }, [assets, statusFilter, departmentFilter, query, isAdmin, userDepartment])

  // Paginated task slice for 60fps instant rendering even with 100k+ assets
  const totalFilteredTasks = filteredTaskAssets.length
  const totalPages = Math.max(1, Math.ceil(totalFilteredTasks / pageSize))
  const paginatedTasks = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTaskAssets.slice(start, start + pageSize)
  }, [filteredTaskAssets, currentPage, pageSize])

  // Live count of detected codes in paste input
  const detectedPastedCount = React.useMemo(() => {
    if (!pastedCodes.trim()) return 0
    return parsePastedAssetCodes(pastedCodes).length
  }, [pastedCodes])

  const importCodes = async (file?: File) => {
    setIsImporting(true)
    setImportProgressMessage('Parsing asset codes...')

    try {
      const codes = file
        ? await readCodesFromFile(file)
        : parsePastedAssetCodes(pastedCodes)

      if (codes.length === 0) {
        toast.info('No valid asset codes found to import.')
        setIsImporting(false)
        return
      }

      if (codes.length > 2000) {
        setImportProgressMessage(`Checking ${codes.length.toLocaleString()} codes for duplicates...`)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      const knownCodes = new Set(assets.map((asset) => asset.assetCode.toLowerCase()))
      const newCodes = codes.filter((code) => !knownCodes.has(code.toLowerCase()))

      if (newCodes.length === 0) {
        toast.info(`All ${codes.length.toLocaleString()} codes already exist in the system.`)
        setIsImporting(false)
        return
      }

      if (newCodes.length > 2000) {
        setImportProgressMessage(`Adding ${newCodes.length.toLocaleString()} codes to task queue...`)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      onImportCodes(newCodes)
      setPastedCodes('')
      toast.success(`${newCodes.length.toLocaleString()} asset code${newCodes.length === 1 ? '' : 's'} imported and added to task queue`)
      setActiveTab('tasks')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import asset codes')
    } finally {
      setIsImporting(false)
      setImportProgressMessage('')
    }
  }

  // Completion percentage
  const totalCodes = assets.length
  const completionPct = totalCodes > 0 ? Math.round((completedAssets.length / totalCodes) * 100) : 0

  return (
    <div className="space-y-6" id="v-task-dashboard">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📋</span>
            <div>
              <h1 className="text-lg font-bold text-[var(--ink)]">Asset Code Task Dashboard</h1>
              <div className="sub text-xs text-[var(--mute)]">
                {isAdmin
                  ? 'Import codes, track verification progress, and monitor department data completion.'
                  : `${userDepartment || 'Department'} data verification queue: Fill physical asset details for pending codes.`}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="pill w text-xs">
            {userDepartment ? `${userDepartment} Dept` : 'All Depts'}
          </span>
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'import' ? 'tasks' : 'import')}
            className={`btn text-xs flex items-center gap-1.5 ${activeTab === 'import' ? 'p' : ''}`}
          >
            <span>{activeTab === 'import' ? '📋 View Task Queue' : '+ Provide Asset Codes'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between">
          <div className="text-xs text-[var(--mute)] font-medium">Total Asset Codes</div>
          <div className="text-2xl font-bold text-[var(--ink)] my-1">{totalCodes}</div>
          <div className="text-[11px] text-[var(--mute)]">Provided in system</div>
        </div>
        <div className="card p-4 flex flex-col justify-between border-l-4 border-amber-500">
          <div className="text-xs text-[var(--mute)] font-medium">⏳ Pending Data Entry</div>
          <div className="text-2xl font-bold text-amber-500 my-1">{pendingAssets.length}</div>
          <div className="text-[11px] text-[var(--mute)]">Awaiting department input</div>
        </div>
        <div className="card p-4 flex flex-col justify-between border-l-4 border-[var(--ok)]">
          <div className="text-xs text-[var(--mute)] font-medium">✅ Completed / Filled</div>
          <div className="text-2xl font-bold text-[var(--ok)] my-1">{completedAssets.length}</div>
          <div className="text-[11px] text-[var(--mute)]">Details verified & active</div>
        </div>
        <div className="card p-4 flex flex-col justify-between">
          <div className="text-xs text-[var(--mute)] font-medium">Completion Rate</div>
          <div className="text-2xl font-bold text-[var(--acc)] my-1">{completionPct}%</div>
          <div className="w-full bg-[var(--surf2)] h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-[var(--acc)] h-full transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Code Provisioning Section (Optionally visible or toggled) */}
      {(activeTab === 'import' || isAdmin) && (
        <div className="space-y-4">
          <section className="card p-5 space-y-4" aria-label="Import asset codes">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--ink)]">Import asset codes</h2>
                <p className="text-xs text-[var(--mute)]">
                  Provide asset codes here. Once added, codes immediately move into the Task Dashboard below for departments to fill out.
                </p>
              </div>
              <label className="btn p text-xs cursor-pointer flex items-center gap-1.5">
                <span>📁</span>
                <span>Import spreadsheet</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  aria-label="Import asset code spreadsheet"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void importCodes(file)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
            </div>

            <textarea
              value={pastedCodes}
              onChange={(event) => setPastedCodes(event.target.value)}
              rows={4}
              placeholder={'Paste asset codes, one per line (e.g. AST000001, AST000002... or copy an entire column from Excel/CSV)'}
              aria-label="Paste asset codes"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surf)] p-3 text-xs text-[var(--ink)] font-mono focus:outline-none focus:border-[var(--acc)]"
              disabled={isImporting}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--mute)]">
                  {assets.length.toLocaleString()} codes total · {pendingAssets.length.toLocaleString()} awaiting data entry
                </span>
                {detectedPastedCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    ✨ {detectedPastedCount.toLocaleString()} codes ready to import
                  </span>
                )}
                {isImporting && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                    <span>{importProgressMessage || 'Importing asset codes...'}</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn p text-xs flex items-center gap-1.5"
                onClick={() => void importCodes()}
                disabled={!pastedCodes.trim() || isImporting}
              >
                <span>{isImporting ? '⏳ Importing...' : 'Import pasted codes'}</span>
              </button>
            </div>
          </section>

          {/* Department assignment section is hidden from visual UI for streamlined workflow: codes are open for all department members to claim directly */}
          {unassignedAssets.length > 0 && (
            <section className="sr-only" aria-label="Assign asset codes">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
                <h2 className="text-sm font-bold text-[var(--ink)]">Assign asset codes</h2>
                <span className="text-xs text-[var(--mute)]">{unassignedAssets.length} unassigned</span>
              </div>
              <div className="divide-y divide-[var(--line)] max-h-60 overflow-y-auto">
                {unassignedAssets.slice(0, 25).map((asset) => (
                  <AssignmentRow key={asset.id} asset={asset} onAssign={onAssign} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Main Task Queue Dashboard */}
      <section className="card p-5 space-y-4" aria-label="Department asset verification">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--ink)]">
              {userDepartment} · Pending verification
            </h2>
            <p className="text-xs text-[var(--mute)]">
              Select or search any code to open the physical asset registration form with the code pre-filled.
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surf)]">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[var(--acc)] text-white shadow-xs'
                  : 'text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              All Tasks ({assets.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-amber-500 hover:text-amber-600'
              }`}
            >
              ⏳ Pending ({pendingAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-[var(--ok)] text-white shadow-xs font-bold'
                  : 'text-[var(--ok)] hover:text-emerald-600'
              }`}
            >
              ✅ Completed ({completedAssets.length})
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Department Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setDepartmentFilter('All')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                departmentFilter === 'All'
                  ? 'bg-[var(--acc)] text-white'
                  : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              All Depts
            </button>
            {DEPARTMENTS.slice(0, 7).map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setDepartmentFilter(dept)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                  departmentFilter.toLowerCase() === dept.toLowerCase()
                    ? 'bg-[var(--acc)] text-white'
                    : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search or scan asset code"
              aria-label="Search or scan asset code"
              className="w-full text-xs py-1.5 pl-8 pr-4 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
            />
            <span className="absolute left-2.5 top-1.5 text-xs text-[var(--mute)]">🔍</span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1 text-xs text-[var(--mute)] hover:text-[var(--ink)]"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Tasks Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--mute)] uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Asset Code</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Data Status</th>
                <th className="py-2.5 px-3">Location & Custodian</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {paginatedTasks.length > 0 ? (
                paginatedTasks.map((asset) => {
                  const isCompleted = asset.status === 'Completed' || asset.status === 'Active'
                  const dept = asset.currentDepartment || asset.department || 'Unassigned'
                  const inCharge = asset.inChargeName || asset.submitter || asset.assignedTo || '-'
                  const loc = [asset.company || 'IIPL', asset.building || 'C39', asset.floor].filter(Boolean).join(' · ')

                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-[var(--surf2)]/50 transition-colors"
                    >
                      {/* Asset Code */}
                      <td className="py-3 px-3 font-mono font-bold text-sm text-[var(--ink)]">
                        <div className="flex items-center gap-1.5">
                          <span>🏷️</span>
                          <span>{asset.assetCode}</span>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[var(--acc)]/10 text-[var(--acc)]">
                          {dept}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <span>✅</span>
                            <span>Data Filled & Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <span>⏳</span>
                            <span>Pending Data Entry</span>
                          </span>
                        )}
                      </td>

                      {/* Location & Custodian */}
                      <td className="py-3 px-3">
                        {isCompleted ? (
                          <div>
                            <div className="font-semibold text-[var(--ink)]">{loc}</div>
                            <div className="text-[11px] text-[var(--mute)]">In-Charge: {inCharge}</div>
                          </div>
                        ) : (
                          <span className="text-[var(--mute)] italic">Details not yet registered</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          className="btn p text-xs py-1.5 px-3 flex items-center gap-1 ml-auto cursor-pointer"
                          onClick={() => onSelectAsset(asset)}
                          aria-label="Select code"
                        >
                          <span>{isCompleted ? '👁️' : '📝'}</span>
                          <span>Select code</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-[var(--mute)]">
                    {departmentAssets.length
                      ? 'No matching codes in your active filter.'
                      : 'No pending asset codes assigned to this department.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* High-Performance Pagination Toolbar */}
        {totalFilteredTasks > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--line)] text-xs text-[var(--mute)]">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-[var(--ink)] font-mono">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-[var(--ink)] font-mono">
                  {Math.min(currentPage * pageSize, totalFilteredTasks).toLocaleString()}
                </strong>{' '}
                of <strong className="text-[var(--ink)] font-mono">{totalFilteredTasks.toLocaleString()}</strong> tasks
              </span>
              <div className="flex items-center gap-1 ml-2">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="bg-[var(--surf2)] border border-[var(--line)] rounded px-1.5 py-0.5 text-xs text-[var(--ink)] cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--line)] transition cursor-pointer font-medium"
                title="First Page"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--line)] transition cursor-pointer font-medium"
              >
                ‹ Prev
              </button>
              <span className="px-2 font-mono text-[var(--ink)] font-semibold">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--line)] transition cursor-pointer font-medium"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--line)] transition cursor-pointer font-medium"
                title="Last Page"
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function AssignmentRow({
  asset,
  onAssign,
}: {
  asset: Asset
  onAssign: (assetId: string, department: string) => void
}) {
  const [department, setDepartment] = React.useState(DEPARTMENTS[0])
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <span className="font-mono text-xs font-bold">{asset.assetCode}</span>
      <div className="flex items-center gap-2">
        <select
          aria-label={`Department for ${asset.assetCode}`}
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          className="rounded-lg border border-[var(--line)] bg-[var(--surf)] px-2.5 py-1 text-xs"
        >
          {DEPARTMENTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn p text-xs py-1 px-3"
          onClick={() => onAssign(asset.id, department)}
        >
          Assign
        </button>
      </div>
    </div>
  )
}

export default AssetCodeWorkflow
