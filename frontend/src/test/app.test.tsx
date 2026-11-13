import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'

describe('Meridian React Application Tests', () => {
  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('Renders Meridian executive dashboard header and KPIs', () => {
    render(<App />)
    expect(screen.getAllByText(/Meridian/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Good morning, Priya/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Maintenance due/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Warranties expiring/i)).toBeInTheDocument()
    expect(screen.getByText(/Spend this quarter/i)).toBeInTheDocument()
  })

  it('Rule 2: Render completes in under 100ms', () => {
    const start = performance.now()
    render(<App />)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(100)
  })

  it('Navigates to subpages on navigation click', () => {
    render(<App />)
    const inventoryLink = screen.getByText('Inventory')
    fireEvent.click(inventoryLink)
    expect(screen.getByText(/3,420 SKUs in 6 warehouses/i)).toBeInTheDocument()
  })
})
