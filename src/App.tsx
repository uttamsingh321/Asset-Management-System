import * as React from "react"
import { initialAssets } from "@/data/mockAssets"
import type { Asset } from "@/types/asset"
import { AssetDataTable } from "@/components/AssetDataTable"
import { AnalyticsCharts } from "@/components/AnalyticsCharts"
import { AddAssetModal } from "@/components/AddAssetModal"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { exportAssetsToExcel, exportAssetsToPDF } from "@/lib/exportUtils"
import { toast } from "sonner"
import {
  Boxes,
  Plus,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Laptop,
  Wrench,
  Clock,
  TrendingUp,
} from "lucide-react"

export function App() {
  const [assets, setAssets] = React.useState<Asset[]>(initialAssets)
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)

  // KPI calculations
  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0)
  const activeCount = assets.filter((a) => a.status === "Active").length
  const maintenanceCount = assets.filter((a) => a.status === "Maintenance").length
  const reservedCount = assets.filter((a) => a.status === "Reserved").length

  const handleAddAsset = (newAsset: Asset) => {
    setAssets((prev) => [newAsset, ...prev])
  }

  const handleDeleteAsset = (id: string) => {
    const assetToDelete = assets.find((a) => a.id === id)
    setAssets((prev) => prev.filter((a) => a.id !== id))
    toast.error(`Removed asset "${assetToDelete?.name || id}"`, {
      description: "Asset deleted from current register.",
    })
  }

  const handleExportExcel = () => {
    exportAssetsToExcel(assets)
    toast.success("Excel report exported!", {
      description: `Downloaded asset-register.xlsx (${assets.length} items)`,
    })
  }

  const handleExportPDF = () => {
    exportAssetsToPDF(assets)
    toast.success("PDF audit report exported!", {
      description: `Downloaded asset-report.pdf (${assets.length} items)`,
    })
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
      <Toaster position="top-right" richColors />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-foreground">AssetPulse</h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Asset Lifecycle & Inventory Management System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-1.5 text-xs h-9 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden md:inline">Export Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="gap-1.5 text-xs h-9 cursor-pointer"
            >
              <FileText className="h-4 w-4 text-rose-600" />
              <span className="hidden md:inline">Export PDF</span>
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              size="sm"
              className="gap-1.5 text-xs h-9 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Register Asset</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Valuation
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 font-medium">+4.2%</span> across {assets.length} assets
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Deployed
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
                <Laptop className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((activeCount / (assets.length || 1)) * 100).toFixed(0)}% fleet utilization
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                In Maintenance
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
                <Wrench className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{maintenanceCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Under active inspection / repair</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Reserved / Surplus
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reservedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Available for deployment</p>
            </CardContent>
          </Card>
        </section>

        {/* Analytics & Charts */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Portfolio & Fleet Analytics
            </h2>
          </div>
          <AnalyticsCharts assets={assets} />
        </section>

        {/* Asset Inventory Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Asset Inventory Register
              </h2>
              <p className="text-xs text-muted-foreground">
                Search, filter, inspect status, and audit all physical and digital hardware assets.
              </p>
            </div>
          </div>

          <AssetDataTable data={assets} onDeleteAsset={handleDeleteAsset} />
        </section>
      </main>

      {/* Add Asset Modal */}
      <AddAssetModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddAsset={handleAddAsset}
      />
    </div>
  )
}

export default App
