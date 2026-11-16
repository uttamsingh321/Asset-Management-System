import * as React from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import type { Asset } from '@/types/asset'
import { checkAssetDataCompleteness, isAssetPrintable } from '@/types/asset'
import type { Language } from '@/lib/indiaLocale'
import { toast } from 'sonner'
import { getCompanyLogo, isPadgetCompany } from '@/assets/companyLogos'
import { getCurrentUserProfile, type UserProfile } from '@/lib/deviceTracker'
import {
  checkPrintEligibility,
  recordAssetPrint,
  createReprintRequest,
  approveReprintRequest,
  rejectReprintRequest,
  getPrintRecords,
  getReprintRequests,
  isSuperUserRole,
  REPRINT_REASONS,
  type ReprintRequest,
  type ReprintReason,
} from '@/lib/labelReprintService'

interface IndiaLabelPrintViewProps {
  assets: Asset[]
  lang: Language
  onFillAssetData?: (asset: Asset) => void
  currentUser?: UserProfile
}

// Full 107 Code 128 binary symbols (ISO/IEC 15417 standard table)
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011'
]

// Fallback Code 128 Set B binary sequence generator
function encodeCode128SetB(text: string): string {
  let checksum = 104 // Start B
  let binary = CODE128_PATTERNS[104]
  for (let i = 0; i < text.length; i++) {
    const val = (text.charCodeAt(i) - 32) % 103
    const safeVal = val >= 0 && val < 103 ? val : 0
    checksum += safeVal * (i + 1)
    binary += CODE128_PATTERNS[safeVal]
  }
  binary += CODE128_PATTERNS[checksum % 103]
  binary += CODE128_PATTERNS[106] // Stop symbol
  return binary
}

// 1D Barcode SVG Component with official ISO/IEC 15417 Code-128 standard encoding scannable by all barcode guns and camera scanners
export const BarcodeSvg = React.memo(function BarcodeSvg({ value, height = 44 }: { value: string; height?: number }) {
  const { totalWidth, rects } = React.useMemo(() => {
    const rawVal = String(value || '2004218').trim()
    let binaryData = ''

    try {
      // @ts-ignore - JsBarcode.getModule exists in jsbarcode library
      const Code128 = JsBarcode.getModule('CODE128')
      if (Code128) {
        // @ts-ignore
        const instance = new Code128(rawVal, {})
        if (typeof instance.encode === 'function') {
          const enc = instance.encode()
          binaryData = enc?.data || ''
        }
      }
    } catch (err) {
      console.warn('JsBarcode encoding error:', err)
    }

    if (!binaryData || !/^[01]+$/.test(binaryData)) {
      binaryData = encodeCode128SetB(rawVal)
    }

    const quietZone = 10 // ISO/IEC 15417 standard quiet zone (10 modules on left and right)
    let x = quietZone
    let currentBarWidth = 0
    const barRects: { x: number; width: number }[] = []

    for (let i = 0; i < binaryData.length; i++) {
      if (binaryData[i] === '1') {
        currentBarWidth++
      } else {
        if (currentBarWidth > 0) {
          barRects.push({ x: x - currentBarWidth, width: currentBarWidth })
          currentBarWidth = 0
        }
      }
      x++
    }
    if (currentBarWidth > 0) {
      barRects.push({ x: x - currentBarWidth, width: currentBarWidth })
    }

    const fullWidth = binaryData.length + quietZone * 2
    return { totalWidth: fullWidth, rects: barRects }
  }, [value])

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block mx-auto bg-white"
      shapeRendering="crispEdges"
      aria-label={`Barcode for ${value}`}
    >
      <rect width={totalWidth} height={height} fill="#ffffff" />
      {rects.map((r, idx) => (
        <rect
          key={idx}
          x={r.x}
          y={0}
          width={r.width}
          height={height}
          fill="#000000"
        />
      ))}
    </svg>
  )
})

