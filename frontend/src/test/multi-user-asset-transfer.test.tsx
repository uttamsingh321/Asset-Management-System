import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IndiaTransferView } from '@/components/IndiaTransferView'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'

// ── Multi-User Roster ─────────────────────────────────────────────────────────

// 1. Requester: Floor Engineer who initiates equipment movement
const user1_Requester: UserProfile = {
  userId: 'EMP-REQ-01',
  userName: 'Anand Sharma',
  role: 'Engineer',
  department: 'SMT Operations',
  isSuperuser: false,
}

// 2. Unauthorized User: Warehouse Operator with no approval authority
const user_Unauthorized: UserProfile = {
  userId: 'EMP-WH-99',
  userName: 'Sunita Rao',
  role: 'Warehouse Staff',
  department: 'Warehouse',
  isSuperuser: false,
}

// 3. Stage 1 Approver: Chinese HOD (for Large Assets / Machinery)
const user2_ChineseHOD: UserProfile = {
  userId: 'EMP-CHOD-01',
  userName: 'Li Wei',
  role: 'Chinese HOD',
  department: 'Production',
  isSuperuser: false,
}

// 4. Stage 1 Approver for Small Asset: Department HOD
const user_HOD: UserProfile = {
  userId: 'EMP-HOD-01',
  userName: 'Manish Chauhan',
  role: 'Department Head (HOD)',
  department: 'SMT Operations',
  isSuperuser: false,
}

// 5. Stage 2 Approver: Finance Approver
const user3_Finance: UserProfile = {
  userId: 'EMP-FIN-01',
  userName: 'Radha Krishnan',
  role: 'Finance',
  department: 'Finance & Accounts',
  isSuperuser: false,
}

// 6. Stage 3 Approver: Samfu Boss / Super User
const user4_SamfuBoss: UserProfile = {
  userId: 'USR-ADMIN',
  userName: 'Samfu Boss',
  role: 'Samfu Boss',
  department: 'Executive Governance',
  isSuperuser: true,
}

// ── Enterprise Asset Fleet ───────────────────────────────────────────────────

const testAssets: Asset[] = [
  {
    id: 'asset-small-handheld',
    assetCode: 'AST-SCN-201',
    assetTag: 'AST-SCN-201',
    serialNumber: 'SN-SCN-771',
    date: '2026-01-10',
    purchaseDate: '2026-01-10',
    name: 'Honeywell Handheld Scanner',
    currentDescription: 'Honeywell Handheld Scanner',
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
    purchaseCost: 12000,
    currentValue: 10500,
    assetCondition: 'Operational - Good',
    assignedTo: 'EMP-REQ-01 · Anand Sharma',
    status: 'Completed',
  },
  {
    id: 'asset-large-mounter',
    assetCode: 'AST-MNT-889',
    assetTag: 'AST-MNT-889',
    serialNumber: 'SN-MNT-449',
    date: '2026-01-15',
    purchaseDate: '2026-01-15',
    name: 'Panasonic High-Speed Modular Mounter',
    currentDescription: 'Panasonic High-Speed Modular Mounter',
    category: 'SMT Machinery',
    currentCategory: 'SMT Machinery',
    department: 'SMT Operations',
    currentDepartment: 'SMT Operations',
    company: 'IIPL',
    plant: 'Noida Central Plant',
    building: 'C39',
    floor: '2F',
    location: 'C39-2F Cleanroom Bay 3',
    currentLocation: 'C39-2F Cleanroom Bay 3',
    inChargeId: 'EMP-REQ-01',
    inChargeName: 'Anand Sharma',
    whoInCharge: 'EMP-REQ-01 · Anand Sharma',
    purchaseCost: 1850000,
    currentValue: 1720000,
    assetCondition: 'Operational - Excellent',
    assignedTo: 'EMP-REQ-01 · Anand Sharma',
    status: 'Completed',
  },
]

