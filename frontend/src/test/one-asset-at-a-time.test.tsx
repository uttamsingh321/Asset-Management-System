import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '@/App'
import { isAssetTaskCompleted, type Asset } from '@/types/asset'

describe('One-Asset-At-A-Time Filling Invariant & Corrupted State Self-Healing', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('meridian_auth', 'true')
    sessionStorage.setItem('meridian_active_factory', 'Noida Plant (SMT Line & Assembly)')
    window.location.hash = '#tasks'
  })

  it('Strictly updates ONE asset when user submits the form, leaving all other assets pending', async () => {
    // Simulate 5 imported task assets (e.g. 3 from company 5020, 2 from company 5030)
    const initialTasks: Asset[] = [
      {
        id: 'imported-8107891-1',
        assetCode: '8107891',
        assetTag: '8107891',
        companyCode: '5020',
        company: 'ismartu',
        assetClass: 'A800',
        name: 'SMF Quanta Batteries 12V 200AH',
        currentDescription: 'SMF Quanta Batteries 12V 200AH',
        status: 'Pending Verification',
        serialNumber: '',
        date: '2026-02-01',
        purchaseDate: '2026-02-01',
        purchaseCost: 0,
        currentValue: 0,
        category: 'A800',
        currentCategory: 'A800',
        department: 'Production',
        plant: 'Noida Plant',
        location: 'Noida Plant',
        assetCondition: '',
        assignedTo: '',
      },
      {
        id: 'imported-8107892-2',
        assetCode: '8107892',
        assetTag: '8107892',
        companyCode: '5020',
        company: 'ismartu',
        assetClass: 'A800',
        name: 'SMF Quanta Batteries 12V 200AH Unit 2',
        currentDescription: 'SMF Quanta Batteries 12V 200AH Unit 2',
        status: 'Pending Verification',
        serialNumber: '',
        date: '2026-02-01',
        purchaseDate: '2026-02-01',
        purchaseCost: 0,
        currentValue: 0,
        category: 'A800',
        currentCategory: 'A800',
        department: 'Production',
        plant: 'Noida Plant',
        location: 'Noida Plant',
        assetCondition: '',
        assignedTo: '',
      },
      {
        id: 'imported-8107893-3',
        assetCode: '8107893',
        assetTag: '8107893',
        companyCode: '5020',
        company: 'ismartu',
        assetClass: 'A800',
        name: 'SMF Quanta Batteries 12V 200AH Unit 3',
        currentDescription: 'SMF Quanta Batteries 12V 200AH Unit 3',
        status: 'Pending Verification',
        serialNumber: '',
        date: '2026-02-01',
        purchaseDate: '2026-02-01',
        purchaseCost: 0,
        currentValue: 0,
        category: 'A800',
        currentCategory: 'A800',
        department: 'Production',
        plant: 'Noida Plant',
        location: 'Noida Plant',
        assetCondition: '',
        assignedTo: '',
      },
      {
        id: 'imported-8107894-4',
        assetCode: '8107894',
        assetTag: '8107894',
        companyCode: '5030',
        company: 'Padget',
        assetClass: 'A800',
        name: 'Padget SMT Feeder Unit 1',
        currentDescription: 'Padget SMT Feeder Unit 1',
        status: 'Pending Verification',
        serialNumber: '',
        date: '2026-02-01',
        purchaseDate: '2026-02-01',
        purchaseCost: 0,
        currentValue: 0,
        category: 'A800',
        currentCategory: 'A800',
        department: 'Production',
        plant: 'Noida Plant',
        location: 'Noida Plant',
        assetCondition: '',
        assignedTo: '',
      },
      {
        id: 'imported-8107895-5',
        assetCode: '8107895',
        assetTag: '8107895',
        companyCode: '5030',
        company: 'Padget',
        assetClass: 'A800',
        name: 'Padget SMT Feeder Unit 2',
        currentDescription: 'Padget SMT Feeder Unit 2',
        status: 'Pending Verification',
        serialNumber: '',
        date: '2026-02-01',
        purchaseDate: '2026-02-01',
        purchaseCost: 0,
        currentValue: 0,
        category: 'A800',
        currentCategory: 'A800',
        department: 'Production',
        plant: 'Noida Plant',
        location: 'Noida Plant',
        assetCondition: '',
        assignedTo: '',
      },
    ]

    localStorage.setItem('meridian_assets', JSON.stringify(initialTasks))

    render(<App />)

    // Verify task dashboard rendered
    await waitFor(() => {
      expect(screen.getByText(/Asset Code Task Dashboard/i)).toBeInTheDocument()
    })

    // Initially: 5 pending, 0 completed
    expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)

    // Click "Select code" for only the FIRST asset (8107891)
    const selectButtons = screen.getAllByRole('button', { name: /Select code/i })
    expect(selectButtons.length).toBeGreaterThan(0)
    fireEvent.click(selectButtons[0])

    // The AddAssetPanel opens in "Complete 8107891" mode
    await waitFor(() => {
      expect(screen.getByText(/Complete 8107891/i)).toBeInTheDocument()
    })

    // User fills in ONLY physical missing details for this single asset
    fireEvent.change(screen.getByLabelText(/Serial number/i), {
      target: { value: 'SN-BAT-8107891-AA' },
    })

    // Select asset condition
    fireEvent.change(screen.getByLabelText(/Asset condition/i), {
      target: { value: 'Operational - Good' },
    })

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Submit and mark Completed/i }))

    // Invariant: Exactly ONE asset completed, exactly 4 assets remain Pending!
    await waitFor(() => {
      expect(screen.getAllByText('1').length).toBeGreaterThan(0) // Completed / Filled
      expect(screen.getAllByText('4').length).toBeGreaterThan(0) // Pending Data Entry
    })
  })

  it('Self-heals legacy bulk-overwritten state where 288 assets had duplicate code 5020', () => {
    // Create corrupted state with 288 duplicated assets marked completed
    const corruptedTasks: Asset[] = []
    for (let i = 1; i <= 288; i++) {
      corruptedTasks.push({
        id: 'imported-5020',
        assetCode: '5020',
        companyCode: '5020',
        company: 'ismartu',
        name: 'SMF Quanta Batteries',
        status: 'Completed',
        serialNumber: 'SN-OVERWRITTEN',
        assetCondition: 'Operational',
      } as Asset)
    }
    for (let i = 1; i <= 212; i++) {
      corruptedTasks.push({
        id: 'imported-5030',
        assetCode: '5030',
        companyCode: '5030',
        company: 'Padget',
        name: 'Padget Unit',
        status: 'Pending Verification',
        serialNumber: '',
      } as Asset)
    }

    localStorage.setItem('meridian_assets', JSON.stringify(corruptedTasks))

    render(<App />)

    // Verify self-healing hook kept only 1 as completed and restored the other 287 to pending!
    waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument() // Exactly 1 completed
      expect(screen.getByText('499')).toBeInTheDocument() // 499 pending
    })
  })

  it('isAssetTaskCompleted returns false for incomplete/empty assets even if status is Completed', () => {
    const emptyCompletedAsset: Asset = {
      id: 'imported-5020',
      assetCode: '5020',
      name: '5020',
      status: 'Completed',
      serialNumber: '',
      assetCondition: '',
      inChargeName: '',
      inChargeId: '',
      whoInCharge: 'Unassigned Staff',
    } as Asset

    expect(isAssetTaskCompleted(emptyCompletedAsset)).toBe(false)
  })
})
