import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IsmartuAssetLabel } from '@/components/IndiaLabelPrintView'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import App from '@/App'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'

const mockUser: UserProfile = {
  userId: '19105533',
  userName: 'Manish Chauhan',
  role: 'Employee',
  department: 'Production',
}

describe('QR Label & 2D Matrix Real Data Representation Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    sessionStorage.clear()
    localStorage.clear()
  })

  it('Invariant 1: IsmartuAssetLabel NEVER displays raw asset code on Row 2 (Asset Name), even if asset.name === asset.assetCode', () => {
    // Problem scenario from user screenshot media_1794830770480_e4b15814.jpg where 2003202 was repeated
    const rawCodeAsset: Asset = {
      id: 'ast-2003202',
      assetCode: '2003202',
      assetTag: '2003202',
      name: '2003202', // Raw code was stored as name
      currentDescription: '2003202', // Raw code was stored as description
      model: 'S1342',
      serialNumber: 'SN-S1342-99',
      category: 'SMT Machinery',
      currentCategory: 'SMT Machinery',
      department: 'Production',
      currentDepartment: 'Production',
      inChargeId: '19105533',
      inChargeName: 'Manish',
      whoInCharge: '19105533 · Manish',
      submitter: 'Manish Chauhan',
      submitterId: '19105533',
      submitterDepartment: 'SMT EE',
      building: 'C39',
      floor: '3F',
      location: 'C39-3F',
      currentLocation: 'Bay 3',
      status: 'Completed',
      assetCondition: 'Operational',
      plant: 'Noida Central Plant',
      company: 'ismartu',
      assignedTo: '19105533 · Manish',
      date: '2026-11-16',
      purchaseDate: '2026-11-16',
      purchaseCost: 0,
      currentValue: 0,
    }

    render(<IsmartuAssetLabel asset={rawCodeAsset} />)

    // Row 1 is Asset No -> 2003202
    expect(screen.getByText('资产编号/Asset No.')).toBeInTheDocument()

    // Row 2 is Asset Name: MUST NOT be the raw code 2003202!
    // Since raw name was 2003202, it falls back to model S1342 or category SMT Machinery
    const assetNameLabel = screen.getByText('资产名称/Asset Name')
    expect(assetNameLabel).toBeInTheDocument()
    const nameRow = assetNameLabel.closest('div')?.parentElement
    expect(nameRow?.textContent).not.toContain('资产名称/Asset Name2003202')
    expect(nameRow?.textContent).toMatch(/S1342|SMT Machinery|Equipment Fixed Asset/)

    // Model row correctly displays S1342
    expect(screen.getByText('设备型号/Model')).toBeInTheDocument()
    expect(screen.getAllByText('S1342').length).toBeGreaterThanOrEqual(1)
  })

  it('Invariant 2: When real asset name is given (e.g. Aging Rack), Row 2 displays Aging Rack', () => {
    const verifiedAsset: Asset = {
      id: 'ast-12001433',
      assetCode: '12001433',
      assetTag: '12001433',
      name: 'Aging Rack',
      currentDescription: 'Aging Rack',
      model: 'AR-200',
      serialNumber: 'SN-AR-001',
      category: 'Production Equipment',
      currentCategory: 'Production Equipment',
      department: 'Production',
      currentDepartment: 'Production',
      inChargeId: '19102709',
      inChargeName: 'Arbind Kumar Singh',
      whoInCharge: '19102709 · Arbind Kumar Singh',
      submitter: 'Arbind Kumar Singh',
      submitterId: '19102709',
      building: 'C39',
      floor: '1F',
      location: 'C39-1F',
      status: 'Completed',
      assetCondition: 'Operational',
      plant: 'Noida Central Plant',
      company: 'ismartu',
      assignedTo: '19105533 · Manish',
      date: '2026-11-16',
      purchaseDate: '2026-11-16',
      purchaseCost: 0,
      currentValue: 0,
    }

    render(<IsmartuAssetLabel asset={verifiedAsset} />)

    expect(screen.getByText('Aging Rack')).toBeInTheDocument()
    expect(screen.getByText('AR-200')).toBeInTheDocument()
    expect(screen.getAllByText('19102709 · Arbind Kumar Singh').length).toBeGreaterThanOrEqual(1)
  })

  it('Invariant 3: QR Code stores and encodes real asset metadata (name, model, dept, custodian, location)', () => {
    const assetWithData: Asset = {
      id: 'ast-998800',
      assetCode: '998800',
      assetTag: '998800',
      name: 'SMT Mounter Machine',
      currentDescription: 'SMT Mounter Machine',
      model: 'YAMAHA-YRM20',
      serialNumber: 'SN-YM-998800',
      category: 'SMT Machinery',
      currentCategory: 'SMT Machinery',
      department: 'Production',
      currentDepartment: 'Production',
      inChargeId: '19105533',
      inChargeName: 'Manish',
      whoInCharge: '19105533 · Manish',
      submitter: 'Manish Chauhan',
      submitterId: '19105533',
      submitterDepartment: 'SMT EE',
      building: 'C39',
      floor: '3F',
      location: 'C39-3F',
      status: 'Completed',
      assetCondition: 'Operational',
      plant: 'Noida Central Plant',
      company: 'ismartu',
      assignedTo: '19105533 · Manish',
      date: '2026-11-16',
      purchaseDate: '2026-11-16',
      purchaseCost: 0,
      currentValue: 0,
    }

    // Default Smart URL mode
    const { container } = render(<IsmartuAssetLabel asset={assetWithData} qrContentMode="url" />)
    const qrSvg = container.querySelector('svg[aria-label*="QR Code"]')
    expect(qrSvg).toBeInTheDocument()

    // Test Industrial Text mode (all 7 fields represented in text)
    const { container: textContainer } = render(
      <IsmartuAssetLabel asset={assetWithData} qrContentMode="text" />
    )
    const textQrSvg = textContainer.querySelector('svg[aria-label*="QR Code"]')
    expect(textQrSvg).toBeInTheDocument()
  })

  it('Invariant 4: AddAssetPanel exposes 资产名称 / Asset Name in Section 2 so users can fill real equipment names on the floor', () => {
    const rawAsset: Asset = {
      id: 'ast-task-2003202',
      assetCode: '2003202',
      assetTag: '2003202',
      name: '2003202', // Raw code was assigned initially
      currentDescription: '2003202',
      category: 'General Equipment',
      currentCategory: 'General Equipment',
      department: 'Production',
      currentDepartment: 'Production',
      status: 'Pending Verification',
      assetCondition: 'Operational',
      building: 'C39',
      plant: 'Noida Central Plant',
      location: 'C39-1F',
      serialNumber: 'SN-RAW-2003202',
      assignedTo: 'Unassigned',
      company: 'ismartu',
      purchaseDate: '2026-11-16',
      date: '2026-11-16',
      purchaseCost: 0,
      currentValue: 0,
    }

    render(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        initialAsset={rawAsset}
        onSave={() => undefined}
        currentUser={mockUser}
      />
    )

    // Section 2 contains the physical Asset Name input
    const nameInput = screen.getByLabelText(/资产名称 \/ Equipment & Asset Name/i)
    expect(nameInput).toBeInTheDocument()
    // Does NOT auto-fill the raw code 2003202
    expect(nameInput).toHaveValue('')

    // User types real name "Aging Rack"
    fireEvent.change(nameInput, { target: { value: 'Aging Rack' } })
    expect(nameInput).toHaveValue('Aging Rack')
  })

  it('Invariant 5: Deep-link scanning on a remote/offline device reconstructs full asset from QR URL parameters', async () => {
    // Simulate user scanning QR code URL on a remote phone:
    // /?asset=2003202&name=Aging%20Rack&model=S1342&dept=Production&custodian=19105533%C2%B7Manish&user=19105533%C2%B7Manish%20Chauhan&loc=C39-3F&co=ismartu#asset-details
    window.history.pushState(
      {},
      '',
      '/?asset=2003202&name=Aging%20Rack&model=S1342&dept=Production&custodian=19105533%C2%B7Manish&user=19105533%C2%B7Manish%20Chauhan&loc=C39-3F&co=ismartu#asset-details'
    )

    sessionStorage.setItem('meridian_auth', 'true')
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: '19105533',
        userName: 'Manish Chauhan',
        role: 'Employee',
        department: 'Production',
        isSuperuser: false,
      })
    )

    render(<App />)

    // Scanned Asset Verification Modal opens with the full reconstructed real data!
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Official QR Verified')).toBeInTheDocument()
      expect(screen.getAllByText('2003202').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Aging Rack')).toBeInTheDocument()
      expect(screen.getByText('S1342')).toBeInTheDocument()
    })
  })
})