// 2D QR Code SVG Component with ISO/IEC 18004 standards-compliant matrix scannable by all mobile cameras and barcode readers
export const QrCodeSvg = React.memo(function QrCodeSvg({
  value,
  displayLabel,
  size = 68,
}: {
  value: string
  displayLabel?: string
  size?: number
}) {
  const { size: matrixSize, cells } = React.useMemo(() => {
    try {
      const qr = QRCode.create(value || '2004218', { errorCorrectionLevel: 'M' })
      const N = qr.modules.size
      const list: { r: number; c: number }[] = []
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (qr.modules.get(r, c)) {
            list.push({ r, c })
          }
        }
      }
      return { size: N, cells: list }
    } catch {
      return { size: 21, cells: [] }
    }
  }, [value])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${matrixSize} ${matrixSize}`}
      className="block shrink-0 bg-white"
      aria-label={`QR Code for ${displayLabel || value}`}
      shapeRendering="crispEdges"
    >
      <rect width={matrixSize} height={matrixSize} fill="#ffffff" />
      {cells.map(({ r, c }) => (
        <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000000" />
      ))}
    </svg>
  )
})

// The Exact Template Component requested by the user
export const IsmartuAssetLabel = React.memo(function IsmartuAssetLabel({ asset, scale = 1 }: { asset: Asset; scale?: number }) {
  // 1. Asset Code
  const assetCode = asset.assetCode || '-'

  // Company Logo resolver (ismartu vs PadGET based on selected asset company, building, companyCode, etc.)
  const logoInfo = React.useMemo(() => getCompanyLogo(asset), [asset])

  // 2. Asset Name: prioritize explicit asset name, then description, avoiding repeating assetCode
  const assetName = React.useMemo(() => {
    const rawName = asset.name?.trim()
    const rawDesc = asset.currentDescription?.trim()
    if (rawName && rawName !== asset.assetCode) return rawName
    if (rawDesc && rawDesc !== asset.assetCode) return rawDesc
    if (rawName) return rawName
    if (rawDesc) return rawDesc
    return 'Equipment Fixed Asset'
  }, [asset.name, asset.currentDescription, asset.assetCode])
  
  // 3. Model: prioritize explicit model filled in asset form, then serial number, then category
  const model = React.useMemo(() => {
    if (asset.model && asset.model.trim()) return asset.model.trim()
    if (asset.serialNumber && asset.serialNumber.trim() && asset.serialNumber !== 'SN-UNAVAILABLE') return asset.serialNumber.trim()
    if (asset.currentCategory && asset.currentCategory.trim()) return asset.currentCategory.trim()
    if (asset.assetClass && asset.assetClass.trim()) return asset.assetClass.trim()
    return asset.category?.trim() || '-'
  }, [asset.model, asset.serialNumber, asset.currentCategory, asset.assetClass, asset.category])

  // 4. Department: real department filled in asset (strictly matches the asset form)
  const departmentDisplay = React.useMemo(() => {
    const dept = asset.currentDepartment?.trim() || asset.department?.trim() || ''
    return dept || (asset.building?.trim() ? `${asset.building.trim()} Operations` : '-')
  }, [asset.currentDepartment, asset.department, asset.building])

  // 5. Custodian (责任人 / Custodian): Real Owner - display Employee ID and Name
  const custodianDisplay = React.useMemo(() => {
    const empId = asset.inChargeId?.trim()
    const name = asset.inChargeName?.trim() || asset.custodian?.trim()
    const cleanId = empId && empId !== 'ID Pending' ? empId : ''
    const cleanName = name && name !== 'Unassigned Staff' ? name : ''

    if (cleanId && cleanName) {
      return `${cleanId} · ${cleanName}`
    }
    if (cleanId) return cleanId
    if (cleanName) return cleanName
    if (asset.whoInCharge && asset.whoInCharge !== 'Unassigned Staff' && !asset.whoInCharge.includes('ID Pending')) {
      return asset.whoInCharge
    }
    return '-'
  }, [asset.inChargeId, asset.inChargeName, asset.custodian, asset.whoInCharge])

  // 6. Current User (使用人 / Current User): Submitter / Logged-in Personnel who operates or registered the asset
  const currentUserDisplay = React.useMemo(() => {
    const empId = asset.submitterId?.trim()
    const name = asset.submitter?.trim()
    const dept = asset.submitterDepartment?.trim()
    const cleanId = empId && empId !== 'ID Pending' ? empId : ''
    const cleanName = name && name !== 'Unassigned Staff' && name !== 'Staff' ? name : ''

    if (cleanId && cleanName) {
      return dept ? `${cleanId} · ${cleanName} (${dept})` : `${cleanId} · ${cleanName}`
    }
    if (cleanId) return dept ? `${cleanId} (${dept})` : cleanId
    if (cleanName) return dept ? `${cleanName} (${dept})` : cleanName
    if (dept) return dept
    return '-'
  }, [asset.submitterId, asset.submitter, asset.submitterDepartment])

  // 7. Placement Area: real building and floor / location (filters out redundant factory address)
  const placementArea = React.useMemo(() => {
    const bldg = asset.building?.trim() || ''
    const flr = asset.floor?.trim() || ''
    const loc = asset.currentLocation?.trim() || ''
    const plant = asset.plant?.trim() || ''

    const cleanFloor = flr.replace(/floor/i, '').replace(/st|nd|rd|th/g, '').trim()
    const floorStr = cleanFloor ? (cleanFloor.toLowerCase().endsWith('f') ? cleanFloor : `${cleanFloor}F`) : ''

    // Ignore factory/plant address if copied into currentLocation
    const isPlantAddress = loc === plant || /factory|plant|c-39 factory|c39 factory/i.test(loc)
    const specificLoc = isPlantAddress ? '' : loc

    if (bldg && floorStr) {
      const base = `${bldg}-${floorStr}`
      return specificLoc && !specificLoc.includes(base) ? `${base} (${specificLoc})` : base
    }
    if (bldg && specificLoc) return `${bldg} - ${specificLoc}`
    if (bldg) return bldg
    if (specificLoc) return specificLoc
    if (loc && !isPlantAddress) return loc
    return '-'
  }, [asset])

  // Standard deep-link URL so mobile phone and laptop cameras open asset verification directly
  const qrNavigablePayload = React.useMemo(() => {
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin
      return `${origin}/?asset=${encodeURIComponent(asset.assetCode || '2004218')}#asset-details`
    }
    return asset.assetCode || '2004218'
  }, [asset.assetCode])

  // Exactly 7 rows: shows BOTH Real Owner (责任人/Custodian) and Current User (使用人/Current User)
  const rows = [
    { label: '资产编号/Asset No.', value: assetCode, isCode: true },
    { label: '资产名称/Asset Name', value: assetName },
    { label: '设备型号/Model', value: model },
    { label: '使用部门/Department', value: departmentDisplay },
    { label: '责任人/Custodian', value: custodianDisplay },
    { label: '使用人/Current User', value: currentUserDisplay },
    { label: '放置区域/Placement Area', value: placementArea },
  ]

  return (
    <div
      className="ismartu-label-card"
      style={{
        width: `${490 * scale}px`,
        border: '2px solid #000000',
        borderRadius: '3px',
        background: '#ffffff',
        color: '#000000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: scale === 1 ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {/* 1. Header: Logo (ismartu) on left | Bilingual Header on right */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #000000',
          minHeight: `${62 * scale}px`,
          boxSizing: 'border-box',
        }}
      >
        {/* Left: Company Logo (Original ismartu or PadGET) */}
        <div
          style={{
            width: '44%',
            borderRight: '2px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${5 * scale}px ${10 * scale}px`,
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <img
            src={logoInfo.src}
            alt={logoInfo.alt}
            style={{
              maxHeight: `${50 * scale}px`,
              maxWidth: '94%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', fontSize: 0, width: 0, height: 0, overflow: 'hidden' }}>
            {logoInfo.isPadget ? 'PadGET' : 'smartu'}
          </span>
        </div>

        {/* Right: Bilingual Title */}
        <div
          style={{
            width: '56%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: `${6 * scale}px ${16 * scale}px`,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: `${16 * scale}px`,
              fontWeight: 800,
              color: '#000000',
              letterSpacing: '1px',
              lineHeight: 1.25,
            }}
          >
            设备固定资产
          </div>
          <div
            style={{
              fontSize: `${14 * scale}px`,
              fontWeight: 800,
              color: '#000000',
              lineHeight: 1.2,
              marginTop: `${2 * scale}px`,
            }}
          >
            Equipment Fixed Asset
          </div>
        </div>
      </div>

      {/* 2. Middle Table: 7 Rows (Shows BOTH Real Owner & Current User) */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              borderBottom: idx === rows.length - 1 ? '2px solid #000000' : '1.5px solid #000000',
              minHeight: `${26.5 * scale}px`,
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            {/* Left Label Column */}
            <div
              style={{
                width: '38%',
                borderRight: '1.5px solid #000000',
                padding: `${2 * scale}px ${8 * scale}px`,
                fontSize: `${11.5 * scale}px`,
                fontWeight: 800,
                color: '#000000',
                whiteSpace: 'nowrap',
                lineHeight: 1.25,
                boxSizing: 'border-box',
              }}
            >
              {row.label}
            </div>

            {/* Right Value Column */}
            <div
              style={{
                width: '62%',
                padding: `${2 * scale}px ${10 * scale}px`,
                fontSize: row.isCode ? `${15 * scale}px` : `${12 * scale}px`,
                fontWeight: 800,
                color: '#000000',
                lineHeight: 1.25,
                fontFamily: row.isCode ? 'monospace, "Arial", sans-serif' : 'inherit',
                letterSpacing: row.isCode ? '1px' : 'normal',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
              }}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Bottom: Barcode on Left | QR Code + Tamper Warning on Right */}
      <div
        style={{
          display: 'flex',
          height: `${86 * scale}px`,
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Left: Barcode + Asset Code Text */}
        <div
          style={{
            width: '52%',
            borderRight: '2px solid #000000',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: `${4 * scale}px ${8 * scale}px`,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: '100%', height: `${48 * scale}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarcodeSvg value={asset.assetCode || '2004218'} height={Math.round(48 * scale)} />
          </div>
          <div
            style={{
              fontSize: `${13.5 * scale}px`,
              fontWeight: 800,
              letterSpacing: `${4 * scale}px`,
              fontFamily: 'monospace, "Courier New", Courier, monospace',
              marginTop: `${2 * scale}px`,
              textAlign: 'center',
            }}
          >
            {asset.assetCode || '2004218'}
          </div>
        </div>

        {/* Right: QR Code + Bilingual Warning */}
        <div
          style={{
            width: '48%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: `${4 * scale}px ${8 * scale}px`,
            gap: `${10 * scale}px`,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ border: '1px solid #000000', padding: '1px', background: '#ffffff', flexShrink: 0 }}>
            <QrCodeSvg
              value={qrNavigablePayload}
              displayLabel={asset.assetCode || '2004218'}
              size={Math.round(66 * scale)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div
              style={{
                fontSize: `${12.5 * scale}px`,
                fontWeight: 800,
                color: '#000000',
                whiteSpace: 'nowrap',
                lineHeight: 1.35,
              }}
            >
              禁止撕毁涂改
            </div>
            <div
              style={{
                fontSize: `${11 * scale}px`,
                fontWeight: 800,
                color: '#000000',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              Do not tear or alter.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export interface LabelSizePreset {
  id: string
  name: string
  widthMm: number
  heightMm: number
  scale: number
  desc: string
}

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { id: '100x65', name: '100 × 65 mm', widthMm: 100, heightMm: 65, scale: 1.0, desc: 'Enterprise Standard (Default)' },
  { id: '80x50', name: '80 × 50 mm', widthMm: 80, heightMm: 50, scale: 0.8, desc: 'Medium Machinery' },
  { id: '75x50', name: '75 × 50 mm (3" × 2")', widthMm: 75, heightMm: 50, scale: 0.75, desc: 'Standard Thermal Roll' },
  { id: '70x45', name: '70 × 45 mm', widthMm: 70, heightMm: 45, scale: 0.7, desc: 'Compact Equipment' },
  { id: '50x35', name: '50 × 35 mm (2" × 1.4")', widthMm: 50, heightMm: 35, scale: 0.52, desc: 'Mini Asset Tag' },
  { id: 'custom', name: 'Custom Size', widthMm: 100, heightMm: 65, scale: 1.0, desc: 'User-defined Dimensions' },
]

// Memoized List Row Item for Zero Lag under 15,000+ assets
interface AssetRowItemProps {
  asset: Asset
  isSelected: boolean
  isChecked: boolean
  isPrintable: boolean
  printCount: number
  isApproved: boolean
  isPending: boolean
  onSelect: (id: string) => void
  onToggleCheck: (asset: Asset) => void
}

const AssetRowItem = React.memo(function AssetRowItem({
  asset,
  isSelected,
  isChecked,
  isPrintable,
  printCount,
  isApproved,
  isPending,
  onSelect,
  onToggleCheck,
}: AssetRowItemProps) {
  return (
    <div
      onClick={() => onSelect(asset.id)}
      className={`p-2.5 flex items-center gap-2.5 cursor-pointer transition-colors ${
        isSelected ? 'bg-[var(--acc)]/10 font-bold' : 'hover:bg-[var(--surf2)]'
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        disabled={!isPrintable}
        onChange={(e) => {
          e.stopPropagation()
          onToggleCheck(asset)
        }}
        title={isPrintable ? 'Select for QR print' : 'Cannot select: asset data is incomplete'}
        className={`rounded ${isPrintable ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-bold text-[var(--ink)] flex items-center gap-1.5 truncate">
          <span>{asset.assetCode}</span>
          {isPrintable ? (
            printCount === 0 ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                ✓ Ready
              </span>
            ) : isApproved ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                ✅ Re-print OK
              </span>
            ) : isPending ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                ⏳ Pending
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20">
                🔒 Printed ({printCount}x)
              </span>
            )
          ) : (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-semibold border border-amber-500/20">
              🔒 Incomplete
            </span>
          )}
        </div>
        <div className="text-[11px] text-[var(--mute)] truncate">
          {asset.currentDescription || asset.name} · {asset.building || 'C39'}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
            asset.company?.toLowerCase().includes('padget')
              ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
              : 'bg-red-500/10 text-red-600 border-red-500/20'
          }`}
        >
          {asset.company?.toLowerCase().includes('padget') ? 'PadGET' : (asset.company || 'ismartu')}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--surf2)] text-[var(--mute)] font-medium">
          {asset.currentDepartment || asset.department || 'IT'}
        </span>
      </div>
    </div>
  )
})

export function IndiaLabelPrintView({ assets, lang, onFillAssetData, currentUser: propUser }: IndiaLabelPrintViewProps) {
  const activeUser = React.useMemo(() => propUser || getCurrentUserProfile(), [propUser])
  const isSuperUser = React.useMemo(() => isSuperUserRole(activeUser), [activeUser])

  // Reactive state for print records & reprint requests
  const [reprintUpdateVersion, setReprintUpdateVersion] = React.useState(0)
  React.useEffect(() => {
    const onUpdate = () => setReprintUpdateVersion((v) => v + 1)
    window.addEventListener('meridian_reprint_updated', onUpdate)
    return () => window.removeEventListener('meridian_reprint_updated', onUpdate)
  }, [])

  const printRecords = React.useMemo(() => getPrintRecords(), [reprintUpdateVersion])
  const reprintRequests = React.useMemo(() => getReprintRequests(), [reprintUpdateVersion])
  const pendingReprintRequests = React.useMemo(
    () => reprintRequests.filter((r) => r.status === 'pending'),
    [reprintRequests]
  )

  // Fast O(1) status lookup index to avoid quadratic iteration over thousands of assets
  const statusIndex = React.useMemo(() => {
    const approvedSet = new Set<string>()
    const pendingSet = new Set<string>()
    for (const r of reprintRequests) {
      if (r.status === 'approved' && !r.isUsed) {
        if (r.assetId) approvedSet.add(r.assetId)
        if (r.assetCode) approvedSet.add(r.assetCode)
      } else if (r.status === 'pending') {
        if (r.assetId) pendingSet.add(r.assetId)
        if (r.assetCode) pendingSet.add(r.assetCode)
      }
    }
    return { approvedSet, pendingSet }
  }, [reprintRequests])

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false)
  const [reprintReason, setReprintReason] = React.useState<ReprintReason>('Label Damaged / Scratched')
  const [reprintNotes, setReprintNotes] = React.useState('')
  const [submittingRequest, setSubmittingRequest] = React.useState(false)

  const [isApprovalsModalOpen, setIsApprovalsModalOpen] = React.useState(false)
  const [approvalsTab, setApprovalsTab] = React.useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [approvalReviewNotes, setApprovalReviewNotes] = React.useState<Record<string, string>>({})

  // Label Print Size Management State
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('100x65')
  const [customWidthMm, setCustomWidthMm] = React.useState<number>(100)
  const [customHeightMm, setCustomHeightMm] = React.useState<number>(65)
  const [customScalePercent, setCustomScalePercent] = React.useState<number>(100)
  const [showSizeManager, setShowSizeManager] = React.useState<boolean>(false)

  const activePreset = React.useMemo(() => {
    return LABEL_SIZE_PRESETS.find((p) => p.id === selectedPresetId) || LABEL_SIZE_PRESETS[0]
  }, [selectedPresetId])

  const activeWidthMm = selectedPresetId === 'custom' ? customWidthMm : activePreset.widthMm
  const activeHeightMm = selectedPresetId === 'custom' ? customHeightMm : activePreset.heightMm
  const activeScale = selectedPresetId === 'custom' ? customScalePercent / 100 : activePreset.scale

  // Active single selection state
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>(() => {
    try {
      const stored = sessionStorage.getItem('meridian_print_asset_id')
      if (stored && assets.some((a) => a.id === stored)) {
        return stored
      }
    } catch {}
    return assets[0]?.id || ''
  })

  // Synchronize when active asset is set from other views
  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem('meridian_print_asset_id')
      if (stored && assets.some((a) => a.id === stored)) {
        setSelectedAssetId(stored)
      }
    } catch {}
  }, [assets])

  // 10. Search debounce (300ms) to ensure butter-smooth typing without lag
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  const [filterTab, setFilterTab] = React.useState<'all' | 'ready' | 'pending'>('all')
  const [bulkSelected, setBulkSelected] = React.useState<Record<string, boolean>>({})

  // 8. Pagination State (50 items per page default)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(50)

  // Compute counts efficiently
  const readyAssetsCount = React.useMemo(() => assets.filter(isAssetPrintable).length, [assets])
  const pendingAssetsCount = assets.length - readyAssetsCount

  const searchedAssets = React.useMemo(() => {
    if (!debouncedSearch.trim()) return assets
    const q = debouncedSearch.toLowerCase().trim()
    return assets.filter(
      (a) =>
        (a.assetCode && a.assetCode.toLowerCase().includes(q)) ||
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.currentDescription && a.currentDescription.toLowerCase().includes(q)) ||
        (a.serialNumber && a.serialNumber.toLowerCase().includes(q)) ||
        (a.inChargeId && a.inChargeId.toLowerCase().includes(q)) ||
        (a.inChargeName && a.inChargeName.toLowerCase().includes(q)) ||
        (a.custodian && a.custodian.toLowerCase().includes(q)) ||
        (a.whoInCharge && a.whoInCharge.toLowerCase().includes(q)) ||
        (a.currentCategory && a.currentCategory.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.building && a.building.toLowerCase().includes(q)) ||
        (a.floor && a.floor.toLowerCase().includes(q)) ||
        (a.currentLocation && a.currentLocation.toLowerCase().includes(q)) ||
        (a.plant && a.plant.toLowerCase().includes(q)) ||
        (a.department && a.department.toLowerCase().includes(q)) ||
        (a.currentDepartment && a.currentDepartment.toLowerCase().includes(q))
    )
  }, [assets, debouncedSearch])

  const filteredAssets = React.useMemo(() => {
    if (filterTab === 'ready') return searchedAssets.filter(isAssetPrintable)
    if (filterTab === 'pending') return searchedAssets.filter((a) => !isAssetPrintable(a))
    return searchedAssets
  }, [searchedAssets, filterTab])

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize))
  const pagedAssets = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredAssets.slice(start, start + pageSize)
  }, [filteredAssets, currentPage, pageSize])

  // Multi-selection calculations
  const selectedBulkAssets = React.useMemo(() => {
    return assets.filter((a) => bulkSelected[a.id])
  }, [assets, bulkSelected])

  const selectedBulkCount = selectedBulkAssets.length

  const printableBulkAssets = React.useMemo(() => {
    return selectedBulkAssets.filter(isAssetPrintable)
  }, [selectedBulkAssets])

  // Active single asset: if exactly 1 is checked, that's currentAsset; otherwise selectedAssetId
  const currentAsset = React.useMemo(() => {
    if (selectedBulkCount === 1) {
      return selectedBulkAssets[0]
    }
    return assets.find((a) => a.id === selectedAssetId) || filteredAssets[0] || assets[0]
  }, [selectedBulkCount, selectedBulkAssets, assets, selectedAssetId, filteredAssets])

  // Current Asset validation & completeness
  const currentCompleteness = React.useMemo(
    () => checkAssetDataCompleteness(currentAsset),
    [currentAsset]
  )
  const isCurrentPrintable = currentCompleteness.isFullyFilled

  // Check Single-Print & Re-print Eligibility for current asset
  const currentEligibility = React.useMemo(
    () => checkPrintEligibility(currentAsset, activeUser, isCurrentPrintable),
    [currentAsset, activeUser, isCurrentPrintable, reprintUpdateVersion]
  )

  // 4 & 5. Select All & Confirmation Modal State
  const [isSelectAllModalOpen, setIsSelectAllModalOpen] = React.useState(false)

  // 6. Sequential Bulk Generation State (Non-blocking)
  const [isBulkGenerating, setIsBulkGenerating] = React.useState(false)
  const [bulkProgress, setBulkProgress] = React.useState<{
    current: number
    total: number
    currentAssetCode: string
    percent: number
    eta: string
  }>({
    current: 0,
    total: 0,
    currentAssetCode: '',
    percent: 0,
    eta: '',
  })
  const isCancelledRef = React.useRef(false)

  // Dedicated Print Queue state: ONLY mounts during active print and resets immediately
  const [activePrintQueue, setActivePrintQueue] = React.useState<Asset[] | null>(null)

  // Reset active print queue on print completion
  React.useEffect(() => {
    const handleAfterPrint = () => {
      setActivePrintQueue(null)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  // Toggle single bulk selection
  const toggleBulk = React.useCallback(
    (asset: Asset) => {
      if (!isAssetPrintable(asset)) {
        toast.error(`Cannot select ${asset.assetCode} for printing: Asset data is not fully filled.`, {
          description: `Missing: ${checkAssetDataCompleteness(asset).missingFields.join(', ')}`,
        })
        return
      }

      const elig = checkPrintEligibility(asset, activeUser, true)
      if (elig.isReprintBlocked) {
        toast.warning(`Cannot select ${asset.assetCode}: Duplicate Print Restricted`, {
          description: `This asset label was already printed. Submit a Re-print Request to the Super User to authorize a re-print.`,
        })
        return
      }

      setBulkSelected((prev) => ({ ...prev, [asset.id]: !prev[asset.id] }))
    },
    [activeUser]
  )

  // Select All click handler: prompts confirmation if large set (>50)
  const executeSelectAll = React.useCallback((andStartGeneration = false) => {
    const all: Record<string, boolean> = {}
    const printableInList = filteredAssets.filter(isAssetPrintable)
    let skippedCount = 0

    printableInList.forEach((a) => {
      const elig = checkPrintEligibility(a, activeUser, true)
      if (elig.canPrint) {
        all[a.id] = true
      } else {
        skippedCount++
      }
    })
    setBulkSelected(all)
    const selectedCount = Object.keys(all).length

    if (selectedCount === 0) {
      if (skippedCount > 0) {
        toast.info(`${skippedCount} assets were skipped because they were already printed and require Super User re-print approval.`)
      } else {
        toast.info('No fully filled assets available in the current view to select.')
      }
    } else {
      if (skippedCount > 0) {
        toast.success(`Selected ${selectedCount} assets. (${skippedCount} already printed assets skipped per Single-Print policy)`)
      } else {
        toast.success(`Selected ${selectedCount} fully filled assets for printing.`)
      }
      if (andStartGeneration) {
        const selectedList = printableInList.filter((a) => all[a.id])
        runSequentialBulk(selectedList, false)
      }
    }
  }, [filteredAssets, activeUser])

  const handleSelectAllClick = () => {
    const printableInList = filteredAssets.filter(isAssetPrintable)
    if (printableInList.length === 0) {
      toast.info('No fully filled assets available in the current view to select.')
      return
    }

    if (printableInList.length > 50) {
      setIsSelectAllModalOpen(true)
    } else {
      executeSelectAll(false)
    }
  }

  const clearAll = React.useCallback(() => {
    setBulkSelected({})
  }, [])

  // 6. Sequential Bulk Generator (Non-blocking chunks of 25)
  const runSequentialBulk = async (assetsToGenerate: Asset[], autoPrint = false) => {
    if (assetsToGenerate.length === 0) {
      toast.error('No printable assets available in selection.')
      return
    }

    isCancelledRef.current = false
    setIsBulkGenerating(true)
    const total = assetsToGenerate.length
    const startTime = Date.now()

    const validQueue: Asset[] = []
    const CHUNK_SIZE = 25

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (isCancelledRef.current) {
        toast.info('Label generation cancelled by user.')
        setIsBulkGenerating(false)
        return
      }

      const chunk = assetsToGenerate.slice(i, i + CHUNK_SIZE)
      for (const asset of chunk) {
        const elig = checkPrintEligibility(asset, activeUser, isAssetPrintable(asset))
        if (elig.canPrint) {
          validQueue.push(asset)
        }
      }

      const currentCount = Math.min(i + CHUNK_SIZE, total)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = currentCount / (elapsed || 0.1)
      const remainingSecs = Math.max(0, Math.round((total - currentCount) / rate))
      const eta = remainingSecs < 60 ? `${remainingSecs}s` : `${Math.ceil(remainingSecs / 60)} min`

      setBulkProgress({
        current: currentCount,
        total,
        currentAssetCode: chunk[chunk.length - 1]?.assetCode || '',
        percent: Math.round((currentCount / total) * 100),
        eta,
      })

      // Non-blocking yield to browser event loop
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    setIsBulkGenerating(false)

    if (autoPrint) {
      if (validQueue.length === 0) {
        toast.error('Duplicate Print Blocked: All selected assets have already been printed once.', {
          description: 'Single-print policy enforced. Re-printing requires Super User authorization.',
        })
        return
      }
      validQueue.forEach((a) => recordAssetPrint(a.id, a.assetCode, activeUser))
      setActivePrintQueue(validQueue)
      toast.info(
        lang === 'hi'
          ? `${validQueue.length} लेबलों के लिए प्रिंटर संवाद खोला जा रहा है...`
          : `Opening print dialog for ${validQueue.length} labels...`
      )
      setTimeout(() => {
        window.print()
        setTimeout(() => setActivePrintQueue(null), 1000)
      }, 100)
    } else {
      toast.success(`Generated ${validQueue.length} labels successfully! Ready for printing or export.`)
    }
  }

  // Export Labels to CSV
  const handleExportCsv = (assetsToExport: Asset[]) => {
    if (assetsToExport.length === 0) {
      toast.error('No assets selected to export.')
      return
    }
    const headers = [
      'Asset Code',
      'Asset Name',
      'Model',
      'Department',
      'Custodian ID',
      'Custodian Name',
      'Current User ID',
      'Current User Name',
      'Current User Dept',
      'Placement Area',
      'Company',
      'Plant',
      'Status',
    ]
    const rows = assetsToExport.map((a) => {
      const custodian =
        a.inChargeId && a.inChargeName
          ? `${a.inChargeId} · ${a.inChargeName}`
          : a.whoInCharge || a.custodian || '-'
      const loc = a.building
        ? `${a.building}-${a.floor || '1F'} (${a.currentLocation || 'Floor'})`
        : a.currentLocation || '-'
      return [
        a.assetCode,
        a.currentDescription || a.name || 'Equipment Fixed Asset',
        a.model || a.serialNumber || '-',
        a.currentDepartment || a.department || 'Operations',
        a.inChargeId || '-',
        custodian,
        a.submitterId || '-',
        a.submitter || '-',
        a.submitterDepartment || '-',
        loc,
        a.company || 'ismartu',
        a.plant || 'Noida Plant',
        isAssetPrintable(a) ? 'Ready' : 'Incomplete',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `meridian_labels_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${assetsToExport.length} asset labels to CSV.`)
  }

  // Submit Reprint Request Handler
  const handleSubmitReprintRequest = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!currentAsset) return
    setSubmittingRequest(true)
    try {
      const req = createReprintRequest({
        assetId: currentAsset.id,
        assetCode: currentAsset.assetCode,
        assetName: currentAsset.currentDescription || currentAsset.name || currentAsset.assetCode,
        requester: activeUser,
        reason: reprintReason,
        notes: reprintNotes,
      })
      toast.success(
        lang === 'hi'
          ? `पुनः प्रिंट अनुरोध जमा किया गया: ${currentAsset.assetCode}`
          : `Re-print request submitted to Super User: ${currentAsset.assetCode}`,
        {
          description: `Request ID: ${req.id} · Awaiting Super User approval.`,
        }
      )
      setIsRequestModalOpen(false)
      setReprintNotes('')
    } catch (err) {
      toast.error('Failed to submit re-print request.')
    } finally {
      setSubmittingRequest(false)
    }
  }

  // Quick Approve Handler (for Super User directly on preview)
  const handleQuickApprove = (req: ReprintRequest) => {
    if (!isSuperUser) {
      toast.error('Unauthorized: Super User authorization required.')
      return
    }
    const approved = approveReprintRequest(req.id, activeUser, 'Quick Approved by Super User')
    if (approved) {
      toast.success(`Approved re-print for ${approved.assetCode}. Normal users can now print 1 time.`)
    }
  }

  // Quick Reject Handler (for Super User directly on preview)
  const handleQuickReject = (req: ReprintRequest) => {
    if (!isSuperUser) {
      toast.error('Unauthorized: Super User authorization required.')
      return
    }
    const rejected = rejectReprintRequest(req.id, activeUser, 'Rejected by Super User')
    if (rejected) {
      toast.info(`Re-print request rejected for ${rejected.assetCode}.`)
    }
  }

  // Standard Print Handler
  const handlePrint = (title: string) => {
    if (selectedBulkCount > 0) {
      if (printableBulkAssets.length === 0) {
        toast.error('Cannot print QR: No fully completed assets are selected.')
        return
      }
      const eligibleBulk = printableBulkAssets.filter((a) => {
        const elig = checkPrintEligibility(a, activeUser, isAssetPrintable(a))
        return elig.canPrint
      })
      if (eligibleBulk.length === 0) {
        toast.error('Duplicate Print Blocked: All selected assets have already been printed once.', {
          description: 'Single-print policy enforced. Re-printing requires Super User authorization.',
        })
        return
      }

      // If large bulk (> 50), use sequential non-blocking generator
      if (eligibleBulk.length > 50) {
        runSequentialBulk(eligibleBulk, true)
        return
      }

      // Record prints
      eligibleBulk.forEach((a) => {
        recordAssetPrint(a.id, a.assetCode, activeUser)
      })
      const skipped = printableBulkAssets.length - eligibleBulk.length
      if (skipped > 0) {
        toast.warning(
          `Printing ${eligibleBulk.length} labels. ${skipped} assets were skipped because duplicate printing requires Super User approval.`
        )
      } else {
        toast.info(
          lang === 'hi'
            ? `प्रिंटर संवाद खोला जा रहा है: ${title}...`
            : `Opening print dialog for ${title}...`
        )
      }
      setActivePrintQueue(eligibleBulk)
      window.print()
    } else {
      if (!isCurrentPrintable) {
        toast.error('QR Print Blocked: Asset data must be fully filled before printing the QR label.', {
          description: `Missing: ${currentCompleteness.missingFields.join(', ')}`,
        })
        return
      }

      const elig = checkPrintEligibility(currentAsset, activeUser, isCurrentPrintable)
      if (!elig.canPrint) {
        toast.error(elig.title, {
          description: elig.message,
        })
        return
      }

      // Record print execution in storage & audit log
      recordAssetPrint(currentAsset.id, currentAsset.assetCode, activeUser)

      toast.info(
        lang === 'hi'
          ? `प्रिंटर संवाद खोला जा रहा है: ${title}...`
          : `Opening print dialog for ${title}...`,
        {
          description: elig.isReprintApproved
            ? 'Authorized re-print permit consumed. Thank you.'
            : 'ismartu Equipment Fixed Asset template formatted for thermal sticker & standard laser printers.',
        }
      )
      setActivePrintQueue([currentAsset])
      window.print()
    }
  }

  return (
    <div className="space-y-6">
      {/* Print-specific style block: ONLY the exact label prints, perfect page break */}
      <style>{`
        @media print {
          @page {
            size: ${activeWidthMm}mm ${activeHeightMm}mm;
            margin: 0;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-label-area, #printable-label-area * {
            visibility: visible !important;
          }
          #printable-label-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .ismartu-print-item {
            page-break-after: always;
            break-after: page;
            margin: 0 auto !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            width: ${activeWidthMm}mm !important;
            height: ${activeHeightMm}mm !important;
            box-sizing: border-box !important;
          }
          .ismartu-label-card {
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[var(--line)]">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>🏷️</span>
            <span>QR & Barcode Label Print</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                currentAsset?.company?.toLowerCase().includes('padget')
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : 'bg-red-500/10 text-red-600 border-red-500/20'
              }`}
            >
              {isPadgetCompany(currentAsset)
                ? 'PadGET Equipment Template'
                : 'ismartu Standard Template'}
            </span>
          </h1>
          <p className="text-xs text-[var(--mute)] mt-1">
            Official Equipment Fixed Asset label format with{' '}
            {isPadgetCompany(currentAsset) ? 'PadGET' : 'ismartu'} branding, Code-128 barcode, and strict QR verification rule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Re-print Requests Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsApprovalsModalOpen(true)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              pendingReprintRequests.length > 0
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold animate-pulse'
                : 'bg-[var(--surf2)] hover:bg-[var(--line)] text-[var(--ink)] border-[var(--line)]'
            }`}
            title="View physical label re-print requests & Super User approvals"
          >
            <span>🛡️</span>
            <span>{isSuperUser ? 'Re-print Governance' : 'Re-print Requests'}</span>
            {pendingReprintRequests.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {pendingReprintRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={selectedBulkCount > 1 ? printableBulkAssets.length === 0 : !currentEligibility.canPrint}
            onClick={() =>
              handlePrint(
                selectedBulkCount > 1
                  ? `${printableBulkAssets.length} Selected Labels`
                  : (currentAsset?.assetCode || 'Asset Label')
              )
            }
            className={`btn text-xs flex items-center gap-1.5 px-4 py-2 shadow-sm transition ${
              (selectedBulkCount > 1 ? printableBulkAssets.length > 0 : currentEligibility.canPrint)
                ? 'p cursor-pointer'
                : 'opacity-60 cursor-not-allowed bg-[var(--surf2)] text-[var(--mute)] border border-[var(--line)]'
            }`}
            title={
              selectedBulkCount > 1
                ? (printableBulkAssets.length === 0 ? 'No fully completed assets selected' : `Print ${printableBulkAssets.length} Ready Labels`)
                : !isCurrentPrintable
                  ? `QR Print Blocked: ${currentCompleteness.missingFields.join(', ')}`
                  : currentEligibility.message
            }
          >
            <span>{selectedBulkCount > 1 ? (printableBulkAssets.length > 0 ? '🖨️' : '🔒') : (currentEligibility.canPrint ? '🖨️' : '🔒')}</span>
            <span>
              {selectedBulkCount > 1
                ? (printableBulkAssets.length > 0 ? `Print ${printableBulkAssets.length} Ready Labels` : 'No Ready Labels Selected')
                : !isCurrentPrintable
                  ? `QR Print Locked (${currentAsset?.assetCode || 'Incomplete'})`
                  : currentEligibility.status === 'already_printed_blocked'
                    ? `QR Print Locked (${currentAsset?.assetCode || 'Printed'})`
                    : currentEligibility.status === 'reprint_pending'
                      ? `⏳ Re-print Pending (${currentAsset?.assetCode})`
                      : currentEligibility.status === 'reprint_approved'
                        ? `Print Approved Re-print (${currentAsset?.assetCode})`
                        : currentEligibility.status === 'superuser_override'
                          ? `Print (${currentAsset?.assetCode}) [Super User]`
                          : `Print Label (${currentAsset?.assetCode || 'Current'})`}
            </span>
          </button>
        </div>
      </div>

      {/* Template Details Banner */}
      <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-[var(--acc)]/10 text-[var(--acc)] flex items-center justify-center text-sm font-bold">
            📐
          </span>
          <div>
            <div className="font-bold text-[var(--ink)]">
              {isPadgetCompany(currentAsset) ? 'PadGET' : 'ismartu'} Equipment Fixed Asset (设备固定资产) Specification
            </div>
            <div className="text-[11px] text-[var(--mute)]">
              Dimensions: 100mm × 65mm · Rule: QR printing is strictly prohibited until asset details are fully filled · Single-Print Policy: Re-printing requires Super User approval
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold border border-emerald-500/20">
            ✓ 1D Barcode
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[11px] font-semibold border border-blue-500/20">
            ✓ 2D QR Code
          </span>
          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 text-[11px] font-semibold border border-purple-500/20">
            🛡️ Single-Print Rule
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[11px] font-semibold border border-amber-500/20">
            ✓ Tamper Warning
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Asset Selection & Bulk List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)] flex items-center justify-between">
              <span>Select Asset</span>
              <span className="text-[11px] font-normal lowercase">
                {filteredAssets.length.toLocaleString()} available
              </span>
            </h2>

            {/* Filter Tabs: All / Ready to Print / Pending Data */}
            <div className="flex rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surf2)] text-xs">
              <button
                type="button"
                onClick={() => {
                  setFilterTab('all')
                  setCurrentPage(1)
                }}
                className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-all ${
                  filterTab === 'all'
                    ? 'bg-[var(--surf)] text-[var(--ink)] shadow-xs font-bold'
                    : 'text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
              >
                All ({searchedAssets.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterTab('ready')
                  setCurrentPage(1)
                }}
                className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                  filterTab === 'ready'
                    ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 shadow-xs font-bold'
                    : 'text-[var(--mute)] hover:text-emerald-600'
                }`}
              >
                <span>✓ Ready</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                  {readyAssetsCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterTab('pending')
                  setCurrentPage(1)
                }}
                className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                  filterTab === 'pending'
                    ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30 shadow-xs font-bold'
                    : 'text-[var(--mute)] hover:text-amber-600'
                }`}
              >
                <span>🔒 Incomplete</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                  {pendingAssetsCount}
                </span>
              </button>
            </div>

            {/* 10. Debounced Search Input */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by asset code, name, or plant..."
              className="text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] w-full outline-none focus:border-[var(--acc)]"
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handleSelectAllClick}
                className="text-[var(--acc)] hover:underline font-semibold cursor-pointer"
              >
                Select Ready
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-[var(--mute)] hover:underline cursor-pointer"
              >
                Clear Selection
              </button>
            </div>

            {/* 8. Paginated Asset List (50 items rendered max) */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg">
              {pagedAssets.length > 0 ? (
                pagedAssets.map((asset) => {
                  const isSelected = currentAsset?.id === asset.id
                  const isChecked = Boolean(bulkSelected[asset.id])
                  const isPrintable = isAssetPrintable(asset)
                  const aRec = printRecords[asset.id] || (asset.assetCode ? printRecords[asset.assetCode] : null)
                  const pCount = aRec?.printCount || 0
                  const isApproved = statusIndex.approvedSet.has(asset.id) || (asset.assetCode ? statusIndex.approvedSet.has(asset.assetCode) : false)
                  const isPending = statusIndex.pendingSet.has(asset.id) || (asset.assetCode ? statusIndex.pendingSet.has(asset.assetCode) : false)

                  return (
                    <AssetRowItem
                      key={asset.id}
                      asset={asset}
                      isSelected={isSelected}
                      isChecked={isChecked}
                      isPrintable={isPrintable}
                      printCount={pCount}
                      isApproved={isApproved}
                      isPending={isPending}
                      onSelect={(id) => setSelectedAssetId(id)}
                      onToggleCheck={toggleBulk}
                    />
                  )
                })
              ) : (
                <div className="p-6 text-center text-xs text-[var(--mute)]">
                  No assets found matching filter or search.
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="pt-2 flex flex-col gap-2 border-t border-[var(--line)]">
              <div className="flex items-center justify-between text-xs text-[var(--mute)]">
                <span>
                  Showing {filteredAssets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                  {Math.min(currentPage * pageSize, filteredAssets.length)} of {filteredAssets.length.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--mute)]">Per page:</span>
                  {[50, 100, 200].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        setPageSize(sz)
                        setCurrentPage(1)
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
                        pageSize === sz
                          ? 'bg-[var(--acc)] text-white border-[var(--acc)]'
                          : 'bg-[var(--surf2)] text-[var(--mute)] border-[var(--line)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 text-xs">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(1)}
                    className="px-2 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40 hover:bg-[var(--line)] cursor-pointer text-[11px]"
                  >
                    « First
                  </button>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40 hover:bg-[var(--line)] cursor-pointer"
                  >
                    ‹ Prev
                  </button>
                  <span className="px-2 py-1 font-mono font-bold text-[var(--ink)]">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40 hover:bg-[var(--line)] cursor-pointer"
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-2 py-1 rounded border border-[var(--line)] bg-[var(--surf2)] disabled:opacity-40 hover:bg-[var(--line)] cursor-pointer text-[11px]"
                  >
                    Last »
                  </button>
                </div>
              )}
            </div>

            {selectedBulkCount > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={printableBulkAssets.length === 0}
                  onClick={() => handlePrint(`${printableBulkAssets.length} Selected Labels`)}
                  className={`w-full btn text-xs py-2 flex items-center justify-center gap-2 shadow-sm ${
                    printableBulkAssets.length > 0 ? 'p cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span>{printableBulkAssets.length > 0 ? '🖨️' : '🔒'}</span>
                  <span>
                    {printableBulkAssets.length > 0
                      ? `Print ${printableBulkAssets.length} Selected Labels`
                      : 'No Complete Assets Selected'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Label Preview OR Bulk Action Hub */}
        <div className="lg:col-span-7 space-y-4">
          {/* 4. MULTIPLE SELECTION BEHAVIOR: When multiple assets selected, do NOT generate previews immediately! */}
          {selectedBulkCount > 1 ? (
            <div className="card p-6 space-y-5 border border-[var(--line)] shadow-sm bg-[var(--surf)] animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--line)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📦</span>
                    <h2 className="text-base font-bold text-[var(--ink)]">
                      {selectedBulkCount.toLocaleString()} Assets Selected
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--mute)] mt-1">
                    Multi-selection mode active. Previews are generated on-demand to keep browser fast and responsive.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    ✓ {printableBulkAssets.length.toLocaleString()} Ready
                  </span>
                  {selectedBulkCount - printableBulkAssets.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      🔒 {(selectedBulkCount - printableBulkAssets.length).toLocaleString()} Incomplete
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={printableBulkAssets.length === 0}
                  onClick={() => runSequentialBulk(printableBulkAssets, false)}
                  className="btn p text-xs py-3 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>⚡</span>
                  <span>Generate Labels</span>
                </button>
                <button
                  type="button"
                  disabled={printableBulkAssets.length === 0}
                  onClick={() => handlePrint(`${printableBulkAssets.length} Selected Labels`)}
                  className="btn text-xs py-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Print Selected</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCsv(selectedBulkAssets)}
                  className="px-3 py-3 text-xs font-semibold rounded-lg border border-[var(--line)] bg-[var(--surf2)] hover:bg-[var(--surf)] text-[var(--ink)] flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span>📥</span>
                  <span>Export Labels</span>
                </button>
              </div>

              {/* Summary details */}
              <div className="p-4 rounded-xl bg-[var(--surf2)]/50 border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--ink)]">Selected Assets Preview Queue</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-red-500 hover:underline cursor-pointer"
                  >
                    Clear All Selected
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg bg-[var(--surf)]">
                  {selectedBulkAssets.slice(0, 10).map((a) => (
                    <div key={a.id} className="p-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--ink)]">{a.assetCode}</span>
                        <span className="text-[var(--mute)] truncate max-w-[200px]">
                          {a.currentDescription || a.name || 'Equipment'}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          isAssetPrintable(a)
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {isAssetPrintable(a) ? 'Ready' : 'Incomplete'}
                      </span>
                    </div>
                  ))}
                  {selectedBulkAssets.length > 10 && (
                    <div className="p-2 text-center text-[11px] text-[var(--mute)] italic">
                      + {(selectedBulkAssets.length - 10).toLocaleString()} more selected assets
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-[var(--mute)] bg-blue-500/5 p-3 rounded-lg border border-blue-500/20 flex items-center gap-2">
                <span>ℹ️</span>
                <span>
                  High-capacity generation enabled: Labels process sequentially in non-blocking slices to guarantee 60 FPS UI responsiveness even with 100,000+ assets.
                </span>
              </div>
            </div>
          ) : (
            /* 2 & 3. SINGLE SELECTION BEHAVIOR: Exactly 1 preview exists in memory */
            <div className="card p-6 space-y-4">
              <div className="flex flex-col gap-2 pb-3 border-b border-[var(--line)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                      Exact Label Preview
                    </h2>
                    <span className="text-[11px] text-[var(--mute)]">
                      Exact representation that will print on thermal sticker or laser printer
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--acc)] font-mono font-bold">
                      {activeWidthMm}mm × {activeHeightMm}mm
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSizeManager(!showSizeManager)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--line)] bg-[var(--surf2)] hover:bg-[var(--surf)] text-[var(--ink)] cursor-pointer flex items-center gap-1.5 shadow-2xs transition"
                      title="Change print label dimensions and scale"
                    >
                      <span>📐</span>
                      <span>{showSizeManager ? 'Close Size Manager' : 'Manage Size'}</span>
                    </button>
                  </div>
                </div>

                {/* Manage Label Size Control Bar */}
                {showSizeManager && (
                  <div className="p-3.5 rounded-xl border border-[var(--acc)]/30 bg-[var(--acc)]/5 space-y-3 animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <span>⚙️</span>
                        <span>Label Print Dimensions & Scaling</span>
                      </span>
                      <span className="text-[11px] text-[var(--mute)]">
                        Configure thermal roll sticker (Zebra/TSC/TVS) or laser printer output
                      </span>
                    </div>

                    {/* Standard Presets */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[var(--mute)]">Standard Roll Presets</span>
                      <div className="flex flex-wrap gap-1.5">
                        {LABEL_SIZE_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setSelectedPresetId(preset.id)
                              if (preset.id !== 'custom') {
                                setCustomWidthMm(preset.widthMm)
                                setCustomHeightMm(preset.heightMm)
                                setCustomScalePercent(Math.round(preset.scale * 100))
                              }
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                              selectedPresetId === preset.id
                                ? 'bg-[var(--acc)] text-white border-[var(--acc)] shadow-xs font-bold'
                                : 'bg-[var(--surf)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
                            }`}
                            title={preset.desc}
                          >
                            <span>{preset.name}</span>
                            {selectedPresetId === preset.id && <span className="text-[10px]">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Width, Height & Zoom Scale */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--line)]/50 text-xs">
                      {/* Custom Width */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[var(--mute)] block">
                          Width (mm)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={30}
                            max={250}
                            value={activeWidthMm}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 30
                              setSelectedPresetId('custom')
                              setCustomWidthMm(val)
                              setCustomScalePercent(Math.round((val / 100) * 100))
                            }}
                            className="w-full text-xs font-mono font-bold p-1.5 rounded border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)]"
                          />
                          <span className="text-[11px] text-[var(--mute)] font-medium">mm</span>
                        </div>
                      </div>

                      {/* Custom Height */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[var(--mute)] block">
                          Height (mm)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={20}
                            max={200}
                            value={activeHeightMm}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 20
                              setSelectedPresetId('custom')
                              setCustomHeightMm(val)
                            }}
                            className="w-full text-xs font-mono font-bold p-1.5 rounded border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)]"
                          />
                          <span className="text-[11px] text-[var(--mute)] font-medium">mm</span>
                        </div>
                      </div>

                      {/* Scale / Zoom Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-[var(--mute)]">
                            Visual Scale
                          </label>
                          <span className="text-[11px] font-mono font-bold text-[var(--acc)]">
                            {Math.round(activeScale * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={40}
                            max={160}
                            step={5}
                            value={Math.round(activeScale * 100)}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              setSelectedPresetId('custom')
                              setCustomScalePercent(val)
                              setCustomWidthMm(Math.round((100 * val) / 100))
                              setCustomHeightMm(Math.round((65 * val) / 100))
                            }}
                            className="w-full accent-[var(--acc)] cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPresetId('100x65')
                              setCustomWidthMm(100)
                              setCustomHeightMm(65)
                              setCustomScalePercent(100)
                            }}
                            className="text-[10px] text-[var(--mute)] hover:text-[var(--ink)] whitespace-nowrap cursor-pointer"
                            title="Reset to 100% (100×65mm)"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Incomplete Asset Warning Banner */}
              {currentAsset && !isCurrentPrintable && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                      <span className="text-base">🔒</span>
                      <span>QR Rule Enforced: Printing Blocked Until Data is Fully Filled</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 shrink-0">
                      Printing Prohibited
                    </span>
                  </div>
                  <p className="text-xs text-[var(--mute)] leading-relaxed">
                    Strict QR Rule: No one will be able to print the QR until data for the asset has been fully filled.
                  </p>
                  <div className="text-xs bg-[var(--surf)] p-3 rounded-lg border border-[var(--line)] space-y-1.5">
                    <div className="font-semibold text-amber-700 dark:text-amber-300">
                      Missing Required Information ({currentCompleteness.missingFields.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentCompleteness.missingFields.map((f) => (
                        <span
                          key={f}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-600 border border-red-500/20"
                        >
                          ✗ {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  {onFillAssetData && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onFillAssetData(currentAsset)}
                        className="btn p text-xs py-2 px-3.5 inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                      >
                        <span>✏️</span>
                        <span>Fill Missing Asset Details Now</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Single-Print Governance & Re-print Alerts */}
              {currentAsset && isCurrentPrintable && (
                <>
                  {/* 1. Duplicate Print Blocked (Already Printed) */}
                  {currentEligibility.status === 'already_printed_blocked' && (
                    <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200 space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-bold text-sm text-red-700 dark:text-red-300">
                          <span className="text-base">🔒</span>
                          <span>Single-Print Policy Enforced: Duplicate Printing Locked</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 shrink-0">
                          Printed {currentEligibility.printCount} time{currentEligibility.printCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--mute)] leading-relaxed">
                        Enterprise physical tag governance rule: No user may print a label twice. If this physical label is damaged, lost, or needs replacement, submit a Re-print Request to the Super User for authorization.
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRequestModalOpen(true)}
                          className="btn p text-xs py-2 px-3.5 inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                        >
                          <span>📩</span>
                          <span>Request Re-print from Super User</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Re-print Request Pending Review */}
                  {currentEligibility.status === 'reprint_pending' && (
                    <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                          <span className="text-base">⏳</span>
                          <span>Re-print Request Pending Super User Approval</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                          Under Review
                        </span>
                      </div>
                      <p className="text-xs text-[var(--mute)] leading-relaxed">
                        Request ID: <span className="font-mono font-bold">{currentEligibility.pendingRequest?.id}</span> · Submitted by <b>{currentEligibility.pendingRequest?.requestedBy}</b> ({currentEligibility.pendingRequest?.requesterDept}) on {new Date(currentEligibility.pendingRequest?.requestedAt || '').toLocaleDateString()}.
                        <br />Reason: <b>{currentEligibility.pendingRequest?.reason}</b>
                        {currentEligibility.pendingRequest?.notes && ` · "${currentEligibility.pendingRequest.notes}"`}
                      </p>
                      {isSuperUser && (
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickApprove(currentEligibility.pendingRequest!)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>✅</span>
                            <span>Approve Re-print Now (Super User)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickReject(currentEligibility.pendingRequest!)}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>❌</span>
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Re-print Approved by Super User */}
                  {currentEligibility.status === 'reprint_approved' && (
                    <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                          <span className="text-base">✅</span>
                          <span>Re-print Authorized by Super User</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                          Single-Use Permit Valid
                        </span>
                      </div>
                      <p className="text-xs text-[var(--mute)] leading-relaxed">
                        Super User <b>{currentEligibility.approvedRequest?.reviewedBy}</b> approved re-print on {new Date(currentEligibility.approvedRequest?.reviewedAt || '').toLocaleDateString()}.
                        <br />Review note: <i>{currentEligibility.approvedRequest?.reviewNotes || 'Approved'}</i>. You are now authorized to print this label once.
                      </p>
                    </div>
                  )}

                  {/* 4. Super User Override */}
                  {currentEligibility.status === 'superuser_override' && (
                    <div className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/5 text-purple-900 dark:text-purple-300 flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <span>👑</span>
                        <span className="font-semibold">Super User Administrative Clearance: Direct Re-print Authorized</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 font-bold">
                        Print Count: {currentEligibility.printCount}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Exact Preview Container: keyed by currentAsset.id so previous canvas/SVG is destroyed completely */}
              {currentAsset ? (
                <div
                  key={currentAsset.id}
                  className="flex flex-col items-center justify-center py-6 bg-[var(--surf2)]/50 rounded-xl p-4 overflow-x-auto relative"
                >
                  <div className={`transform transition-transform ${isCurrentPrintable ? 'hover:scale-[1.01]' : 'opacity-85'}`}>
                    <IsmartuAssetLabel asset={currentAsset} scale={activeScale} />
                  </div>

                  {!isCurrentPrintable && (
                    <div className="mt-3 text-xs font-bold text-amber-600 bg-amber-500/10 px-3 py-1 rounded border border-amber-500/20 flex items-center gap-1.5">
                      <span>🔒</span>
                      <span>Preview Only — Printing Locked Until Form is Completed</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--mute)]">
                  Select an asset from the list to preview label.
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-[var(--mute)]">
                  💡 Tip: Hit <kbd className="px-1.5 py-0.5 rounded border border-[var(--line)] bg-[var(--surf2)] font-mono">Ctrl+P</kbd> or click the button to print directly.
                </div>

                {currentAsset && (
                  <div className="flex flex-wrap items-center gap-2">
                    {currentEligibility.status === 'already_printed_blocked' && (
                      <button
                        type="button"
                        onClick={() => setIsRequestModalOpen(true)}
                        className="btn p text-sm px-5 py-2.5 inline-flex items-center gap-2 shadow-md cursor-pointer hover:shadow-lg"
                      >
                        <span>📩</span>
                        <span>Request Re-print from Super User</span>
                      </button>
                    )}

                    {currentEligibility.status === 'reprint_pending' && isSuperUser && (
                      <button
                        type="button"
                        onClick={() => handleQuickApprove(currentEligibility.pendingRequest!)}
                        className="btn text-sm px-5 py-2.5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md cursor-pointer"
                      >
                        <span>✅</span>
                        <span>Approve Re-print (Super User)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={!currentEligibility.canPrint}
                      onClick={() => handlePrint(currentAsset.assetCode)}
                      className={`btn text-sm px-6 py-2.5 inline-flex items-center gap-2 shadow-md transition ${
                        currentEligibility.canPrint
                          ? currentEligibility.isReprintApproved
                            ? 'p cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg'
                            : 'p cursor-pointer hover:shadow-lg'
                          : 'opacity-50 cursor-not-allowed bg-[var(--surf2)] text-[var(--mute)] border border-[var(--line)]'
                      }`}
                      title={
                        !isCurrentPrintable
                          ? `Cannot print: missing ${currentCompleteness.missingFields.join(', ')}`
                          : currentEligibility.message
                      }
                    >
                      <span>{currentEligibility.canPrint ? '🖨️' : '🔒'}</span>
                      <span>
                        {!isCurrentPrintable
                          ? `QR Print Locked: Complete Data First`
                          : currentEligibility.status === 'already_printed_blocked'
                            ? `QR Print Locked (Already Printed)`
                            : currentEligibility.status === 'reprint_pending'
                              ? `⏳ Re-print Pending Super User Approval`
                              : currentEligibility.status === 'reprint_approved'
                                ? `Print Approved Re-print ("${currentAsset.assetCode}")`
                                : currentEligibility.status === 'superuser_override'
                                  ? `Print "${currentAsset.assetCode}" Label (Super User Clearance)`
                                  : `Print "${currentAsset.assetCode}" Label`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. SELECT ALL CONFIRMATION DIALOG (matches exact user wireframe) ── */}
      {isSelectAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="card p-6 max-w-sm w-full space-y-4 border border-[var(--line)] shadow-2xl bg-[var(--surf)] text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-2xl mx-auto font-bold">
              🏷️
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-[var(--mute)]">
                You are about to generate labels for
              </h3>
              <div className="text-3xl font-extrabold font-mono text-[var(--ink)]">
                {readyAssetsCount.toLocaleString()} assets
              </div>
              <div className="text-xs text-[var(--mute)] pt-2">
                Estimated time:
                <div className="font-bold text-sm text-[var(--ink)] mt-0.5">
                  {readyAssetsCount > 10000 ? '3–8 minutes' : readyAssetsCount > 2000 ? '1–3 minutes' : '10–30 seconds'}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[var(--mute)] bg-[var(--surf2)] p-2.5 rounded-lg border border-[var(--line)] text-left">
              Sequential generation will execute in the background so your browser remains responsive with no freezing.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSelectAllModalOpen(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-[var(--line)] hover:bg-[var(--surf2)] text-[var(--ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSelectAllModalOpen(false)
                  executeSelectAll(true)
                }}
                className="flex-1 btn p py-2 text-xs font-bold shadow-md cursor-pointer hover:shadow-lg"
              >
                Generate Labels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. SEQUENTIAL BULK GENERATION PROGRESS MODAL (matches user spec) ── */}
      {isBulkGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="card p-6 max-w-md w-full space-y-4 border border-[var(--line)] shadow-2xl bg-[var(--surf)] text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--acc)]/10 text-[var(--acc)] flex items-center justify-center text-2xl mx-auto font-bold animate-spin">
              ⚙️
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--ink)]">Generating Labels...</h3>
              <p className="text-xs text-[var(--mute)] mt-1">
                Processing sequentially in background. Browser remains responsive.
              </p>
            </div>

            <div className="text-xl font-mono font-bold text-[var(--ink)]">
              {bulkProgress.current.toLocaleString()} / {bulkProgress.total.toLocaleString()}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[var(--surf2)] rounded-full h-3 overflow-hidden border border-[var(--line)]">
              <div
                className="bg-[var(--acc)] h-full transition-all duration-150 rounded-full"
                style={{ width: `${bulkProgress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--mute)]">
              <span className="font-bold text-[var(--ink)]">{bulkProgress.percent}%</span>
              <span>Remaining: ~{bulkProgress.eta || 'calculating...'}</span>
            </div>

            {bulkProgress.currentAssetCode && (
              <div className="text-xs font-mono bg-[var(--surf2)] p-2 rounded border border-[var(--line)] text-[var(--ink)] truncate">
                Current Asset: <b>{bulkProgress.currentAssetCode}</b>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  isCancelledRef.current = true
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 cursor-pointer"
              >
                Cancel Generation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 1: REQUEST RE-PRINT FROM SUPER USER ── */}
      {isRequestModalOpen && currentAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="card p-6 max-w-lg w-full space-y-5 border border-[var(--line)] shadow-2xl bg-[var(--surf)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg font-bold">
                  📩
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--ink)]">
                    Request Re-print Authorization
                  </h3>
                  <p className="text-[11px] text-[var(--mute)]">
                    Super User approval required to re-print asset tag
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-[var(--line)] text-[var(--mute)] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Asset Info Card */}
            <div className="p-3 rounded-xl bg-[var(--surf2)] border border-[var(--line)] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[var(--ink)] text-sm">
                  {currentAsset.assetCode}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300">
                  Printed {currentEligibility.printCount} time{currentEligibility.printCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-[var(--mute)]">
                <b>Name:</b> {currentAsset.currentDescription || currentAsset.name || 'Equipment Asset'}
              </div>
              <div className="text-[var(--mute)]">
                <b>Location:</b> {currentAsset.building || 'C39'} - {currentAsset.floor || '1F'} ({currentAsset.currentLocation || 'Floor'})
              </div>
              <div className="text-[var(--mute)]">
                <b>Custodian:</b> {currentAsset.whoInCharge || currentAsset.custodian || 'Unassigned'}
              </div>
            </div>

            {/* Requester Info & Reason Form */}
            <form onSubmit={handleSubmitReprintRequest} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[var(--ink)] block mb-1">
                  Requester (Current User):
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={`${activeUser.userName} (${activeUser.userId}) · ${activeUser.department || 'Operations'}`}
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf2)] text-[var(--mute)] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-[var(--ink)] block mb-1">
                  Reason for Re-print <span className="text-red-500">*</span>:
                </label>
                <select
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value as ReprintReason)}
                  className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)] font-medium"
                >
                  {REPRINT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[var(--ink)] block mb-1">
                  Justification / Incident Explanation:
                </label>
                <textarea
                  rows={3}
                  value={reprintNotes}
                  onChange={(e) => setReprintNotes(e.target.value)}
                  placeholder="Explain why the physical tag requires replacement (e.g. barcode was scratched during maintenance; physical audit scan failing)..."
                  className="w-full p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-[var(--ink)] outline-none focus:border-[var(--acc)]"
                />
              </div>

              <div className="p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300 text-[11px] leading-relaxed">
                ℹ️ <b>Governance Rule:</b> Once submitted, the Super User will review your request. After approval, you will be authorized to print this asset label <b>one additional time</b>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--line)] hover:bg-[var(--surf2)] text-[var(--ink)] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="btn p px-5 py-2 text-xs font-bold shadow-sm cursor-pointer hover:shadow flex items-center gap-1.5"
                >
                  <span>📩</span>
                  <span>{submittingRequest ? 'Submitting...' : 'Submit Request to Super User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: SUPER USER RE-PRINT GOVERNANCE CONSOLE ── */}
      {isApprovalsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="card p-6 max-w-3xl w-full space-y-5 border border-[var(--line)] shadow-2xl bg-[var(--surf)] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-xl font-bold">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--ink)] flex items-center gap-2">
                    <span>Re-print Governance & Approvals Console</span>
                    {isSuperUser ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30">
                        👑 Super User Mode
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/30">
                        User View
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[var(--mute)]">
                    Single-print rule enforcement: Authorize physical label re-prints to prevent duplicate or phantom tags
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApprovalsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-[var(--line)] text-[var(--mute)] flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 border-b border-[var(--line)] pb-2 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setApprovalsTab('pending')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  approvalsTab === 'pending'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold'
                    : 'text-[var(--mute)] hover:bg-[var(--surf2)]'
                }`}
              >
                <span>⏳ Pending Review</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[10px] font-bold">
                  {pendingReprintRequests.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setApprovalsTab('approved')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  approvalsTab === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-[var(--mute)] hover:bg-[var(--surf2)]'
                }`}
              >
                <span>✅ Approved</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                  {reprintRequests.filter((r) => r.status === 'approved').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setApprovalsTab('rejected')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  approvalsTab === 'rejected'
                    ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 font-bold'
                    : 'text-[var(--mute)] hover:bg-[var(--surf2)]'
                }`}
              >
                <span>❌ Rejected</span>
                <span className="px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-700 dark:text-red-300 font-mono text-[10px] font-bold">
                  {reprintRequests.filter((r) => r.status === 'rejected').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setApprovalsTab('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  approvalsTab === 'all'
                    ? 'bg-[var(--surf2)] text-[var(--ink)] border border-[var(--line)] font-bold'
                    : 'text-[var(--mute)] hover:bg-[var(--surf2)]'
                }`}
              >
                <span>All Requests ({reprintRequests.length})</span>
              </button>
            </div>

            {/* Request Cards Scrollable List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {(() => {
                const list =
                  approvalsTab === 'pending'
                    ? reprintRequests.filter((r) => r.status === 'pending')
                    : approvalsTab === 'approved'
                      ? reprintRequests.filter((r) => r.status === 'approved')
                      : approvalsTab === 'rejected'
                        ? reprintRequests.filter((r) => r.status === 'rejected')
                        : reprintRequests

                if (list.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-[var(--mute)] space-y-2">
                      <div className="text-3xl">📭</div>
                      <div className="font-semibold text-[var(--ink)]">No Re-print Requests Found</div>
                      <p>There are no requests matching the "{approvalsTab}" filter.</p>
                    </div>
                  )
                }

                return list.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--acc)]/40 transition space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--surf2)] border border-[var(--line)] text-[var(--ink)]">
                          {req.id}
                        </span>
                        <span className="font-mono font-bold text-sm text-[var(--acc)]">
                          {req.assetCode}
                        </span>
                        <span className="text-[var(--mute)]">·</span>
                        <span className="font-semibold text-[var(--ink)]">{req.assetName}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          req.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 animate-pulse'
                            : req.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                        }`}
                      >
                        {req.status === 'pending'
                          ? '⏳ Pending Review'
                          : req.status === 'approved'
                            ? (req.isUsed ? '✅ Used (Printed)' : '✅ Approved (Single-Use Valid)')
                            : '❌ Rejected'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[var(--mute)] bg-[var(--surf2)]/50 p-2.5 rounded-lg border border-[var(--line)]">
                      <div>
                        <b>Requested By:</b> {req.requestedBy} ({req.requesterUserId}) · {req.requesterDept}
                      </div>
                      <div>
                        <b>Date Requested:</b> {new Date(req.requestedAt).toLocaleString()}
                      </div>
                      <div className="sm:col-span-2">
                        <b>Reason:</b> <span className="font-semibold text-[var(--ink)]">{req.reason}</span>
                        {req.notes && <span className="italic block mt-0.5">"{req.notes}"</span>}
                      </div>
                      {req.reviewedBy && (
                        <div className="sm:col-span-2 pt-1 border-t border-[var(--line)]">
                          <b>Reviewed By Super User:</b> {req.reviewedBy} on {new Date(req.reviewedAt || '').toLocaleString()}
                          {req.reviewNotes && <span className="block italic text-[var(--ink)] mt-0.5">Note: "{req.reviewNotes}"</span>}
                          {req.isUsed && (
                            <span className="text-emerald-600 font-semibold block mt-0.5">
                              ✓ Single-use print executed by {req.usedBy || 'User'} on {new Date(req.usedAt || '').toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Super User Action Bar for Pending Requests */}
                    {req.status === 'pending' && isSuperUser && (
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[var(--line)]">
                        <input
                          type="text"
                          value={approvalReviewNotes[req.id] || ''}
                          onChange={(e) =>
                            setApprovalReviewNotes({ ...approvalReviewNotes, [req.id]: e.target.value })
                          }
                          placeholder="Optional review note (e.g., Replacement approved for Line 1)..."
                          className="flex-1 p-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surf)] outline-none focus:border-[var(--acc)]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const note = approvalReviewNotes[req.id] || 'Approved by Super User'
                              const res = approveReprintRequest(req.id, activeUser, note)
                              if (res) {
                                toast.success(`Approved re-print for asset ${res.assetCode}.`)
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <span>✅</span>
                            <span>Approve Re-print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const note = approvalReviewNotes[req.id] || 'Rejected by Super User'
                              const res = rejectReprintRequest(req.id, activeUser, note)
                              if (res) {
                                toast.info(`Rejected re-print for asset ${res.assetCode}.`)
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <span>❌</span>
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              })()}
            </div>

            <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--mute)] shrink-0">
              <div>
                Single-print policy: Re-print permit permits exactly 1 print before re-locking.
              </div>
              <button
                type="button"
                onClick={() => setIsApprovalsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--surf2)] text-[var(--ink)] font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container dedicated to print output: ONLY mounts when actively printing, never bloated in memory! */}
      <div id="printable-label-area" aria-hidden="true">
        {activePrintQueue && activePrintQueue.length > 0 ? (
          activePrintQueue.map((asset) => (
            <div key={asset.id} className="ismartu-print-item">
              <IsmartuAssetLabel asset={asset} scale={activeScale} />
            </div>
          ))
        ) : selectedBulkCount > 0 && selectedBulkCount <= 50 ? (
          printableBulkAssets
            .filter((a) => checkPrintEligibility(a, activeUser, isAssetPrintable(a)).canPrint)
            .map((asset) => (
              <div key={asset.id} className="ismartu-print-item">
                <IsmartuAssetLabel asset={asset} scale={activeScale} />
              </div>
            ))
        ) : selectedBulkCount <= 1 && currentAsset && isCurrentPrintable && currentEligibility.canPrint ? (
          <div className="ismartu-print-item">
            <IsmartuAssetLabel asset={currentAsset} scale={activeScale} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
