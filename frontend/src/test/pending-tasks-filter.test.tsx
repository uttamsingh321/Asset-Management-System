import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { App } from '../App'
import { isAssetTaskCompleted, type Asset } from '../types/asset'

describe('Pending Tasks Queue vs Deployed Assets Invariant', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('meridian_auth', 'true')
    sessionStorage.setItem('meridian_active_factory', 'Noida Plant (SMT Line & Assembly)')
    window.location.hash = '#dashboard'
  })

  it('isAssetTaskCompleted correctly identifies completed vs pending task units', () => {
    const rawPendingCode: Asset = {
      id: 'imported-7002266',
      assetCode: '7002266',
      serialNumber: '',
      currentCategory: '',
      currentDescription: '',
      plant: '',
      assetCondition: '',
      date: '2026-11-13',
      name: '7002266',
      assetTag: '7002266',
      category: 'IT Hardware',
      department: '',
      status: 'Imported',
      purchaseDate: '2026-11-13',
      purchaseCost: 0,
      currentValue: 0,
      assignedTo: '',
      location: '',
    }

    const pendingVerificationCode: Asset = {
      ...rawPendingCode,
      status: 'Pending Verification',
      currentDepartment: 'IT',
    }

    const completedUnit: Asset = {
      id: 'imported-7002266',
      assetCode: '7002266',
      serialNumber: 'SN-7002266-XYZ',
      currentCategory: 'Laptops & Compute',
      currentDescription: 'MacBook Pro 16 M3 Max',
      plant: 'Pune Central Plant',
      company: 'IIPL',
      building: 'C39',
      floor: '2nd Floor',
      currentLocation: 'Bay 12 Desk 4',
      currentDepartment: 'IT',
      department: 'IT',
      inChargeId: 'EMP-102',
      inChargeName: 'Rajesh Kumar',
      whoInCharge: 'EMP-102 · Rajesh Kumar',
      assetCondition: 'Operational - Good',
      date: '2026-11-13',
      name: 'MacBook Pro 16 M3 Max',
      assetTag: '7002266',
      category: 'Laptops & Compute',
      status: 'Completed',
      purchaseDate: '2026-11-13',
      purchaseCost: 245000,
      currentValue: 245000,
      assignedTo: 'EMP-102 · Rajesh Kumar',
      location: 'IIPL · C39 · 2nd Floor',
    }

    expect(isAssetTaskCompleted(rawPendingCode)).toBe(false)
    expect(isAssetTaskCompleted(pendingVerificationCode)).toBe(false)
    expect(isAssetTaskCompleted(completedUnit)).toBe(true)
  })

  it('Main Dashboard and Gallery hide uncompleted task codes until filled out', async () => {
    // Populate localStorage with 5 imported/pending codes and 1 completed asset
    const testAssets: Asset[] = [
      {
        id: 'imported-7002266',
        assetCode: '7002266',
        serialNumber: '',
        currentCategory: '',
        currentDescription: '',
        plant: '',
        assetCondition: '',
        date: '2026-11-13',
        name: '7002266',
        assetTag: '7002266',
        category: 'IT Hardware',
        department: '',
        status: 'Imported',
        purchaseDate: '2026-11-13',
        purchaseCost: 0,
        currentValue: 0,
        assignedTo: '',
        location: '',
      },
      {
        id: 'imported-7002142',
        assetCode: '7002142',
        serialNumber: '',
        currentCategory: '',
        currentDescription: '',
        plant: '',
        assetCondition: '',
        date: '2026-11-13',
        name: '7002142',
        assetTag: '7002142',
        category: 'IT Hardware',
        department: '',
        status: 'Pending Verification',
        purchaseDate: '2026-11-13',
        purchaseCost: 0,
        currentValue: 0,
        assignedTo: '',
        location: '',
      },
      {
        id: 'AST-DONE-001',
        assetCode: 'AST-SMT-8801',
        serialNumber: 'SN-SMT-8801',
        currentCategory: 'SMT Equipment',
        currentDescription: 'Yamaha YRM20 Pick and Place Machine',
        plant: 'Pune Central Plant',
        company: 'IIPL',
        building: 'C39',
        floor: 'Ground Floor',
        currentLocation: 'SMT Line 1',
        currentDepartment: 'Production',
        department: 'Production',
        inChargeId: 'EMP-501',
        inChargeName: 'Sunil Verma',
        whoInCharge: 'EMP-501 · Sunil Verma',
        assetCondition: 'Operational - Good',
        date: '2026-11-13',
        name: 'Yamaha YRM20 Pick and Place Machine',
        assetTag: 'AST-SMT-8801',
        category: 'SMT Equipment',
        status: 'Completed',
        purchaseDate: '2026-11-13',
        purchaseCost: 5000000,
        currentValue: 5000000,
        assignedTo: 'EMP-501 · Sunil Verma',
        location: 'IIPL · C39 · Ground Floor',
      },
    ]

    localStorage.setItem('meridian_assets', JSON.stringify(testAssets))

    render(<App />)

    // Facility Assets Register badge should show "1 of 1 Deployed" (NOT 3 of 3)
    await waitFor(() => {
      expect(screen.getByText(/1 of 1 Deployed/i)).toBeInTheDocument()
      expect(screen.getByText(/2 pending task entry/i)).toBeInTheDocument()
    })

    // The completed asset is rendered in the table
    expect(screen.getByText('AST-SMT-8801')).toBeInTheDocument()
    expect(screen.getByText('Sunil Verma')).toBeInTheDocument()

    // The 2 pending codes (7002266 and 7002142) MUST NOT be in the table
    expect(screen.queryByText('7002266')).not.toBeInTheDocument()
    expect(screen.queryByText('7002142')).not.toBeInTheDocument()

    // Navigate to Asset Gallery (#assets)
    window.location.hash = '#assets'
    fireEvent(window, new HashChangeEvent('hashchange'))

    await waitFor(() => {
      // Total assets KPI in gallery must be 1, not 3
      const totalKpi = screen.getByText('Total assets').closest('.card') as HTMLElement
      expect(within(totalKpi).getByText('1')).toBeInTheDocument()
    })

    // Gallery only shows completed asset
    expect(screen.getByText('AST-SMT-8801')).toBeInTheDocument()
    expect(screen.queryByText('7002266')).not.toBeInTheDocument()
    expect(screen.queryByText('7002142')).not.toBeInTheDocument()
  })
})
