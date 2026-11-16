import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AddAssetPanel } from '../components/AddAssetPanel'
import type { Asset } from '../types/asset'
import type { UserProfile } from '../lib/deviceTracker'

describe('Current User / Logged-in Personnel Asset Form Invariant Specification', () => {
  const loggedInUser: UserProfile = {
    userId: '19102709',
    userName: 'Arbind Kumar Singh',
    role: 'Employee',
    department: 'Production & SMT',
    isSuperuser: false,
  }

  const sampleAsset: Asset = {
    id: 'AST-TEST-5501',
    assetCode: '8107891',
    name: 'SMT Feeder Line 2',
    category: 'Equipment',
    currentCategory: 'Equipment',
    currentDescription: 'SMT Feeder Line 2',
    company: 'ismartu',
    plant: 'Noida Plant',
    building: 'C39',
    location: 'C-39 Factory Noida',
    department: 'Production & SMT',
    currentDepartment: 'Production & SMT',
    status: 'Pending Verification',
    date: '2026-11-16',
    purchaseDate: '2026-11-16',
    purchaseCost: 25000,
    currentValue: 25000,
    assignedTo: '',
    assetTag: '8107891',
    serialNumber: 'SN-8107891',
    assetCondition: 'Working',
  }

  it('renders main owner details as auto-filled and non-editable (read-only), while Current User manual inputs are empty', () => {
    render(
      <AddAssetPanel
        open={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialAsset={sampleAsset}
        currentUser={loggedInUser}
      />
    )

    // Main owner details (Belong to Department & Custodian) are auto-filled and non-editable
    const ownerDeptInput = screen.getByLabelText(/Belong to which dept/i) as HTMLInputElement
    expect(ownerDeptInput).toBeInTheDocument()
    expect(ownerDeptInput).toHaveAttribute('readonly')
    expect(ownerDeptInput.value).toBe('Production & SMT')

    const ownerIdInput = screen.getByPlaceholderText(/EMP-102 or MANISH5533/i) as HTMLInputElement
    expect(ownerIdInput).toHaveAttribute('readonly')

    const ownerNameInput = screen.getByPlaceholderText(/Full Name: e\.g\. Rajesh Kumar/i) as HTMLInputElement
    expect(ownerNameInput).toHaveAttribute('readonly')

    // Current User manual entry inputs (green box) MUST be empty so user can fill them manually
    const empIdInput = screen.getByLabelText(/Current User Employee ID/i) as HTMLInputElement
    expect(empIdInput).toBeInTheDocument()
    expect(empIdInput).not.toHaveAttribute('readonly')
    expect(empIdInput.value).toBe('')

    // Current User Department input
    const deptInput = screen.getByLabelText(/Current User Department/i) as HTMLInputElement
    expect(deptInput).toBeInTheDocument()
    expect(deptInput).not.toHaveAttribute('readonly')
    expect(deptInput.value).toBe('')

    // Submitter / Logged by input
    const submitterInput = screen.getByLabelText(/Submitter or logged by/i) as HTMLInputElement
    expect(submitterInput).toBeInTheDocument()
    expect(submitterInput).not.toHaveAttribute('readonly')
    expect(submitterInput.value).toBe('')
  })

  it('allows manual editing of Current User Employee ID and Department and saves them into the asset', () => {
    const onSave = vi.fn()

    render(
      <AddAssetPanel
        open={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialAsset={sampleAsset}
        currentUser={loggedInUser}
      />
    )

    const empIdInput = screen.getByLabelText(/Current User Employee ID/i)
    const deptInput = screen.getByLabelText(/Current User Department/i)
    const submitterInput = screen.getByLabelText(/Submitter or logged by/i)

    // Manually edit the fields
    fireEvent.change(empIdInput, { target: { value: 'EMP-99001' } })
    fireEvent.change(deptInput, { target: { value: 'Tooling & SMT Maintenance' } })
    fireEvent.change(submitterInput, { target: { value: 'Vikram Sharma' } })

    expect((empIdInput as HTMLInputElement).value).toBe('EMP-99001')
    expect((deptInput as HTMLInputElement).value).toBe('Tooling & SMT Maintenance')
    expect((submitterInput as HTMLInputElement).value).toBe('Vikram Sharma')

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Submit and mark Completed/i })
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledTimes(1)
    const savedAsset = onSave.mock.calls[0][0]
    expect(savedAsset.submitterId).toBe('EMP-99001')
    expect(savedAsset.submitterDepartment).toBe('Tooling & SMT Maintenance')
    expect(savedAsset.submitter).toBe('Vikram Sharma')
  })
})
