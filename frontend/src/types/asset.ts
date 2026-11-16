export type AssetStatus =
  | "Active"
  | "Maintenance"
  | "Reserved"
  | "Retired"
  | "Imported"
  | "Pending Verification"
  | "Completed"
  | "In Use"
  | "Idle"
  | "Under Repair"
  | "Pending Disposal"
  | "Disposed"

export type IndianPlantRole =
  | "Admin"
  | "Plant Manager"
  | "Maintenance"
  | "Store"
  | "Auditor"
  | "Viewer"
  | "Employee"

export type PlantDepartment =
  | "IT"
  | "Production"
  | "Maintenance"
  | "Store"
  | "Finance"
  | "Quality"
  | "Operations"
  | "Administration"

export interface UserAccount {
  id?: number | string
  userId: string
  name: string
  email?: string
  department: string
  role: string
  password?: string
  isSuperuser?: boolean
  isActive?: boolean
  createdBy?: string
  createdAt?: string
}

export type DepreciationMethod =
  | "Straight Line (SLM)"
  | "Written Down Value (WDV / Reducing Balance)"

export type GSTType = "CGST+SGST" | "IGST" | "Exempt"

export interface MaintenanceTicket {
  id: string
  assetCode: string
  assetName: string
  faultSymptom: string
  downtimeStart: string
  maintenanceType: 'in-house' | 'external'
  serviceProvider?: string
  estimatedCost: number
  actualCost?: number
  priority: 'High' | 'Medium' | 'Low'
  status: 'Pending Maintenance' | 'In Maintenance' | 'Pending Acceptance' | 'Completed' | 'Scrapped'
  repairedParts?: string
  completionTime?: string
  downtimeHours?: number
  photoUrl?: string
  invoiceUrl?: string
  notes?: string
}

export interface StockCountItem {
  id: string
  assetCode: string
  assetName: string
  bookLocation: string
  actualLocation: string
  category: string
  status: 'Normal' | 'Shortage' | 'Overage' | 'Not Found'
  scannedBy: string
  scannedAt: string
  photo?: string
  syncStatus: 'synced' | 'pending_sync'
  varianceRemarks?: string
}

export interface StockCountTask {
  id: string
  title: string
  plant: string
  workshop: string
  line: string
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Pending Review'
  totalAssets: number
  scannedAssets: number
  variancesCount: number
  createdAt: string
  completedAt?: string
}

export type TransferType = 'Small Asset' | 'Large Asset' | 'Parts'

export type TransferStatus =
  | 'Pending HOD'
  | 'Pending Chinese HOD'
  | 'Pending Finance'
  | 'Pending Samfu Boss'
  | 'Approved'
  | 'Rejected'

export interface TransferApprovalStep {
  stage: number
  role: string
  approverId: string
  approverName: string
  decision: 'Approved' | 'Rejected'
  comments: string
  timestamp: string
}

export interface TransferNotification {
  id: string
  transferId: string
  recipientRole: string
  recipientId?: string
  recipientDept?: string
  title: string
  message: string
  timestamp: string
  read: boolean
}

export interface TransferRequestItem {
  id: string
  assetCode: string
  assetName: string
  transferType: TransferType
  fromLocation: string
  toLocation: string
  fromPlant: string
  toPlant: string
  fromDept: string
  toDept: string
  newCustodian: string
  newCustodianId?: string
  reason: string
  date: string
  updatedAt?: string
  requesterId: string
  requesterName: string
  requesterDept: string
  status: TransferStatus
  currentStage: number // 1, 2, 3
  totalStages: number // 1 for Small Asset, 3 for Large/Parts
  currentApproverRole: 'HOD' | 'Chinese HOD' | 'Finance' | 'Samfu Boss'
  approvalHistory: TransferApprovalStep[]
  rejectionReason?: string
  rejectedByRole?: string
  completedAt?: string
}

export interface Asset {
  id: string
  // Basic Information
  assetCode: string
  serialNumber: string
  currentCategory: string
  currentDescription: string
  previousCategory?: string
  previousDescription?: string
  brand?: string
  model?: string
  specs?: string
  supplierName?: string
  supplierGstin?: string

