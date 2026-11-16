import * as XLSX from 'xlsx'
import type { Asset, AssetTypeTemplate, AssetStatus } from '@/types/asset'
import { isPadgetCompany } from '@/assets/companyLogos'

export interface ImportSummary {
  totalRows: number
  importedCount: number
  categoriesCount: number
  typesCount: number
  categoryBreakdown: Record<string, number>
}

/**
 * Intelligent categorization classifier based on keywords and heuristics.
 * E.g., 'computer' -> 'Computers', 'mouse' -> 'Mice & Pointers', 'laptop' -> 'Laptops'
 */
export function autoCategorize(name: string = '', description: string = '', rawCategory: string = ''): string {
  const cleanRaw = (rawCategory || '').trim()
  if (
    cleanRaw &&
    !['general', 'unassigned', 'unknown', 'misc', 'miscellaneous', 'other'].includes(cleanRaw.toLowerCase())
  ) {
    return cleanRaw
  }

  const text = `${name} ${description}`.toLowerCase()

  // 1. Mice & Pointers
  if (/\b(mouse|mice|trackpad|touchpad|magic mouse|mx master|trackball|pointing device)\b/.test(text)) {
    return 'Mice & Pointers'
  }

  // 2. Keyboards & Typing
  if (/\b(keyboard|keypad|magic keyboard|mechanical keyboard|qwerty)\b/.test(text)) {
    return 'Keyboards'
  }

  // 3. Laptops & Notebooks
  if (/\b(laptop|macbook|thinkpad|notebook|chromebook|latitude|precision|probook|elitebook|zenbook|yoga)\b/.test(text)) {
    return 'Laptops'
  }

  // 4. Desktop Computers & Servers
  if (/\b(computer|desktop|pc|workstation|tower|optiplex|imac|mac mini|mac studio|mac pro|server|blade)\b/.test(text)) {
    return 'Computers'
  }

  // 5. Monitors & Visual Displays
  if (/\b(monitor|display|ultrasharp|screen|oled|led monitor|lcd|projector|tft|curved monitor)\b/.test(text)) {
    return 'Monitors & Displays'
  }

  // 6. Tablets & Mobile Handhelds
  if (/\b(tablet|ipad|galaxy tab|smartphone|iphone|pixel|mobile|phone|handheld|surface pro)\b/.test(text)) {
    return 'Tablets & Mobile'
  }

  // 7. Printers & Scanners
  if (/\b(printer|scanner|barcode|label printer|zebra|honeywell|laserjet|deskjet|thermal printer)\b/.test(text)) {
    return 'Printers & Scanners'
  }

  // 8. Networking & Telecom
  if (/\b(switch|router|access point|firewall|cisco|gateway|modem|ethernet|poe|patch panel|rack)\b/.test(text)) {
    return 'Networking'
  }

  // 9. Heavy Machinery & Industrial Production
  if (/\b(press|cnc|mill|lathe|hydraulic|grinder|welder|drill|machinery|vmc|conveyor|injection)\b/.test(text)) {
    return 'Heavy Machinery'
  }

  // 10. Vehicles, Fleet & Material Handling
  if (/\b(van|truck|tata|forklift|vehicle|car|fleet|lorry|trailer|pickup|transporter)\b/.test(text)) {
    return 'Fleet & Vehicles'
  }

  // 11. HVAC & Climate Facility
  if (/\b(chiller|hvac|air condition|ac unit|compressor|generator|cooling|ventilation|air handler)\b/.test(text)) {
    return 'HVAC & Facility'
  }

  // 12. Furniture & Ergonomics
  if (/\b(desk|chair|table|workstation|cabinet|godrej|furniture|pedestal|bookshelf|drawer)\b/.test(text)) {
    return 'Furniture & Fixtures'
  }

  // 13. Spares, Bearings & Hardware Parts
  if (/\b(bearing|skf|valve|gasket|pump|filter|belt|gear|fuse|bearing 6204|fitting|flange)\b/.test(text)) {
    return 'Spares & Consumables'
  }

  // 14. Audio & Video Gear
  if (/\b(camera|headset|headphones|microphone|speaker|webcam|soundbar|mic)\b/.test(text)) {
    return 'Audio/Visual'
  }

  return cleanRaw || 'General Equipment'
}

