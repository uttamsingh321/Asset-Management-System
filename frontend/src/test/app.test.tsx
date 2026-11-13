import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import { navItems, meridianPages } from '../data/meridianData'

describe('Meridian UI/UX Robustness & All Dashboard Routes', () => {
  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('Renders Executive Dashboard with all primary components and KPIs', () => {
    render(<App />)
    expect(screen.getAllByText(/Meridian/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Good morning, Priya/i)).toBeInTheDocument()
    expect(screen.getByText(/12,480/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Maintenance due/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Warranties expiring/i)).toBeInTheDocument()
    expect(screen.getByText(/Open work orders/i)).toBeInTheDocument()
    expect(screen.getByText(/Spend this quarter/i)).toBeInTheDocument()
    expect(screen.getByText(/Cost overview/i)).toBeInTheDocument()
    expect(screen.getByText(/Meridian insights/i)).toBeInTheDocument()
  })

  it('Verifies EVERY SINGLE DASHBOARD page renders correctly', () => {
    const { unmount } = render(<App />)

    // Test each of the 11 sub-dashboards
    const subpages = navItems.filter((item) => item.key !== 'dashboard')
    for (const item of subpages) {
      const pageData = meridianPages[item.key]
      expect(pageData).toBeDefined()

      // Click the nav item
      const navLink = screen.getByText(item.label)
      fireEvent.click(navLink)

      // Verify the page title and subtitle render
      expect(screen.getByRole('heading', { level: 1, name: pageData.t })).toBeInTheDocument()
      expect(screen.getByText(pageData.s)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: pageData.ah })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: pageData.bh })).toBeInTheDocument()
    }
    unmount()
  })

  it('Rule 2: Initial render completes in under 100ms', () => {
    const start = performance.now()
    render(<App />)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(100)
  })

  it('Interactive AI chips update answers instantly', () => {
    render(<App />)
    const chipBtn = screen.getByText('Schedule inspections')
    fireEvent.click(chipBtn)
    expect(
      screen.getByText(/Drafted 14 inspections for Pune Plant 2/i)
    ).toBeInTheDocument()
  })
})
