import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MasterMappingView from '../components/MasterMappingView'
import RBACManagementView from '../components/RBACManagementView'
import type { UserProfile } from '../lib/deviceTracker'

describe('Master Mapping & RBAC Administration Module Specifications', () => {
  const superUser: UserProfile = {
    userId: 'USR-ADMIN',
    userName: 'Uttam Singh',
    role: 'Super User',
    department: 'IT & Infrastructure',
    isSuperuser: true,
  }

  const regularUser: UserProfile = {
    userId: 'EMP-VIEW-01',
    userName: 'Normal Employee',
    role: 'Viewer',
    department: 'Production',
    isSuperuser: false,
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 1: MASTER MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────
  describe('Module 1 - Master Mapping Governance', () => {
    it('blocks access for non-superusers with explicit 403 forbidden security alert', () => {
      render(<MasterMappingView currentUser={regularUser} />)

      expect(screen.getByText(/ACCESS FORBIDDEN: Super User Authorization Required/i)).toBeInTheDocument()
      expect(
        screen.getByText(/single source of truth for the entire enterprise organizational hierarchy/i)
      ).toBeInTheDocument()
    })

    it('renders 7-tier hierarchy structure and tabs for superuser', async () => {
      render(<MasterMappingView currentUser={superUser} />)

      // Header & Superuser badge
      expect(screen.getByText('Master Mapping Administration')).toBeInTheDocument()
      expect(screen.getByText(/👑 Super User Single Source of Truth/i)).toBeInTheDocument()

      // 5 Core Tabs
      expect(screen.getByText('Hierarchy Explorer')).toBeInTheDocument()
      expect(screen.getByText('Level Management (CRUD)')).toBeInTheDocument()
      expect(screen.getByText('Mapping Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Import / Export')).toBeInTheDocument()
      expect(screen.getByText('Hierarchy Audit Trail')).toBeInTheDocument()

      // Explorer Tree Elements
      await waitFor(() => {
        expect(screen.getByText('Expandable Organizational Tree')).toBeInTheDocument()
        expect(screen.getByText(/7-Tier Cascading Hierarchy/i)).toBeInTheDocument()
      })
    })

    it('switches between 7 levels in Level Management (CRUD) tab', async () => {
      render(<MasterMappingView currentUser={superUser} />)

      const crudTabBtn = screen.getByText('Level Management (CRUD)')
      fireEvent.click(crudTabBtn)

      // 7 Level buttons (Plural labels from LEVEL_LABELS)
      expect(screen.getByRole('button', { name: /Companies/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Plants/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Buildings/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Floors/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Departments/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Areas \/ Zones/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Asset Locations/i })).toBeInTheDocument()
    })

    it('renders Mapping Dashboard with completion rate and 7 level KPIs', async () => {
      render(<MasterMappingView currentUser={superUser} />)

      const dashTabBtn = screen.getByText('Mapping Dashboard')
      fireEvent.click(dashTabBtn)

      await waitFor(() => {
        expect(screen.getByText(/Hierarchy Completion Status/i)).toBeInTheDocument()
        expect(screen.getByText(/Mapping Health/i)).toBeInTheDocument()
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 2: USER & RBAC MANAGEMENT TESTS
  // ─────────────────────────────────────────────────────────────────────────
  describe('Module 2 - User & RBAC Management', () => {
    it('blocks access for non-superusers with security alert', () => {
      render(<RBACManagementView currentUser={regularUser} />)

      expect(screen.getByText(/403 Access Denied: Super User Only/i)).toBeInTheDocument()
      expect(
        screen.getByText(/User & RBAC Administration is strictly restricted to Super Users/i)
      ).toBeInTheDocument()
    })

    it('renders User & RBAC management console with 5 functional tabs', async () => {
      render(<RBACManagementView currentUser={superUser} />)

      expect(screen.getByText('User & RBAC Administration')).toBeInTheDocument()
      expect(screen.getByText(/👑 Super User Exclusive/i)).toBeInTheDocument()

      expect(screen.getByText(/User Management/i)).toBeInTheDocument()
      expect(screen.getByText(/Role & Permission Matrix/i)).toBeInTheDocument()
      expect(screen.getByText(/Hierarchy Scope Engine/i)).toBeInTheDocument()
      expect(screen.getByText(/Approval Workflows/i)).toBeInTheDocument()
      expect(screen.getByText(/RBAC Dashboard & Audit/i)).toBeInTheDocument()
    })

    it('opens Add User modal and enforces cascading Master Mapping dropdowns (manual text entry prohibited)', async () => {
      render(<RBACManagementView currentUser={superUser} />)

      const addUserBtn = screen.getByRole('button', { name: /Add New User/i })
      fireEvent.click(addUserBtn)

      // Modal is open
      expect(screen.getByText('Register New Enterprise User')).toBeInTheDocument()
      expect(screen.getByText('Manual text input strictly prohibited')).toBeInTheDocument()

      // Cascading dropdowns exist
      expect(screen.getByText('Company ▼')).toBeInTheDocument()
      expect(screen.getByText('Plant ▼')).toBeInTheDocument()
      expect(screen.getByText('Building ▼')).toBeInTheDocument()
      expect(screen.getByText('Floor ▼')).toBeInTheDocument()
      expect(screen.getByText('Department ▼')).toBeInTheDocument()
      expect(screen.getByText('Area / Zone ▼')).toBeInTheDocument()
    })

    it('renders Role & Permission Matrix with 13 modules and 14 actions', async () => {
      render(<RBACManagementView currentUser={superUser} />)

      const matrixTabBtn = screen.getByText(/Role & Permission Matrix/i)
      fireEvent.click(matrixTabBtn)

      await waitFor(() => {
        expect(screen.getByText(/Module \(13 Total\)/i)).toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Assets')).toBeInTheDocument()
        expect(screen.getByText('Asset Requests')).toBeInTheDocument()
        expect(screen.getByText('Asset Transfer')).toBeInTheDocument()
        expect(screen.getByText('Stock Count')).toBeInTheDocument()
        expect(screen.getByText('Settings')).toBeInTheDocument()

        // Action headers
        expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument()
      })
    })

    it('renders Hierarchy Scope Engine and simulates user branch boundaries', async () => {
      render(<RBACManagementView currentUser={superUser} />)

      const scopeTabBtn = screen.getByText(/Hierarchy Scope Engine/i)
      fireEvent.click(scopeTabBtn)

      await waitFor(() => {
        expect(screen.getByText(/Scope Boundary Simulation & Verification/i)).toBeInTheDocument()
        expect(screen.getByText(/Assigned Hierarchy Branch/i)).toBeInTheDocument()
        expect(screen.getByText(/Company Level:/i)).toBeInTheDocument()
        expect(screen.getByText(/Plant Level:/i)).toBeInTheDocument()
        expect(screen.getByText(/Building Level:/i)).toBeInTheDocument()
      })
    })

    it('renders Approval Workflow Domain table with configurable tiers', async () => {
      render(<RBACManagementView currentUser={superUser} />)

      const appTabBtn = screen.getByText(/Approval Workflows/i)
      fireEvent.click(appTabBtn)

      await waitFor(() => {
        expect(screen.getByText('Multi-Tier Approval Authority Matrix')).toBeInTheDocument()
        expect(screen.getAllByText(/Asset Purchase/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Asset Disposal/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Finance & Accounts/i).length).toBeGreaterThan(0)
      })
    })
  })
})
