import type { AssetTypeTemplate } from '@/types/asset'

// Zero dummy data by default
export const initialAssetTypes: AssetTypeTemplate[] = []

// Optional sample templates available for import on demand
export const sampleAssetTemplates: AssetTypeTemplate[] = [
  {
    id: 'type-1',
    name: 'MacBook Pro 16" (M3 Pro)',
    category: 'Laptops & Compute',
    manufacturer: 'Apple',
    specs: {
      Processor: 'Apple M3 Pro',
      Memory: '18 GB unified',
      Storage: '512 GB SSD',
      Warranty: '36 months',
      'Useful life': '4 years',
    },
  },
  {
    id: 'type-2',
    name: 'Dell UltraSharp U2723QE',
    category: 'Monitors & Displays',
    manufacturer: 'Dell',
    specs: {
      Resolution: '4K UHD (3840 x 2160)',
      Panel: 'IPS Black',
      Connectivity: 'USB-C 90W PD, RJ45',
      Warranty: '36 months',
      'Useful life': '5 years',
    },
  },
  {
    id: 'type-3',
    name: 'iPad Air (M2)',
    category: 'Tablets & Mobile',
    manufacturer: 'Apple',
    specs: {
      Display: '11-inch Liquid Retina',
      Chip: 'Apple M2',
      Storage: '128 GB',
      Warranty: '24 months',
      'Useful life': '3 years',
    },
  },
  {
    id: 'type-4',
    name: 'Hydraulic press HP-200 series',
    category: 'Heavy Machinery',
    manufacturer: 'Schuler',
    specs: {
      Capacity: '200 Tonnes',
      Stroke: '450 mm',
      Power: '30 kW',
      Warranty: '60 months',
      'Useful life': '15 years',
    },
  },
  {
    id: 'type-5',
    name: 'CNC vertical mill VMC 850',
    category: 'Heavy Machinery',
    manufacturer: 'Haas Automation',
    specs: {
      Spindle: '12,000 RPM',
      Travel: '850 x 510 x 510 mm',
      Taper: 'BT40',
      Warranty: '36 months',
      'Useful life': '12 years',
    },
  },
  {
    id: 'type-6',
    name: 'Chiller unit 50 TR',
    category: 'HVAC & Facility',
    manufacturer: 'Daikin',
    specs: {
      Refrigerant: 'R-134a',
      Cooling: '50 TR (175 kW)',
      Compressor: 'Screw type',
      Warranty: '60 months',
      'Useful life': '15 years',
    },
  },
  {
    id: 'type-7',
    name: 'Tata Ace Gold delivery van',
    category: 'Fleet & Logistics',
    manufacturer: 'Tata Motors',
    specs: {
      Engine: '2-cylinder 700cc BS-VI',
      Payload: '750 kg',
      Fuel: 'Diesel / CNG',
      Warranty: '36 months / 72,000 km',
      'Useful life': '8 years',
    },
  },
  {
    id: 'type-8',
    name: 'Godrej ergonomic desk',
    category: 'Furniture & Workstation',
    manufacturer: 'Godrej Interio',
    specs: {
      Material: 'Pre-laminated engineered wood',
      Mechanism: 'Dual-motor electric height adjust',
      Warranty: '60 months',
      'Useful life': '10 years',
    },
  },
  {
    id: 'type-9',
    name: 'SKF 6204-2RS bearing',
    category: 'Spares & Consumables',
    manufacturer: 'SKF',
    specs: {
      Bore: '20 mm',
      'Outer Diameter': '47 mm',
      Width: '14 mm',
      Seal: 'Rubber contact seals both sides',
      'Useful life': '5 years',
    },
  },
]
