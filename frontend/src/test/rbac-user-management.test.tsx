import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserManagementView } from '../components/UserManagementView'
import type { UserProfile } from '../lib/deviceTracker'

describe('Department RBAC & User Management Specification', () => {
  const mockAdminUser: UserProfile = {
    userId: 'USR-ADMIN',
    userName: 'Uttam Singh',
    role: 'Admin',
    department: 'IT',
  }

  const mockSwitchUser = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders Department RBAC console with department tabs, user list, and KPI statistics', () => {
    render(
      <UserManagementView
        currentUser={mockAdminUser}
        onSwitchUser={mockSwitchUser}
        lang="en"
      />
    )

    // Heading & description
    expect(screen.getByText('Department RBAC & User Access Management')).toBeInTheDocument()
    expect(screen.getByText(/Superuser console: Provision department staff/i)).toBeInTheDocument()

    // Department tabs
    expect(screen.getByText(/All Departments/i)).toBeInTheDocument()
    expect(screen.getByText(/Production & SMT/i)).toBeInTheDocument()
    expect(screen.getByText(/Maintenance & Calibration/i)).toBeInTheDocument()
    expect(screen.getByText(/Warehouse & Store/i)).toBeInTheDocument()

    // Default seed users
    expect(screen.getAllByText('USR-ADMIN').length).toBeGreaterThan(0)
    expect(screen.getByText('Uttam Singh')).toBeInTheDocument()
  })

  it('filters users by department tab', async () => {
    render(
      <UserManagementView
        currentUser={mockAdminUser}
        onSwitchUser={mockSwitchUser}
        lang="en"
      />
    )

    // Click Maintenance tab button in the top tab row
    const tabs = screen.getAllByRole('button')
    const mntTab = tabs.find((btn) => btn.textContent?.includes('Maintenance & Calibration'))
    expect(mntTab).toBeDefined()
    fireEvent.click(mntTab!)

    // Maintenance user should be visible
    expect(screen.getByText('MNT-101')).toBeInTheDocument()
    expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument()

    // Non-maintenance user (Uttam Singh) should be filtered out
    expect(screen.queryByText('Uttam Singh')).not.toBeInTheDocument()
  })

  it('Superuser adds new user with department and manually specified password (no random password)', async () => {
    render(
      <UserManagementView
        currentUser={mockAdminUser}
        onSwitchUser={mockSwitchUser}
        lang="en"
      />
    )

    // Open Add Department User modal
    const allButtons = screen.getAllByRole('button')
    const addBtn = allButtons.find((b) => b.textContent?.includes('Add Department User'))
    expect(addBtn).toBeDefined()
    fireEvent.click(addBtn!)

    expect(screen.getByText(/Add Department User \(Superuser RBAC\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Random password generation is disabled/i)).toBeInTheDocument()

    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SMT-101, MNT-202/i), {
      target: { value: 'SMT-NEW-99' },
    })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Rajesh Kumar/i), {
      target: { value: 'Deepak Sharma' },
    })

    // Type custom department into the typable input field
    const deptInput = screen.getByPlaceholderText(/Type department/i)
    fireEvent.change(deptInput, { target: { value: 'SMT Line 2 Robotics' } })

    // Manual password input (Superuser explicitly provides credential)
    const pwInputs = screen.getAllByPlaceholderText(/password/i)
    fireEvent.change(pwInputs[0], { target: { value: 'SuperManualPass2026#' } })
    fireEvent.change(pwInputs[1], { target: { value: 'SuperManualPass2026#' } })

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Create User & Save Credentials/i })
    fireEvent.click(submitBtn)

    // Verify user was created with custom typed department & manual password in table and handover card
    await waitFor(() => {
      expect(screen.getAllByText('SMT-NEW-99').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Deepak Sharma').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('SMT Line 2 Robotics').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('SuperManualPass2026#').length).toBeGreaterThanOrEqual(1)
    })

    // Verify credential handover card is rendered for superuser to distribute
    expect(screen.getByText(/Hand Over Credentials/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy Credentials to Hand Over/i })).toBeInTheDocument()
  })

  it('Superuser can manually reset password for an existing department user', async () => {
    render(
      <UserManagementView
        currentUser={mockAdminUser}
        onSwitchUser={mockSwitchUser}
        lang="en"
      />
    )

    // Click Reset PW for first user
    const resetButtons = screen.getAllByRole('button', { name: /Reset PW/i })
    fireEvent.click(resetButtons[0])

    expect(screen.getByText(/Reset Password \(Manual Superuser\)/i)).toBeInTheDocument()

    // Enter manual password
    const newPwInput = screen.getByPlaceholderText(/Enter new password/i)
    fireEvent.change(newPwInput, { target: { value: 'BrandNewManualPass#2026' } })

    const updateBtn = screen.getByRole('button', { name: /Update Password/i })
    fireEvent.click(updateBtn)

    // Verify updated password displays in table
    await waitFor(() => {
      expect(screen.getByText('BrandNewManualPass#2026')).toBeInTheDocument()
    })
  })

  it('allows switching active session to another department user', async () => {
    render(
      <UserManagementView
        currentUser={mockAdminUser}
        onSwitchUser={mockSwitchUser}
        lang="en"
      />
    )

    const switchButtons = screen.getAllByRole('button', { name: /Switch User/i })
    fireEvent.click(switchButtons[0])

    expect(mockSwitchUser).toHaveBeenCalled()
  })
})
