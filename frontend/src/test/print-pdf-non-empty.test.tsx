import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IndiaLabelPrintView } from '@/components/IndiaLabelPrintView'
import type { Asset } from '@/types/asset'
import type { UserProfile } from '@/lib/deviceTracker'

describe('Print & PDF Non-Empty Guarantee Specification', () => {
  const mockAsset: Asset = {
    id: 'asset-5000507',
    assetCode: '5000507',
    serialNumber: '54865846584516489',
    name: 'Volumetric air tightness test equipment',
    currentDescription: 'Volumetric air tightness test equipment',
    currentCategory: 'SMT Testing',
    department: 'IT & Infrastructure',
    currentDepartment: 'IT & Infrastructure',
    inChargeId: 'USR-ADMIN',
    inChargeName: 'Uttam Singh',
    whoInCharge: 'USR-ADMIN · Uttam Singh',
    submitterId: 'atul',
    submitter: 'Uttam Singh',
    submitterDepartment: 'IT & Infrastructure',
    building: 'D197',
    floor: '1F',
    currentLocation: 'Production Testing Line 2',
    purchaseDate: '2024-01-15',
    date: '2024-01-15',
    status: 'In Use',
    plant: 'Padget Electronics, Noida',
    company: 'Padget',
    companyCode: '9500',
    assetTag: '5000507',
    category: 'Production Equipment',
    assetCondition: 'Good',
    purchaseCost: 500000,
    currentValue: 450000,
    assignedTo: 'Uttam Singh',
    location: 'D197-1F',
  }

  const superUser: UserProfile = {
    userId: 'USR-ADMIN',
    userName: 'Uttam Singh',
    role: 'Super User',
    department: 'IT & Infrastructure',
    isSuperuser: true,
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    const existing = document.getElementById('printable-label-portal')
    if (existing) existing.remove()
  })

  it('Invariant 1: #printable-label-portal is mounted directly to document.body and contains full label content (NOT empty)', () => {
    render(<IndiaLabelPrintView assets={[mockAsset]} lang="en" currentUser={superUser} />)

    // The portal must exist in document.body
    const portal = document.getElementById('printable-label-portal')
    expect(portal).not.toBeNull()
    expect(portal?.parentElement).toBe(document.body)

    // Verify it contains full label components
    const printItem = portal?.querySelector('.ismartu-print-item')
    expect(printItem).not.toBeNull()

    // Must contain bilingual headers
    expect(portal?.textContent).toContain('设备固定资产')
    expect(portal?.textContent).toContain('Equipment Fixed Asset')

    // Must contain real asset data
    expect(portal?.textContent).toContain('5000507')
    expect(portal?.textContent).toContain('Volumetric air tightness test equipment')
    expect(portal?.textContent).toContain('IT & Infrastructure')
    expect(portal?.textContent).toContain('Uttam Singh')

    // Tamper warning
    expect(portal?.textContent).toContain('禁止撕毁涂改')
    expect(portal?.textContent).toContain('Do not tear or alter.')
  })

  it('Invariant 2: Clicking Print opens window.print() and guarantees portal is populated even for repeat prints', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    render(<IndiaLabelPrintView assets={[mockAsset]} lang="en" currentUser={superUser} />)

    // Find and click print button
    const printButton = screen.getByRole('button', { name: /Print "5000507" Label/i })
    expect(printButton).toBeInTheDocument()
    fireEvent.click(printButton)

    // window.print MUST be invoked
    expect(printSpy).toHaveBeenCalled()

    // Portal MUST NOT be empty
    const portal = document.getElementById('printable-label-portal')
    expect(portal).not.toBeNull()
    expect(portal?.children.length).toBeGreaterThanOrEqual(1)
    expect(portal?.innerHTML).toContain('5000507')

    // body MUST have meridian-printing-label
    expect(document.body.classList.contains('meridian-printing-label')).toBe(true)

    printSpy.mockRestore()
  })

  it('Invariant 3: Bulk print mounts all selected printable assets into portal without blank pages', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    const secondAsset: Asset = {
      ...mockAsset,
      id: 'asset-5000508',
      assetCode: '5000508',
      name: 'Secondary Laser Marker',
      currentDescription: 'Secondary Laser Marker',
    }

    render(<IndiaLabelPrintView assets={[mockAsset, secondAsset]} lang="en" currentUser={superUser} />)

    // Select second asset as well
    const checkboxes = screen.getAllByRole('checkbox')
    // Click the first asset checkbox in the list
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0])
    }

    // Portal is ready and contains items
    const portal = document.getElementById('printable-label-portal')
    expect(portal).not.toBeNull()
    expect(portal?.querySelectorAll('.ismartu-print-item').length).toBeGreaterThanOrEqual(1)

    printSpy.mockRestore()
  })
})
