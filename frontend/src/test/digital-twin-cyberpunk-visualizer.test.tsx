import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DigitalTwin from '../digitalTwin/DigitalTwin'

describe('Cyberpunk Digital Twin & GIS Facility Visualizer Specification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders top telemetry header with live badge and building chips', () => {
    render(<DigitalTwin />)

    expect(screen.getByText('Digital Twin Facility Visualizer')).toBeInTheDocument()
    expect(screen.getByText('Live telemetry')).toBeInTheDocument()

    // Building chips C39, D197, D198, D199
    expect(screen.getAllByRole('button', { name: 'C39' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'D197' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'D198' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'D199' })[0]).toBeInTheDocument()
  })

  it('renders view mode switches: GIS site map and 3D floor twin', () => {
    render(<DigitalTwin />)

    const gisBtn = screen.getByRole('button', { name: /GIS site map/i })
    const twinBtn = screen.getByRole('button', { name: /3D floor twin/i })

    expect(gisBtn).toBeInTheDocument()
    expect(twinBtn).toBeInTheDocument()
    expect(gisBtn.className).toContain('on')
  })

  it('renders the 5 Top KPI Cards matching exact target dashboard', () => {
    render(<DigitalTwin />)

    expect(screen.getByText('Units in C39')).toBeInTheDocument()
    expect(screen.getByText('Deployed')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Faults')).toBeInTheDocument()
    expect(screen.getByText('Selected floor')).toBeInTheDocument()
  })

  it('renders GIS isometric SVG site map with extruded buildings, pedestrian, and company sidebar', () => {
    render(<DigitalTwin />)

    expect(screen.getByRole('img', { name: /Site map of both companies/i })).toBeInTheDocument()
    expect(screen.getByText(/Schematic site map, not to scale/i)).toBeInTheDocument()

    // Right sidebar sections
    expect(screen.getByText(/Ismartu India Pvt Ltd \(5020\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Padget Electronics Pvt Ltd \(9500\)/i)).toBeInTheDocument()
  })

  it('clicking 3D floor twin toggles to stacked floors, walker technician, and stairs', () => {
    render(<DigitalTwin />)

    const twinBtn = screen.getByRole('button', { name: /3D floor twin/i })
    fireEvent.click(twinBtn)

    // Left floor rail buttons
    expect(screen.getByRole('button', { name: /Ground floor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1st floor · SMT/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2nd floor · Quality/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3rd floor · Finance & IT/i })).toBeInTheDocument()

    // 3D camera & view controls
    expect(screen.getByRole('button', { name: /Exploded view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Heatmap/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Spin/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Top-down/i })).toBeInTheDocument()
  })
})
