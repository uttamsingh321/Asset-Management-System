export type AssetStatus = "Active" | "Maintenance" | "Reserved" | "Retired"

export type AssetCategory =
  | "IT Hardware"
  | "Networking"
  | "Vehicles"
  | "Office Equipment"
  | "Audio/Visual"

export interface Asset {
  id: string
  assetTag: string
  name: string
  category: AssetCategory
  department: string
  status: AssetStatus
  purchaseDate: string
  purchaseCost: number
  currentValue: number
  assignedTo: string
  location: string
}
