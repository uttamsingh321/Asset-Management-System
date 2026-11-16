import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginPage } from '../components/LoginPage'
import { SuperuserSecurityView } from '../components/SuperuserSecurityView'
import type { UserProfile } from '../lib/deviceTracker'

describe('Login Page Layout & Specification', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders complete split layout: Left side factory branding and Right side login box', () => {
    const handleLoginSuccess = vi.fn()
    const handleEnterOffline = vi.fn()
    const handleToggleLang = vi.fn()

    render(
      <LoginPage
        lang="en"
        onLoginSuccess={handleLoginSuccess}
        onEnterOfflineMode={handleEnterOffline}
        onToggleLang={handleToggleLang}
      />
    )

    // Left side: Logo & Factory Name
    expect(screen.getByText(/Meridian Manufacturing India Pvt\. Ltd\./i)).toBeInTheDocument()
    expect(screen.getByText(/Enterprise Plant System/i)).toBeInTheDocument()
    expect(screen.getByText(/Noida Plant · Line 1 & 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Gurgaon Facility/i)).toBeInTheDocument()

    // Right side: Username, Password, Factory Selection
    expect(screen.getByLabelText(/Factory \/ Manufacturing Plant \*/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e\.g\. USR-ADMIN, SMT-101/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Enter manual superuser password/i)).toBeInTheDocument()

    // Multi-factory selection options
    expect(screen.getByText(/Noida Plant \(SMT Line & Assembly\)/i)).toBeInTheDocument()

    // Language toggle button removed per user request
    expect(screen.queryByRole('button', { name: /Switch to English|हिन्दी में बदलें/i })).not.toBeInTheDocument()

    // [Remember me] checkbox
    const rememberMeCheckbox = screen.getByLabelText(/Remember me on this workshop terminal/i)
    expect(rememberMeCheckbox).toBeInTheDocument()

    // Forgot password link
    const forgotPwBtn = screen.getByRole('button', { name: /Forgot password\?/i })
    expect(forgotPwBtn).toBeInTheDocument()

    // Bottom small text: version number & offline mode entry
    expect(screen.getByText(/v2\.4\.0-IN-PROD/i)).toBeInTheDocument()
    const offlineBtn = screen.getByRole('button', { name: /Offline Mode Entry/i })
    expect(offlineBtn).toBeInTheDocument()

    // Clicking offline mode triggers offline handler
    fireEvent.click(offlineBtn)
    expect(handleEnterOffline).toHaveBeenCalled()
  })

  it('clicking Forgot Password opens policy modal explaining Superuser manual credential handover', () => {
    render(
      <LoginPage
        lang="en"
        onLoginSuccess={vi.fn()}
        onEnterOfflineMode={vi.fn()}
        onToggleLang={vi.fn()}
      />
    )

    const forgotPwBtn = screen.getByRole('button', { name: /Forgot password\?/i })
    fireEvent.click(forgotPwBtn)

    expect(screen.getByText(/Credential Reset Policy/i)).toBeInTheDocument()
    expect(screen.getByText(/random password resets and email links are disabled/i)).toBeInTheDocument()
    expect(screen.getByText(/Contact your Plant Manager or the Factory Superuser/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Understood/i })).toBeInTheDocument()
  })

  it('supports password visibility show/hide toggle', () => {
    render(
      <LoginPage
        lang="en"
        onLoginSuccess={vi.fn()}
        onEnterOfflineMode={vi.fn()}
        onToggleLang={vi.fn()}
      />
    )

    const pwInput = screen.getByPlaceholderText(/Enter manual superuser password/i) as HTMLInputElement
    expect(pwInput.type).toBe('password')

    const toggleBtn = screen.getByTitle('Show password')
    fireEvent.click(toggleBtn)
    expect(pwInput.type).toBe('text')

    const hideBtn = screen.getByTitle('Hide password')
    fireEvent.click(hideBtn)
    expect(pwInput.type).toBe('password')
  })

  it('Superuser Security Console strictly rejects non-superusers (even Admins)', async () => {
    const regularAdminUser: UserProfile = {
      userId: 'ADM-002',
      userName: 'Sunil Admin',
      role: 'Admin',
      department: 'IT',
      isSuperuser: false,
    }

    render(<SuperuserSecurityView currentUser={regularAdminUser} lang="en" />)

    // Should display access denied blockade
    expect(screen.getByText(/Superuser Access Required/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Security lockout policies and login IP audit records are strictly restricted to the Superuser/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Security Login & Client IP Audit Trail/i)).not.toBeInTheDocument()
  })

  it('Superuser Security Console allows Superuser to view login IP audit trail and unlock accounts', async () => {
    const superuser: UserProfile = {
      userId: 'USR-ADMIN',
      userName: 'Uttam Singh Superuser',
      role: 'Superuser',
      department: 'IT',
      isSuperuser: true,
    }

    // Seed mock local audit logs for offline test environment
    const testLogs = [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        action: 'LOGIN',
        userId: 'USR-ADMIN',
        userName: 'Superuser',
        role: 'Superuser',
        clientIp: '192.168.1.100',
        deviceType: 'Laptop',
        os: 'Windows 11',
        browser: 'Chrome 122',
        details: { factory: 'Noida Plant', authMethod: 'Manual Superuser Password' },
      },
      {
        id: 2,
        timestamp: new Date().toISOString(),
        action: 'ACCOUNT_LOCKOUT',
        userId: 'SMT-992',
        userName: 'Operator A',
        role: 'Employee',
        clientIp: '192.168.1.205',
        deviceType: 'Tablet',
        os: 'Android 14',
        browser: 'Chrome Mobile',
        details: { factory: 'Gurgaon Plant', reason: '5 consecutive failed attempts' },
      },
    ]

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (typeof url === 'string' && url.includes('/api/security/login-audit/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ logs: testLogs, lockedAccounts: [] }),
        } as any
      }
      return { ok: true, json: async () => ({}) } as any
    })

    localStorage.setItem('meridian_local_audit_logs', JSON.stringify(testLogs))

    render(<SuperuserSecurityView currentUser={superuser} lang="en" />)

    await waitFor(() => {
      expect(screen.getByText(/Superuser Security: Login IP Audit & Lockout Control/i)).toBeInTheDocument()
      expect(screen.getByText(/Security Login & Client IP Audit Trail/i)).toBeInTheDocument()
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument()
      expect(screen.getByText('192.168.1.205')).toBeInTheDocument()
      expect(screen.getAllByText('ACCOUNT_LOCKOUT').length).toBeGreaterThanOrEqual(2)
    })

    fetchSpy.mockRestore()
  })

  it('allows newly created Master RBAC user to log in successfully and authenticates credentials', async () => {
    const handleLoginSuccess = vi.fn()
    const handleEnterOffline = vi.fn()

    // Simulate user created in RBAC module
    localStorage.setItem(
      'meridian_master_rbac_users_store',
      JSON.stringify([
        {
          id: '101',
          employeeId: '19102709',
          employeeName: 'Arbind Kumar Singh',
          email: 'arbind@meridian.com',
          department: 'Production & SMT',
          designation: 'SMT Line Operator',
          status: 'Active',
          role: 'Employee',
          password: 'MyCustomPassword123!',
          createdAt: new Date().toISOString(),
        },
      ])
    )

    render(
      <LoginPage
        lang="en"
        onLoginSuccess={handleLoginSuccess}
        onEnterOfflineMode={handleEnterOffline}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. USR-ADMIN, SMT-101/i), {
      target: { value: '19102709' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Enter manual superuser password/i), {
      target: { value: 'MyCustomPassword123!' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Sign In to Factory System/i }))

    await waitFor(() => {
      expect(handleLoginSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '19102709',
          userName: 'Arbind Kumar Singh',
          department: 'Production & SMT',
          role: 'Employee',
        }),
        expect.any(String)
      )
    })
  })
})
