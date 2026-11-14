import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { matchIllustrationKey } from '../components/AssetIllustrations'
import { autoCategorize, parseExcelDate, parseExcelOrCsvFile } from '../lib/excelImporter'

describe('Meridian Add Asset Drawer & Asset Library Specification', () => {
  beforeEach(() => {
    window.location.hash = '#assets'
    localStorage.clear()
    localStorage.setItem('meridian_assets', '[]')
  })

  it('Image Rule: Keyword matching helper accurately resolves all required equipment graphics', () => {
    expect(matchIllustrationKey('MacBook Pro 16" (M3 Pro)', 'Laptops & Compute')).toBe('laptop')
    expect(matchIllustrationKey('Dell UltraSharp U2723QE', 'Monitors & Displays')).toBe('monitor')
    expect(matchIllustrationKey('iPad Air (M2)', 'Tablets & Mobile')).toBe('tablet')
    expect(matchIllustrationKey('Hydraulic press HP-200 series', 'Heavy Machinery')).toBe('hydraulic press')
    expect(matchIllustrationKey('CNC vertical mill VMC 850', 'Heavy Machinery')).toBe('cnc mill')
    expect(matchIllustrationKey('Chiller unit 50 TR', 'HVAC & Facility')).toBe('chiller')
    expect(matchIllustrationKey('Tata Ace Gold delivery van', 'Fleet & Logistics')).toBe('delivery van')
    expect(matchIllustrationKey('Godrej ergonomic desk', 'Furniture & Workstation')).toBe('desk')
    expect(matchIllustrationKey('SKF 6204-2RS bearing', 'Spares & Consumables')).toBe('bearing')
    expect(matchIllustrationKey('Zebra ZD421 Label Printer', 'Hardware')).toBe('label printer')
    expect(matchIllustrationKey('Honeywell Voyager Handheld Scanner', 'Peripherals')).toBe('handheld scanner')
    expect(matchIllustrationKey('Mystery item 999', 'Unknown')).toBe('box')
  })

  it('PART 1: Add Asset side panel opens with exact field groups and supports close actions', async () => {
    render(<App />)

    // Click "Add asset" button
    const addAssetBtns = screen.getAllByRole('button', { name: /add asset/i })
    fireEvent.click(addAssetBtns[0])

    // Drawer header and title
    expect(screen.getByRole('heading', { level: 2, name: 'Add asset' })).toBeInTheDocument()

    // Required fields marked with *
    expect(screen.getAllByText(/Asset code/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Asset serial number/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Plant/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Asset condition/i)).toBeInTheDocument()

    // Categorized groups
    expect(screen.getByRole('heading', { level: 3, name: /basic information/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /missing physical details to fill/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /media/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /metadata/i })).toBeInTheDocument()

    // Close button dismisses drawer
    const closeBtn = screen.getByLabelText(/close add asset panel/i)
    fireEvent.click(closeBtn)
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: 'Add asset' })).not.toBeInTheDocument()
    })
  })

  it('Media inputs: Clicking Asset photo and ID card reveals Camera and File options; Asset code is camera-only', async () => {
    // Mock navigator.mediaDevices.getUserMedia and HTMLMediaElement.prototype.play for headless test runner
    const mockTrack = { stop: vi.fn() }
    const mockStream = { getTracks: () => [mockTrack] }
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    })
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)

    render(<App />)

    const addAssetBtns = screen.getAllByRole('button', { name: /add asset/i })
    fireEvent.click(addAssetBtns[0])

    // Initially clean cards without exposed options
    expect(screen.getByText(/Upload photo/i)).toBeInTheDocument()
    expect(screen.getByText(/ID badge/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /📷 Open Camera/i })).toBeInTheDocument()
    expect(screen.getByText(/No file import/i)).toBeInTheDocument()

    // Clicking Asset photo card reveals options
    fireEvent.click(screen.getByText(/Upload photo/i))
    expect(screen.getAllByRole('button', { name: /📷 Camera/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /📁 File/i })[0]).toBeInTheDocument()

    // Clicking ID card picture card reveals options
    fireEvent.click(screen.getByText(/ID badge/i))
    expect(screen.getAllByRole('button', { name: /📷 Camera/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /📁 File/i })).toHaveLength(2)

    // Clicking Asset code camera button directly triggers camera viewfinder
    fireEvent.click(screen.getByRole('button', { name: /📷 Open Camera/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Live Camera Scanner/i })).toBeInTheDocument()
      expect(screen.getByText(/Scan Asset Code \(Camera Only\)/i)).toBeInTheDocument()
    })
  })

  it('PART 1: Saving a new physical asset validates, prepends to gallery, and displays toast', async () => {
    render(<App />)

    // Open drawer
    const addAssetBtn = screen.getAllByRole('button', { name: /add asset/i })[0]
    fireEvent.click(addAssetBtn)

    // Fill in required fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. AST-DEL-0492/i), {
      target: { value: 'AST-PUNE-001' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SN-88392104-X/i), {
      target: { value: 'SN-M3-99201' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Pune Central Plant/i), {
      target: { value: 'Pune Manufacturing Plant' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Operational - Excellent \/ New/i), {
      target: { value: 'Operational - New' },
    })
    fireEvent.change(screen.getByPlaceholderText(/MacBook Pro 16 inch M3 Pro Space Black/i), {
      target: { value: 'MacBook Pro 16" (M3 Pro)' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Laptops & Compute/i), {
      target: { value: 'Laptops & Compute' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Name: e\.g\. Rajesh Kumar/i), {
      target: { value: 'Rajesh Kumar' },
    })

    // Submit form via "Save asset"
    fireEvent.click(screen.getByRole('button', { name: /save asset/i }))

    // Drawer closes and asset appears in gallery
    await waitFor(() => {
      expect(screen.getByText('AST-PUNE-001')).toBeInTheDocument()
      expect(screen.getByText(/SN-M3-99201/i)).toBeInTheDocument()
      expect(screen.getByText(/Pune Manufacturing Plant/i)).toBeInTheDocument()
    })

    // Delete bin button deletes the asset
    const deleteBtn = screen.getByRole('button', { name: /delete asset AST-PUNE-001/i })
    expect(deleteBtn).toBeInTheDocument()
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.queryByText('AST-PUNE-001')).not.toBeInTheDocument()
      expect(screen.getByText(/No physical assets registered yet/i)).toBeInTheDocument()
    })
  })

  it('PART 2: Asset Library features flow strip, 4 summary cards, quick-add, expandable details rows', async () => {
    render(<App />)

    // Switch to Asset Library via sidebar navigation
    const libraryNavBtn = screen.getByRole('link', { name: /Asset Library/i })
    fireEvent.click(libraryNavBtn)

    // Header & Subline
    expect(screen.getByRole('heading', { level: 1, name: 'Asset Library' })).toBeInTheDocument()
    expect(
      screen.getByText(/Asset types and templates: categories, models and specifications/i)
    ).toBeInTheDocument()

    // Flow strip steps 1, 2, 3
    expect(screen.getByText(/Import or register assets/i)).toBeInTheDocument()
    expect(screen.getByText(/Match each model to a type/i)).toBeInTheDocument()
    expect(screen.getByText(/Each asset appears in the Gallery/i)).toBeInTheDocument()

    // 4 Summary cards with zero dummy data
    expect(screen.getAllByText('Categories')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Asset types')[0]).toBeInTheDocument()
    expect(screen.getByText('Specification fields')).toBeInTheDocument()
    expect(screen.getByText('Assets without a type')).toBeInTheDocument()

    // Zero dummy data clean state by default
    expect(screen.getByText(/No asset types defined yet/i)).toBeInTheDocument()
    expect(screen.getByText(/No categories defined yet/i)).toBeInTheDocument()

    // Quick-add row: add a new type
    fireEvent.change(screen.getByPlaceholderText(/Type name \(e\.g\. MacBook Pro 16\)/i), {
      target: { value: 'Cisco Catalyst 9300 Switch' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Category \(e\.g\. Laptops & Compute\)/i), {
      target: { value: 'Networking' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Manufacturer \(e\.g\. Apple\)/i), {
      target: { value: 'Cisco' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Add type/i }))

    // New type appears immediately in list
    expect(screen.getByText('Cisco Catalyst 9300 Switch')).toBeInTheDocument()
    expect(screen.getByText(/1 types registered/i)).toBeInTheDocument()

    // Delete bin button deletes the type
    const deleteTypeBtn = screen.getByRole('button', { name: /delete type Cisco Catalyst 9300 Switch/i })
    expect(deleteTypeBtn).toBeInTheDocument()
    fireEvent.click(deleteTypeBtn)

    expect(screen.queryByText('Cisco Catalyst 9300 Switch')).not.toBeInTheDocument()
    expect(screen.getByText(/No asset types defined yet/i)).toBeInTheDocument()

    // Import assets triggers file selection input (no dummy data)
    const fileInput = screen.getByLabelText(/Import Excel or CSV file/i) as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    const clickSpy = vi.spyOn(fileInput, 'click')

    const importBtn = screen.getByRole('button', { name: /Import assets/i })
    fireEvent.click(importBtn)
    expect(clickSpy).toHaveBeenCalled()

    // Button to jump back to gallery
    const openGalleryBtn = screen.getAllByRole('button', { name: /Open Asset Gallery/i })[0]
    fireEvent.click(openGalleryBtn)
    expect(screen.getByRole('heading', { level: 1, name: /Asset Gallery|Assets/i })).toBeInTheDocument()
  })

  test('Auto-categorization classifier accurately routes equipment into category sections', () => {
    // Rule: after we hit import it will automatic distinguish where which one should store:
    // e.g. computer -> Computers, mouse -> Mice & Pointers, laptop -> Laptops, etc.

    // Computers
    expect(autoCategorize('Desktop Computer HP ProDesk 400', '')).toBe('Computers')
    expect(autoCategorize('Office PC Tower Optiplex 7090', '')).toBe('Computers')
    expect(autoCategorize('iMac 24-inch M3 workstation', '')).toBe('Computers')

    // Mice & Pointers
    expect(autoCategorize('Logitech Wireless Mouse M185', '')).toBe('Mice & Pointers')
    expect(autoCategorize('Apple Magic Trackpad', '')).toBe('Mice & Pointers')
    expect(autoCategorize('MX Master 3S wireless mouse', '')).toBe('Mice & Pointers')

    // Keyboards
    expect(autoCategorize('Mechanical Gaming Keyboard RGB', '')).toBe('Keyboards')
    expect(autoCategorize('Logitech K380 Bluetooth Keyboard', '')).toBe('Keyboards')

    // Laptops
    expect(autoCategorize('MacBook Pro 16 inch', '')).toBe('Laptops')
    expect(autoCategorize('Lenovo ThinkPad X1 Carbon Gen 10 Laptop', '')).toBe('Laptops')

    // Monitors & Displays
    expect(autoCategorize('Dell UltraSharp U2723QE 4K Monitor', '')).toBe('Monitors & Displays')
    expect(autoCategorize('LG Curved Ultrawide Display 34-inch', '')).toBe('Monitors & Displays')

    // Heavy Machinery & Vehicles & Spares
    expect(autoCategorize('Hydraulic press HP-200 series', '')).toBe('Heavy Machinery')
    expect(autoCategorize('CNC vertical mill VMC 850', '')).toBe('Heavy Machinery')
    expect(autoCategorize('Tata Ace Gold delivery van', '')).toBe('Fleet & Vehicles')
    expect(autoCategorize('Chiller unit 50 TR', '')).toBe('HVAC & Facility')
    expect(autoCategorize('Godrej ergonomic desk', '')).toBe('Furniture & Fixtures')
    expect(autoCategorize('SKF 6204-2RS bearing', '')).toBe('Spares & Consumables')
  })

  test('Notifications feature a visible cross close button to dismiss alerts', async () => {
    const { toast } = await import('sonner')
    render(<App />)

    toast.success('All asset types removed from library')

    await waitFor(() => {
      expect(screen.getByText('All asset types removed from library')).toBeInTheDocument()
    })

    // Sonner close button has data-close-button="true" or aria-label="Close toast"
    const closeBtn = document.querySelector('[data-close-button="true"], [aria-label="Close toast"]')
    expect(closeBtn).toBeInTheDocument()
    if (closeBtn) {
      fireEvent.click(closeBtn)
    }
  })

  test('Required fields with * mandate a reason if data is marked unavailable', async () => {
    render(<App />)

    // Open Add asset panel
    const addAssetBtns = screen.getAllByRole('button', { name: /add asset/i })
    fireEvent.click(addAssetBtns[0])

    // Try saving without entering required fields or reasons
    fireEvent.click(screen.getByRole('button', { name: /save asset/i }))

    await waitFor(() => {
      expect(screen.getByText(/Asset code is required/i)).toBeInTheDocument()
      expect(screen.getByText(/Asset serial number is required/i)).toBeInTheDocument()
      expect(screen.getByText(/Plant is required/i)).toBeInTheDocument()
      expect(screen.getByText(/Asset condition is required/i)).toBeInTheDocument()
    })

    // Toggle "Data unavailable?" buttons for all 4 required fields
    const unavailBtns = screen.getAllByRole('button', { name: /Data unavailable\?/i })
    expect(unavailBtns.length).toBe(4)

    // Mark Asset code and Serial number as unavailable
    fireEvent.click(unavailBtns[0]) // Asset code
    fireEvent.click(unavailBtns[1]) // Asset serial number

    // Now reason inputs should appear
    expect(screen.getByLabelText(/Reason why Asset code is not available/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Reason why Serial number is not available/i)).toBeInTheDocument()

    // Try saving with unavailable toggled but missing reasons
    fireEvent.click(screen.getByRole('button', { name: /save asset/i }))

    await waitFor(() => {
      expect(screen.getByText(/Please mention the reason why Asset code is not available/i)).toBeInTheDocument()
    })

    // Fill in reasons for unavailable fields
    fireEvent.change(screen.getByPlaceholderText(/Barcode label torn, vendor tag pending delivery/i), {
      target: { value: 'Legacy unit with worn QR barcode sticker' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Serial plate scratched\/unreadable/i), {
      target: { value: 'Serial engraved inside machine chassis' },
    })

    // Fill in regular remaining required fields (Plant and Condition)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Pune Central Plant/i), {
      target: { value: 'Chennai Logistics Hub' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Operational - Excellent \/ New/i), {
      target: { value: 'Operational - Good' },
    })
    fireEvent.change(screen.getByPlaceholderText(/MacBook Pro 16 inch M3 Pro Space Black/i), {
      target: { value: 'Logitech Barcode Handheld Terminal' },
    })

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /save asset/i }))

    // Verify asset was created and displays missing field justifications in gallery
    await waitFor(() => {
      expect(screen.getByText(/Logitech Barcode Handheld Terminal/i)).toBeInTheDocument()
      expect(screen.getByText(/Chennai Logistics Hub/i)).toBeInTheDocument()
      expect(screen.getByText(/Missing field justifications/i)).toBeInTheDocument()
      expect(screen.getByText(/Legacy unit with worn QR barcode sticker/i)).toBeInTheDocument()
    })
  })

  test('Excel Import stores and preserves the date available inside the spreadsheet', async () => {
    // 1. Unit tests for parseExcelDate helper
    expect(parseExcelDate(new Date('2023-04-15T00:00:00Z'))).toBe('2023-04-15')
    expect(parseExcelDate('2022-11-20')).toBe('2022-11-20')
    expect(parseExcelDate('15/08/2021')).toBe('2021-08-15')
    expect(parseExcelDate('25-12-2020')).toBe('2020-12-25')
    // Excel serial number 44927 is 2023-01-01
    expect(parseExcelDate(44927)).toBe('2023-01-01')

    // 2. Integration test for parseExcelOrCsvFile
    const csvContent = [
      'Asset Code,Name,Category,Date,Plant,Condition',
      'AST-EXP-001,MacBook Pro M2,Laptops,2022-09-15,Pune Center,Operational - Good',
      'AST-EXP-002,Dell 4K Display,Monitors,2023-03-28,Mumbai Plant,Operational - New',
      'AST-EXP-003,Hydraulic Press HP-200,Heavy Machinery,2021-12-05,Chennai Hub,Operational - Good',
    ].join('\n')

    const file = new File([csvContent], 'assets_inventory_with_dates.csv', { type: 'text/csv' })
    const result = await parseExcelOrCsvFile(file)

    expect(result.assets).toHaveLength(3)
    expect(result.assets[0].date).toBe('2022-09-15')
    expect(result.assets[0].purchaseDate).toBe('2022-09-15')

    expect(result.assets[1].date).toBe('2023-03-28')
    expect(result.assets[1].purchaseDate).toBe('2023-03-28')

    expect(result.assets[2].date).toBe('2021-12-05')
    expect(result.assets[2].purchaseDate).toBe('2021-12-05')
  })
})
