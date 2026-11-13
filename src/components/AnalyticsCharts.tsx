import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import type { Asset } from "@/types/asset"

interface AnalyticsChartsProps {
  assets: Asset[]
}

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899"]

export function AnalyticsCharts({ assets }: AnalyticsChartsProps) {
  // Aggregate by Category
  const categoryData = assets.reduce(
    (acc, asset) => {
      const existing = acc.find((item) => item.name === asset.category)
      if (existing) {
        existing.value += asset.currentValue
        existing.count += 1
      } else {
        acc.push({
          name: asset.category,
          value: asset.currentValue,
          count: 1,
        })
      }
      return acc
    },
    [] as { name: string; value: number; count: number }[]
  )

  // Status breakdown
  const statusData = [
    { name: "Active", count: assets.filter((a) => a.status === "Active").length, color: "#10b981" },
    { name: "Maintenance", count: assets.filter((a) => a.status === "Maintenance").length, color: "#f59e0b" },
    { name: "Reserved", count: assets.filter((a) => a.status === "Reserved").length, color: "#3b82f6" },
    { name: "Retired", count: assets.filter((a) => a.status === "Retired").length, color: "#64748b" },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category Value Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Valuation by Category</CardTitle>
          <CardDescription>Total asset portfolio value per equipment segment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, "Valuation"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Asset Status Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Operational Health & Allocation</CardTitle>
          <CardDescription>Live ratio of deployed, servicing, and reserve inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} Units`, name]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-2">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>
                  {item.name} ({item.count})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
