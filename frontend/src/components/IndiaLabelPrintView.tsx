import * as React from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import type { Asset } from '@/types/asset'
import { checkAssetDataCompleteness, isAssetPrintable } from '@/types/asset'
import type { Language } from '@/lib/indiaLocale'
import { toast } from 'sonner'
import { getCompanyLogo } from '@/assets/companyLogos'

interface IndiaLabelPrintViewProps {
  assets: Asset[]
  lang: Language
  onFillAssetData?: (asset: Asset) => void
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
function BarcodeSvg({ value, height = 44 }: { value: string; height?: number }) {
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
}

// 2D QR Code SVG Component with ISO/IEC 18004 standards-compliant matrix scannable by all mobile cameras and barcode readers
function QrCodeSvg({
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
}

// The Exact Template Component requested by the user
export function IsmartuAssetLabel({ asset, scale = 1 }: { asset: Asset; scale?: number }) {
  // 1. Asset Code
  const assetCode = asset.assetCode || '-'

  // Company Logo resolver (ismartu vs PadGET based on selected asset company)
  const logoInfo = React.useMemo(() => getCompanyLogo(asset.company), [asset.company])

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
  
  // 3. Model: serial number or category filled in asset
  const model = asset.serialNumber?.trim() || asset.currentCategory?.trim() || asset.category?.trim() || '-'

  // 4. Department: real department filled in asset
  const dept = asset.currentDepartment?.trim() || asset.department?.trim() || ''
  const bldg = asset.building?.trim() || ''
  const departmentDisplay = dept
    ? (bldg && !dept.includes(bldg) ? `${bldg}-${dept}` : dept)
    : (bldg || '-')

  // 5. Custodian: User requested "add emp ID" -> display Employee ID and Name
  const custodianDisplay = React.useMemo(() => {
    const empId = asset.inChargeId?.trim()
    const name = asset.inChargeName?.trim() || asset.custodian?.trim() || asset.submitter?.trim()
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
  }, [asset])

  // 6. Placement Area: real building and floor / location
  const placementArea = React.useMemo(() => {
    const bldg = asset.building?.trim() || ''
    const flr = asset.floor?.trim() || ''
    const loc = asset.currentLocation?.trim() || ''

    if (bldg && flr) {
      const cleanFloor = flr.replace(/floor/i, '').replace(/st|nd|rd|th/g, '').trim()
      const floorStr = cleanFloor.toLowerCase().endsWith('f') ? cleanFloor : `${cleanFloor}F`
      const base = `${bldg}-${floorStr}`
      return loc && !loc.includes(base) ? `${base} (${loc})` : base
    }
    if (loc) return loc
    if (bldg) return bldg
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

  // Exactly 6 rows (Row 7 "Purchase Date" removed per user annotation)
  const rows = [
    { label: '资产编号/Asset No.', value: assetCode, isCode: true },
    { label: '资产名称/Asset Name', value: assetName },
    { label: '设备型号/Model', value: model },
    { label: '使用部门/Department', value: departmentDisplay },
    { label: '责任人/Custodian', value: custodianDisplay },
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

      {/* 2. Middle Table: 7 Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              borderBottom: idx === rows.length - 1 ? '2px solid #000000' : '1.5px solid #000000',
              minHeight: `${29 * scale}px`,
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            {/* Left Label Column */}
            <div
              style={{
                width: '38%',
                borderRight: '1.5px solid #000000',
                padding: `${3 * scale}px ${10 * scale}px`,
                fontSize: `${12 * scale}px`,
                fontWeight: 800,
                color: '#000000',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
                boxSizing: 'border-box',
              }}
            >
              {row.label}
            </div>

            {/* Right Value Column */}
            <div
              style={{
                width: '62%',
                padding: `${3 * scale}px ${12 * scale}px`,
                fontSize: row.isCode ? `${16 * scale}px` : `${13 * scale}px`,
                fontWeight: 800,
                color: '#000000',
                lineHeight: 1.3,
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
}

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

export function IndiaLabelPrintView({ assets, lang, onFillAssetData }: IndiaLabelPrintViewProps) {
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

  const [search, setSearch] = React.useState('')
  const [filterTab, setFilterTab] = React.useState<'all' | 'ready' | 'pending'>('all')
  const [bulkSelected, setBulkSelected] = React.useState<Record<string, boolean>>({})

  // Compute counts
  const readyAssetsCount = React.useMemo(() => assets.filter(isAssetPrintable).length, [assets])
  const pendingAssetsCount = assets.length - readyAssetsCount

  const searchedAssets = React.useMemo(() => {
    if (!search.trim()) return assets
    const q = search.toLowerCase()
    return assets.filter(
      (a) =>
        a.assetCode.toLowerCase().includes(q) ||
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
  }, [assets, search])

  const filteredAssets = React.useMemo(() => {
    if (filterTab === 'ready') return searchedAssets.filter(isAssetPrintable)
    if (filterTab === 'pending') return searchedAssets.filter((a) => !isAssetPrintable(a))
    return searchedAssets
  }, [searchedAssets, filterTab])

  const currentAsset = assets.find((a) => a.id === selectedAssetId) || filteredAssets[0] || assets[0]

  const currentCompleteness = React.useMemo(
    () => checkAssetDataCompleteness(currentAsset),
    [currentAsset]
  )
  const isCurrentPrintable = currentCompleteness.isFullyFilled

  const toggleBulk = (asset: Asset) => {
    if (!isAssetPrintable(asset)) {
      toast.error(`Cannot select ${asset.assetCode} for printing: Asset data is not fully filled.`, {
        description: `Missing: ${checkAssetDataCompleteness(asset).missingFields.join(', ')}`,
      })
      return
    }
    setBulkSelected((prev) => ({ ...prev, [asset.id]: !prev[asset.id] }))
  }

  const selectAll = () => {
    const all: Record<string, boolean> = {}
    const printableInList = filteredAssets.filter(isAssetPrintable)
    printableInList.forEach((a) => {
      all[a.id] = true
    })
    setBulkSelected(all)
    if (printableInList.length === 0) {
      toast.info('No fully filled assets available in the current view to select.')
    } else {
      toast.success(`Selected ${printableInList.length} fully filled assets for printing.`)
    }
  }

  const clearAll = () => {
    setBulkSelected({})
  }

  const selectedBulkCount = Object.values(bulkSelected).filter(Boolean).length
  const selectedBulkAssets = React.useMemo(() => {
    return assets.filter((a) => bulkSelected[a.id])
  }, [assets, bulkSelected])

  const printableBulkAssets = React.useMemo(() => {
    return selectedBulkAssets.filter(isAssetPrintable)
  }, [selectedBulkAssets])

  const handlePrint = (title: string) => {
    if (selectedBulkCount > 0) {
      if (printableBulkAssets.length === 0) {
        toast.error('Cannot print QR: No fully completed assets are selected.')
        return
      }
    } else {
      if (!isCurrentPrintable) {
        toast.error('QR Print Blocked: Asset data must be fully filled before printing the QR label.', {
          description: `Missing: ${currentCompleteness.missingFields.join(', ')}`,
        })
        return
      }
    }

    toast.info(
      lang === 'hi'
        ? `प्रिंटर संवाद खोला जा रहा है: ${title}...`
        : `Opening print dialog for ${title}...`,
      {
        description:
          'ismartu Equipment Fixed Asset template formatted for thermal sticker & standard laser printers.',
      }
    )
    window.print()
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
              {currentAsset?.company?.toLowerCase().includes('padget')
                ? 'PadGET Equipment Template'
                : 'ismartu Standard Template'}
            </span>
          </h1>
          <p className="text-xs text-[var(--mute)] mt-1">
            Official Equipment Fixed Asset label format with{' '}
            {currentAsset?.company?.toLowerCase().includes('padget') ? 'PadGET' : 'ismartu'} branding, Code-128 barcode, and strict QR verification rule.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={selectedBulkCount > 0 ? printableBulkAssets.length === 0 : !isCurrentPrintable}
            onClick={() =>
              handlePrint(
                selectedBulkCount > 0
                  ? `${printableBulkAssets.length} Selected Labels`
                  : (currentAsset?.assetCode || 'Asset Label')
              )
            }
            className={`btn text-xs flex items-center gap-1.5 px-4 py-2 shadow-sm transition ${
              (selectedBulkCount > 0 ? printableBulkAssets.length > 0 : isCurrentPrintable)
                ? 'p cursor-pointer'
                : 'opacity-60 cursor-not-allowed bg-[var(--surf2)] text-[var(--mute)] border border-[var(--line)]'
            }`}
            title={
              selectedBulkCount > 0
                ? (printableBulkAssets.length === 0 ? 'No fully completed assets selected' : `Print ${printableBulkAssets.length} Ready Labels`)
                : isCurrentPrintable
                  ? `Print "${currentAsset?.assetCode}" Label`
                  : `QR Print Blocked: ${currentCompleteness.missingFields.join(', ')}`
            }
          >
            <span>{selectedBulkCount > 0 ? (printableBulkAssets.length > 0 ? '🖨️' : '🔒') : (isCurrentPrintable ? '🖨️' : '🔒')}</span>
            <span>
              {selectedBulkCount > 0
                ? (printableBulkAssets.length > 0 ? `Print ${printableBulkAssets.length} Ready Labels` : 'No Ready Labels Selected')
                : isCurrentPrintable
                  ? `Print Label (${currentAsset?.assetCode || 'Current'})`
                  : `QR Print Locked (${currentAsset?.assetCode || 'Incomplete'})`}
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
              {currentAsset?.company?.toLowerCase().includes('padget') ? 'PadGET' : 'ismartu'} Equipment Fixed Asset (设备固定资产) Specification
            </div>
            <div className="text-[11px] text-[var(--mute)]">
              Dimensions: 100mm × 65mm · Rule: QR printing is strictly prohibited until asset details are fully filled
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold border border-emerald-500/20">
            ✓ 1D Barcode
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[11px] font-semibold border border-blue-500/20">
            ✓ 2D QR Code
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
                {filteredAssets.length} available
              </span>
            </h2>

            {/* Filter Tabs: All / Ready to Print / Pending Data */}
            <div className="flex rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surf2)] text-xs">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
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
                onClick={() => setFilterTab('ready')}
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
                onClick={() => setFilterTab('pending')}
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
                onClick={selectAll}
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

            <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const isSelected = currentAsset?.id === asset.id
                  const isChecked = Boolean(bulkSelected[asset.id])
                  const isPrintable = isAssetPrintable(asset)
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
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
                          toggleBulk(asset)
                        }}
                        title={isPrintable ? 'Select for QR print' : 'Cannot select: asset data is incomplete'}
                        className={`rounded ${isPrintable ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono font-bold text-[var(--ink)] flex items-center gap-2 truncate">
                          <span>{asset.assetCode}</span>
                          {isPrintable ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                              ✓ Ready
                            </span>
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
              ) : (
                <div className="p-6 text-center text-xs text-[var(--mute)]">
                  No assets found matching filter or search.
                </div>
              )}
            </div>

            {selectedBulkCount > 0 && (
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
            )}
          </div>
        </div>

        {/* Right Column: Live Label Preview */}
        <div className="lg:col-span-7 space-y-4">
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

            {currentAsset ? (
              <div className="flex flex-col items-center justify-center py-6 bg-[var(--surf2)]/50 rounded-xl p-4 overflow-x-auto relative">
                {/* Visual Label Presentation */}
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
                <button
                  type="button"
                  disabled={!isCurrentPrintable}
                  onClick={() => handlePrint(currentAsset.assetCode)}
                  className={`btn text-sm px-6 py-2.5 inline-flex items-center gap-2 shadow-md transition ${
                    isCurrentPrintable
                      ? 'p cursor-pointer hover:shadow-lg'
                      : 'opacity-50 cursor-not-allowed bg-[var(--surf2)] text-[var(--mute)] border border-[var(--line)]'
                  }`}
                  title={
                    isCurrentPrintable
                      ? `Print "${currentAsset.assetCode}" Label`
                      : `Cannot print: missing ${currentCompleteness.missingFields.join(', ')}`
                  }
                >
                  <span>{isCurrentPrintable ? '🖨️' : '🔒'}</span>
                  <span>
                    {isCurrentPrintable
                      ? `Print "${currentAsset.assetCode}" Label`
                      : `QR Print Locked: Complete Data First`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden container dedicated to print output: ONLY fully filled assets are rendered! */}
      <div id="printable-label-area" aria-hidden="true">
        {selectedBulkCount > 0 ? (
          printableBulkAssets.map((asset) => (
            <div key={asset.id} className="ismartu-print-item">
              <IsmartuAssetLabel asset={asset} scale={activeScale} />
            </div>
          ))
        ) : currentAsset && isCurrentPrintable ? (
          <div className="ismartu-print-item">
            <IsmartuAssetLabel asset={currentAsset} scale={activeScale} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
