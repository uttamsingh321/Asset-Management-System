import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import type { Asset } from '@/types/asset'

describe('Main Dashboard Four Major Asset Categories Specification', () => {
  const sampleDashboardAssets: Asset[] = [
    {
      id: 'AST-DASH-01',
      assetCode: '5000501',
      assetTag: '5000501',
      name: 'High Precision SMT Mounter',
      currentDescription: 'High Precision SMT Mounter',
      category: 'Fixed Assets',
      currentCategory: 'Fixed Assets',
      department: 'Production',
      currentDepartment: 'Production',
      company: 'Padget',
      building: 'D197',
      floor: '1st Floor',
      serialNumber: 'SN-FIX-001',
      status: 'Active',
      purchaseDate: '2026-01-01',
      date: '2026-01-01',
      purchaseCost: 50000,
      currentValue: 45000,
      assignedTo: 'Vikram Singh',
      inChargeId: 'EMP-101',
      inChargeName: 'Vikram Singh',
      location: 'D197 - 1st Floor',
      plant: 'Padget D197',
      assetCondition: 'Operational',
    },
    {
      id: 'AST-DASH-02',
      assetCode: '5000502',
      assetTag: '5000502',
      name: 'Fiber Optic High-Speed Cable',
      currentDescription: 'Fiber Optic High-Speed Cable',
      category: 'Accessories',
      currentCategory: 'Accessories',
      department: 'Production',
      currentDepartment: 'Production',
      company: 'Padget',
      building: 'D197',
      floor: '1st Floor',
      serialNumber: 'SN-ACC-002',
      status: 'Active',
      purchaseDate: '2026-01-01',
      date: '2026-01-01',
      purchaseCost: 2000,
      currentValue: 1800,
      assignedTo: 'Vikram Singh',
      inChargeId: 'EMP-101',
      inChargeName: 'Vikram Singh',
      location: 'D197 - 1st Floor',
      plant: 'Padget D197',
      assetCondition: 'Operational',
    },
    {
      id: 'AST-DASH-03',
      assetCode: '5000503',
      assetTag: '5000503',
      name: 'Digital Torque Driver',
      currentDescription: 'Digital Torque Driver',
      category: 'Tools',
      currentCategory: 'Tools',
      department: 'Production',
      currentDepartment: 'Production',
      company: 'Padget',
      building: 'D197',
      floor: '1st Floor',
      serialNumber: 'SN-TOOL-003',
      status: 'Active',
      purchaseDate: '2026-01-01',
      date: '2026-01-01',
      purchaseCost: 3500,
      currentValue: 3000,
      assignedTo: 'Vikram Singh',
      inChargeId: 'EMP-101',
      inChargeName: 'Vikram Singh',
      location: 'D197 - 1st Floor',
      plant: 'Padget D197',
      assetCondition: 'Operational',
    },
    {
      id: 'AST-DASH-04',
      assetCode: '5000504',
      assetTag: '5000504',
      name: 'SMT Clamping Jig Nest',
      currentDescription: 'SMT Clamping Jig Nest',
      category: 'Fixtures',
      currentCategory: 'Fixtures',
      department: 'Production',
      currentDepartment: 'Production',
      company: 'Padget',
      building: 'D197',
      floor: '1st Floor',
      serialNumber: 'SN-FIX-004',
      status: 'Active',
      purchaseDate: '2026-01-01',
      date: '2026-01-01',
      purchaseCost: 8000,
      currentValue: 7200,
      assignedTo: 'Vikram Singh',
      inChargeId: 'EMP-101',
      inChargeName: 'Vikram Singh',
      location: 'D197 - 1st Floor',
      plant: 'Padget D197',
      assetCondition: 'Operational',
    },
  ]

  beforeEach(() => {
    window.location.hash = '#dashboard'
    localStorage.clear()
    localStorage.setItem('meridian_assets', JSON.stringify(sampleDashboardAssets))
    localStorage.setItem(
      'meridian_profile',
      JSON.stringify({ userName: 'Admin', role: 'Admin', isSuperuser: true, userId: 'USR-ADMIN' })
    )
    vi.restoreAllMocks()
  })

  it('1. Renders the Four Major Asset Categories overview section on the Main Dashboard', () => {
    render(<App />)

    // Section header
    expect(screen.getByRole('region', { name: /Four Major Asset Categories/i })).toBeInTheDocument()
    expect(
      screen.getByText(/Four Major Asset Categories \(四大核心资产类别\)/i)
    ).toBeInTheDocument()

    // All 4 major categories are displayed
    expect(screen.getAllByText('Fixed Assets').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('设备固定资产').length).toBeGreaterThanOrEqual(1)

    expect(screen.getAllByText('Accessories').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('设备配件 / 附件').length).toBeGreaterThanOrEqual(1)

    expect(screen.getAllByText('Tools').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('工装工具 / 器具').length).toBeGreaterThanOrEqual(1)

    expect(screen.getAllByText('Fixtures').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('工装夹具 / 治具').length).toBeGreaterThanOrEqual(1)
  })

  it('2. Facility Assets Register table displays the Category column with proper badges', () => {
    render(<App />)

    // Table Header includes Category
    expect(screen.getByRole('columnheader', { name: /Category/i })).toBeInTheDocument()

    // Table rows display category badges
    expect(screen.getByText('5000501')).toBeInTheDocument()
    expect(screen.getByText('5000502')).toBeInTheDocument()
    expect(screen.getByText('5000503')).toBeInTheDocument()
    expect(screen.getByText('5000504')).toBeInTheDocument()
  })

  it('3. Clicking a category card in the dashboard filters the Facility Assets Register table', () => {
    render(<App />)

    // Initially all 4 assets are visible in table
    expect(screen.getByText('5000501')).toBeInTheDocument()
    expect(screen.getByText('5000502')).toBeInTheDocument()
    expect(screen.getByText('5000503')).toBeInTheDocument()
    expect(screen.getByText('5000504')).toBeInTheDocument()

    // Click on "Tools" card
    const toolsCard = screen.getByRole('button', { name: /Category Tools:/i })
    fireEvent.click(toolsCard)

    // Now only 5000503 (Tools) should remain in the table
    expect(screen.getByText('5000503')).toBeInTheDocument()
    expect(screen.queryByText('5000501')).not.toBeInTheDocument()
    expect(screen.queryByText('5000502')).not.toBeInTheDocument()
    expect(screen.queryByText('5000504')).not.toBeInTheDocument()

    // Click "Show All" or clear filter
    const clearBtn = screen.getByRole('button', { name: /Show All/i })
    fireEvent.click(clearBtn)

    // All 4 are back
    expect(screen.getByText('5000501')).toBeInTheDocument()
    expect(screen.getByText('5000502')).toBeInTheDocument()
    expect(screen.getByText('5000503')).toBeInTheDocument()
    expect(screen.getByText('5000504')).toBeInTheDocument()
  })
})