/**
 * Flexible header lookup to find raw column values across varied Excel formats (preserves Date, number, etc.)
 */
function findRowRawValue(row: Record<string, any>, possibleKeys: string[]): any {
  const rowKeys = Object.keys(row)
  for (const target of possibleKeys) {
    const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '')
    const foundKey = rowKeys.find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget
    )
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return row[foundKey]
    }
  }
  return undefined
}

/**
 * Safely parses any Excel date representation (Date instance, Excel serial number, or ISO/formatted string)
 * into a clean standard YYYY-MM-DD string.
 */
export function parseExcelDate(val: any): string | null {
  if (val === undefined || val === null) return null

  // 1. Native Date instance from SheetJS cellDates: true
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    const year = val.getFullYear()
    const month = String(val.getMonth() + 1).padStart(2, '0')
    const day = String(val.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 2. Excel numeric serial date (e.g. 44927 -> 2023-01-01)
  if (typeof val === 'number' && !isNaN(val) && val > 20000 && val < 80000) {
    // Excel base epoch is Dec 30, 1899
    const utcDays = Math.floor(val - 25569)
    const utcValue = utcDays * 86400
    const dateObj = new Date(utcValue * 1000)
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getUTCFullYear()
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
      const day = String(dateObj.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }

  const s = String(val).trim()
  if (!s) return null

  // 3. YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (isoMatch) {
    const y = isoMatch[1]
    const m = isoMatch[2].padStart(2, '0')
    const d = isoMatch[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 4. DD-MM-YYYY or MM/DD/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10)
    const p2 = parseInt(dmyMatch[2], 10)
    const y = dmyMatch[3]
    if (p1 > 12) {
      // Must be DD-MM-YYYY
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`
    } else {
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`
    }
  }

  // 5. General Date parsing
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return s
}

/**
 * Flexible header lookup to find column values across varied Excel formats (supports English, Chinese, and symbols)
 */
function findRowValue(row: Record<string, any>, possibleKeys: string[]): string {
  const rowKeys = Object.keys(row)
  for (const target of possibleKeys) {
    const lowerTarget = target.toLowerCase().trim()
    const cleanTarget = lowerTarget.replace(/[\s_\-./\\]+/g, '')
    const foundKey = rowKeys.find((k) => {
      const lowerK = k.toLowerCase().trim()
      const cleanK = lowerK.replace(/[\s_\-./\\]+/g, '')
      return cleanK === cleanTarget || lowerK === lowerTarget || lowerK.includes(lowerTarget)
    })
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const val = String(row[foundKey]).trim()
      if (val !== '') return val
    }
  }
  return ''
}

/**
 * High-performance Excel & CSV parser designed for massive spreadsheets (up to 100k rows)
 * Processes in asynchronous slices to avoid UI lockup while auto-categorizing records.
 */