  // Indian Tax & Procurement Financial Info
  purchaseDate: string
  invoiceNo?: string
  gstType?: GSTType
  gstAmount?: number
  grossValue?: number // Original asset value in INR
  purchaseCost: number
  currentValue: number
  salvageValueRate?: number // e.g. 5%
  depreciationMethod?: DepreciationMethod
  usefulLifeYears?: number
  accumulatedDepreciation?: number

  // Location & Entity Hierarchy (Plant -> Workshop -> Line -> Station)
  company?: 'IIPL' | 'Padget' | string
  companyCode?: string
  assetClass?: string
  capitalizationDate?: string
  isExcelImported?: boolean
  plant: string
  workshop?: string
  productionLine?: string
  workstation?: string
  costCenter?: string
  building?: 'C39' | 'D197' | 'D198' | 'D199' | string
  floor?: string
  currentLocation?: string

  // Ownership & Custodian
  currentDepartment?: string
  submitter?: string
  submitterId?: string
  submitterDepartment?: string
  inChargeId?: string
  inChargeName?: string
  whoInCharge?: string
  custodian?: string // Employee ID + Name

  // Asset Status & Maintenance / Calibration
  assetCondition: string
  calibrationDueDate?: string // Mandatory calibration reminder
  movementReason?: string
  remarks?: string
  syncStatus?: 'synced' | 'pending_sync'

  unavailabilityReasons?: {
    assetCode?: string
    serialNumber?: string
    plant?: string
    assetCondition?: string
    [key: string]: string | undefined
  }

  // Media (Data URLs)
  assetPhoto?: string
  assetCodePhoto?: string
  idCardPicture?: string

  // Metadata
  date: string
  updatedAt?: string

  // QR Print Control & Governance
  printCount?: number
  firstPrintedAt?: string
  firstPrintedBy?: string
  lastPrintedAt?: string
  lastPrintedBy?: string
  lastPrintedUserId?: string
  reprintStatus?: 'Not Printed' | 'Printed' | 'Reprint Pending' | 'Approved' | 'Rejected'

  // Compatibility fields for tables/dashboard
  name: string
  assetTag: string
  category: string
  department: string
  status: AssetStatus
  assignedTo: string
  location: string
}

export interface AssetTypeTemplate {
  id: string
  name: string
  category: string
  manufacturer: string
  specs: Record<string, string>
  customPhotoUrl?: string
}

// ── Four Major System Asset Categories ──
export const MAJOR_ASSET_CATEGORIES = [
  'Fixed Assets',
  'Accessories',
  'Tools',
  'Fixtures',
] as const

export type MajorAssetCategory = typeof MAJOR_ASSET_CATEGORIES[number]

export interface AssetCategoryMeta {
  key: MajorAssetCategory
  label: string
  chineseLabel: string
  englishLabel: string
  icon: string
  description: string
  color: string
  badgeClass: string
}

