import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import App from '@/App'
import { exportAssetsToExcel } from '@/lib/excelExport'
import type { Asset } from '@/types/asset'
import * as XLSX from 'xlsx'

const mockAssets: Asset[] = [
  {
    id: 'asset-it-01',
    assetCode: 'IT-1001',
    assetTag: 'IT-1001',
    serialNumber: 'SN-IT-9901',
    date: '2026-11-14',
    purchaseDate: '2026-11-14',
    name: 'IT Developer Workstation',
    currentDescription: 'IT Developer Workstation',
    category: 'Computers',
    currentCategory: 'Computers',
    department: 'IT',
    currentDepartment: 'IT',
    company: 'IIPL',
    plant: 'Noida Central Plant',
    building: 'C39',
    floor: '1st Floor',
    currentLocation: 'Bay 4',
    inChargeId: 'EMP-IT-01',
    inChargeName: 'IT Engineer',
    submitter: 'IT Engineer',
    assignedTo: 'IT Engineer',
    assetCondition: 'Operational',
    status: 'Completed',
    purchaseCost: 80000,
    currentValue: 70000,
    location: 'C39 1st Floor',
  },
  {
    id: 'asset-smt-02',
    assetCode: 'SMT-2002',
    assetTag: 'SMT-2002',
    serialNumber: 'SN-SMT-4432',
    date: '2026-11-13',
    purchaseDate: '2026-11-13',
    name: 'SMT Solder Printer',
    currentDescription: 'SMT Solder Printer',
    category: 'Machinery',
    currentCategory: 'Machinery',
    department: 'SMT Operations',
    currentDepartment: 'SMT Operations',
    company: 'Padget',
    plant: 'Padget Unit 2',
    building: 'D197',
    floor: 'Ground Floor',
    currentLocation: 'Line 2',
    inChargeId: 'EMP-SMT-02',
    inChargeName: 'SMT Operator',
    submitter: 'SMT Operator',
    assignedTo: 'SMT Operator',
    assetCondition: 'Operational',
    status: 'Completed',
    purchaseCost: 350000,
    currentValue: 300000,
    location: 'D197 Ground Floor',
  },
]

describe('Department Scoping & Excel Export Specifications', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('meridian_assets', JSON.stringify(mockAssets))
    sessionStorage.setItem('meridian_auth', 'true')
    window.location.hash = '#dashboard'
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('generates an Excel sheet with Asset Number, Serial Number, and Date Form Filled columns', () => {
    const jsonToSheetSpy = vi.spyOn(XLSX.utils, 'json_to_sheet')
    const bookNewSpy = vi.spyOn(XLSX.utils, 'book_new')

    exportAssetsToExcel(mockAssets, 'Test_Export')

    expect(jsonToSheetSpy).toHaveBeenCalled()
    const exportedRows = jsonToSheetSpy.mock.calls[0][0] as any[]
    expect(exportedRows.length).toBe(2)

    // Verify exact required columns
    expect(exportedRows[0]).toHaveProperty('Asset Number', 'IT-1001')
    expect(exportedRows[0]).toHaveProperty('Serial Number', 'SN-IT-9901')
    expect(exportedRows[0]).toHaveProperty('Date Form Filled', '2026-11-14')

    expect(exportedRows[1]).toHaveProperty('Asset Number', 'SMT-2002')
    expect(exportedRows[1]).toHaveProperty('Serial Number', 'SN-SMT-4432')
    expect(exportedRows[1]).toHaveProperty('Date Form Filled', '2026-11-13')

    expect(bookNewSpy).toHaveBeenCalled()
  })

  it('scopes asset visibility so IT department user can only see IT assets, not SMT assets', async () => {
    // Set active user as IT department member
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: 'EMP-IT-01',
        userName: 'IT Engineer',
        role: 'Staff Member',
        department: 'IT',
        isSuperuser: false,
      })
    )

    render(<App />)

    // Should see IT asset
    expect(screen.getByText('IT-1001')).toBeInTheDocument()
    // Should NOT see other department's asset (SMT Operations)
    expect(screen.queryByText('SMT-2002')).not.toBeInTheDocument()

    // Export button is available
    const exportBtn = screen.getByRole('button', { name: /Export to Excel/i })
    expect(exportBtn).toBeInTheDocument()
  })

  it('allows Admin / Superuser to view all department assets', async () => {
    // Set active user as Admin / Superuser
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: 'USR-ADMIN',
        userName: 'Admin User',
        role: 'Admin',
        department: 'IT',
        isSuperuser: true,
      })
    )

    render(<App />)

    // Superuser sees BOTH IT and SMT assets
    expect(screen.getByText('IT-1001')).toBeInTheDocument()
    expect(screen.getByText('SMT-2002')).toBeInTheDocument()
  })
})
