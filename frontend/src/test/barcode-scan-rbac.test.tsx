import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import type { Asset } from '../types/asset'

const smtAsset: Asset = {
  id: 'ast-smt-8107343',
  assetCode: '8107343',
  assetTag: '8107343',
  name: 'Yamaha SMT High-Speed Feeder',
  currentDescription: 'Yamaha SMT High-Speed Feeder Line 1',
  category: 'SMT Machinery',
  currentCategory: 'SMT Machinery',
  department: 'SMT Operations',
  currentDepartment: 'SMT Operations',
  building: 'C39',
  floor: '1F',
  location: 'C39-1F',
  currentLocation: 'Bay 4',
  company: 'IIPL',
  plant: 'Noida Plant',
  inChargeId: 'EMP-SMT-001',
  inChargeName: 'Ramesh Patel',
  assignedTo: 'Ramesh Patel',
  whoInCharge: 'EMP-SMT-001 · Ramesh Patel',
  status: 'Completed',
  assetCondition: 'Operational',
  purchaseDate: '2026-01-01',
  purchaseCost: 250000,
  currentValue: 220000,
  serialNumber: 'SN-YM-8107343',
  date: '2026-01-01',
}

const itAsset: Asset = {
  id: 'ast-it-9001122',
  assetCode: '9001122',
  assetTag: '9001122',
  name: 'Dell PowerEdge R750 Server',
  currentDescription: 'Dell PowerEdge R750 Server',
  category: 'IT Infrastructure',
  currentCategory: 'IT Infrastructure',
  department: 'IT',
  currentDepartment: 'IT',
  building: 'C39',
  floor: '3F',
  location: 'C39-3F',
  currentLocation: 'Server Room',
  company: 'IIPL',
  plant: 'Noida Plant',
  inChargeId: 'EMP-IT-101',
  inChargeName: 'Sanjay IT',
  assignedTo: 'Sanjay IT',
  whoInCharge: 'EMP-IT-101 · Sanjay IT',
  status: 'Completed',
  assetCondition: 'Operational',
  purchaseDate: '2026-01-01',
  purchaseCost: 450000,
  currentValue: 400000,
  serialNumber: 'SN-DELL-9001122',
  date: '2026-01-01',
}

