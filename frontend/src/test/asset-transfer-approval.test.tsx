import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IndiaTransferView } from '@/components/IndiaTransferView'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'

const requesterUser: UserProfile = {
  userId: 'EMP-REQ-01',
  userName: 'Anand Sharma',
  role: 'Engineer',
  department: 'SMT Operations',
  isSuperuser: false,
}

const chineseHodUser: UserProfile = {
  userId: 'EMP-CHOD-01',
  userName: 'Li Wei',
  role: 'Chinese HOD',
  department: 'Production',
  isSuperuser: false,
}

const financeUser: UserProfile = {
  userId: 'EMP-FIN-01',
  userName: 'Pooja Agarwal',
  role: 'Finance Approver',
  department: 'Finance',
  isSuperuser: false,
}

const samfuBossUser: UserProfile = {
  userId: 'EMP-BOSS-01',
  userName: 'Samfu Boss',
  role: 'Samfu Boss',
  department: 'Executive',
  isSuperuser: true,
}

const mockAssets: Asset[] = [
  {
    id: 'asset-tr-target',
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
    inChargeId: 'EMP-105',
    inChargeName: 'Rajesh Kumar',
    whoInCharge: 'EMP-105 · Rajesh Kumar',
    purchaseCost: 95000,
    currentValue: 85000,
    assetCondition: 'Operational - Excellent',
    assignedTo: 'EMP-105 · Rajesh Kumar',
    status: 'Completed',
  },
  {
    id: 'asset-small-1',
    assetCode: 'AST-BAR-001',
    assetTag: 'AST-BAR-001',
    serialNumber: 'SN-001',
    date: '2026-11-14',
    purchaseDate: '2026-11-14',
    name: 'Barcode Scanner Gun',
    currentDescription: 'Barcode Scanner Gun',
    category: 'Handheld Scanners',
    currentCategory: 'Handheld Scanners',
    department: 'SMT Operations',
    currentDepartment: 'SMT Operations',
    company: 'IIPL',
    plant: 'Noida Central Plant',
    building: 'C39',
    floor: '1F',
    location: 'C39-1F Line 1',
    currentLocation: 'C39-1F Line 1',
    inChargeId: 'EMP-REQ-01',
    inChargeName: 'Anand Sharma',
    whoInCharge: 'EMP-REQ-01 · Anand Sharma',
    purchaseCost: 8000,
    currentValue: 7000,
    assetCondition: 'Operational - Excellent',
    assignedTo: 'EMP-REQ-01 · Anand Sharma',
    status: 'Completed',
  },
  {
    id: 'asset-large-1',
    assetCode: 'AST-AOI-999',
    assetTag: 'AST-AOI-999',
    serialNumber: 'SN-999',
    date: '2026-11-14',
    purchaseDate: '2026-11-14',
    name: 'Automated Optical Inspection System',
    currentDescription: 'Automated Optical Inspection System',
    category: 'SMT Machinery',
    currentCategory: 'SMT Machinery',
    department: 'SMT Operations',
    currentDepartment: 'SMT Operations',
    company: 'IIPL',
    plant: 'Noida Central Plant',
    building: 'C39',
    floor: '2F',
    location: 'C39-2F Bay 4',
    currentLocation: 'C39-2F Bay 4',
    inChargeId: 'EMP-REQ-01',
    inChargeName: 'Anand Sharma',
    whoInCharge: 'EMP-REQ-01 · Anand Sharma',
    purchaseCost: 850000,
    currentValue: 750000,
    assetCondition: 'Operational - Good',
    assignedTo: 'EMP-REQ-01 · Anand Sharma',
    status: 'Completed',
  },
]

