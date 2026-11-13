import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Asset, AssetCategory, AssetStatus } from "@/types/asset"
import { toast } from "sonner"

const assetSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters"),
  assetTag: z.string().min(3, "Asset tag must be at least 3 characters"),
  category: z.enum([
    "IT Hardware",
    "Networking",
    "Vehicles",
    "Office Equipment",
    "Audio/Visual",
  ] as const),
  department: z.string().min(2, "Department is required"),
  status: z.enum(["Active", "Maintenance", "Reserved", "Retired"] as const),
  purchaseCost: z.coerce.number().positive("Purchase cost must be greater than 0"),
  assignedTo: z.string().min(2, "Assignee or department is required"),
  location: z.string().min(2, "Location is required"),
})

type AssetFormValues = z.infer<typeof assetSchema>

interface AddAssetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddAsset: (asset: Asset) => void
}

export function AddAssetModal({
  open,
  onOpenChange,
  onAddAsset,
}: AddAssetModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      category: "IT Hardware",
      status: "Active",
      department: "Engineering",
      purchaseCost: 1500,
    },
  })

  const onSubmit = (data: AssetFormValues) => {
    const newAsset: Asset = {
      id: `AST-${Date.now().toString().slice(-4)}`,
      assetTag: data.assetTag,
      name: data.name,
      category: data.category as AssetCategory,
      department: data.department,
      status: data.status as AssetStatus,
      purchaseDate: new Date().toISOString().split("T")[0],
      purchaseCost: Number(data.purchaseCost),
      currentValue: Number(data.purchaseCost),
      assignedTo: data.assignedTo,
      location: data.location,
    }

    onAddAsset(newAsset)
    toast.success(`Asset "${newAsset.name}" successfully registered!`, {
      description: `Tag: ${newAsset.assetTag} • Assigned to: ${newAsset.assignedTo}`,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Register New Asset</DialogTitle>
          <DialogDescription>
            Add an item to the enterprise inventory register. All fields are tracked for audit compliance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Asset Name</label>
              <Input placeholder="e.g. Dell UltraSharp 32 4K" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Asset Tag ID</label>
              <Input placeholder="e.g. AST-2024-042" {...register("assetTag")} />
              {errors.assetTag && <p className="text-xs text-destructive">{errors.assetTag.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                {...register("category")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="IT Hardware">IT Hardware</option>
                <option value="Networking">Networking</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Office Equipment">Office Equipment</option>
                <option value="Audio/Visual">Audio/Visual</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                {...register("status")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Active">Active</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Reserved">Reserved</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Department</label>
              <Input placeholder="e.g. Engineering, Sales" {...register("department")} />
              {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Purchase Cost ($)</label>
              <Input type="number" step="any" placeholder="1500" {...register("purchaseCost")} />
              {errors.purchaseCost && <p className="text-xs text-destructive">{errors.purchaseCost.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Assigned To</label>
              <Input placeholder="e.g. Employee name or team" {...register("assignedTo")} />
              {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Location</label>
              <Input placeholder="e.g. Building B - Rm 302" {...register("location")} />
              {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save Asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
