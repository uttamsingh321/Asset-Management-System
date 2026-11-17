import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AssetCodeWorkflow } from '@/components/AssetCodeWorkflow'
import type { Asset } from '@/types/asset'

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  assetCode: 'AST000001',
  serialNumber: 'SN-001',
  currentCategory: 'Fixed Assets',
  currentDescription: 'Laser Marker',
  plant: '95030021',
  assetCondition: '',
  date: '2026-11-17',
  name: 'AST000001',
  assetTag: 'AST000001',
  category: 'Fixed Assets',
  department: 'IT',
  currentDepartment: 'IT',
  companyCode: '9503',
  status: 'Active',
  purchaseDate: '2026-11-17',
  purchaseCost: 0,
  currentValue: 0,
  assignedTo: '',
  location: 'Noida Plant',
  ...overrides,
})

describe('Mandatory Asset Category Selection & Import Workflow', () => {
  const adminUser = {
    userId: 'USR-SUPER',
    userName: 'Super User',
    role: 'Super User',
    department: 'IT',
  }

  it('keeps import buttons disabled and shows warning when no category is selected', () => {
    const onImportCodes = vi.fn()
    render(
      <AssetCodeWorkflow
        assets={[]}
        user={adminUser}
        onImportCodes={onImportCodes}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    // Message must be visible
    expect(screen.getByText(/Please select an Asset Category before importing/i)).toBeInTheDocument()

    // Import pasted codes button must be disabled
    const importBtn = screen.getByRole('button', { name: /Import pasted codes/i })
    expect(importBtn).toBeDisabled()

    // File input should also be disabled
    const fileInput = screen.getByLabelText(/Import asset code spreadsheet/i) as HTMLInputElement
    expect(fileInput.disabled).toBe(true)
  })

  it('allows selecting each of the 4 major categories (Fixed Assets, Accessories, Tools, Fixtures)', () => {
    render(
      <AssetCodeWorkflow
        assets={[]}
        user={adminUser}
        onImportCodes={vi.fn()}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    const categories = [
      { name: 'Select Category Fixed Assets', label: 'Fixed Assets' },
      { name: 'Select Category Accessories', label: 'Accessories' },
      { name: 'Select Category Tools', label: 'Tools' },
      { name: 'Select Category Fixtures', label: 'Fixtures' },
    ]

    for (const cat of categories) {
      const btn = screen.getByRole('button', { name: cat.name })
      fireEvent.click(btn)
      expect(btn).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('✓ Selected:')).toBeInTheDocument()
      expect(screen.getAllByText(cat.label).length).toBeGreaterThan(0)
    }
  })

  it('shows confirmation dialog before completing import and assigns category upon confirmation', () => {
    const onImportCodes = vi.fn()
    render(
      <AssetCodeWorkflow
        assets={[]}
        user={adminUser}
        onImportCodes={onImportCodes}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    // 1. Select Tools category
    fireEvent.click(screen.getByRole('button', { name: 'Select Category Tools' }))

    // 2. Paste asset codes
    const textarea = screen.getByLabelText('Paste asset codes')
    fireEvent.change(textarea, { target: { value: 'TOOL-001\nTOOL-002\nTOOL-003' } })

    // 3. Click Import pasted codes
    const importBtn = screen.getByRole('button', { name: /Import pasted codes/i })
    expect(importBtn).not.toBeDisabled()
    fireEvent.click(importBtn)

    // 4. Modal must appear with details
    expect(screen.getByText(/Confirm Asset Code Import/i)).toBeInTheDocument()
    expect(screen.getByText(/Auto-Assign on Import/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Tools/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/TOOL-001/i).length).toBeGreaterThan(0)

    // 5. Click Confirm & Import
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Import/i })
    fireEvent.click(confirmBtn)

    // 6. Verified that onImportCodes is invoked with the target category
    expect(onImportCodes).toHaveBeenCalledTimes(1)
    expect(onImportCodes).toHaveBeenCalledWith(
      ['TOOL-001', 'TOOL-002', 'TOOL-003'],
      'Tools'
    )
  })

  it('cancelling confirmation dialog does not call onImportCodes', () => {
    const onImportCodes = vi.fn()
    render(
      <AssetCodeWorkflow
        assets={[]}
        user={adminUser}
        onImportCodes={onImportCodes}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select Category Fixtures' }))
    const textarea = screen.getByLabelText('Paste asset codes')
    fireEvent.change(textarea, { target: { value: 'FIX-001' } })

    fireEvent.click(screen.getByRole('button', { name: /Import pasted codes/i }))
    expect(screen.getByText(/Confirm Asset Code Import/i)).toBeInTheDocument()

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onImportCodes).not.toHaveBeenCalled()
  })

  it('filters out existing duplicate asset codes and warns the user', () => {
    const existingAsset = makeAsset({ assetCode: 'AST-EXISTS' })
    const onImportCodes = vi.fn()

    render(
      <AssetCodeWorkflow
        assets={[existingAsset]}
        user={adminUser}
        onImportCodes={onImportCodes}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select Category Fixed Assets' }))
    const textarea = screen.getByLabelText('Paste asset codes')
    fireEvent.change(textarea, { target: { value: 'AST-EXISTS\nAST-NEW' } })

    fireEvent.click(screen.getByRole('button', { name: /Import pasted codes/i }))

    // Dialog shows duplicate warning
    expect(screen.getByText(/already exist in the system and will be skipped/i)).toBeInTheDocument()

    // Confirm import imports only the new one
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Import/i }))
    expect(onImportCodes).toHaveBeenCalledWith(['AST-NEW'], 'Fixed Assets')
  })
})
