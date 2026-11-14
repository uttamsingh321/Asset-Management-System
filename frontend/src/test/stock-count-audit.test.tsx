import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IndiaStockCountView } from '@/components/IndiaStockCountView'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'

const itUser: UserProfile = {
  userId: 'EMP-IT-01',
  userName: 'Rajesh IT Auditor',
  role: 'Auditor',
  department: 'IT',
  isSuperuser: false,
}


const mockAssets: Asset[] = [
  {
    id: 'asset-it-101',
    assetCode: '2004218',
    assetTag: '2004218',
    serialNumber: 'SN-IT-8811',
    date: '2026-11-14',
    purchaseDate: '2026-11-14',
    name: 'Dell Precision Workstation',
    currentDescription: 'Dell Precision Workstation',
    category: 'Workstations',
    currentCategory: 'Workstations',
    department: 'IT',
    currentDepartment: 'IT',
    company: 'IIPL',
    plant: 'Noida Central Plant',
    building: 'C39',
    floor: '2F',
    location: 'C39-2F Bay 14',
    currentLocation: 'C39-2F Bay 14',
    inChargeId: 'EMP-IT-01',
    inChargeName: 'Rajesh Kumar',
    whoInCharge: 'EMP-IT-01 · Rajesh Kumar',
    assetCondition: 'Operational - Excellent',
    status: 'Completed',
    purchaseCost: 80000,
    currentValue: 70000,
    assignedTo: 'Rajesh Kumar',
  },
  {
    id: 'asset-smt-202',
    assetCode: '3009955',
    assetTag: '3009955',
    serialNumber: 'SN-SMT-7722',
    date: '2026-11-14',
    purchaseDate: '2026-11-14',
    name: 'SMT Solder Printer Alpha',
    currentDescription: 'SMT Solder Printer Alpha',
    category: 'SMT Machinery',
    currentCategory: 'SMT Machinery',
    department: 'SMT Operations',
    currentDepartment: 'SMT Operations',
    company: 'Padget',
    plant: 'Padget Unit 2',
    building: 'D197',
    floor: '1F',
    location: 'D197-1F Line 3',
    currentLocation: 'D197-1F Line 3',
    inChargeId: 'EMP-SMT-02',
    inChargeName: 'Suresh Kumar',
    whoInCharge: 'EMP-SMT-02 · Suresh Kumar',
    assetCondition: 'Operational - Good',
    status: 'Completed',
    purchaseCost: 1500000,
    currentValue: 1400000,
    assignedTo: 'Suresh Kumar',
  },
]