export async function parseExcelOrCsvFile(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<{
  assets: Asset[]
  assetTypes: AssetTypeTemplate[]
  summary: ImportSummary
}> {
  if (onProgress) onProgress(5, `Reading ${file.name} (${Math.round(file.size / 1024)} KB)...`)

  // Read binary array buffer
  const arrayBuffer = await file.arrayBuffer()

  if (onProgress) onProgress(20, 'Parsing workbook sheets...')

  // Parse with SheetJS
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    dense: true,
  })

  // Pick first sheet or sheet containing asset data
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('Workbook contains no readable sheets.')
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" could not be loaded.`)
  }

  if (onProgress) onProgress(35, 'Converting spreadsheet records...')

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: '',
    raw: false,
  })

  const totalRows = rawRows.length
  if (totalRows === 0) {
    throw new Error('Spreadsheet contains zero data rows.')
  }

  const assets: Asset[] = []
  const typeMap = new Map<string, AssetTypeTemplate>()
  const categoryStats: Record<string, number> = {}

  const chunkSize = 2000
  const todayStr = new Date().toISOString().split('T')[0]

  // Chunked batch loop to handle 10k - 100k rows with non-blocking progress updates
  for (let i = 0; i < totalRows; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalRows)
    const chunkPercent = Math.min(95, Math.round(35 + ((i / totalRows) * 60)))
    if (onProgress) {
      onProgress(chunkPercent, `Processing rows ${i + 1} to ${end} of ${totalRows}...`)
    }

    for (let r = i; r < end; r++) {
      const row = rawRows[r]

      // Extract field values
      const name = findRowValue(row, [
        'name',
        'assetname',
        'itemname',
        'description',
        'currentdescription',
        'assetdescription',
        'maintext',
        'product',
        'equipment',
        'item',
        '资产名称',
        '设备名称',
        '名称',
      ]) || `Asset Unit #${r + 1}`

      const model = findRowValue(row, [
        'model',
        'modelno',
        'devicemodel',
        'equipmentmodel',
        'spec',
        'specification',
        'specifications',
        'specs',
        '规格型号',
        '型号',
        '规格',
      ]) || ''

      const rawCategory = findRowValue(row, [
        'category',
        'currentcategory',
        'assetclass',
        'class',
        'type',
        'assettype',
        'group',
        'classification',
        '资产类别',
        '类别',
        '资产分类',
      ])

      const category = autoCategorize(name, '', rawCategory)

      const assetCode = findRowValue(row, [
        'assetcode',
        'code',
        'assettag',
        'tag',
        'assetid',
        'id',
        'barcode',
        'qrcode',
        'cardno',
        '资产编号',
        '编号',
        '卡片编号',
      ]) || `AST-IMP-${String(r + 1).padStart(5, '0')}`

      const serialNumber = findRowValue(row, [
        'serialnumber',
        'serialno',
        'serial',
        'sn',
        'srno',
        'machineno',
        '出厂编号',
        '序列号',
        '机身号',
      ]) || ''

      const rawCompany = findRowValue(row, [
        'company',
        'companycode',
        'compcode',
        'cocode',
        'company_code',
        'entity',
        'organization',
        'org',
        'comp',
        'co',
        'client',
        'firm',
        '公司代码',
        '公司',
      ])

      const rawCostCenter = findRowValue(row, ['costcenter', 'costcentre', 'costctr', 'cc', '成本中心', '费用中心']) || ''
      const rawBuilding = findRowValue(row, ['building', 'bldg', 'block', 'wing', 'premise', 'structure', '厂房', '建筑物', '栋'])
      let building = rawBuilding || 'C39'
      if (rawBuilding) {
        const cleanB = rawBuilding.toUpperCase().replace(/\s+/g, '')
        if (cleanB.includes('C39') || cleanB === 'C-39') building = 'C39'
        else if (cleanB.includes('D197') || cleanB === 'D-197') building = 'D197'
        else if (cleanB.includes('D198') || cleanB === 'D-198') building = 'D198'
        else if (cleanB.includes('D199') || cleanB === 'D-199') building = 'D199'
      }

      const isPadget = isPadgetCompany({
        company: rawCompany,
        companyCode: rawCompany,
        building: building,
        location: row['location'] || row['plant'] || '',
        costCenter: rawCostCenter,
      })

      let company = isPadget ? 'Padget' : 'IIPL'
      let companyCode = isPadget ? '5030' : '5020'
      if (!isPadget && rawCompany) {
        if (/iipl/i.test(rawCompany) || /ismartu/i.test(rawCompany)) company = 'IIPL'
        else if (rawCompany === '5020') { company = 'IIPL'; companyCode = '5020' }
      }
      if (isPadget && building === 'C39') {
        building = 'D197'
      }

      const plant = findRowValue(row, ['plant', 'site', 'facility', 'factory', 'premises', '工厂']) || (isPadget ? 'Padget Electronics Central Plant' : `${company} Central Plant`)

      const floor = findRowValue(row, ['floor', 'flr', 'level', 'storey', 'story', '楼层', '层']) || 'Ground Floor'
      const currentLocation = findRowValue(row, ['location', 'currentlocation', 'room', 'bay', 'desk', 'area', '存放地点', '位置']) || `${building} - ${floor}`

      const department = findRowValue(row, [
        'department',
        'currentdepartment',
        'dept',
        'belongtowhichdept',
        'belongstodept',
        'belongingdept',
        'team',
        'division',
        '使用部门',
        '部门',
        '所属部门',
      ]) || rawCostCenter || 'Operations'

      const explicitInChargeId = findRowValue(row, [
        'inchargeid',
        'empid',
        'employeeid',
        'staffid',
        'chargeid',
        'custodianid',
        'incharge_id',
        'emp_id',
        '工号',
        '员工号',
      ])

      const explicitInChargeName = findRowValue(row, [
        'inchargename',
        'personincharge',
        'whoincharge',
        'incharge',
        'chargename',
        'employeename',
        'staffname',
        'custodian',
        'owner',
        'assignedto',
        'submitter',
        'user',
        '责任人',
        '保管人',
        '使用人',
        '负责人',
      ])

      let inChargeId = explicitInChargeId
      let inChargeName = explicitInChargeName

      if (!inChargeId && inChargeName) {
        const idMatch1 = inChargeName.match(/^([A-Z0-9_-]{3,12})\s*[-:·,]\s*(.+)$/i)
        const idMatch2 = inChargeName.match(/^(.+?)\s*\(([A-Z0-9_-]{3,12})\)$/i)
        if (idMatch1) {
          inChargeId = idMatch1[1].trim()
          inChargeName = idMatch1[2].trim()
        } else if (idMatch2) {
          inChargeName = idMatch2[1].trim()
          inChargeId = idMatch2[2].trim()
        }
      }

      // Exact data only: Do not generate fake EMP hash or fake staff name if absent in Excel
      const whoInCharge = inChargeId && inChargeName
        ? `${inChargeId} · ${inChargeName}`
        : inChargeName || inChargeId || ''
      const submitter = findRowValue(row, ['submitter', 'createdby', 'uploadedby']) || inChargeName || ''

      const assetCondition = findRowValue(row, ['assetcondition', 'condition', 'health', 'state']) || 'Operational - Good'
      const movementReason = findRowValue(row, ['movementreason', 'reason', 'purpose']) || 'Bulk inventory import'
      const remarks = findRowValue(row, ['remarks', 'notes', 'comments']) || `Imported from ${file.name}`

      // Extract image photo if embedded or provided as a URL / data URI
      const assetPhoto = findRowValue(row, [
        'assetphoto',
        'photo',
        'image',
        'picture',
        'photourl',
        'imageurl',
        'img',
        'pic',
      ]) || undefined

      const statusRaw = findRowValue(row, ['status', 'assetstatus', 'state']).toLowerCase()
      let status: AssetStatus = 'Active'
      if (statusRaw.includes('maint')) status = 'Maintenance'
      else if (statusRaw.includes('reserv')) status = 'Reserved'
      else if (statusRaw.includes('retir') || statusRaw.includes('dispos')) status = 'Retired'

      const purchaseCost = Number(findRowValue(row, ['cost', 'purchasecost', 'price', 'value', 'amount'])) || 0
      const assignedTo = whoInCharge
      const location = [company, building, floor].filter(Boolean).join(' · ')

      // Extract date from Excel sheet if present; fallback to today's date
      const rawDateVal = findRowRawValue(row, [
        'date',
        'assetdate',
        'purchasedate',
        'purchase_date',
        'regdate',
        'registrationdate',
        'registration_date',
        'createddate',
        'creationdate',
        'createdat',
        'created_at',
        'entrydate',
        'entry_date',
        'invoicedate',
        'invoice_date',
        'acquisitiondate',
        'installationdate',
        'startdate',
        'commissioningdate',
        'commissiondate',
        'procurementdate',
        'mfgdate',
        'manufacturingdate',
      ])
      const assetDate = parseExcelDate(rawDateVal) || todayStr

      const asset: Asset = {
        id: `import-${Date.now()}-${r}`,
        company,
        companyCode,
        costCenter: rawCostCenter || undefined,
        assetCode,
        model: model || undefined,
        serialNumber,
        currentCategory: category,
        currentDescription: name,
        previousCategory: rawCategory && rawCategory !== category ? rawCategory : undefined,
        previousDescription: undefined,
        plant,
        building: building || undefined,
        floor: floor || undefined,
        currentLocation: currentLocation || undefined,
        currentDepartment: department,
        submitter,
        inChargeId,
        inChargeName,
        whoInCharge,
        assetCondition,
        movementReason,
        remarks,
        assetPhoto,
        date: assetDate,
        name,
        assetTag: assetCode,
        category,
        department,
        status,
        purchaseDate: assetDate,
        purchaseCost,
        currentValue: purchaseCost,
        assignedTo,
        location,
      }

      assets.push(asset)

      // Update category counts
      categoryStats[category] = (categoryStats[category] || 0) + 1

      // Auto-extract equipment types for the Asset Library
      const typeKey = `${name.toLowerCase()}:::${category.toLowerCase()}`
      if (!typeMap.has(typeKey)) {
        const manufacturer = findRowValue(row, ['manufacturer', 'make', 'brand', 'vendor']) || inferManufacturer(name)
        typeMap.set(typeKey, {
          id: `type-${Date.now()}-${typeMap.size}`,
          name,
          category,
          manufacturer,
          specs: {
            Category: category,
            Manufacturer: manufacturer,
            'Auto-classified': 'Yes',
            'Registered on': todayStr,
          },
        })
      }
    }

    // Yield control to let UI refresh progress bar
    if (i + chunkSize < totalRows) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  const assetTypes = Array.from(typeMap.values())

  if (onProgress) onProgress(100, `Done! Imported ${assets.length} items across ${Object.keys(categoryStats).length} categories.`)

  return {
    assets,
    assetTypes,
    summary: {
      totalRows,
      importedCount: assets.length,
      categoriesCount: Object.keys(categoryStats).length,
      typesCount: assetTypes.length,
      categoryBreakdown: categoryStats,
    },
  }
}

/**
 * Deterministic hash for synthetic serials when missing
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

/**
 * Guess manufacturer from common equipment brands
 */
function inferManufacturer(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('apple') || lower.includes('macbook') || lower.includes('ipad')) return 'Apple'
  if (lower.includes('dell') || lower.includes('ultrasharp') || lower.includes('optiplex')) return 'Dell'
  if (lower.includes('hp') || lower.includes('probook') || lower.includes('laserjet')) return 'HP'
  if (lower.includes('lenovo') || lower.includes('thinkpad')) return 'Lenovo'
  if (lower.includes('cisco') || lower.includes('catalyst')) return 'Cisco'
  if (lower.includes('logitech') || lower.includes('mx master')) return 'Logitech'
  if (lower.includes('samsung') || lower.includes('galaxy')) return 'Samsung'
  if (lower.includes('zebra')) return 'Zebra Technologies'
  if (lower.includes('honeywell')) return 'Honeywell'
  if (lower.includes('tata')) return 'Tata Motors'
  if (lower.includes('schuler')) return 'Schuler'
  if (lower.includes('daikin')) return 'Daikin'
  if (lower.includes('godrej')) return 'Godrej'
  if (lower.includes('skf')) return 'SKF'
  return 'Enterprise Supplier'
}
