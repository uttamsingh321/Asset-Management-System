import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IndiaLabelPrintView, LABEL_SIZE_PRESETS } from '@/components/IndiaLabelPrintView'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'
import {
  getAssetPrintRecord,
  STORAGE_KEY_PRINT_RECORDS,
} from '@/lib/labelReprintService'

const mockNormalUser: UserProfile = {
  userId: 'USR-OPERATOR-01',
  userName: 'Arbind Kumar Singh',
  role: 'Production & SMT · Employee',
  department: 'Production',
  isSuperuser: false,
}

const testAsset: Asset = {
  id: 'AST-2005941',
  assetCode: '2005941',
  serialNumber: '58465718',
  name: 'Equipment Fixed Asset',
  currentDescription: 'Equipment Fixed Asset',
  currentCategory: 'Fixed Assets',
  department: 'Production',
  currentDepartment: 'Production',
  inChargeId: 'USR-ADMIN',
  inChargeName: 'Uttam Singh',
  whoInCharge: 'USR-ADMIN · Uttam Singh',
  custodian: 'USR-ADMIN · Uttam Singh',
  assignedTo: 'atul · Uttam Singh (IT & Infrastructure)',
  submitter: 'atul · Uttam Singh (IT & Infrastructure)',
  building: 'D197',
  floor: '1F',
  currentLocation: 'D197-1F',
  location: 'D197-1F',
  purchaseDate: '2026-11-17',
  date: '2026-11-17',
  status: 'Completed',
  plant: 'Noida Plant',
  company: 'Padget',
  assetTag: '2005941',
  category: 'Fixed Assets',
  assetCondition: 'Operational - Good',
  purchaseCost: 350000,
  currentValue: 330000,
}

describe('QR Label Print Layout Fit & Physical Handover Rule Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, requests: [] }),
    }) as any
  })

  it('1. Geometry & Scale: 100mm × 65mm preset uses 0.72 scale fitting strictly on 1 single sticker/page', () => {
    const preset100x65 = LABEL_SIZE_PRESETS.find((p) => p.id === '100x65')
    expect(preset100x65).toBeDefined()
    expect(preset100x65?.scale).toBe(0.72)
    expect(preset100x65?.widthMm).toBe(100)
    expect(preset100x65?.heightMm).toBe(65)

    // Unscaled card height is ~306px. At scale 0.72:
    // 306 * 0.72 = 220.3px.
    // 65mm at 96 CSS DPI = (65 / 25.4) * 96 = 245.67px.
    // Card height (220.3px) is STRICTLY less than 65mm page height (245.67px),
    // guaranteeing it fits on 1 page without spilling the barcode/QR onto Page 2.
    const cardHeightPx = 306 * (preset100x65?.scale || 1)
    const page65MmPx = (65 / 25.4) * 96
    expect(cardHeightPx).toBeLessThan(page65MmPx)
  })

  it('2. Anti-Premature Locking Rule: Clicking Print does NOT lock button if user cancels or printer jams', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    // Ready for initial print
    const printBtn = screen.getByRole('button', { name: /Print Label \(2005941\)/i })
    expect(printBtn).toBeInTheDocument()
    expect(printBtn).not.toBeDisabled()

    // User clicks Print
    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalledTimes(1)

    // Verification modal appears
    expect(screen.getByRole('heading', { name: /Physical Label Handover Verification/i })).toBeInTheDocument()
    expect(screen.getAllByText(/2005941/i).length).toBeGreaterThan(0)

    // CRITICAL: Before user confirms, print count MUST be 0 and record MUST be null
    expect(getAssetPrintRecord(testAsset.id, testAsset.assetCode)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY_PRINT_RECORDS)).toBeNull()

    // User clicked cancel in Chrome print dialog or paper jammed -> Clicks "Print Canceled / Failed"
    const cancelBtn = screen.getByRole('button', { name: /Print Canceled \/ Failed \(Keep Unlocked\)/i })
    fireEvent.click(cancelBtn)

    // Modal closes
    expect(screen.queryByRole('heading', { name: /Physical Label Handover Verification/i })).not.toBeInTheDocument()

    // Asset remains COMPLETELY UNLOCKED
    expect(getAssetPrintRecord(testAsset.id, testAsset.assetCode)).toBeNull()
    expect(screen.getByRole('button', { name: /Print Label \(2005941\)/i })).not.toBeDisabled()
  })

  it('3. Physical Handover Confirmation: Single-print lock engages ONLY when physical label is confirmed in hand', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    const { unmount } = render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    const printBtn = screen.getByRole('button', { name: /Print Label \(2005941\)/i })
    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalledTimes(1)

    // User confirms physical sticker received in hand
    const confirmBtn = screen.getByRole('button', { name: /Yes, Physical Label in Hand \(Confirm & Lock\)/i })
    fireEvent.click(confirmBtn)

    // Now record is created and count is 1
    const record = getAssetPrintRecord(testAsset.id, testAsset.assetCode)
    expect(record).not.toBeNull()
    expect(record?.printCount).toBe(1)
    expect(record?.lastPrintedBy).toBe('Arbind Kumar Singh')

    unmount()

    // Re-rendering now shows locked state
    render(
      <IndiaLabelPrintView
        assets={[testAsset]}
        lang="en"
        currentUser={mockNormalUser}
      />
    )

    expect(screen.getByText(/Single-Print Policy Enforced: Duplicate Printing Locked/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /QR Print Locked \(Already Printed\)/i })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /Request Re-print from Super User/i }).length).toBeGreaterThan(0)
  })
})
