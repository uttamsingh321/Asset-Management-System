import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IndiaLabelPrintView } from '@/components/IndiaLabelPrintView'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'
import {
  getAssetPrintRecord,
  getReprintRequests,
  recordAssetPrint,
  createReprintRequest,
  approveReprintRequest,
} from '@/lib/labelReprintService'

const mockNormalUser: UserProfile = {
  userId: 'USR-OPERATOR-01',
  userName: 'Suresh Raina',
  role: 'Floor Supervisor',
  department: 'SMT Operations',
  isSuperuser: false,
}

const mockSuperUser: UserProfile = {
  userId: 'USR-ADMIN',
  userName: 'Samfu Super User',
  role: 'Super User',
  department: 'Corporate Governance',
  isSuperuser: true,
}

const testAsset: Asset = {
  id: 'asset-8107891',
  assetCode: '8107891',
  serialNumber: 'SN-8107891-SMT',
  name: 'SMT Quanta High-Speed Mounter',
  currentDescription: 'SMT Quanta High-Speed Mounter',
  currentCategory: 'Machinery',
  department: 'SMT Operations',
  currentDepartment: 'SMT Operations',
  inChargeId: 'EMP-304',
  inChargeName: 'Manish Chauhan',
  whoInCharge: 'EMP-304 · Manish Chauhan',
  building: 'C39',
  floor: '1F',
  currentLocation: 'Cleanroom Line A',
  purchaseDate: '2026-02-01',
  date: '2026-02-01',
  status: 'Completed',
  plant: 'Noida Central Plant',
  company: 'IIPL',
  assetTag: '8107891',
  category: 'Machinery',
  assetCondition: 'Operational - Good',
  purchaseCost: 250000,
  currentValue: 220000,
  assignedTo: 'Manish Chauhan',
  location: 'C39-1F',
}

