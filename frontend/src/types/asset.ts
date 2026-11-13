export type AssetStatus = "Active" | "Maintenance" | "Reserved" | "Retired"

export type AssetCategory =
  | "IT Hardware"
  | "Networking"
  | "Vehicles"
  | "Office Equipment"
  | "Audio/Visual"
  | "Machinery"
  | "Industrial"

export interface Asset {
  id: string
  // Basic Information
  assetCode: string
  serialNumber: string
  currentCategory: string
  currentDescription: string
  previousCategory?: string
  previousDescription?: string

  // Location
  plant: string
  building?: string
  floor?: string
  currentLocation?: string

  // Ownership
  currentDepartment?: string
  submitter?: string

  // Asset Status
  assetCondition: string
  movementReason?: string
  remarks?: string

  // Media (Data URLs)
  assetPhoto?: string
  assetCodePhoto?: string
  idCardPicture?: string

  // Metadata
  date: string

  // Compatibility fields for tables/dashboard
  name: string
  assetTag: string
  category: string
  department: string
  status: AssetStatus
  purchaseDate: string
  purchaseCost: number
  currentValue: number
  assignedTo: string
  location: string
}

export interface AssetTypeTemplate {
  id: string
  name: string
  category: string
  manufacturer: string
  specs: Record<string, string>
  customPhotoUrl?: string
}
