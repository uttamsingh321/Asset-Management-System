import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface ExportableAsset {
  id: string
  assetTag: string
  name: string
  category: string
  department: string
  status: string
  purchaseDate: string
  purchaseCost: number
  currentValue: number
  assignedTo: string
  location: string
}

export function exportAssetsToExcel(assets: ExportableAsset[], filename = "asset-register.xlsx") {
  const worksheetData = assets.map((asset) => ({
    "Asset ID": asset.assetTag,
    "Asset Name": asset.name,
    "Category": asset.category,
    "Department": asset.department,
    "Status": asset.status,
    "Assigned To": asset.assignedTo,
    "Location": asset.location,
    "Purchase Date": asset.purchaseDate,
    "Purchase Cost ($)": asset.purchaseCost,
    "Current Value ($)": asset.currentValue,
  }))

  const worksheet = XLSX.utils.json_to_sheet(worksheetData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Assets")
  XLSX.writeFile(workbook, filename)
}

export function exportAssetsToPDF(assets: ExportableAsset[], filename = "asset-report.pdf") {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text("Asset Management System - Inventory Report", 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Generated on: ${new Date().toLocaleDateString()} | Total Assets: ${assets.length}`, 14, 28)

  const tableRows = assets.map((a) => [
    a.assetTag,
    a.name,
    a.category,
    a.department,
    a.status,
    `$${a.currentValue.toLocaleString()}`,
    a.assignedTo,
  ])

  autoTable(doc, {
    head: [["Tag", "Name", "Category", "Dept", "Status", "Value", "Assignee"]],
    body: tableRows,
    startY: 34,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8 },
  })

  doc.save(filename)
}
