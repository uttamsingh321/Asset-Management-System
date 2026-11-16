import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IndiaLabelPrintView, IsmartuAssetLabel } from '@/components/IndiaLabelPrintView'
import type { Asset } from '@/types/asset'

const sampleAsset: Asset = {
  id: 'asset-2004218',
  assetCode: '2004218',
  serialNumber: 'SN-998822',
  name: 'Dell Precision Workstation',
  currentDescription: 'Dell Precision Workstation',
  currentCategory: 'Workstations',
  department: 'SMT Operations',
  currentDepartment: 'SMT Operations',
  inChargeId: 'EMP-102',
  inChargeName: 'Rajesh Kumar',
  whoInCharge: 'EMP-102 · Rajesh Kumar',
  building: 'C39',
  floor: '2F',
  currentLocation: 'Bay 14 Desk 4A',
  purchaseDate: '2026-01-01',
  date: '2026-01-01',
  status: 'Completed',
  plant: 'Noida Central Plant',
  company: 'IIPL',
  assetTag: '2004218',
  category: 'IT Hardware',
  assetCondition: 'Operational - Excellent',
  purchaseCost: 50000,
  currentValue: 45000,
  submitter: 'Arbind Kumar Singh',
  submitterId: '19102709',
  submitterDepartment: 'SMT Operations',
  assignedTo: 'Rajesh Kumar',
  location: 'C39-2F',
}