describe('Enterprise Single-Print & Super User Re-print Approval Rule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('Initial State: allows normal user to print the label for the first time', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    // Button should indicate ready for first print
    const printBtn = screen.getByRole('button', { name: /Print "8107891" Label/i })
    expect(printBtn).toBeInTheDocument()
    expect(printBtn).not.toBeDisabled()

    // Print once
    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalledTimes(1)

    // Print record is persisted in localStorage with count 1
    const record = getAssetPrintRecord(testAsset.id, testAsset.assetCode)
    expect(record).not.toBeNull()
    expect(record?.printCount).toBe(1)
    expect(record?.lastPrintedBy).toBe('Suresh Raina')
  })

  it('Single-Print Rule: strictly locks re-printing for normal users once printed once', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    // Pre-record that asset was already printed 1 time
    recordAssetPrint(testAsset.id, testAsset.assetCode, mockNormalUser)

    render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    // 1. Shows "Single-Print Policy Enforced: Duplicate Printing Locked" warning banner
    expect(
      screen.getByText(/Single-Print Policy Enforced: Duplicate Printing Locked/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Printed 1 time/i)).toBeInTheDocument()

    // 2. The primary print button is locked and disabled
    const lockedBtn = screen.getByRole('button', { name: /QR Print Locked \(Already Printed\)/i })
    expect(lockedBtn).toBeDisabled()

    // Clicking does NOT trigger window.print
    fireEvent.click(lockedBtn)
    expect(printSpy).not.toHaveBeenCalled()

    // 3. Prominent "Request Re-print from Super User" button is visible
    const requestBtns = screen.getAllByRole('button', { name: /Request Re-print from Super User/i })
    expect(requestBtns.length).toBeGreaterThan(0)
  })

  it('Re-print Workflow: normal user submits request and status transitions to Pending', async () => {
    recordAssetPrint(testAsset.id, testAsset.assetCode, mockNormalUser)

    render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    // Click "Request Re-print from Super User"
    const requestBtn = screen.getAllByRole('button', { name: /Request Re-print from Super User/i })[0]
    fireEvent.click(requestBtn)

    // Modal opens
    expect(screen.getByText(/Request Re-print Authorization/i)).toBeInTheDocument()
    expect(screen.getByText(/Super User approval required to re-print asset tag/i)).toBeInTheDocument()

    // Select reason: "Label Damaged / Scratched"
    const reasonSelect = screen.getByRole('combobox')
    fireEvent.change(reasonSelect, { target: { value: 'Label Damaged / Scratched' } })

    // Enter notes
    const notesArea = screen.getByPlaceholderText(/Explain why the physical tag requires replacement/i)
    fireEvent.change(notesArea, { target: { value: 'Barcode was scratched during machine cleaning.' } })

    // Submit request
    const submitBtn = screen.getByRole('button', { name: /Submit Request to Super User/i })
    fireEvent.click(submitBtn)

    // Request is created in storage
    const requests = getReprintRequests()
    expect(requests.length).toBe(1)
    expect(requests[0].assetCode).toBe('8107891')
    expect(requests[0].requestedBy).toBe('Suresh Raina')
    expect(requests[0].reason).toBe('Label Damaged / Scratched')
    expect(requests[0].status).toBe('pending')

    // Modal closes and alert updates to Pending
    await waitFor(() => {
      expect(screen.getByText(/Re-print Request Pending Super User Approval/i)).toBeInTheDocument()
      expect(screen.getByText(/Under Review/i)).toBeInTheDocument()
    })
  })

  it('Super User Approval: grants single-use permit, allowing normal user to print one time', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    // 1. Initial print
    recordAssetPrint(testAsset.id, testAsset.assetCode, mockNormalUser)

    // 2. Normal user creates request
    const req = createReprintRequest({
      assetId: testAsset.id,
      assetCode: testAsset.assetCode,
      assetName: testAsset.name,
      requester: mockNormalUser,
      reason: 'Label Peeled Off / Lost',
      notes: 'Tag fell off heat pipe.',
    })

    // 3. Super User reviews and approves request
    approveReprintRequest(req.id, mockSuperUser, 'Approved replacement tag')

    // 4. Normal user views the page now
    render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    // Shows "Re-print Authorized by Super User"
    expect(screen.getByText(/Re-print Authorized by Super User/i)).toBeInTheDocument()
    expect(screen.getByText(/Single-Use Permit Valid/i)).toBeInTheDocument()

    // Print button is unlocked with approved badge
    const approvedPrintBtns = screen.getAllByRole('button', { name: /Print Approved Re-print/i })
    expect(approvedPrintBtns.length).toBeGreaterThan(0)
    expect(approvedPrintBtns[0]).not.toBeDisabled()

    // Normal user prints the approved re-print
    fireEvent.click(approvedPrintBtns[0])
    expect(printSpy).toHaveBeenCalledTimes(1)

    // Print count is now 2
    const updatedRecord = getAssetPrintRecord(testAsset.id, testAsset.assetCode)
    expect(updatedRecord?.printCount).toBe(2)

    // Approved request token is marked as consumed
    const updatedRequests = getReprintRequests()
    expect(updatedRequests[0].isUsed).toBe(true)
    expect(updatedRequests[0].usedBy).toBe('Suresh Raina')
  })

  it('Bulk Print Safeguard: prevents duplicate prints when multiple assets are selected', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    const unprintedAsset2: Asset = {
      ...testAsset,
      id: 'asset-990001',
      assetCode: '990001',
    }

    // testAsset is already printed once
    recordAssetPrint(testAsset.id, testAsset.assetCode, mockNormalUser)

    render(
      <IndiaLabelPrintView
        assets={[testAsset, unprintedAsset2]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    // Click "Select Ready"
    const selectReadyBtn = screen.getByRole('button', { name: /Select Ready/i })
    fireEvent.click(selectReadyBtn)

    // The bulk print button should only contain the 1 unprinted asset (990001)
    const bulkBtn = screen.getByRole('button', { name: /Print 1 Selected Labels/i })
    expect(bulkBtn).toBeInTheDocument()

    fireEvent.click(bulkBtn)
    expect(printSpy).toHaveBeenCalledTimes(1)

    // 990001 now recorded as printed, while testAsset remains at 1
    expect(getAssetPrintRecord('asset-990001', '990001')?.printCount).toBe(1)
    expect(getAssetPrintRecord(testAsset.id, testAsset.assetCode)?.printCount).toBe(1)
  })
})
