import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'
import {
  checkPrintEligibility,
  recordAssetPrint,
  createReprintRequest,
  approveReprintRequest,
  rejectReprintRequest,
  getAssetPrintStatus,
  getPrintStatusBadgeProps,
  isHODRole,
  isHODOrSuperUser,
  STORAGE_KEY_PRINT_RECORDS,
} from '@/lib/labelReprintService'
import { IndiaLabelPrintView } from '@/components/IndiaLabelPrintView'

const normalUser: UserProfile = {
  userId: 'EMP-PRD-101',
  userName: 'Ramesh Production',
  role: 'Employee',
  department: 'Production',
}

const hodUser: UserProfile = {
  userId: 'HOD-PRD-01',
  userName: 'Manish Chauhan (HOD)',
  role: 'Department Head (HOD)',
  department: 'Production',
}

const superUser: UserProfile = {
  userId: 'USR-ADMIN',
  userName: 'Uttam Singh',
  role: 'Admin',
  isSuperuser: true,
  department: 'IT',
}

const testAsset: Asset = {
  id: 'AST-TEST-5000507',
  assetCode: '5000507',
  serialNumber: '5486584658416489',
  name: 'Volumetric air tightness test equipment',
  currentCategory: 'SMT Test Equipment',
  currentDescription: 'Volumetric air tightness test equipment',
  company: 'Padget',
  companyCode: '9500',
  plant: 'Noida Plant',
  building: 'D197',
  floor: '1st Floor',
  currentLocation: 'SMT Line 1',
  department: 'Production',
  currentDepartment: 'Production',
  custodian: 'Uttam Singh',
  inChargeId: '19102709',
  inChargeName: 'Uttam Singh',
  submitter: 'atul - Uttam Singh (IT & Infrastructure)',
  purchaseDate: '2026-11-16',
  date: '2026-11-16',
  purchaseCost: 250000,
  currentValue: 240000,
  assetCondition: 'Good',
  status: 'Active',
  assetTag: '5000507',
  category: 'SMT Test Equipment',
  assignedTo: 'Uttam Singh',
  location: 'D197-1F',
}

