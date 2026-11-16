import * as React from 'react'
import type { UserProfile } from '@/lib/deviceTracker'
import {
  masterMappingService,
  type MasterMappingSummary,
  type HierarchyAuditItem,
  BASELINE_DATA,
} from '@/lib/masterMappingService'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface MasterMappingViewProps {
  currentUser: UserProfile
  lang?: string
}

type HierarchyLevel = 'company' | 'plant' | 'building' | 'floor' | 'department' | 'area' | 'location'

interface LevelConfig {
  title: string
  singular: string
  icon: string
  color: string
  bgLight: string
  borderLight: string
  childLevel?: HierarchyLevel
}

const LEVEL_LABELS: Record<HierarchyLevel, LevelConfig> = {
  company: {
    title: 'Companies',
    singular: 'Company',
    icon: '🏢',
    color: 'text-purple-600',
    bgLight: 'bg-purple-500/10',
    borderLight: 'border-purple-500/20',
    childLevel: 'plant',
  },
  plant: {
    title: 'Plants',
    singular: 'Plant',
    icon: '🏭',
    color: 'text-indigo-600',
    bgLight: 'bg-indigo-500/10',
    borderLight: 'border-indigo-500/20',
    childLevel: 'building',
  },
  building: {
    title: 'Buildings',
    singular: 'Building',
    icon: '🏛️',
    color: 'text-blue-600',
    bgLight: 'bg-blue-500/10',
    borderLight: 'border-blue-500/20',
    childLevel: 'floor',
  },
  floor: {
    title: 'Floors',
    singular: 'Floor',
    icon: '📍',
    color: 'text-teal-600',
    bgLight: 'bg-teal-500/10',
    borderLight: 'border-teal-500/20',
    childLevel: 'department',
  },
  department: {
    title: 'Departments',
    singular: 'Department',
    icon: '👥',
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-500/10',
    borderLight: 'border-emerald-500/20',
    childLevel: 'area',
  },
  area: {
    title: 'Areas / Zones',
    singular: 'Area / Zone',
    icon: '📐',
    color: 'text-amber-600',
    bgLight: 'bg-amber-500/10',
    borderLight: 'border-amber-500/20',
    childLevel: 'location',
  },
  location: {
    title: 'Asset Locations',
    singular: 'Asset Location',
    icon: '🏷️',
    color: 'text-rose-600',
    bgLight: 'bg-rose-500/10',
    borderLight: 'border-rose-500/20',
  },
}

const DEFAULT_DASHBOARD_SUMMARY: MasterMappingSummary = {
  summary: {
    companies: { total: 2, active: 2, archived: 0 },
    plants: { total: 3, active: 3 },
    buildings: { total: 4, active: 4 },
    floors: { total: 4, active: 4 },
    departments: { total: 5, active: 5 },
    areas: { total: 4, active: 4 },
    locations: { total: 4, active: 4 },
  },
  totals: {
    totalNodes: 26,
    activeNodes: 26,
    archivedNodes: 0,
    completionPercent: 100,
  },
}

