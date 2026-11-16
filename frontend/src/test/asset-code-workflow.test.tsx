import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import * as React from 'react'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import { AssetCodeWorkflow } from '@/components/AssetCodeWorkflow'
import type { Asset } from '@/types/asset'

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'imported-AST000001',
  assetCode: 'AST000001',
  serialNumber: '',
  currentCategory: '',
  currentDescription: '',
  plant: '',
  assetCondition: '',
  date: '2026-11-13',
  name: 'AST000001',
  assetTag: 'AST000001',
  category: 'IT Hardware',
  department: '',
  status: 'Imported',
  purchaseDate: '2026-11-13',
  purchaseCost: 0,
  currentValue: 0,
  assignedTo: '',
  location: '',
  ...overrides,
})

describe('Asset code workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = '#verification'
  })

  it('imports and assigns codes, scopes them by department, then opens the existing asset form', () => {
    const onImportCodes = vi.fn()
    const onAssign = vi.fn()
    const onSelectAsset = vi.fn()
    const admin = { userId: 'USR-ADMIN', userName: 'Admin', role: 'Administrator', department: 'IT' }
    const { rerender } = render(
      <AssetCodeWorkflow assets={[]} user={admin} onImportCodes={onImportCodes} onAssign={onAssign} onSelectAsset={onSelectAsset} />
    )

    fireEvent.change(screen.getByLabelText('Paste asset codes'), { target: { value: 'AST000001\nAST000002' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted codes' }))
    expect(onImportCodes).toHaveBeenCalledWith(['AST000001', 'AST000002'])

    const unassigned = makeAsset()
    rerender(
      <AssetCodeWorkflow assets={[unassigned]} user={admin} onImportCodes={onImportCodes} onAssign={onAssign} onSelectAsset={onSelectAsset} />
    )
    fireEvent.change(screen.getByLabelText('Department for AST000001'), { target: { value: 'Finance' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))
    expect(onAssign).toHaveBeenCalledWith(unassigned.id, 'Finance')

    const itAsset = makeAsset({ status: 'Pending Verification', department: 'IT', currentDepartment: 'IT' })
    const hrAsset = makeAsset({
      id: 'imported-AST000002',
      assetCode: 'AST000002',
      assetTag: 'AST000002',
      status: 'Pending Verification',
      department: 'HR',
      currentDepartment: 'HR',
    })
    rerender(
      <AssetCodeWorkflow
        assets={[itAsset, hrAsset]}
        user={{ userId: 'USR-IT', userName: 'IT Lead', role: 'Department AM / TL', department: 'IT' }}
        onImportCodes={onImportCodes}
        onAssign={onAssign}
        onSelectAsset={onSelectAsset}
      />
    )
    expect(screen.getAllByText('AST000001').length).toBeGreaterThan(0)
    expect(screen.queryByText('AST000002')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select code' }))
    expect(onSelectAsset).toHaveBeenCalledWith(itAsset)
  })

  it('opens the full Add Asset form for the selected code and updates it to Completed', async () => {
    const assignedAsset = makeAsset({
      id: 'imported-AST000099',
      assetCode: 'AST000099',
      assetTag: 'AST000099',
      status: 'Pending Verification',
      department: 'IT',
      currentDepartment: 'IT',
    })
    const WorkflowWithAssetForm = () => {
      const [assets, setAssets] = React.useState([assignedAsset])
      const [selectedAsset, setSelectedAsset] = React.useState<Asset | null>(null)

      return (
        <>
          <AssetCodeWorkflow
            assets={assets}
            user={{ userId: 'USR-IT', userName: 'IT Lead', role: 'Department AM / TL', department: 'IT' }}
            onImportCodes={() => undefined}
            onAssign={() => undefined}
            onSelectAsset={setSelectedAsset}
          />
          <div data-testid="asset-status">{assets[0].status}</div>
          <AddAssetPanel
            open={Boolean(selectedAsset)}
            onClose={() => setSelectedAsset(null)}
            initialAsset={selectedAsset}
            onSave={(asset) => setAssets((current) => current.map((item) => item.id === asset.id ? asset : item))}
          />
        </>
      )
    }

    render(<WorkflowWithAssetForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Select code' }))

    expect(screen.getByRole('heading', { name: 'Complete AST000099' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Asset code/)).toHaveValue('AST000099')
    expect(screen.getByRole('heading', { name: 'Media' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Belong to which dept/)).toHaveValue('IT')

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SN-88392104-X/), { target: { value: 'SN-123' } })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Pune Central Plant/), { target: { value: 'Pune Plant' } })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Operational - Excellent \/ New/), { target: { value: 'Operational - Good' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit and mark Completed' }))

    await waitFor(() => expect(screen.getByTestId('asset-status')).toHaveTextContent('Completed'))
  })

  it('auto-fills Ownership fields with the selecting user (e.g. Employee 2 from SMT Operations)', () => {
    const rawAsset = makeAsset({
      id: 'asset-7002266',
      assetCode: '7002266',
      status: 'Pending Verification',
      currentDepartment: '',
      inChargeId: 'ID Pending',
      inChargeName: 'Unassigned Staff',
    })
    const employee2 = {
      userId: 'EMP-002',
      userName: 'Employee Two',
      role: 'Staff Member',
      department: 'SMT Operations',
    }

    render(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        onSave={() => undefined}
        initialAsset={rawAsset}
        currentUser={employee2}
      />
    )

    // Check Ownership fields auto-filled with Employee 2
    expect(screen.getByLabelText(/Belong to which dept/i)).toHaveValue('SMT Operations')
    expect(screen.getByPlaceholderText(/Emp ID: e\.g\. EMP-102/i)).toHaveValue('EMP-002')
    expect(screen.getByPlaceholderText(/Name: e\.g\. Rajesh Kumar/i)).toHaveValue('Employee Two')
    expect(screen.getByPlaceholderText(/e\.g\. Submitter name or registry staff/i)).toHaveValue('Employee Two')
  })

  it('allows adding a new company and new building through the + New buttons', () => {
    render(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        onSave={() => undefined}
        initialAsset={null}
      />
    )

    // 1. Add New Company
    const newCompanyBtn = screen.getByRole('button', { name: /Add new company/i })
    expect(newCompanyBtn).toBeInTheDocument()
    fireEvent.click(newCompanyBtn)

    const companyInput = screen.getByPlaceholderText(/Enter company name/i)
    fireEvent.change(companyInput, { target: { value: 'Foxconn India' } })
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

    expect(screen.getByRole('button', { name: /Foxconn India/i })).toBeInTheDocument()

    // 2. Add New Building
    const newBuildingBtn = screen.getByRole('button', { name: /Add new building/i })
    expect(newBuildingBtn).toBeInTheDocument()
    fireEvent.click(newBuildingBtn)

    const buildingInput = screen.getByPlaceholderText(/Enter building/i)
    fireEvent.change(buildingInput, { target: { value: 'D205' } })
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

    expect(screen.getByRole('button', { name: /D205/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e\.g\. C39, D197, D198, D199/i)).toHaveValue('D205')
  })
})