describe('Secure QR Print Control & HOD Approval Workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as any
  })

  it('1. Verifies HOD role detection and authorization hierarchy', () => {
    expect(isHODRole(normalUser)).toBe(false)
    expect(isHODOrSuperUser(normalUser)).toBe(false)

    expect(isHODRole(hodUser)).toBe(true)
    expect(isHODOrSuperUser(hodUser)).toBe(true)

    expect(isHODOrSuperUser(superUser)).toBe(true)
  })

  it('2. Evaluates default single-print eligibility: allowed once, then locked', () => {
    // Before any print
    const eligInitial = checkPrintEligibility(testAsset, normalUser, true)
    expect(eligInitial.canPrint).toBe(true)
    expect(eligInitial.isFirstPrint).toBe(true)
    expect(eligInitial.printCount).toBe(0)
    expect(getAssetPrintStatus(testAsset)).toBe('Not Printed')

    // Execute first print
    const rec1 = recordAssetPrint(testAsset.id, testAsset.assetCode, normalUser)
    expect(rec1.printCount).toBe(1)
    expect(rec1.lastPrintedBy).toBe('Ramesh Production')

    // After first print: locked for normal user
    const eligAfter1 = checkPrintEligibility(testAsset, normalUser, true)
    expect(eligAfter1.canPrint).toBe(false)
    expect(eligAfter1.isReprintBlocked).toBe(true)
    expect(eligAfter1.printCount).toBe(1)
    expect(getAssetPrintStatus(testAsset)).toBe('Printed')
  })

  it('3. Enforces mandatory reason when submitting reprint request', () => {
    expect(() => {
      createReprintRequest({
        assetId: testAsset.id,
        assetCode: testAsset.assetCode,
        assetName: testAsset.name,
        requester: normalUser,
        reason: '   ', // Blank reason
      })
    }).toThrow(/mandatory reason/i)

    // Valid request succeeds
    const req = createReprintRequest({
      assetId: testAsset.id,
      assetCode: testAsset.assetCode,
      assetName: testAsset.name,
      requester: normalUser,
      reason: 'Label Damaged / Scratched',
      notes: 'Torn during calibration.',
    })
    expect(req.id).toMatch(/^RPT-REQ-/)
    expect(req.status).toBe('pending')
    expect(getAssetPrintStatus(testAsset)).toBe('Reprint Pending')
  })

  it('4. HOD approves request -> exactly 1 print unlocked -> re-locks automatically after reprint', () => {
    // 1st print
    recordAssetPrint(testAsset.id, testAsset.assetCode, normalUser)

    // Normal user requests reprint
    const req = createReprintRequest({
      assetId: testAsset.id,
      assetCode: testAsset.assetCode,
      assetName: testAsset.name,
      requester: normalUser,
      reason: 'Defective Sticker / Re-application',
      notes: 'Barcode unreadable.',
    })

    // HOD reviews and approves
    const approved = approveReprintRequest(req.id, hodUser, 'Approved replacement sticker.')
    expect(approved).not.toBeNull()
    expect(approved?.status).toBe('approved')
    expect(approved?.reviewedBy).toBe('Manish Chauhan (HOD)')
    expect(getAssetPrintStatus(testAsset)).toBe('Approved')

    // Print eligibility: unlocked for 1 print
    const eligApproved = checkPrintEligibility(testAsset, normalUser, true)
    expect(eligApproved.canPrint).toBe(true)
    expect(eligApproved.isReprintApproved).toBe(true)

    // Normal user prints reprint
    const rec2 = recordAssetPrint(testAsset.id, testAsset.assetCode, normalUser)
    expect(rec2.printCount).toBe(2)

    // Button automatically locks again
    const eligAfterReprint = checkPrintEligibility(testAsset, normalUser, true)
    expect(eligAfterReprint.canPrint).toBe(false)
    expect(eligAfterReprint.isReprintBlocked).toBe(true)
    expect(eligAfterReprint.printCount).toBe(2)
    expect(getAssetPrintStatus(testAsset)).toBe('Printed')
  })

  it('5. HOD rejects request -> status becomes Rejected and print button remains locked', () => {
    recordAssetPrint(testAsset.id, testAsset.assetCode, normalUser)

    const req = createReprintRequest({
      assetId: testAsset.id,
      assetCode: testAsset.assetCode,
      assetName: testAsset.name,
      requester: normalUser,
      reason: 'Other Justification',
      notes: 'Extra sticker wanted for folder.',
    })

    const rejected = rejectReprintRequest(req.id, hodUser, 'Stickers are for physical assets only.')
    expect(rejected?.status).toBe('rejected')
    expect(getAssetPrintStatus(testAsset)).toBe('Rejected')

    const elig = checkPrintEligibility(testAsset, normalUser, true)
    expect(elig.canPrint).toBe(false)
    expect(elig.isReprintBlocked).toBe(true)
  })

  it('6. Verifies all 5 status badges with color classes and icons', () => {
    const bNotPrinted = getPrintStatusBadgeProps('Not Printed')
    expect(bNotPrinted.label).toBe('Not Printed')
    expect(bNotPrinted.icon).toBe('⚪')

    const bPrinted = getPrintStatusBadgeProps('Printed')
    expect(bPrinted.label).toContain('Printed')
    expect(bPrinted.icon).toBe('🔒')

    const bPending = getPrintStatusBadgeProps('Reprint Pending')
    expect(bPending.label).toBe('Reprint Pending')
    expect(bPending.icon).toBe('⏳')

    const bApproved = getPrintStatusBadgeProps('Approved')
    expect(bApproved.label).toContain('Approved')
    expect(bApproved.icon).toBe('🔓')

    const bRejected = getPrintStatusBadgeProps('Rejected')
    expect(bRejected.label).toBe('Rejected')
    expect(bRejected.icon).toBe('✕')
  })

  it('7. Renders IndiaLabelPrintView: locks Print button after print and displays Request Reprint', async () => {
    // Initially not printed
    const { unmount } = render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={normalUser}
      />
    )

    // Button is enabled for initial print
    const printBtn = screen.getByRole('button', { name: /Print Label \(5000507\)/i })
    expect(printBtn).toBeDefined()
    expect(printBtn.getAttribute('disabled')).toBeNull()

    // Click print
    fireEvent.click(printBtn)

    // Expect lock to take effect
    await waitFor(() => {
      const records = JSON.parse(localStorage.getItem(STORAGE_KEY_PRINT_RECORDS) || '{}')
      expect(records[testAsset.id].printCount).toBe(1)
    })

    unmount()

    // Re-render: Button must now be disabled and locked
    render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={normalUser}
      />
    )

    // "Request Reprint from HOD" button is now visible
    expect(screen.getByRole('button', { name: /Request Reprint from HOD/i })).toBeDefined()
  }, 15000)
})
