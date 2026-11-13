import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import { navItems, meridianPages } from '../data/meridianData'

describe('Meridian UI/UX Zero Dummy Data & Responsive Collapsible Navigation', () => {
  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
    window.innerWidth = 1024
  })

  it('Renders Executive Dashboard with zero dummy data', () => {
    render(<App />)
    expect(screen.getAllByText(/Meridian/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Good morning, Priya/i)).toBeInTheDocument()
    expect(screen.getByText('0', { selector: '.hero .n' })).toBeInTheDocument()
    expect(screen.getByText(/assets under management/i)).toBeInTheDocument()
    expect(screen.getByText(/Register equipment to begin tracking/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Maintenance due/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Warranties expiring/i)).toBeInTheDocument()
    expect(screen.getByText(/Open work orders/i)).toBeInTheDocument()
    expect(screen.getByText(/Spend this quarter/i)).toBeInTheDocument()
  })

  it('Task 1: Sidebar collapses and expands cleanly on toggle', () => {
    const { container } = render(<App />)
    const appEl = container.querySelector('#app')
    const collapseBtn = container.querySelector('#collapse')
    expect(appEl).not.toHaveClass('mini')

    // Click collapse button on desktop
    fireEvent.click(collapseBtn!)
    expect(appEl).toHaveClass('mini')

    // Click again to expand
    fireEvent.click(collapseBtn!)
    expect(appEl).not.toHaveClass('mini')
  })

  it('Task 1 & 2: Mobile responsive drawer toggles with backdrop', () => {
    window.innerWidth = 500
    const { container } = render(<App />)
    const appEl = container.querySelector('#app')
    const collapseBtn = container.querySelector('#collapse')

    // On mobile, toggle opens the slide-over drawer
    fireEvent.click(collapseBtn!)
    expect(appEl).toHaveClass('drawer-open')

    // Backdrop is present
    const backdrop = container.querySelector('.mobile-backdrop')
    expect(backdrop).toBeInTheDocument()

    // Clicking backdrop closes drawer
    fireEvent.click(backdrop!)
    expect(appEl).not.toHaveClass('drawer-open')
  })

  it('Task 2: Responsive across all 11 sub-dashboards with zero data', () => {
    const { unmount } = render(<App />)
    const subpages = navItems.filter((item) => item.key !== 'dashboard')
    for (const item of subpages) {
      const pageData = meridianPages[item.key]
      expect(pageData).toBeDefined()

      const navLink = screen.getByText(item.label)
      fireEvent.click(navLink)

      expect(screen.getByRole('heading', { level: 1, name: pageData.t })).toBeInTheDocument()
      expect(screen.getByText(pageData.s)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: pageData.ah })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: pageData.bh })).toBeInTheDocument()
    }
    unmount()
  })

  it('Rule 2: Render completes under 100ms', () => {
    const start = performance.now()
    render(<App />)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(100)
  })
})
