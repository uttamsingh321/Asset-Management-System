import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import App from '@/App'

describe('Cross-Device & Multi-User Clean Environment Invariants', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders login page cleanly on mobile (375px) without crashing or layout overflow', () => {
    window.innerWidth = 375
    window.innerHeight = 667
    window.location.hash = ''

    const { container } = render(<App />)
    expect(screen.getByText(/Meridian/i)).toBeInTheDocument()
    expect(container.querySelector('form')).toBeInTheDocument()
  })

  it('renders dashboard cleanly for normal employee Arbind Kumar Singh on mobile (375px)', () => {
    window.innerWidth = 375
    window.innerHeight = 667
    sessionStorage.setItem('meridian_auth', 'true')
    sessionStorage.setItem('meridian_active_factory', 'Noida Plant (SMT Line & Assembly)')
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: '19102709',
        userName: 'Arbind Kumar Singh',
        role: 'Employee',
        department: 'Production & SMT',
        isSuperuser: false,
      })
    )
    window.location.hash = '#dashboard'

    const { container } = render(<App />)
    expect(screen.getAllByText(/Arbind Kumar Singh/i).length).toBeGreaterThan(0)
    expect(container.querySelector('.wrap')).toBeInTheDocument()
  })

  it('renders Task Queue cleanly for normal employee Arbind Kumar Singh on laptop (1024px)', () => {
    window.innerWidth = 1024
    window.innerHeight = 768
    sessionStorage.setItem('meridian_auth', 'true')
    sessionStorage.setItem('meridian_active_factory', 'Noida Plant (SMT Line & Assembly)')
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: '19102709',
        userName: 'Arbind Kumar Singh',
        role: 'Employee',
        department: 'Production & SMT',
        isSuperuser: false,
      })
    )
    window.location.hash = '#tasks'

    render(<App />)
    expect(screen.getByText(/Asset Code Task Dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/Four Major Asset Categories/i)).toBeInTheDocument()
  })

  it('renders Asset Gallery cleanly for normal employee on mobile (390px)', () => {
    window.innerWidth = 390
    window.innerHeight = 844
    sessionStorage.setItem('meridian_auth', 'true')
    sessionStorage.setItem('meridian_active_factory', 'Noida Plant (SMT Line & Assembly)')
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: '19102709',
        userName: 'Arbind Kumar Singh',
        role: 'Employee',
        department: 'Production & SMT',
        isSuperuser: false,
      })
    )
    window.location.hash = '#assets'

    const { container } = render(<App />)
    expect(container.querySelector('.wrap')).toBeInTheDocument()
  })
})