export const MAJOR_ASSET_CATEGORIES_CONFIG: Record<MajorAssetCategory, AssetCategoryMeta> = {
  'Fixed Assets': {
    key: 'Fixed Assets',
    label: 'Fixed Assets',
    chineseLabel: '设备固定资产',
    englishLabel: 'Equipment Fixed Asset',
    icon: '🏢',
    description: 'Capital machinery, SMT lines, servers, vehicles & plant equipment',
    color: 'rgb(59, 130, 246)',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  'Accessories': {
    key: 'Accessories',
    label: 'Accessories',
    chineseLabel: '设备配件 / 附件',
    englishLabel: 'Equipment Accessory',
    icon: '🔌',
    description: 'Power adapters, auxiliary modules, cables, trays & sub-assemblies',
    color: 'rgb(16, 185, 129)',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  },
  'Tools': {
    key: 'Tools',
    label: 'Tools',
    chineseLabel: '工装工具 / 器具',
    englishLabel: 'Equipment Tool',
    icon: '🛠️',
    description: 'Hand tools, calibration kits, torque drivers, multimeters & test meters',
    color: 'rgb(245, 158, 11)',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  'Fixtures': {
    key: 'Fixtures',
    label: 'Fixtures',
    chineseLabel: '工装夹具 / 治具',
    englishLabel: 'Equipment Fixture',
    icon: '🧰',
    description: 'SMT carriers, PCB holding nests, clamping jigs & test fixtures',
    color: 'rgb(168, 85, 247)',
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  },
}

export function resolveMajorAssetCategory(rawCategory?: string): MajorAssetCategory {
  if (!rawCategory) return 'Fixed Assets'
  const clean = rawCategory.trim().toLowerCase()
  if (clean.includes('accessor') || clean.includes('配件') || clean.includes('附件')) return 'Accessories'
  if (clean.includes('fixture') || clean.includes('夹具') || clean.includes('治具') || clean.includes('jig') || clean.includes('nest') || clean.includes('carrier') || clean.includes('stencil')) return 'Fixtures'
  if (clean.includes('tool') || clean.includes('工具') || clean.includes('工装') || clean.includes('torque') || clean.includes('meter')) return 'Tools'
  return 'Fixed Assets'
}

/**
 * Determines whether an asset represents a fully completed and registered equipment unit,
 * or if it is still an unfilled pending task queue code.
 *
 * An asset is considered pending (and must NOT appear in Main Dashboard or Asset Gallery) if:
 * 1. Status is 'Imported' or 'Pending Verification'
 * 2. ID starts with 'imported-' and status is not explicitly 'Completed'
 * 3. It lacks physical registration details (no serial number, no condition, no actual in-charge person)
 */
export function isAssetTaskCompleted(asset: Asset): boolean {
  if (!asset) return false

  // If marked as imported code or pending verification, it is pending
  if (asset.status === 'Imported' || asset.status === 'Pending Verification') {
    return false
  }

  // A completed asset must have physical registration fields filled
  const hasBasicDetails = Boolean(
    (asset.serialNumber && asset.serialNumber.trim() && asset.serialNumber !== 'SN-UNAVAILABLE') ||
    (asset.assetCondition && asset.assetCondition.trim())
  )
  const hasInCharge = Boolean(
    (asset.inChargeName && asset.inChargeName.trim() && asset.inChargeName !== 'Unassigned Staff') ||
    (asset.inChargeId && asset.inChargeId.trim() && asset.inChargeId !== 'ID Pending') ||
    (asset.assignedTo && asset.assignedTo.trim() && asset.assignedTo !== 'Unassigned Staff')
  )

  // If explicitly completed through Add Asset form
  if (asset.status === 'Completed') {
    return hasBasicDetails || hasInCharge
  }

  // If it was created from an asset code batch import and not yet marked Completed with details
  if (asset.id && typeof asset.id === 'string' && asset.id.startsWith('imported-')) {
    return false
  }

  // If neither basic equipment details nor in-charge person exists, it is an unfilled task code
  if (!hasBasicDetails && !hasInCharge) {
    return false
  }

  return (
    asset.status === 'Active' ||
    asset.status === 'Maintenance' ||
    asset.status === 'Reserved' ||
    asset.status === 'Retired' ||
    asset.status === 'In Use'
  )
}

export interface AssetCompletenessReport {
  isFullyFilled: boolean
  missingFields: string[]
  reasons: string[]
}

/**
 * Validates whether all mandatory asset data has been fully filled in
 * to satisfy the QR printing rule: "no one will be able to print the qr until unless data for the assets has been fully filled"
 */
export function checkAssetDataCompleteness(asset: Asset | undefined | null): AssetCompletenessReport {
  if (!asset) {
    return {
      isFullyFilled: false,
      missingFields: ['Asset Record'],
      reasons: ['Asset record not found'],
    }
  }

  const missingFields: string[] = []
  const reasons: string[] = []

  // 1. Task Queue / Basic Completion check
  if (!isAssetTaskCompleted(asset)) {
    missingFields.push('Task Registration Status')
    reasons.push(`Asset is pending completion (Current Status: "${asset.status || 'Pending'}"). Complete the asset registration form first.`)
  }

  // 2. Asset Code (资产编号)
  if (!asset.assetCode || !asset.assetCode.trim()) {
    missingFields.push('Asset Code (资产编号)')
    reasons.push('Asset Code is missing or empty.')
  }

  // 3. Asset Name / Description (资产名称)
  const codeVal = (asset.assetCode || '').trim()
  const rawName = (asset.name || '').trim()
  const rawDesc = (asset.currentDescription || '').trim()
  const hasName = Boolean(
    (rawName && rawName !== codeVal) ||
    (rawDesc && rawDesc !== codeVal)
  )
  if (!hasName) {
    missingFields.push('Asset Name / Description (资产名称)')
    reasons.push('Real equipment name/description is required (cannot just repeat the asset code).')
  }

  // 4. Serial Number / Model (设备型号/序列号)
  const hasSerial = Boolean(
    (asset.serialNumber && asset.serialNumber.trim()) ||
    (asset.unavailabilityReasons?.serialNumber && asset.unavailabilityReasons.serialNumber.trim())
  )
  if (!hasSerial) {
    missingFields.push('Serial Number / Model (设备型号/序列号)')
    reasons.push('Serial number or equipment model is required.')
  }

  // 5. Category (设备类别)
  const hasCategory = Boolean(
    (asset.currentCategory && asset.currentCategory.trim()) ||
    (asset.category && asset.category.trim())
  )
  if (!hasCategory) {
    missingFields.push('Category (设备类别)')
    reasons.push('Asset category is required.')
  }

  // 6. Placement Area & Location (放置区域/厂区)
  const hasLocation = Boolean(
    (asset.building && asset.building.trim()) ||
    (asset.plant && asset.plant.trim()) ||
    (asset.currentLocation && asset.currentLocation.trim()) ||
    (asset.location && asset.location.trim())
  )
  if (!hasLocation) {
    missingFields.push('Location / Placement Area (放置区域/厂区)')
    reasons.push('Building, plant, or physical placement area must be specified.')
  }

  // 7. Department (使用部门)
  const hasDept = Boolean(
    (asset.currentDepartment && asset.currentDepartment.trim()) ||
    (asset.department && asset.department.trim())
  )
  if (!hasDept) {
    missingFields.push('Department (使用部门)')
    reasons.push('Owning department must be assigned.')
  }

  // 8. Custodian / In-Charge (责任人)
  const hasCustodian = Boolean(
    (asset.inChargeName && asset.inChargeName.trim() && asset.inChargeName !== 'Unassigned Staff') ||
    (asset.inChargeId && asset.inChargeId.trim() && asset.inChargeId !== 'ID Pending') ||
    (asset.whoInCharge && asset.whoInCharge.trim() && asset.whoInCharge !== 'Unassigned Staff' && !asset.whoInCharge.includes('ID Pending')) ||
    (asset.assignedTo && asset.assignedTo.trim() && asset.assignedTo !== 'Unassigned Staff')
  )
  if (!hasCustodian) {
    missingFields.push('Custodian / In-Charge (责任人)')
    reasons.push('Responsible custodian name or Employee ID is required.')
  }

  // 9. Asset Condition (资产状态)
  const hasCondition = Boolean(
    (asset.assetCondition && asset.assetCondition.trim()) ||
    (asset.unavailabilityReasons?.assetCondition && asset.unavailabilityReasons.assetCondition.trim())
  )
  if (!hasCondition) {
    missingFields.push('Asset Condition (资产状态)')
    reasons.push('Operational condition must be recorded.')
  }

  return {
    isFullyFilled: missingFields.length === 0,
    missingFields,
    reasons,
  }
}

/**
 * Strict boolean helper determining whether an asset is authorized for QR printing
 */
export function isAssetPrintable(asset: Asset | undefined | null): boolean {
  return checkAssetDataCompleteness(asset).isFullyFilled
}


