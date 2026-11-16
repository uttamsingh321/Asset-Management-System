import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetCodeWorkflow } from '../components/AssetCodeWorkflow'
import { pushAssetsToBackend, fetchBackendAssets, fetchBackendAssetsSummary, fetchBackendUpdatedAssets } from '../lib/assetStorage'
import type { Asset } from '../types/asset'

describe('Central Asset Synchronization & Global Queue Visibility Specification', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('meridian_auth', 'true')
    window.location.hash = '#tasks'
    vi.restoreAllMocks()
  })

  it('pushAssetsToBackend sends imported assets payload to /api/assets/ in bulk', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, created: 2 }),
    } as Response)

    const sampleAssets: Partial<Asset>[] = [
      { assetCode: 'AST-TEST-001', name: 'SMT Line 1 Feeder', currentDepartment: 'Production' },
      { assetCode: 'AST-TEST-002', name: 'Reflow Oven Sensor', currentDepartment: 'Maintenance' },
    ]

    const success = await pushAssetsToBackend(sampleAssets as Asset[], {
      userId: 'USR-ADMIN',
      userName: 'Uttam Singh',
      role: 'Super User',
    })

    expect(success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/assets/'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-User-Id': 'USR-ADMIN',
        }),
      })
    )
  })

  it('fetchBackendAssets retrieves master asset registry from backend', async () => {
    const mockBackendAssets = [
      { id: '1', assetCode: 'AST-SRV-101', name: 'Production Mill', status: 'Pending Verification' },
      { id: '2', assetCode: 'AST-SRV-102', name: 'Conveyor Unit', status: 'Pending Verification' },
    ]

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assets: mockBackendAssets, count: 2 }),
    } as Response)

    const assets = await fetchBackendAssets()
    expect(assets).toHaveLength(2)
    expect(assets[0].assetCode).toBe('AST-SRV-101')
  })

  it('AssetCodeWorkflow defaults department filter to All so all uploaded codes appear for everyone', () => {
    const testAssets: Asset[] = [
      {
        id: '1',
        assetCode: 'CODE-SMT-01',
        name: 'SMT Placement Head',
        department: 'Production',
        currentDepartment: 'Production',
        status: 'Pending Verification',
      } as Asset,
      {
        id: '2',
        assetCode: 'CODE-FIN-02',
        name: 'Finance Workstation',
        department: 'Finance',
        currentDepartment: 'Finance',
        status: 'Pending Verification',
      } as Asset,
      {
        id: '3',
        assetCode: 'CODE-IT-03',
        name: 'Core Switch',
        department: 'IT',
        currentDepartment: 'IT',
        status: 'Pending Verification',
      } as Asset,
    ]

    // Render for an employee from Production & SMT Dept
    render(
      <AssetCodeWorkflow
        assets={testAssets}
        user={{
          userId: '19102709',
          userName: 'Arbind Kumar Singh',
          role: 'Employee',
          department: 'Production & SMT',
        }}
        onImportCodes={vi.fn()}
        onAssign={vi.fn()}
        onSelectAsset={vi.fn()}
      />
    )

    // Total Asset Codes should show all 3 uploaded codes
    expect(screen.getByText('Total Asset Codes')).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)

    // SMT code matching user department must be visible
    expect(screen.getByText('CODE-SMT-01')).toBeInTheDocument()

    // Clicking "All Depts" allows employee to view all uploaded codes across all departments
    fireEvent.click(screen.getByRole('button', { name: 'All Depts' }))
    expect(screen.getByText('CODE-FIN-02')).toBeInTheDocument()
    expect(screen.getByText('CODE-IT-03')).toBeInTheDocument()
  })

  it('fetchBackendAssetsSummary retrieves lightweight stats without downloading full dataset', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 15636, completedCount: 42, lastUpdated: '2026-11-16T10:00:00Z' }),
    } as Response)

    const summary = await fetchBackendAssetsSummary()
    expect(summary).not.toBeNull()
    expect(summary?.count).toBe(15636)
    expect(summary?.completedCount).toBe(42)
    expect(summary?.lastUpdated).toBe('2026-11-16T10:00:00Z')
  })

  it('fetchBackendUpdatedAssets retrieves only delta assets updated since timestamp', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: [
          {
            id: '31249',
            assetCode: '2005941',
            status: 'Completed',
            currentDepartment: 'IT & Infrastructure',
            inChargeName: 'Uttam Singh',
          },
        ],
      }),
    } as Response)

    const delta = await fetchBackendUpdatedAssets('2026-11-16T10:00:00Z')
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('updated_since=2026-11-16T10%3A00%3A00Z'),
      expect.any(Object)
    )
    expect(delta).toHaveLength(1)
    expect(delta[0].assetCode).toBe('2005941')
    expect(delta[0].status).toBe('Completed')
  })
})