describe('Multi-User Role Asset Transfer Simulation', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('meridian_assets', JSON.stringify(testAssets))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: async () => ({}) })))
  })

  it('Flow 1: Small Asset (<₹50k) 1-Level Approval (Requester -> HOD Approval -> Ledger Updated)', async () => {
    const onUpdateAsset = vi.fn()

    // ─────────────────────────────────────────────────────────────
    // ACT 1: USER 1 (Anand Sharma - Engineer) creates Small Asset Transfer
    // ─────────────────────────────────────────────────────────────
    const { unmount: unmountRequester } = render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user1_Requester}
        onUpdateAsset={onUpdateAsset}
      />
    )

    // Anand navigates to "New Transfer Form"
    fireEvent.click(screen.getByRole('button', { name: /New Transfer Form/i }))

    // Selects Small Asset AST-SCN-201
    fireEvent.click(screen.getByRole('button', { name: /AST-SCN-201/i }))

    // System automatically identifies 1-Level Approval for Small Asset
    expect(screen.getByText(/1-Level Approval:/i)).toBeDefined()
    expect(screen.getByText(/HOD only/i)).toBeDefined()

    // Enters destination and operational rationale
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Building C39 - 2nd Floor/i), {
      target: { value: 'C39-3F QC Testing Lab' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Explain the operational necessity/i), {
      target: { value: 'Relocating scanner for emergency QC batch verification.' },
    })

    // Submits request
    fireEvent.click(screen.getByRole('button', { name: /Submit Transfer Request/i }))

    // Anand sees it under My Requests in Stage 1 of 1: Awaiting HOD
    await waitFor(() => {
      expect(screen.getByText(/Stage 1 of 1: Awaiting HOD/i)).toBeDefined()
    })

    unmountRequester()

    // ─────────────────────────────────────────────────────────────
    // ACT 2: UNAUTHORIZED USER (Sunita Rao - Warehouse) tries to review
    // ─────────────────────────────────────────────────────────────
    const { unmount: unmountUnauth } = render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user_Unauthorized}
        onUpdateAsset={onUpdateAsset}
      />
    )

    // Sunita navigates to Pending Approvals: It should NOT show this transfer for her
    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.queryByText(/AST-SCN-201/i)).toBeNull()
    expect(screen.getByText(/No Pending Approvals/i)).toBeDefined()

    unmountUnauth()

    // ─────────────────────────────────────────────────────────────
    // ACT 3: USER 2 (Manish Chauhan - Department Head HOD) logs in & approves
    // ─────────────────────────────────────────────────────────────
    render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user_HOD}
        onUpdateAsset={onUpdateAsset}
      />
    )

    // Manish sees the actionable request under Pending Approvals
    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.getByText(/AST-SCN-201/i)).toBeDefined()

    // Find the specific card for AST-SCN-201 using regex
    const card = screen.getByText(/AST-SCN-201/).closest('div.card') as HTMLElement
    expect(within(card).getByText(/Awaiting: HOD/i)).toBeDefined()

    // Manish clicks Review & Approve on AST-SCN-201
    fireEvent.click(within(card).getByRole('button', { name: /Review & Approve/i }))

    // Confirms approval in modal
    fireEvent.click(screen.getByRole('button', { name: /Confirm Approve/i }))

    // Invariant: Asset registry ledger updated with destination location & department!
    await waitFor(() => {
      expect(onUpdateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          assetCode: 'AST-SCN-201',
          location: 'C39-3F QC Testing Lab',
        })
      )
    })
  })

  it('Flow 2: Large Asset 3-Level Sequential Approval (Requester -> Chinese HOD -> Finance -> Samfu Boss)', async () => {
    const onUpdateAsset = vi.fn()

    // ─────────────────────────────────────────────────────────────
    // ACT 1: USER 1 (Anand Sharma - Engineer) creates Large Machinery Transfer
    // ─────────────────────────────────────────────────────────────
    const { unmount: unmountRequester } = render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user1_Requester}
        onUpdateAsset={onUpdateAsset}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /New Transfer Form/i }))

    // Anand selects Panasonic Mounter (AST-MNT-889, ₹18.5 Lakhs)
    fireEvent.click(screen.getByRole('button', { name: /AST-MNT-889/i }))

    // System enforces 3-level sequential approval for Large Asset
    expect(screen.getByText(/3-Level Sequential Approval:/i)).toBeDefined()
    expect(screen.getByText(/Level 1: Chinese HOD → Level 2: Finance Department → Level 3: Samfu Boss/i)).toBeDefined()

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Building C39 - 2nd Floor/i), {
      target: { value: 'D198-1F Line 4 Modular Bay' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Explain the operational necessity/i), {
      target: { value: 'High precision mounter re-allocated for Padget Project B production rush.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit Transfer Request/i }))

    await waitFor(() => {
      expect(screen.getByText(/Stage 1 of 3: Awaiting Chinese HOD/i)).toBeDefined()
    })

    unmountRequester()

    // ─────────────────────────────────────────────────────────────
    // ACT 2: USER 3 (Finance) logs in early -> Queue-jumping prevented!
    // ─────────────────────────────────────────────────────────────
    const { unmount: unmountFinEarly } = render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user3_Finance}
        onUpdateAsset={onUpdateAsset}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    // Finance cannot see or approve Stage 1 (only Chinese HOD can)
    expect(screen.queryByText(/AST-MNT-889/i)).toBeNull()

    unmountFinEarly()

    // ─────────────────────────────────────────────────────────────
    // ACT 3: USER 2 (Li Wei - Chinese HOD) approves Stage 1
    // ─────────────────────────────────────────────────────────────
    const { unmount: unmountChod } = render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user2_ChineseHOD}
        onUpdateAsset={onUpdateAsset}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.getByText(/AST-MNT-889/i)).toBeDefined()

    const chodCard = screen.getByText(/AST-MNT-889/).closest('div.card') as HTMLElement
    expect(within(chodCard).getByText(/Awaiting: Chinese HOD/i)).toBeDefined()

    // Li Wei reviews and approves Stage 1
    fireEvent.click(within(chodCard).getByRole('button', { name: /Review & Approve/i }))
    fireEvent.change(screen.getByPlaceholderText(/Add optional approval notes/i), {
      target: { value: 'Technical line balance verified. Padget Project B approved.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirm Approve/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Confirm Approve/i)).toBeNull()
    })

    unmountChod()

    // ─────────────────────────────────────────────────────────────
    // ACT 4: USER 3 (Radha Krishnan - Finance) approves Stage 2
    // ─────────────────────────────────────────────────────────────
    const { unmount: unmountFin } = render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user3_Finance}
        onUpdateAsset={onUpdateAsset}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.getAllByText(/AST-MNT-889/i).length).toBeGreaterThan(0)

    const finCard = screen.getAllByText(/AST-MNT-889/)[0].closest('div.card') as HTMLElement
    expect(within(finCard).getByText(/Awaiting: Finance/i)).toBeDefined()

    // Radha reviews and approves Stage 2
    fireEvent.click(within(finCard).getByRole('button', { name: /Review & Approve/i }))
    fireEvent.change(screen.getByPlaceholderText(/Add optional approval notes/i), {
      target: { value: 'CapEx cost center re-allocation cleared.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirm Approve/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Confirm Approve/i)).toBeNull()
    })

    unmountFin()

    // ─────────────────────────────────────────────────────────────
    // ACT 5: USER 4 (Samfu Boss - Super User) grants Final Stage 3 Approval
    // ─────────────────────────────────────────────────────────────
    render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user4_SamfuBoss}
        onUpdateAsset={onUpdateAsset}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    expect(screen.getAllByText(/AST-MNT-889/i).length).toBeGreaterThan(0)

    const bossCard = screen.getAllByText(/AST-MNT-889/)[0].closest('div.card') as HTMLElement
    expect(within(bossCard).getByText(/Awaiting: Samfu Boss/i)).toBeDefined()

    // Samfu Boss executes Final Approval
    fireEvent.click(within(bossCard).getByRole('button', { name: /Review & Approve/i }))
    fireEvent.change(screen.getByPlaceholderText(/Add optional approval notes/i), {
      target: { value: 'Executive clearance granted. Move asset tonight.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirm Approve/i }))

    // All 3 stages complete: physical registry updated!
    await waitFor(() => {
      expect(onUpdateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          assetCode: 'AST-MNT-889',
          location: 'D198-1F Line 4 Modular Bay',
        })
      )
    })
  })

  it('Flow 3: Rejection terminates workflow immediately and records approver justification', async () => {
    // 1. Requester creates request
    const { unmount: unmountRequester } = render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user1_Requester}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /New Transfer Form/i }))
    fireEvent.click(screen.getByRole('button', { name: /AST-MNT-889/i }))
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Building C39 - 2nd Floor/i), {
      target: { value: 'D199-Warehouse Reserve' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Explain the operational necessity/i), {
      target: { value: 'Moving to warehouse as standby.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Transfer Request/i }))

    await waitFor(() => {
      expect(screen.getByText(/Stage 1 of 3: Awaiting Chinese HOD/i)).toBeDefined()
    })

    unmountRequester()

    // 2. Chinese HOD decides to reject
    render(
      <IndiaTransferView
        assets={testAssets}
        lang="en"
        currentUser={user2_ChineseHOD}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pending Approvals/i }))
    const chodCard = screen.getByText(/AST-MNT-889/).closest('div.card') as HTMLElement
    const rejectBtn = within(chodCard).getByRole('button', { name: /^Reject$/i })
    fireEvent.click(rejectBtn)

    // Enters rejection rationale
    fireEvent.change(screen.getByPlaceholderText(/State clearly why this transfer is rejected/i), {
      target: { value: 'Critical SMT Line 1 production cannot spare this mounter.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirm Reject/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Confirm Reject/i)).toBeNull()
    })

    // Check registry: Status is Rejected by Chinese HOD with the rationale displayed
    fireEvent.click(screen.getByRole('button', { name: /All Transfers Registry/i }))
    await waitFor(() => {
      const rejectedCards = screen.getAllByText(/AST-MNT-889/)
      expect(rejectedCards.length).toBeGreaterThan(0)
      const rejectedCard = rejectedCards[0].closest('div.card') as HTMLElement
      expect(within(rejectedCard).getByText(/✕ Rejected by Chinese HOD/i)).toBeDefined()
      expect(
        within(rejectedCard).getAllByText(/Critical SMT Line 1 production cannot spare this mounter/i).length
      ).toBeGreaterThan(0)
    })
  })
})
