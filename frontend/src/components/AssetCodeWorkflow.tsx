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

function readCodesFromFile(file: File): Promise<string[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) return []

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
    const firstRow = (rows[0] || []).map((value) => String(value).trim())
    const codeColumn = firstRow.findIndex((value) =>
      ['assetcode', 'code', 'assettag', 'tag', 'assetid', 'barcode', 'qrcode'].includes(normalized(value))
    )
    const startRow = codeColumn >= 0 ? 1 : 0
    const column = codeColumn >= 0 ? codeColumn : 0

    return rows.slice(startRow).map((row) => String(row[column] ?? '').trim()).filter(Boolean)
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

  const importCodes = async (file?: File) => {
    const codes = file
      ? await readCodesFromFile(file)
      : pastedCodes.split(/[\s,;]+/).map((code) => code.trim()).filter(Boolean)
    const knownCodes = new Set(assets.map((asset) => asset.assetCode.toLowerCase()))
    const uniqueCodes = [...new Set(codes.map((code) => code.trim()).filter(Boolean))]
    const newCodes = uniqueCodes.filter((code) => !knownCodes.has(code.toLowerCase()))

    if (newCodes.length === 0) {
      toast.info('No new asset codes found')
      return
    }

    onImportCodes(newCodes)
    setPastedCodes('')
    toast.success(`${newCodes.length} asset code${newCodes.length === 1 ? '' : 's'} imported and added to task queue`)
    setActiveTab('tasks')
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
              rows={3}
              placeholder={'Paste asset codes, one per line (e.g. AST000001, AST000002...)'}
              aria-label="Paste asset codes"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surf)] p-3 text-xs text-[var(--ink)] font-mono focus:outline-none focus:border-[var(--acc)]"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[var(--mute)]">
                {assets.length} codes total · {pendingAssets.length} awaiting data entry
              </span>
              <button
                type="button"
                className="btn p text-xs"
                onClick={() => void importCodes()}
                disabled={!pastedCodes.trim()}
              >
                Import pasted codes
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
                {unassignedAssets.map((asset) => (
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
              {filteredTaskAssets.length > 0 ? (
                filteredTaskAssets.map((asset) => {
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
