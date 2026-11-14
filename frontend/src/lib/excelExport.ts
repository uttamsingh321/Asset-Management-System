import * as XLSX from 'xlsx'
import type { Asset } from '@/types/asset'
import { toast } from 'sonner'

export function exportAssetsToExcel(assetsToExport: Asset[], filenamePrefix = 'Asset_Inventory') {
  if (!assetsToExport || assetsToExport.length === 0) {
    toast.error('No assets available to export.')
    return
  }

  const rows = assetsToExport.map((a) => ({
    'Asset Number': a.assetCode || a.assetTag || '',
    'Serial Number': a.serialNumber || 'N/A',
    'Date Form Filled': a.date || a.purchaseDate || new Date().toISOString().split('T')[0],
    'Asset Name': a.currentDescription || a.name || '',
    'Category': a.currentCategory || a.category || '',
    'Company': a.company || 'IIPL',
    'Building': a.building || '',
    'Floor': a.floor || '',
    'Specific Location': a.currentLocation || '',
    'Belong to Dept': a.currentDepartment || a.department || '',
    'In-Charge ID': a.inChargeId || '',
    'In-Charge Name': a.inChargeName || '',
    'Submitter / Logged By': a.submitter || '',
    'Asset Condition': a.assetCondition || 'Operational',
    'Status': a.status || 'Active',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Asset Ledger')

  // Set column widths for clean readability in Microsoft Excel
  worksheet['!cols'] = [
    { wch: 18 }, // Asset Number
    { wch: 22 }, // Serial Number
    { wch: 18 }, // Date Form Filled
    { wch: 32 }, // Asset Name
    { wch: 22 }, // Category
    { wch: 14 }, // Company
    { wch: 14 }, // Building
    { wch: 16 }, // Floor
    { wch: 24 }, // Specific Location
    { wch: 22 }, // Belong to Dept
    { wch: 16 }, // In-Charge ID
    { wch: 22 }, // In-Charge Name
    { wch: 22 }, // Submitter / Logged By
    { wch: 20 }, // Asset Condition
    { wch: 16 }, // Status
  ]

  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `${filenamePrefix}_${dateStr}.xlsx`

  try {
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    if (typeof window !== 'undefined' && window.URL && window.URL.createObjectURL) {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    }

    toast.success(`Exported ${assetsToExport.length} asset${assetsToExport.length > 1 ? 's' : ''} to Excel (${filename})`)
  } catch (err) {
    console.error('Failed to export to Excel:', err)
    toast.error('Failed to export Excel file. Please try again.')
  }
}
