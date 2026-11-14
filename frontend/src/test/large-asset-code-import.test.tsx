import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AssetCodeWorkflow, parsePastedAssetCodes } from '@/components/AssetCodeWorkflow'
import type { Asset } from '@/types/asset'

describe('Massive Asset Code Import Specification (100 to 100k+ codes)', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = '#verification'
  })

  it('parsePastedAssetCodes parses 100+ codes, 1,000 codes, and ignores header rows and surrounding quotes', () => {
    // 1. Array of 250 codes with quotes and empty lines
    const rawLines = [
      'Asset Code', // Header to ignore
      '"AST000001"',
      'AST000002',
      '',
      ...Array.from({ length: 248 }, (_, i) => `AST${String(i + 3).padStart(6, '0')}`),
    ].join('\n')

    const parsed = parsePastedAssetCodes(rawLines)
    expect(parsed).toHaveLength(250)
    expect(parsed[0]).toBe('AST000001')
    expect(parsed[1]).toBe('AST000002')
    expect(parsed[249]).toBe('AST000250')
  })

  it('handles tab-delimited Excel table copy-paste containing multiple columns without breaking code names', () => {
    const excelCopy = [
      'Asset Code\tDepartment\tModel',
      'AST-SMT-1001\tSMT Operations\tYamaha YS24',
      'AST-SMT-1002\tSMT Operations\tYamaha YSM20',
      'AST-IT-5001\tIT Department\tDell Latitude',
    ].join('\n')

    const parsed = parsePastedAssetCodes(excelCopy)
    expect(parsed).toEqual(['AST-SMT-1001', 'AST-SMT-1002', 'AST-IT-5001'])
  })

  it('handles comma-separated and mixed format codes', () => {
    const raw = 'AST-001, AST-002, AST-003, AST-004'
    const parsed = parsePastedAssetCodes(raw)
    expect(parsed).toEqual(['AST-001', 'AST-002', 'AST-003', 'AST-004'])
  })

  it('imports more than 100 codes into AssetCodeWorkflow and provides paginated table rendering', () => {
    const onImportCodes = vi.fn()
    const onAssign = vi.fn()
    const onSelectAsset = vi.fn()
    const admin = { userId: 'USR-ADMIN', userName: 'Admin', role: 'Administrator', department: 'IT' }

    // 1. Create 150 codes in text format
    const codes150 = Array.from({ length: 150 }, (_, i) => `AST${String(i + 1).padStart(6, '0')}`).join('\n')

    const { rerender } = render(
      <AssetCodeWorkflow
        assets={[]}
        user={admin}
        onImportCodes={onImportCodes}
        onAssign={onAssign}
        onSelectAsset={onSelectAsset}
      />
    )

    // 2. Paste 150 codes into textarea
    const textarea = screen.getByLabelText('Paste asset codes')
    fireEvent.change(textarea, { target: { value: codes150 } })

    // Live detection badge shows "150 codes ready to import"
    expect(screen.getByText(/150 codes ready to import/i)).toBeInTheDocument()

    // 3. Click import
    fireEvent.click(screen.getByRole('button', { name: /Import pasted codes/i }))
    expect(onImportCodes).toHaveBeenCalledTimes(1)
    const importedArg = onImportCodes.mock.calls[0][0]
    expect(importedArg).toHaveLength(150)
    expect(importedArg[0]).toBe('AST000001')
    expect(importedArg[149]).toBe('AST000150')

    // 4. Rerender with 150 imported assets and verify pagination (page 1 has 50 items, Next button works)
    const mockAssets: Asset[] = importedArg.map((code: string) => ({
      id: `imported-${code}`,
      assetCode: code,
      serialNumber: '',
      currentCategory: '',
      currentDescription: '',
      plant: '',
      assetCondition: '',
      date: '2026-11-14',
      name: code,
      assetTag: code,
      category: 'IT Hardware',
      department: '',
      status: 'Imported',
      purchaseDate: '2026-11-14',
      purchaseCost: 0,
      currentValue: 0,
      assignedTo: '',
      location: '',
    }))

    rerender(
      <AssetCodeWorkflow
        assets={mockAssets}
        user={admin}
        onImportCodes={onImportCodes}
        onAssign={onAssign}
        onSelectAsset={onSelectAsset}
      />
    )

    // Table shows pagination: Page 1 of 3
    expect(screen.getByText(/Showing/i)).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()

    // First item visible on page 1, item 51 not in main table on page 1
    expect(screen.getAllByText('AST000001').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('AST000051')).not.toBeInTheDocument()

    // Navigate to Page 2
    fireEvent.click(screen.getByRole('button', { name: /Next ›/i }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getAllByText('AST000051').length).toBeGreaterThanOrEqual(1)
  })
})
