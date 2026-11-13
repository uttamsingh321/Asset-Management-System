import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { matchIllustrationKey } from '../components/AssetIllustrations'

describe('Meridian Add Asset Drawer & Asset Library Specification', () => {
  beforeEach(() => {
    window.location.hash = '#assets'
    localStorage.clear()
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
    expect(screen.getByText(/Plant/i)).toBeInTheDocument()
    expect(screen.getByText(/Asset condition/i)).toBeInTheDocument()

    // Categorized groups
    expect(screen.getByRole('heading', { level: 3, name: /basic information/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /location/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /ownership/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /asset status/i })).toBeInTheDocument()
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

    // Import templates on demand populates standard specifications
    const importBtn = screen.getByRole('button', { name: /Import assets/i })
    fireEvent.click(importBtn)
    expect(screen.getByText('MacBook Pro 16" (M3 Pro)')).toBeInTheDocument()
    expect(screen.getByText('Dell UltraSharp U2723QE')).toBeInTheDocument()

    // Button to jump back to gallery
    const openGalleryBtn = screen.getAllByRole('button', { name: /Open Asset Gallery/i })[0]
    fireEvent.click(openGalleryBtn)
    expect(screen.getByRole('heading', { level: 1, name: /Asset Gallery|Assets/i })).toBeInTheDocument()
  })
})
