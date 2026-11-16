import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  MAJOR_ASSET_CATEGORIES,
  MAJOR_ASSET_CATEGORIES_CONFIG,
  resolveMajorAssetCategory,
  type Asset,
} from '@/types/asset'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import { IsmartuAssetLabel } from '@/components/IndiaLabelPrintView'

describe('Four Major Asset Categories Specification', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('1. Verifies the four mandatory major categories exist in configuration', () => {
    expect(MAJOR_ASSET_CATEGORIES).toEqual([
      'Fixed Assets',
      'Accessories',
      'Tools',
      'Fixtures',
    ])

    // Fixed Assets
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Fixed Assets'].label).toBe('Fixed Assets')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Fixed Assets'].chineseLabel).toBe('设备固定资产')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Fixed Assets'].englishLabel).toBe('Equipment Fixed Asset')

    // Accessories
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Accessories'].label).toBe('Accessories')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Accessories'].chineseLabel).toBe('设备配件 / 附件')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Accessories'].englishLabel).toBe('Equipment Accessory')

    // Tools
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Tools'].label).toBe('Tools')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Tools'].chineseLabel).toBe('工装工具 / 器具')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Tools'].englishLabel).toBe('Equipment Tool')

    // Fixtures
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Fixtures'].label).toBe('Fixtures')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Fixtures'].chineseLabel).toBe('工装夹具 / 治具')
    expect(MAJOR_ASSET_CATEGORIES_CONFIG['Fixtures'].englishLabel).toBe('Equipment Fixture')
  })

  it('2. Evaluates resolveMajorAssetCategory accurately for all 4 categories', () => {
    // Fixed Assets
    expect(resolveMajorAssetCategory('Fixed Assets')).toBe('Fixed Assets')
    expect(resolveMajorAssetCategory('Capital Machinery')).toBe('Fixed Assets')
    expect(resolveMajorAssetCategory(undefined)).toBe('Fixed Assets')
    expect(resolveMajorAssetCategory('')).toBe('Fixed Assets')

    // Accessories
    expect(resolveMajorAssetCategory('Accessories')).toBe('Accessories')
    expect(resolveMajorAssetCategory('Power Adapter Accessory')).toBe('Accessories')
    expect(resolveMajorAssetCategory('设备配件')).toBe('Accessories')
    expect(resolveMajorAssetCategory('附件')).toBe('Accessories')

    // Tools
    expect(resolveMajorAssetCategory('Tools')).toBe('Tools')
    expect(resolveMajorAssetCategory('Torque Driver Tool')).toBe('Tools')
    expect(resolveMajorAssetCategory('工装工具')).toBe('Tools')
    expect(resolveMajorAssetCategory('Multimeter testing meter')).toBe('Tools')

    // Fixtures
    expect(resolveMajorAssetCategory('Fixtures')).toBe('Fixtures')
    expect(resolveMajorAssetCategory('SMT PCB Fixture Jig')).toBe('Fixtures')
    expect(resolveMajorAssetCategory('工装夹具')).toBe('Fixtures')
    expect(resolveMajorAssetCategory('治具')).toBe('Fixtures')
    expect(resolveMajorAssetCategory('SMT stencil carrier nest')).toBe('Fixtures')
  })

  it('3. Renders IsmartuAssetLabel with category-specific bilingual headers', () => {
    const baseAsset: Asset = {
      id: 'AST-CAT-01',
      assetCode: 'CAT-1001',
      assetTag: 'CAT-1001',
      name: 'High-Speed SMT Mounter',
      currentDescription: 'High-Speed SMT Mounter',
      category: 'Fixed Assets',
      currentCategory: 'Fixed Assets',
      department: 'Production',
      currentDepartment: 'Production',
      company: 'ismartu',
      building: 'C39',
      floor: '1st Floor',
      serialNumber: 'SN-FIX-01',
      status: 'Completed',
      purchaseDate: '2026-01-01',
      date: '2026-01-01',
      purchaseCost: 10000,
      currentValue: 9000,
      assignedTo: 'Operator',
      location: 'C39 - 1st Floor',
      plant: 'Noida Plant',
      assetCondition: 'Operational',
    }

    // 1. Fixed Asset Label
    const { unmount: u1 } = render(<IsmartuAssetLabel asset={baseAsset} scale={1} />)
    expect(screen.getByText('设备固定资产')).toBeInTheDocument()
    expect(screen.getByText('Equipment Fixed Asset')).toBeInTheDocument()
    u1()

    // 2. Accessories Label
    const accessoryAsset: Asset = {
      ...baseAsset,
      category: 'Accessories',
      currentCategory: 'Accessories',
      name: 'Fiber Optic Cable Harness',
    }
    const { unmount: u2 } = render(<IsmartuAssetLabel asset={accessoryAsset} scale={1} />)
    expect(screen.getByText('设备配件 / 附件')).toBeInTheDocument()
    expect(screen.getByText('Equipment Accessory')).toBeInTheDocument()
    u2()

    // 3. Tools Label
    const toolAsset: Asset = {
      ...baseAsset,
      category: 'Tools',
      currentCategory: 'Tools',
      name: 'Digital Torque Driver',
    }
    const { unmount: u3 } = render(<IsmartuAssetLabel asset={toolAsset} scale={1} />)
    expect(screen.getByText('工装工具 / 器具')).toBeInTheDocument()
    expect(screen.getByText('Equipment Tool')).toBeInTheDocument()
    u3()

    // 4. Fixtures Label
    const fixtureAsset: Asset = {
      ...baseAsset,
      category: 'Fixtures',
      currentCategory: 'Fixtures',
      name: 'PCB Wave Solder Carrier Nest',
    }
    const { unmount: u4 } = render(<IsmartuAssetLabel asset={fixtureAsset} scale={1} />)
    expect(screen.getByText('工装夹具 / 治具')).toBeInTheDocument()
    expect(screen.getByText('Equipment Fixture')).toBeInTheDocument()
    u4()
  })

  it('4. AddAssetPanel displays the 4 major category buttons and updates selection', async () => {
    const handleSave = vi.fn()
    const handleClose = vi.fn()

    render(
      <AddAssetPanel
        open={true}
        onClose={handleClose}
        onSave={handleSave}
      />
    )

    // Check all 4 major category buttons are rendered
    expect(screen.getByRole('button', { name: /Fixed Assets/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accessories/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tools/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fixtures/i })).toBeInTheDocument()

    // Click 'Tools'
    fireEvent.click(screen.getByRole('button', { name: /Tools/i }))

    // The input should reflect Tools
    const catInput = screen.getByPlaceholderText(/e\.g\. Fixed Assets, Accessories, Tools, Fixtures/i)
    expect((catInput as HTMLInputElement).value).toBe('Tools')

    // Click 'Fixtures'
    fireEvent.click(screen.getByRole('button', { name: /Fixtures/i }))
    expect((catInput as HTMLInputElement).value).toBe('Fixtures')
  })

  it('5. AddAssetPanel reveals 4 category buttons upon clicking Edit Master Data for pre-filled assets', async () => {
    const handleSave = vi.fn()
    const handleClose = vi.fn()

    const initialAsset: Asset = {
      id: 'AST-ERP-01',
      assetCode: '5000508',
      assetTag: '5000508',
      name: 'Volumetric air tightness tester',
      currentDescription: 'Volumetric air tightness tester',
      category: 'Fixed Assets',
      currentCategory: 'Fixed Assets',
      department: 'Production',
      currentDepartment: 'Production',
      company: 'Padget',
      building: 'D197',
      floor: '1st Floor',
      serialNumber: 'SN-998877',
      status: 'Pending Verification',
      purchaseDate: '2026-01-01',
      date: '2026-01-01',
      purchaseCost: 5000,
      currentValue: 4500,
      assignedTo: 'Engineer',
      location: 'D197 - 1st Floor',
      plant: 'Padget D197',
      assetCondition: 'Operational',
    }

    render(
      <AddAssetPanel
        open={true}
        onClose={handleClose}
        onSave={handleSave}
        initialAsset={initialAsset}
      />
    )

    // Initially the edit drawer is closed
    expect(screen.queryByRole('button', { name: /Fixtures/i })).not.toBeInTheDocument()

    // Click "Edit Master Data"
    const editMasterBtn = screen.getByRole('button', { name: /Edit Master Data/i })
    fireEvent.click(editMasterBtn)

    // Now all 4 category buttons must be visible
    expect(screen.getByRole('button', { name: /Fixed Assets/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accessories/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tools/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fixtures/i })).toBeInTheDocument()
  })
})
