import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetCodeWorkflow } from '@/components/AssetCodeWorkflow'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'

describe('Normal User Task Queue Visibility Specification', () => {
  // Real-world assets with ERP SAP cost centers as imported by Super User
  const realWorldImportedAssets: Asset[] = [
    {
      id: 'ast-real-1',
      assetCode: '5000507',
      name: 'Volumetric air tightness test equipment',
      currentDescription: 'Volumetric air tightness test equipment',
      department: '95030021', // Raw numeric SAP cost center
      currentDepartment: '95030021',
      building: 'D197',
      floor: '1F',
      status: 'Pending Verification',
      company: 'Padget',
      companyCode: '9500',
    } as Asset,
    {
      id: 'ast-real-2',
      assetCode: '2005941',
      name: 'High Precision SMT Feeder',
      currentDescription: 'High Precision SMT Feeder',
      department: '95030006', // Raw numeric SAP cost center
      currentDepartment: '95030006',
      building: 'D197',
      floor: '1F',
      status: 'Pending Verification',
      company: 'Padget',
      companyCode: '9500',
    } as Asset,
    {
      id: 'ast-real-3',
      assetCode: '12001433',
      name: 'Aging Rack',
      currentDescription: 'Aging Rack',
      department: 'C502007063', // ismartu SAP cost center
      currentDepartment: 'C502007063',
      building: 'C39',
      floor: '1F',
      status: 'Pending Verification',
      company: 'IIPL',
      companyCode: '5020',
    } as Asset,
  ]

  const normalUserManish: UserProfile = {
    userId: '19105533',
    userName: 'Manish Chauhan',
    role: 'Employee',
    department: 'Production & SMT',
  }

  const normalUserArbind: UserProfile = {
    userId: '19102709',
    userName: 'Arbind Kumar Singh',
    role: 'Employee',
    department: 'Production & SMT',
  }

  it('Invariant 1: Normal user Manish (Production & SMT) can see pending asset codes in the table list', () => {
    render(
      <AssetCodeWorkflow
        assets={realWorldImportedAssets}
        user={normalUserManish}
        onImportCodes={vi.fn()}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    // The counts show 3
    expect(screen.getByText('Total Asset Codes')).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)

    // Must NOT show "No pending asset codes assigned to this department"
    expect(screen.queryByText(/No pending asset codes assigned to this department/i)).not.toBeInTheDocument()

    // Must show the asset codes in the table
    expect(screen.getByText('5000507')).toBeInTheDocument()
    expect(screen.getByText('2005941')).toBeInTheDocument()

    // Department must be resolved to human-readable 'Production' instead of raw '95030006'
    expect(screen.getAllByText('Production').length).toBeGreaterThanOrEqual(1)

    // Action button "Select code" must be visible
    expect(screen.getAllByText('Select code').length).toBeGreaterThanOrEqual(1)
  })

  it('Invariant 2: Normal user Arbind can see pending asset codes in the table list', () => {
    render(
      <AssetCodeWorkflow
        assets={realWorldImportedAssets}
        user={normalUserArbind}
        onImportCodes={vi.fn()}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    // Must NOT show "No pending asset codes assigned to this department"
    expect(screen.queryByText(/No pending asset codes assigned to this department/i)).not.toBeInTheDocument()

    // Real asset codes are rendered
    expect(screen.getByText('5000507')).toBeInTheDocument()
    expect(screen.getByText('2005941')).toBeInTheDocument()
  })

  it('Invariant 3: Clicking "All Depts" chip retains visibility of all pending codes across entire facility', () => {
    render(
      <AssetCodeWorkflow
        assets={realWorldImportedAssets}
        user={normalUserManish}
        onImportCodes={vi.fn()}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    // Click "All Depts"
    const allDeptsBtn = screen.getByRole('button', { name: 'All Depts' })
    fireEvent.click(allDeptsBtn)

    // All 3 codes must be visible
    expect(screen.getByText('5000507')).toBeInTheDocument()
    expect(screen.getByText('2005941')).toBeInTheDocument()
    expect(screen.getByText('12001433')).toBeInTheDocument()
  })
})