describe('ismartu Equipment Fixed Asset QR Label Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('renders exact ismartu template layout with real asset data, employee ID on Custodian, and no Purchase Date row', () => {
    render(<IsmartuAssetLabel asset={sampleAsset} />)

    // 1. ismartu branding logo
    expect(screen.getByText('smartu')).toBeInTheDocument()

    // 2. Bilingual header
    expect(screen.getByText('设备固定资产')).toBeInTheDocument()
    expect(screen.getByText('Equipment Fixed Asset')).toBeInTheDocument()

    // 3. Exact 6 Bilingual Rows with real asset data
    expect(screen.getByText('资产编号/Asset No.')).toBeInTheDocument()
    expect(screen.getAllByText('2004218').length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('资产名称/Asset Name')).toBeInTheDocument()
    expect(screen.getByText('Dell Precision Workstation')).toBeInTheDocument()

    expect(screen.getByText('设备型号/Model')).toBeInTheDocument()
    expect(screen.getByText('SN-998822')).toBeInTheDocument()

    expect(screen.getByText('使用部门/Department')).toBeInTheDocument()
    expect(screen.getByText('SMT Operations')).toBeInTheDocument()

    // Custodian includes Employee ID: EMP-102 · Rajesh Kumar (Real Owner)
    expect(screen.getByText('责任人/Custodian')).toBeInTheDocument()
    expect(screen.getByText('EMP-102 · Rajesh Kumar')).toBeInTheDocument()

    // Current User includes Submitter Employee ID, Name, and Dept
    expect(screen.getByText('使用人/Current User')).toBeInTheDocument()
    expect(screen.getByText('19102709 · Arbind Kumar Singh (SMT Operations)')).toBeInTheDocument()

    expect(screen.getByText('放置区域/Placement Area')).toBeInTheDocument()
    expect(screen.getByText('C39-2F (Bay 14 Desk 4A)')).toBeInTheDocument()

    // Purchase Date row has been removed per user instruction
    expect(screen.queryByText('购置日期/Purchase Date')).not.toBeInTheDocument()

    // 4. Barcode and QR code sections with tamper warning
    expect(screen.getByLabelText(/Barcode for 2004218/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/QR Code for 2004218/i)).toBeInTheDocument()
    expect(screen.getByText('禁止撕毁涂改')).toBeInTheDocument()
    expect(screen.getByText('Do not tear or alter.')).toBeInTheDocument()
  })

  it('renders live preview in IndiaLabelPrintView and triggers window.print when clicking Print Label', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    render(<IndiaLabelPrintView assets={[sampleAsset]} lang="en" />)

    // Live preview contains the exact template
    expect(screen.getByText('Exact Label Preview')).toBeInTheDocument()
    expect(screen.getAllByText('设备固定资产').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Equipment Fixed Asset').length).toBeGreaterThanOrEqual(1)

    // Print button triggers window.print()
    const printBtn = screen.getByRole('button', { name: /Print "2004218" Label/i })
    expect(printBtn).toBeInTheDocument()
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalled()
  })

  it('QR Rule: blocks printing when asset data has not been fully filled (shows locked badge, missing fields, disabled button)', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const onFillAssetData = vi.fn()

    const incompleteAsset: Asset = {
      id: 'imported-7001',
      assetCode: '7001',
      serialNumber: '',
      name: '',
      currentDescription: '',
      currentCategory: '',
      department: '',
      currentDepartment: '',
      inChargeId: '',
      inChargeName: '',
      whoInCharge: '',
      building: '',
      floor: '',
      currentLocation: '',
      purchaseDate: '',
      date: '',
      status: 'Pending Verification',
      plant: '',
      company: 'IIPL',
      assetTag: '7001',
      category: '',
      assetCondition: '',
      purchaseCost: 0,
      currentValue: 0,
      assignedTo: '',
      location: '',
    }

    render(
      <IndiaLabelPrintView
        assets={[incompleteAsset]}
        lang="en"
        onFillAssetData={onFillAssetData}
      />
    )

    // 1. Shows "QR Rule Enforced: Printing Blocked Until Data is Fully Filled" banner
    expect(
      screen.getByText(/QR Rule Enforced: Printing Blocked Until Data is Fully Filled/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Printing Prohibited/i)).toBeInTheDocument()

    // 2. Lists missing fields
    expect(screen.getByText(/Missing Required Information/i)).toBeInTheDocument()
    expect(screen.getAllByText(/🔒 Incomplete/i).length).toBeGreaterThan(0)

    // 3. Print buttons are disabled
    const disabledBtn = screen.getByRole('button', { name: /QR Print Locked: Complete Data First/i })
    expect(disabledBtn).toBeDisabled()

    // Clicking disabled button does NOT trigger print
    fireEvent.click(disabledBtn)
    expect(printSpy).not.toHaveBeenCalled()

    // 4. Clicking "Fill Missing Asset Details Now" calls callback
    const fillDetailsBtn = screen.getByRole('button', { name: /Fill Missing Asset Details Now/i })
    expect(fillDetailsBtn).toBeInTheDocument()
    fireEvent.click(fillDetailsBtn)
    expect(onFillAssetData).toHaveBeenCalledWith(incompleteAsset)
  })

  it('QR Rule: filter tabs and bulk selection strictly isolate ready assets from incomplete assets', () => {
    const incompleteAsset: Asset = {
      id: 'imported-7002',
      assetCode: '7002',
      serialNumber: '',
      name: '',
      currentDescription: '',
      currentCategory: '',
      department: '',
      currentDepartment: '',
      inChargeId: '',
      inChargeName: '',
      whoInCharge: '',
      building: '',
      floor: '',
      currentLocation: '',
      purchaseDate: '',
      date: '',
      status: 'Pending Verification',
      plant: '',
      company: 'IIPL',
      assetTag: '7002',
      category: '',
      assetCondition: '',
      purchaseCost: 0,
      currentValue: 0,
      assignedTo: '',
      location: '',
    }

    render(<IndiaLabelPrintView assets={[sampleAsset, incompleteAsset]} lang="en" />)

    // Verify counter in filter tabs: 1 ready, 1 incomplete
    expect(screen.getByRole('button', { name: /✓ Ready.*1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /🔒 Incomplete.*1/i })).toBeInTheDocument()

    // Filter by "Ready"
    fireEvent.click(screen.getByRole('button', { name: /✓ Ready.*1/i }))
    expect(screen.getAllByText('2004218').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('7002')).not.toBeInTheDocument()

    // Filter by "Incomplete"
    fireEvent.click(screen.getByRole('button', { name: /🔒 Incomplete.*1/i }))
    expect(screen.getAllByText('7002').length).toBeGreaterThanOrEqual(1)
    // 2004218 shouldn't be in the left list when filtered by incomplete
    expect(screen.queryByText('Dell Precision Workstation · C39')).not.toBeInTheDocument()
  })

  it('Company Branding Rule: switches between original ismartu and PadGET logos dynamically without backend storage', () => {
    // 1. ismartu asset -> renders ismartu logo
    const ismartuAsset: Asset = { ...sampleAsset, id: 'ism-1', company: 'ismartu' }
    const { rerender } = render(<IsmartuAssetLabel asset={ismartuAsset} />)

    const ismartuLogo = screen.getByRole('img', { name: /ismartu/i })
    expect(ismartuLogo).toBeInTheDocument()
    expect(ismartuLogo.getAttribute('src')).toContain('data:image/png;base64,')

    // 2. Padget asset -> renders PadGET logo
    const padgetAsset: Asset = { ...sampleAsset, id: 'pad-1', company: 'Padget' }
    rerender(<IsmartuAssetLabel asset={padgetAsset} />)

    const padgetLogo = screen.getByRole('img', { name: /padget/i })
    expect(padgetLogo).toBeInTheDocument()
    expect(padgetLogo.getAttribute('src')).toContain('data:image/png;base64,')
  })

  it('Barcode Readability Rule: renders ISO/IEC 15417 Code-128 standard barcode with crispEdges and quiet zones', () => {
    render(<IsmartuAssetLabel asset={sampleAsset} />)

    const barcodeSvg = screen.getByLabelText(/Barcode for 2004218/i)
    expect(barcodeSvg).toBeInTheDocument()
    expect(barcodeSvg).toHaveAttribute('shape-rendering', 'crispEdges')

    // Has crisp black bars and white quiet zone background
    const rects = barcodeSvg.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(15) // Real Code-128 contains alternating bars and spaces

    // First rect is the white quiet zone background
    expect(rects[0]).toHaveAttribute('fill', '#ffffff')
    // Subsequent rects are sharp black bars
    expect(rects[1]).toHaveAttribute('fill', '#000000')
  })

  it('Label Size Manager: allows selecting roll presets or custom mm dimensions and scale', () => {
    render(<IndiaLabelPrintView assets={[sampleAsset]} lang="en" />)

    // Check that default dimensions (100mm × 65mm) are displayed
    expect(screen.getByText('100mm × 65mm')).toBeInTheDocument()

    // Open the Size Manager
    const manageBtn = screen.getByRole('button', { name: /Manage Size/i })
    expect(manageBtn).toBeInTheDocument()
    fireEvent.click(manageBtn)

    // Size manager toolbar should appear with presets
    expect(screen.getByText('Standard Roll Presets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /75 × 50 mm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /50 × 35 mm/i })).toBeInTheDocument()

    // Select 75 x 50 mm preset
    fireEvent.click(screen.getByRole('button', { name: /75 × 50 mm/i }))
    expect(screen.getByText('75mm × 50mm')).toBeInTheDocument()

    // Select 50 x 35 mm preset
    fireEvent.click(screen.getByRole('button', { name: /50 × 35 mm/i }))
    expect(screen.getByText('50mm × 35mm')).toBeInTheDocument()
  })

  it('Performance: Paginates large asset lists rendering only 50 rows per page instead of thousands', () => {
    // Generate 120 mock assets
    const manyAssets: Asset[] = Array.from({ length: 120 }, (_, i) => ({
      ...sampleAsset,
      id: `perf-asset-${i + 1}`,
      assetCode: `PERF-${1000 + i}`,
      name: `Equipment ${i + 1}`,
    }))

    render(<IndiaLabelPrintView assets={manyAssets} lang="en" />)

    // Should show pagination controls: Showing 1 to 50 of 120
    expect(screen.getByText(/Showing 1 to 50 of 120/i)).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    // First page item is rendered in the list
    expect(screen.getAllByText('PERF-1000').length).toBeGreaterThanOrEqual(1)

    // Items beyond page 1 (e.g. index 75 = PERF-1075) must NOT be mounted in the DOM
    expect(screen.queryByText('PERF-1075')).not.toBeInTheDocument()

    // Navigate to Next page
    const nextBtn = screen.getByRole('button', { name: /Next ›/i })
    fireEvent.click(nextBtn)

    expect(screen.getByText(/Showing 51 to 100 of 120/i)).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(screen.getAllByText('PERF-1075').length).toBeGreaterThanOrEqual(1)
  })

  it('Performance: Lazy multi-selection hub renders action buttons and defers preview generation when > 1 asset is selected', () => {
    const asset1: Asset = { ...sampleAsset, id: 'multi-1', assetCode: 'M-1' }
    const asset2: Asset = { ...sampleAsset, id: 'multi-2', assetCode: 'M-2' }

    render(<IndiaLabelPrintView assets={[asset1, asset2]} lang="en" />)

    // Select both checkboxes
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    // Should display Bulk Selection Hub
    expect(screen.getByText('2 Assets Selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate Labels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Print Selected/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export Labels/i })).toBeInTheDocument()

    // The single label preview header should be replaced by the Bulk Hub
    expect(screen.queryByText('Exact Label Preview')).not.toBeInTheDocument()
  })

  it('Performance: Select All modal dialog shows warning and estimated time for large batches (>50 assets)', () => {
    const largeBatch: Asset[] = Array.from({ length: 60 }, (_, i) => ({
      ...sampleAsset,
      id: `batch-${i + 1}`,
      assetCode: `BATCH-${1000 + i}`,
    }))

    render(<IndiaLabelPrintView assets={largeBatch} lang="en" />)

    // Click "Select Ready"
    const selectReadyBtn = screen.getByRole('button', { name: /Select Ready/i })
    fireEvent.click(selectReadyBtn)

    // Confirmation dialog appears with estimated time
    expect(screen.getByText('You are about to generate labels for')).toBeInTheDocument()
    expect(screen.getByText('60 assets')).toBeInTheDocument()
    expect(screen.getByText(/Estimated time:/i)).toBeInTheDocument()

    // Cancel closes dialog without changing bulk count
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)
    expect(screen.queryByText('You are about to generate labels for')).not.toBeInTheDocument()
  })
})
