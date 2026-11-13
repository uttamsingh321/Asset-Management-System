import * as React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table"
import type { Asset } from "@/types/asset"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowUpDown,
  Search,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Archive,
  PackageSearch,
} from "lucide-react"

interface AssetDataTableProps {
  data: Asset[]
  onDeleteAsset: (id: string) => void
}

export function AssetDataTable({ data, onDeleteAsset }: AssetDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")

  const filteredData = React.useMemo(() => {
    if (categoryFilter === "all") return data
    return data.filter((item) => item.category === categoryFilter)
  }, [data, categoryFilter])

  const columns = React.useMemo<ColumnDef<Asset>[]>(
    () => [
      {
        accessorKey: "assetTag",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Tag ID
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
            {row.getValue("assetTag")}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Asset Name
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.location}</span>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {row.getValue("category")}
          </span>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.getValue("department")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status
          if (status === "Active") {
            return (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Active
              </Badge>
            )
          }
          if (status === "Maintenance") {
            return (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Maintenance
              </Badge>
            )
          }
          if (status === "Reserved") {
            return (
              <Badge variant="info" className="gap-1">
                <Clock className="h-3 w-3" /> Reserved
              </Badge>
            )
          }
          return (
            <Badge variant="secondary" className="gap-1">
              <Archive className="h-3 w-3" /> Retired
            </Badge>
          )
        },
      },
      {
        accessorKey: "assignedTo",
        header: "Assigned To",
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.getValue("assignedTo")}</span>
        ),
      },
      {
        accessorKey: "currentValue",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            Current Value
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const val = Number(row.getValue("currentValue"))
          return (
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              ${val.toLocaleString()}
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteAsset(row.original.id)}
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            title="Delete Asset"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [onDeleteAsset]
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 6,
      },
    },
  })

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets, tags, users..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Categories</option>
            <option value="IT Hardware">IT Hardware</option>
            <option value="Networking">Networking</option>
            <option value="Vehicles">Vehicles</option>
            <option value="Office Equipment">Office Equipment</option>
            <option value="Audio/Visual">Audio/Visual</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <PackageSearch className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium text-foreground">No assets found</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      {globalFilter || categoryFilter !== "all"
                        ? "No assets match your search or filter criteria."
                        : "Your inventory register is currently empty. Click 'Register Asset' to add equipment."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {table.getRowModel().rows.length} of {filteredData.length} assets
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Button>
          <span className="text-xs font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 gap-1"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