describe('Barcode / QR Scanning RBAC & Direct Login Routing Invariants', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    sessionStorage.clear()
    localStorage.clear()
    localStorage.setItem('meridian_assets', JSON.stringify([smtAsset, itAsset]))
    // Configure offline user cache for mock authentication
    localStorage.setItem(
      'meridian_users_cache',
      JSON.stringify([
        {
          userId: 'USR-IT-USER',
          name: 'Neha IT Specialist',
          role: 'Employee',
          department: 'IT',
          password: 'Password123!',
          isSuperuser: false,
        },
        {
          userId: 'USR-SMT-USER',
          name: 'Ramesh SMT Operator',
          role: 'Employee',
          department: 'SMT Operations',
          password: 'Password123!',
          isSuperuser: false,
        },
        {
          userId: 'USR-ADMIN',
          name: 'Factory Administrator',
          role: 'Admin',
          department: 'Administration',
          password: 'Admin@2026!',
          isSuperuser: true,
        },
      ])
    )
    window.history.pushState({}, '', '/')
  })

  it('Invariant 1: Direct scan without login drops visitor directly to Login Page and does NOT expose product data', () => {
    // Simulate user scanning barcode/QR URL on mobile camera: https://app/?asset=8107343#asset-details
    window.history.pushState({}, '', '/?asset=8107343')

    render(<App />)

    // User is NOT logged in -> Drops directly onto Login Page
    expect(screen.getByRole('button', { name: /sign in to factory system/i })).toBeInTheDocument()
    expect(screen.getByText(/Meridian Manufacturing India Pvt\. Ltd\./i)).toBeInTheDocument()

    // Confirms scanned asset detected banner is visible on the login screen
    expect(screen.getByText(/Scanned Code Detected:/i)).toBeInTheDocument()
    expect(screen.getByText('8107343')).toBeInTheDocument()

    // Sensitive asset data MUST NOT be exposed on the screen!
    expect(screen.queryByText('Yamaha SMT High-Speed Feeder Line 1')).not.toBeInTheDocument()
    expect(screen.queryByText('SN-YM-8107343')).not.toBeInTheDocument()
  })

  it('Invariant 2: When user logs in with a mismatched department, they are logged in but CANNOT see product data (Access Restricted)', async () => {
    // Simulate scanning SMT asset code 8107343
    window.history.pushState({}, '', '/?asset=8107343')

    render(<App />)

    // User enters credentials for an IT department account
    fireEvent.change(screen.getByLabelText(/User ID \/ Employee ID/i), {
      target: { value: 'USR-IT-USER' },
    })
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: 'Password123!' },
    })

    // Submit login form
    fireEvent.click(screen.getByRole('button', { name: /sign in to factory system/i }))

    // User is logged in to the portal
    await waitFor(() => {
      // Access Restricted modal is displayed
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Department Access Restricted \/ 部门权限受限/i })).toBeInTheDocument()
      expect(screen.getByText(/Confidential Equipment Data Blocked/i)).toBeInTheDocument()

      // Shows department comparison
      expect(screen.getAllByText('SMT Operations').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('IT').length).toBeGreaterThanOrEqual(1)

      // The detailed specifications of the SMT asset MUST NOT be exposed!
      expect(screen.queryByText('Yamaha SMT High-Speed Feeder Line 1')).not.toBeInTheDocument()
      expect(screen.queryByText('SN-YM-8107343')).not.toBeInTheDocument()
    })

    // Clicking "Return to My Department Dashboard" dismisses modal
    fireEvent.click(screen.getByRole('button', { name: /Return to My Department Dashboard/i }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('Invariant 3: When user logs in with the matching department (or Admin), they ARE allowed to see product data', async () => {
    // Simulate scanning SMT asset code 8107343
    window.history.pushState({}, '', '/?asset=8107343')

    render(<App />)

    // User enters credentials for an SMT department account
    fireEvent.change(screen.getByLabelText(/User ID \/ Employee ID/i), {
      target: { value: 'USR-SMT-USER' },
    })
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: 'Password123!' },
    })

    // Submit login form
    fireEvent.click(screen.getByRole('button', { name: /sign in to factory system/i }))

    // User is authorized: Equipment Fixed Asset Details modal opens with verified specifications
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /设备固定资产详情 \/ Equipment Fixed Asset Details/i })).toBeInTheDocument()
      expect(screen.getAllByText('Yamaha SMT High-Speed Feeder Line 1').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('SN-YM-8107343').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('SMT Operations').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('Invariant 4: Hardware Barcode Scanner in Header Search also enforces Department RBAC', async () => {
    // Pre-authenticate as IT employee
    sessionStorage.setItem('meridian_auth', 'true')
    localStorage.setItem(
      'meridian_user_profile',
      JSON.stringify({
        userId: 'USR-IT-USER',
        userName: 'Neha IT Specialist',
        role: 'Employee',
        department: 'IT',
      })
    )

    render(<App />)

    // Find the header barcode search input
    const searchInput = screen.getByLabelText(/Search assets, people, work orders/i)
    expect(searchInput).toBeInTheDocument()

    // Barcode scanner scans SMT asset barcode 8107343 into search and sends Enter
    fireEvent.change(searchInput, { target: { value: '8107343' } })
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

    // Access Denied modal is triggered because asset belongs to SMT Operations
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText(/Department Access Restricted \/ 部门权限受限/i)).toBeInTheDocument()
      expect(screen.queryByText('Yamaha SMT High-Speed Feeder Line 1')).not.toBeInTheDocument()
    })
  })
})