describe('Asset Transfer Approval Workflow (RBAC & Sequential Stage Invariants)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: async () => ({}) })))
  })

  it('Requirement 1: Small Asset Transfer requires 1 approval only (HOD)', async () => {
    render(
      <IndiaTransferView
        assets={mockAssets}
        lang="en"
        currentUser={requesterUser}
      />
    )

    // Switch to New Transfer Form tab
    const newTransferTab = screen.getByRole('button', { name: /New Transfer Form/i })
    fireEvent.click(newTransferTab)

    // Select Small Asset chip
    const smallAssetChip = screen.getByRole('button', { name: /AST-BAR-001/i })
    fireEvent.click(smallAssetChip)

    // Transfer type should automatically be Small Asset (1-Level HOD only)
    expect(screen.getByText(/1-Level Approval:/i)).toBeDefined()
    expect(screen.getByText(/HOD only/i)).toBeDefined()

    // Fill mandatory destination fields
    const toLocationInput = screen.getByPlaceholderText(/e\.g\. Building C39 - 2nd Floor/i)
    fireEvent.change(toLocationInput, { target: { value: 'D198-1F Quality Room' } })

    const reasonInput = screen.getByPlaceholderText(/Explain the operational necessity/i)
    fireEvent.change(reasonInput, { target: { value: 'Repositioning scanner for QC audit' } })

    // Submit transfer request
    const submitBtn = screen.getByRole('button', { name: /Submit Transfer Request/i })
    fireEvent.click(submitBtn)

    // Should return to My Requests and display pending HOD with Stage 1 of 1
    await waitFor(() => {
      expect(screen.getByText(/Stage 1 of 1: Awaiting HOD/i)).toBeDefined()
    })
  })

  it('Requirement 2: Large Asset Transfer requires 3 sequential approvals (Chinese HOD -> Finance -> Samfu Boss)', async () => {
    render(
      <IndiaTransferView
        assets={mockAssets}
        lang="en"
        currentUser={requesterUser}
      />
    )

    // Switch to New Transfer tab
    fireEvent.click(screen.getByRole('button', { name: /New Transfer Form/i }))

    // Select Large Asset (High cost / Machinery)
    fireEvent.click(screen.getByRole('button', { name: /AST-AOI-999/i }))

    // System automatically determines Large Asset and displays 3-level sequential pathway
    expect(screen.getByText(/3-Level Sequential Approval:/i)).toBeDefined()

    // Fill form and submit
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Building C39 - 2nd Floor/i), {
      target: { value: 'D197-2F Line 4' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Explain the operational necessity/i), {
      target: { value: 'High precision AOI required for new PCB batch' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit Transfer Request/i }))

    // Should appear in My Requests as Pending Chinese HOD with 3 stages
    await waitFor(() => {
      expect(screen.getByText(/Stage 1 of 3: Awaiting Chinese HOD/i)).toBeDefined()
    })
  })

  it('Requirement 3 & 4: RBAC and Sequential Progression from Chinese HOD -> Finance -> Samfu Boss', async () => {
    const onUpdateAsset = vi.fn()

    // Step 1: Chinese HOD logs in and approves Level 1
    const { unmount: unmountChod } = render(
      <IndiaTransferView
        assets={mockAssets}
        lang="en"
        currentUser={chineseHodUser}
        onUpdateAsset={onUpdateAsset}
      />
    )

    // Chinese HOD should have pending approval for TR-2026-001 (initial mock transfer)
    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.getByText('TR-2026-001')).toBeDefined()
    expect(screen.getByText(/Awaiting: Chinese HOD/i)).toBeDefined()

    // Click Review & Approve
    fireEvent.click(screen.getAllByRole('button', { name: /Review & Approve/i })[0])

    // Approve Stage 1
    const approveModalBtn = screen.getByRole('button', { name: /Confirm Approve/i })
    fireEvent.click(approveModalBtn)

    // Wait for modal to close and state to commit to storage
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Approve/i)).toBeNull()
    })

    unmountChod()

    // Step 2: Finance User logs in and approves Level 2
    const { unmount: unmountFin } = render(
      <IndiaTransferView
        assets={mockAssets}
        lang="en"
        currentUser={financeUser}
        onUpdateAsset={onUpdateAsset}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.getByText('TR-2026-001')).toBeDefined()
    expect(screen.getByText(/Awaiting: Finance/i)).toBeDefined()

    // Review & Approve Stage 2
    fireEvent.click(screen.getAllByRole('button', { name: /Review & Approve/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /Confirm Approve/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Confirm Approve/i)).toBeNull()
    })

    unmountFin()

    // Step 3: Samfu Boss logs in and completes Final Stage 3 Approval
    render(
      <IndiaTransferView
        assets={mockAssets}
        lang="en"
        currentUser={samfuBossUser}
        onUpdateAsset={onUpdateAsset}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.getByText('TR-2026-001')).toBeDefined()
    expect(screen.getByText(/Awaiting: Samfu Boss/i)).toBeDefined()

    // Final Approval
    fireEvent.click(screen.getAllByRole('button', { name: /Review & Approve/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /Confirm Approve/i }))

    // Invariant: Asset physical registry updated on completion!
    await waitFor(() => {
      expect(onUpdateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          assetCode: '2004218',
          department: 'SMT Operations',
          location: 'D197-1F Production Line 2',
        })
      )
    })
  })

  it('Requirement 5: Rejection terminates workflow immediately and records reason', async () => {
    render(
      <IndiaTransferView
        assets={mockAssets}
        lang="en"
        currentUser={chineseHodUser}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    
    // Click Reject button directly on the actionable card
    const rejectBtns = screen.getAllByRole('button', { name: /^Reject$/i })
    fireEvent.click(rejectBtns[0])

    // Enter rejection remarks
    const commentInput = screen.getByPlaceholderText(/State clearly why this transfer is rejected/i)
    fireEvent.change(commentInput, {
      target: { value: 'Current production line does not have replacement unit available.' },
    })

    // Submit rejection
    fireEvent.click(screen.getByRole('button', { name: /Confirm Reject/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Confirm Reject/i)).toBeNull()
    })

    // Switch to All Transfers Registry tab to view terminated status
    fireEvent.click(screen.getByRole('button', { name: /All Transfers Registry/i }))

    await waitFor(() => {
      expect(screen.getByText(/✕ Rejected by Chinese HOD/i)).toBeDefined()
      expect(
        screen.getAllByText(/Current production line does not have replacement unit available/i).length
      ).toBeGreaterThanOrEqual(1)
    })
  })
})
