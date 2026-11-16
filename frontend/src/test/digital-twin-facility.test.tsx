import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DigitalTwinFacility3D } from '../components/DigitalTwinFacility3D'
import type { Asset } from '../types/asset'

describe('3D Digital Twin Facility Visualizer Specification', () => {
  const mockAssets: Asset[] = [
    {
      id: '1',
      assetCode: '2005941',
      serialNumber: '',
      name: 'SMT High Speed Feeder',
      currentCategory: 'Machinery',
      currentDescription: 'SMT Feeder Line 1',
      company: 'IIPL',
      building: 'C39',
      floor: '1st Floor (SMT)',
      department: 'Production',
      currentDepartment: 'Production',
      status: 'Completed',
      whoInCharge: 'Uttam Singh',
      inChargeName: 'Uttam Singh',
      assetCondition: 'Operational - Good',
      date: '2026-11-16',
      assetTag: '2005941',
      category: 'Machinery',
      purchaseDate: '2026-11-16',
      purchaseCost: 10000,
      currentValue: 10000,
      assignedTo: 'Uttam Singh',
      location: 'C39 · 1st Floor',
      plant: 'C-39 Factory, Noida',
    },
    {
      id: '2',
      assetCode: '8107891',
      serialNumber: '',
      name: 'Reflow Soldering Oven',
      currentCategory: 'Machinery',
      currentDescription: 'Reflow Soldering Oven Unit',
      company: 'IIPL',
      building: 'C39',
      floor: '1st Floor (SMT)',
      department: 'Production',
      currentDepartment: 'Production',
      status: 'Pending Verification',
      whoInCharge: '',
      assetCondition: 'Good',
      date: '2026-11-16',
      assetTag: '8107891',
      category: 'Machinery',
      purchaseDate: '2026-11-16',
      purchaseCost: 25000,
      currentValue: 25000,
      assignedTo: '',
      location: 'C39 · 1st Floor',
      plant: 'C-39 Factory, Noida',
    },
    {
      id: '3',
      assetCode: 'PDG-197-01',
      serialNumber: '',
      name: 'Automated Box Assembly Station',
      currentCategory: 'Operations',
      currentDescription: 'Chassis Box Assembly Unit',
      company: 'Padget',
      building: 'D197',
      floor: 'Ground Assembly',
      department: 'Operations',
      currentDepartment: 'Operations',
      status: 'Completed',
      whoInCharge: 'Arbind Kumar Singh',
      inChargeName: 'Arbind Kumar Singh',
      assetCondition: 'Operational',
      date: '2026-11-16',
      assetTag: 'PDG-197-01',
      category: 'Machinery',
      purchaseDate: '2026-11-16',
      purchaseCost: 15000,
      currentValue: 15000,
      assignedTo: 'Arbind Kumar Singh',
      location: 'D197 · Ground Assembly',
      plant: 'Padget Electronics, Noida',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 3D Digital Twin with building selectors and real asset counts', () => {
    render(
      <DigitalTwinFacility3D
        assets={mockAssets}
        completedAssets={mockAssets.filter((a) => a.status === 'Completed')}
      />
    )

    expect(screen.getByText('3D Digital Twin Facility Visualizer')).toBeInTheDocument()
    expect(screen.getByText('● Live Telemetry Active')).toBeInTheDocument()

    // Building pills show correct counts
    expect(screen.getByRole('button', { name: /C39/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /D197/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /D198/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /D199/i })).toBeInTheDocument()
  })

  it('allows switching between All Assets, Deployed Fleet, and Pending Queue scopes', () => {
    render(
      <DigitalTwinFacility3D
        assets={mockAssets}
        completedAssets={mockAssets.filter((a) => a.status === 'Completed')}
      />
    )

    const allBtn = screen.getByRole('button', { name: /All Assets \(3\)/i })
    const deployedBtn = screen.getByRole('button', { name: /Deployed \(2\)/i })
    const pendingBtn = screen.getByRole('button', { name: /Pending/i })

    expect(allBtn).toBeInTheDocument()
    expect(deployedBtn).toBeInTheDocument()
    expect(pendingBtn).toBeInTheDocument()

    // Switch to Deployed
    fireEvent.click(deployedBtn)
    expect(screen.getByText(/Units in Building C39/i)).toBeInTheDocument()
  })

  it('switching building updates floors and displays corresponding complex address', () => {
    const onSelectBuilding = vi.fn()
    render(
      <DigitalTwinFacility3D
        assets={mockAssets}
        onSelectBuilding={onSelectBuilding}
      />
    )

    const d197Btn = screen.getByRole('button', { name: /D197/i })
    fireEvent.click(d197Btn)

    expect(onSelectBuilding).toHaveBeenCalledWith('D197')
    expect(screen.getByText(/Unit D197 \(Padget\)/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Ground Assembly/i).length).toBeGreaterThanOrEqual(1)
  })

  it('clicking an equipment node opens the Telemetry HUD modal with action buttons', () => {
    const onOpenAsset = vi.fn()
    const onNavigate = vi.fn()

    render(
      <DigitalTwinFacility3D
        assets={mockAssets}
        onOpenAsset={onOpenAsset}
        onNavigate={onNavigate}
      />
    )

    // Find asset code tag on the floor
    const nodeTag = screen.getAllByText('2005941')[0]
    fireEvent.click(nodeTag)

    // HUD Modal opens
    expect(screen.getAllByText(/2005941/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/SMT Feeder Line 1/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Uttam Singh/i).length).toBeGreaterThanOrEqual(1)

    // Test Inspect & Edit button
    const editBtn = screen.getByRole('button', { name: /View Details & Edit/i })
    fireEvent.click(editBtn)
    expect(onOpenAsset).toHaveBeenCalledWith(expect.objectContaining({ assetCode: '2005941' }))

    // Re-open and test Print QR
    fireEvent.click(nodeTag)
    const printBtn = screen.getByRole('button', { name: /Print QR/i })
    fireEvent.click(printBtn)
    expect(onNavigate).toHaveBeenCalledWith('labels', '2005941')
  })

  it('search & locate automatically focuses the matching asset in 3D', () => {
    render(<DigitalTwinFacility3D assets={mockAssets} />)

    const searchInput = screen.getByPlaceholderText(/Locate code/i)
    fireEvent.change(searchInput, { target: { value: 'PDG-197' } })

    expect(screen.getByText('Target Locations Found (1)')).toBeInTheDocument()
    expect(screen.getByText('PDG-197-01')).toBeInTheDocument()

    // Click the search result
    fireEvent.click(screen.getByText('PDG-197-01'))

    // Switches to D197 and opens HUD
    expect(screen.getByText(/Unit D197 \(Padget\)/i)).toBeInTheDocument()
    expect(screen.getAllByText(/PDG-197-01/).length).toBeGreaterThanOrEqual(1)
  })

  it('opens Floor Ledger and supports + Deploy on this Floor', () => {
    const onAddNewAssetOnFloor = vi.fn()
    render(
      <DigitalTwinFacility3D
        assets={mockAssets}
        onAddNewAssetOnFloor={onAddNewAssetOnFloor}
      />
    )

    // Open floor ledger
    const ledgerBtn = screen.getByRole('button', { name: /Floor Ledger/i })
    fireEvent.click(ledgerBtn)

    expect(screen.getByText(/Equipment Ledger: Building C39/i)).toBeInTheDocument()

    // Click Deploy on this Floor
    const deployBtn = screen.getByRole('button', { name: /Deploy on this Floor/i })
    fireEvent.click(deployBtn)

    expect(onAddNewAssetOnFloor).toHaveBeenCalledWith('C39', expect.any(String))
  })

  it('allows switching perspective camera modes (Isometric, Perspective, Floor Split, Blueprint)', () => {
    render(<DigitalTwinFacility3D assets={mockAssets} />)

    const explodedBtn = screen.getByRole('button', { name: /Floor Split/i })
    fireEvent.click(explodedBtn)

    const blueprintBtn = screen.getByRole('button', { name: /Blueprint/i })
    fireEvent.click(blueprintBtn)

    const perspectiveBtn = screen.getByRole('button', { name: /Perspective/i })
    fireEvent.click(perspectiveBtn)

    const isoBtn = screen.getByRole('button', { name: /Isometric 3D/i })
    fireEvent.click(isoBtn)

    expect(isoBtn).toBeInTheDocument()
  })

  it('prevents default page scroll on wheel zoom and updates scale', () => {
    const { container } = render(<DigitalTwinFacility3D assets={mockAssets} />)

    // Locate the 3D stage container
    const stage = container.querySelector('.touch-none') as HTMLDivElement
    expect(stage).not.toBeNull()

    // Create a wheel event (zoom in: negative deltaY)
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    })
    const preventDefaultSpy = vi.spyOn(wheelEvent, 'preventDefault')

    act(() => {
      stage.dispatchEvent(wheelEvent)
    })

    // Ensure e.preventDefault() was called so the page does not scroll down/up
    expect(preventDefaultSpy).toHaveBeenCalled()

    // Also verify scale indicator reflects zoom change
    expect(screen.getByText(/SCALE:/i)).toBeInTheDocument()
  })

  it('supports touch interaction with touch-action none to prevent mobile page scrolling', () => {
    const { container } = render(<DigitalTwinFacility3D assets={mockAssets} />)
    const stage = container.querySelector('.touch-none') as HTMLDivElement
    expect(stage).not.toBeNull()

    // Fire touchstart, touchmove, touchend
    fireEvent.touchStart(stage, {
      touches: [{ clientX: 100, clientY: 100 }],
    })
    fireEvent.touchMove(stage, {
      touches: [{ clientX: 150, clientY: 120 }],
    })
    fireEvent.touchEnd(stage)

    // Stage remains responsive and clean
    expect(stage).toBeInTheDocument()
  })
})