describe('Stock Count Verification Workflow with Strict QR Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unit test offline fallback')))
  })

  it('Flow Step 1: User clicks "Start Count" and loads only assets assigned to that Stock Count, Plant, Department, and User', () => {
    render(
      <IndiaStockCountView
        lang="en"
        assets={mockAssets}
        currentUser={itUser}
      />
    )

    // Displays Q4 Annual Stock Count for IT
    expect(screen.getByText(/Q4 Annual Stock Count – IT/i)).toBeInTheDocument()

    // 2 tasks exist: IT and SMT. SMT count button must be disabled for IT user!
    const startCountBtns = screen.getAllByRole('button', { name: /Start Count/i })
    expect(startCountBtns.length).toBe(2)
    expect(startCountBtns[0]).not.toBeDisabled() // IT Task
    expect(startCountBtns[1]).toBeDisabled() // SMT Task disabled for IT auditor

    // Click "Start Count" on IT task
    fireEvent.click(startCountBtns[0])

    // Enters active session workspace
    expect(screen.getByText(/Verification Progress:/i)).toBeInTheDocument()
    expect(screen.getByText('2004218')).toBeInTheDocument()
    expect(screen.getByText('Dell Precision Workstation')).toBeInTheDocument()

    // SMT asset should NOT be in the IT stock count
    expect(screen.queryByText('3009955')).not.toBeInTheDocument()
  })

  it('Flow Step 2 & 3: Strict QR validation denies cross-department QR and mismatched asset QR codes', async () => {
    render(
      <IndiaStockCountView
        lang="en"
        assets={mockAssets}
        currentUser={itUser}
      />
    )

    // Start IT Count
    const startCountBtns = screen.getAllByRole('button', { name: /Start Count/i })
    fireEvent.click(startCountBtns[0])

    // Click "Scan QR" on 2004218
    const scanBtn = screen.getByRole('button', { name: /Scan QR$/i })
    fireEvent.click(scanBtn)

    expect(screen.getByText(/Physical QR Code Scanner/i)).toBeInTheDocument()

    // 1. Test scanning non-existent QR
    const input = screen.getByPlaceholderText(/Scan or enter asset code/i)
    fireEvent.change(input, { target: { value: 'NONEXISTENT-999' } })
    fireEvent.click(screen.getByRole('button', { name: /Validate QR/i }))

    await waitFor(() => {
      expect(screen.getByText(/Validation Denied/i)).toBeInTheDocument()
      expect(screen.getByText(/does not exist in asset database/i)).toBeInTheDocument()
    })

    // 2. Test scanning QR belonging to another department (SMT asset 3009955 while in IT count)
    fireEvent.change(input, { target: { value: '3009955' } })
    fireEvent.click(screen.getByRole('button', { name: /Validate QR/i }))

    await waitFor(() => {
      expect(screen.getByText(/Validation Denied/i)).toBeInTheDocument()
      expect(screen.getByText(/A QR can only open its own linked asset/i)).toBeInTheDocument()
    })
  })

  it('Flow Step 3 & 4: Valid QR scan opens complete Asset Details, and "Information Correct" marks as Verified', async () => {
    render(
      <IndiaStockCountView
        lang="en"
        assets={mockAssets}
        currentUser={itUser}
      />
    )

    // Start count
    const startCountBtns = screen.getAllByRole('button', { name: /Start Count/i })
    fireEvent.click(startCountBtns[0])

    // Open scanner
    fireEvent.click(screen.getByRole('button', { name: /Scan QR$/i }))

    // Scan the matching QR code for 2004218
    const input = screen.getByPlaceholderText(/Scan or enter asset code/i)
    fireEvent.change(input, { target: { value: '2004218' } })
    fireEvent.click(screen.getByRole('button', { name: /Validate QR/i }))

    // Validation passes and opens Asset Details Verification dialog
    await waitFor(() => {
      expect(screen.getByText('Asset Details Verification')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Information Correct/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Information Incorrect/i })).toBeInTheDocument()
    })

    // Click "Information Correct"
    fireEvent.click(screen.getByRole('button', { name: /Information Correct/i }))

    // Status updates to Verified
    await waitFor(() => {
      expect(screen.getByText(/✅ Verified Normal/i)).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  it('Flow Step 4 & 5: "Information Incorrect" locks restricted fields, allows permitted edits, and creates Variance', async () => {
    const onUpdateAsset = vi.fn()

    render(
      <IndiaStockCountView
        lang="en"
        assets={mockAssets}
        currentUser={itUser}
        onUpdateAsset={onUpdateAsset}
      />
    )

    // Start count
    const startCountBtns = screen.getAllByRole('button', { name: /Start Count/i })
    fireEvent.click(startCountBtns[0])

    // Open scanner and validate matching QR
    fireEvent.click(screen.getByRole('button', { name: /Scan QR$/i }))
    const input = screen.getByPlaceholderText(/Scan or enter asset code/i)
    fireEvent.change(input, { target: { value: '2004218' } })
    fireEvent.click(screen.getByRole('button', { name: /Validate QR/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Information Incorrect/i })).toBeInTheDocument()
    })

    // Click "Information Incorrect"
    fireEvent.click(screen.getByRole('button', { name: /Information Incorrect/i }))

    // Switches to Variance Record Mode with locked restricted fields
    expect(screen.getByText(/🔒 Asset Code \(Locked\):/i)).toBeInTheDocument()
    expect(screen.getByText(/🔒 Serial Number \(Locked\):/i)).toBeInTheDocument()

    // Permitted fields are editable
    const locationInput = screen.getByPlaceholderText(/e\.g\. Bay 14 Desk 4A/i)
    fireEvent.change(locationInput, { target: { value: 'Relocated to C39 3rd Floor Bay 22' } })

    const remarksInput = screen.getByPlaceholderText(/Explain what physical discrepancy was observed/i)
    fireEvent.change(remarksInput, { target: { value: 'Equipment moved without transfer permit' } })

    // Save Variance
    fireEvent.click(screen.getByRole('button', { name: /Save Variance & Update/i }))

    // Variance recorded
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View Variances \(1\)/i })).toBeInTheDocument()
      expect(onUpdateAsset).toHaveBeenCalled()
    })
  })
})
