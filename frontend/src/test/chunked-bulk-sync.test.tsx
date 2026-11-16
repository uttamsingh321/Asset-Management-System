import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetCodeWorkflow } from '../components/AssetCodeWorkflow'
import { pushAssetsToBackend } from '../lib/assetStorage'
import type { Asset } from '../types/asset'

describe('Chunked Bulk Upload & Plant-Wide Synchronization Specification', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('meridian_auth', 'true')
    window.location.hash = '#tasks'
    vi.restoreAllMocks()
  })

  it('slices large asset lists (>500 items) into multiple chunked requests to avoid network limits', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, created: 500 }),
    } as Response))

    // Create 1,250 dummy assets (should produce 3 chunks: 500, 500, 250)
    const largeList: Asset[] = Array.from({ length: 1250 }, (_, i) => ({
      id: `asset-${i}`,
      assetCode: `AST-CHUNK-${i}`,
      name: `Machine #${i}`,
      category: 'Equipment',
      currentCategory: 'Equipment',
      currentDescription: `Machine #${i}`,
      company: 'ismartu',
      plant: 'Noida Plant',
      building: 'C39',
      location: 'C-39 Factory Noida',
      department: 'Production',
      currentDepartment: 'Production',
      status: 'Pending Verification',
      date: '2026-11-16',
      purchaseDate: '2026-11-16',
      purchaseCost: 1000,
      currentValue: 1000,
      assignedTo: '',
      assetTag: `AST-CHUNK-${i}`,
      serialNumber: '',
      assetCondition: 'Good',
    }))

    const progressReports: number[] = []
    const success = await pushAssetsToBackend(
      largeList,
      { userId: 'USR-ADMIN', userName: 'Uttam Singh', role: 'Super User' },
      (sent) => {
        progressReports.push(sent)
      }
    )

    expect(success).toBe(true)
    // Slices: 500, 500, 250 -> exactly 3 HTTP POST requests
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(progressReports).toEqual([500, 1000, 1250])
  })

  it('provides visible "Sync to Server" and "Refresh Server" buttons in AssetCodeWorkflow', async () => {
    const mockAssets: Asset[] = [
      {
        id: '1',
        assetCode: 'AST-PRODUCTION-01',
        name: 'Pick & Place Head',
        category: 'Equipment',
        currentCategory: 'Equipment',
        currentDescription: 'Pick & Place Head',
        company: 'ismartu',
        plant: 'Noida Plant',
        building: 'C39',
        location: 'C-39 Factory Noida',
        department: 'Production',
        currentDepartment: 'Production',
        status: 'Pending Verification',
        date: '2026-11-16',
        purchaseDate: '2026-11-16',
        purchaseCost: 5000,
        currentValue: 5000,
        assignedTo: '',
        assetTag: 'AST-PRODUCTION-01',
        serialNumber: '',
        assetCondition: 'Working',
      },
    ]

    const onRefreshFromBackend = vi.fn().mockResolvedValue(undefined)

    render(
      <AssetCodeWorkflow
        assets={mockAssets}
        user={{
          userId: '19102709',
          userName: 'Arbind Kumar Singh',
          role: 'Employee',
          department: 'Production & SMT',
        }}
        onImportCodes={vi.fn()}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
        onRefreshFromBackend={onRefreshFromBackend}
      />
    )

    // Verify Refresh Server button exists
    const refreshBtn = screen.getByRole('button', { name: /Refresh Server/i })
    expect(refreshBtn).toBeInTheDocument()

    // Verify Sync to Server button exists
    const syncBtn = screen.getByRole('button', { name: /Sync to Server/i })
    expect(syncBtn).toBeInTheDocument()

    // Clicking Refresh Server invokes onRefreshFromBackend
    fireEvent.click(refreshBtn)
    expect(onRefreshFromBackend).toHaveBeenCalledTimes(1)
  })
})
