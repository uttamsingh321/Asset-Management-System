import * as React from 'react'
import * as XLSX from 'xlsx'
import type { UserProfile } from '@/lib/deviceTracker'
import {
  isAssetTaskCompleted,
  type Asset,
  MAJOR_ASSET_CATEGORIES,
  MAJOR_ASSET_CATEGORIES_CONFIG,
  resolveMajorAssetCategory,
} from '@/types/asset'
import { toast } from 'sonner'
import { pushAssetsToBackend, fetchBackendAssets } from '@/lib/assetStorage'
import { isPadgetCompany } from '@/assets/companyLogos'
import { parseExcelDate } from '@/lib/excelImporter'
import { isRawNumericDepartmentCode, resolveDepartmentName } from '@/lib/departmentResolver'

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
  onImportCodes: (codes: (string | Partial<Asset>)[]) => void
  onAssign: (assetId: string, department: string) => void
  onSelectAsset: (asset: Asset) => void
  onClearAllTasks?: () => void
  onRefreshFromBackend?: () => Promise<void>
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

export async function readCodesOrMasterAssetsFromFile(file: File): Promise<(string | Partial<Asset>)[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dense: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  if (rows.length === 0) return []

  // Check header row in first 10 rows using multi-column score matching to avoid false positives on title rows
  let headerRowIdx = -1
  let colMap: Record<string, number> = {}
  let bestScore = 0

  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const rawRow = rows[r] || []
    const tempMap: Record<string, number> = {}
    let score = 0

    rawRow.forEach((val, idx) => {
      const cleanName = String(val ?? '').trim().toLowerCase()
      if (!cleanName) return
      const norm = cleanName.replace(/[\s_\-./\\]+/g, '')

      if (
        norm.includes('companycode') ||
        norm === 'company' ||
        norm === 'cocode' ||
        norm === 'compcode' ||
        norm === 'companyid' ||
        norm === 'coid' ||
        cleanName.includes('公司代码') ||
        cleanName.includes('公司')
      ) {
        tempMap.companyCode = idx
        score += 2
      } else if (
        norm.includes('assetclass') ||
        norm === 'class' ||
        norm === 'assetcategory' ||
        norm === 'category' ||
        cleanName.includes('资产类别') ||
        cleanName.includes('类别') ||
        cleanName.includes('资产分类')
      ) {
        tempMap.assetClass = idx
        score += 2
      } else if (
        norm.includes('serialnumber') ||
        norm === 'serialno' ||
        norm === 'serial' ||
        norm === 'sn' ||
        norm === 'srno' ||
        norm === 'machineno' ||
        cleanName.includes('出厂编号') ||
        cleanName.includes('出厂号') ||
        cleanName.includes('序列号') ||
        cleanName.includes('机身号')
      ) {
        tempMap.serialNumber = idx
        score += 2
      } else if (
        norm === 'asset' ||
        norm === 'assetcode' ||
        norm === 'assetno' ||
        norm === 'assetnumber' ||
        norm === 'assettag' ||
        norm === 'tag' ||
        norm === 'barcode' ||
        norm === 'qrcode' ||
        norm === 'cardno' ||
        cleanName.includes('资产编号') ||
        cleanName.includes('卡片编号') ||
        (cleanName.includes('编号') && !cleanName.includes('出厂') && !cleanName.includes('序列')) ||
        norm === 'equipmentcode' ||
        (norm.includes('code') && !norm.includes('company') && !norm.includes('cost') && !norm.includes('class') && !norm.includes('postal'))
      ) {
        tempMap.assetCode = idx
        score += 3
      } else if (
        norm.includes('assetdescription') ||
        norm.includes('maintext') ||
        (norm.includes('description') && !norm.includes('user')) ||
        norm === 'assetname' ||
        norm === 'name' ||
        norm === 'itemname' ||
        cleanName.includes('资产名称') ||
        cleanName.includes('设备名称') ||
        cleanName.includes('名称') ||
        cleanName.includes('描述') ||
        cleanName.includes('说明') ||
        cleanName.includes('品名')
      ) {
        tempMap.description = idx
        score += 2
      } else if (
        norm.includes('devicemodel') ||
        norm.includes('equipmentmodel') ||
        norm === 'model' ||
        norm === 'modelno' ||
        norm === 'spec' ||
        norm.includes('specification') ||
        norm === 'specs' ||
        cleanName.includes('规格型号') ||
        cleanName.includes('型号') ||
        cleanName.includes('规格')
      ) {
        tempMap.model = idx
        score += 2
      } else if (norm.includes('user') && norm.includes('description')) {
        tempMap.userDescription = idx
      } else if (
        norm.includes('capitalizationdate') ||
        norm.includes('capitalisationdate') ||
        norm.includes('purchasedate') ||
        norm === 'capdate' ||
        norm === 'date' ||
        cleanName.includes('资本化日期') ||
        cleanName.includes('购置日期') ||
        cleanName.includes('入账日期') ||
        cleanName.includes('采购日期')
      ) {
        tempMap.capDate = idx
        score += 2
      } else if (
        norm.includes('costcenter') ||
        norm.includes('costcentre') ||
        norm === 'costctr' ||
        norm === 'cc' ||
        cleanName.includes('成本中心') ||
        cleanName.includes('费用中心')
      ) {
        tempMap.costCenter = idx
        score += 2
      } else if (
        norm.includes('department') ||
        norm === 'dept' ||
        norm.includes('usingdept') ||
        norm.includes('belongingdept') ||
        norm.includes('currentdepartment') ||
        cleanName.includes('使用部门') ||
        cleanName.includes('部门') ||
        cleanName.includes('所属部门')
      ) {
        tempMap.department = idx
        score += 2
      } else if (
        norm.includes('location') ||
        norm.includes('plantlocation') ||
        norm === 'plant' ||
        norm === 'factory' ||
        norm === 'site' ||
        cleanName.includes('存放地点') ||
        cleanName.includes('位置') ||
        cleanName.includes('工厂')
      ) {
        tempMap.location = idx
        score += 1
      } else if (
        norm === 'building' ||
        norm === 'bldg' ||
        norm === 'block' ||
        cleanName.includes('厂房') ||
        cleanName.includes('建筑物') ||
        cleanName.includes('栋')
      ) {
        tempMap.building = idx
        score += 1
      } else if (
        norm === 'floor' ||
        norm === 'flr' ||
        norm === 'level' ||
        cleanName.includes('楼层') ||
        cleanName.includes('层')
      ) {
        tempMap.floor = idx
        score += 1
      } else if (
        norm === 'custodianid' ||
        norm === 'inchargeid' ||
        norm === 'empid' ||
        norm === 'employeeid' ||
        norm === 'staffid' ||
        cleanName.includes('工号') ||
        cleanName.includes('员工号')
      ) {
        tempMap.custodianId = idx
        score += 1
      } else if (
        norm === 'custodianname' ||
        norm === 'inchargename' ||
        norm === 'employeename' ||
        norm === 'staffname' ||
        cleanName.includes('责任人姓名') ||
        cleanName.includes('员工姓名')
      ) {
        tempMap.custodianName = idx
        score += 1
      } else if (
        norm === 'custodian' ||
        norm.includes('incharge') ||
        norm.includes('personincharge') ||
        norm.includes('whoincharge') ||
        norm === 'owner' ||
        cleanName.includes('责任人') ||
        cleanName.includes('保管人') ||
        cleanName.includes('使用人') ||
        cleanName.includes('负责人')
      ) {
        tempMap.custodian = idx
        score += 2
      } else if (norm === 'quantity' || norm === 'qty') {
        tempMap.quantity = idx
      } else if (norm.includes('userlife') || norm.includes('usefullife')) {
        tempMap.usefulLife = idx
      } else if (
        norm.includes('condition') ||
        norm.includes('assetcondition') ||
        norm === 'status' ||
        cleanName.includes('设备状态') ||
        cleanName.includes('状态')
      ) {
        tempMap.condition = idx
      } else if (norm.includes('remark') || norm.includes('note') || cleanName.includes('备注')) {
        tempMap.remarks = idx
      }
    })

    if (score > bestScore && score >= 2) {
      bestScore = score
      headerRowIdx = r
      colMap = tempMap
    }
  }

  // Ensure assetCode is not accidentally pointing to Company Code
  let codeCol = colMap.assetCode
  if (codeCol === undefined) {
    if (colMap.companyCode === 0) {
      // Typically in SAP master tables: Col 0 = Company Code, Col 1 = Asset Class, Col 2 = Asset Code
      codeCol = 2
    } else {
      codeCol = 0
    }
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0
  const results: (string | Partial<Asset>)[] = []

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] || []
    let rawCode = String(row[codeCol] ?? '').trim().replace(/^["']|["']$/g, '')

    // Guard against Company Code (5020 / 9500 / 5030) being mistakenly taken as assetCode
    if ((rawCode === '5020' || rawCode === '9500' || rawCode === '5030') && row.length > 2) {
      const realCode = row.find((val, idx) => {
        if (idx === colMap.companyCode) return false
        const s = String(val ?? '').trim()
        return s.length >= 6 && /^\d+$/.test(s)
      })
      if (realCode) {
        rawCode = String(realCode).trim()
      }
    }

    if (!rawCode || CODE_HEADER_ALIASES.has(normalized(rawCode))) continue

    // If multi-column Excel (has description, companyCode, costCenter, department, or location)
    if (
      colMap.description !== undefined ||
      colMap.companyCode !== undefined ||
      colMap.location !== undefined ||
      colMap.costCenter !== undefined ||
      colMap.department !== undefined ||
      colMap.assetClass !== undefined ||
      colMap.model !== undefined ||
      colMap.serialNumber !== undefined
    ) {
      const compCode = colMap.companyCode !== undefined ? String(row[colMap.companyCode] ?? '').trim() : ''
      const assetClass = colMap.assetClass !== undefined ? String(row[colMap.assetClass] ?? '').trim() : ''
      const desc = colMap.description !== undefined ? String(row[colMap.description] ?? '').trim() : ''
      const rawCapDate = colMap.capDate !== undefined ? row[colMap.capDate] : undefined
      const costCenter = colMap.costCenter !== undefined ? String(row[colMap.costCenter] ?? '').trim() : ''
      const explicitDept = colMap.department !== undefined ? String(row[colMap.department] ?? '').trim() : ''
      const loc = colMap.location !== undefined ? String(row[colMap.location] ?? '').trim() : ''
      const explicitBldg = colMap.building !== undefined ? String(row[colMap.building] ?? '').trim() : ''
      const explicitFloor = colMap.floor !== undefined ? String(row[colMap.floor] ?? '').trim() : ''
      const model = colMap.model !== undefined ? String(row[colMap.model] ?? '').trim() : ''
      const serialNumber = colMap.serialNumber !== undefined ? String(row[colMap.serialNumber] ?? '').trim() : ''
      const explicitCustodian = colMap.custodian !== undefined ? String(row[colMap.custodian] ?? '').trim() : ''
      const explicitCustodianId = colMap.custodianId !== undefined ? String(row[colMap.custodianId] ?? '').trim() : ''
      const explicitCustodianName = colMap.custodianName !== undefined ? String(row[colMap.custodianName] ?? '').trim() : ''
      const condition = colMap.condition !== undefined ? String(row[colMap.condition] ?? '').trim() : ''
      const remarks = colMap.remarks !== undefined ? String(row[colMap.remarks] ?? '').trim() : ''

      // Building resolution: priority to explicit building column, then location hints
      let resolvedBuilding = explicitBldg ? explicitBldg.toUpperCase() : 'C39'
      const locUpper = `${explicitBldg} ${loc}`.toUpperCase()
      if (locUpper.includes('D197') || locUpper.includes('D-197')) resolvedBuilding = 'D197'
      else if (locUpper.includes('D198') || locUpper.includes('D-198')) resolvedBuilding = 'D198'
      else if (locUpper.includes('D199') || locUpper.includes('D-199')) resolvedBuilding = 'D199'
      else if (locUpper.includes('C39') || locUpper.includes('C-39')) resolvedBuilding = 'C39'

      const isPadget = isPadgetCompany({
        company: compCode,
        companyCode: compCode,
        building: resolvedBuilding,
        location: loc,
        costCenter: costCenter,
      })

      const resolvedCompany = isPadget ? 'Padget' : (compCode === '5020' || compCode.toLowerCase().includes('ismartu') || compCode.toLowerCase().includes('iipl') ? 'ismartu' : (compCode || 'ismartu'))
      const resolvedCompanyCode = isPadget
        ? (compCode === '9500' || compCode === '5030' ? compCode : '9500')
        : (compCode === '5020' ? '5020' : (compCode || '5020'))
      if (isPadget && resolvedBuilding === 'C39') {
        resolvedBuilding = 'D197'
      }

      // Custodian resolution: EXACT DATA ONLY (never fake EMP hash or active super user)
      let inChargeId = explicitCustodianId
      let inChargeName = explicitCustodianName
      if (!inChargeId && !inChargeName && explicitCustodian) {
        const idMatch1 = explicitCustodian.match(/^([A-Z0-9_-]{3,15})\s*[-:·,]\s*(.+)$/i)
        const idMatch2 = explicitCustodian.match(/^(.+?)\s*\(([A-Z0-9_-]{3,15})\)$/i)
        if (idMatch1) {
          inChargeId = idMatch1[1].trim()
          inChargeName = idMatch1[2].trim()
        } else if (idMatch2) {
          inChargeName = idMatch2[1].trim()
          inChargeId = idMatch2[2].trim()
        } else if (/^[A-Z0-9_-]{3,12}$/i.test(explicitCustodian)) {
          inChargeId = explicitCustodian
          inChargeName = ''
        } else {
          inChargeName = explicitCustodian
          inChargeId = ''
        }
      }

      const whoInCharge = inChargeId && inChargeName
        ? `${inChargeId} · ${inChargeName}`
        : inChargeName || inChargeId || ''

      // Department resolution: EXACT DATA ONLY - never use raw numeric cost center codes as department names
      let resolvedDept = explicitDept
      if (!resolvedDept && costCenter && !isRawNumericDepartmentCode(costCenter)) {
        resolvedDept = costCenter
      }
      if (!resolvedDept || isRawNumericDepartmentCode(resolvedDept)) {
        resolvedDept = resolveDepartmentName(resolvedDept, {
          building: resolvedBuilding,
          whoInCharge: whoInCharge,
          inChargeId: inChargeId,
          inChargeName: inChargeName,
          company: resolvedCompany,
        })
      }

      // Date resolution via parseExcelDate (handles dates, numeric serials, slash and dash formats)
      const formattedDate = parseExcelDate(rawCapDate) || new Date().toISOString().slice(0, 10)

      // Floor resolution
      let resolvedFloor = explicitFloor
      if (!resolvedFloor) {
        const lowerLoc = loc.toLowerCase()
        if (lowerLoc.includes('ground') || lowerLoc.includes('gf')) resolvedFloor = 'Ground Floor'
        else if (lowerLoc.includes('1st') || lowerLoc.includes('1f')) resolvedFloor = '1st Floor'
        else if (lowerLoc.includes('2nd') || lowerLoc.includes('2f')) resolvedFloor = '2nd Floor'
        else if (lowerLoc.includes('3rd') || lowerLoc.includes('3f')) resolvedFloor = '3rd Floor'
        else resolvedFloor = '1st Floor'
      }

      // Guarantee each imported row has a 100% globally unique ID
      const rowUniqueId = `imported-${rawCode}-${r + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

      results.push({
        id: rowUniqueId,
        assetCode: rawCode,
        assetTag: rawCode,
        name: desc || rawCode,
        currentDescription: desc || rawCode,
        company: resolvedCompany,
        companyCode: resolvedCompanyCode,
        category: assetClass || 'Equipment',
        currentCategory: assetClass || 'Equipment',
        assetClass,
        costCenter,
        department: resolvedDept,
        currentDepartment: resolvedDept,
        location: loc || (isPadget ? `Padget · ${resolvedBuilding} · ${resolvedFloor}` : `ismartu · ${resolvedBuilding} · ${resolvedFloor}`),
        plant: loc || (isPadget ? 'Padget Electronics Noida' : 'Noida Central Plant'),
        building: resolvedBuilding,
        floor: resolvedFloor,
        model: model || undefined,
        serialNumber: serialNumber || '',
        inChargeId: inChargeId || '',
        inChargeName: inChargeName || '',
        whoInCharge,
        purchaseDate: formattedDate,
        capitalizationDate: formattedDate,
        date: formattedDate,
        status: 'Pending Verification',
        assetCondition: condition ? (condition as any) : 'Operational',
        remarks: remarks || '',
        isExcelImported: true,
      })
    } else {
      results.push(rawCode)
    }
  }

  return results
}

export const AssetCodeWorkflow: React.FC<AssetCodeWorkflowProps> = ({
  assets,
  user,
  onImportCodes,
  onAssign,
  onSelectAsset,
  onClearAllTasks,
  onRefreshFromBackend,
}) => {
  const isAdmin =
    user.role === 'Administrator' ||
    user.role === 'Admin' ||
    user.role === 'Super User' ||
    user.userId?.toUpperCase() === 'USR-ADMIN'
  const isFinance = user.role === 'Finance' || user.department === 'Finance'
  const canUpload = isAdmin || isFinance
  const userDepartment = user.department || 'IT'

  const [activeTab, setActiveTab] = React.useState<'tasks' | 'import'>('tasks')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'completed'>('all')
  const [departmentFilter, setDepartmentFilter] = React.useState<string>(
    isAdmin || isFinance ? 'All' : (userDepartment || 'All')
  )
  const [categoryFilter, setCategoryFilter] = React.useState<string>('All')

  // Scoped to user's department for employees, or 'All' for admin/finance
  React.useEffect(() => {
    setDepartmentFilter(isAdmin || isFinance ? 'All' : (userDepartment || 'All'))
  }, [user.userId, user.department, user.role, isAdmin, isFinance, userDepartment])

  const [isSyncingCloud, setIsSyncingCloud] = React.useState(false)
  const [syncProgress, setSyncProgress] = React.useState('')
  const [isRefreshingServer, setIsRefreshingServer] = React.useState(false)

  const handleManualCloudSync = async () => {
    if (assets.length === 0) {
      toast.info('No asset codes available to sync.')
      return
    }
    setIsSyncingCloud(true)
    setSyncProgress(`Starting sync (${assets.length.toLocaleString()} codes)...`)
    try {
      const ok = await pushAssetsToBackend(assets, user, (sent, total) => {
        setSyncProgress(`${sent.toLocaleString()} / ${total.toLocaleString()}`)
      })
      if (ok) {
        toast.success(`Successfully synced ${assets.length.toLocaleString()} codes to factory server! All terminals can now view them.`)
      } else {
        toast.error('Failed to sync codes to server. Please check backend status.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error syncing to factory server')
    } finally {
      setIsSyncingCloud(false)
      setSyncProgress('')
    }
  }

  const handleManualRefreshServer = async () => {
    setIsRefreshingServer(true)
    try {
      if (onRefreshFromBackend) {
        await onRefreshFromBackend()
      } else {
        const backendAssets = await fetchBackendAssets()
        if (backendAssets && backendAssets.length > 0) {
          onImportCodes(backendAssets)
          toast.success(`Fetched ${backendAssets.length.toLocaleString()} codes from factory server!`)
        } else {
          toast.info('Factory server currently has no codes.')
        }
      }
    } catch {
      toast.error('Could not connect to factory server.')
    } finally {
      setIsRefreshingServer(false)
    }
  }

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
  }, [statusFilter, departmentFilter, categoryFilter, query])

  // Categorize Assets
  const unassignedAssets = assets.filter((asset) => asset.status === 'Imported')
  const pendingAssets = assets.filter((asset) => !isAssetTaskCompleted(asset))
  const completedAssets = assets.filter((asset) => isAssetTaskCompleted(asset))

  const departmentAssets = assets.filter((asset) => {
    if (isAssetTaskCompleted(asset)) return false
    const rawD = (asset.currentDepartment || asset.department || '').trim()
    const resolvedD = isRawNumericDepartmentCode(rawD) || !rawD ? resolveDepartmentName(rawD, asset) : rawD
    const d = (resolvedD || '').toLowerCase().trim()
    const ud = userDepartment.toLowerCase().trim()

    const isProductionDept =
      d.includes('production') || d.includes('smt') || d.includes('assembly') || d.includes('operations')
    const isUserProduction =
      ud.includes('production') || ud.includes('smt') || ud.includes('assembly') || ud.includes('operations')

    if (d === ud || d.includes(ud) || ud.includes(d) || (isProductionDept && isUserProduction)) {
      return true
    }
    // Also include open pending tasks with raw numeric cost centers or unassigned
    if (isRawNumericDepartmentCode(rawD) || !rawD || rawD === 'Unassigned') {
      return true
    }
    return false
  })

  // Filtered task assets
  const filteredTaskAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      // Status filter
      if (statusFilter === 'pending') {
        if (isAssetTaskCompleted(asset)) return false
      } else if (statusFilter === 'completed') {
        if (!isAssetTaskCompleted(asset)) return false
      }

      // Department scoping: unassigned codes are open to all; if department filter is active, filter by it
      if (departmentFilter !== 'All') {
        const rawD = (asset.currentDepartment || asset.department || '').trim()
        const resolvedD = isRawNumericDepartmentCode(rawD) || !rawD
          ? resolveDepartmentName(rawD, asset)
          : rawD

        const d = (resolvedD || '').toLowerCase().trim()
        const ed = departmentFilter.toLowerCase().trim()

        const isProductionDept =
          d.includes('production') || d.includes('smt') || d.includes('assembly') || d.includes('operations')
        const isFilterProduction =
          ed.includes('production') || ed.includes('smt') || ed.includes('assembly') || ed.includes('operations')

        const matches =
          d === ed ||
          d.includes(ed) ||
          ed.includes(d) ||
          (isProductionDept && isFilterProduction)

        // If the asset code has an unassigned or raw numeric cost center, it is an open verification task
        const isOpenPendingTask = !isAssetTaskCompleted(asset) && (isRawNumericDepartmentCode(rawD) || !rawD || rawD === 'Unassigned')

        if (!matches && !isOpenPendingTask) return false
      }

      // Category filter for the 4 Major Categories
      if (categoryFilter !== 'All') {
        const cat = resolveMajorAssetCategory(asset.currentCategory || asset.category)
        if (cat !== categoryFilter) return false
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
          asset.department,
          asset.currentCategory,
          asset.category,
          asset.inChargeName,
          asset.inChargeId,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }

      return true
    })
  }, [assets, statusFilter, departmentFilter, categoryFilter, query, isAdmin, userDepartment])

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
      const items: (string | Partial<Asset>)[] = file
        ? await readCodesOrMasterAssetsFromFile(file)
        : parsePastedAssetCodes(pastedCodes)

      if (items.length === 0) {
        toast.info('No valid asset codes or master records found to import.')
        setIsImporting(false)
        return
      }

      if (items.length > 2000) {
        setImportProgressMessage(`Checking ${items.length.toLocaleString()} records for duplicates...`)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      const getCode = (item: string | Partial<Asset>) => (typeof item === 'string' ? item : item.assetCode || '')
      const knownCodes = new Set(assets.map((asset) => asset.assetCode.toLowerCase()))
      const newItems = items.filter((item) => {
        const c = getCode(item)
        return c && !knownCodes.has(c.toLowerCase())
      })

      if (newItems.length === 0) {
        toast.info(`All ${items.length.toLocaleString()} codes/records already exist in the system.`)
        setIsImporting(false)
        return
      }

      if (newItems.length > 2000) {
        setImportProgressMessage(`Adding ${newItems.length.toLocaleString()} records to task queue...`)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      onImportCodes(newItems)
      setPastedCodes('')
      toast.success(`${newItems.length.toLocaleString()} asset${newItems.length === 1 ? '' : 's'} imported and added to task queue`)
      setActiveTab('tasks')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import asset records')
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

        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill w text-xs">
            {userDepartment ? `${userDepartment} Dept` : 'All Depts'}
          </span>
          <button
            type="button"
            disabled={isRefreshingServer}
            onClick={handleManualRefreshServer}
            className="btn text-xs flex items-center gap-1.5 text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)] cursor-pointer"
            title="Fetch latest asset codes from central factory server"
          >
            <span className={isRefreshingServer ? 'animate-spin inline-block' : ''}>🔄</span>
            <span>{isRefreshingServer ? 'Fetching...' : 'Refresh Server'}</span>
          </button>
          {assets.length > 0 && (
            <button
              type="button"
              disabled={isSyncingCloud}
              onClick={handleManualCloudSync}
              className="btn text-xs flex items-center gap-1.5 bg-blue-500/10 text-blue-600 border border-blue-500/30 hover:bg-blue-500/20 cursor-pointer"
              title="Push all local codes to the central factory server so all terminals see them"
            >
              <span>{isSyncingCloud ? '⏳' : '☁️'}</span>
              <span>{isSyncingCloud ? (syncProgress || 'Syncing...') : `Sync to Server (${assets.length})`}</span>
            </button>
          )}
          {totalCodes > 0 && onClearAllTasks && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete all ${totalCodes} task codes and reset the queue?`)) {
                  onClearAllTasks()
                  toast.success('All task queue codes cleared successfully.')
                }
              }}
              className="btn text-xs flex items-center gap-1.5 text-rose-500 hover:text-rose-600 border border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/10 cursor-pointer"
              title="Delete all task codes and clear queue"
            >
              <span>🗑️</span>
              <span>Purge All Codes ({totalCodes})</span>
            </button>
          )}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="text-[11px] text-[var(--mute)] font-medium">Total Asset Codes</div>
          <div className="text-lg sm:text-xl font-black text-[var(--ink)] mt-0.5 mb-1">{totalCodes}</div>
          <div className="text-[10px] text-[var(--mute)]">Provided in system</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between border-l-4 border-amber-500">
          <div className="text-[11px] text-[var(--mute)] font-medium">⏳ Pending Data Entry</div>
          <div className="text-lg sm:text-xl font-black text-amber-500 mt-0.5 mb-1">{pendingAssets.length}</div>
          <div className="text-[10px] text-[var(--mute)]">Awaiting department input</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between border-l-4 border-[var(--ok)]">
          <div className="text-[11px] text-[var(--mute)] font-medium">✅ Completed / Filled</div>
          <div className="text-lg sm:text-xl font-black text-[var(--ok)] mt-0.5 mb-1">{completedAssets.length}</div>
          <div className="text-[10px] text-[var(--mute)]">Details verified & active</div>
        </div>
        <div className="card p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="text-[11px] text-[var(--mute)] font-medium">Completion Rate</div>
          <div className="text-lg sm:text-xl font-black text-[var(--acc)] mt-0.5 mb-1">{completionPct}%</div>
          <div className="w-full bg-[var(--surf2)] h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-[var(--acc)] h-full transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Code Provisioning Section (Optionally visible or toggled) */}
      {(activeTab === 'import' || canUpload) && (
        <div className="space-y-4">
          <section className="card p-5 space-y-4" aria-label="Import asset codes">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--ink)]">Import Excel Master Sheet / Asset Codes</h2>
                <p className="text-xs text-[var(--mute)]">
                  Upload SAP/ERP Excel files (.xlsx, .xls) to auto-fetch Company code, Asset Class, Tag, Description, Cap date, Cost center & Location directly into the queue.
                </p>
              </div>
              <label className="btn p text-xs cursor-pointer flex items-center gap-1.5 shadow-xs">
                <span>📊</span>
                <span className="font-bold">Import Excel (.xlsx)</span>
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
        <div className="flex flex-col gap-2.5">
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
              {DEPARTMENTS.slice(0, 7).map((dept) => {
                const isSelected =
                  departmentFilter.toLowerCase() === dept.toLowerCase() ||
                  (departmentFilter !== 'All' &&
                    (departmentFilter.toLowerCase().includes(dept.toLowerCase()) ||
                      dept.toLowerCase().includes(departmentFilter.toLowerCase())))
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-[var(--acc)] text-white'
                        : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {dept}
                  </button>
                )
              })}
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
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1.5 text-xs text-[var(--mute)] hover:text-[var(--ink)]"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Major Asset Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mute)] shrink-0">Category:</span>
            <button
              type="button"
              onClick={() => setCategoryFilter('All')}
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                categoryFilter === 'All'
                  ? 'bg-[var(--ink)] text-[var(--surf)] font-bold'
                  : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
              }`}
            >
              All Categories
            </button>
            {MAJOR_ASSET_CATEGORIES.map((catKey) => {
              const cfg = MAJOR_ASSET_CATEGORIES_CONFIG[catKey]
              const isSelected = categoryFilter === catKey
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setCategoryFilter(catKey)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--surf)] font-bold shadow-xs'
                      : 'bg-[var(--surf2)] text-[var(--mute)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tasks Table / List */}
        <div className="overflow-x-auto overflow-y-auto max-h-[540px] md:max-h-[calc(100vh-380px)] min-h-[320px] rounded-lg border border-[var(--line)]/60 relative scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--surf)] shadow-xs">
              <tr className="border-b border-[var(--line)] text-[var(--mute)] uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 bg-[var(--surf)]">Asset Code</th>
                <th className="py-2.5 px-3 bg-[var(--surf)]">Department</th>
                <th className="py-2.5 px-3 bg-[var(--surf)]">Data Status</th>
                <th className="py-2.5 px-3 bg-[var(--surf)]">Location & Custodian</th>
                <th className="py-2.5 px-3 text-right bg-[var(--surf)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {paginatedTasks.length > 0 ? (
                paginatedTasks.map((asset) => {
                  const isCompleted = isAssetTaskCompleted(asset)
                  const rawDept = (asset.currentDepartment || asset.department || '').trim()
                  const dept = isRawNumericDepartmentCode(rawDept) || !rawDept
                    ? resolveDepartmentName(rawDept, asset)
                    : rawDept
                  const inCharge = asset.inChargeName || asset.submitter || asset.assignedTo || '-'
                  const isPadget = isPadgetCompany(asset)
                  const loc = [asset.company || (isPadget ? 'Padget' : 'IIPL'), asset.building || (isPadget ? 'D197' : 'C39'), asset.floor].filter(Boolean).join(' · ')

                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-[var(--surf2)]/50 transition-colors"
                    >
                      {/* Asset Code */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-[var(--ink)]">
                          <span>🏷️</span>
                          <span>{asset.assetCode}</span>
                        </div>
                        {Boolean((asset.name && asset.name !== asset.assetCode) || (asset.currentDescription && asset.currentDescription !== asset.assetCode)) && (
                          <div className="text-[11px] text-[var(--mute)] truncate max-w-[220px] font-sans font-medium mt-0.5">
                            {asset.name && asset.name !== asset.assetCode ? asset.name : asset.currentDescription}
                          </div>
                        )}
                        {asset.companyCode && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                            <span>📊 Excel: {asset.companyCode}</span>
                            {asset.assetClass && <span>· {asset.assetClass}</span>}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                              MAJOR_ASSET_CATEGORIES_CONFIG[resolveMajorAssetCategory(asset.currentCategory || asset.category)].badgeClass
                            }`}
                          >
                            {MAJOR_ASSET_CATEGORIES_CONFIG[resolveMajorAssetCategory(asset.currentCategory || asset.category)].icon}{' '}
                            {MAJOR_ASSET_CATEGORIES_CONFIG[resolveMajorAssetCategory(asset.currentCategory || asset.category)].label}
                          </span>
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
