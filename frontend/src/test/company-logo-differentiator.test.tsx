import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  isPadgetCompany,
  getCompanyLogo,
  resolveCompanyName,
  resolveCompanyCode,
  PADGET_LOGO_SRC,
  ISMARTU_LOGO_SRC,
} from '@/assets/companyLogos'
import { IsmartuAssetLabel } from '@/components/IndiaLabelPrintView'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import type { Asset } from '@/types/asset'

describe('Company Differentiator for ismartu vs Padget Specification', () => {
  it('correctly identifies Padget across company name, company code (5030), buildings (D197, D198, D199), and cost center', () => {
    // 1. By company code 5030
    expect(isPadgetCompany({ companyCode: '5030' })).toBe(true)
    expect(isPadgetCompany('5030')).toBe(true)
    expect(resolveCompanyName({ companyCode: '5030' })).toBe('Padget')
    expect(resolveCompanyCode({ company: 'Padget' })).toBe('5030')

    // 2. By building D197, D198, D199
    expect(isPadgetCompany({ building: 'D197' })).toBe(true)
    expect(isPadgetCompany({ building: 'D-198' })).toBe(true)
    expect(isPadgetCompany({ building: 'D199' })).toBe(true)
    expect(resolveCompanyName({ building: 'D197' })).toBe('Padget')

    // 3. By cost center 503006001
    expect(isPadgetCompany({ costCenter: '503006001' })).toBe(true)

    // 4. By plant
    expect(isPadgetCompany({ plant: 'Padget Electronics Noida' })).toBe(true)

    // 5. ismartu / IIPL (Company code 5020, Building C39)
    expect(isPadgetCompany({ companyCode: '5020' })).toBe(false)
    expect(isPadgetCompany({ building: 'C39' })).toBe(false)
    expect(isPadgetCompany({ company: 'ismartu' })).toBe(false)
    expect(isPadgetCompany({ company: 'IIPL' })).toBe(false)
    expect(resolveCompanyName({ companyCode: '5020' })).toBe('ismartu')
    expect(resolveCompanyCode({ company: 'ismartu' })).toBe('5020')
  })

  it('provides the correct static base64 logo source and alt metadata', () => {
    const padgetLogo = getCompanyLogo({ companyCode: '5030' })
    expect(padgetLogo.isPadget).toBe(true)
    expect(padgetLogo.src).toBe(PADGET_LOGO_SRC)
    expect(padgetLogo.alt).toContain('PadGET')

    const ismartuLogo = getCompanyLogo({ companyCode: '5020' })
    expect(ismartuLogo.isPadget).toBe(false)
    expect(ismartuLogo.src).toBe(ISMARTU_LOGO_SRC)
    expect(ismartuLogo.alt).toContain('ismartu')
  })

  it('IsmartuAssetLabel renders PadGET logo for uploaded asset with companyCode 5030 or building D197', () => {
    const padgetAsset: Asset = {
      id: 'ast-padget-1',
      assetCode: '2005942',
      serialNumber: 'SN-99901',
      companyCode: '5030', // SAP Company Code for Padget
      building: 'D197',
      name: 'SMT Panasonic NPM-D3 Placement Machine',
      currentDescription: 'SMT Panasonic NPM-D3 Placement Machine',
      model: 'NPM-D3',
      currentDepartment: 'Production',
      department: 'Production',
      assignedTo: 'Arvind Sharma',
      inChargeId: 'EMP-5030-01',
      inChargeName: 'Arvind Sharma',
      location: 'D197 - 1F SMT',
      floor: '1F SMT',
      status: 'Active',
      purchaseDate: '2026-01-10',
      purchaseCost: 2500000,
      currentValue: 2500000,
      currentCategory: 'SMT Equipment',
      category: 'SMT Equipment',
      plant: 'Padget Electronics Noida',
      date: '2026-01-10',
      assetCondition: 'Operational',
      assetTag: '2005942',
    }

    render(<IsmartuAssetLabel asset={padgetAsset} />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', PADGET_LOGO_SRC)
    expect(img).toHaveAttribute('alt', 'PadGET Logo')
  })

  it('AddAssetPanel dynamically detects and displays the PadGET logo when initialAsset has companyCode 5030', () => {
    const uploadedAsset: Asset = {
      id: 'ast-padget-2',
      assetCode: '2005943',
      serialNumber: '',
      companyCode: '5030',
      name: 'AOI Inspection System',
      currentDescription: 'AOI Inspection System',
      currentDepartment: 'Quality',
      department: 'Quality',
      assignedTo: '',
      location: 'D198 - 2F QC',
      building: 'D198',
      status: 'Pending Verification',
      purchaseDate: '2026-01-15',
      purchaseCost: 0,
      currentValue: 0,
      currentCategory: 'Inspection',
      category: 'Inspection',
      plant: 'Padget Electronics Noida',
      date: '2026-01-15',
      assetCondition: 'Operational',
      assetTag: '2005943',
    }

    render(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        initialAsset={uploadedAsset}
        onSave={() => undefined}
      />
    )

    // Should detect Padget and render PadGET Logo badge
    expect(screen.getByText('PadGET Logo')).toBeInTheDocument()
    // Should display Col A company code 5030
    expect(screen.getByText('5030')).toBeInTheDocument()
  })
})
