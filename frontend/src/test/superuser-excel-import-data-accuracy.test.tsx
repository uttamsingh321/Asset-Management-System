import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import { readCodesOrMasterAssetsFromFile } from '@/components/AssetCodeWorkflow'
import { AddAssetPanel } from '@/components/AddAssetPanel'
import type { Asset } from '@/types/asset'

describe('Super User Excel Import Accuracy & Flexibility Specification', () => {
  it('correctly extracts SAP / ERP multi-column master file without data corruption', async () => {
    // Construct Excel workbook matching user's exact uploaded file (media_1794829718749_a5a977a3.png):
    // Col A: Company code (5020)
    // Col B: Asset Class (600000)
    // Col C: Asset (12001433)
    // Col D: Asset Description (Aging Rack)
    // Col G: Capitalization date (2026-11-16)
    // Col H: Cost center (Production)
    // Col I: Location (Noida Central Plant)
    const wsData = [
      ['Company Code', 'Asset Class', 'Asset', 'Asset Description', 'User Description', 'Qty', 'Capitalization Date', 'Cost Center', 'Location', 'Model', 'Serial No'],
      ['5020', '600000', '12001433', 'Aging Rack', 'Aging Rack Unit', '1', '2026-11-16', 'Production', 'Noida Central Plant', 'AR-100X', 'SN-AR-9901'],
      ['5030', 'A200', '1970001', 'SMT Feeder Line A', 'Feeder Unit', '1', '15/03/2026', 'SMT Operations', 'Padget D197 Noida', 'MPM-125', 'SN-FEEDER-01'],
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const file = new File([buffer], 'ERP_Fixed_Asset_Register.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await readCodesOrMasterAssetsFromFile(file)
    expect(parsed).toHaveLength(2)

    const asset1 = parsed[0] as Partial<Asset>
    expect(asset1.assetCode).toBe('12001433')
    expect(asset1.companyCode).toBe('5020')
    expect(asset1.company).toBe('ismartu')
    expect(asset1.assetClass).toBe('600000')
    expect(asset1.name).toBe('Aging Rack')
    expect(asset1.costCenter).toBe('Production')
    // Crucial: Department must be 'Production' (exact data from Excel), NOT hardcoded or replaced by Super User dept
    expect(asset1.department).toBe('Production')
    expect(asset1.currentDepartment).toBe('Production')
    expect(asset1.plant).toBe('Noida Central Plant')
    expect(asset1.model).toBe('AR-100X')
    expect(asset1.serialNumber).toBe('SN-AR-9901')
    expect(asset1.capitalizationDate).toBe('2026-11-16')

    const asset2 = parsed[1] as Partial<Asset>
    expect(asset2.assetCode).toBe('1970001')
    expect(asset2.companyCode).toBe('5030')
    expect(asset2.company).toBe('Padget')
    expect(asset2.building).toBe('D197')
    expect(asset2.department).toBe('SMT Operations')
    expect(asset2.model).toBe('MPM-125')
  })

  it('correctly parses bilingual and Chinese ERP column headers', async () => {
    const wsData = [
      ['公司代码', '资产分类', '资产编号', '资产名称', '规格型号', '出厂编号', '购置日期', '成本中心', '使用部门', '存放地点', '责任人'],
      ['5020', '600000', '12005588', 'Reflow Soldering Oven', 'REFLOW-900', 'SN-RSO-55', '2026-05-10', 'SMT Line 2', 'Production & SMT', 'C39 1F SMT', 'Rajesh Kumar'],
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const file = new File([buffer], 'Chinese_Bilingual_Register.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await readCodesOrMasterAssetsFromFile(file)
    expect(parsed).toHaveLength(1)

    const asset = parsed[0] as Partial<Asset>
    expect(asset.assetCode).toBe('12005588')
    expect(asset.companyCode).toBe('5020')
    expect(asset.company).toBe('ismartu')
    expect(asset.name).toBe('Reflow Soldering Oven')
    expect(asset.model).toBe('REFLOW-900')
    expect(asset.serialNumber).toBe('SN-RSO-55')
    expect(asset.department).toBe('Production & SMT')
    expect(asset.costCenter).toBe('SMT Line 2')
    expect(asset.inChargeName).toBe('Rajesh Kumar')
  })

  it('when Super User opens the imported asset in AddAssetPanel, fills correct data only and does NOT fake-assign Super User as custodian', async () => {
    // Aging Rack from media_1794829718749_a5a977a3.png
    const importedAgingRack: Asset = {
      id: 'import-12001433',
      assetCode: '12001433',
      serialNumber: '',
      companyCode: '5020',
      company: 'ismartu',
      assetClass: '600000',
      currentCategory: '600000',
      category: '600000',
      name: 'Aging Rack',
      currentDescription: 'Aging Rack',
      capitalizationDate: '2026-11-16',
      purchaseDate: '2026-11-16',
      costCenter: 'Production',
      department: 'Production',
      currentDepartment: 'Production',
      plant: 'Noida Central Plant',
      location: 'ismartu · C39 · 1st Floor',
      building: 'C39',
      status: 'Pending Verification',
      assetCondition: 'Operational',
      assignedTo: '',
      isExcelImported: true,
      date: '2026-11-16',
      assetTag: '12001433',
      purchaseCost: 0,
      currentValue: 0,
    }

    // Super User Uttam Singh from IT & Infrastructure
    const superUser = {
      userId: 'USR-ADMIN',
      userName: 'Uttam Singh',
      role: 'Super User',
      department: 'IT & Infrastructure',
    }

    let savedAsset: Asset | null = null

    render(
      <AddAssetPanel
        open={true}
        onClose={() => undefined}
        initialAsset={importedAgingRack}
        onSave={(updated) => {
          savedAsset = updated
        }}
        currentUser={superUser}
      />
    )

    // 1. Verify Top Yellow Banner displays exact Excel data
    expect(screen.getByText('5020')).toBeInTheDocument()
    expect(screen.getByText('600000')).toBeInTheDocument()
    expect(screen.getByText('12001433')).toBeInTheDocument()
    expect(screen.getByText('Aging Rack')).toBeInTheDocument()
    expect(screen.getByText('2026-11-16')).toBeInTheDocument()
    expect(screen.getByText('Production')).toBeInTheDocument()
    expect(screen.getByText('Noida Central Plant')).toBeInTheDocument()

    // 2. Verify Department input has 'Production' from Excel, NOT 'IT & Infrastructure'
    const deptInput = screen.getByLabelText(/Belong to which dept/i)
    expect(deptInput).toHaveValue('Production')

    // 3. Verify Custodian inputs are NOT pre-filled with Super User's credentials
    // Because Excel had no custodian, it must remain empty for floor verification!
    const custodianIdInput = screen.getByPlaceholderText(/Emp ID: e\.g\. EMP-102 or MANISH5533/i)
    const custodianNameInput = screen.getByPlaceholderText(/Full Name: e\.g\. Rajesh Kumar/i)
    expect(custodianIdInput).toHaveValue('')
    expect(custodianNameInput).toHaveValue('')
    expect(custodianIdInput).not.toHaveAttribute('readonly')
    expect(custodianNameInput).not.toHaveAttribute('readonly')

    // 4. Verify Model field is accessible and can be entered / verified
    const modelInput = screen.getByPlaceholderText(/e\.g\. MPM Momentum BTB 125/i)
    expect(modelInput).toBeInTheDocument()
    fireEvent.change(modelInput, { target: { value: 'AR-SPEC-200' } })

    // 5. Fill required physical verification fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SN-88392104-X/i), { target: { value: 'SN-AR-12001433' } })
    fireEvent.change(custodianIdInput, { target: { value: 'EMP-PROD-88' } })
    fireEvent.change(custodianNameInput, { target: { value: 'Suresh Verma' } })
    fireEvent.click(screen.getByRole('button', { name: /Operational - Excellent \/ New/i }))

    // 6. Submit
    fireEvent.click(screen.getByRole('button', { name: /Submit and mark Completed/i }))

    await waitFor(() => expect(savedAsset).not.toBeNull())

    // 7. Verify saved asset retains exact Excel data + verified floor data
    expect(savedAsset!.assetCode).toBe('12001433')
    expect(savedAsset!.name).toBe('Aging Rack')
    expect(savedAsset!.department).toBe('Production')
    expect(savedAsset!.costCenter).toBe('Production')
    expect(savedAsset!.model).toBe('AR-SPEC-200')
    expect(savedAsset!.serialNumber).toBe('SN-AR-12001433')
    expect(savedAsset!.inChargeId).toBe('EMP-PROD-88')
    expect(savedAsset!.inChargeName).toBe('Suresh Verma')
    expect(savedAsset!.status).toBe('Completed')
  })
})