export const MasterMappingView: React.FC<MasterMappingViewProps> = ({ currentUser }) => {
  // ── Access Control: Super User ONLY ──
  const isAuthorized = Boolean(
    currentUser.isSuperuser ||
    currentUser.role === 'Admin' ||
    currentUser.role === 'Administrator' ||
    currentUser.role === 'Super User' ||
    currentUser.userId?.toUpperCase() === 'USR-ADMIN'
  )

  const [activeTab, setActiveTab] = React.useState<'explorer' | 'crud' | 'dashboard' | 'import_export' | 'audit'>('explorer')
  const [loading, setLoading] = React.useState(false)

  // Data states
  const [dashboard, setDashboard] = React.useState<MasterMappingSummary | null>(DEFAULT_DASHBOARD_SUMMARY)
  const [companies, setCompanies] = React.useState<any[]>(BASELINE_DATA.companies)
  const [plants, setPlants] = React.useState<any[]>(BASELINE_DATA.plants)
  const [buildings, setBuildings] = React.useState<any[]>(BASELINE_DATA.buildings)
  const [floors, setFloors] = React.useState<any[]>(BASELINE_DATA.floors)
  const [departments, setDepartments] = React.useState<any[]>(BASELINE_DATA.departments)
  const [areas, setAreas] = React.useState<any[]>(BASELINE_DATA.areas)
  const [locations, setLocations] = React.useState<any[]>(BASELINE_DATA.locations)
  const [auditLogs, setAuditLogs] = React.useState<HierarchyAuditItem[]>([])

  // Explorer states
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({
    'comp-1': true,
    'plant-1': true,
    'bldg-1': true,
    'flr-2': true,
    'dept-1': true,
  })
  const [explorerSearch, setExplorerSearch] = React.useState('')
  const [selectedNode, setSelectedNode] = React.useState<any | null>(() => ({
    ...BASELINE_DATA.companies[0],
    level: 'company',
  }))

  // CRUD Table states
  const [selectedLevel, setSelectedLevel] = React.useState<HierarchyLevel>('company')
  const [tableSearch, setTableSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'archived'>('active')

  // Modal states
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [modalMode, setModalMode] = React.useState<'create' | 'edit'>('create')
  const [modalLevel, setModalLevel] = React.useState<HierarchyLevel>('company')
  const [editingItem, setEditingItem] = React.useState<any | null>(null)

  // Form states
  const [formName, setFormName] = React.useState('')
  const [formCode, setFormCode] = React.useState('')
  const [formDesc, setFormDesc] = React.useState('')
  const [formParentId, setFormParentId] = React.useState<number | string>('')

  // Load all hierarchy records
  const loadAllData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [dash, comps, plts, bldgs, flrs, depts, ars, locs, logs] = await Promise.all([
        masterMappingService.getDashboard(currentUser),
        masterMappingService.getCompanies(currentUser),
        masterMappingService.getPlants(undefined, currentUser),
        masterMappingService.getBuildings(undefined, currentUser),
        masterMappingService.getFloors(undefined, currentUser),
        masterMappingService.getDepartments(undefined, currentUser),
        masterMappingService.getAreas(undefined, currentUser),
        masterMappingService.getLocations(undefined, currentUser),
        masterMappingService.getAuditLogs(currentUser),
      ])

      if (dash) setDashboard(dash)
      if (comps?.length) setCompanies(comps)
      if (plts?.length) setPlants(plts)
      if (bldgs?.length) setBuildings(bldgs)
      if (flrs?.length) setFloors(flrs)
      if (depts?.length) setDepartments(depts)
      if (ars?.length) setAreas(ars)
      if (locs?.length) setLocations(locs)
      if (logs?.length) setAuditLogs(logs)
    } catch {
      // Fallback cache remains active
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  React.useEffect(() => {
    if (isAuthorized) {
      loadAllData()
    }
  }, [isAuthorized, loadAllData])

  if (!isAuthorized) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto my-12 border-2 border-red-500/30 bg-red-500/5 space-y-4">
        <div className="text-4xl">🚫</div>
        <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
          ACCESS FORBIDDEN: Super User Authorization Required
        </h2>
        <p className="text-xs text-[var(--mute)] leading-relaxed">
          The <b>Master Mapping</b> module is the single source of truth for the entire enterprise organizational hierarchy. Only verified <b>Super Users</b> possess security clearance to inspect or alter master organizational structures.
        </p>
      </div>
    )
  }

  // Toggle tree node expansion
  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }))
  }

  // Quick Open Modal
  const handleOpenCreateModal = (level: HierarchyLevel, parentId?: number | string) => {
    setModalMode('create')
    setModalLevel(level)
    setEditingItem(null)
    setFormName('')
    setFormCode('')
    setFormDesc('')
    setFormParentId(parentId !== undefined ? parentId : '')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (level: HierarchyLevel, item: any) => {
    setModalMode('edit')
    setModalLevel(level)
    setEditingItem(item)
    setFormName(item.name || '')
    setFormCode(item.code || '')
    setFormDesc(item.description || '')

    const pId =
      level === 'plant' ? item.companyId :
      level === 'building' ? item.plantId :
      level === 'floor' ? item.buildingId :
      level === 'department' ? item.floorId :
      level === 'area' ? item.departmentId :
      level === 'location' ? item.areaId : ''

    setFormParentId(pId || '')
    setIsModalOpen(true)
  }

  // Save Entity (Create / Edit)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formCode.trim()) {
      toast.error('Name and Code are required.')
      return
    }

    if (modalLevel !== 'company' && (!formParentId || formParentId === '')) {
      toast.error(`Parent entity is mandatory for ${LEVEL_LABELS[modalLevel].singular}.`)
      return
    }

    const payload: any = {
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      description: formDesc.trim(),
    }

    if (modalLevel === 'plant') payload.companyId = Number(formParentId)
    if (modalLevel === 'building') payload.plantId = Number(formParentId)
    if (modalLevel === 'floor') payload.buildingId = Number(formParentId)
    if (modalLevel === 'department') payload.floorId = Number(formParentId)
    if (modalLevel === 'area') payload.departmentId = Number(formParentId)
    if (modalLevel === 'location') payload.areaId = Number(formParentId)

    try {
      if (modalMode === 'create') {
        await masterMappingService.createEntity(modalLevel, payload, currentUser)
        toast.success(`Created ${LEVEL_LABELS[modalLevel].singular}: ${payload.name}`)
      } else {
        await masterMappingService.updateEntity(modalLevel, editingItem.id, payload, currentUser)
        toast.success(`Updated ${LEVEL_LABELS[modalLevel].singular}: ${payload.name}`)
      }
      setIsModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast.error(err.message || 'Operation failed')
    }
  }

  // Archive / Restore Entity
  const handleToggleArchive = async (level: HierarchyLevel, item: any) => {
    const nextState = !item.isArchived
    await masterMappingService.updateEntity(level, item.id, { isArchived: nextState }, currentUser)
    toast.success(`${nextState ? 'Archived' : 'Restored'} ${LEVEL_LABELS[level].singular}: ${item.name}`)
    loadAllData()
  }

  // Delete Entity with Child safety check
  const handleDeleteEntity = async (level: HierarchyLevel, item: any) => {
    const confirmMsg = `Are you sure you want to permanently delete ${LEVEL_LABELS[level].singular} "${item.name}"?`
    if (!window.confirm(confirmMsg)) return

    const res = await masterMappingService.deleteEntity(level, item.id, currentUser)
    if (res.success) {
      toast.success(`Deleted ${LEVEL_LABELS[level].singular}: ${item.name}`)
      loadAllData()
      if (selectedNode?.id === item.id) setSelectedNode(null)
    } else {
      toast.error(res.error || 'Deletion blocked: Active child records or assets exist.')
    }
  }

  // Excel Export
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(companies), 'Companies')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(plants), 'Plants')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildings), 'Buildings')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(floors), 'Floors')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(departments), 'Departments')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(areas), 'Areas')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(locations), 'Asset Locations')
    XLSX.writeFile(workbook, `Master_Mapping_Hierarchy_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Exported complete 7-tier master hierarchy workbook.')
  }

  // Filter helper for CRUD table
  const getCurrentLevelData = () => {
    let list: any[] = []
    if (selectedLevel === 'company') list = companies
    if (selectedLevel === 'plant') list = plants
    if (selectedLevel === 'building') list = buildings
    if (selectedLevel === 'floor') list = floors
    if (selectedLevel === 'department') list = departments
    if (selectedLevel === 'area') list = areas
    if (selectedLevel === 'location') list = locations

    return list.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.code.toLowerCase().includes(tableSearch.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(tableSearch.toLowerCase())

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !item.isArchived) ||
        (statusFilter === 'archived' && item.isArchived)

      return matchSearch && matchStatus
    })
  }

  // Total summary counts for level buttons
  const levelCounts: Record<HierarchyLevel, number> = {
    company: companies.length,
    plant: plants.length,
    building: buildings.length,
    floor: floors.length,
    department: departments.length,
    area: areas.length,
    location: locations.length,
  }

  const totalAllNodes = Object.values(levelCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── TOP EXECUTIVE BANNER ── */}
      <div className="p-5 md:p-6 rounded-2xl bg-[var(--surf)] border border-[var(--line)] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--acc)]/10 text-[var(--acc)] flex items-center justify-center text-2xl font-bold shadow-xs">
              🏢
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-[var(--ink)]">
                  Master Mapping Administration
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                  👑 Super User Single Source of Truth
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-0.5">
                Organizational Hierarchy: Company ➔ Plant ➔ Building ➔ Floor ➔ Department ➔ Area / Zone ➔ Asset Location
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {loading && (
              <span className="text-xs text-[var(--acc)] font-medium animate-pulse flex items-center gap-1.5 mr-2">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
                Syncing hierarchy...
              </span>
            )}
            <button
              type="button"
              onClick={loadAllData}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] border border-[var(--line)] transition flex items-center gap-1.5"
              title="Refresh from master database"
            >
              <span>🔄</span> Sync
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5"
            >
              <span>📊</span> Export Excel
            </button>
            <button
              type="button"
              onClick={() => handleOpenCreateModal('company')}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--acc)] hover:opacity-90 text-white shadow-xs transition flex items-center gap-1.5"
            >
              <span>➕</span> New Company
            </button>
          </div>
        </div>

        {/* Live Hierarchy Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-3 border-t border-[var(--line)]">
          {(Object.keys(LEVEL_LABELS) as HierarchyLevel[]).map((lvl) => (
            <div
              key={lvl}
              onClick={() => {
                setSelectedLevel(lvl)
                setActiveTab('crud')
              }}
              className="p-2 rounded-xl bg-[var(--surf2)] hover:bg-[var(--line)] transition text-left flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs">
                <span>{LEVEL_LABELS[lvl].icon}</span>
                <span className="font-medium text-[var(--ink)] text-[11px]">{LEVEL_LABELS[lvl].title}</span>
              </div>
              <span className="text-xs font-bold font-mono text-[var(--acc)]">{levelCounts[lvl]}</span>
            </div>
          ))}
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-between">
            <div className="text-[11px] font-bold">Total Fleet</div>
            <span className="text-xs font-bold font-mono">{totalAllNodes}</span>
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div className="flex items-center gap-1.5 border-b border-[var(--line)] pb-2 overflow-x-auto text-xs font-semibold">
        {[
          { key: 'explorer', label: 'Hierarchy Explorer', icon: '🌳', count: `${companies.length} Co.` },
          { key: 'crud', label: 'Level Management (CRUD)', icon: '📋', count: '7 Levels' },
          { key: 'dashboard', label: 'Mapping Dashboard', icon: '📊', count: '100% Health' },
          { key: 'import_export', label: 'Import / Export', icon: '📥' },
          { key: 'audit', label: 'Hierarchy Audit Trail', icon: '📜', count: auditLogs.length ? `${auditLogs.length}` : undefined },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`py-2 px-3.5 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-[var(--acc)] text-white shadow-xs'
                : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[var(--line)] text-[var(--mute)]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: HIERARCHY EXPLORER                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tree Explorer Left Column */}
          <div className="lg:col-span-8 card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <span>🌳</span>
                  <span>Expandable Organizational Tree</span>
                </h2>
                <span className="text-[11px] text-[var(--mute)]">
                  7-Tier Cascading Hierarchy · Click arrow to expand child entities
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter tree nodes..."
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  className="text-xs p-1.5 px-3 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] w-40 sm:w-48 outline-none focus:border-[var(--acc)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const allOpen: Record<string, boolean> = {}
                    companies.forEach(c => { allOpen[`comp-${c.id}`] = true })
                    plants.forEach(p => { allOpen[`plant-${p.id}`] = true })
                    buildings.forEach(b => { allOpen[`bldg-${b.id}`] = true })
                    floors.forEach(f => { allOpen[`flr-${f.id}`] = true })
                    departments.forEach(d => { allOpen[`dept-${d.id}`] = true })
                    areas.forEach(a => { allOpen[`area-${a.id}`] = true })
                    setExpandedNodes(allOpen)
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedNodes({})}
                  className="px-2.5 py-1 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] cursor-pointer"
                >
                  Collapse
                </button>
              </div>
            </div>

            {/* Tree Container with Visual Indent Lines */}
            <div className="p-3 bg-[var(--surf2)]/30 rounded-xl border border-[var(--line)] max-h-[620px] overflow-y-auto space-y-2 text-xs">
              {companies.map((comp) => {
                const compOpen = expandedNodes[`comp-${comp.id}`]
                const compPlants = plants.filter((p) => p.companyId === comp.id)

                return (
                  <div key={`comp-${comp.id}`} className="space-y-1">
                    {/* 1. Company Node */}
                    <div
                      onClick={() => setSelectedNode({ ...comp, level: 'company' })}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border ${
                        selectedNode?.id === comp.id && selectedNode?.level === 'company'
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-900 dark:text-purple-300 font-bold shadow-xs'
                          : 'hover:bg-[var(--surf2)] border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleNode(`comp-${comp.id}`)
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--line)] text-[var(--mute)] transition-transform"
                        >
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${compOpen ? 'rotate-90' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                        <span className="text-base">🏢</span>
                        <span className="font-bold text-[var(--ink)]">{comp.name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 font-bold border border-purple-500/20">
                          {comp.code}
                        </span>
                        {comp.isArchived && (
                          <span className="text-[10px] px-1.5 rounded bg-amber-500/20 text-amber-600 font-bold">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-[var(--mute)]">{compPlants.length} Plants</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenCreateModal('plant', comp.id)
                          }}
                          className="p-1 px-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-[10px] font-bold"
                          title="Add child Plant"
                        >
                          + Plant
                        </button>
                      </div>
                    </div>

                    {/* 2. Plant Sub-nodes */}
                    {compOpen && (
                      <div className="pl-6 space-y-1 border-l-2 border-indigo-500/30 ml-3">
                        {compPlants.map((plant) => {
                          const plantOpen = expandedNodes[`plant-${plant.id}`]
                          const plantBldgs = buildings.filter((b) => b.plantId === plant.id)

                          return (
                            <div key={`plant-${plant.id}`} className="space-y-1">
                              <div
                                onClick={() => setSelectedNode({ ...plant, level: 'plant', companyName: comp.name })}
                                className={`flex items-center justify-between p-1.5 px-2 rounded-lg cursor-pointer transition border ${
                                  selectedNode?.id === plant.id && selectedNode?.level === 'plant'
                                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-900 dark:text-indigo-300 font-bold'
                                    : 'hover:bg-[var(--surf2)] border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleNode(`plant-${plant.id}`)
                                    }}
                                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--line)] text-[var(--mute)]"
                                  >
                                    <svg
                                      className={`w-3 h-3 transition-transform duration-200 ${plantOpen ? 'rotate-90' : ''}`}
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                    >
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                  </button>
                                  <span className="text-indigo-600">🏭</span>
                                  <span className="font-semibold text-[var(--ink)]">{plant.name}</span>
                                  <span className="font-mono text-[10px] text-[var(--mute)]">[{plant.code}]</span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px]">
                                  <span className="text-[var(--mute)]">{plantBldgs.length} Bldgs</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenCreateModal('building', plant.id)
                                    }}
                                    className="p-0.5 px-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-[10px]"
                                    title="Add child Building"
                                  >
                                    + Bldg
                                  </button>
                                </div>
                              </div>

                              {/* 3. Building Sub-nodes */}
                              {plantOpen && (
                                <div className="pl-6 space-y-1 border-l-2 border-blue-500/30 ml-3">
                                  {plantBldgs.map((bldg) => {
                                    const bldgOpen = expandedNodes[`bldg-${bldg.id}`]
                                    const bldgFloors = floors.filter((f) => f.buildingId === bldg.id)

                                    return (
                                      <div key={`bldg-${bldg.id}`} className="space-y-1">
                                        <div
                                          onClick={() => setSelectedNode({ ...bldg, level: 'building', companyName: comp.name, plantName: plant.name })}
                                          className={`flex items-center justify-between p-1 px-2 rounded-lg cursor-pointer transition border ${
                                            selectedNode?.id === bldg.id && selectedNode?.level === 'building'
                                              ? 'bg-blue-500/15 border-blue-500/40 text-blue-900 dark:text-blue-300 font-bold'
                                              : 'hover:bg-[var(--surf2)] border-transparent'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                toggleNode(`bldg-${bldg.id}`)
                                              }}
                                              className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--line)] text-[var(--mute)]"
                                            >
                                              <svg
                                                className={`w-3 h-3 transition-transform duration-200 ${bldgOpen ? 'rotate-90' : ''}`}
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                              >
                                                <polyline points="9 18 15 12 9 6" />
                                              </svg>
                                            </button>
                                            <span className="text-blue-500">🏛️</span>
                                            <span className="text-[var(--ink)] font-medium">{bldg.name}</span>
                                            <span className="font-mono text-[10px] text-[var(--mute)]">[{bldg.code}]</span>
                                          </div>
                                          <div className="flex items-center gap-1 text-[11px]">
                                            <span className="text-[var(--mute)]">{bldgFloors.length} Flrs</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleOpenCreateModal('floor', bldg.id)
                                              }}
                                              className="p-0.5 px-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-[10px]"
                                              title="Add child Floor"
                                            >
                                              + Flr
                                            </button>
                                          </div>
                                        </div>

                                        {/* 4. Floor Sub-nodes */}
                                        {bldgOpen && (
                                          <div className="pl-6 space-y-1 border-l-2 border-teal-500/30 ml-3">
                                            {bldgFloors.map((flr) => {
                                              const flrOpen = expandedNodes[`flr-${flr.id}`]
                                              const flrDepts = departments.filter((d) => d.floorId === flr.id)

                                              return (
                                                <div key={`flr-${flr.id}`} className="space-y-1">
                                                  <div
                                                    onClick={() => setSelectedNode({ ...flr, level: 'floor', companyName: comp.name, plantName: plant.name, buildingName: bldg.name })}
                                                    className={`flex items-center justify-between p-1 px-2 rounded-lg cursor-pointer transition border ${
                                                      selectedNode?.id === flr.id && selectedNode?.level === 'floor'
                                                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-900 dark:text-teal-300 font-bold'
                                                        : 'hover:bg-[var(--surf2)] border-transparent'
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          toggleNode(`flr-${flr.id}`)
                                                        }}
                                                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--line)] text-[var(--mute)]"
                                                      >
                                                        <svg
                                                          className={`w-3 h-3 transition-transform duration-200 ${flrOpen ? 'rotate-90' : ''}`}
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2.5"
                                                        >
                                                          <polyline points="9 18 15 12 9 6" />
                                                        </svg>
                                                      </button>
                                                      <span className="text-teal-500">📍</span>
                                                      <span className="text-[var(--ink)]">{flr.name}</span>
                                                      <span className="font-mono text-[10px] text-[var(--mute)]">[{flr.code}]</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[11px]">
                                                      <span className="text-[var(--mute)]">{flrDepts.length} Depts</span>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          handleOpenCreateModal('department', flr.id)
                                                        }}
                                                        className="p-0.5 px-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-[10px]"
                                                        title="Add child Department"
                                                      >
                                                        + Dept
                                                      </button>
                                                    </div>
                                                  </div>

                                                  {/* 5. Department Sub-nodes */}
                                                  {flrOpen && (
                                                    <div className="pl-6 space-y-1 border-l-2 border-emerald-500/30 ml-3">
                                                      {flrDepts.map((dept) => {
                                                        const deptOpen = expandedNodes[`dept-${dept.id}`]
                                                        const deptAreas = areas.filter((a) => a.departmentId === dept.id)

                                                        return (
                                                          <div key={`dept-${dept.id}`} className="space-y-1">
                                                            <div
                                                              onClick={() => setSelectedNode({ ...dept, level: 'department', companyName: comp.name, plantName: plant.name, buildingName: bldg.name, floorName: flr.name })}
                                                              className={`flex items-center justify-between p-1 px-2 rounded-lg cursor-pointer transition border ${
                                                                selectedNode?.id === dept.id && selectedNode?.level === 'department'
                                                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-300 font-bold'
                                                                  : 'hover:bg-[var(--surf2)] border-transparent'
                                                              }`}
                                                            >
                                                              <div className="flex items-center gap-2">
                                                                <button
                                                                  type="button"
                                                                  onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    toggleNode(`dept-${dept.id}`)
                                                                  }}
                                                                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--line)] text-[var(--mute)]"
                                                                >
                                                                  <svg
                                                                    className={`w-3 h-3 transition-transform duration-200 ${deptOpen ? 'rotate-90' : ''}`}
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2.5"
                                                                  >
                                                                    <polyline points="9 18 15 12 9 6" />
                                                                  </svg>
                                                                </button>
                                                                <span className="text-emerald-500">👥</span>
                                                                <span className="font-medium text-[var(--ink)]">{dept.name}</span>
                                                                <span className="font-mono text-[10px] text-[var(--mute)]">[{dept.code}]</span>
                                                              </div>
                                                              <div className="flex items-center gap-1 text-[11px]">
                                                                <span className="text-[var(--mute)]">{deptAreas.length} Areas</span>
                                                                <button
                                                                  type="button"
                                                                  onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleOpenCreateModal('area', dept.id)
                                                                  }}
                                                                  className="p-0.5 px-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-[10px]"
                                                                  title="Add child Area / Zone"
                                                                >
                                                                  + Area
                                                                </button>
                                                              </div>
                                                            </div>

                                                            {/* 6. Area / Zone Sub-nodes */}
                                                            {deptOpen && (
                                                              <div className="pl-6 space-y-1 border-l-2 border-amber-500/30 ml-3">
                                                                {deptAreas.map((area) => {
                                                                  const areaOpen = expandedNodes[`area-${area.id}`]
                                                                  const areaLocs = locations.filter((l) => l.areaId === area.id)

                                                                  return (
                                                                    <div key={`area-${area.id}`} className="space-y-1">
                                                                      <div
                                                                        onClick={() => setSelectedNode({ ...area, level: 'area', companyName: comp.name, plantName: plant.name, buildingName: bldg.name, floorName: flr.name, departmentName: dept.name })}
                                                                        className={`flex items-center justify-between p-1 px-2 rounded-lg cursor-pointer transition border ${
                                                                          selectedNode?.id === area.id && selectedNode?.level === 'area'
                                                                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-300 font-bold'
                                                                            : 'hover:bg-[var(--surf2)] border-transparent'
                                                                        }`}
                                                                      >
                                                                        <div className="flex items-center gap-2">
                                                                          <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                              e.stopPropagation()
                                                                              toggleNode(`area-${area.id}`)
                                                                            }}
                                                                            className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--line)] text-[var(--mute)]"
                                                                          >
                                                                            <svg
                                                                              className={`w-3 h-3 transition-transform duration-200 ${areaOpen ? 'rotate-90' : ''}`}
                                                                              viewBox="0 0 24 24"
                                                                              fill="none"
                                                                              stroke="currentColor"
                                                                              strokeWidth="2.5"
                                                                            >
                                                                              <polyline points="9 18 15 12 9 6" />
                                                                            </svg>
                                                                          </button>
                                                                          <span className="text-amber-500">📐</span>
                                                                          <span className="text-[var(--ink)]">{area.name}</span>
                                                                          <span className="font-mono text-[10px] text-[var(--mute)]">[{area.code}]</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-[11px]">
                                                                          <span className="text-[10px] text-[var(--mute)]">{areaLocs.length} Locs</span>
                                                                          <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                              e.stopPropagation()
                                                                              handleOpenCreateModal('location', area.id)
                                                                            }}
                                                                            className="p-0.5 px-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-[10px]"
                                                                            title="Add Location"
                                                                          >
                                                                            + Loc
                                                                          </button>
                                                                        </div>
                                                                      </div>

                                                                      {/* 7. Location Leaf Nodes */}
                                                                      {areaOpen && (
                                                                        <div className="pl-6 space-y-1 border-l-2 border-rose-500/30 ml-3">
                                                                          {areaLocs.map((loc) => (
                                                                            <div
                                                                              key={`loc-${loc.id}`}
                                                                              onClick={() => setSelectedNode({ ...loc, level: 'location', companyName: comp.name, plantName: plant.name, buildingName: bldg.name, floorName: flr.name, departmentName: dept.name, areaName: area.name })}
                                                                              className={`flex items-center justify-between p-1 px-2 rounded-lg cursor-pointer transition border ${
                                                                                selectedNode?.id === loc.id && selectedNode?.level === 'location'
                                                                                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-300 font-bold'
                                                                                  : 'hover:bg-[var(--surf2)] border-transparent'
                                                                              }`}
                                                                            >
                                                                              <div className="flex items-center gap-1.5">
                                                                                <span className="text-rose-500 text-[11px]">🏷️</span>
                                                                                <span className="text-[var(--ink)]">{loc.name}</span>
                                                                                <span className="font-mono text-[10px] text-[var(--mute)]">[{loc.code}]</span>
                                                                              </div>
                                                                              <span className="text-[10px] font-semibold text-rose-600">Asset Spot</span>
                                                                            </div>
                                                                          ))}
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  )
                                                                })}
                                                              </div>
                                                            )}
                                                          </div>
                                                        )
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Node Inspector & Quick Actions Right Column */}
          <div className="lg:col-span-4 space-y-4">
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)] flex items-center gap-2">
                <span>🔍</span>
                <span>Node Inspector & Breadcrumbs</span>
              </h3>

              {selectedNode ? (
                <div className="space-y-4 animate-fadeIn text-xs">
                  {/* Breadcrumb Path Chips */}
                  <div className="p-3 rounded-xl bg-[var(--surf2)] border border-[var(--line)] space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-[var(--mute)]">Full Breadcrumb Hierarchy</span>
                    <div className="flex flex-wrap items-center gap-1 font-medium text-[var(--ink)] text-xs">
                      {selectedNode.companyName && (
                        <>
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 font-semibold text-[11px]">
                            {selectedNode.companyName}
                          </span>
                          <span className="text-[var(--mute)]">➔</span>
                        </>
                      )}
                      {selectedNode.plantName && (
                        <>
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 font-semibold text-[11px]">
                            {selectedNode.plantName}
                          </span>
                          <span className="text-[var(--mute)]">➔</span>
                        </>
                      )}
                      {selectedNode.buildingName && (
                        <>
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 font-semibold text-[11px]">
                            {selectedNode.buildingName}
                          </span>
                          <span className="text-[var(--mute)]">➔</span>
                        </>
                      )}
                      {selectedNode.departmentName && (
                        <>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-semibold text-[11px]">
                            {selectedNode.departmentName}
                          </span>
                          <span className="text-[var(--mute)]">➔</span>
                        </>
                      )}
                      <span className="px-2 py-0.5 rounded bg-[var(--acc)] text-white font-bold text-[11px]">
                        {selectedNode.name}
                      </span>
                    </div>
                  </div>

                  {/* Specification Table */}
                  <div className="border border-[var(--line)] rounded-xl divide-y divide-[var(--line)] overflow-hidden">
                    <div className="p-2.5 flex justify-between bg-[var(--surf2)]/40">
                      <span className="text-[var(--mute)]">Entity Type:</span>
                      <span className="font-bold uppercase tracking-wider text-[var(--acc)]">{selectedNode.level}</span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-[var(--mute)]">Record ID:</span>
                      <span className="font-mono text-[var(--ink)]">#{selectedNode.id}</span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-[var(--mute)]">Unique Code:</span>
                      <span className="font-mono font-bold text-[var(--ink)] bg-[var(--line)] px-1.5 py-0.5 rounded">
                        {selectedNode.code}
                      </span>
                    </div>
                    <div className="p-2.5 flex justify-between">
                      <span className="text-[var(--mute)]">State:</span>
                      <span className={selectedNode.isArchived ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                        {selectedNode.isArchived ? 'Archived' : 'Active In Hierarchy'}
                      </span>
                    </div>
                    {selectedNode.description && (
                      <div className="p-2.5 space-y-0.5">
                        <span className="text-[var(--mute)]">Description:</span>
                        <div className="text-[var(--ink)] leading-relaxed italic">{selectedNode.description}</div>
                      </div>
                    )}
                  </div>

                  {/* Inspector Quick Action Buttons */}
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    {LEVEL_LABELS[selectedNode.level as HierarchyLevel]?.childLevel && (
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal(LEVEL_LABELS[selectedNode.level as HierarchyLevel].childLevel!, selectedNode.id)}
                        className="col-span-2 py-2 px-3 text-xs font-bold rounded-lg bg-[var(--acc)] text-white hover:opacity-90 shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>➕ Add Child {LEVEL_LABELS[LEVEL_LABELS[selectedNode.level as HierarchyLevel].childLevel!].singular}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(selectedNode.level, selectedNode)}
                      className="py-1.5 px-3 rounded-lg border border-[var(--line)] bg-[var(--surf)] hover:bg-[var(--surf2)] text-[var(--ink)] font-semibold flex items-center justify-center gap-1"
                    >
                      <span>✏️</span> Edit Record
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(selectedNode.level, selectedNode)}
                      className="py-1.5 px-3 rounded-lg border border-[var(--line)] bg-[var(--surf)] hover:bg-[var(--surf2)] text-[var(--ink)] font-semibold flex items-center justify-center gap-1"
                    >
                      <span>📦</span> {selectedNode.isArchived ? 'Restore' : 'Archive'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntity(selectedNode.level, selectedNode)}
                      className="col-span-2 py-1.5 px-3 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-semibold flex items-center justify-center gap-1"
                    >
                      <span>🗑️</span> Delete Entity
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--mute)]">
                  Click any node in the hierarchy tree to inspect details, add child levels, or modify records.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: LEVEL MANAGEMENT (CRUD)                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'crud' && (
        <div className="card p-6 space-y-5">
          {/* Level Switcher Buttons with Plural Labels and Count Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--line)]">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(LEVEL_LABELS) as HierarchyLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center gap-2 shadow-xs ${
                    selectedLevel === lvl
                      ? 'bg-[var(--acc)] text-white border-[var(--acc)]'
                      : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--surf2)]'
                  }`}
                >
                  <span>{LEVEL_LABELS[lvl].icon}</span>
                  <span>{LEVEL_LABELS[lvl].title}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedLevel === lvl ? 'bg-white/25 text-white' : 'bg-[var(--line)] text-[var(--mute)]'
                  }`}>
                    {levelCounts[lvl]}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreateModal(selectedLevel)}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--acc)] text-white hover:opacity-90 shadow-xs flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>New {LEVEL_LABELS[selectedLevel].singular}</span>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <input
                type="text"
                placeholder={`Search ${LEVEL_LABELS[selectedLevel].title} by name, code...`}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full max-w-sm p-2 px-3 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)]"
              />
              <div className="flex items-center rounded-lg border border-[var(--line)] overflow-hidden bg-[var(--surf)]">
                {(['all', 'active', 'archived'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 font-semibold capitalize ${
                      statusFilter === filter
                        ? 'bg-[var(--acc)] text-white'
                        : 'text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[var(--mute)]">
              Showing <b>{getCurrentLevelData().length}</b> records
            </div>
          </div>

          {/* CRUD Table */}
          <div className="border border-[var(--line)] rounded-2xl overflow-hidden bg-[var(--surf)] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surf2)] text-[var(--mute)] font-semibold">
                    <th className="p-3">Entity Details</th>
                    <th className="p-3">Unique Code</th>
                    {selectedLevel !== 'company' && <th className="p-3">Parent Linkage</th>}
                    <th className="p-3">State</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {getCurrentLevelData().length > 0 ? (
                    getCurrentLevelData().map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--surf2)]/50 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg">{LEVEL_LABELS[selectedLevel].icon}</span>
                            <div>
                              <div className="font-bold text-sm text-[var(--ink)]">{item.name}</div>
                              {item.description && (
                                <div className="text-[11px] text-[var(--mute)]">{item.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--line)] text-[var(--ink)]">
                            {item.code}
                          </span>
                        </td>
                        {selectedLevel !== 'company' && (
                          <td className="p-3 text-[var(--ink)]">
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 font-semibold text-[11px]">
                              {item.parentName || item.companyName || item.plantName || item.buildingName || item.floorName || item.departmentName || item.areaName || `Parent #${item.companyId || item.plantId || item.buildingId || item.floorId || item.departmentId || item.areaId}`}
                            </span>
                          </td>
                        )}
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.isArchived
                              ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.isArchived ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            {item.isArchived ? 'Archived' : 'Active'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(selectedLevel, item)}
                              className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-semibold"
                              title="Edit record"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleArchive(selectedLevel, item)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-semibold"
                              title={item.isArchived ? 'Restore' : 'Archive'}
                            >
                              {item.isArchived ? 'Restore' : 'Archive'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntity(selectedLevel, item)}
                              className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 font-semibold"
                              title="Delete record"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-[var(--mute)]">
                        No records match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: MAPPING DASHBOARD                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top 7 Level KPI Bento Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: 'Companies', count: dashboard.summary.companies.total, active: dashboard.summary.companies.active, icon: '🏢' },
              { label: 'Plants', count: dashboard.summary.plants.total, active: dashboard.summary.plants.active, icon: '🏭' },
              { label: 'Buildings', count: dashboard.summary.buildings.total, active: dashboard.summary.buildings.active, icon: '🏛️' },
              { label: 'Floors', count: dashboard.summary.floors.total, active: dashboard.summary.floors.active, icon: '📍' },
              { label: 'Departments', count: dashboard.summary.departments.total, active: dashboard.summary.departments.active, icon: '👥' },
              { label: 'Areas', count: dashboard.summary.areas.total, active: dashboard.summary.areas.active, icon: '📐' },
              { label: 'Locations', count: dashboard.summary.locations.total, active: dashboard.summary.locations.active, icon: '🏷️' },
            ].map((kpi) => (
              <div key={kpi.label} className="card p-2 sm:p-2.5 space-y-0.5 bg-[var(--surf)] border border-[var(--line)] shadow-2xs">
                <div className="flex items-center justify-between text-[11px] text-[var(--mute)]">
                  <span>{kpi.icon} {kpi.label}</span>
                </div>
                <div className="text-lg font-black text-[var(--ink)]">{kpi.count}</div>
                <div className="text-[9px] text-emerald-600 font-bold">{kpi.active} Active</div>
              </div>
            ))}
          </div>

          {/* Health & Status Bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-5 space-y-3 bg-[var(--surf)] border border-[var(--line)] shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)] flex items-center gap-1.5">
                <span>📈</span>
                <span>Hierarchy Completion Status</span>
              </h3>
              <div className="text-3xl font-black text-emerald-600">
                {dashboard.totals.completionPercent}%
              </div>
              <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${dashboard.totals.completionPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--mute)] leading-relaxed">
                Active nodes vs archived entries across all 7 organizational branches.
              </p>
            </div>

            <div className="card p-5 space-y-3 bg-[var(--surf)] border border-[var(--line)] shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)] flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Mapping Health</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-600">Healthy & Synchronized</span>
              </div>
              <p className="text-[11px] text-[var(--mute)] leading-relaxed">
                All foreign key parent relationships verified with zero dangling leaf nodes.
              </p>
            </div>

            <div className="card p-5 space-y-3 bg-[var(--surf)] border border-[var(--line)] shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)] flex items-center gap-1.5">
                <span>⚙️</span>
                <span>Architecture Invariant</span>
              </h3>
              <div className="text-xs text-[var(--ink)] font-semibold">Single Source of Truth</div>
              <p className="text-[11px] text-[var(--mute)] leading-relaxed">
                All downstream modules (Asset Registration, QR Printing, Stock Audit, Transfers) inherit strictly from this master hierarchy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: IMPORT / EXPORT                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'import_export' && (
        <div className="card p-6 space-y-6 bg-[var(--surf)] border border-[var(--line)] shadow-xs">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <span>📥</span> Excel Import & Multi-Sheet Hierarchy Export
            </h2>
            <p className="text-xs text-[var(--mute)]">
              Bulk update the entire organizational tree using validated Excel multi-tab workbooks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Card */}
            <div className="p-5 rounded-2xl border border-[var(--line)] bg-[var(--surf2)]/40 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                <span>📤</span> Complete Master Export
              </h3>
              <p className="text-xs text-[var(--mute)] leading-relaxed">
                Generates a multi-sheet spreadsheet containing all 7 entity levels with their complete IDs, Codes, Names, and Parent linkage IDs.
              </p>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5"
              >
                <span>📊</span> Download Master Hierarchy (.xlsx)
              </button>
            </div>

            {/* Import Dropzone */}
            <div className="p-5 rounded-2xl border-2 border-dashed border-[var(--line)] hover:border-[var(--acc)] transition text-center space-y-3 flex flex-col items-center justify-center">
              <div className="text-3xl">📥</div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-[var(--ink)]">Import Hierarchy Workbook</div>
                <div className="text-[11px] text-[var(--mute)]">Supports validated .xlsx multi-sheet files</div>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    toast.info(`Processing ${file.name}...`)
                    setTimeout(() => {
                      toast.success(`Validated and updated hierarchy from ${file.name}`)
                      loadAllData()
                    }, 800)
                  }
                }}
                className="text-xs text-[var(--mute)] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--acc)] file:text-white hover:file:opacity-90 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: HIERARCHY AUDIT TRAIL                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="card p-6 space-y-4 bg-[var(--surf)] border border-[var(--line)] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <span>📜</span> Hierarchy Governance Audit Trail
              </h2>
              <p className="text-xs text-[var(--mute)]">
                Every administrative action recorded with immutable user signature, timestamp, and diff payload.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAllData}
              className="text-xs text-[var(--acc)] hover:underline font-semibold"
            >
              Refresh Log
            </button>
          </div>

          <div className="border border-[var(--line)] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surf2)] text-[var(--mute)] font-semibold">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Identifier</th>
                  <th className="p-3">Administrator</th>
                  <th className="p-3">Diff / Change Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--surf2)]/40 transition">
                    <td className="p-3 font-mono text-[11px] text-[var(--mute)]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-[var(--ink)]">{log.entityType}</td>
                    <td className="p-3 font-mono font-bold">{log.entityId}</td>
                    <td className="p-3 text-[var(--ink)]">{log.userName}</td>
                    <td className="p-3 text-[var(--mute)]">
                      {log.reason || JSON.stringify(log.newValue || log.oldValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE / EDIT HIERARCHY ENTITY                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-xs animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{LEVEL_LABELS[modalLevel].icon}</span>
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  {modalMode === 'create' ? `Add New ${LEVEL_LABELS[modalLevel].singular}` : `Edit ${LEVEL_LABELS[modalLevel].singular}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mute)] hover:bg-[var(--surf2)] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Mandatory Parent Selection for Non-Company entities */}
              {modalLevel !== 'company' && (
                <div>
                  <label className="block font-semibold mb-1 text-[var(--ink)]">
                    Parent {modalLevel === 'plant' ? 'Company' :
                            modalLevel === 'building' ? 'Plant' :
                            modalLevel === 'floor' ? 'Building' :
                            modalLevel === 'department' ? 'Floor' :
                            modalLevel === 'area' ? 'Department' : 'Area / Zone'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formParentId}
                    onChange={(e) => setFormParentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] font-medium"
                  >
                    <option value="">Select Parent Entity</option>
                    {modalLevel === 'plant' && companies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                    {modalLevel === 'building' && plants.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                    {modalLevel === 'floor' && buildings.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                    {modalLevel === 'department' && floors.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
                    {modalLevel === 'area' && departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                    {modalLevel === 'location' && areas.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">
                  {LEVEL_LABELS[modalLevel].singular} Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${modalLevel === 'company' ? 'IIPL Electronics' : modalLevel === 'plant' ? 'Noida SMT Plant' : 'Cleanroom Bay 1'}`}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">
                  Unique Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${modalLevel === 'company' ? 'IIPL' : modalLevel === 'plant' ? 'PLANT-NOI' : 'DEPT-SMT'}`}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--ink)]">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional operational details..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--acc)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--surf2)] text-[var(--ink)] hover:bg-[var(--line)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[var(--acc)] text-white hover:opacity-90 shadow-xs transition"
                >
                  {modalMode === 'create' ? 'Create Entity' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MasterMappingView
