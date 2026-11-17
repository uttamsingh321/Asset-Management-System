import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '@/App'
import { LoginPage } from '@/components/LoginPage'
import {
  resolvePasswordResetRequest,
  getPasswordResetRequests,
  type PasswordResetRequest,
} from '@/lib/passwordResetService'
import { masterMappingService } from '@/lib/masterMappingService'

describe('Super User Password Reset Notification & Governance Specification', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()

    // Seed master RBAC user
    masterMappingService.saveRBACUsers([
      {
        id: '1',
        employeeId: '19102709',
        employeeName: 'Arbind Kumar Singh',
        email: 'arbind.singh@meridian.com',
        phone: '+91 98765 43210',
        plantId: 1,
        plantName: 'Noida Plant (SMT Line & Assembly)',
        buildingId: 1,
        buildingName: 'Main Building',
        floorId: 1,
        floorName: '1st Floor',
        departmentId: 1,
        departmentName: 'Production & SMT',
        department: 'Production & SMT',
        areaId: 1,
        areaName: 'SMT Line 1',
        role: 'Employee',
        designation: 'SMT Line Operator',
        status: 'Active',
        password: 'OldPassword123!',
      },
    ])
  })

  it('allows employee to submit password reset request from LoginPage and blocks superuser self-reset', async () => {
    const handleLoginSuccess = vi.fn()
    render(<LoginPage onLoginSuccess={handleLoginSuccess} onEnterOfflineMode={vi.fn()} lang="en" />)

    // Click "Forgot password?"
    const forgotPwBtn = screen.getByRole('button', { name: /Forgot password\?/i })
    fireEvent.click(forgotPwBtn)

    // Modal opens
    expect(screen.getByText(/Password Reset Request to Super User/i)).toBeInTheDocument()

    // Test superuser restriction
    const input = screen.getByLabelText(/Employee ID \/ User ID \*/i)
    fireEvent.change(input, { target: { value: 'USR-ADMIN' } })
    const submitBtn = screen.getByRole('button', { name: /Notify Super User for New Password/i })
    fireEvent.click(submitBtn)

    // Should not create request for superuser
    expect(getPasswordResetRequests().length).toBe(0)

    // Now enter valid employee ID
    fireEvent.change(input, { target: { value: '19102709' } })
    fireEvent.click(submitBtn)

    // Modal now displays success confirmation with employee name and ticket
    await waitFor(() => {
      expect(screen.getByText(/Super User Notified Successfully!/i)).toBeInTheDocument()
      expect(screen.getByText(/Arbind Kumar Singh/i)).toBeInTheDocument()
      expect(screen.getByText(/19102709/)).toBeInTheDocument()
    })

    // Request is persisted in storage
    const requests = getPasswordResetRequests()
    expect(requests.length).toBe(1)
    expect(requests[0].userId).toBe('19102709')
    expect(requests[0].userName).toBe('Arbind Kumar Singh')
    expect(requests[0].status).toBe('pending')
  })

  it('notifies Super User on the dashboard and in the notification flyout', async () => {
    // Seed pending reset request for Arbind Kumar Singh
    const mockRequest: PasswordResetRequest = {
      id: 'PRR-TEST-001',
      requestId: 'PRR-TEST-001',
      userId: '19102709',
      userName: 'Arbind Kumar Singh',
      department: 'Production & SMT',
      plant: 'Noida Plant (SMT Line & Assembly)',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      notes: 'Forgot password after shift rotation',
    }
    localStorage.setItem('meridian_password_reset_requests', JSON.stringify([mockRequest]))

    // Mock fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/password-reset-requests/')) {
        return {
          ok: true,
          json: async () => ({ requests: [mockRequest] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ count: 0, assets: [] }),
      } as Response
    })

    // Log in as Super User
    sessionStorage.setItem('meridian_auth', 'true')
    sessionStorage.setItem('meridian_active_factory', 'Noida Plant (SMT Line & Assembly)')
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: 'USR-ADMIN',
        userName: 'Uttam Singh',
        role: 'Super User',
        department: 'Management',
        isSuperuser: true,
      })
    )
    window.location.hash = '#dashboard'

    render(<App />)

    // Super User Approval Center on #dashboard shows the pending request
    await waitFor(() => {
      expect(screen.getByText(/Employee Password Reset Requests/i)).toBeInTheDocument()
      expect(screen.getByText(/Arbind Kumar Singh/i)).toBeInTheDocument()
      expect(screen.getByText(/19102709/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Set New Password/i })).toBeInTheDocument()
    })

    // Open Notification Flyout
    const notifBell = screen.getByRole('button', { name: /Notifications/i })
    fireEvent.click(notifBell)

    // Notification flyout displays employee details
    expect(screen.getByText(/Notifications & Approvals/i)).toBeInTheDocument()
    const passwordCards = screen.getAllByText(/Arbind Kumar Singh/i)
    expect(passwordCards.length).toBeGreaterThan(0)
  })

  it('allows Super User to set new password, resolving request and enabling employee login', async () => {
    // Seed request
    const mockRequest: PasswordResetRequest = {
      id: 'PRR-TEST-002',
      requestId: 'PRR-TEST-002',
      userId: '19102709',
      userName: 'Arbind Kumar Singh',
      department: 'Production & SMT',
      plant: 'Noida Plant (SMT Line & Assembly)',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      notes: 'Need urgent password reset',
    }
    localStorage.setItem('meridian_password_reset_requests', JSON.stringify([mockRequest]))

    // Mock API
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/password-reset-resolve/')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: 'New password set successfully',
            request: { ...mockRequest, status: 'completed' },
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ count: 0, assets: [] }),
      } as Response
    })

    // Super user resolves request
    const superUser = {
      userId: 'USR-ADMIN',
      userName: 'Uttam Singh',
      role: 'Super User',
      isSuperuser: true,
    }

    const result = await resolvePasswordResetRequest(
      'PRR-TEST-002',
      'MeridianNewPass@2026',
      superUser
    )

    expect(result.success).toBe(true)

    // Check request is completed
    const updatedRequests = getPasswordResetRequests()
    const found = updatedRequests.find((r) => r.id === 'PRR-TEST-002')
    expect(found?.status).toBe('completed')
    expect(found?.resolvedBy).toBe('Uttam Singh')

    // Check RBAC user's password was updated
    const rbacUsers = masterMappingService.getRBACUsers()
    const arbind = rbacUsers.find((u) => u.employeeId === '19102709')
    expect(arbind?.password).toBe('MeridianNewPass@2026')

    // Test that Arbind CANNOT log in with a random password
    const handleLoginFail = vi.fn()
    const { unmount } = render(<LoginPage onLoginSuccess={handleLoginFail} onEnterOfflineMode={vi.fn()} lang="en" />)

    const failUserInput = screen.getByLabelText(/User ID \/ Employee ID \*/i)
    const failPwInput = screen.getByLabelText(/^Password \*/i)
    fireEvent.change(failUserInput, { target: { value: '19102709' } })
    fireEvent.change(failPwInput, { target: { value: 'completely_random_wrong_pw' } })

    const failSignInBtn = screen.getByRole('button', { name: /Sign In to Factory System/i })
    fireEvent.click(failSignInBtn)

    await new Promise((r) => setTimeout(r, 200))
    expect(handleLoginFail).not.toHaveBeenCalled()
    unmount()

    // Test that Arbind can now log in on LoginPage ONLY with this exact new password
    const handleLoginSuccess = vi.fn()
    render(<LoginPage onLoginSuccess={handleLoginSuccess} onEnterOfflineMode={vi.fn()} lang="en" />)

    const userInput = screen.getByLabelText(/User ID \/ Employee ID \*/i)
    const pwInput = screen.getByLabelText(/^Password \*/i)
    fireEvent.change(userInput, { target: { value: '19102709' } })
    fireEvent.change(pwInput, { target: { value: 'MeridianNewPass@2026' } })

    const signInBtn = screen.getByRole('button', { name: /Sign In to Factory System/i })
    fireEvent.click(signInBtn)

    await waitFor(() => {
      expect(handleLoginSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '19102709',
          userName: 'Arbind Kumar Singh',
        }),
        expect.any(String)
      )
    })
  })
})
