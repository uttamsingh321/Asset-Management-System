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

  // Location & Entity
  company?: 'IIPL' | 'Padget' | string
  plant: string
  building?: 'C39' | 'D197' | 'D198' | 'D199' | string
  floor?: string
  currentLocation?: string

  // Ownership & Responsible In-charge
  currentDepartment?: string
  submitter?: string
  inChargeId?: string
  inChargeName?: string
  whoInCharge?: string

  // Asset Status
  assetCondition: string
  movementReason?: string
  remarks?: string
  unavailabilityReasons?: {
    assetCode?: string
    serialNumber?: string
    plant?: string
    assetCondition?: string
    [key: string]: string | undefined
  }

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
