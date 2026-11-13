import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import { navItems, meridianPages } from '../data/meridianData'

describe('Meridian UI/UX Zero Dummy Data & All Dashboard Routes', () => {
  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('Renders Executive Dashboard with zero dummy data', () => {
    render(<App />)
    expect(screen.getAllByText(/Meridian/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Good morning, Priya/i)).toBeInTheDocument()
    // Zero assets by default
    expect(screen.getByText('0', { selector: '.hero .n' })).toBeInTheDocument()
    expect(screen.getByText(/assets under management/i)).toBeInTheDocument()
    expect(screen.getByText(/Register equipment to begin tracking/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Maintenance due/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Warranties expiring/i)).toBeInTheDocument()
    expect(screen.getByText(/Open work orders/i)).toBeInTheDocument()
    expect(screen.getByText(/Spend this quarter/i)).toBeInTheDocument()
    expect(screen.getByText(/Cost overview/i)).toBeInTheDocument()
    expect(screen.getByText(/Meridian insights/i)).toBeInTheDocument()
  })

  it('Verifies EVERY SINGLE DASHBOARD page renders zero dummy data cleanly', () => {
    const { unmount } = render(<App />)

    // Test each of the 11 sub-dashboards
    const subpages = navItems.filter((item) => item.key !== 'dashboard')
    for (const item of subpages) {
      const pageData = meridianPages[item.key]
      expect(pageData).toBeDefined()

      // Click the nav item
      const navLink = screen.getByText(item.label)
      fireEvent.click(navLink)

      // Verify page title, subtitle, and zero-record state
      expect(screen.getByRole('heading', { level: 1, name: pageData.t })).toBeInTheDocument()
      expect(screen.getByText(pageData.s)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: pageData.ah })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: pageData.bh })).toBeInTheDocument()
      expect(screen.getByText(new RegExp(`Click "${pageData.btn}" to add your first entry`, 'i'))).toBeInTheDocument()
    }
    unmount()
  })

  it('Rule 2: Initial render completes in under 100ms', () => {
    const start = performance.now()
    render(<App />)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(100)
  })

  it('Interactive AI chips update answers with zero-data messages', () => {
    render(<App />)
    const chipBtn = screen.getByText('Schedule inspections')
    fireEvent.click(chipBtn)
    expect(
      screen.getByText(/No active inspection candidates found/i)
    ).toBeInTheDocument()
  })
})
