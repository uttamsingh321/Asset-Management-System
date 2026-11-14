import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import { checkAssetDataCompleteness, type Asset } from '@/types/asset'

describe('Excel Master Import & Redesigned Asset Form Specification', () => {
  it('displays the 7 pre-fetched Excel master fields and focuses form strictly on missing physical details', async () => {
    // Simulated asset imported from SAP / ERP Excel register with the 7 yellow highlighted columns
    const importedExcelAsset: Asset = {
      id: 'AST-8107891',
      assetCode: '8107891', // Col C: Asset
      serialNumber: '',
      companyCode: '5020', // Col A: Company code
      company: 'ismartu',
      assetClass: 'A800', // Col B: Asset Class
      currentCategory: 'A800',
      category: 'A800',
      name: 'SMF Quanta Batteries 12V 200AH', // Col D: Asset Description (Main text)
      currentDescription: 'SMF Quanta Batteries 12V 200AH',
      capitalizationDate: '2/1/2026', // Col G: Capitalization date
      purchaseDate: '2/1/2026',
      purchaseCost: 0,
      currentValue: 0,
      costCenter: 'C502006009', // Col H: Cost center
      currentDepartment: 'Operations',
      department: 'Operations',
      plant: 'C-39 Factory Noida', // Col I: Location
      location: 'ismartu · C39 · C-39 Factory Noida',
      building: 'C39',
      assetCondition: '',
      status: 'Pending Verification',
      isExcelImported: true,
      date: '2026-02-01',
      assetTag: '8107891',
      assignedTo: 'Manish Chauhan',
    }

    let savedAsset: Asset | null = null

    render(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        initialAsset={importedExcelAsset}
        onSave={(updated) => {
          savedAsset = updated
        }}
        currentUser={{
          userId: 'MANISH5533',
          userName: 'Manish Chauhan',
          role: 'Staff Member',
          department: 'SMT Operations',
        }}
      />
    )

    // 1. Verify Top Pre-Fetched Excel Master Record banner & 7 highlighted fields
    expect(screen.getByText(/Excel Master Record/i)).toBeInTheDocument()
    expect(screen.getByText(/7 ERP Fields Pre-filled/i)).toBeInTheDocument()
    expect(screen.getByText('5020')).toBeInTheDocument() // Col A
    expect(screen.getByText(/A800/)).toBeInTheDocument() // Col B
    expect(screen.getByText('8107891')).toBeInTheDocument() // Col C
    expect(screen.getByText('SMF Quanta Batteries 12V 200AH')).toBeInTheDocument() // Col D
    expect(screen.getByText('2/1/2026')).toBeInTheDocument() // Col G
    expect(screen.getByText('C502006009')).toBeInTheDocument() // Col H
    expect(screen.getByText('C-39 Factory Noida')).toBeInTheDocument() // Col I

    // 2. Verify "Missing Physical Details to Fill" section is highlighted
    expect(screen.getByText(/Missing Physical Details to Fill/i)).toBeInTheDocument()
    expect(screen.getByText(/Floor Verification/i)).toBeInTheDocument()

    // 3. Fill only the missing physical equipment fields
    // Missing Field A: Serial Number
    const serialInput = screen.getByPlaceholderText(/e\.g\. SN-88392104-X/)
    fireEvent.change(serialInput, { target: { value: 'SN-BAT-QUANTA-2026' } })

    // Missing Field B: Placement Area & Floor
    const floorInput = screen.getByPlaceholderText(/e\.g\. 1st Floor \/ xxx/)
    fireEvent.change(floorInput, { target: { value: '3rd Floor' } })

    const areaInput = screen.getByPlaceholderText(/e\.g\. Bay 14 Desk 4A or SMT Line-1/)
    fireEvent.change(areaInput, { target: { value: '3F SMT Line-1 Power Rack' } })

    // Missing Field C: Custodian
    expect(screen.getByPlaceholderText(/Emp ID: e\.g\. EMP-102 or MANISH5533/)).toHaveValue('MANISH5533')
    expect(screen.getByPlaceholderText(/Full Name: e\.g\. Rajesh Kumar/)).toHaveValue('Manish Chauhan')

    // Missing Field D: Condition
    fireEvent.click(screen.getByRole('button', { name: /Operational - Excellent \/ New/i }))

    // 4. Submit completed physical verification
    fireEvent.click(screen.getByRole('button', { name: /Submit and mark Completed/i }))

    await waitFor(() => expect(savedAsset).not.toBeNull())

    // 5. Verify the saved asset has merged pre-fetched master data + new physical data
    expect(savedAsset!.assetCode).toBe('8107891')
    expect(savedAsset!.companyCode).toBe('5020')
    expect(savedAsset!.company).toBe('ismartu')
    expect(savedAsset!.assetClass).toBe('A800')
    expect(savedAsset!.name).toBe('SMF Quanta Batteries 12V 200AH')
    expect(savedAsset!.capitalizationDate).toBe('2/1/2026')
    expect(savedAsset!.costCenter).toBe('C502006009')
    expect(savedAsset!.serialNumber).toBe('SN-BAT-QUANTA-2026')
    expect(savedAsset!.floor).toBe('3rd Floor')
    expect(savedAsset!.currentLocation).toBe('3F SMT Line-1 Power Rack')
    expect(savedAsset!.inChargeId).toBe('MANISH5533')
    expect(savedAsset!.inChargeName).toBe('Manish Chauhan')
    expect(savedAsset!.status).toBe('Completed')

    // 6. Verify completeness report: now 100% complete, unlocking QR print
    const completeness = checkAssetDataCompleteness(savedAsset!)
    expect(completeness.isFullyFilled).toBe(true)
    expect(completeness.missingFields).toHaveLength(0)
  })

  it('maps Company Code 5020 to ismartu and Company Code 5030 to Padget with correct label branding', () => {
    const ismartuAsset = {
      id: 'ast-1',
      assetCode: '1001',
      serialNumber: '',
      companyCode: '5020',
      company: 'ismartu',
      name: 'SMT Feeder',
      currentCategory: 'SMT',
      category: 'SMT',
      currentDescription: 'SMT Feeder',
      purchaseDate: '2026-02-01',
      purchaseCost: 0,
      currentValue: 0,
      department: 'SMT Operations',
      location: 'C39',
      status: 'Pending Verification',
    } as Asset

    const { rerender } = render(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        initialAsset={ismartuAsset}
        onSave={() => undefined}
      />
    )

    expect(screen.getByText(/ismartu Logo/i)).toBeInTheDocument()

    const padgetAsset = {
      id: 'ast-2',
      assetCode: '1002',
      serialNumber: '',
      companyCode: '5030',
      company: 'Padget',
      name: 'Testing Jig',
      currentCategory: 'Testing',
      category: 'Testing',
      currentDescription: 'Testing Jig',
      purchaseDate: '2026-02-01',
      purchaseCost: 0,
      currentValue: 0,
      department: 'Testing',
      location: 'C39',
      status: 'Pending Verification',
    } as Asset

    rerender(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        initialAsset={padgetAsset}
        onSave={() => undefined}
      />
    )

    expect(screen.getByText(/PadGET Logo/i)).toBeInTheDocument()
  })
})
