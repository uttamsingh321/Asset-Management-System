/**
 * India Localization Utilities
 * - Bilingual labels (English + Hindi)
 * - INR currency formatting (Indian number system: 12,34,567.00)
 * - DD/MM/YYYY date format
 * - GST, depreciation, and plant-specific constants
 */

export type Language = 'en' | 'hi'

/** Indian number system: lakh, crore (e.g. 12,34,567.00) */
export function formatINR(amount: number): string {
  if (isNaN(amount)) return '₹0.00'
  const [intPart, decPart = '00'] = amount.toFixed(2).split('.')
  const lastThree = intPart.slice(-3)
  const rest = intPart.slice(0, intPart.length - 3)
  const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree
  return `₹${formatted}.${decPart}`
}

/** DD/MM/YYYY (India standard) */
export function formatDateIN(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Today in YYYY-MM-DD (for input[type=date] value) */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Bilingual label map */
export const labels: Record<string, Record<Language, string>> = {
  dashboard: { en: 'Dashboard', hi: 'डैशबोर्ड' },
  assetList: { en: 'Asset Master List', hi: 'संपत्ति मास्टर सूची' },
  addAsset: { en: 'Add Asset', hi: 'संपत्ति जोड़ें' },
  maintenance: { en: 'Maintenance', hi: 'रखरखाव' },
  stockCount: { en: 'Stock Count', hi: 'स्टॉक गिनती' },
  transfer: { en: 'Transfer Asset', hi: 'संपत्ति स्थानांतरण' },
  disposal: { en: 'Disposal', hi: 'निपटान' },
  depreciation: { en: 'Depreciation Ledger', hi: 'मूल्यह्रास खाता' },
  reports: { en: 'Reports', hi: 'रिपोर्ट' },
  settings: { en: 'Settings', hi: 'सेटिंग' },
  auditLog: { en: 'Audit Log', hi: 'ऑडिट लॉग' },
  labelPrint: { en: 'Label Print', hi: 'लेबल प्रिंट' },
  assetNo: { en: 'Asset No.', hi: 'संपत्ति क्रमांक' },
  name: { en: 'Asset Name', hi: 'संपत्ति नाम' },
  category: { en: 'Category', hi: 'श्रेणी' },
  model: { en: 'Model', hi: 'मॉडल' },
  serialNo: { en: 'Serial No.', hi: 'क्रमांक' },
  location: { en: 'Location', hi: 'स्थान' },
  status: { en: 'Status', hi: 'स्थिति' },
  purchaseDate: { en: 'Purchase Date', hi: 'खरीद तिथि' },
  grossValue: { en: 'Gross Value (INR)', hi: 'सकल मूल्य (INR)' },
  accDepreciation: { en: 'Accumulated Depreciation', hi: 'संचित मूल्यह्रास' },
  custodian: { en: 'Custodian', hi: 'अभिरक्षक' },
  plant: { en: 'Plant', hi: 'संयंत्र' },
  workshop: { en: 'Workshop', hi: 'कार्यशाला' },
  productionLine: { en: 'Production Line', hi: 'उत्पादन लाइन' },
  costCenter: { en: 'Cost Center', hi: 'लागत केंद्र' },
  supplier: { en: 'Supplier', hi: 'आपूर्तिकर्ता' },
  supplierGstin: { en: 'Supplier GSTIN', hi: 'आपूर्तिकर्ता GSTIN' },
  invoiceNo: { en: 'Invoice No.', hi: 'चालान क्रमांक' },
  gstType: { en: 'GST Type', hi: 'GST प्रकार' },
  gstAmount: { en: 'GST Amount', hi: 'GST राशि' },
  depreciationMethod: { en: 'Depreciation Method', hi: 'मूल्यह्रास पद्धति' },
  usefulLife: { en: 'Useful Life (Years)', hi: 'उपयोगी जीवन (वर्ष)' },
  salvageValue: { en: 'Salvage Value Rate (%)', hi: 'अवशिष्ट मूल्य दर (%)' },
  scanQR: { en: 'Scan QR Code', hi: 'QR कोड स्कैन करें' },
  scanVerify: { en: 'Scan to Verify', hi: 'सत्यापन के लिए स्कैन' },
  logRepair: { en: 'Log Repair', hi: 'मरम्मत लॉग' },
  exportReport: { en: 'Export Report', hi: 'रिपोर्ट निर्यात' },
  scrapApplication: { en: 'Scrap Application', hi: 'स्क्रैप आवेदन' },
  pendingApproval: { en: 'Pending Approval', hi: 'अनुमोदन प्रतीक्षित' },
  approved: { en: 'Approved', hi: 'अनुमोदित' },
  rejected: { en: 'Rejected', hi: 'अस्वीकृत' },
  inUse: { en: 'In Use', hi: 'उपयोग में' },
  idle: { en: 'Idle', hi: 'निष्क्रिय' },
  underRepair: { en: 'Under Repair', hi: 'मरम्मत में' },
  disposed: { en: 'Disposed', hi: 'निपटान हो चुका' },
  noida: { en: 'Noida', hi: 'नोएडा' },
  gurgaon: { en: 'Gurgaon', hi: 'गुरुग्राम' },
  save: { en: 'Save', hi: 'सहेजें' },
  saveAndNew: { en: 'Save & New', hi: 'सहेजें और नया' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  total: { en: 'Total', hi: 'कुल' },
  thisMonth: { en: 'This Month', hi: 'इस माह' },
  offlineMode: { en: 'Offline Mode', hi: 'ऑफलाइन मोड' },
  pendingSync: { en: 'Pending Sync', hi: 'सिंक प्रतीक्षित' },
  calibrationDue: { en: 'Calibration Due', hi: 'अंशांकन देय' },
  remarks: { en: 'Remarks', hi: 'टिप्पणी' },
  action: { en: 'Action', hi: 'क्रिया' },
  signIn: { en: 'Sign In to Workshop Portal', hi: 'कार्यशाला पोर्टल में साइन इन करें' },
  username: { en: 'User ID / Employee ID', hi: 'उपयोगकर्ता आईडी / कर्मचारी आईडी' },
  password: { en: 'Password', hi: 'पासवर्ड' },
  factorySelect: { en: 'Select Factory / Manufacturing Plant', hi: 'कारखाना / विनिर्माण संयंत्र चुनें' },
  rememberMe: { en: 'Remember me on this industrial terminal', hi: 'मुझे इस औद्योगिक टर्मिनल पर याद रखें' },
  forgotPassword: { en: 'Forgot password?', hi: 'पासवर्ड भूल गए?' },
  enterPortal: { en: 'Enter Enterprise Portal', hi: 'एंटरप्राइज पोर्टल में प्रवेश करें' },
  offlineWarning: { en: '⚠️ Offline Mode Entry (⚠️ for poor-network factories only)', hi: '⚠️ ऑफ़लाइन मोड प्रविष्टि (⚠️ केवल कमजोर नेटवर्क वाले कारखानों के लिए)' },
  versionNotice: { en: 'Enterprise Asset Ledger v2.4.0-IN-PROD', hi: 'एंटरप्राइज एसेट लेजर v2.4.0-IN-PROD' },
  lockoutTitle: { en: 'Security Lockout Activated', hi: 'सुरक्षा लॉकआउट सक्रिय' },
}

export function t(key: string, lang: Language): string {
  return labels[key]?.[lang] ?? labels[key]?.en ?? key
}

/** Indian manufacturing asset categories */
export const INDIA_ASSET_CATEGORIES = [
  'SMT Equipment',
  'Pick & Place Machine',
  'AOI (Automated Optical Inspection)',
  'SPI (Solder Paste Inspection)',
  'Reflow Oven',
  'Air Compressor',
  'Forklift / Material Handling',
  'Tooling & Jigs',
  'Measuring Instrument',
  'Power Facilities',
  'Office Equipment',
  'IT Hardware',
  'Networking Equipment',
  'HVAC / Utilities',
  'Fire Safety Equipment',
  'Vehicle',
] as const

/** Plant locations */
export const PLANT_LOCATIONS = ['Noida', 'Gurgaon', 'Mumbai', 'Chennai', 'Pune'] as const

/** Workshop / Location hierarchy */
export const WORKSHOPS = [
  'SMT Line 1',
  'SMT Line 2',
  'ASSY Line 1',
  'ASSY Line 2',
  'QC Lab',
  'Warehouse',
  'Power Distribution Room',
  'Maintenance Bay',
  'Office Building',
  'Loading Bay',
] as const

/** Depreciation methods per India Income Tax Act */
export const DEPRECIATION_METHODS = [
  'Straight Line (SLM)',
  'Written Down Value (WDV / Reducing Balance)',
] as const

/** GST types */
export const GST_TYPES = ['CGST+SGST', 'IGST', 'Exempt'] as const

/** India role hierarchy */
export const INDIA_ROLES = [
  'Admin',
  'Plant Manager',
  'Maintenance',
  'Store',
  'Auditor',
  'Viewer',
] as const

/** Default useful life by category (years, per India IT Act Schedule II) */
export const USEFUL_LIFE_MAP: Record<string, number> = {
  'SMT Equipment': 10,
  'Pick & Place Machine': 10,
  'AOI (Automated Optical Inspection)': 10,
  'SPI (Solder Paste Inspection)': 10,
  'Reflow Oven': 10,
  'Air Compressor': 15,
  'Forklift / Material Handling': 10,
  'Tooling & Jigs': 3,
  'Measuring Instrument': 5,
  'Power Facilities': 10,
  'Office Equipment': 5,
  'IT Hardware': 3,
  'Networking Equipment': 6,
  'HVAC / Utilities': 15,
  'Fire Safety Equipment': 10,
  'Vehicle': 8,
}

/** Calculate SLM depreciation (India IT Act) */
export function calcSLMDepreciation(grossValue: number, salvageRate: number, usefulLife: number, months: number): number {
  const salvage = grossValue * (salvageRate / 100)
  const depreciableValue = grossValue - salvage
  const annualDep = depreciableValue / usefulLife
  return (annualDep / 12) * months
}

/** Calculate WDV depreciation */
export function calcWDVDepreciation(openingValue: number, rate: number, months: number): number {
  const annualDep = openingValue * (rate / 100)
  return (annualDep / 12) * months
}

/** Auto-generate asset code: PLANT-CAT-YYYY-NNNNN */
export function generateAssetCode(plant: string, category: string, sequence: number): string {
  const plantCode = plant.slice(0, 3).toUpperCase()
  const catCode = category.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  const year = new Date().getFullYear()
  const seq = String(sequence).padStart(5, '0')
  return `${plantCode}-${catCode}-${year}-${seq}`
}

/** Validate GSTIN format (15-character India format) */
export function validateGSTIN(gstin: string): boolean {
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  return regex.test(gstin)
}
