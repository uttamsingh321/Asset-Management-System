import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '@/App'
import type { ReprintRequest } from '@/lib/labelReprintService'

describe('Super User Approval Dashboard & Notification Center Specification', () => {
  const mockPendingRequests: ReprintRequest[] = [
    {
      id: 'RPT-REQ-A7A94FA7',
      assetId: '115283',
      assetCode: '2006257',
      assetName: 'IMPORT BOE 3821488',
      department: 'Production & SMT',
      requestedBy: 'Arbind Kumar Singh',
      requesterUserId: '19102709',
      requesterDept: 'Production & SMT',
      reason: 'Label Damaged / Scratched',
      notes: 'grfdsw',
      status: 'pending',
      requestedAt: '2026-11-17T05:25:46.868535+00:00',
      isUsed: false,
    },
    {
      id: 'RPT-REQ-FC9AD273',
      assetId: '115284',
      assetCode: '2005941',
      assetName: 'Equipment Fixed Asset',
      department: 'Production & SMT',
      requestedBy: 'Arbind Kumar Singh',
      requesterUserId: '19102709',
      requesterDept: 'Production & SMT',
      reason: 'Label Damaged / Scratched',
      notes: '',
      status: 'pending',
      requestedAt: '2026-11-17T04:44:45.596020+00:00',
      isUsed: false,
    },
  ]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()

    // Pre-populate reprint requests
    localStorage.setItem('meridian_reprint_requests', JSON.stringify(mockPendingRequests))

    // Mock fetch for backend reprint-requests endpoint
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/labels/reprint-requests/')) {
        return {
          ok: true,
          json: async () => ({ requests: mockPendingRequests }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ count: 0, assets: [] }),
      } as Response
    })
  })

  it('displays dedicated Super User Approval & Governance Center on dashboard for Super User', async () => {
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

    // Verify Super User Approval & Governance Center is rendered
    expect(
      screen.getByText(/Super User Approval & Governance Center/i)
    ).toBeInTheDocument()

    // Verify pending count badge
    expect(
      screen.getByText(/2 Reprint Requests Pending Approval/i)
    ).toBeInTheDocument()

    // Verify asset codes in requests
    expect(screen.getByText(/2006257/)).toBeInTheDocument()
    expect(screen.getByText(/2005941/)).toBeInTheDocument()
  })

  it('displays badge on notification bell and opens notification flyout with pending approval requests', async () => {
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

    // Notification bell should show count '2'
    const notifBtn = screen.getByLabelText(/Notifications \(2 pending approvals\)/i)
    expect(notifBtn).toBeInTheDocument()
    expect(notifBtn.textContent).toContain('2')

    // Click the bell
    fireEvent.click(notifBtn)

    // Flyout should open
    expect(screen.getByText(/Notifications & Approvals/i)).toBeInTheDocument()
    expect(screen.getByText(/2 re-print approval requests pending/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Arbind Kumar Singh/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Approve 1-Time Print/i).length).toBeGreaterThan(0)
  })

  it('approving a request calls action endpoint and updates status', async () => {
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

    // Find and click Approve button on the dashboard for the first request
    const approveButtons = screen.getAllByRole('button', { name: /Approve 1-Time Print/i })
    expect(approveButtons.length).toBeGreaterThan(0)

    fireEvent.click(approveButtons[0])

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('meridian_reprint_requests') || '[]')
      const approved = stored.find((r: ReprintRequest) => r.id === 'RPT-REQ-A7A94FA7')
      expect(approved?.status).toBe('approved')
    })
  })

  it('normal employee does NOT see the Super User Approval & Governance Center', async () => {
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

    render(<App />)

    // Super user approval section must NOT be rendered for regular employee
    expect(
      screen.queryByText(/Super User Approval & Governance Center/i)
    ).not.toBeInTheDocument()
  })
})
