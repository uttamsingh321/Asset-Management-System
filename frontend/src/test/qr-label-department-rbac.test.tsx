import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IsmartuAssetLabel } from '@/components/IndiaLabelPrintView'
import { resolveDepartmentName, isRawNumericDepartmentCode } from '@/lib/departmentResolver'
import type { Asset } from '@/types/asset'

describe('QR Label Row 4 Department & RBAC Resolution Specification', () => {
  it('detects raw numeric cost center codes (e.g. 95030021, C502006009) as non-department codes', () => {
    expect(isRawNumericDepartmentCode('95030021')).toBe(true)
    expect(isRawNumericDepartmentCode('502006009')).toBe(true)
    expect(isRawNumericDepartmentCode('C502006009')).toBe(true)
    expect(isRawNumericDepartmentCode('IT & Infrastructure')).toBe(false)
    expect(isRawNumericDepartmentCode('Production')).toBe(false)
    expect(isRawNumericDepartmentCode('SMT Operations')).toBe(false)
  })

  it('Invariant 1: IsmartuAssetLabel NEVER displays raw numeric cost center 95030021 on Row 4 (Department)', () => {
    // Problem scenario from user screenshot media_1794834329169_9f75eb58.png
    const testAsset: Asset = {
      id: 'ast-5000507',
      assetCode: '5000507',
      assetTag: '5000507',
      name: 'Volumetric air tightness test equipment',
      currentDescription: 'Volumetric air tightness test equipment',
      model: '54865846584516489',
      serialNumber: 'SN-AIR-5000507',
      category: 'Equipment Fixed Asset',
      currentCategory: 'Equipment Fixed Asset',
      costCenter: '95030021', // Raw numeric SAP cost center
      department: '95030021', // Previously stored raw numeric cost center
      currentDepartment: '95030021',
      inChargeId: 'USR-ADMIN',
      inChargeName: 'Uttam Singh',
      whoInCharge: 'Uttam Singh',
      submitter: 'Uttam Singh',
      submitterDepartment: 'IT & Infrastructure',
      building: 'D197',
      floor: '1F',
      location: 'D197-1F',
      status: 'Completed',
      plant: 'Sector 63 (Unit 2)',
      company: 'Padget',
      date: '2026-11-16',
      purchaseDate: '2026-11-16',
      purchaseCost: 0,
      currentValue: 0,
      assignedTo: 'Uttam Singh',
      assetCondition: 'Operational',
    }

    render(<IsmartuAssetLabel asset={testAsset} />)

    // Verify row 4 label exists
    const deptLabel = screen.getByText('使用部门/Department')
    expect(deptLabel).toBeInTheDocument()

    const rowContainer = deptLabel.closest('div')?.parentElement
    // MUST NOT display the numeric code 95030021
    expect(rowContainer?.textContent).not.toContain('95030021')

    // MUST display the real human-readable department from RBAC: "IT & Infrastructure"
    expect(rowContainer?.textContent).toContain('IT & Infrastructure')
  })

  it('Invariant 2: resolveDepartmentName resolves Custodian Manish / Arbind to Production', () => {
    const assetManish: Partial<Asset> = {
      inChargeId: '19105533',
      inChargeName: 'Manish Chauhan',
      department: '95020010',
    }
    expect(resolveDepartmentName('95020010', assetManish)).toBe('Production')

    const assetArbind: Partial<Asset> = {
      inChargeId: '19102709',
      inChargeName: 'Arbind Kumar Singh',
      department: '95030022',
    }
    expect(resolveDepartmentName('95030022', assetArbind)).toBe('Production')
  })

  it('Invariant 3: Preserves authentic text department names (e.g. SMT Operations, Quality Control)', () => {
    const assetRealDept: Partial<Asset> = {
      department: 'SMT Operations',
    }
    expect(resolveDepartmentName('SMT Operations', assetRealDept)).toBe('SMT Operations')

    const assetQC: Partial<Asset> = {
      currentDepartment: 'Quality Control',
    }
    expect(resolveDepartmentName('Quality Control', assetQC)).toBe('Quality Control')
  })
})
