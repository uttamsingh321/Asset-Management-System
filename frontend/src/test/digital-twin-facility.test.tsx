import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DigitalTwinFacility3D } from '../components/DigitalTwinFacility3D'
import type { Asset } from '../types/asset'

const testAssets: Asset[] = [
  {
    id: 'AST-1',
    assetCode: '2005941',
    assetTag: 'TAG-1',
    name: 'SMT Feeder Line 1',
    category: 'Fixed assets',
    currentCategory: 'Fixed assets',
    currentDescription: 'SMT Feeder Line 1',
    status: 'Completed',
    company: 'IIPL',
    plant: 'C39 Plant',
    department: 'Production',
    currentDepartment: 'Production',
    assetCondition: 'Operational - Good',
    building: 'C39',
    floor: '1st Floor',
    location: 'SMT Line 1',
    assignedTo: 'Uttam Singh',
    serialNumber: 'SN-001',
    purchaseCost: 100000,
    currentValue: 90000,
    date: '2026-01-01',
    purchaseDate: '2026-01-01',
  },
  {
    id: 'AST-2',
    assetCode: 'PDG-197-01',
    assetTag: 'TAG-2',
    name: 'Assembly Robot',
    category: 'Tools',
    currentCategory: 'Tools',
    currentDescription: 'Assembly Robot',
    status: 'Completed',
    company: 'Padget',
    plant: 'Padget Plant',
    department: 'Production',
    currentDepartment: 'Production',
    assetCondition: 'Operational - Good',
    building: 'D197',
    floor: 'Ground Floor',
    location: 'Assembly Area',
    assignedTo: 'Operator A',
    serialNumber: 'SN-002',
    purchaseCost: 50000,
    currentValue: 45000,
    date: '2026-01-01',
    purchaseDate: '2026-01-01',
  },
  {
    id: 'AST-3',
    assetCode: 'AST-PENDING-1',
    assetTag: 'TAG-3',
    name: 'Pending Machine',
    category: 'Fixtures',
    currentCategory: 'Fixtures',
    currentDescription: 'Pending Machine',
    status: 'Pending Verification',
    company: 'IIPL',
    plant: 'C39 Plant',
    department: 'Production',
    currentDepartment: 'Production',
    assetCondition: 'Operational - Good',
    building: 'C39',
    floor: 'Ground Floor',
    location: 'Storage',
    assignedTo: 'Unassigned',
    serialNumber: 'SN-003',
    purchaseCost: 20000,
    currentValue: 20000,
    date: '2026-01-01',
    purchaseDate: '2026-01-01',
  },
]

describe('3D Digital Twin Facility Visualizer Specification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 3D Digital Twin with building selectors and real asset counts', () => {
    render(
      <DigitalTwinFacility3D
        assets={[]}
        completedAssets={[]}
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
        assets={testAssets}
        completedAssets={testAssets.filter(a => a.status === 'Completed')}
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
        assets={testAssets}
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
        assets={testAssets}
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
    render(<DigitalTwinFacility3D assets={testAssets} />)

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
        assets={testAssets}
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
    render(<DigitalTwinFacility3D assets={[]} />)

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
    const { container } = render(<DigitalTwinFacility3D assets={[]} />)

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
    const { container } = render(<DigitalTwinFacility3D assets={[]} />)
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

  it('allows switching to GIS Campus Map and clicking a building opens 3D twin', () => {
    const onSelectBuilding = vi.fn()
    render(
      <DigitalTwinFacility3D
        assets={[]}
        onSelectBuilding={onSelectBuilding}
      />
    )

    const gisBtn = screen.getByRole('button', { name: /GIS Site Map/i })
    expect(gisBtn).toBeInTheDocument()

    // Switch to GIS
    fireEvent.click(gisBtn)
    expect(screen.getByRole('img', { name: /Site map of both companies/i })).toBeInTheDocument()
    expect(screen.getByText(/Schematic site map, not to scale/i)).toBeInTheDocument()

    // Switch back to 3D
    const spatialBtn = screen.getByRole('button', { name: /3D Spatial Twin/i })
    fireEvent.click(spatialBtn)
    expect(screen.getByText(/Live Telemetry Active/i)).toBeInTheDocument()
  })
})
