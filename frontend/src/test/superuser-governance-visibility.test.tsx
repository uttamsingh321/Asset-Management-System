import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setCurrentUserProfile } from '../lib/deviceTracker'

describe('Strict Super User Access Control for System & Governance', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('meridian_auth', 'true')
    window.location.hash = '#dashboard'
    vi.restoreAllMocks()
  })

  it('Hides System & Governance, Audit & Tracking, and Administration from non-superuser', async () => {
    // Non-superuser (Employee)
    setCurrentUserProfile({
      userId: '19102709',
      userName: 'Arbind Kumar Singh',
      role: 'Employee',
      isSuperuser: false,
      department: 'Production & SMT',
    })

    render(<App />)

    // Verify sidebar does NOT display ⚙️ System & Governance
    expect(screen.queryByText(/System & Governance/i)).not.toBeInTheDocument()

    // Verify sidebar links do NOT exist
    expect(screen.queryByRole('link', { name: /Audit & Tracking/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Administration/i })).not.toBeInTheDocument()
  })

  it('Blocks direct URL navigation to #audit and #administration for non-superuser', async () => {
    // Non-superuser (Employee)
    setCurrentUserProfile({
      userId: '19102709',
      userName: 'Arbind Kumar Singh',
      role: 'Employee',
      isSuperuser: false,
      department: 'Production & SMT',
    })

    render(<App />)

    // Attempt direct navigation to #audit
    window.location.hash = '#audit'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => {
      // Must be redirected away or blocked with Access Restricted
      const hasRestricted = screen.queryByText(/Access Restricted/i)
      const hasDashboard = window.location.hash === '#dashboard'
      expect(hasRestricted || hasDashboard).toBeTruthy()
      expect(screen.queryByRole('heading', { level: 1, name: /Audit & Device Tracking/i })).not.toBeInTheDocument()
    })

    // Attempt direct navigation to #administration
    window.location.hash = '#administration'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => {
      const hasRestricted = screen.queryByText(/Access Restricted/i)
      const hasDashboard = window.location.hash === '#dashboard'
      expect(hasRestricted || hasDashboard).toBeTruthy()
    })
  })

  it('Allows Super User to view System & Governance, Audit & Tracking, and Administration', async () => {
    // Super User
    setCurrentUserProfile({
      userId: 'USR-ADMIN',
      userName: 'Uttam Singh',
      role: 'Super User',
      isSuperuser: true,
      department: 'Management',
    })

    render(<App />)

    // Verify sidebar displays ⚙️ System & Governance
    expect(screen.getByText(/System & Governance/i)).toBeInTheDocument()

    // Verify links exist
    const auditLink = screen.getByRole('link', { name: /Audit & Tracking/i })
    const adminLink = screen.getByRole('link', { name: /Administration/i })
    expect(auditLink).toBeInTheDocument()
    expect(adminLink).toBeInTheDocument()

    // Super user navigates to audit
    fireEvent.click(auditLink)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Audit & Device Tracking/i })).toBeInTheDocument()
    })
  })
})
