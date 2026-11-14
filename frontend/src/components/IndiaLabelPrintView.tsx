import * as React from 'react'
import QRCode from 'qrcode'
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

// 1D Barcode SVG Component with Code-128 style representation
function BarcodeSvg({ value, height = 38 }: { value: string; height?: number }) {
  const bars = React.useMemo(() => {
    const chars = value || '2004218'
    const pattern: number[] = [2, 1, 1, 2] // start pattern
    for (let i = 0; i < chars.length; i++) {
      const code = chars.charCodeAt(i)
      pattern.push(
        (code % 3) + 1,
        ((code >> 2) % 2) + 1,
        ((code >> 4) % 3) + 1,
        1
      )
    }
    pattern.push(2, 1, 2, 3, 2) // stop pattern
    return pattern
  }, [value])

  let currentX = 4
  const rects: React.ReactNode[] = []
  bars.forEach((width, idx) => {
    if (idx % 2 === 0) {
      rects.push(
        <rect
          key={idx}
          x={currentX}
          y="0"
          width={width * 1.6}
          height={height}
          fill="#000000"
        />
      )
    }
    currentX += width * 1.6
  })

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${currentX + 4} ${height}`}
      preserveAspectRatio="none"
      className="block"
      aria-label={`Barcode for ${value}`}
    >
      {rects}
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
            padding: `${5 * scale}px ${12 * scale}px`,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: '94%', height: `${44 * scale}px` }}>
            <BarcodeSvg value={asset.assetCode || '2004218'} height={Math.round(44 * scale)} />
          </div>
          <div
            style={{
              fontSize: `${14 * scale}px`,
              fontWeight: 800,
              letterSpacing: '2px',
              fontFamily: 'monospace, "Arial", sans-serif',
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
            padding: `${5 * scale}px ${12 * scale}px`,
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

export function IndiaLabelPrintView({ assets, lang, onFillAssetData }: IndiaLabelPrintViewProps) {
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
            size: auto;
            margin: 6mm;
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
            margin: 0 auto 20px auto !important;
            display: flex !important;
            justify-content: center !important;
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
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                  Exact Label Preview
                </h2>
                <span className="text-[11px] text-[var(--mute)]">
                  Exact representation that will print on thermal sticker or laser printer
                </span>
              </div>
              <span className="text-xs text-[var(--acc)] font-mono font-bold">
                100mm × 65mm
              </span>
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
                  <IsmartuAssetLabel asset={currentAsset} scale={1} />
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
              <IsmartuAssetLabel asset={asset} scale={1} />
            </div>
          ))
        ) : currentAsset && isCurrentPrintable ? (
          <div className="ismartu-print-item">
            <IsmartuAssetLabel asset={currentAsset} scale={1} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
